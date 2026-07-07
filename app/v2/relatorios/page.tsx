'use client';

import { useEffect, useState, useCallback } from 'react';
import PageShell from '@/components/v2/layout/PageShell';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import MetricChart from '@/components/v2/dashboard/MetricChart';
import PaymentDonut from '@/components/v2/dashboard/PaymentDonut';
import { getCache, setCache } from '@/lib/v2/cache';
import { brl, iniciais, mesExtenso } from '@/lib/v2/formatters';
import { NOME_FORMA } from '@/lib/v2/financial';

const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
const v = (k: any) => (k && typeof k === 'object' ? k.value ?? 0 : k ?? 0);

export default function RelatoriosV2() {
  const [mes, setMes] = useState(mesAtual());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async (m: string) => {
    const url = `/api/v2/dashboard?periodo=custom&de=${m}-01&ate=${m}-31`;
    const cached = getCache<any>(url);
    if (cached !== undefined) { setData(cached); setLoading(false); } else setLoading(true);
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) { setData(j); setCache(url, j); }
    } catch { /* mantém cache */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(mes); }, [mes, carregar]);

  const K = data?.kpis;
  const receb = (data?.recebimentos || []) as any[];
  const totalPag = receb.reduce((s, f) => s + (f.valor || 0), 0);
  const donut = receb.map((f) => ({ forma: f.label || NOME_FORMA[f.forma] || f.forma, valor: f.valor, pct: f.pct }));
  const topColab = (data?.topColaboradoras || []) as any[];
  const maxColab = topColab[0]?.faturamento || 1;

  const actions = <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="nb-input" style={{ width: 170 }} />;

  return (
    <PageShell title="Relatórios" subtitle={`Visão gerencial — ${mesExtenso(mes)}`} actions={actions}>
      <div className="v2-kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Faturamento" value={brl(v(K?.faturamentoRealizado))} icon="Wallet" href="/v2/lancamentos" />
        <Kpi label="Comissões" value={brl(v(K?.comissaoRealizada))} icon="HandCoins" href="/v2/comissoes" />
        <Kpi label="Ficou pro salão" value={brl(v(K?.liquidoSalao))} icon="Landmark" tone="ok" href="/v2/financeiro#fin-dre" />
        <Kpi label="Ticket médio" value={brl(v(K?.ticketMedio))} icon="Gauge" href="/v2/lancamentos" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16 }} className="v2-row3">
        <Card>
          <CardHead title="Evolução no período" right={<span className="nb-eyebrow">{mesExtenso(mes)}</span>} />
          {data?.serie ? <MetricChart serie={data.serie} anteriorLabel={data.anterior?.label || 'período anterior'} /> : <Vazio h={244} texto={loading ? 'Carregando…' : 'Sem dados no período.'} />}
        </Card>
        <Card>
          <CardHead title="Por forma de pagamento" />
          {donut.length > 0 ? <PaymentDonut data={donut} total={totalPag} /> : <Vazio h={150} texto={loading ? 'Carregando…' : 'Sem recebimentos no período.'} />}
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <CardHead title="Faturamento por profissional" right={<span className="nb-eyebrow">{mesExtenso(mes)}</span>} />
        {topColab.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topColab.map((c, i) => (
              <div key={c.id ?? c.nome}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    <span aria-hidden style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600 }}>{iniciais(c.nome)}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 560 }}>{c.nome}</span>
                  </span>
                  <span className="nb-num" style={{ fontSize: 13.5, fontWeight: 640 }}>{brl(c.faturamento)}</span>
                </div>
                <div style={{ height: 8, background: 'var(--nb-rule-soft)', borderRadius: 20, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(4, (c.faturamento / maxColab) * 100)}%`, background: i === 0 ? 'var(--nb-accent)' : 'var(--nb-gold)', borderRadius: 20 }} />
                </div>
              </div>
            ))}
          </div>
        ) : <Vazio h={120} texto={loading ? 'Carregando…' : 'Sem atendimentos no período.'} />}
      </Card>

      <p style={{ fontSize: 12, color: 'var(--nb-ink-faint)', marginTop: 14 }}>Todos os números seguem a regra única da V2. Para o relatório completo com exportação, use o Financeiro e o Dashboard.</p>
    </PageShell>
  );
}

function Kpi({ label, value, icon, tone, href }: { label: string; value: string; icon: string; tone?: 'ok'; href?: string }) {
  const Root: any = href ? 'a' : 'div';
  const rootProps: any = href
    ? { href, className: 'nb-card nb-card-pad nb-card-link', 'aria-label': `${label} — ver detalhes` }
    : { className: 'nb-card nb-card-pad' };
  return (
    <Root {...rootProps} style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'inherit', textDecoration: 'none' }}>
      <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}><Icon name={icon} size={18} /></span>
      <div><div className="nb-eyebrow" style={{ fontSize: 10 }}>{label}</div><div className="nb-num" style={{ fontSize: 20, fontWeight: 680, color: tone === 'ok' ? 'var(--nb-ok)' : 'var(--nb-ink)', lineHeight: 1.1 }}>{value}</div></div>
    </Root>
  );
}
function Vazio({ h, texto }: { h: number; texto?: string }) {
  return <div style={{ height: h, display: 'grid', placeItems: 'center', color: 'var(--nb-ink-faint)', fontSize: 13 }}>{texto || 'Carregando…'}</div>;
}
