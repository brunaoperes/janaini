'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/v2/ui/Icon';
import { derivarCategoria, LABEL_CAT } from './categoria';
import { CategoriaIcon, type ServicoItem, type Colaboradora } from './_shared';

const VAZIO = { nome: '', duracao_minutos: '', valor: '', descricao: '', dono_colaborador_id: '', ativo: true };

export default function ServicoModal({
  aberto, servico, colaboradoras, nomesExistentes, onClose, onSaved,
}: {
  aberto: boolean;
  servico: ServicoItem | null;               // null = novo
  colaboradoras: Colaboradora[];
  nomesExistentes: { id: number; nome: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [campos, setCampos] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const editando = servico != null;

  useEffect(() => {
    if (!aberto) return;
    if (servico) {
      setCampos({
        nome: servico.nome,
        duracao_minutos: String(servico.duracao_minutos ?? ''),
        valor: String(servico.valor ?? ''),
        descricao: servico.descricao ?? '',
        dono_colaborador_id: servico.dono_colaborador_id != null ? String(servico.dono_colaborador_id) : '',
        ativo: servico.ativo,
      });
    } else {
      setCampos(VAZIO);
    }
  }, [aberto, servico]);

  // esc fecha
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onClose]);

  const catPreview = useMemo(() => derivarCategoria(campos.nome, campos.descricao), [campos.nome, campos.descricao]);

  const nomeDuplicado = useMemo(() => {
    const alvo = campos.nome.trim().toLowerCase();
    if (alvo.length < 3) return false;
    return nomesExistentes.some((s) => s.nome.trim().toLowerCase() === alvo && s.id !== servico?.id);
  }, [campos.nome, nomesExistentes, servico?.id]);

  const salvar = async () => {
    const nome = campos.nome.trim();
    const duracao = Number(campos.duracao_minutos);
    const valor = Number(campos.valor);
    if (nome.length < 3) { toast.error('Informe um nome com pelo menos 3 caracteres.'); return; }
    if (!Number.isFinite(duracao) || duracao < 1) { toast.error('Informe a duração em minutos (maior que zero).'); return; }
    if (duracao > 480) { toast.error('Duração máxima é 480 minutos.'); return; }
    if (!Number.isFinite(valor) || valor < 0) { toast.error('Informe um valor válido.'); return; }

    const body = {
      nome, duracao_minutos: duracao, valor,
      descricao: campos.descricao.trim() || undefined,
      ativo: campos.ativo,
      dono_colaborador_id: campos.dono_colaborador_id ? Number(campos.dono_colaborador_id) : null,
    };

    setSalvando(true);
    try {
      const url = editando ? `/api/v2/servicos?id=${servico!.id}` : '/api/v2/servicos';
      const r = await fetch(url, { method: editando ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok) { toast.success(editando ? 'Serviço atualizado!' : 'Serviço criado!'); onSaved(); onClose(); }
      else toast.error(j.error || 'Não foi possível salvar.');
    } catch { toast.error('Erro de conexão.'); } finally { setSalvando(false); }
  };

  if (!aberto) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(33,28,25,.4)', backdropFilter: 'blur(2px)' }} />
      <div role="dialog" aria-modal="true" aria-label={editando ? 'Editar serviço' : 'Novo serviço'} style={{
        position: 'fixed', zIndex: 81, top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(560px, 94vw)', maxHeight: '92dvh', overflowY: 'auto',
        background: 'var(--nb-surface)', border: '1px solid var(--nb-rule)', borderRadius: 'var(--nb-r-lg)', boxShadow: '0 24px 60px -24px rgba(33,28,25,.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--nb-rule)' }}>
          <div>
            <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>{editando ? `Serviço #${servico!.id}` : 'Catálogo'}</div>
            <div style={{ fontFamily: 'var(--nb-serif)', fontSize: 20, color: 'var(--nb-ink)' }}>{editando ? 'Editar serviço' : 'Novo serviço'}</div>
          </div>
          <button className="nb-btn nb-btn-quiet" onClick={onClose} aria-label="Fechar"><Icon name="X" size={18} /></button>
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
          <label style={{ display: 'block', gridColumn: '1 / -1' }}>
            <span className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Nome do serviço</span>
            <input className="nb-input" value={campos.nome} autoFocus onChange={(e) => setCampos((s) => ({ ...s, nome: e.target.value }))} placeholder="Ex.: Corte feminino" />
            {nomeDuplicado && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 12, color: 'var(--nb-warn)' }}>
                <Icon name="TriangleAlert" size={13} /> Já existe um serviço com este nome.
              </span>
            )}
          </label>

          <label style={{ display: 'block' }}>
            <span className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Duração (min)</span>
            <input className="nb-input nb-num" type="number" min={1} max={480} value={campos.duracao_minutos} onChange={(e) => setCampos((s) => ({ ...s, duracao_minutos: e.target.value }))} placeholder="60" />
          </label>

          <label style={{ display: 'block' }}>
            <span className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Valor (R$)</span>
            <input className="nb-input nb-num" type="number" min={0} step="0.01" value={campos.valor} onChange={(e) => setCampos((s) => ({ ...s, valor: e.target.value }))} placeholder="0,00" />
          </label>

          <label style={{ display: 'block' }}>
            <span className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Exclusivo de (opcional)</span>
            <select className="nb-input" value={campos.dono_colaborador_id} onChange={(e) => setCampos((s) => ({ ...s, dono_colaborador_id: e.target.value }))}>
              <option value="">Serviço geral do salão</option>
              {colaboradoras.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>

          <label style={{ display: 'block' }}>
            <span className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Categoria (automática)</span>
            <div className="nb-input" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--nb-surface-2)', color: 'var(--nb-ink-soft)' }}>
              <span style={{ color: 'var(--nb-accent)', display: 'inline-flex' }}><CategoriaIcon cat={catPreview} size={16} /></span>
              {LABEL_CAT[catPreview]}
            </div>
          </label>

          <label style={{ display: 'block', gridColumn: '1 / -1' }}>
            <span className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Descrição (opcional)</span>
            <input className="nb-input" value={campos.descricao} onChange={(e) => setCampos((s) => ({ ...s, descricao: e.target.value }))} placeholder="Observações do serviço" />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, gridColumn: '1 / -1', cursor: 'pointer' }}>
            <input type="checkbox" checked={campos.ativo} onChange={(e) => setCampos((s) => ({ ...s, ativo: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--nb-accent)' }} />
            <span style={{ fontSize: 13.5, color: 'var(--nb-ink)' }}>Serviço ativo (disponível para novos atendimentos)</span>
          </label>

          <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 11.5, color: 'var(--nb-ink-faint)', lineHeight: 1.5 }}>
            A <strong>comissão</strong> é definida por profissional (não por serviço). A <strong>categoria</strong> é sugerida automaticamente pelo nome.
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--nb-rule)', padding: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="nb-btn nb-btn-ghost" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button className="nb-btn nb-btn-primary" onClick={salvar} disabled={salvando}>
            <Icon name="Check" size={16} /> {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar serviço'}
          </button>
        </div>
      </div>
    </>
  );
}
