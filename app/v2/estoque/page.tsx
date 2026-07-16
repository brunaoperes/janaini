'use client';

import { useEffect, useState, useCallback } from 'react';
import PageShell from '@/components/v2/layout/PageShell';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Badge from '@/components/v2/ui/Badge';
import Icon from '@/components/v2/ui/Icon';
import Button from '@/components/v2/ui/Button';
import Portal from '@/components/v2/ui/Portal';
import { brl, num } from '@/lib/v2/formatters';
import toast from 'react-hot-toast';

type Produto = {
  id: number; nome: string; categoria: string | null; unidade: string | null; tipo: string | null;
  quantidade_atual: number; estoque_minimo: number; custo_unitario: number; preco_venda: number | null; ativo: boolean;
};
type Contadores = { total: number; emReposicao: number; valorEstoque: number };

const precisaRepor = (p: Produto) => (Number(p.quantidade_atual) || 0) <= (Number(p.estoque_minimo) || 0);

export default function EstoqueV2() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [contadores, setContadores] = useState<Contadores | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);
  const [movProduto, setMovProduto] = useState<Produto | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true); setErro(false);
    try {
      const r = await fetch('/api/admin/produtos', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) { setProdutos(j.produtos || []); setContadores(j.contadores || null); }
      else setErro(true);
    } catch { setErro(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const total = contadores?.total ?? produtos.length;
  const emReposicao = contadores?.emReposicao ?? produtos.filter(precisaRepor).length;
  const valorEstoque = contadores?.valorEstoque ?? produtos.reduce((s, p) => s + (Number(p.quantidade_atual) || 0) * (Number(p.custo_unitario) || 0), 0);

  const actions = <Button icon="Plus" onClick={() => setNovoAberto(true)}>Novo produto</Button>;

  return (
    <PageShell title="Estoque" subtitle="Produtos, reposição e movimentações" actions={actions}>
      <style dangerouslySetInnerHTML={{ __html: `
        .est-kpis { display: grid; gap: 12px; grid-template-columns: repeat(3,minmax(0,1fr)); }
        @media (max-width: 640px) {
          .est-kpis { grid-template-columns: 1fr !important; }
          .est-table-wrap { -webkit-overflow-scrolling: touch; }
        }
      ` }} />
      <div className="est-kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Total de produtos" value={num(total)} icon="Package" />
        <Kpi label="Precisam repor" value={num(emReposicao)} icon="CircleAlert" tone={emReposicao > 0 ? 'bad' : undefined} />
        <Kpi label="Valor em estoque" value={brl(valorEstoque)} icon="Wallet" />
      </div>

      <Card pad={false}>
        <div style={{ padding: '18px 20px 0' }}>
          <CardHead title="Produtos" right={<span className="nb-eyebrow">{produtos.length} item{produtos.length !== 1 ? 's' : ''}</span>} />
        </div>
        <div className="est-table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="nb-table" style={{ minWidth: 780 }}>
            <thead>
              <tr>
                <th>Nome</th><th>Categoria</th>
                <th style={{ textAlign: 'right' }}>Qtd atual</th>
                <th style={{ textAlign: 'right' }}>Mínimo</th>
                <th>Reposição</th>
                <th style={{ textAlign: 'right' }}>Custo</th>
                <th style={{ textAlign: 'right' }}>Preço venda</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--nb-ink-faint)' }}>Carregando…</td></tr>
              ) : erro ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--nb-bad)' }}>
                  Não foi possível carregar os produtos. <button className="nb-btn nb-btn-quiet" onClick={carregar} style={{ marginLeft: 8 }}>Tentar de novo</button>
                </td></tr>
              ) : produtos.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--nb-ink-faint)' }}>Nenhum produto cadastrado ainda.</td></tr>
              ) : produtos.map((p) => {
                const repor = precisaRepor(p);
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 560 }}>{p.nome}</td>
                    <td style={{ color: 'var(--nb-ink-soft)' }}>{p.categoria || '—'}</td>
                    <td className="nb-num" style={{ textAlign: 'right', fontWeight: 600, color: repor ? 'var(--nb-bad)' : 'var(--nb-ink)' }}>{num(p.quantidade_atual)} {p.unidade || ''}</td>
                    <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{num(p.estoque_minimo)}</td>
                    <td>{repor ? <Badge status="atrasado">Repor</Badge> : <Badge status="concluido">OK</Badge>}</td>
                    <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{brl(p.custo_unitario)}</td>
                    <td className="nb-num" style={{ textAlign: 'right', fontWeight: 560 }}>{p.preco_venda != null ? brl(p.preco_venda) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="nb-btn nb-btn-ghost" style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={() => setMovProduto(p)}>
                        <Icon name="SlidersHorizontal" size={14} /> Movimentar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p style={{ fontSize: 12, color: 'var(--nb-ink-faint)', marginTop: 14 }}>
        “Repor” aparece quando a quantidade atual está no mínimo ou abaixo. Movimentar registra entrada, saída ou ajuste e atualiza o estoque — o custo entra por média ponderada. Mesma base do módulo de produtos em produção.
      </p>

      {novoAberto && <NovoProdutoModal onClose={() => setNovoAberto(false)} onSaved={() => { setNovoAberto(false); carregar(); }} />}
      {movProduto && <MovimentarModal produto={movProduto} onClose={() => setMovProduto(null)} onSaved={() => { setMovProduto(null); carregar(); }} />}
    </PageShell>
  );
}

/* ---------------- KPI ---------------- */
function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: 'bad' }) {
  const cor = tone === 'bad' ? 'var(--nb-bad)' : 'var(--nb-ink)';
  const iconBg = tone === 'bad' ? 'var(--nb-bad-bg)' : 'var(--nb-accent-wash)';
  const iconCor = tone === 'bad' ? 'var(--nb-bad)' : 'var(--nb-accent)';
  return (
    <div className="nb-card nb-card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, color: iconCor, display: 'grid', placeItems: 'center' }}><Icon name={icon} size={18} /></span>
      <div><div className="nb-eyebrow" style={{ fontSize: 10 }}>{label}</div><div className="nb-num" style={{ fontSize: 20, fontWeight: 680, color: cor, lineHeight: 1.1 }}>{value}</div></div>
    </div>
  );
}

/* ---------------- Modal base ---------------- */
function Overlay({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <Portal>
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(33,28,25,.42)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="nb-card"
        style={{ width: 'min(480px,100%)', maxHeight: '90dvh', overflowY: 'auto', boxShadow: 'var(--nb-shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--nb-rule-soft)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 640, color: 'var(--nb-ink)' }}>{title}</h3>
            {subtitle && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--nb-ink-faint)' }}>{subtitle}</p>}
          </div>
          <button className="nb-btn nb-btn-quiet" onClick={onClose} style={{ padding: 7 }} aria-label="Fechar"><Icon name="X" size={16} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, padding: '0 20px 20px' }}>{footer}</div>
      </div>
    </div>
    </Portal>
  );
}

function Campo({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--nb-ink-faint)', marginTop: 5 }}>{hint}</span>}
    </label>
  );
}

/* ---------------- Novo produto ---------------- */
function NovoProdutoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ nome: '', categoria: '', unidade: 'un', quantidade_atual: '', estoque_minimo: '', custo_unitario: '', preco_venda: '' });
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const salvar = async () => {
    if (f.nome.trim().length < 2) { toast.error('Informe o nome do produto.'); return; }
    setSalvando(true);
    try {
      const r = await fetch('/api/admin/produtos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: f.nome.trim(), categoria: f.categoria.trim() || null, unidade: f.unidade.trim() || 'un',
          quantidade_atual: Number(f.quantidade_atual) || 0, estoque_minimo: Number(f.estoque_minimo) || 0,
          custo_unitario: Number(f.custo_unitario) || 0, preco_venda: f.preco_venda === '' ? null : Number(f.preco_venda),
        }),
      });
      if (r.ok) { toast.success('Produto cadastrado!'); onSaved(); }
      else toast.error((await r.json()).error || 'Erro ao salvar.');
    } catch { toast.error('Erro de conexão.'); } finally { setSalvando(false); }
  };

  return (
    <Overlay title="Novo produto" subtitle="Cadastro rápido com estoque inicial" onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
        <Button icon="Check" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar produto'}</Button>
      </>}>
      <Campo label="Nome"><input className="nb-input" value={f.nome} onChange={set('nome')} placeholder="Ex.: Shampoo hidratante 1L" autoFocus /></Campo>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
        <Campo label="Categoria"><input className="nb-input" value={f.categoria} onChange={set('categoria')} placeholder="Ex.: Cabelo" /></Campo>
        <Campo label="Unidade"><input className="nb-input" value={f.unidade} onChange={set('unidade')} placeholder="un" /></Campo>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Quantidade inicial"><input type="number" min={0} step="0.01" className="nb-input nb-num" value={f.quantidade_atual} onChange={set('quantidade_atual')} placeholder="0" /></Campo>
        <Campo label="Estoque mínimo"><input type="number" min={0} step="0.01" className="nb-input nb-num" value={f.estoque_minimo} onChange={set('estoque_minimo')} placeholder="0" /></Campo>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Custo unitário (R$)"><input type="number" min={0} step="0.01" className="nb-input nb-num" value={f.custo_unitario} onChange={set('custo_unitario')} placeholder="0,00" /></Campo>
        <Campo label="Preço de venda (R$)"><input type="number" min={0} step="0.01" className="nb-input nb-num" value={f.preco_venda} onChange={set('preco_venda')} placeholder="opcional" /></Campo>
      </div>
    </Overlay>
  );
}

/* ---------------- Movimentar ---------------- */
const TIPOS = [
  { id: 'entrada', label: 'Entrada' },
  { id: 'saida', label: 'Saída' },
  { id: 'ajuste', label: 'Ajuste' },
];
function MovimentarModal({ produto, onClose, onSaved }: { produto: Produto; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [quantidade, setQuantidade] = useState('');
  const [custo, setCusto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const qtd = Number(quantidade);
    if (isNaN(qtd) || (tipo !== 'ajuste' && qtd <= 0) || qtd < 0) { toast.error('Informe uma quantidade válida.'); return; }
    setSalvando(true);
    try {
      const body: Record<string, unknown> = { acao: 'movimentar', produto_id: produto.id, tipo, quantidade: qtd, motivo: motivo.trim() || null };
      if (tipo === 'entrada' && custo !== '') body.custo_unitario = Number(custo);
      const r = await fetch('/api/admin/produtos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok) { toast.success(j.message || 'Estoque atualizado!'); onSaved(); }
      else toast.error(j.error || 'Erro ao movimentar.');
    } catch { toast.error('Erro de conexão.'); } finally { setSalvando(false); }
  };

  return (
    <Overlay title={`Movimentar — ${produto.nome}`} subtitle={`Atual: ${num(produto.quantidade_atual)} ${produto.unidade || ''}`} onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
        <Button icon="Check" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Registrar'}</Button>
      </>}>
      <Campo label="Tipo de movimentação">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {TIPOS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTipo(t.id as typeof tipo)}
              className={`nb-btn ${tipo === t.id ? 'nb-btn-primary' : 'nb-btn-ghost'}`}
              style={{ justifyContent: 'center', padding: '9px 8px' }}>{t.label}</button>
          ))}
        </div>
      </Campo>
      <Campo label={tipo === 'ajuste' ? 'Quantidade contada (nova)' : 'Quantidade'} hint={tipo === 'ajuste' ? 'Define o total em estoque para o valor contado.' : tipo === 'saida' ? 'Será subtraída do estoque.' : 'Será somada ao estoque.'}>
        <input type="number" min={0} step="0.01" className="nb-input nb-num" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0" autoFocus />
      </Campo>
      {tipo === 'entrada' && (
        <Campo label="Custo unitário desta entrada (R$)" hint="Opcional — recalcula o custo médio do produto.">
          <input type="number" min={0} step="0.01" className="nb-input nb-num" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder={brl(produto.custo_unitario)} />
        </Campo>
      )}
      <Campo label="Motivo (opcional)">
        <input className="nb-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: compra do fornecedor, uso interno…" />
      </Campo>
    </Overlay>
  );
}
