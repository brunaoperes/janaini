'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import PageShell from '@/components/v2/layout/PageShell';
import Icon from '@/components/v2/ui/Icon';
import Button from '@/components/v2/ui/Button';
import { Card } from '@/components/v2/ui/Card';
import { Skel } from '@/components/v2/dashboard/_shared';
import KpisFinanceiro from '@/components/v2/financeiro/KpisFinanceiro';
import DreCard from '@/components/v2/financeiro/DreCard';
import DreMatriz from '@/components/v2/financeiro/DreMatriz';
import FluxoCaixaCard from '@/components/v2/financeiro/FluxoCaixa';
import EvolucaoChart from '@/components/v2/financeiro/EvolucaoChart';
import ContasPagar from '@/components/v2/financeiro/ContasPagar';
import DespesasDonut from '@/components/v2/financeiro/DespesasDonut';
import DespesaModal from '@/components/v2/financeiro/DespesaModal';
import FiadosAbertosCard from '@/components/v2/financeiro/FiadosAbertosCard';
import type { FinanceiroResp, ContaPagar } from '@/components/v2/financeiro/types';

const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

const SITUACOES: [string, string][] = [
  ['todas', 'Todas'], ['pendente', 'Pendentes'], ['atrasado', 'Atrasadas'], ['pago', 'Pagas'],
];

function csvEscape(v: string | number) {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function FinanceiroV2() {
  const [mes, setMes] = useState(mesAtual());
  const [data, setData] = useState<FinanceiroResp | null>(null);
  const [loading, setLoading] = useState(true);   // primeira carga (skeleton)
  const [busy, setBusy] = useState(false);         // recarga por troca de mês (dim)
  const [erro, setErro] = useState<string | null>(null);
  const [catFiltro, setCatFiltro] = useState('todas');
  const [sitFiltro, setSitFiltro] = useState('todas');
  const [modalDespesa, setModalDespesa] = useState(false);   // modal Nova despesa / conta fixa
  const [confirmarPago, setConfirmarPago] = useState<ContaPagar | null>(null); // linha a marcar como paga
  const [marcandoId, setMarcandoId] = useState<number | null>(null);

  const carregar = useCallback(async (m: string, primeira: boolean) => {
    if (primeira) setLoading(true); else setBusy(true);
    setErro(null);
    try {
      const r = await fetch(`/api/v2/financeiro?mes=${m}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { setErro(j?.error || 'Não foi possível carregar o financeiro.'); }
      else setData(j as FinanceiroResp);
    } catch {
      setErro('Falha de conexão ao carregar o financeiro.');
    } finally { setLoading(false); setBusy(false); }
  }, []);

  useEffect(() => { carregar(mes, data === null); /* eslint-disable-next-line */ }, [mes]);

  // categorias presentes (para o filtro)
  const categorias = useMemo(() => {
    const set = new Map<string, string>();
    (data?.contasPagar || []).forEach((c) => set.set(c.categoria, c.categoria));
    return Array.from(set.keys());
  }, [data]);

  const contasFiltradas = useMemo(() => {
    let arr = data?.contasPagar || [];
    if (catFiltro !== 'todas') arr = arr.filter((c) => c.categoria === catFiltro);
    if (sitFiltro !== 'todas') arr = arr.filter((c) => c.situacao === sitFiltro);
    return arr;
  }, [data, catFiltro, sitFiltro]);

  const donutFiltrado = useMemo(() => {
    let cats = data?.despesasCategoria || [];
    if (catFiltro !== 'todas') cats = cats.filter((c) => c.nome === catFiltro);
    const total = cats.reduce((s, c) => s + c.valor, 0);
    return { cats, total };
  }, [data, catFiltro]);

  const qtdPendenteFiltrado = contasFiltradas.filter((c) => c.situacao !== 'pago').length;

  const exportarCsv = useCallback(() => {
    if (!data) return;
    const d = data.dreMes;
    const linhas: string[] = [];
    linhas.push(`Financeiro NaviBelle;${data.mesLabel}`);
    linhas.push('');
    linhas.push('DRE do mes;Valor (R$)');
    const dreLinhas: [string, number][] = [
      ['Receita bruta', d.receitaBruta], ['(-) Impostos', -d.impostos], ['(=) Receita liquida', d.receitaLiquida],
      ['(-) Comissoes', -d.comissoes], ['(-) Taxas de cartao', -d.taxasCartao],
      ['(-) Despesas fixas', -d.despesasFixas], ['(-) Despesas variaveis', -d.despesasVariaveis],
      ['(=) Lucro do mes', d.lucro], ['Margem (%)', d.margem],
    ];
    dreLinhas.forEach(([r, v]) => linhas.push(`${csvEscape(r)};${csvEscape(v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))}`));
    linhas.push('');
    linhas.push('Fluxo de caixa;Valor (R$)');
    linhas.push(`Entrou;${data.fluxoCaixa.entrou.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    linhas.push(`Saiu (pago);${data.fluxoCaixa.saiu.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    linhas.push(`Saldo;${data.fluxoCaixa.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    linhas.push('');
    linhas.push(`Contas a pagar${catFiltro !== 'todas' || sitFiltro !== 'todas' ? ' (filtradas)' : ''}`);
    linhas.push('Descricao;Categoria;Vencimento;Valor (R$);Situacao');
    contasFiltradas.forEach((c) => {
      linhas.push([c.descricao, c.categoria, c.vencimento || '', c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), c.situacao].map(csvEscape).join(';'));
    });
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `financeiro-${data.mes}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [data, contasFiltradas, catFiltro, sitFiltro]);

  const limpar = () => { setCatFiltro('todas'); setSitFiltro('todas'); setMes(mesAtual()); };

  const recarregar = useCallback(() => carregar(mes, false), [carregar, mes]);

  const onDespesaCriada = useCallback(() => { setModalDespesa(false); recarregar(); }, [recarregar]);

  // marca uma despesa como paga (PUT status=pago + data_pagamento hoje), após confirmação
  const marcarPago = useCallback(async (c: ContaPagar) => {
    setMarcandoId(c.id);
    setConfirmarPago(null);
    try {
      const hojeBRT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const r = await fetch(`/api/admin/despesas?id=${c.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pago', data_pagamento: hojeBRT }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || 'Não foi possível marcar como paga.'); return; }
      toast.success(`"${c.descricao}" marcada como paga.`);
      recarregar();
    } catch { toast.error('Erro de conexão.'); }
    finally { setMarcandoId(null); }
  }, [recarregar]);

  const actions = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input type="month" value={mes} max={mesAtual()} onChange={(e) => setMes(e.target.value)} className="nb-input" style={{ width: 168 }} aria-label="Mês de referência" />
      <button className="nb-btn nb-btn-ghost" onClick={exportarCsv} disabled={!data} style={{ fontSize: 13 }}>
        <Icon name="Download" size={15} /> Exportar CSV
      </button>
      <Button icon="Plus" onClick={() => setModalDespesa(true)} style={{ fontSize: 13 }}>Lançar despesa</Button>
    </div>
  );

  // ---------- estados ----------
  if (loading) {
    return (
      <PageShell title="Financeiro" subtitle="Resultado e DRE do salão" actions={actions}>
        <div className="v2-fin-kpis" style={{ marginBottom: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => <Card key={i}><Skel h={72} /></Card>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }} className="v2-row3">
          <Card><Skel h={300} /></Card><Card><Skel h={300} /></Card>
        </div>
      </PageShell>
    );
  }

  if (erro || !data) {
    return (
      <PageShell title="Financeiro" subtitle="Resultado e DRE do salão" actions={actions}>
        <Card>
          <div style={{ padding: '48px 20px', textAlign: 'center', display: 'grid', placeItems: 'center', gap: 10 }}>
            <span aria-hidden style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--nb-surface-2)', display: 'grid', placeItems: 'center', color: 'var(--nb-bad)' }}><Icon name="TriangleAlert" size={20} /></span>
            <div style={{ fontWeight: 600, color: 'var(--nb-ink)' }}>{erro || 'Sem dados.'}</div>
            <button className="nb-btn nb-btn-ghost" onClick={() => carregar(mes, true)} style={{ fontSize: 13 }}><Icon name="RotateCcw" size={15} /> Tentar de novo</button>
          </div>
        </Card>
      </PageShell>
    );
  }

  const filtroAtivo = catFiltro !== 'todas' || sitFiltro !== 'todas' || mes !== mesAtual();

  return (
    <PageShell title="Financeiro" subtitle="Resultado e DRE do salão" actions={actions}>
      {/* Filtros (sem reload) */}
      <div className="v2-filterbar" style={{ marginBottom: 18 }}>
        <div className="v2-field">
          <label>Categoria de despesa</label>
          <select className="v2-select" value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)}>
            <option value="todas">Todas</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="v2-field">
          <label>Situação</label>
          <select className="v2-select" value={sitFiltro} onChange={(e) => setSitFiltro(e.target.value)}>
            {SITUACOES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'flex-end' }}>
          {filtroAtivo && (
            <button className="nb-btn nb-btn-quiet" onClick={limpar} style={{ fontSize: 13 }}>
              <Icon name="RotateCcw" size={15} /> Limpar
            </button>
          )}
        </div>
      </div>

      <div className={busy ? 'v2-busy' : ''}>
        {/* 6 KPIs */}
        <div style={{ marginBottom: 16 }}>
          <KpisFinanceiro kpis={data.kpis} mesAnteriorLabel={mesAnteriorLabel(data.mesAnterior)} />
        </div>

        {/* DRE do mês + Fluxo de caixa */}
        <div id="fin-dre" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, marginBottom: 16, scrollMarginTop: 88 }} className="v2-row3">
          <DreCard dre={data.dreMes} mesLabel={data.mesLabel} />
          <FluxoCaixaCard fluxo={data.fluxoCaixa} mesLabel={data.mesLabel} />
        </div>

        {/* DRE mês a mês */}
        <div style={{ marginBottom: 16 }}>
          <DreMatriz matriz={data.dreMatriz} />
        </div>

        {/* Evolução */}
        <div style={{ marginBottom: 16 }}>
          <EvolucaoChart evolucao={data.evolucao} />
        </div>

        {/* Contas a pagar + donut */}
        <div id="fin-contas" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, scrollMarginTop: 88 }} className="v2-row3">
          <ContasPagar contas={contasFiltradas} qtdPendente={qtdPendenteFiltrado} loading={busy}
            onNovaDespesa={() => setModalDespesa(true)} onMarcarPago={setConfirmarPago} marcandoId={marcandoId} />
          <DespesasDonut categorias={donutFiltrado.cats} total={donutFiltrado.total} />
        </div>

        {/* Fiados em aberto (atalho de recebimento — reusa a API de produção) */}
        <div id="fin-fiados" style={{ marginTop: 16, scrollMarginTop: 88 }}>
          <FiadosAbertosCard onPago={recarregar} />
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--nb-ink-faint)', marginTop: 16, lineHeight: 1.6 }}>
        O <strong style={{ color: 'var(--nb-ink-soft)', fontWeight: 600 }}>DRE</strong> mostra o resultado do período por competência (todas as despesas do mês, pagas ou não).
        O <strong style={{ color: 'var(--nb-ink-soft)', fontWeight: 600 }}>fluxo de caixa</strong> mostra as entradas e saídas efetivas (o que foi recebido e o que foi pago). Por isso os dois podem divergir.
        {data.aliquota > 0 && <> Alíquota de imposto aplicada sobre a receita: {data.aliquota.toLocaleString('pt-BR')}%.</>}
      </p>

      {modalDespesa && (
        <DespesaModal mes={mes} onClose={() => setModalDespesa(false)} onDone={onDespesaCriada} />
      )}

      {confirmarPago && (
        <ConfirmarPagoDialog conta={confirmarPago} onCancelar={() => setConfirmarPago(null)} onConfirmar={() => marcarPago(confirmarPago)} />
      )}
    </PageShell>
  );
}

function ConfirmarPagoDialog({ conta, onCancelar, onConfirmar }: { conta: ContaPagar; onCancelar: () => void; onConfirmar: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Confirmar pagamento" onClick={onCancelar}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'color-mix(in srgb, var(--nb-ink) 34%, transparent)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="nb-card" style={{ width: '100%', maxWidth: 400, overflow: 'hidden' }}>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span aria-hidden style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', display: 'grid', placeItems: 'center', color: 'var(--nb-ok)' }}>
            <Icon name="CircleCheck" size={20} />
          </span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 620, color: 'var(--nb-ink)' }}>Marcar como paga?</div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--nb-ink-soft)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--nb-ink)' }}>{conta.descricao}</strong> — {brlValor(conta.valor)}. A data de pagamento será hoje. Isso entra no fluxo de caixa do dia.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '14px 18px', borderTop: '1px solid var(--nb-rule)' }}>
          <Button variant="ghost" onClick={onCancelar} style={{ flex: 1, justifyContent: 'center' }}>Cancelar</Button>
          <Button icon="Check" onClick={onConfirmar} style={{ flex: 1, justifyContent: 'center' }}>Confirmar</Button>
        </div>
      </div>
    </div>
  );
}

function brlValor(v: number) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mesAnteriorLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const nome = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${nome}/${String(y).slice(2)}`;
}
