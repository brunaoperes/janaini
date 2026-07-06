'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import toast from 'react-hot-toast';

type Categoria = { id: number; nome: string; tipo: 'fixa' | 'variavel'; ativo: boolean };
type Despesa = { id: number; descricao: string; categoria_id: number | null; valor: number; vencimento: string; status: 'pendente' | 'pago'; data_pagamento: string | null; forma_pagamento: string | null; fornecedor: string | null; observacoes: string | null; competencia: string; conta_fixa_id: number | null };
type ContaFixa = { id: number; descricao: string; categoria_id: number | null; valor_estimado: number; dia_vencimento: number; ativo: boolean };
type Totais = { total: number; pago: number; pendente: number; atrasado: number };
type DRE = { receitaBruta: number; receitaServicos: number; receitaFiadosRecebidos: number; impostos: number; receitaLiquida: number; comissoes: number; taxasCartao: number; resultadoSalao: number; despesasFixas: number; despesasVariaveis: number; despesasTotal: number; porCategoria: { nome: string; tipo: string; valor: number }[]; lucro: number; margem: number };
type Caixa = { entradas: number; saidas: number; saldo: number; despesasAPagar: number };
type Indicadores = { kpis: { receita: number; lucro: number; margem: number; atendimentos: number; ticketMedio: number; inadimplencia: number }; evolucao: { receita: number; lucro: number; atendimentos: number }; porProfissional: { nome: string; faturamento: number; atendimentos: number }[] };

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hojeStr = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7);
function labelMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
function fmtData(d: string) { const [a, m, dia] = d.split('-'); return `${dia}/${m}/${a}`; }

const DESPESA_VAZIA = { descricao: '', categoria_id: '' as number | '', valor: 0, vencimento: hojeStr(), status: 'pendente' as 'pendente' | 'pago', forma_pagamento: '', fornecedor: '', observacoes: '' };
const FIXA_VAZIA = { descricao: '', categoria_id: '' as number | '', valor_estimado: 0, dia_vencimento: 5, ativo: true };

export default function FinanceiroPage() {
  const [mes, setMes] = useState(mesAtual());
  const [tab, setTab] = useState<'pagar' | 'fixas' | 'dre' | 'kpis'>('pagar');
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contasFixas, setContasFixas] = useState<ContaFixa[]>([]);
  const [totais, setTotais] = useState<Totais>({ total: 0, pago: 0, pendente: 0, atrasado: 0 });
  const [dre, setDre] = useState<DRE | null>(null);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [aliquota, setAliquota] = useState(0);
  const [editAliquota, setEditAliquota] = useState(false);
  const [indicadores, setIndicadores] = useState<Indicadores | null>(null);
  const [loading, setLoading] = useState(true);

  const [modalDespesa, setModalDespesa] = useState(false);
  const [editDespesa, setEditDespesa] = useState<Despesa | null>(null);
  const [formD, setFormD] = useState(DESPESA_VAZIA);
  const [modalFixa, setModalFixa] = useState(false);
  const [editFixa, setEditFixa] = useState<ContaFixa | null>(null);
  const [formF, setFormF] = useState(FIXA_VAZIA);
  const [salvando, setSalvando] = useState(false);
  const [excluirD, setExcluirD] = useState<Despesa | null>(null);
  const [excluirF, setExcluirF] = useState<ContaFixa | null>(null);

  const carregar = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const [res, dreRes, kpiRes] = await Promise.all([
        fetch(`/api/admin/despesas?mes=${m}`, { cache: 'no-store' }),
        fetch(`/api/admin/dre?mes=${m}`, { cache: 'no-store' }),
        fetch(`/api/admin/indicadores?mes=${m}`, { cache: 'no-store' }),
      ]);
      const j = await res.json();
      if (res.ok) { setDespesas(j.despesas || []); setCategorias(j.categorias || []); setContasFixas(j.contasFixas || []); setTotais(j.totais); }
      else toast.error(j.error || 'Erro ao carregar.');
      const dj = await dreRes.json();
      if (dreRes.ok) { setDre(dj.dre); setCaixa(dj.caixa); setAliquota(dj.aliquota); }
      const kj = await kpiRes.json();
      if (kpiRes.ok) setIndicadores(kj);
    } catch { toast.error('Erro de conexão.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(mes); }, [mes, carregar]);

  const catNome = (id: number | null) => categorias.find((c) => c.id === id)?.nome || '—';
  const estaAtrasada = (d: Despesa) => d.status === 'pendente' && d.vencimento < hojeStr();

  // ---- despesas ----
  const abrirNovaDespesa = () => { setEditDespesa(null); setFormD({ ...DESPESA_VAZIA, vencimento: `${mes}-05` }); setModalDespesa(true); };
  const abrirEditDespesa = (d: Despesa) => {
    setEditDespesa(d);
    setFormD({ descricao: d.descricao, categoria_id: d.categoria_id ?? '', valor: Number(d.valor), vencimento: d.vencimento, status: d.status, forma_pagamento: d.forma_pagamento || '', fornecedor: d.fornecedor || '', observacoes: d.observacoes || '' });
    setModalDespesa(true);
  };
  const salvarDespesa = async () => {
    if (formD.descricao.trim().length < 2) { toast.error('Informe a descrição.'); return; }
    if (Number(formD.valor) <= 0) { toast.error('Informe um valor maior que zero.'); return; }
    if (!formD.vencimento) { toast.error('Informe o vencimento.'); return; }
    setSalvando(true);
    try {
      const payload = { ...formD, categoria_id: formD.categoria_id || null, competencia: `${mes}-01` };
      const url = editDespesa ? `/api/admin/despesas?id=${editDespesa.id}` : '/api/admin/despesas';
      const res = await fetch(url, { method: editDespesa ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (res.ok) { toast.success(editDespesa ? 'Despesa atualizada!' : 'Despesa lançada!'); setModalDespesa(false); carregar(mes); }
      else toast.error(j.error || 'Erro ao salvar.');
    } catch { toast.error('Erro de conexão.'); } finally { setSalvando(false); }
  };
  const alternarPago = async (d: Despesa) => {
    try {
      const res = await fetch(`/api/admin/despesas?id=${d.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: d.status === 'pago' ? 'pendente' : 'pago' }) });
      if (res.ok) { toast.success(d.status === 'pago' ? 'Marcada como pendente.' : 'Marcada como paga!'); carregar(mes); }
      else toast.error((await res.json()).error || 'Erro.');
    } catch { toast.error('Erro de conexão.'); }
  };
  const confirmarExcluirD = async () => {
    if (!excluirD) return;
    try {
      const res = await fetch(`/api/admin/despesas?id=${excluirD.id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Despesa excluída.'); carregar(mes); } else toast.error((await res.json()).error || 'Erro.');
    } catch { toast.error('Erro de conexão.'); } finally { setExcluirD(null); }
  };
  const gerarMes = async () => {
    try {
      const res = await fetch('/api/admin/despesas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'gerar_mes', mes }) });
      const j = await res.json();
      if (res.ok) { toast.success(j.message); carregar(mes); } else toast.error(j.error || 'Erro.');
    } catch { toast.error('Erro de conexão.'); }
  };

  // ---- contas fixas ----
  const abrirNovaFixa = () => { setEditFixa(null); setFormF(FIXA_VAZIA); setModalFixa(true); };
  const abrirEditFixa = (f: ContaFixa) => { setEditFixa(f); setFormF({ descricao: f.descricao, categoria_id: f.categoria_id ?? '', valor_estimado: Number(f.valor_estimado), dia_vencimento: f.dia_vencimento, ativo: f.ativo }); setModalFixa(true); };
  const salvarFixa = async () => {
    if (formF.descricao.trim().length < 2) { toast.error('Informe a descrição.'); return; }
    if (formF.dia_vencimento < 1 || formF.dia_vencimento > 31) { toast.error('Dia de vencimento entre 1 e 31.'); return; }
    setSalvando(true);
    try {
      const payload = { ...formF, categoria_id: formF.categoria_id || null };
      const url = editFixa ? `/api/admin/contas-fixas?id=${editFixa.id}` : '/api/admin/contas-fixas';
      const res = await fetch(url, { method: editFixa ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (res.ok) { toast.success(editFixa ? 'Conta fixa atualizada!' : 'Conta fixa criada!'); setModalFixa(false); carregar(mes); }
      else toast.error(j.error || 'Erro ao salvar.');
    } catch { toast.error('Erro de conexão.'); } finally { setSalvando(false); }
  };
  const confirmarExcluirF = async () => {
    if (!excluirF) return;
    try {
      const res = await fetch(`/api/admin/contas-fixas?id=${excluirF.id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Conta fixa excluída.'); carregar(mes); } else toast.error((await res.json()).error || 'Erro.');
    } catch { toast.error('Erro de conexão.'); } finally { setExcluirF(null); }
  };

  const salvarAliquota = async () => {
    try {
      const res = await fetch('/api/admin/dre', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aliquota_imposto: aliquota }) });
      if (res.ok) { toast.success('Alíquota atualizada!'); setEditAliquota(false); carregar(mes); }
      else toast.error((await res.json()).error || 'Erro.');
    } catch { toast.error('Erro de conexão.'); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <Link href="/admin" className="text-sm text-purple-600 hover:text-purple-800">← Voltar ao painel</Link>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Financeiro</h1>
            <p className="text-gray-500 text-sm mt-1 capitalize">{labelMes(mes)}</p>
          </div>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 outline-none" />
        </div>

        {/* Totais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="text-xs text-gray-500">Total do mês</div><div className="text-xl font-bold text-gray-800">{brl(totais.total)}</div></div>
          <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="text-xs text-gray-500">Pago</div><div className="text-xl font-bold text-emerald-600">{brl(totais.pago)}</div></div>
          <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="text-xs text-gray-500">A pagar</div><div className="text-xl font-bold text-amber-600">{brl(totais.pendente)}</div></div>
          <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="text-xs text-gray-500">Atrasado</div><div className="text-xl font-bold text-red-600">{brl(totais.atrasado)}</div></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('pagar')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'pagar' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'}`}>Contas a pagar</button>
          <button onClick={() => setTab('fixas')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'fixas' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'}`}>Contas fixas ({contasFixas.filter(f => f.ativo).length})</button>
          <button onClick={() => setTab('dre')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'dre' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'}`}>Resultado (DRE)</button>
          <button onClick={() => setTab('kpis')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'kpis' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'}`}>Indicadores</button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Carregando…</div>
        ) : tab === 'pagar' ? (
          <div className="bg-white rounded-2xl shadow-sm p-4 md:p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-bold text-gray-800">Despesas de {labelMes(mes)}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={gerarMes}>↻ Gerar contas fixas do mês</Button>
                <Button size="sm" onClick={abrirNovaDespesa}>+ Nova despesa</Button>
              </div>
            </div>
            {despesas.length === 0 ? (
              <p className="text-gray-400 text-sm py-10 text-center">Nenhuma despesa neste mês. Lance uma nova ou gere as contas fixas.</p>
            ) : (
              <div className="space-y-2">
                {despesas.map((d) => (
                  <div key={d.id} className={`flex items-center gap-3 p-3 rounded-xl border ${estaAtrasada(d) ? 'border-red-200 bg-red-50/50' : d.status === 'pago' ? 'border-emerald-100 bg-emerald-50/40' : 'border-gray-100'}`}>
                    <button onClick={() => alternarPago(d)} title={d.status === 'pago' ? 'Marcar como pendente' : 'Marcar como paga'}
                      className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center ${d.status === 'pago' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'}`}>
                      {d.status === 'pago' && '✓'}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-800 truncate">{d.descricao} {d.conta_fixa_id && <span className="text-[10px] text-purple-500 align-middle">fixa</span>}</div>
                      <div className="text-xs text-gray-500">{catNome(d.categoria_id)} · vence {fmtData(d.vencimento)}{estaAtrasada(d) && <span className="text-red-600 font-semibold"> · atrasada</span>}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-gray-800">{brl(Number(d.valor))}</div>
                      <div className="flex gap-1.5 justify-end mt-0.5">
                        <button onClick={() => abrirEditDespesa(d)} className="text-xs text-gray-500 hover:text-purple-600">editar</button>
                        <button onClick={() => setExcluirD(d)} className="text-xs text-gray-500 hover:text-red-600">excluir</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === 'fixas' ? (
          <div className="bg-white rounded-2xl shadow-sm p-4 md:p-5">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h2 className="font-bold text-gray-800">Contas fixas (recorrentes)</h2>
              <Button size="sm" onClick={abrirNovaFixa}>+ Nova conta fixa</Button>
            </div>
            <p className="text-xs text-gray-400 mb-4">Cadastre aqui o que se repete todo mês (aluguel, luz, água…). Depois use “Gerar contas fixas do mês” pra lançá-las como contas a pagar.</p>
            {contasFixas.length === 0 ? (
              <p className="text-gray-400 text-sm py-10 text-center">Nenhuma conta fixa cadastrada.</p>
            ) : (
              <div className="space-y-2">
                {contasFixas.map((f) => (
                  <div key={f.id} className={`flex items-center gap-3 p-3 rounded-xl border ${f.ativo ? 'border-gray-100' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-800 truncate">{f.descricao} {!f.ativo && <span className="text-[10px] uppercase text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">inativa</span>}</div>
                      <div className="text-xs text-gray-500">{catNome(f.categoria_id)} · todo dia {f.dia_vencimento}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-gray-800">{brl(Number(f.valor_estimado))}</div>
                      <div className="flex gap-1.5 justify-end mt-0.5">
                        <button onClick={() => abrirEditFixa(f)} className="text-xs text-gray-500 hover:text-purple-600">editar</button>
                        <button onClick={() => setExcluirF(f)} className="text-xs text-gray-500 hover:text-red-600">excluir</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === 'dre' ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="font-bold text-gray-800">Resultado de {labelMes(mes)}</h2>
                {!editAliquota ? (
                  <button onClick={() => setEditAliquota(true)} className="text-xs text-gray-500 hover:text-purple-600">Imposto (Simples): {aliquota}% ✎</button>
                ) : (
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} max={100} step="0.1" value={aliquota} onChange={(e) => setAliquota(parseFloat(e.target.value) || 0)} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" />
                    <span className="text-xs text-gray-500">%</span>
                    <button onClick={salvarAliquota} className="text-xs text-purple-600 font-semibold ml-1">salvar</button>
                  </div>
                )}
              </div>
              {dre && (
                <div className="space-y-1 text-sm">
                  <LinhaDRE label="Receita bruta (faturamento)" valor={dre.receitaBruta} forte />
                  <LinhaDRE label="Serviços e pacotes" valor={dre.receitaServicos} sub />
                  {dre.receitaFiadosRecebidos > 0 && <LinhaDRE label="Fiados recebidos no mês" valor={dre.receitaFiadosRecebidos} sub />}
                  <LinhaDRE label={`(−) Impostos (${aliquota}%)`} valor={-dre.impostos} neg />
                  <LinhaDRE label="(=) Receita líquida" valor={dre.receitaLiquida} forte divisor />
                  <LinhaDRE label="(−) Comissões das profissionais" valor={-dre.comissoes} neg />
                  <LinhaDRE label="(−) Taxas de cartão" valor={-dre.taxasCartao} neg />
                  <LinhaDRE label="(−) Despesas fixas" valor={-dre.despesasFixas} neg />
                  <LinhaDRE label="(−) Despesas variáveis" valor={-dre.despesasVariaveis} neg />
                  <div className={`flex justify-between items-center pt-3 mt-2 border-t-2 ${dre.lucro >= 0 ? 'border-emerald-200' : 'border-red-200'}`}>
                    <span className="font-bold text-gray-800">{dre.lucro >= 0 ? 'Lucro do mês' : 'Prejuízo do mês'}</span>
                    <span className={`text-xl font-bold ${dre.lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{brl(dre.lucro)}</span>
                  </div>
                  <div className="text-right text-xs text-gray-400">margem de {dre.margem.toFixed(1)}%</div>
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-bold text-gray-800 mb-3">Fluxo de caixa — quanto entrou e saiu</h2>
              {caixa && (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><div className="text-xs text-gray-500">Entrou</div><div className="text-lg font-bold text-emerald-600">{brl(caixa.entradas)}</div></div>
                    <div><div className="text-xs text-gray-500">Saiu (pago)</div><div className="text-lg font-bold text-red-600">{brl(caixa.saidas)}</div></div>
                    <div><div className="text-xs text-gray-500">Saldo</div><div className={`text-lg font-bold ${caixa.saldo >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{brl(caixa.saldo)}</div></div>
                  </div>
                  {caixa.despesasAPagar > 0 && <p className="text-xs text-amber-600 mt-3">Ainda há {brl(caixa.despesasAPagar)} em contas deste mês não quitadas.</p>}
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 px-1">O faturamento segue a mesma regra dos relatórios (serviços concluídos + fiados recebidos; troca-grátis não conta). O imposto é uma estimativa sobre o faturamento — ajuste a alíquota do seu Simples no ✎.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {indicadores && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <KpiCard label="Faturamento" valor={brl(indicadores.kpis.receita)} evol={indicadores.evolucao.receita} />
                  <KpiCard label="Lucro" valor={brl(indicadores.kpis.lucro)} evol={indicadores.evolucao.lucro} />
                  <KpiCard label="Margem" valor={`${indicadores.kpis.margem.toFixed(1)}%`} />
                  <KpiCard label="Atendimentos" valor={String(indicadores.kpis.atendimentos)} evol={indicadores.evolucao.atendimentos} />
                  <KpiCard label="Ticket médio" valor={brl(indicadores.kpis.ticketMedio)} />
                  <KpiCard label="Fiado em aberto" valor={brl(indicadores.kpis.inadimplencia)} alerta={indicadores.kpis.inadimplencia > 0} />
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h2 className="font-bold text-gray-800 mb-3">Faturamento por profissional — {labelMes(mes)}</h2>
                  {indicadores.porProfissional.length === 0 ? (
                    <p className="text-gray-400 text-sm py-4 text-center">Sem atendimentos neste mês.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {indicadores.porProfissional.map((p) => {
                        const max = indicadores.porProfissional[0].faturamento || 1;
                        return (
                          <div key={p.nome}>
                            <div className="flex justify-between text-sm mb-0.5"><span className="text-gray-700">{p.nome}</span><span className="font-semibold text-gray-800 tabular-nums">{brl(p.faturamento)} <span className="text-gray-400 font-normal text-xs">· {p.atendimentos} atend.</span></span></div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.max(3, (p.faturamento / max) * 100)}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 px-1">A variação (↑/↓) compara com o mês anterior.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal despesa */}
      <Modal isOpen={modalDespesa} onClose={() => setModalDespesa(false)} title={editDespesa ? 'Editar despesa' : 'Nova despesa'}>
        <div className="space-y-3">
          <Campo label="Descrição"><input value={formD.descricao} onChange={(e) => setFormD({ ...formD, descricao: e.target.value })} maxLength={200} className={inputCls} placeholder="Ex.: Conta de luz, Fornecedor X…" /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor (R$)"><input type="number" min={0} step="0.01" value={formD.valor} onChange={(e) => setFormD({ ...formD, valor: parseFloat(e.target.value) || 0 })} className={inputCls} /></Campo>
            <Campo label="Vencimento"><input type="date" value={formD.vencimento} onChange={(e) => setFormD({ ...formD, vencimento: e.target.value })} className={inputCls} /></Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Categoria"><select value={formD.categoria_id} onChange={(e) => setFormD({ ...formD, categoria_id: e.target.value ? Number(e.target.value) : '' })} className={inputCls}><option value="">Sem categoria</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
            <Campo label="Fornecedor (opcional)"><input value={formD.fornecedor} onChange={(e) => setFormD({ ...formD, fornecedor: e.target.value })} className={inputCls} /></Campo>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={formD.status === 'pago'} onChange={(e) => setFormD({ ...formD, status: e.target.checked ? 'pago' : 'pendente' })} className="rounded" />
            Já está paga
          </label>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => setModalDespesa(false)} fullWidth>Cancelar</Button>
            <Button onClick={salvarDespesa} disabled={salvando} fullWidth>{salvando ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      {/* Modal conta fixa */}
      <Modal isOpen={modalFixa} onClose={() => setModalFixa(false)} title={editFixa ? 'Editar conta fixa' : 'Nova conta fixa'}>
        <div className="space-y-3">
          <Campo label="Descrição"><input value={formF.descricao} onChange={(e) => setFormF({ ...formF, descricao: e.target.value })} maxLength={200} className={inputCls} placeholder="Ex.: Aluguel, Internet…" /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor estimado (R$)"><input type="number" min={0} step="0.01" value={formF.valor_estimado} onChange={(e) => setFormF({ ...formF, valor_estimado: parseFloat(e.target.value) || 0 })} className={inputCls} /></Campo>
            <Campo label="Vence todo dia"><input type="number" min={1} max={31} value={formF.dia_vencimento} onChange={(e) => setFormF({ ...formF, dia_vencimento: parseInt(e.target.value) || 1 })} className={inputCls} /></Campo>
          </div>
          <Campo label="Categoria"><select value={formF.categoria_id} onChange={(e) => setFormF({ ...formF, categoria_id: e.target.value ? Number(e.target.value) : '' })} className={inputCls}><option value="">Sem categoria</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={formF.ativo} onChange={(e) => setFormF({ ...formF, ativo: e.target.checked })} className="rounded" /> Ativa (entra na geração mensal)</label>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => setModalFixa(false)} fullWidth>Cancelar</Button>
            <Button onClick={salvarFixa} disabled={salvando} fullWidth>{salvando ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!excluirD} onClose={() => setExcluirD(null)} onConfirm={confirmarExcluirD} title="Excluir despesa" message={`Excluir "${excluirD?.descricao}"?`} confirmText="Excluir" type="danger" />
      <ConfirmDialog isOpen={!!excluirF} onClose={() => setExcluirF(null)} onConfirm={confirmarExcluirF} title="Excluir conta fixa" message={`Excluir a conta fixa "${excluirF?.descricao}"? As despesas já geradas continuam.`} confirmText="Excluir" type="danger" />
    </div>
  );
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none';
function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>{children}</div>;
}

function KpiCard({ label, valor, evol, alerta }: { label: string; valor: string; evol?: number; alerta?: boolean }) {
  const temEvol = evol !== undefined && Math.abs(evol) >= 0.1;
  const sobe = (evol || 0) >= 0;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${alerta ? 'text-amber-600' : 'text-gray-800'}`}>{valor}</div>
      {temEvol && <div className={`text-xs font-medium ${sobe ? 'text-emerald-600' : 'text-red-500'}`}>{sobe ? '↑' : '↓'} {Math.abs(evol!).toFixed(0)}% vs mês anterior</div>}
    </div>
  );
}

function LinhaDRE({ label, valor, forte, sub, neg, divisor }: { label: string; valor: number; forte?: boolean; sub?: boolean; neg?: boolean; divisor?: boolean }) {
  return (
    <div className={`flex justify-between items-center ${divisor ? 'border-t border-gray-100 pt-1.5 mt-1' : ''} ${sub ? 'pl-4' : ''}`}>
      <span className={`${forte ? 'font-semibold text-gray-800' : sub ? 'text-gray-400 text-xs' : 'text-gray-600'}`}>{label}</span>
      <span className={`${forte ? 'font-semibold text-gray-800' : sub ? 'text-gray-400 text-xs' : neg ? 'text-red-500' : 'text-gray-700'} tabular-nums`}>{valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
    </div>
  );
}
