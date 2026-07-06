'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import toast from 'react-hot-toast';

type Produto = { id: number; nome: string; categoria: string | null; unidade: string; tipo: 'uso_interno' | 'revenda'; quantidade_atual: number; estoque_minimo: number; custo_unitario: number; preco_venda: number | null; ativo: boolean };
type Contadores = { total: number; emReposicao: number; valorEstoque: number };

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const CATEGORIAS = ['Coloração', 'Shampoo/Condicionador', 'Descartáveis', 'Química', 'Ferramentas', 'Outros'];
const UNIDADES = ['un', 'ml', 'g', 'kg', 'L', 'cx', 'par', 'pct'];
const PRODUTO_VAZIO = { nome: '', categoria: '', unidade: 'un', tipo: 'uso_interno' as const, quantidade_atual: 0, estoque_minimo: 1, custo_unitario: 0 };

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [contadores, setContadores] = useState<Contadores>({ total: 0, emReposicao: 0, valorEstoque: 0 });
  const [loading, setLoading] = useState(true);
  const [modalProd, setModalProd] = useState(false);
  const [editProd, setEditProd] = useState<Produto | null>(null);
  const [formP, setFormP] = useState<any>(PRODUTO_VAZIO);
  const [modalMov, setModalMov] = useState(false);
  const [movProd, setMovProd] = useState<Produto | null>(null);
  const [movTipo, setMovTipo] = useState<'entrada' | 'saida'>('entrada');
  const [movQtd, setMovQtd] = useState(1);
  const [movCusto, setMovCusto] = useState(0);
  const [movMotivo, setMovMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<Produto | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/produtos', { cache: 'no-store' });
      const j = await res.json();
      if (res.ok) { setProdutos(j.produtos || []); setContadores(j.contadores); }
      else toast.error(j.error || 'Erro ao carregar.');
    } catch { toast.error('Erro de conexão.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const emReposicao = (p: Produto) => Number(p.quantidade_atual) <= Number(p.estoque_minimo);
  const produtosReposicao = produtos.filter(emReposicao);

  const abrirNovo = () => { setEditProd(null); setFormP(PRODUTO_VAZIO); setModalProd(true); };
  const abrirEdit = (p: Produto) => { setEditProd(p); setFormP({ nome: p.nome, categoria: p.categoria || '', unidade: p.unidade, tipo: p.tipo, estoque_minimo: Number(p.estoque_minimo), custo_unitario: Number(p.custo_unitario), quantidade_atual: Number(p.quantidade_atual) }); setModalProd(true); };
  const salvarProd = async () => {
    if (formP.nome.trim().length < 2) { toast.error('Informe o nome.'); return; }
    setSalvando(true);
    try {
      const url = editProd ? `/api/admin/produtos?id=${editProd.id}` : '/api/admin/produtos';
      const payload = editProd ? { nome: formP.nome, categoria: formP.categoria || null, unidade: formP.unidade, tipo: formP.tipo, estoque_minimo: formP.estoque_minimo, custo_unitario: formP.custo_unitario } : { ...formP, categoria: formP.categoria || null };
      const res = await fetch(url, { method: editProd ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (res.ok) { toast.success(editProd ? 'Produto atualizado!' : 'Produto criado!'); setModalProd(false); carregar(); }
      else toast.error(j.error || 'Erro ao salvar.');
    } catch { toast.error('Erro de conexão.'); } finally { setSalvando(false); }
  };

  const abrirMov = (p: Produto, tipo: 'entrada' | 'saida') => { setMovProd(p); setMovTipo(tipo); setMovQtd(1); setMovCusto(Number(p.custo_unitario)); setMovMotivo(''); setModalMov(true); };
  const salvarMov = async () => {
    if (!movProd || movQtd <= 0) { toast.error('Informe a quantidade.'); return; }
    setSalvando(true);
    try {
      const body: any = { acao: 'movimentar', produto_id: movProd.id, tipo: movTipo, quantidade: movQtd, motivo: movMotivo || null };
      if (movTipo === 'entrada') body.custo_unitario = movCusto;
      const res = await fetch('/api/admin/produtos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (res.ok) { toast.success(j.message || 'Estoque atualizado!'); setModalMov(false); carregar(); }
      else toast.error(j.error || 'Erro.');
    } catch { toast.error('Erro de conexão.'); } finally { setSalvando(false); }
  };

  const confirmarExcluir = async () => {
    if (!excluir) return;
    try {
      const res = await fetch(`/api/admin/produtos?id=${excluir.id}`, { method: 'DELETE' });
      const j = await res.json();
      if (res.ok) { toast.success(j.desativado ? j.message : 'Produto excluído.'); carregar(); } else toast.error(j.error || 'Erro.');
    } catch { toast.error('Erro de conexão.'); } finally { setExcluir(null); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/admin" className="text-sm text-purple-600 hover:text-purple-800">← Voltar ao painel</Link>
        <div className="flex items-end justify-between flex-wrap gap-3 mt-2 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Estoque</h1>
            <p className="text-gray-500 text-sm mt-1">Controle dos seus produtos e aviso quando estão acabando</p>
          </div>
          <Button onClick={abrirNovo}>+ Novo produto</Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="text-xs text-gray-500">Produtos</div><div className="text-xl font-bold text-gray-800">{contadores.total}</div></div>
          <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="text-xs text-gray-500">Repor</div><div className={`text-xl font-bold ${contadores.emReposicao > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{contadores.emReposicao}</div></div>
          <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="text-xs text-gray-500">Valor em estoque</div><div className="text-xl font-bold text-gray-800">{brl(contadores.valorEstoque)}</div></div>
        </div>

        {/* Alerta de reposição */}
        {produtosReposicao.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
            <h2 className="font-bold text-red-700 text-sm mb-2">⚠️ Precisa repor ({produtosReposicao.length})</h2>
            <div className="flex flex-wrap gap-2">
              {produtosReposicao.map((p) => (
                <span key={p.id} className="text-sm bg-white text-red-700 px-3 py-1 rounded-lg border border-red-200">{p.nome}: {Number(p.quantidade_atual)} {p.unidade}</span>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Carregando…</div>
        ) : produtos.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">Nenhum produto cadastrado. Toque em “Novo produto” pra começar.</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-4 md:p-5 space-y-2">
            {produtos.map((p) => (
              <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${emReposicao(p) ? 'border-red-200 bg-red-50/50' : 'border-gray-100'}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-800 truncate">{p.nome} {p.tipo === 'revenda' && <span className="text-[10px] text-purple-500">revenda</span>}</div>
                  <div className="text-xs text-gray-500">{p.categoria || 'Sem categoria'} · custo {brl(Number(p.custo_unitario))}/{p.unidade}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-bold ${emReposicao(p) ? 'text-red-600' : 'text-gray-800'}`}>{Number(p.quantidade_atual)} {p.unidade}</div>
                  <div className="text-[11px] text-gray-400">mín. {Number(p.estoque_minimo)}</div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <div className="flex gap-1">
                    <button onClick={() => abrirMov(p, 'entrada')} title="Entrada" className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold hover:bg-emerald-200">+</button>
                    <button onClick={() => abrirMov(p, 'saida')} title="Saída/baixa" className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 font-bold hover:bg-amber-200">−</button>
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => abrirEdit(p)} className="text-[11px] text-gray-500 hover:text-purple-600">editar</button>
                    <button onClick={() => setExcluir(p)} className="text-[11px] text-gray-500 hover:text-red-600">excluir</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal produto */}
      <Modal isOpen={modalProd} onClose={() => setModalProd(false)} title={editProd ? 'Editar produto' : 'Novo produto'}>
        <div className="space-y-3">
          <Campo label="Nome do produto"><input value={formP.nome} onChange={(e) => setFormP({ ...formP, nome: e.target.value })} maxLength={120} className={inputCls} placeholder="Ex.: Coloração 7.0, Luva descartável…" /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Categoria"><select value={formP.categoria} onChange={(e) => setFormP({ ...formP, categoria: e.target.value })} className={inputCls}><option value="">Sem categoria</option>{CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Campo>
            <Campo label="Unidade"><select value={formP.unidade} onChange={(e) => setFormP({ ...formP, unidade: e.target.value })} className={inputCls}>{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</select></Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!editProd && <Campo label="Quantidade atual"><input type="number" min={0} step="0.01" value={formP.quantidade_atual} onChange={(e) => setFormP({ ...formP, quantidade_atual: parseFloat(e.target.value) || 0 })} className={inputCls} /></Campo>}
            <Campo label="Estoque mínimo (avisa quando chegar nele)"><input type="number" min={0} step="0.01" value={formP.estoque_minimo} onChange={(e) => setFormP({ ...formP, estoque_minimo: parseFloat(e.target.value) || 0 })} className={inputCls} /></Campo>
            <Campo label="Custo unitário (R$)"><input type="number" min={0} step="0.01" value={formP.custo_unitario} onChange={(e) => setFormP({ ...formP, custo_unitario: parseFloat(e.target.value) || 0 })} className={inputCls} /></Campo>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => setModalProd(false)} fullWidth>Cancelar</Button>
            <Button onClick={salvarProd} disabled={salvando} fullWidth>{salvando ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      {/* Modal movimentação */}
      <Modal isOpen={modalMov} onClose={() => setModalMov(false)} title={movTipo === 'entrada' ? `Entrada — ${movProd?.nome}` : `Saída — ${movProd?.nome}`}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Atual: <b>{Number(movProd?.quantidade_atual)} {movProd?.unidade}</b></p>
          <Campo label={`Quantidade (${movTipo === 'entrada' ? 'comprada/recebida' : 'usada/baixada'})`}><input type="number" min={0} step="0.01" value={movQtd} onChange={(e) => setMovQtd(parseFloat(e.target.value) || 0)} className={inputCls} autoFocus /></Campo>
          {movTipo === 'entrada' && <Campo label="Custo unitário desta compra (R$)"><input type="number" min={0} step="0.01" value={movCusto} onChange={(e) => setMovCusto(parseFloat(e.target.value) || 0)} className={inputCls} /></Campo>}
          <Campo label="Motivo (opcional)"><input value={movMotivo} onChange={(e) => setMovMotivo(e.target.value)} maxLength={200} className={inputCls} placeholder={movTipo === 'entrada' ? 'Ex.: Compra fornecedor X' : 'Ex.: Uso no atendimento'} /></Campo>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => setModalMov(false)} fullWidth>Cancelar</Button>
            <Button onClick={salvarMov} disabled={salvando} fullWidth>{salvando ? 'Salvando…' : 'Confirmar'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!excluir} onClose={() => setExcluir(null)} onConfirm={confirmarExcluir} title="Excluir produto" message={`Excluir "${excluir?.nome}"? Se já tem histórico, será apenas desativado.`} confirmText="Excluir" type="danger" />
    </div>
  );
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none';
function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>{children}</div>;
}
