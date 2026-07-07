'use client';

import { useEffect } from 'react';
import Icon from '@/components/v2/ui/Icon';
import { brl } from '@/lib/v2/formatters';
import { Bloco } from './timeline-utils';
import { StatusBadge, Avatar, hhmm } from './_ui';

export default function AgendaDetalhe({
  bloco, cor, receitaConfiavel, onClose, onEdit,
}: {
  bloco: Bloco;
  cor: string;
  receitaConfiavel: boolean;
  onClose: () => void;
  onEdit?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const linha = (icon: string, label: string, valor: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--nb-rule-soft)' }}>
      <span aria-hidden style={{ color: 'var(--nb-ink-faint)', flex: '0 0 auto' }}><Icon name={icon} size={16} /></span>
      <span style={{ fontSize: 12.5, color: 'var(--nb-ink-faint)', width: 92, flex: '0 0 auto' }}>{label}</span>
      <span style={{ fontSize: 13.5, color: 'var(--nb-ink)', fontWeight: 540, minWidth: 0 }}>{valor}</span>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(33,28,25,.42)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true"
        style={{ width: '100%', maxWidth: 420, background: 'var(--nb-surface)', border: '1px solid var(--nb-rule)', borderRadius: 'var(--nb-r-lg)', boxShadow: 'var(--nb-shadow-md)', overflow: 'hidden' }}
      >
        {/* Cabeçalho com faixa da cor da profissional */}
        <div style={{ borderTop: `3px solid ${cor}`, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="nb-num" style={{ fontFamily: 'var(--nb-mono)', fontSize: 13, color: 'var(--nb-accent-deep)', fontWeight: 600 }}>
              {hhmm(bloco.inicioMin)}–{hhmm(bloco.fimMin)}
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 640, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bloco.cliente}</h3>
          </div>
          <button className="nb-btn nb-btn-quiet" onClick={onClose} aria-label="Fechar" style={{ padding: 7, flex: '0 0 auto' }}><Icon name="X" size={18} /></button>
        </div>

        <div style={{ padding: '4px 20px 8px' }}>
          {bloco.conflito && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--nb-bad-bg)', color: 'var(--nb-bad)', border: '1px solid #E7CFC9', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 560, margin: '8px 0 4px' }}>
              <Icon name="TriangleAlert" size={16} /> Conflito de horário com outro agendamento
            </div>
          )}
          {linha('User', 'Cliente', bloco.cliente)}
          {bloco.telefone && linha('Phone', 'Telefone', bloco.telefone)}
          {linha('Scissors', 'Serviço', bloco.servico || '—')}
          {linha('UserCog', 'Profissional', (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Avatar nome={bloco.colaboradorNome || '?'} cor={cor} size={22} />
              {bloco.colaboradorNome || '—'}
            </span>
          ))}
          {linha('Clock', 'Horário', `${hhmm(bloco.inicioMin)} às ${hhmm(bloco.fimMin)}`)}
          {linha('CircleCheck', 'Status', <StatusBadge status={bloco.status} />)}
          {linha('DollarSign', receitaConfiavel ? 'Valor previsto' : 'Valor', (
            <span className="nb-num">
              {receitaConfiavel
                ? (bloco.valorEstimado > 0 ? brl(bloco.valorEstimado) : '—')
                : (bloco.valor > 0 ? `${brl(bloco.valor)} (lançado)` : 'A definir')}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '12px 20px 18px' }}>
          <button className="nb-btn nb-btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Fechar</button>
          {onEdit && bloco.status !== 'cancelado' && (
            <button className="nb-btn nb-btn-primary" onClick={onEdit} style={{ flex: 1, justifyContent: 'center' }}><Icon name="SlidersHorizontal" size={16} /> Editar</button>
          )}
        </div>
      </div>
    </div>
  );
}
