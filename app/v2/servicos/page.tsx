'use client';

import { useEffect, useState, useCallback } from 'react';
import { Pencil, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import PageShell from '@/components/v2/layout/PageShell';
import { Card } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { brl, num } from '@/lib/v2/formatters';

// Serviço como vem de /api/v2/servicos (visão admin: todos, editáveis).
type Servico = {
  id: number;
  nome: string;
  duracao_minutos: number;
  valor: number;
  descricao: string | null;
  ativo: boolean;
  colaboradores_ids: number[] | null;
  dono_colaborador_id: number | null;
  dona_nome: string | null;
};

type Colaboradora = { id: number; nome: string };

const FORM_VAZIO = { nome: '', duracao_minutos: '', valor: '', descricao: '', dono_colaborador_id: '' };

export default function ServicosV2() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  const [form, setForm] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [campos, setCampos] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const nomeColab = useCallback(
    (id: number | null) => (id == null ? null : colaboradoras.find((c) => c.id === id)?.nome ?? `#${id}`),
    [colaboradoras],
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(false);
    try {
      const r = await fetch('/api/v2/servicos', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) {
        setServicos(j.itens || []);
        setColaboradoras(j.colaboradoras || []);
      } else setErro(true);
    } catch { setErro(true); } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNovo = () => { setEditandoId(null); setCampos(FORM_VAZIO); setForm(true); };

  const abrirEdicao = (s: Servico) => {
    setEditandoId(s.id);
    setCampos({
      nome: s.nome,
      duracao_minutos: String(s.duracao_minutos ?? ''),
      valor: String(s.valor ?? ''),
      descricao: s.descricao ?? '',
      dono_colaborador_id: s.dono_colaborador_id != null ? String(s.dono_colaborador_id) : '',
    });
    setForm(true);
  };

  const fechar = () => { setForm(false); setEditandoId(null); setCampos(FORM_VAZIO); };

  const salvar = async () => {
    const nome = campos.nome.trim();
    const duracao = Number(campos.duracao_minutos);
    const valor = Number(campos.valor);
    if (nome.length < 3) { toast.error('Informe um nome com pelo menos 3 caracteres.'); return; }
    if (!Number.isFinite(duracao) || duracao < 1) { toast.error('Informe a duração em minutos.'); return; }
    if (!Number.isFinite(valor) || valor < 0) { toast.error('Informe um valor válido.'); return; }

    const body = {
      nome, duracao_minutos: duracao, valor,
      descricao: campos.descricao.trim() || undefined,
      ativo: true,
      dono_colaborador_id: campos.dono_colaborador_id ? Number(campos.dono_colaborador_id) : null,
    };

    setSalvando(true);
    try {
      const url = editandoId != null ? `/api/v2/servicos?id=${editandoId}` : '/api/v2/servicos';
      const r = await fetch(url, { method: editandoId != null ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok) { toast.success(editandoId != null ? 'Serviço atualizado!' : 'Serviço criado!'); fechar(); carregar(); }
      else toast.error(j.error || 'Não foi possível salvar.');
    } catch { toast.error('Erro de conexão.'); } finally { setSalvando(false); }
  };

  const alternarAtivo = async (s: Servico) => {
    try {
      const r = await fetch(`/api/v2/servicos?id=${s.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: s.nome, duracao_minutos: s.duracao_minutos, valor: s.valor, descricao: s.descricao ?? undefined, ativo: !s.ativo, dono_colaborador_id: s.dono_colaborador_id }),
      });
      const j = await r.json();
      if (r.ok) { toast.success(!s.ativo ? 'Serviço ativado.' : 'Serviço desativado.'); carregar(); }
      else toast.error(j.error || 'Não foi possível alterar.');
    } catch { toast.error('Erro de conexão.'); }
  };

  const actions = (
    <button className="nb-btn nb-btn-primary" onClick={form ? fechar : abrirNovo}>
      <Icon name={form ? 'X' : 'Plus'} size={16} /> {form ? 'Fechar' : 'Novo serviço'}
    </button>
  );

  return (
    <PageShell title="Serviços" subtitle="Catálogo do salão e das profissionais" actions={actions}>
      {form && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, alignItems: 'end' }}>
            <label style={{ display: 'block', gridColumn: '1 / -1', maxWidth: 420 }}>
              <span className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Nome do serviço</span>
              <input className="nb-input" value={campos.nome} onChange={(e) => setCampos((s) => ({ ...s, nome: e.target.value }))} placeholder="Ex.: Corte feminino" />
            </label>
            <label style={{ display: 'block' }}>
              <span className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Duração (min)</span>
              <input className="nb-input nb-num" type="number" min={1} value={campos.duracao_minutos} onChange={(e) => setCampos((s) => ({ ...s, duracao_minutos: e.target.value }))} placeholder="60" />
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
            <label style={{ display: 'block', gridColumn: '1 / -1' }}>
              <span className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Descrição (opcional)</span>
              <input className="nb-input" value={campos.descricao} onChange={(e) => setCampos((s) => ({ ...s, descricao: e.target.value }))} placeholder="Observações do serviço" />
            </label>
            <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
              <button className="nb-btn nb-btn-primary" onClick={salvar} disabled={salvando}>
                <Icon name="Check" size={16} /> {salvando ? 'Salvando…' : editandoId != null ? 'Salvar alterações' : 'Criar serviço'}
              </button>
              <button className="nb-btn nb-btn-ghost" onClick={fechar} disabled={salvando}>Cancelar</button>
            </div>
          </div>
        </Card>
      )}

      <Card pad={false}>
        <div style={{ overflowX: 'auto' }}>
          <table className="nb-table" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th style={{ textAlign: 'right' }}>Duração (min)</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Exclusividade</th>
                <th>Ativo</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--nb-ink-faint)' }}>Carregando…</td></tr>
              ) : erro ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--nb-bad)' }}>Não foi possível carregar os serviços. <button className="nb-btn nb-btn-ghost" onClick={carregar} style={{ marginLeft: 8, padding: '6px 12px' }}>Tentar de novo</button></td></tr>
              ) : servicos.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--nb-ink-faint)' }}>Nenhum serviço cadastrado ainda.</td></tr>
              ) : servicos.map((s) => (
                <tr key={s.id} style={{ opacity: s.ativo ? 1 : 0.62 }}>
                  <td style={{ fontWeight: 560 }}>{s.nome}</td>
                  <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{num(s.duracao_minutos)}</td>
                  <td className="nb-num" style={{ textAlign: 'right', fontWeight: 600 }}>{brl(s.valor)}</td>
                  <td>
                    {s.dono_colaborador_id == null ? (
                      <span className="nb-badge nb-info">Geral</span>
                    ) : (
                      <span className="nb-badge" style={{ color: 'var(--nb-accent-deep)', background: 'var(--nb-accent-wash)', borderColor: '#E6D3D6' }}>
                        Exclusivo · {s.dona_nome || nomeColab(s.dono_colaborador_id)}
                      </span>
                    )}
                  </td>
                  <td>
                    {s.ativo ? (
                      <span className="nb-badge nb-ok">Ativo</span>
                    ) : (
                      <span className="nb-badge" style={{ color: 'var(--nb-ink-faint)', background: 'var(--nb-surface-2)', borderColor: 'var(--nb-rule)' }}>Inativo</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="nb-btn nb-btn-quiet" title="Editar" aria-label="Editar serviço" onClick={() => abrirEdicao(s)} style={{ padding: 8 }}>
                        <Pencil size={16} strokeWidth={1.75} aria-hidden />
                      </button>
                      <button className="nb-btn nb-btn-quiet" title={s.ativo ? 'Desativar' : 'Ativar'} aria-label={s.ativo ? 'Desativar serviço' : 'Ativar serviço'} onClick={() => alternarAtivo(s)} style={{ padding: 8, color: s.ativo ? 'var(--nb-bad)' : 'var(--nb-ok)' }}>
                        <Power size={16} strokeWidth={1.75} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p style={{ fontSize: 12, color: 'var(--nb-ink-faint)', marginTop: 12 }}>
        <strong>Geral</strong> = serviço do salão, disponível para todas · <strong>Exclusivo</strong> = usado só pela profissional dona. Como admin, você vê e edita todos.
      </p>
    </PageShell>
  );
}
