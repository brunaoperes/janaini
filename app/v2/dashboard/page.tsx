'use client';

import PageShell from '@/components/v2/layout/PageShell';
import Button from '@/components/v2/ui/Button';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Kpi from '@/components/v2/ui/Kpi';
import Icon from '@/components/v2/ui/Icon';
import RevenueChart from '@/components/v2/dashboard/RevenueChart';
import PaymentDonut from '@/components/v2/dashboard/PaymentDonut';
import { DEMO } from '@/lib/v2/constants/demo';
import { brl, num, iniciais, pct } from '@/lib/v2/formatters';

const K = DEMO.kpis;

export default function DashboardV2() {
  const actions = (
    <>
      <button className="nb-btn nb-btn-ghost"><Icon name="CalendarDays" size={16} /><span className="nb-num">07/07/2026 – 07/07/2026</span><Icon name="ChevronDown" size={15} /></button>
      <button className="nb-btn nb-btn-ghost"><Icon name="Filter" size={16} />Filtros</button>
      <Button icon="Plus">Novo Agendamento</Button>
    </>
  );

  return (
    <PageShell title="Dashboard" subtitle="Visão geral do seu salão" actions={actions}>
      <DemoSeal />

      {/* KPIs */}
      <div className="v2-kpis">
        <Kpi label="Faturamento hoje" icon="DollarSign" value={brl(K.faturamentoHoje.value)} delta={K.faturamentoHoje.delta} deltaLabel={K.faturamentoHoje.label} />
        <Kpi label="Faturamento do mês" icon="Wallet" value={brl(K.faturamentoMes.value)} delta={K.faturamentoMes.delta} deltaLabel={K.faturamentoMes.label} />
        <Kpi label="Caixa recebido hoje" icon="Banknote" value={brl(K.caixaHoje.value)} delta={K.caixaHoje.delta} deltaLabel={K.caixaHoje.label} />
        <Kpi label="Agendamentos hoje" icon="CalendarDays" value={num(K.agendamentosHoje.value)} delta={K.agendamentosHoje.delta} deltaLabel={K.agendamentosHoje.label} />
      </div>
      <div className="v2-kpis" style={{ marginTop: 16 }}>
        <Kpi label="Comissão realizada" icon="HandCoins" value={brl(K.comissaoRealizada.value)} delta={K.comissaoRealizada.delta} deltaLabel={K.comissaoRealizada.label} />
        <Kpi label="Faturamento líquido" icon="ChartColumnIncreasing" value={brl(K.faturamentoLiquido.value)} delta={K.faturamentoLiquido.delta} deltaLabel={K.faturamentoLiquido.label} />
        <Kpi label="Fiados em aberto" icon="Clock" value={brl(K.fiadosAberto.value)} deltaLabel={K.fiadosAberto.label} tone="warn" />
        <Kpi label="Taxa de ocupação" icon="Gauge" value={`${K.ocupacao.value}%`} delta={K.ocupacao.delta} deltaLabel={K.ocupacao.label} />
      </div>

      {/* Performance · Recebimentos · Top colaboradoras */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr) minmax(0,1fr)', gap: 16, marginTop: 16 }} className="v2-row3">
        <Card>
          <CardHead title="Performance Financeira" right={<button className="nb-btn nb-btn-ghost" style={{ padding: '6px 10px', fontSize: 12.5 }}>Últimos 7 dias <Icon name="ChevronDown" size={14} /></button>} />
          <p className="nb-eyebrow" style={{ margin: '-8px 0 6px' }}>Faturamento bruto</p>
          <RevenueChart data={DEMO.performance} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--nb-rule-soft)' }}>
            <Legenda label="Período atual" valor={brl(DEMO.periodo.atual)} />
            <Legenda label="Período anterior" valor={brl(DEMO.periodo.anterior)} />
            <Legenda label="Variação" valor={pct(DEMO.periodo.variacao, { sign: true, casas: 2 })} good />
          </div>
        </Card>

        <Card>
          <CardHead title="Recebimentos por Forma de Pagamento" action={{ label: 'Ver detalhes' }} />
          <PaymentDonut data={DEMO.pagamentos} total={2450} />
        </Card>

        <Card>
          <CardHead title="Top Colaboradoras" right={<button className="nb-btn nb-btn-ghost" style={{ padding: '6px 10px', fontSize: 12.5 }}>Mês <Icon name="ChevronDown" size={14} /></button>} />
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {DEMO.topColaboradoras.map((c, i) => (
              <li key={c.nome} style={{ display: 'grid', gridTemplateColumns: '18px 34px 1fr auto', gap: 11, alignItems: 'center' }}>
                <span className="nb-num" style={{ fontSize: 12.5, color: i < 3 ? 'var(--nb-gold)' : 'var(--nb-ink-faint)', fontWeight: 700 }}>{i + 1}</span>
                <span aria-hidden style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600 }}>{iniciais(c.nome)}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{c.cargo}</span>
                </span>
                <span className="nb-num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nb-ink)' }}>{brl(c.valor)}</span>
              </li>
            ))}
          </ol>
          <div style={{ marginTop: 14, textAlign: 'right' }}><a href="#" style={verMais}>Ver todas <Icon name="ArrowRight" size={13} /></a></div>
        </Card>
      </div>

      {/* Serviços · Próximos · Alertas · Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16, marginTop: 16 }} className="v2-row4">
        <Card>
          <CardHead title="Serviços Mais Vendidos" right={<button className="nb-btn nb-btn-ghost" style={{ padding: '6px 10px', fontSize: 12.5 }}>Mês <Icon name="ChevronDown" size={14} /></button>} />
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {DEMO.topServicos.map((s, i) => (
              <li key={s.nome} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <span className="nb-num" style={{ color: 'var(--nb-ink-faint)', fontSize: 12 }}>{i + 1}</span>
                <span style={{ color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nome}</span>
                <span className="nb-num" style={{ color: 'var(--nb-ink-faint)', minWidth: 34, textAlign: 'right' }}>{s.qtd}</span>
                <span className="nb-num" style={{ color: 'var(--nb-ink)', fontWeight: 560, minWidth: 74, textAlign: 'right' }}>{brl(s.valor)}</span>
              </li>
            ))}
          </ol>
          <div style={{ marginTop: 14, textAlign: 'right' }}><a href="#" style={verMais}>Ver relatório completo <Icon name="ArrowRight" size={13} /></a></div>
        </Card>

        <Card>
          <CardHead title="Próximos Agendamentos" />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {DEMO.proximos.map((p, i) => (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: i < DEMO.proximos.length - 1 ? '1px solid var(--nb-rule-soft)' : 'none' }}>
                <span className="nb-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--nb-accent-deep)' }}>{p.hora}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--nb-ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.servico}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--nb-ink-faint)', whiteSpace: 'nowrap' }}>{p.quando}</span>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 12, textAlign: 'right' }}><a href="#" style={verMais}>Ver agenda completa <Icon name="ArrowRight" size={13} /></a></div>
        </Card>

        <Card>
          <CardHead title="Alertas de Gestão" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEMO.alertas.map((a, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 11, alignItems: 'start', padding: 12, borderRadius: 10, background: `var(--nb-${a.tone}-bg)`, border: `1px solid color-mix(in srgb, var(--nb-${a.tone}) 22%, transparent)` }}>
                <span aria-hidden style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--nb-surface)', color: `var(--nb-${a.tone})`, display: 'grid', placeItems: 'center' }}><Icon name={a.icon} size={17} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--nb-ink)' }}>{a.titulo}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--nb-ink-soft)' }}>{a.nota}</div>
                  <a href="#" style={{ ...verMais, fontSize: 11.5, marginTop: 3 }}>{a.acao} <Icon name="ArrowRight" size={12} /></a>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Meta do Mês" />
          <div style={{ display: 'grid', placeItems: 'center', padding: '6px 0 10px' }}>
            <MetaRing pct={DEMO.meta.atingidoPct} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 12, borderTop: '1px solid var(--nb-rule-soft)' }}>
            <Legenda label="Faturamento atual" valor={brl(DEMO.meta.atual)} />
            <Legenda label="Meta do mês" valor={brl(DEMO.meta.meta)} />
          </div>
          <div style={{ marginTop: 12, textAlign: 'right' }}><a href="#" style={verMais}>Ver projeção completa <Icon name="ArrowRight" size={13} /></a></div>
        </Card>
      </div>
    </PageShell>
  );
}

const verMais: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 560, color: 'var(--nb-accent)', textDecoration: 'none' };

function Legenda({ label, valor, good }: { label: string; valor: string; good?: boolean }) {
  return (
    <div>
      <div className="nb-eyebrow" style={{ fontSize: 10 }}>{label}</div>
      <div className="nb-num" style={{ fontSize: 15, fontWeight: 640, color: good ? 'var(--nb-ok)' : 'var(--nb-ink)' }}>{valor}</div>
    </div>
  );
}

function MetaRing({ pct }: { pct: number }) {
  const r = 52, c = 2 * Math.PI * r, filled = (pct / 100) * c;
  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--nb-rule)" strokeWidth="12" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--nb-accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${filled} ${c}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="nb-num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--nb-ink)', lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 11, color: 'var(--nb-ink-faint)', marginTop: 2 }}>da meta atingida</div>
        </div>
      </div>
    </div>
  );
}

function DemoSeal() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', marginBottom: 18, borderRadius: 20, background: 'var(--nb-surface)', border: '1px dashed var(--nb-gold)', fontSize: 12, color: 'var(--nb-ink-soft)' }}>
      <Icon name="Sparkles" size={14} className="nb-gold" />
      Prévia V2 · dados de exemplo — a fonte real e conferida é conectada na Fase 1
    </div>
  );
}
