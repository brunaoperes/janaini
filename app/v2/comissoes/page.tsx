'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import PageShell from '@/components/v2/layout/PageShell';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Kpi from '@/components/v2/ui/Kpi';
import { brl, num } from '@/lib/v2/formatters';
import FilterBar from '@/components/v2/comissoes/FilterBar';
import ComissaoTable from '@/components/v2/comissoes/ComissaoTable';
import SidePanel from '@/components/v2/comissoes/SidePanel';
import EvolucaoChart from '@/components/v2/comissoes/EvolucaoChart';
import RegrasCard from '@/components/v2/comissoes/RegrasCard';
import PagamentoModal from '@/components/v2/comissoes/PagamentoModal';
import ProfDrawer from '@/components/v2/comissoes/ProfDrawer';
import { FILTROS_PADRAO, formaLabel } from '@/components/v2/comissoes/types';
import type { Filtros, PainelResp, Profissional } from '@/components/v2/comissoes/types';
import { getCache, setCache, invalidateCache } from '@/lib/v2/cache';

const kFmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : brl(v));

export default function ComissoesV2() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO);
  const [data, setData] = useState<PainelResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [pagarProf, setPagarProf] = useState<Profissional | null>(null);
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [pickerPagar, setPickerPagar] = useState(false); // seleção de profissional p/ pagar (via barra)

  // Busca com debounce: o input atualiza filtros.busca na hora (controlado), mas a query só
  // dispara 350ms depois — evita 1 fetch por tecla e a corrida entre respostas de prefixos.
  const [buscaDeb, setBuscaDeb] = useState(filtros.busca);
  useEffect(() => { const t = setTimeout(() => setBuscaDeb(filtros.busca), 350); return () => clearTimeout(t); }, [filtros.busca]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set('periodo', filtros.periodo);
    if (filtros.periodo === 'custom') { if (filtros.de) p.set('de', filtros.de); if (filtros.ate) p.set('ate', filtros.ate); }
    if (filtros.profissional !== 'todos') p.set('profissional', filtros.profissional);
    if (filtros.situacao !== 'todas') p.set('situacao', filtros.situacao);
    if (filtros.forma !== 'todas') p.set('forma', filtros.forma);
    if (buscaDeb.trim()) p.set('busca', buscaDeb.trim());
    return p.toString();
  }, [filtros.periodo, filtros.de, filtros.ate, filtros.profissional, filtros.situacao, filtros.forma, buscaDeb]);

  const reqId = useRef(0);
  const carregar = useCallback(async () => {
    const id = ++reqId.current;
    const url = `/api/v2/comissoes?${qs}`;
    const cached = getCache<PainelResp>(url);
    if (cached !== undefined) { setData(cached); setLoading(false); } // mostra na hora, sem skeleton
    else setLoading(true);
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (id !== reqId.current) return; // resposta obsoleta — descarta
      if (r.ok) { setData(j); setCache(url, j); }
      else if (cached === undefined) toast.error(j.error || 'Erro ao carregar comissões.');
    } catch { if (id === reqId.current && cached === undefined) toast.error('Erro de conexão.'); }
    finally { if (id === reqId.current) setLoading(false); }
  }, [qs]);
  useEffect(() => { carregar(); }, [carregar]);

  const patch = (p: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...p }));
  const limpar = () => setFiltros(FILTROS_PADRAO);

  const periodo = data?.periodo ?? { de: '', ate: '', label: '—' };
  const anteriorLabel = data?.anterior?.label ?? 'período anterior';

  const exportar = useCallback(() => {
    if (!data) return;
    setExporting(true);
    try {
      const linhas: string[] = [];
      const push = (c: (string | number)[]) => linhas.push(c.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';'));
      push([`Comissões — ${data.periodo.label}`]);
      push([]);
      push(['Profissional', 'Função', 'Comissão %', 'Atendimentos', 'Faturamento gerado', 'Comissão a pagar', 'Já pago', 'Saldo', 'Situação']);
      data.profissionais.forEach((p) => push([p.nome, p.funcao || '', `${p.porcentagem_comissao}%`, p.atendimentos, brl(p.faturamento), brl(p.comissaoTotal), brl(p.jaPago), brl(p.saldo), p.situacao]));
      const t = data.totais;
      push(['TOTAL', '', '', t.atendimentos, brl(t.faturamento), brl(t.comissaoTotal), brl(t.jaPago), brl(t.saldo), '']);
      push([]);
      push(['Pagamentos recentes', 'Data', 'Valor', 'Forma']);
      data.pagamentosRecentes.forEach((p) => push([p.nome, new Date(p.pago_em).toLocaleDateString('pt-BR'), brl(p.valor), formaLabel(p.forma)]));
      const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `navibelle-comissoes-${filtros.periodo}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }, [data, filtros.periodo]);

  const onPagarClick = () => {
    // profissionais com saldo pendente
    const pend = (data?.profissionais || []).filter((p) => p.saldo > 0.005);
    if (pend.length === 0) { toast('Nenhuma profissional com saldo pendente no período.'); return; }
    if (pend.length === 1) { setPagarProf(pend[0]); return; }
    setPickerPagar(true);
  };

  const K = data?.kpis;

  return (
    <PageShell title="Comissões" subtitle={`A pagar — ${periodo.label}`}>
      <style>{`
        .v2-com-grid{display:grid;grid-template-columns:minmax(0,1fr) 336px;gap:16px;align-items:start}
        @media (max-width:1080px){.v2-com-grid{grid-template-columns:1fr}}
        @media (max-width:640px){
          .v2-com-tablewrap{display:none}
          .v2-com-cards{display:flex !important}
          /* alvos de toque >=42px nos botões dos cards mobile */
          .v2-com-cards .nb-btn{min-height:42px}
          /* linhas de ação (footer de modal): botões encolhem, quebram texto e não clipam */
          .v2-com-actions{gap:8px}
          .v2-com-actions .nb-btn{min-width:0;flex:1;white-space:normal;padding-left:12px;padding-right:12px;min-height:46px;justify-content:center;text-align:center;line-height:1.15}
          /* CTA de largura total (drawer) com altura de toque confortável */
          .v2-com-cta{min-height:46px}
        }
      `}</style>
      <FilterBar
        filtros={filtros}
        colaboradoras={data?.colaboradoras || []}
        onChange={patch}
        onClear={limpar}
        onPagar={onPagarClick}
        onExport={exportar}
        exporting={exporting}
      />

      {/* KPIs */}
      <div className="v2-kpis" style={{ margin: '16px 0' }}>
        <Kpi label="Total a pagar" value={kFmt(K?.totalAPagar.value ?? 0)} icon="HandCoins" tone="warn"
          delta={K?.totalAPagar.delta ?? undefined} deltaLabel={`${anteriorLabel} · ${brl(K?.totalAPagar.anterior ?? 0)}`} />
        <Kpi label="Comissões pagas" value={kFmt(K?.comissoesPagas.value ?? 0)} icon="Check"
          delta={K?.comissoesPagas.delta ?? undefined} deltaLabel={`de ${brl(K?.comissoesPagas.base ?? 0)} no período`} />
        <Kpi label="Faturamento gerado" value={kFmt(K?.faturamento.value ?? 0)} icon="Wallet" href="/v2/lancamentos"
          delta={K?.faturamento.delta ?? undefined} deltaLabel={`${anteriorLabel} · ${brl(K?.faturamento.anterior ?? 0)}`} />
        <Kpi label="Taxas de cartão" value={kFmt(K?.taxas.value ?? 0)} icon="CreditCard" href="/v2/relatorios"
          delta={K?.taxas.delta ?? undefined} deltaLabel={`${anteriorLabel} · ${brl(K?.taxas.anterior ?? 0)}`} />
        <Kpi label="Atendimentos" value={num(K?.atendimentos.value ?? 0)} icon="ReceiptText" href="/v2/lancamentos"
          delta={K?.atendimentos.delta ?? undefined} deltaLabel={`${anteriorLabel} · ${num(K?.atendimentos.anterior ?? 0)}`} />
      </div>

      {/* corpo: tabela + evolução | coluna lateral */}
      <div className="v2-com-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Card pad={false}>
            <div style={{ padding: '18px 20px 4px' }}>
              <CardHead title="Comissão por profissional" right={<span className="nb-eyebrow" style={{ fontSize: 9.5 }}>{data ? `${data.totais.profissionais} no período` : ''}</span>} />
            </div>
            <div style={{ padding: '0 12px 12px' }}>
              <ComissaoTable
                profissionais={data?.profissionais || []}
                totais={data?.totais || null}
                loading={loading}
                onVer={setDrawerId}
                onPagar={setPagarProf}
                onHistorico={setDrawerId}
              />
            </div>
          </Card>

          <Card>
            <CardHead title="Evolução das comissões" right={<span className="nb-eyebrow" style={{ fontSize: 9.5 }}>últimos 6 meses</span>} />
            {loading && !data ? <div className="v2-skel" style={{ height: 244, borderRadius: 10 }} /> : <EvolucaoChart data={data?.evolucao || []} />}
          </Card>

          <RegrasCard />
        </div>

        <SidePanel
          totais={data?.totais || null}
          ranking={data?.ranking || []}
          recentes={data?.pagamentosRecentes || []}
          loading={loading && !data}
          onVer={setDrawerId}
        />
      </div>

      {/* modal registrar pagamento */}
      {pagarProf && (
        <PagamentoModal
          prof={pagarProf}
          periodo={periodo}
          onClose={() => setPagarProf(null)}
          onDone={() => { setPagarProf(null); invalidateCache('/api/v2/'); carregar(); }}
        />
      )}

      {/* picker de profissional (quando "Registrar pagamento" na barra com vários pendentes) */}
      {pickerPagar && data && (
        <PickerPagar
          profissionais={data.profissionais.filter((p) => p.saldo > 0.005)}
          onPick={(p) => { setPickerPagar(false); setPagarProf(p); }}
          onClose={() => setPickerPagar(false)}
        />
      )}

      {/* drawer detalhe */}
      <ProfDrawer
        colaboradorId={drawerId}
        periodo={periodo}
        onClose={() => setDrawerId(null)}
        onPagar={(p) => { setDrawerId(null); setPagarProf(p); }}
      />
    </PageShell>
  );
}

function PickerPagar({ profissionais, onPick, onClose }: { profissionais: Profissional[]; onPick: (p: Profissional) => void; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'color-mix(in srgb, var(--nb-ink) 34%, transparent)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="nb-card nb-card-pad" style={{ width: '100%', maxWidth: 420, maxHeight: '80dvh', overflowY: 'auto' }}>
        <CardHead title="Pagar comissão de" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {profissionais.map((p) => (
            <button key={p.colaborador_id} onClick={() => onPick(p)} className="nb-row-hover"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: '1px solid var(--nb-rule)', borderRadius: 10, background: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 14, fontWeight: 560, color: 'var(--nb-ink)' }}>{p.nome}</span>
              <span className="nb-num" style={{ fontSize: 14, fontWeight: 640, color: 'var(--nb-accent-deep)' }}>{brl(p.saldo)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
