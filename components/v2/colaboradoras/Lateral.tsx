'use client';

import { Card, CardHead } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { brl, num, iniciais } from '@/lib/v2/formatters';
import { EmptyState } from '@/components/v2/dashboard/_shared';
import type { RankingItem, AgendaItem, DistItem } from './types';

const TONS = ['#8C5A6B', '#A98953', '#B9AEA2', '#D8B4BE', '#7E7A6B', '#C98A6B', '#9A8DA6'];

export default function Lateral({ ranking, agenda, distribuicao, onVerRanking }: {
  ranking: RankingItem[];
  agenda: { total: number; itens: AgendaItem[] };
  distribuicao: { total: number; itens: DistItem[] };
  onVerRanking: () => void;
}) {
  const maxFat = Math.max(1, ...ranking.map((r) => r.faturamento));
  const top = ranking.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Ranking do mês */}
      <Card>
        <CardHead title="Ranking do mês" action={ranking.length > 5 ? { label: 'Ver todos', onClick: onVerRanking } : undefined} />
        {top.length === 0 ? (
          <EmptyState icon="Trophy" titulo="Sem faturamento no período." texto="O ranking aparece conforme os atendimentos forem concluídos." h={120} />
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
            {top.map((c, i) => (
              <li key={c.id} style={{ display: 'grid', gridTemplateColumns: '16px 32px 1fr auto', gap: 10, alignItems: 'center' }}>
                <span className="nb-num" style={{ fontSize: 12, fontWeight: 700, color: i < 3 ? 'var(--nb-gold)' : 'var(--nb-ink-faint)' }}>{i + 1}</span>
                <span aria-hidden style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 600 }}>{iniciais(c.nome)}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                  <span aria-hidden className="v2-track" style={{ marginTop: 4 }}><span style={{ width: `${Math.max(4, (c.faturamento / maxFat) * 100)}%`, background: i === 0 ? 'var(--nb-accent)' : 'var(--nb-gold)' }} /></span>
                </span>
                <span className="nb-num" style={{ fontSize: 13, fontWeight: 640, color: 'var(--nb-ink)', textAlign: 'right' }}>{brl(c.faturamento)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* Agenda de hoje */}
      <Card>
        <CardHead title="Agenda de hoje" action={{ label: 'Ver agenda', href: '/v2/agenda' }} />
        {agenda.itens.length === 0 ? (
          <EmptyState icon="CalendarOff" titulo="Nenhum agendamento para hoje." texto="Os horários marcados para a equipe aparecem aqui." h={120} />
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
              {agenda.itens.map((a) => (
                <li key={a.id} style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--nb-rule-soft)' }}>
                  <span className="nb-num" style={{ fontSize: 13, fontWeight: 640, color: 'var(--nb-accent-deep)' }}>{a.hora}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--nb-ink-faint)' }}>{a.funcao || 'Colaboradora'}</span>
                  </span>
                  <span className="nb-num" style={{ fontSize: 12, color: 'var(--nb-ink-soft)', whiteSpace: 'nowrap' }}>{num(a.atendimentos)} atend.</span>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--nb-rule)' }}>
              <span className="nb-eyebrow" style={{ fontSize: 9.5 }}>Total do dia</span>
              <span className="nb-num" style={{ fontSize: 14, fontWeight: 660, color: 'var(--nb-ink)' }}>{num(agenda.total)} atendimentos</span>
            </div>
          </>
        )}
      </Card>

      {/* Distribuição por função */}
      <Card>
        <CardHead title="Distribuição por função" />
        {distribuicao.total === 0 ? (
          <EmptyState icon="ChartPie" titulo="Sem colaboradoras para distribuir." h={120} />
        ) : (
          <FuncaoDonut total={distribuicao.total} itens={distribuicao.itens} />
        )}
      </Card>
    </div>
  );
}

function FuncaoDonut({ total, itens }: { total: number; itens: DistItem[] }) {
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = itens.map((it, i) => {
    const frac = it.count / (total || 1);
    const seg = { dash: frac * C, gap: C - frac * C, off: offset, color: TONS[i % TONS.length] };
    offset += frac * C;
    return seg;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '134px 1fr', gap: 16, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 134, height: 134 }}>
        <svg viewBox="0 0 140 140" width="134" height="134" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--nb-rule-soft)" strokeWidth="16" />
          {arcs.map((a, i) => (
            <circle key={i} cx="70" cy="70" r={R} fill="none" stroke={a.color} strokeWidth="16"
              strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={-a.off} strokeLinecap="butt" />
          ))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--nb-ink-faint)', fontFamily: 'var(--nb-mono)', letterSpacing: '.06em' }}>EQUIPE</div>
            <div className="nb-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--nb-ink)' }}>{total}</div>
          </div>
        </div>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {itens.map((it, i) => (
          <li key={it.funcao} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: 9, alignItems: 'center', fontSize: 12.5 }}>
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: TONS[i % TONS.length] }} />
            <span style={{ color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.funcao}</span>
            <span className="nb-num" style={{ color: 'var(--nb-ink-faint)', whiteSpace: 'nowrap' }}>{it.count} · {Math.round(it.pct)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
