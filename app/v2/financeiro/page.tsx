'use client';

import { useEffect, useState, useCallback } from 'react';
import PageShell from '@/components/v2/layout/PageShell';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Badge from '@/components/v2/ui/Badge';
import Icon from '@/components/v2/ui/Icon';
import { brl, mesExtenso } from '@/lib/v2/formatters';

const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
function fmtVenc(iso: string) { const [a, m, d] = iso.split('-'); return `${d}/${m}`; }
const hojeStr = () => new Date().toISOString().slice(0, 10);

export default function FinanceiroV2() {
  const [mes, setMes] = useState(mesAtual());
  const [dre, setDre] = useState<any>(null);
  const [caixa, setCaixa] = useState<any>(null);
  const [despesas, setDespesas] = useState<any[]>([]);
  const [totais, setTotais] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const [dreR, despR] = await Promise.all([
        fetch(`/api/admin/dre?mes=${m}`, { cache: 'no-store' }),
        fetch(`/api/admin/despesas?mes=${m}`, { cache: 'no-store' }),
      ]);
      const dj = await dreR.json(); if (dreR.ok) { setDre(dj.dre); setCaixa(dj.caixa); }
      const pj = await despR.json(); if (despR.ok) { setDespesas(pj.despesas || []); setTotais(pj.totais); }
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(mes); }, [mes, carregar]);

  const statusDespesa = (d: any) => d.status === 'pago' ? 'pago' : d.vencimento < hojeStr() ? 'atrasado' : 'pendente';
  const lucro = dre?.lucro ?? 0;

  const actions = <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="nb-input" style={{ width: 170 }} />;

  return (
    <PageShell title="Financeiro" subtitle={`Resultado de ${mesExtenso(mes)}`} actions={actions}>
      {/* KPIs */}
      <div className="v2-kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Receita bruta" value={brl(dre?.receitaBruta ?? 0)} icon="Wallet" />
        <Kpi label={lucro >= 0 ? 'Lucro do mês' : 'Prejuízo do mês'} value={brl(lucro)} icon="TrendingUp" tone={lucro >= 0 ? 'ok' : 'bad'} />
        <Kpi label="Margem" value={`${(dre?.margem ?? 0).toFixed(1)}%`} icon="Percent" />
        <Kpi label="A pagar no mês" value={brl((totais?.pendente ?? 0))} icon="Clock" tone={totais?.atrasado > 0 ? 'warn' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }} className="v2-row3">
        {/* DRE */}
        <Card>
          <CardHead title="Demonstrativo de Resultado" right={<span className="nb-eyebrow">{mesExtenso(mes)}</span>} />
          {dre ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 14 }}>
              <Linha rotulo="Receita bruta (faturamento)" valor={dre.receitaBruta} forte />
              <Linha rotulo={`(−) Impostos`} valor={-dre.impostos} neg sub />
              <Linha rotulo="(=) Receita líquida" valor={dre.receitaLiquida} forte divisor />
              <Linha rotulo="(−) Comissões das profissionais" valor={-dre.comissoes} neg />
              <Linha rotulo="(−) Taxas de cartão" valor={-dre.taxasCartao} neg />
              <Linha rotulo="(−) Despesas fixas" valor={-dre.despesasFixas} neg />
              <Linha rotulo="(−) Despesas variáveis" valor={-dre.despesasVariaveis} neg />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid var(--nb-rule)', marginTop: 8, paddingTop: 12 }}>
                <span style={{ fontWeight: 680, color: 'var(--nb-ink)' }}>{lucro >= 0 ? 'Lucro do mês' : 'Prejuízo do mês'}</span>
                <span className="nb-num" style={{ fontSize: 20, fontWeight: 700, color: lucro >= 0 ? 'var(--nb-ok)' : 'var(--nb-bad)' }}>{brl(lucro)}</span>
              </div>
            </div>
          ) : <Vazio />}
        </Card>

        {/* Fluxo de caixa */}
        <Card>
          <CardHead title="Fluxo de caixa" right={<span className="nb-eyebrow">{mesExtenso(mes)}</span>} />
          {caixa ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, textAlign: 'center', padding: '8px 0 16px' }}>
                <Fluxo label="Entrou" value={brl(caixa.entradas)} cor="var(--nb-ok)" />
                <Fluxo label="Saiu (pago)" value={brl(caixa.saidas)} cor="var(--nb-bad)" />
                <Fluxo label="Saldo" value={brl(caixa.saldo)} cor={caixa.saldo >= 0 ? 'var(--nb-ink)' : 'var(--nb-bad)'} />
              </div>
              {caixa.despesasAPagar > 0 && (
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--nb-warn-bg)', border: '1px solid #E7D4B4', fontSize: 12.5, color: 'var(--nb-warn)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Icon name="Clock" size={16} /> Ainda há {brl(caixa.despesasAPagar)} em contas não quitadas neste mês.
                </div>
              )}
              <p style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', marginTop: 12, marginBottom: 0 }}>Entradas = faturamento realizado. Saídas = despesas pagas. O resultado (DRE) considera todas as despesas do mês, pagas ou não.</p>
            </>
          ) : <Vazio />}
        </Card>
      </div>

      {/* Contas a pagar */}
      <Card pad={false} style={{ marginTop: 16 }}>
        <div style={{ padding: '18px 20px 0' }}><CardHead title="Contas a pagar do mês" right={<span className="nb-eyebrow">{despesas.length} lançamento{despesas.length !== 1 ? 's' : ''}</span>} /></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="nb-table" style={{ minWidth: 620 }}>
            <thead><tr><th>Descrição</th><th>Vencimento</th><th style={{ textAlign: 'right' }}>Valor</th><th>Situação</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--nb-ink-faint)' }}>Carregando…</td></tr>
                : despesas.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--nb-ink-faint)' }}>Nenhuma conta neste mês.</td></tr>
                : despesas.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 560 }}>{d.descricao}</td>
                    <td className="nb-num" style={{ color: 'var(--nb-ink-soft)' }}>{fmtVenc(d.vencimento)}</td>
                    <td className="nb-num" style={{ textAlign: 'right', fontWeight: 600 }}>{brl(d.valor)}</td>
                    <td><Badge status={statusDespesa(d)} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p style={{ fontSize: 12, color: 'var(--nb-ink-faint)', marginTop: 14 }}>O faturamento usa a mesma regra do restante da V2. Contas a pagar, contas fixas e DRE compartilham a base do módulo Financeiro. Exportação PDF/Excel e edição entram no redesenho completo da Fase 3.6.</p>
    </PageShell>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: 'ok' | 'bad' | 'warn' }) {
  const cor = tone === 'ok' ? 'var(--nb-ok)' : tone === 'bad' ? 'var(--nb-bad)' : tone === 'warn' ? 'var(--nb-warn)' : 'var(--nb-ink)';
  return (
    <div className="nb-card nb-card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}><Icon name={icon} size={18} /></span>
      <div><div className="nb-eyebrow" style={{ fontSize: 10 }}>{label}</div><div className="nb-num" style={{ fontSize: 20, fontWeight: 680, color: cor, lineHeight: 1.1 }}>{value}</div></div>
    </div>
  );
}
function Linha({ rotulo, valor, forte, sub, neg, divisor }: { rotulo: string; valor: number; forte?: boolean; sub?: boolean; neg?: boolean; divisor?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', paddingLeft: sub ? 16 : 0, borderTop: divisor ? '1px solid var(--nb-rule-soft)' : 'none', marginTop: divisor ? 4 : 0 }}>
      <span style={{ color: forte ? 'var(--nb-ink)' : sub ? 'var(--nb-ink-faint)' : 'var(--nb-ink-soft)', fontWeight: forte ? 640 : 400, fontSize: sub ? 13 : 14 }}>{rotulo}</span>
      <span className="nb-num" style={{ color: forte ? 'var(--nb-ink)' : neg ? 'var(--nb-bad)' : 'var(--nb-ink-soft)', fontWeight: forte ? 640 : 400, fontSize: sub ? 13 : 14 }}>{brl(valor)}</span>
    </div>
  );
}
function Fluxo({ label, value, cor }: { label: string; value: string; cor: string }) {
  return <div><div className="nb-eyebrow" style={{ fontSize: 10 }}>{label}</div><div className="nb-num" style={{ fontSize: 18, fontWeight: 680, color: cor }}>{value}</div></div>;
}
function Vazio() { return <div style={{ padding: 32, textAlign: 'center', color: 'var(--nb-ink-faint)', fontSize: 13 }}>Carregando…</div>; }
