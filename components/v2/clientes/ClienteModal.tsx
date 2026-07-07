'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/v2/ui/Icon';
import Button from '@/components/v2/ui/Button';

/**
 * ClienteModal — cadastro premium de cliente (V2).
 *
 * Hoje só CRIAÇÃO: usa POST /api/v2/clientes (admin, retorna { cliente }).
 * O componente já aceita `cliente` para edição futura; quando existir um
 * PUT /api/v2/clientes (ou /api/cliente/[id]), basta ligar em `submeter()`.
 */

export type ClienteEditavel = { id: number; nome: string; telefone: string | null; aniversario: string | null };

/** Máscara BR progressiva: (00) 00000-0000 / (00) 0000-0000. */
function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, '($1');
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

export default function ClienteModal({
  cliente,
  onClose,
  onSaved,
}: {
  cliente?: ClienteEditavel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const edicao = !!cliente;
  const [nome, setNome] = useState(cliente?.nome ?? '');
  const [telefone, setTelefone] = useState(cliente?.telefone ? mascararTelefone(cliente.telefone) : '');
  const [aniversario, setAniversario] = useState(cliente?.aniversario?.slice(0, 10) ?? '');
  const [erros, setErros] = useState<{ nome?: string; telefone?: string }>({});
  const [salvando, setSalvando] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);

  // foco inicial + fechar no Esc
  useEffect(() => {
    nomeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, salvando]);

  function validar(): boolean {
    const e: { nome?: string; telefone?: string } = {};
    if (nome.trim().length < 2) e.nome = 'Informe o nome da cliente.';
    const dig = telefone.replace(/\D/g, '');
    if (!dig) e.telefone = 'Informe o telefone.';
    else if (dig.length < 10) e.telefone = 'Telefone incompleto (DDD + número).';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function submeter() {
    if (!validar()) return;
    setSalvando(true);
    try {
      // edição usa PUT ?id=; criação usa POST
      const url = edicao ? `/api/v2/clientes?id=${cliente!.id}` : '/api/v2/clientes';
      const r = await fetch(url, {
        method: edicao ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone: telefone.trim(),
          aniversario: aniversario || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || 'Não foi possível salvar.'); return; }
      toast.success(edicao ? 'Cliente atualizada.' : 'Cliente cadastrada.');
      onSaved();
    } catch { toast.error('Erro de conexão.'); }
    finally { setSalvando(false); }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={edicao ? 'Editar cliente' : 'Nova cliente'}
      onClick={() => { if (!salvando) onClose(); }}
      className="cm-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'color-mix(in srgb, var(--nb-ink) 34%, transparent)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <style>{`
        @media (max-width: 560px) {
          .cm-card { max-width: none !important; width: 100% !important; height: 100dvh; max-height: 100dvh !important; border-radius: 0 !important; }
          .cm-overlay { padding: 0 !important; }
        }
      `}</style>
      <div
        className="nb-card cm-card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--nb-rule)' }}>
          <span aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name={edicao ? 'User' : 'UserPlus'} size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>{edicao ? 'Editar cadastro' : 'Novo cadastro'}</div>
            <div style={{ fontSize: 16, fontWeight: 620, color: 'var(--nb-ink)' }}>{edicao ? (cliente?.nome || 'Cliente') : 'Nova cliente'}</div>
          </div>
          <button className="nb-btn nb-btn-quiet" onClick={onClose} aria-label="Fechar" disabled={salvando}><Icon name="X" size={18} /></button>
        </div>

        {/* corpo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Campo label="Nome" erro={erros.nome} icon="User">
            <input
              ref={nomeRef}
              className="nb-input"
              value={nome}
              onChange={(e) => { setNome(e.target.value); if (erros.nome) setErros((s) => ({ ...s, nome: undefined })); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submeter(); }}
              placeholder="Nome completo"
              style={{ paddingLeft: 38, borderColor: erros.nome ? 'var(--nb-bad)' : undefined }}
              autoComplete="off"
            />
          </Campo>

          <Campo label="Telefone" erro={erros.telefone} icon="Phone">
            <input
              className="nb-input nb-num"
              value={telefone}
              onChange={(e) => { setTelefone(mascararTelefone(e.target.value)); if (erros.telefone) setErros((s) => ({ ...s, telefone: undefined })); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submeter(); }}
              placeholder="(00) 00000-0000"
              inputMode="tel"
              style={{ paddingLeft: 38, borderColor: erros.telefone ? 'var(--nb-bad)' : undefined }}
            />
          </Campo>

          <Campo label="Aniversário" hint="Opcional — usamos para lembrar de parabenizar." icon="Cake">
            <input
              className="nb-input"
              type="date"
              value={aniversario}
              onChange={(e) => setAniversario(e.target.value)}
              style={{ paddingLeft: 38 }}
            />
          </Campo>
        </div>

        {/* footer */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 18px', borderTop: '1px solid var(--nb-rule)' }}>
          <Button variant="ghost" onClick={onClose} disabled={salvando} style={{ flex: 1, justifyContent: 'center' }}>Cancelar</Button>
          <Button icon="Check" onClick={submeter} disabled={salvando} style={{ flex: 1, justifyContent: 'center' }}>
            {salvando ? 'Salvando…' : edicao ? 'Salvar alterações' : 'Cadastrar cliente'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children, erro, hint, icon }: { label: string; children: React.ReactNode; erro?: string; hint?: string; icon?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span className="nb-eyebrow" style={{ fontSize: 9.5 }}>{label}</span>
      <span style={{ position: 'relative', display: 'block' }}>
        {icon && (
          <span aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
            <Icon name={icon} size={16} />
          </span>
        )}
        {children}
      </span>
      {erro ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--nb-bad)' }}>
          <Icon name="CircleAlert" size={13} /> {erro}
        </span>
      ) : hint ? (
        <span style={{ fontSize: 12, color: 'var(--nb-ink-faint)' }}>{hint}</span>
      ) : null}
    </label>
  );
}
