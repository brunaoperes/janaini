'use client';

import { useEffect, useState } from 'react';
import PageShell from '@/components/v2/layout/PageShell';
import Button from '@/components/v2/ui/Button';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Kpi from '@/components/v2/ui/Kpi';
import Icon from '@/components/v2/ui/Icon';
import RevenueChart from '@/components/v2/dashboard/RevenueChart';
import PaymentDonut from '@/components/v2/dashboard/PaymentDonut';
import { DEMO } from '@/lib/v2/constants/demo';
import { NOME_FORMA } from '@/lib/v2/financial';
import { brl, num, iniciais, mesExtenso } from '@/lib/v2/formatters';

type ApiResp = {
  mes: string; hoje: string;
  kpis: Record<string, { value: number; delta?: number | null }>;
  serie: { dia: string; atual: number }[];
  porFormaPagamento: { forma: string; valor: number; taxa: number; pct: number }[];
  topColaboradoras: { nome: string; valor: number }[];
};

export default function DashboardV2() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch('/api/v2/dashboard', { cache: 'no-store' })
      .then((r) => r.json().then((j) => (r.ok ? setData(j) : setErro(j.error || 'Erro ao carregar.'))))
      .catch(() => setErro('Erro de conexão.'));
  }, []);

  const actions = (
    <>
      <button className="nb-btn nb-btn-ghost"><Icon name="CalendarDays" size={16} /><span className="nb-num">{data ? mesExtenso(data.mes) : '—'}</span><Icon name="ChevronDown" size={15} /></button>
      <button className="nb-btn nb-btn-ghost"><Icon name="Filter" size={16} />Filtros</button>
      <Button icon="Plus">Novo Agendamento</Button>
    </>
  );

  const K = data?.kpis;
  const totalPag = (data?.porFormaPagamento || []).reduce((s, f) => s + f.valor, 0);
  const donut = (data?.porFormaPagamento || []).map((f) => ({ forma: NOME_FORMA[f.forma] || f.forma, valor: f.valor, pct: f.pct }));

  return (
    <PageShell title="Dashboard" subtitle="Visão geral do seu salão" actions={actions}>
      <Selo />

      {erro && <Card><p style={{ margin: 0, color: 'var(--nb-bad)' }}>{erro}</p></Card>}

      {/* KPIs */}
      <div className="v2-kpis">
        <Kpi label="Faturamento hoje" icon="DollarSign" value={brl(K?.faturamentoHoje.value ?? 0)} deltaLabel="serviços prestados hoje" />
        <Kpi label="Faturamento do mês" icon="Wallet" value={brl(K?.faturamentoMes.value ?? 0)} delta={K?.faturamentoMes.delta ?? undefined} deltaLabel="vs mês anterior" />
        <Kpi label="Caixa recebido hoje" icon="Banknote" value={brl(K?.caixaHoje.value ?? 0)} deltaLabel="dinheiro que entrou hoje" />
        <Kpi label="Agendamentos hoje" icon="CalendarDays" value={num(K?.agendamentosHoje.value ?? 0)} />
      </div>
      <div className="v2-kpis" style={{ marginTop: 16 }}>
        <Kpi label="Comissão realizada" icon="HandCoins" value={brl(K?.comissaoRealizada.value ?? 0)} delta={K?.comissaoRealizada.delta ?? undefined} deltaLabel="vs mês anterior" />
        <Kpi label="Faturamento líquido" icon="ChartColumnIncreasing" value={brl(K?.faturamentoLiquido.value ?? 0)} delta={K?.faturamentoLiquido.delta ?? undefined} deltaLabel="vs mês anterior" />
        <Kpi label="Fiados em aberto" icon="Clock" value={brl(K?.fiadosAberto.value ?? 0)} deltaLabel="a receber" tone="warn" />
        <Kpi label="Ticket médio" icon="Gauge" value={brl(K?.ticketMedio.value ?? 0)} deltaLabel="por atendimento" />
      </div>

      {/* Performance · Recebimentos · Top colaboradoras */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr) minmax(0,1fr)', gap: 16, marginTop: 16 }} className="v2-row3">
        <Card>
          <CardHead title="Performance Financeira" right={<span className="nb-eyebrow">{data ? mesExtenso(data.mes) : ''}</span>} />
          <p className="nb-eyebrow" style={{ margin: '-8px 0 6px' }}>Faturamento realizado por dia</p>
          {data ? <RevenueChart data={data.serie} /> : <Vazio h={244} />}
        </Card>

        <Card>
          <CardHead title="Recebimentos por Forma de Pagamento" action={{ label: 'Ver detalhes' }} />
          {data && donut.length > 0 ? <PaymentDonut data={donut} total={totalPag} /> : <Vazio h={150} texto="Sem recebimentos no período." />}
        </Card>

        <Card>
          <CardHead title="Top Colaboradoras" right={<span className="nb-eyebrow">{data ? mesExtenso(data.mes) : ''}</span>} />
          {data && data.topColaboradoras.length > 0 ? (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.topColaboradoras.map((c, i) => (
                <li key={c.nome} style={{ display: 'grid', gridTemplateColumns: '18px 34px 1fr auto', gap: 11, alignItems: 'center' }}>
                  <span className="nb-num" style={{ fontSize: 12.5, color: i < 3 ? 'var(--nb-gold)' : 'var(--nb-ink-faint)', fontWeight: 700 }}>{i + 1}</span>
                  <span aria-hidden style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600 }}>{iniciais(c.nome)}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                  <span className="nb-num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nb-ink)' }}>{brl(c.valor)}</span>
                </li>
              ))}
            </ol>
          ) : <Vazio h={180} texto="Sem atendimentos no período." />}
        </Card>
      </div>

      {/* Blocos ainda de exemplo até a Fase 3 (serviços, próximos, meta) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16, marginTop: 16 }} className="v2-row4">
        <Card>
          <CardHead title="Serviços Mais Vendidos" right={<TagExemplo />} />
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
        </Card>

        <Card>
          <CardHead title="Próximos Agendamentos" right={<TagExemplo />} />
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
        </Card>

        <Card>
          <CardHead title="Alertas de Gestão" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Alerta real: fiados em aberto */}
            <Alerta tone="bad" icon="CircleAlert" titulo="Fiados pendentes" nota={`${brl(K?.fiadosAberto.value ?? 0)} a receber`} acao="Ver detalhes" />
            <Alerta tone="warn" icon="Clock" titulo="Contas a vencer" nota="verifique o módulo financeiro" acao="Ver contas" exemplo />
            <Alerta tone="info" icon="Gauge" titulo="Ocupação da agenda" nota="indicador entra na Fase 3" acao="Ver agenda" exemplo />
          </div>
        </Card>

        <Card>
          <CardHead title="Meta do Mês" right={<TagExemplo />} />
          <div style={{ display: 'grid', placeItems: 'center', padding: '6px 0 10px' }}><MetaRing pct={DEMO.meta.atingidoPct} /></div>
          <p style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', textAlign: 'center', margin: 0 }}>Defina a meta mensal nas configurações (Fase 3).</p>
        </Card>
      </div>
    </PageShell>
  );
}

/* ---- auxiliares ---- */
function Selo() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', marginBottom: 18, borderRadius: 20, background: 'var(--nb-surface)', border: '1px solid var(--nb-rule)', fontSize: 12, color: 'var(--nb-ink-soft)' }}>
      <Icon name="ShieldCheck" size={14} className="nb-gold" />
      Financeiro com dados <strong style={{ color: 'var(--nb-ink)' }}>reais</strong> (mesma regra em toda a V2). Serviços, próximos e meta seguem como exemplo até a Fase 3.
    </div>
  );
}
function TagExemplo() {
  return <span className="nb-eyebrow" style={{ fontSize: 9.5, color: 'var(--nb-gold)', border: '1px dashed var(--nb-gold)', borderRadius: 12, padding: '2px 7px' }}>exemplo</span>;
}
function Vazio({ h, texto }: { h: number; texto?: string }) {
  return <div style={{ height: h, display: 'grid', placeItems: 'center', color: 'var(--nb-ink-faint)', fontSize: 13 }}>{texto || 'Carregando…'}</div>;
}
function Alerta({ tone, icon, titulo, nota, acao, exemplo }: { tone: string; icon: string; titulo: string; nota: string; acao: string; exemplo?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 11, alignItems: 'start', padding: 12, borderRadius: 10, background: `var(--nb-${tone}-bg)`, border: `1px solid color-mix(in srgb, var(--nb-${tone}) 22%, transparent)` }}>
      <span aria-hidden style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--nb-surface)', color: `var(--nb-${tone})`, display: 'grid', placeItems: 'center' }}><Icon name={icon} size={17} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--nb-ink)', display: 'flex', gap: 6, alignItems: 'center' }}>{titulo}{exemplo && <TagExemplo />}</div>
        <div style={{ fontSize: 11.5, color: 'var(--nb-ink-soft)' }}>{nota}</div>
        <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 560, color: 'var(--nb-accent)', textDecoration: 'none', marginTop: 3 }}>{acao} <Icon name="ArrowRight" size={12} /></a>
      </div>
    </div>
  );
}
function MetaRing({ pct: p }: { pct: number }) {
  const r = 52, c = 2 * Math.PI * r, filled = (p / 100) * c;
  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--nb-rule)" strokeWidth="12" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--nb-accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${filled} ${c}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="nb-num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--nb-ink)', lineHeight: 1 }}>{p}%</div>
          <div style={{ fontSize: 11, color: 'var(--nb-ink-faint)', marginTop: 2 }}>da meta</div>
        </div>
      </div>
    </div>
  );
}
