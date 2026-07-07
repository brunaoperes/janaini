'use client';

// Bloco de agendamento na timeline desktop da Agenda V2.
// Suporta: clique (abre detalhe), arraste (mover horário/colaboradora) e alças de
// redimensionar nas bordas. A distinção clique×arraste é feita no hook (useTimelineDnd)
// pelo threshold de deslocamento — aqui só encaminhamos os pointer handlers.

import Icon from '@/components/v2/ui/Icon';
import { StatusBadge, hhmm } from './_ui';
import { posBarra, STATUS_META, Bloco } from './timeline-utils';

type Props = {
  b: Bloco;
  corBarra: string;
  onOpen: () => void;
  onBeginMove: (e: React.PointerEvent) => void;
  onBeginResize: (e: React.PointerEvent, side: 'l' | 'r') => void;
  isSource: boolean;      // está sendo arrastado agora (mostra esmaecido; o preview segue o cursor)
  interactive: boolean;   // false p/ cancelados (sem drag/resize, só clique)
};

const HANDLE: React.CSSProperties = {
  position: 'absolute', top: 0, bottom: 0, width: 9, zIndex: 2, cursor: 'ew-resize',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export default function TimelineBlock({ b, corBarra, onOpen, onBeginMove, onBeginResize, isSource, interactive }: Props) {
  const { left, width } = posBarra(b);
  const meta = STATUS_META[b.status];
  const largo = width > 12;

  return (
    <div
      data-agid={b.id}
      role="button"
      tabIndex={0}
      title={`${b.cliente} · ${b.servico}`}
      onPointerDown={interactive ? onBeginMove : undefined}
      onClick={interactive ? undefined : onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      style={{
        position: 'absolute', top: 7, bottom: 7, left: `${left}%`, width: `${width}%`,
        background: meta.bg, borderRadius: 9,
        border: b.conflito ? '1.5px dashed var(--nb-bad)' : `1px solid ${meta.borda}`,
        boxShadow: 'var(--nb-shadow)', padding: '5px 8px', overflow: 'hidden', minWidth: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1,
        cursor: interactive ? 'grab' : 'pointer', textAlign: 'left', font: 'inherit',
        touchAction: 'none', userSelect: 'none',
        opacity: isSource ? 0.35 : 1,
        transition: isSource ? 'none' : 'opacity .12s ease',
      }}
    >
      <span className="nb-num" style={{ fontSize: 10, color: 'var(--nb-ink-faint)', fontFamily: 'var(--nb-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {b.conflito && <Icon name="TriangleAlert" size={11} className="nb-bad" />}
        {largo ? `${hhmm(b.inicioMin)}–${hhmm(b.fimMin)}` : hhmm(b.inicioMin)}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.cliente}</span>
      {largo && b.servico && <span style={{ fontSize: 10.5, color: 'var(--nb-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.servico}</span>}
      {width > 20 && <span style={{ marginTop: 2 }}><StatusBadge status={b.status} size="sm" /></span>}

      {interactive && (
        <>
          <span
            aria-hidden
            onPointerDown={(e) => onBeginResize(e, 'l')}
            style={{ ...HANDLE, left: -1 }}
          >
            {largo && <span style={{ width: 3, height: '46%', borderRadius: 3, background: corBarra, opacity: 0.5 }} />}
          </span>
          <span
            aria-hidden
            onPointerDown={(e) => onBeginResize(e, 'r')}
            style={{ ...HANDLE, right: -1 }}
          >
            {largo && <span style={{ width: 3, height: '46%', borderRadius: 3, background: corBarra, opacity: 0.5 }} />}
          </span>
        </>
      )}
    </div>
  );
}
