'use client';

import { useEffect, useState, useCallback } from 'react';
import PageShell from '@/components/v2/layout/PageShell';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import RevenueChart from '@/components/v2/dashboard/RevenueChart';
import PaymentDonut from '@/components/v2/dashboard/PaymentDonut';
import { brl, num, iniciais, mesExtenso } from '@/lib/v2/formatters';
import { NOME_FORMA } from '@/lib/v2/financial';

const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

export default function RelatoriosV2() {
  const [mes, setMes] = useState(mesAtual());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v2/dashboard?mes=${m}`, { cache: 'no-store' });
      const j = await r.json(); if (r.ok) setData(j);
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(mes); }, [mes, carregar]);

  const F = data?.financeiro;
  const totalPag = (data?.porFormaPagamento || []).reduce((s: number, f: any) => s + f.valor, 0);
  const donut = (data?.porFormaPagamento || []).map((f: any) => ({ forma: NOME_FORMA[f.forma] || f.forma, valor: f.valor, pct: f.pct }));

  const actions = <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="nb-input" style={{ width: 170 }} />;

  return (
    <PageShell title="Relatórios" subtitle={`Visão gerencial — ${mesExtenso(mes)}`} actions={actions}>
      {/* resumo do mês */}
      <div className="v2-kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Faturamento" value={brl(F?.faturamentoRealizado ?? 0)} icon="Wallet" href="/v2/lancamentos" />
        <Kpi label="Comissões" value={brl(F?.comissaoRealizada ?? 0)} icon="HandCoins" href="/v2/comissoes" />
        <Kpi label="Taxas de cartão" value={brl(F?.taxasCartao ?? 0)} icon="CreditCard" href="/v2/financeiro#fin-dre" />
        <Kpi label="Ficou pro salão" value={brl(F?.parteSalao ?? 0)} icon="Landmark" tone="ok" href="/v2/financeiro#fin-dre" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16 }} className="v2-row3">
        <Card>
          <CardHead title="Faturamento por dia" right={<span className="nb-eyebrow">{mesExtenso(mes)}</span>} />
          {data ? <RevenueChart data={data.serie} /> : <Vazio h={244} />}
        </Card>
        <Card>
          <CardHead title="Por forma de pagamento" />
          {data && donut.length > 0 ? <PaymentDonut data={donut} total={totalPag} /> : <Vazio h={150} texto={loading ? 'Carregando…' : 'Sem recebimentos no período.'} />}
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <CardHead title="Faturamento por profissional" right={<span className="nb-eyebrow">{mesExtenso(mes)}</span>} />
        {data && data.topColaboradoras?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.topColaboradoras.map((c: any, i: number) => {
              const max = data.topColaboradoras[0].valor || 1;
              return (
                <div key={c.nome}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                      <span aria-hidden style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600 }}>{iniciais(c.nome)}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 560 }}>{c.nome}</span>
                    </span>
                    <span className="nb-num" style={{ fontSize: 13.5, fontWeight: 640 }}>{brl(c.valor)}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--nb-rule-soft)', borderRadius: 20, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(4, (c.valor / max) * 100)}%`, background: i === 0 ? 'var(--nb-accent)' : 'var(--nb-gold)', borderRadius: 20 }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : <Vazio h={120} texto={loading ? 'Carregando…' : 'Sem atendimentos no período.'} />}
      </Card>

      <p style={{ fontSize: 12, color: 'var(--nb-ink-faint)', marginTop: 14 }}>Todos os números seguem a regra única da V2. A exportação em PDF/Excel (que já existe na tela atual) será portada para cá no acabamento da Fase 3.6.</p>
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
