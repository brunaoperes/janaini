'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Power } from 'lucide-react';
import toast from 'react-hot-toast';
import PageShell from '@/components/v2/layout/PageShell';
import { Card } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { brl, num } from '@/lib/v2/formatters';
import { Skel } from '@/components/v2/dashboard/_shared';
import FilterBar from '@/components/v2/servicos/FilterBar';
import ServicoDrawer from '@/components/v2/servicos/ServicoDrawer';
import ServicoModal from '@/components/v2/servicos/ServicoModal';
import MaisVendidos from '@/components/v2/servicos/MaisVendidos';
import {
  CategoriaIcon, CatBadge, StatusBadge, ExclBadge, dataBR,
  FILTROS_INICIAIS, LIMITES, type Filtros, type ServResp, type ServicoItem,
} from '@/components/v2/servicos/_shared';
import { LABEL_CAT } from '@/components/v2/servicos/categoria';

export default function ServicosV2() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [buscaInput, setBuscaInput] = useState('');
  const [data, setData] = useState<ServResp | null>(null);
  const [busy, setBusy] = useState(true);
  const [erro, setErro] = useState('');
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalServico, setModalServico] = useState<ServicoItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const reqId = useRef(0);

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.busca === buscaInput ? f : { ...f, busca: buscaInput, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [buscaInput]);

  const montarQS = useCallback((f: Filtros, over?: Partial<Filtros>) => {
    const x = { ...f, ...over };
    const qs = new URLSearchParams({
      categoria: x.categoria, status: x.status, exclusividade: x.exclusividade,
      ordenar: x.ordenar, page: String(x.page), limit: String(x.limit),
    });
    if (x.busca.trim()) qs.set('busca', x.busca.trim());
    if (x.precoMin) qs.set('precoMin', x.precoMin);
    if (x.precoMax) qs.set('precoMax', x.precoMax);
    if (x.duracaoMin) qs.set('duracaoMin', x.duracaoMin);
    if (x.duracaoMax) qs.set('duracaoMax', x.duracaoMax);
    return qs;
  }, []);

  const carregar = useCallback(async (f: Filtros) => {
    const id = ++reqId.current;
    setBusy(true); setErro('');
    try {
      const r = await fetch(`/api/v2/servicos?${montarQS(f)}`, { cache: 'no-store' });
      const j = await r.json();
      if (id !== reqId.current) return;
      if (r.ok) setData(j); else setErro(j.error || 'Erro ao carregar os serviços.');
    } catch {
      if (id === reqId.current) setErro('Erro de conexão.');
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }, [montarQS]);

  useEffect(() => { carregar(filtros); }, [filtros, carregar]);

  const recarregar = () => carregar(filtros);

  // muda filtro → volta pra página 1 (exceto quando muda só a página)
  const patch = (p: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...p, ...(p.page ? {} : { page: 1 }) }));
  const limpar = () => { setBuscaInput(''); setFiltros(FILTROS_INICIAIS); };

  const temFiltro = filtros.status !== 'todos' || filtros.exclusividade !== 'todos' || filtros.busca.trim() !== ''
    || filtros.categoria !== 'todos' || filtros.precoMin !== '' || filtros.precoMax !== '' || filtros.duracaoMin !== '' || filtros.duracaoMax !== '';

  // ---- ações ----
  const abrirNovo = () => { setModalServico(null); setModalAberto(true); };
  const abrirEdicao = (s: ServicoItem) => { setModalServico(s); setModalAberto(true); setDrawerId(null); };

  const duplicar = async (s: ServicoItem) => {
    try {
      const r = await fetch('/api/v2/servicos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: `${s.nome} (Cópia)`, duracao_minutos: s.duracao_minutos, valor: s.valor,
          descricao: s.descricao ?? undefined, ativo: s.ativo, dono_colaborador_id: s.dono_colaborador_id,
        }),
      });
      const j = await r.json();
      if (r.ok) { toast.success('Serviço duplicado!'); setDrawerId(null); recarregar(); }
      else toast.error(j.error || 'Não foi possível duplicar.');
    } catch { toast.error('Erro de conexão.'); }
  };

  const alternarAtivo = async (s: ServicoItem) => {
    try {
      const r = await fetch(`/api/v2/servicos?id=${s.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: s.nome, duracao_minutos: s.duracao_minutos, valor: s.valor, descricao: s.descricao ?? undefined, ativo: !s.ativo, dono_colaborador_id: s.dono_colaborador_id }),
      });
      const j = await r.json();
      if (r.ok) { toast.success(!s.ativo ? 'Serviço ativado.' : 'Serviço desativado.'); recarregar(); }
      else toast.error(j.error || 'Não foi possível alterar.');
    } catch { toast.error('Erro de conexão.'); }
  };

  // export CSV (respeita filtros, varre páginas com teto)
  const exportar = useCallback(async () => {
    if (!data) return;
    setExporting(true);
    try {
      const cap = Math.min(data.paginacao.total, 5000);
      const all: ServicoItem[] = [];
      for (let pg = 1; all.length < cap; pg++) {
        const r = await fetch(`/api/v2/servicos?${montarQS(filtros, { page: pg, limit: 50 })}`, { cache: 'no-store' });
        if (!r.ok) break;
        const j: ServResp = await r.json();
        all.push(...j.itens);
        if (pg >= j.paginacao.paginas) break;
      }
      const linhas: string[] = [];
      const push = (cols: (string | number)[]) => linhas.push(cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'));
      push(['NaviBelle — Serviços']);
      push([]);
      push(['Nome', 'Categoria', 'Duração (min)', 'Valor', 'Comissão', 'Exclusividade', 'Status', 'Vendas', 'Receita']);
      for (const s of all) {
        push([s.nome, LABEL_CAT[s.categoria], s.duracao_minutos, brl(s.valor), 'Por profissional',
          s.dona_nome ? `Exclusivo: ${s.dona_nome}` : 'Geral', s.ativo ? 'Ativo' : 'Inativo', s.vendas.qtd, brl(s.vendas.receita)]);
      }
      const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'navibelle-servicos.csv';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }, [data, filtros, montarQS]);

  const primeiraCarga = !data && busy;
  const K = data?.kpis, pg = data?.paginacao;
  const itens = data?.itens || [];
  const de = pg && pg.total ? (pg.page - 1) * pg.limit + 1 : 0;
  const ate = pg ? Math.min(pg.page * pg.limit, pg.total) : 0;

  return (
    <PageShell title="Serviços" subtitle="Catálogo do salão e das profissionais">
      <style>{CSS}</style>

      <FilterBar
        filtros={{ ...filtros, busca: buscaInput }}
        temFiltro={temFiltro}
        onChange={(p) => { if ('busca' in p) setBuscaInput(p.busca as string); else patch(p); }}
        onClear={limpar}
        onExport={exportar}
        onNovo={abrirNovo}
        exporting={exporting}
      />

      {erro && !data && <Card style={{ marginBottom: 16 }}><p style={{ margin: 0, color: 'var(--nb-bad)' }}>{erro} <button className="nb-btn nb-btn-ghost" onClick={recarregar} style={{ marginLeft: 8, padding: '6px 12px' }}>Tentar de novo</button></p></Card>}

      {primeiraCarga ? <SkeletonServicos /> : data && (
        <div className={busy ? 'v2-busy' : undefined}>
          {/* 4 KPIs */}
          <div className="sv-kpis" style={{ marginBottom: 14 }}>
            <Kpi label="Total de serviços" icon="Scissors" valor={num(K!.total)} hint={`${num(K!.ativos)} ativos`} />
            <Kpi label="Ticket médio (ativos)" icon="Coins" valor={brl(K!.ticketMedioAtivos)} hint="preço médio" />
            <Kpi label="Duração média (ativos)" icon="Timer" valor={`${num(K!.duracaoMediaAtivos)} min`} hint="por atendimento" />
            <Kpi label="Serviços ativos" icon="CircleCheck" valor={num(K!.ativos)} hint={`${num(K!.pctAtivos)}% do catálogo`} tone="ok" />
          </div>

          {/* chips de categoria */}
          <div className="sv-chips">
            {data.categorias.map((c) => {
              const on = filtros.categoria === c.id;
              return (
                <button key={c.id} onClick={() => patch({ categoria: c.id })}
                  className={`sv-chip ${on ? 'is-on' : ''}`}>
                  {c.id !== 'todos' && <span className="sv-chip-ic"><CategoriaIcon cat={c.id} size={14} /></span>}
                  {c.label}
                  <span className="sv-chip-n nb-num">{num(c.count)}</span>
                </button>
              );
            })}
          </div>

          <div className="sv-layout">
            {/* tabela / cards */}
            <Card pad={false}>
              {itens.length === 0 ? (
                <Vazio temFiltro={temFiltro} onNovo={abrirNovo} onLimpar={limpar} />
              ) : (
                <>
                  <div className="sv-table-wrap" style={{ overflowX: 'auto' }}>
                    <table className="nb-table sv-table" style={{ minWidth: 920 }}>
                      <thead>
                        <tr>
                          <th>Serviço</th>
                          <th>Categoria</th>
                          <th style={{ textAlign: 'right' }}>Duração</th>
                          <th style={{ textAlign: 'right' }}>Valor</th>
                          <th>Comissão</th>
                          <th>Exclusividade</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((s) => (
                          <tr key={s.id} style={{ opacity: s.ativo ? 1 : 0.62, cursor: 'pointer' }} onClick={() => setDrawerId(s.id)}>
                            <td style={{ maxWidth: 260 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <span aria-hidden style={{ flex: '0 0 auto', width: 32, height: 32, borderRadius: 9, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}>
                                  <CategoriaIcon cat={s.categoria} size={16} />
                                </span>
                                <span style={{ minWidth: 0 }}>
                                  <span style={{ display: 'block', fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.nome}>{s.nome}</span>
                                  {s.descricao && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--nb-ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }} title={s.descricao}>{s.descricao}</span>}
                                </span>
                              </span>
                            </td>
                            <td><CatBadge cat={s.categoria} /></td>
                            <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)', whiteSpace: 'nowrap' }}>{num(s.duracao_minutos)} min</td>
                            <td className="nb-num" style={{ textAlign: 'right', fontWeight: 620 }}>{brl(s.valor)}</td>
                            <td style={{ fontSize: 12.5, color: 'var(--nb-ink-faint)', whiteSpace: 'nowrap' }}>Por profissional</td>
                            <td>{s.dono_colaborador_id == null ? <span className="nb-badge nb-info">Geral</span> : <ExclBadge nome={s.dona_nome} />}</td>
                            <td><StatusBadge ativo={s.ativo} /></td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                              <button className="nb-btn nb-btn-quiet sv-act" title="Ver detalhes" aria-label="Ver detalhes" onClick={() => setDrawerId(s.id)}><Icon name="Search" size={15} /></button>
                              <button className="nb-btn nb-btn-quiet sv-act" title="Editar" aria-label="Editar" onClick={() => abrirEdicao(s)}><Icon name="SlidersHorizontal" size={15} /></button>
                              <button className="nb-btn nb-btn-quiet sv-act" title="Duplicar" aria-label="Duplicar" onClick={() => duplicar(s)}><Icon name="Package" size={15} /></button>
                              <button className="nb-btn nb-btn-quiet sv-act" title={s.ativo ? 'Inativar' : 'Ativar'} aria-label={s.ativo ? 'Inativar' : 'Ativar'} onClick={() => alternarAtivo(s)} style={{ color: s.ativo ? 'var(--nb-bad)' : 'var(--nb-ok)' }}><Power size={15} strokeWidth={1.75} aria-hidden /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* cards (mobile) */}
                  <div className="sv-cards">
                    {itens.map((s) => (
                      <div key={s.id} className="sv-card" style={{ opacity: s.ativo ? 1 : 0.66 }} onClick={() => setDrawerId(s.id)}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span aria-hidden style={{ flex: '0 0 auto', width: 36, height: 36, borderRadius: 10, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}>
                            <CategoriaIcon cat={s.categoria} size={18} />
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 620, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nome}</div>
                            {s.descricao && <div style={{ fontSize: 12, color: 'var(--nb-ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.descricao}</div>}
                          </div>
                          <StatusBadge ativo={s.ativo} />
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 10 }}>
                          <Mini label="Valor" v={brl(s.valor)} strong />
                          <Mini label="Duração" v={`${num(s.duracao_minutos)} min`} />
                          <Mini label="Categoria" v={LABEL_CAT[s.categoria]} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--nb-rule-soft)' }}>
                          {s.dono_colaborador_id == null ? <span className="nb-badge nb-info">Geral</span> : <ExclBadge nome={s.dona_nome} />}
                          <span style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                            <button className="nb-btn nb-btn-quiet sv-act" aria-label="Editar" onClick={() => abrirEdicao(s)}><Icon name="SlidersHorizontal" size={16} /></button>
                            <button className="nb-btn nb-btn-quiet sv-act" aria-label="Duplicar" onClick={() => duplicar(s)}><Icon name="Package" size={16} /></button>
                            <button className="nb-btn nb-btn-quiet sv-act" aria-label={s.ativo ? 'Inativar' : 'Ativar'} onClick={() => alternarAtivo(s)} style={{ color: s.ativo ? 'var(--nb-bad)' : 'var(--nb-ok)' }}><Power size={16} strokeWidth={1.75} aria-hidden /></button>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* rodapé: mostrando X–Y de N + page-size + paginação */}
                  {pg && (
                    <div className="sv-foot">
                      <span className="nb-num" style={{ fontSize: 13, color: 'var(--nb-ink-soft)' }}>
                        Mostrando {num(de)}–{num(ate)} de {num(pg.total)} {pg.total === 1 ? 'serviço' : 'serviços'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--nb-ink-soft)' }}>
                          Por página
                          <select className="v2-select" style={{ padding: '6px 28px 6px 10px', fontSize: 13 }} value={filtros.limit} onChange={(e) => patch({ limit: Number(e.target.value) })}>
                            {LIMITES.map((x) => <option key={x} value={x}>{x}</option>)}
                          </select>
                        </label>
                        <Paginacao page={pg.page} paginas={pg.paginas} onGo={(x) => patch({ page: x })} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* lateral: mais vendidos */}
            <div className="sv-side">
              <MaisVendidos itens={data.maisVendidos} semHistorico={data.semHistorico} onSelect={(id) => setDrawerId(id)} />
              <p style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', lineHeight: 1.55, marginTop: 12 }}>
                <strong style={{ color: 'var(--nb-ink-soft)' }}>Categoria</strong> é sugerida automaticamente pelo nome do serviço. A <strong style={{ color: 'var(--nb-ink-soft)' }}>comissão</strong> vem da profissional, não do serviço.
              </p>
            </div>
          </div>
        </div>
      )}

      <ServicoDrawer id={drawerId} onClose={() => setDrawerId(null)} onEditar={abrirEdicao} onDuplicar={duplicar} onToggle={alternarAtivo} />
      <ServicoModal
        aberto={modalAberto}
        servico={modalServico}
        colaboradoras={data?.colaboradoras || []}
        nomesExistentes={data?.nomesTodos || []}
        onClose={() => setModalAberto(false)}
        onSaved={recarregar}
      />
    </PageShell>
  );
}

/* ---------------- KPI ---------------- */
function Kpi({ label, icon, valor, hint, tone }: { label: string; icon: string; valor: string; hint: string; tone?: 'ok' }) {
  const color = tone === 'ok' ? 'var(--nb-ok)' : 'var(--nb-ink)';
  return (
    <div className="nb-card nb-card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <span aria-hidden style={{ flex: '0 0 auto', width: 38, height: 38, borderRadius: 11, background: tone === 'ok' ? 'var(--nb-ok-bg)' : 'var(--nb-accent-wash)', color: tone === 'ok' ? 'var(--nb-ok)' : 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}>
        <Icon name={icon} size={18} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="nb-eyebrow" style={{ fontSize: 9.5, lineHeight: 1.3 }}>{label}</div>
        <div className="nb-num" style={{ fontSize: 20, fontWeight: 680, color, lineHeight: 1.15, letterSpacing: '-.01em' }}>{valor}</div>
        <div style={{ fontSize: 10.5, color: 'var(--nb-ink-faint)' }}>{hint}</div>
      </div>
    </div>
  );
}

/* ---------------- Paginação numerada ---------------- */
function Paginacao({ page, paginas, onGo }: { page: number; paginas: number; onGo: (p: number) => void }) {
  const nums = useMemo(() => {
    const out: (number | '…')[] = [];
    const add = (x: number | '…') => out.push(x);
    if (paginas <= 7) { for (let i = 1; i <= paginas; i++) add(i); return out; }
    add(1);
    const start = Math.max(2, page - 1), end = Math.min(paginas - 1, page + 1);
    if (start > 2) add('…');
    for (let i = start; i <= end; i++) add(i);
    if (end < paginas - 1) add('…');
    add(paginas);
    return out;
  }, [page, paginas]);

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <button className="nb-btn nb-btn-ghost" disabled={page <= 1} onClick={() => onGo(page - 1)} style={{ padding: '7px 10px' }} aria-label="Página anterior"><Icon name="ChevronLeft" size={16} /></button>
      {nums.map((x, i) => x === '…'
        ? <span key={`e${i}`} style={{ color: 'var(--nb-ink-faint)', padding: '0 4px' }}>…</span>
        : <button key={x} onClick={() => onGo(x)} className={`nb-btn ${x === page ? 'nb-btn-primary' : 'nb-btn-ghost'}`} style={{ padding: '7px 11px', minWidth: 36, justifyContent: 'center' }} aria-current={x === page ? 'page' : undefined}>{x}</button>)}
      <button className="nb-btn nb-btn-ghost" disabled={page >= paginas} onClick={() => onGo(page + 1)} style={{ padding: '7px 10px' }} aria-label="Próxima página"><Icon name="ChevronRight" size={16} /></button>
    </div>
  );
}

/* ---------------- Mini stat (card mobile) ---------------- */
function Mini({ label, v, strong }: { label: string; v: string; strong?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: 'var(--nb-ink-faint)', fontFamily: 'var(--nb-mono)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</div>
      <div className="nb-num" style={{ fontSize: strong ? 15 : 13.5, fontWeight: strong ? 660 : 560, color: 'var(--nb-ink)' }}>{v}</div>
    </div>
  );
}

/* ---------------- Estado vazio ---------------- */
function Vazio({ temFiltro, onNovo, onLimpar }: { temFiltro: boolean; onNovo: () => void; onLimpar: () => void }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', textAlign: 'center', padding: '56px 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span aria-hidden style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', display: 'grid', placeItems: 'center', color: 'var(--nb-ink-faint)' }}>
          <Icon name="Scissors" size={24} />
        </span>
        <div style={{ fontFamily: 'var(--nb-serif)', fontSize: 18, color: 'var(--nb-ink)' }}>{temFiltro ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}</div>
        <div style={{ fontSize: 13, color: 'var(--nb-ink-faint)', maxWidth: '38ch', lineHeight: 1.5 }}>
          {temFiltro ? 'Nenhum serviço bate com os filtros atuais. Ajuste a busca ou limpe os filtros.' : 'Cadastre o primeiro serviço do catálogo para começar.'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          <button className="nb-btn nb-btn-primary" onClick={onNovo} style={{ fontSize: 13 }}><Icon name="Plus" size={16} /> Novo serviço</button>
          {temFiltro && <button className="nb-btn nb-btn-ghost" onClick={onLimpar} style={{ fontSize: 13 }}><Icon name="RotateCcw" size={15} /> Limpar filtros</button>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Skeleton ---------------- */
function SkeletonServicos() {
  return (
    <>
      <div className="sv-kpis" style={{ marginBottom: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="nb-card nb-card-pad" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Skel h={38} w={38} r={11} /><div style={{ flex: 1 }}><Skel h={10} w="70%" /><Skel h={22} w="55%" style={{ marginTop: 8 }} /></div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Array.from({ length: 6 }).map((_, i) => <Skel key={i} h={32} w={92} r={20} />)}
      </div>
      <div className="nb-card nb-card-pad">
        {Array.from({ length: 8 }).map((_, i) => <Skel key={i} h={22} style={{ marginBottom: 12 }} />)}
      </div>
    </>
  );
}

/* ---------------- CSS local ---------------- */
const CSS = `
.v2-root .sv-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.v2-root .sv-chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:16px;scrollbar-width:thin}
.v2-root .sv-chip{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;flex:0 0 auto;border:1px solid var(--nb-rule);background:var(--nb-surface);color:var(--nb-ink-soft);border-radius:22px;padding:8px 12px;font-size:13px;font-weight:560;cursor:pointer;transition:background .15s,color .15s,border-color .15s}
.v2-root .sv-chip:hover{border-color:var(--nb-ink-faint);color:var(--nb-ink)}
.v2-root .sv-chip.is-on{background:var(--nb-accent);border-color:var(--nb-accent);color:#fff}
.v2-root .sv-chip.is-on .sv-chip-ic{color:#fff}
.v2-root .sv-chip-ic{display:inline-flex;color:var(--nb-accent)}
.v2-root .sv-chip-n{font-size:11.5px;background:var(--nb-surface-2);color:var(--nb-ink-soft);border-radius:20px;padding:1px 7px;min-width:20px;text-align:center}
.v2-root .sv-chip.is-on .sv-chip-n{background:rgba(255,255,255,.22);color:#fff}
.v2-root .sv-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
.v2-root .sv-side{position:sticky;top:16px}
.v2-root .sv-cards{display:none}
.v2-root .sv-act{padding:6px 8px;color:var(--nb-ink-soft)}
.v2-root .sv-act:hover{color:var(--nb-accent)}
.v2-root .sv-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 16px;border-top:1px solid var(--nb-rule)}
@media(max-width:1100px){.v2-root .sv-layout{grid-template-columns:minmax(0,1fr)}.v2-root .sv-side{position:static;order:2}}
@media(max-width:900px){.v2-root .sv-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:820px){
  .v2-root .sv-table-wrap{display:none}
  .v2-root .sv-cards{display:flex;flex-direction:column;gap:10px;padding:12px}
  .v2-root .sv-card{border:1px solid var(--nb-rule);border-radius:14px;background:var(--nb-surface);padding:14px;cursor:pointer;transition:border-color .15s,box-shadow .15s}
  .v2-root .sv-card:hover{border-color:var(--nb-accent);box-shadow:var(--nb-shadow-md)}
}
@media(max-width:520px){.v2-root .sv-kpis{grid-template-columns:1fr}}
`;
