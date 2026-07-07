'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import PageShell from '@/components/v2/layout/PageShell';
import { Card } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { brl, num, pct } from '@/lib/v2/formatters';
import FilterBar from '@/components/v2/dashboard/FilterBar';
import KpiCard from '@/components/v2/dashboard/KpiCard';
import MetricChart from '@/components/v2/dashboard/MetricChart';
import AnnualView from '@/components/v2/dashboard/AnnualView';
import RecebimentosCard from '@/components/v2/dashboard/RecebimentosCard';
import TopColaboradoras from '@/components/v2/dashboard/TopColaboradoras';
import ServicosVendidos from '@/components/v2/dashboard/ServicosVendidos';
import ProximosAgendamentos from '@/components/v2/dashboard/ProximosAgendamentos';
import AlertasGestao from '@/components/v2/dashboard/AlertasGestao';
import MetaCard from '@/components/v2/dashboard/MetaCard';
import { Skel, type DashResp, type Filtros } from '@/components/v2/dashboard/_shared';
import { getCache, setCache, invalidateCache } from '@/lib/v2/cache';

const DEFAULT_FILTROS: Filtros = { periodo: 'mes', de: '', ate: '', colaborador: 'todos', servico: 'todos', forma: 'todas' };
type Opt = { id: number | string; nome: string };

export default function DashboardV2() {
  const [filtros, setFiltros] = useState<Filtros>(DEFAULT_FILTROS);
  const [data, setData] = useState<DashResp | null>(null);
  const [busy, setBusy] = useState(true);
  const [erro, setErro] = useState('');
  const [colabs, setColabs] = useState<Opt[]>([]);
  const [servicos, setServicos] = useState<Opt[]>([]);
  const [exporting, setExporting] = useState(false);
  const reqId = useRef(0);

  // opções dos filtros (uma vez)
  useEffect(() => {
    (async () => {
      try {
        const [rc, rs] = await Promise.all([
          fetch('/api/v2/colaboradoras', { cache: 'no-store' }),
          fetch('/api/v2/servicos', { cache: 'no-store' }),
        ]);
        if (rc.ok) { const j = await rc.json(); setColabs((j.colaboradoras || []).map((c: any) => ({ id: c.id, nome: c.nome }))); }
        if (rs.ok) { const j = await rs.json(); setServicos((j.itens || []).filter((s: any) => s.ativo !== false).map((s: any) => ({ id: s.id, nome: s.nome }))); }
      } catch { /* filtros seguem só com "Todas" */ }
    })();
  }, []);

  const carregar = useCallback(async (f: Filtros) => {
    const id = ++reqId.current;
    const qs = new URLSearchParams({ periodo: f.periodo, colaborador: f.colaborador, servico: f.servico, forma: f.forma });
    if (f.periodo === 'custom') { if (f.de) qs.set('de', f.de); if (f.ate) qs.set('ate', f.ate); }
    const url = `/api/v2/dashboard?${qs.toString()}`;
    const cached = getCache<DashResp>(url);
    if (cached !== undefined) setData(cached); // mostra na hora, sem skeleton
    setBusy(true); setErro('');
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (id !== reqId.current) return; // resposta obsoleta
      if (r.ok) { setData(j); setCache(url, j); }
      else if (cached === undefined) setErro(j.error || 'Erro ao carregar o painel.');
    } catch {
      if (id === reqId.current && cached === undefined) setErro('Erro de conexão.');
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }, []);

  useEffect(() => { carregar(filtros); }, [filtros, carregar]);

  const patch = (p: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...p }));
  const limpar = () => setFiltros(DEFAULT_FILTROS);

  const exportar = useCallback(() => {
    if (!data) return;
    setExporting(true);
    try {
      const linhas: string[] = [];
      const push = (cols: (string | number)[]) => linhas.push(cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'));
      push(['NaviBelle — Painel de gestão']);
      push([data.periodo.label]);
      push([]);
      push(['Indicador', 'Valor', 'Período anterior', 'Variação %']);
      const K = data.kpis;
      const row = (nome: string, v: number, ant?: number | null, d?: number | null, moeda = true) =>
        push([nome, moeda ? brl(v) : num(v), ant == null ? '—' : (moeda ? brl(ant) : num(ant)), d == null ? '—' : `${Math.round(d)}%`]);
      row('Faturamento realizado', K.faturamentoRealizado.value, K.faturamentoRealizado.anterior, K.faturamentoRealizado.delta);
      row('Caixa recebido', K.caixaRecebido.value, K.caixaRecebido.anterior, K.caixaRecebido.delta);
      row('Líquido do salão', K.liquidoSalao.value, K.liquidoSalao.anterior, K.liquidoSalao.delta);
      row('Comissão realizada', K.comissaoRealizada.value, K.comissaoRealizada.anterior, K.comissaoRealizada.delta);
      row('Comissão prevista', K.comissaoPrevista.value, K.comissaoPrevista.anterior, K.comissaoPrevista.delta);
      row('Ticket médio', K.ticketMedio.value, K.ticketMedio.anterior, K.ticketMedio.delta);
      row('Fiados em aberto', K.fiadosAberto.value);
      row('Lucro', K.lucro.value, K.lucro.anterior, K.lucro.delta);
      row('Agendamentos', K.agendamentos.total, K.agendamentos.anterior, K.agendamentos.delta, false);
      push([]);
      push(['Recebimentos por forma', 'Valor', '%', 'Transações', 'Taxa']);
      data.recebimentos.forEach((r) => push([r.label, brl(r.valor), `${r.pct.toFixed(1)}%`, r.transacoes, brl(r.taxa)]));
      push([]);
      push(['Top colaboradoras', 'Faturamento', 'Comissão', 'Atendimentos', 'Ticket']);
      data.topColaboradoras.forEach((c) => push([c.nome, brl(c.faturamento), brl(c.comissao), c.atendimentos, brl(c.ticket)]));
      push([]);
      push(['Serviços mais vendidos', 'Quantidade', 'Faturamento', 'Ticket', '%']);
      data.servicosMaisVendidos.forEach((s) => push([s.nome, s.quantidade, brl(s.faturamento), brl(s.ticket), `${s.pct.toFixed(1)}%`]));

      const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `navibelle-painel-${filtros.periodo}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }, [data, filtros.periodo]);

  const primeiraCarga = !data && busy;

  return (
    <PageShell title="Painel de gestão" subtitle="Indicadores do salão em tempo real">
      <FilterBar
        filtros={filtros}
        periodoLabel={data?.periodo.label || '—'}
        colaboradoras={colabs}
        servicos={servicos}
        onChange={patch}
        onClear={limpar}
        onExport={exportar}
        exporting={exporting}
      />

      {/* período selecionado (desktop) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 16px', flexWrap: 'wrap' }}>
        <span className="nb-eyebrow">Período</span>
        <span style={{ fontFamily: 'var(--nb-serif)', fontSize: 18, color: 'var(--nb-ink)' }}>{data?.periodo.label || '—'}</span>
        {data?.anterior.label && <span style={{ fontSize: 12, color: 'var(--nb-ink-faint)' }}>comparado {data.anterior.label}</span>}
        {busy && data && <Icon name="RotateCcw" size={14} className="nb-ink-faint" />}
      </div>

      {erro && !data && (
        <Card><p style={{ margin: 0, color: 'var(--nb-bad)' }}>{erro}</p></Card>
      )}

      {primeiraCarga ? <SkeletonDashboard /> : data && (
        <div className={busy ? 'v2-busy' : undefined}>
          <Kpis data={data} />

          <div className="v2-2col" style={{ marginTop: 16 }}>
            <MetricChart serie={data.serie} anteriorLabel={data.anterior.label} />
            <RecebimentosCard recebimentos={data.recebimentos} />
          </div>

          {data.anual && <div style={{ marginTop: 16 }}><AnnualView anual={data.anual} /></div>}

          <div className="v2-2eq" style={{ marginTop: 16 }}>
            <TopColaboradoras itens={data.topColaboradoras} />
            <ServicosVendidos itens={data.servicosMaisVendidos} />
          </div>

          <div className="v2-3col" style={{ marginTop: 16 }}>
            <ProximosAgendamentos proximos={data.proximos} />
            <AlertasGestao alertas={data.alertas} />
            <MetaCard meta={data.meta} onSalvar={() => { invalidateCache('/api/v2/dashboard'); carregar(filtros); }} />
          </div>
        </div>
      )}
    </PageShell>
  );
}

/* ---------- KPIs (10 do contrato) ---------- */
function Kpis({ data }: { data: DashResp }) {
  const K = data.kpis;
  const antLabel = data.anterior.label;
  const oc = K.ocupacao;
  return (
    <div className="v2-kpi-grid">
      <KpiCard label="Faturamento" icon="Wallet" value={brl(K.faturamentoRealizado.value)}
        delta={K.faturamentoRealizado.delta} anterior={K.faturamentoRealizado.anterior} anteriorLabel={antLabel} href="/v2/lancamentos" />

      <KpiCard label="Caixa recebido" icon="Banknote" value={brl(K.caixaRecebido.value)}
        delta={K.caixaRecebido.delta} anterior={K.caixaRecebido.anterior} anteriorLabel={antLabel} href="/v2/caixa">
        {!!K.caixaRecebido.fiadoRecebido && K.caixaRecebido.fiadoRecebido > 0 && (
          <span style={{ fontSize: 11, color: 'var(--nb-ink-faint)' }}>inclui {brl(K.caixaRecebido.fiadoRecebido)} de fiado</span>
        )}
      </KpiCard>

      <KpiCard label="Líquido do salão" icon="Landmark" value={brl(K.liquidoSalao.value)}
        delta={K.liquidoSalao.delta} anterior={K.liquidoSalao.anterior} anteriorLabel={antLabel} href="/v2/relatorios" />

      <KpiCard label="Comissão realizada" icon="HandCoins" value={brl(K.comissaoRealizada.value)}
        delta={K.comissaoRealizada.delta} anterior={K.comissaoRealizada.anterior} anteriorLabel={antLabel} href="/v2/comissoes" />

      <KpiCard label="Comissão prevista" icon="Coins" value={brl(K.comissaoPrevista.value)}
        delta={K.comissaoPrevista.delta} anterior={K.comissaoPrevista.anterior} anteriorLabel={antLabel} href="/v2/comissoes" />

      <KpiCard label="Ticket médio" icon="Gauge" value={brl(K.ticketMedio.value)}
        delta={K.ticketMedio.delta} anterior={K.ticketMedio.anterior} anteriorLabel={antLabel} />

      <KpiCard label="Fiados em aberto" icon="Clock" value={brl(K.fiadosAberto.value)} tone="warn"
        anteriorLabel={antLabel} semComparativo href="/v2/financeiro"
        footer={<span style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>total a receber</span>} />

      <KpiCard label="Ocupação" icon="Percent" value={oc ? pct(oc.value, { casas: 0 }) : '—'} tone="default"
        delta={oc?.delta} anterior={oc?.anterior} anteriorLabel={antLabel} semComparativo={!oc} fmtDelta={(v) => pct(v, { casas: 0 })}
        footer={<span style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{oc?.base || 'Sem base para estimar'}</span>}>
        {oc?.base && <span style={{ fontSize: 10.5, color: 'var(--nb-ink-faint)' }}>{oc.base}</span>}
      </KpiCard>

      <KpiCard label="Lucro" icon="PiggyBank" value={brl(K.lucro.value)} tone={K.lucro.value >= 0 ? 'ok' : 'warn'}
        delta={K.lucro.delta} anterior={K.lucro.anterior} anteriorLabel={antLabel} href="/v2/relatorios">
        <span style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'var(--nb-mono)', letterSpacing: '.05em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 12, background: K.lucro.tipo === 'real' ? 'var(--nb-ok-bg)' : 'var(--nb-surface-2)', color: K.lucro.tipo === 'real' ? 'var(--nb-ok)' : 'var(--nb-ink-soft)', border: '1px solid var(--nb-rule)' }}>
          {K.lucro.tipo === 'real' ? 'real' : 'estimado'}
        </span>
      </KpiCard>

      <KpiCard label="Agendamentos" icon="CalendarDays" value={num(K.agendamentos.total)}
        delta={K.agendamentos.delta} anterior={K.agendamentos.anterior} anteriorLabel={antLabel} href="/v2/agenda"
        fmtDelta={(v) => num(v)}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <Chip tone="ok" label="concluídos" v={K.agendamentos.concluidos} />
          <Chip tone="warn" label="pendentes" v={K.agendamentos.pendentes} />
          <Chip tone="bad" label="cancelados" v={K.agendamentos.cancelados} />
          <Chip tone="info" label="futuros" v={K.agendamentos.futuros} />
        </div>
      </KpiCard>
    </div>
  );
}

function Chip({ tone, label, v }: { tone: string; label: string; v: number }) {
  return (
    <span className="nb-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, padding: '2px 7px', borderRadius: 10, background: `var(--nb-${tone}-bg)`, color: `var(--nb-${tone})`, fontWeight: 600 }}>
      {v} <span style={{ fontWeight: 400, opacity: .8 }}>{label}</span>
    </span>
  );
}

/* ---------- skeleton da primeira carga ---------- */
function SkeletonDashboard() {
  return (
    <>
      <div className="v2-kpi-grid">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="nb-card nb-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Skel h={11} w={70} /><Skel h={36} w={36} r={10} /></div>
            <Skel h={26} w="60%" />
            <Skel h={12} w="80%" />
          </div>
        ))}
      </div>
      <div className="v2-2col" style={{ marginTop: 16 }}>
        <div className="nb-card nb-card-pad"><Skel h={16} w={180} /><Skel h={244} r={12} style={{ marginTop: 16 }} /></div>
        <div className="nb-card nb-card-pad"><Skel h={16} w={160} /><Skel h={200} r={12} style={{ marginTop: 16 }} /></div>
      </div>
      <div className="v2-2eq" style={{ marginTop: 16 }}>
        <div className="nb-card nb-card-pad"><Skel h={16} w={160} /><Skel h={180} r={12} style={{ marginTop: 16 }} /></div>
        <div className="nb-card nb-card-pad"><Skel h={16} w={160} /><Skel h={180} r={12} style={{ marginTop: 16 }} /></div>
      </div>
    </>
  );
}
