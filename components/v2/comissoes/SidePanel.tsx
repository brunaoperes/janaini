'use client';

import Icon from '@/components/v2/ui/Icon';
import { Card, CardHead } from '@/components/v2/ui/Card';
import { brl } from '@/lib/v2/formatters';
import { Avatar, LocalIcon } from './_shared';
import { formaLabel } from './types';
import type { Totais, RankingItem, PagamentoRecente } from './types';

const dataCurta = (iso: string) => { const d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); };

export default function SidePanel({
  totais, ranking, recentes, loading, onVer,
}: {
  totais: Totais | null;
  ranking: RankingItem[];
  recentes: PagamentoRecente[];
  loading: boolean;
  onVer: (id: number) => void;
}) {
  const media = totais && totais.profissionais > 0 ? totais.comissaoTotal / totais.profissionais : 0;
  const maxRank = Math.max(1, ...ranking.map((r) => r.saldo || r.comissaoTotal));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Resumo do período */}
      <Card>
        <CardHead title="Resumo do período" />
        {loading ? <div className="v2-skel" style={{ height: 120, borderRadius: 10 }} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Linha label="Comissão a pagar (líquida)" v={brl(totais?.comissaoTotal ?? 0)} />
            <Linha label="Total pago" v={brl(totais?.jaPago ?? 0)} tone="ok" />
            <Linha label="Saldo pendente" v={brl(totais?.saldo ?? 0)} tone="accent" strong />
            <div style={{ borderTop: '1px solid var(--nb-rule-soft)', paddingTop: 12 }}>
              <Linha label="Média por profissional" v={brl(media)} />
            </div>
          </div>
        )}
      </Card>

      {/* Ranking */}
      <Card>
        <CardHead title="Ranking de comissões" right={<span className="nb-eyebrow" style={{ fontSize: 9.5 }}>a pagar</span>} />
        {loading ? <div className="v2-skel" style={{ height: 140, borderRadius: 10 }} /> : ranking.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--nb-ink-faint)', margin: 0 }}>Sem comissões no período.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ranking.map((r, i) => {
              const val = r.saldo > 0.005 ? r.saldo : r.comissaoTotal;
              return (
                <button key={r.colaborador_id} onClick={() => onVer(r.colaborador_id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <span aria-hidden style={{ flex: '0 0 auto', width: 20, textAlign: 'center', fontWeight: 700, fontSize: 12, color: i === 0 ? 'var(--nb-gold)' : 'var(--nb-ink-faint)' }}>{i + 1}</span>
                  <Avatar nome={r.nome} size={30} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</span>
                    <span aria-hidden style={{ display: 'block', height: 4, borderRadius: 3, marginTop: 4, background: 'var(--nb-accent)', width: `${Math.max(6, (val / maxRank) * 100)}%`, opacity: 0.85 }} />
                  </span>
                  <span className="nb-num" style={{ fontSize: 13, fontWeight: 640, color: 'var(--nb-accent-deep)' }}>{brl(val)}</span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Pagamentos recentes */}
      <Card>
        <CardHead title="Pagamentos recentes" right={<Icon name="HandCoins" size={15} />} />
        {loading ? <div className="v2-skel" style={{ height: 120, borderRadius: 10 }} /> : recentes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0', textAlign: 'center' }}>
            <span aria-hidden style={{ color: 'var(--nb-ink-faint)' }}><LocalIcon name="history" size={22} /></span>
            <p style={{ fontSize: 12.5, color: 'var(--nb-ink-faint)', margin: 0 }}>Nenhum pagamento de comissão registrado ainda.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recentes.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--nb-rule-soft)' }}>
                <Avatar nome={p.nome} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 540, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--nb-ink-faint)' }}>{dataCurta(p.pago_em)} · {formaLabel(p.forma)}</div>
                </div>
                <span className="nb-num" style={{ fontSize: 13, fontWeight: 640, color: 'var(--nb-ok)' }}>{brl(p.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Linha({ label, v, tone, strong }: { label: string; v: string; tone?: 'ok' | 'accent'; strong?: boolean }) {
  const color = tone === 'ok' ? 'var(--nb-ok)' : tone === 'accent' ? 'var(--nb-accent-deep)' : 'var(--nb-ink)';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 12.5, color: 'var(--nb-ink-soft)' }}>{label}</span>
      <span className="nb-num" style={{ fontSize: strong ? 18 : 15, fontWeight: strong ? 700 : 600, color }}>{v}</span>
    </div>
  );
}
