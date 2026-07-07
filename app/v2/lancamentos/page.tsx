'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import PageShell from '@/components/v2/layout/PageShell';
import { Card } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { brl, num } from '@/lib/v2/formatters';
import { Skel } from '@/components/v2/dashboard/_shared';
import FilterBar, { ABAS } from '@/components/v2/lancamentos/FilterBar';
import LancDrawer from '@/components/v2/lancamentos/LancDrawer';
import NovoLancamentoModal from '@/components/v2/lancamentos/NovoLancamentoModal';
import PayIcon, { labelForma } from '@/components/v2/lancamentos/PayIcon';
import { Avatar, SitBadge, partesData, FILTROS_INICIAIS, type Filtros, type LancResp, type LancItem } from '@/components/v2/lancamentos/_shared';
import { getCache, setCache, invalidateCache } from '@/lib/v2/cache';

type Opt = { id: number | string; nome: string };
const LIMITES = [10, 25, 50, 100];

export default function LancamentosV2() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [buscaInput, setBuscaInput] = useState('');
  const [data, setData] = useState<LancResp | null>(null);
  const [busy, setBusy] = useState(true);
  const [erro, setErro] = useState('');
  const [colabs, setColabs] = useState<Opt[]>([]);
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [exporting, setExporting] = useState(false);
  const reqId = useRef(0);

  // debounce da busca → filtros.busca
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.busca === buscaInput ? f : { ...f, busca: buscaInput, page: 1 })), 320);
    return () => clearTimeout(t);
  }, [buscaInput]);

  const montarQS = useCallback((f: Filtros, over?: Partial<Filtros>) => {
    const x = { ...f, ...over };
    const qs = new URLSearchParams({
      periodo: x.periodo, situacao: x.situacao, forma: x.forma,
      ordenar: x.ordenar, dir: x.dir, page: String(x.page), limit: String(x.limit),
    });
    if (x.colaborador_id) qs.set('colaborador_id', x.colaborador_id);
    if (x.busca.trim()) qs.set('busca', x.busca.trim());
    if (x.periodo === 'custom') { if (x.de) qs.set('de', x.de); if (x.ate) qs.set('ate', x.ate); }
    return qs;
  }, []);

  const carregar = useCallback(async (f: Filtros) => {
    const id = ++reqId.current;
    const url = `/api/v2/lancamentos?${montarQS(f)}`;
    const cached = getCache<LancResp>(url);
    if (cached !== undefined) {
      setData(cached); // mostra na hora, sem skeleton
      if (!colabs.length) setColabs((cached.colaboradores || []).map((c: any) => ({ id: c.id, nome: c.nome })));
    }
    setBusy(true); setErro('');
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (id !== reqId.current) return;
      if (r.ok) { setData(j); setCache(url, j); if (!colabs.length) setColabs((j.colaboradores || []).map((c: any) => ({ id: c.id, nome: c.nome }))); }
      else if (cached === undefined) setErro(j.error || 'Erro ao carregar os lançamentos.');
    } catch {
      if (id === reqId.current && cached === undefined) setErro('Erro de conexão.');
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }, [montarQS, colabs.length]);

  useEffect(() => { carregar(filtros); }, [filtros, carregar]);

  // muda filtro → volta pra página 1 (exceto quando o que muda é a própria página)
  const patch = (p: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...p, ...(p.page ? {} : { page: 1 }) }));
  const aba = (p: Partial<Filtros>) => { setBuscaInput(''); setFiltros((f) => ({ ...f, ...p, busca: '', colaborador_id: '', forma: 'todas', page: 1 })); };
  const limpar = () => { setBuscaInput(''); setFiltros(FILTROS_INICIAIS); };

  const abaAtiva = useMemo(() => {
    const m = ABAS.find((a) => a.patch.periodo === filtros.periodo && a.patch.situacao === filtros.situacao);
    return m ? m.id : null;
  }, [filtros.periodo, filtros.situacao]);

  const temFiltro = filtros.colaborador_id !== '' || filtros.forma !== 'todas' || filtros.situacao !== 'todas' || filtros.busca.trim() !== '' || filtros.periodo !== 'hoje';

  const ordenarPor = (col: string) => setFiltros((f) => ({
    ...f, ordenar: col, dir: f.ordenar === col && f.dir === 'desc' ? 'asc' : 'desc', page: 1,
  }));

  // export CSV client-side, respeitando filtros (varre todas as páginas, com teto de segurança)
  const exportar = useCallback(async () => {
    if (!data) return;
    setExporting(true);
    try {
      const total = data.paginacao.total;
      const cap = Math.min(total, 5000);
      const all: LancItem[] = [];
      for (let pg = 1; all.length < cap; pg++) {
        const r = await fetch(`/api/v2/lancamentos?${montarQS(filtros, { page: pg, limit: 100 })}`, { cache: 'no-store' });
        if (!r.ok) break;
        const j: LancResp = await r.json();
        all.push(...j.itens);
        if (pg >= j.paginacao.paginas) break;
      }
      const linhas: string[] = [];
      const push = (cols: (string | number)[]) => linhas.push(cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'));
      push(['NaviBelle — Lançamentos', data.periodo.label]);
      push([]);
      push(['Data', 'Hora', 'Cliente', 'Profissional', 'Serviços', 'Valor bruto', 'Comissão', 'Taxa', 'Salão', 'Pagamento', 'Situação']);
      for (const l of all) {
        const dt = partesData(l.data, l.hora_inicio);
        push([dt.dia, dt.hora, l.cliente_nome, l.colaborador_nome, l.servicos_nomes || '', brl(l.valor_total),
          l.comissao_colaborador != null ? brl(l.comissao_colaborador) : '', l.taxa_pagamento ? brl(l.taxa_pagamento) : '',
          l.comissao_salao != null ? brl(l.comissao_salao) : '', labelForma(l.forma_pagamento), l.situacao]);
      }
      const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `navibelle-lancamentos-${filtros.periodo}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }, [data, filtros, montarQS]);

  const novo = () => setModal({ open: true, editId: null });
  const editar = (id: number) => { setDetalheId(null); setModal({ open: true, editId: id }); };

  const primeiraCarga = !data && busy;
  const K = data?.kpis, S = data?.strip, pg = data?.paginacao;
  const itens = data?.itens || [];

  return (
    <PageShell title="Lançamentos" subtitle="O que entrou, o que falta receber e o que é de cada profissional">
      <style>{CSS}</style>

      <FilterBar
        filtros={{ ...filtros, busca: buscaInput }}
        periodoLabel={data?.periodo.label || '—'}
        abaAtiva={abaAtiva}
        colaboradoras={colabs}
        temFiltro={temFiltro}
        onChange={(p) => { if ('busca' in p) setBuscaInput(p.busca as string); else patch(p); }}
        onAba={aba}
        onClear={limpar}
        onExport={exportar}
        onNovo={novo}
        exporting={exporting}
      />

      {erro && !data && <Card style={{ marginBottom: 16 }}><p style={{ margin: 0, color: 'var(--nb-bad)' }}>{erro}</p></Card>}

      {primeiraCarga ? <SkeletonLanc /> : data && (
        <div className={busy ? 'v2-busy' : undefined}>
          {/* 5 KPIs */}
          <div className="v2-kpi-grid" style={{ marginBottom: 14 }}>
            <Kpi label="Entrou (realizado)" icon="Wallet" v={K!.realizado} href="/v2/relatorios" />
            <Kpi label="Comissão das profissionais" icon="HandCoins" v={K!.comissao} href="/v2/comissoes" />
            <Kpi label="Taxas de cartão" icon="CreditCard" v={K!.taxas} href="/v2/relatorios" />
            <Kpi label="Ficou pro salão" icon="Landmark" v={K!.salao} tone="ok" destaque href="/v2/financeiro#fin-dre" />
            <Kpi label="Fiado em aberto" icon="Clock" v={K!.fiadoAberto} tone="warn" href="/v2/financeiro#fin-fiados" />
          </div>

          {/* strip de 3 blocos */}
          <div className="v2-3col" style={{ marginBottom: 16 }}>
            <Strip label="Recebido (realizado)" hint="lançamentos" icon="Banknote" v={S!.recebido} tone="ok" href="/v2/financeiro#fin-dre" />
            <Strip label="Pendente (a receber)" hint="lançamentos" icon="Hourglass" v={S!.pendente} tone="warn" href="/v2/financeiro#fin-fiados" />
            <Strip label="Ticket médio" hint="atendimentos" icon="Gauge" v={S!.ticket} />
          </div>

          {/* tabela / cards */}
          <Card pad={false}>
            {itens.length === 0 ? (
              <Vazio onNovo={novo} onLimpar={limpar} temFiltro={temFiltro} />
            ) : (
              <>
                <div className="lv2-table-wrap" style={{ overflowX: 'auto' }}>
                  <table className="nb-table lv2-table" style={{ minWidth: 980 }}>
                    <thead>
                      <tr>
                        <SortTh col="data" f={filtros} onSort={ordenarPor}>Data / hora</SortTh>
                        <SortTh col="cliente" f={filtros} onSort={ordenarPor}>Cliente</SortTh>
                        <SortTh col="profissional" f={filtros} onSort={ordenarPor}>Profissional</SortTh>
                        <th>Serviços</th>
                        <SortTh col="valor" f={filtros} onSort={ordenarPor} right>Valor</SortTh>
                        <th style={{ textAlign: 'right' }}>Comissão</th>
                        <th style={{ textAlign: 'right' }}>Taxa</th>
                        <th style={{ textAlign: 'right' }}>Salão</th>
                        <th>Pagamento</th>
                        <SortTh col="situacao" f={filtros} onSort={ordenarPor}>Situação</SortTh>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((l) => {
                        const dt = partesData(l.data, l.hora_inicio);
                        return (
                          <tr key={l.id}>
                            <td className="nb-num" style={{ whiteSpace: 'nowrap', color: 'var(--nb-ink-soft)' }}>
                              {dt.dia}{dt.hora && <span style={{ color: 'var(--nb-ink-faint)' }}> · {dt.hora}</span>}
                            </td>
                            <td style={{ fontWeight: 560, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.cliente_nome}</td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <Avatar nome={l.colaborador_nome} />
                                <span style={{ color: 'var(--nb-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{l.colaborador_nome}</span>
                              </span>
                            </td>
                            <td style={{ color: 'var(--nb-ink-soft)', maxWidth: 190 }}>
                              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.servicos_nomes || ''}>
                                {(l.servicos_nomes || '—').replace(/\s*[,;]\s*/g, ' • ')}
                              </span>
                            </td>
                            <td className="nb-num" style={{ textAlign: 'right', fontWeight: 620 }}>{brl(l.valor_total)}</td>
                            <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{l.comissao_colaborador != null ? brl(l.comissao_colaborador) : '—'}</td>
                            <td className="nb-num" style={{ textAlign: 'right', color: l.taxa_pagamento ? 'var(--nb-bad)' : 'var(--nb-ink-faint)' }}>{l.taxa_pagamento ? `−${brl(l.taxa_pagamento)}` : '—'}</td>
                            <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ok)', fontWeight: 560 }}>{l.comissao_salao != null ? brl(l.comissao_salao) : '—'}</td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--nb-ink-soft)', whiteSpace: 'nowrap' }}>
                                <span style={{ color: 'var(--nb-accent)' }}><PayIcon forma={l.forma_pagamento} /></span>
                                {labelForma(l.forma_pagamento)}
                              </span>
                            </td>
                            <td><SitBadge s={l.situacao} /></td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button className="nb-btn nb-btn-quiet lv2-act" onClick={() => setDetalheId(l.id)} aria-label="Ver detalhes"><Icon name="Search" size={16} /></button>
                              <button className="nb-btn nb-btn-quiet lv2-act" onClick={() => editar(l.id)} aria-label="Editar"><Icon name="SlidersHorizontal" size={16} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* cards (mobile) */}
                <div className="lv2-cards">
                  {itens.map((l) => {
                    const dt = partesData(l.data, l.hora_inicio);
                    return (
                      <div key={l.id} className="lv2-card" onClick={() => setDetalheId(l.id)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 620, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.cliente_nome}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--nb-ink-soft)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <Avatar nome={l.colaborador_nome} size={20} /> {l.colaborador_nome}
                            </div>
                          </div>
                          <SitBadge s={l.situacao} />
                        </div>
                        {l.servicos_nomes && <div style={{ fontSize: 12.5, color: 'var(--nb-ink-soft)', marginTop: 8 }}>{l.servicos_nomes.replace(/\s*[,;]\s*/g, ' • ')}</div>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 10 }}>
                          <Mini label="Valor" v={brl(l.valor_total)} strong />
                          <Mini label="Comissão" v={l.comissao_colaborador != null ? brl(l.comissao_colaborador) : '—'} />
                          <Mini label="Taxa" v={l.taxa_pagamento ? `−${brl(l.taxa_pagamento)}` : '—'} tone={l.taxa_pagamento ? 'bad' : undefined} />
                          <Mini label="Salão" v={l.comissao_salao != null ? brl(l.comissao_salao) : '—'} tone="ok" />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--nb-rule-soft)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--nb-ink-soft)' }}>
                            <span style={{ color: 'var(--nb-accent)' }}><PayIcon forma={l.forma_pagamento} size={15} /></span>{labelForma(l.forma_pagamento)}
                          </span>
                          <span className="nb-num" style={{ fontSize: 12, color: 'var(--nb-ink-faint)' }}>{dt.dia}{dt.hora ? ` · ${dt.hora}` : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* rodapé: total + page size + paginação */}
                {pg && (
                  <div className="lv2-foot">
                    <span className="nb-num" style={{ fontSize: 13, color: 'var(--nb-ink-soft)' }}>
                      {num(pg.total)} {pg.total === 1 ? 'lançamento' : 'lançamentos'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--nb-ink-soft)' }}>
                        Por página
                        <select className="v2-select" style={{ padding: '6px 28px 6px 10px', fontSize: 13 }} value={filtros.limit}
                          onChange={(e) => patch({ limit: Number(e.target.value) })}>
                          {LIMITES.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </label>
                      <span className="nb-num" style={{ fontSize: 12.5, color: 'var(--nb-ink-faint)' }}>Página {pg.page} de {pg.paginas}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="nb-btn nb-btn-ghost" disabled={pg.page <= 1} onClick={() => patch({ page: pg.page - 1 })} style={{ padding: '7px 11px' }} aria-label="Página anterior"><Icon name="ChevronLeft" size={16} /></button>
                        <button className="nb-btn nb-btn-ghost" disabled={pg.page >= pg.paginas} onClick={() => patch({ page: pg.page + 1 })} style={{ padding: '7px 11px' }} aria-label="Próxima página"><Icon name="ChevronRight" size={16} /></button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* legenda financeira */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--nb-ink-faint)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--nb-ink-soft)' }}>Valor</strong> = bruto do atendimento • <strong style={{ color: 'var(--nb-ink-soft)' }}>Comissão</strong> = da profissional (já sem a taxa) • <strong style={{ color: 'var(--nb-ink-soft)' }}>Taxa</strong> = da maquininha • <strong style={{ color: 'var(--nb-ink-soft)' }}>Salão</strong> = o que ficou pro salão.
            </p>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>Os valores seguem os filtros aplicados.</p>
          </div>
        </div>
      )}

      <LancDrawer id={detalheId} onClose={() => setDetalheId(null)} onEdit={editar} onChanged={() => { invalidateCache('/api/v2/'); carregar(filtros); }} />

      <NovoLancamentoModal
        open={modal.open}
        editId={modal.editId}
        onClose={() => setModal({ open: false, editId: null })}
        onSaved={() => { invalidateCache('/api/v2/'); carregar(filtros); }}
      />
    </PageShell>
  );
}

/* ---------------- KPI compacto ---------------- */
function Kpi({ label, icon, v, tone, destaque, href }: { label: string; icon: string; v: { valor: number; count: number }; tone?: 'ok' | 'warn' | 'bad'; destaque?: boolean; href?: string }) {
  const color = tone === 'ok' ? 'var(--nb-ok)' : tone === 'warn' ? 'var(--nb-warn)' : tone === 'bad' ? 'var(--nb-bad)' : 'var(--nb-ink)';
  const Root: any = href ? 'a' : 'div';
  const rootProps: any = href
    ? { href, className: 'nb-card nb-card-pad nb-card-link', 'aria-label': `${label} — ver detalhes` }
    : { className: 'nb-card nb-card-pad' };
  return (
    <Root {...rootProps} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, color: 'inherit', textDecoration: 'none', ...(destaque ? { borderColor: '#CFE1D5', background: 'linear-gradient(0deg, var(--nb-ok-bg) 0%, var(--nb-surface) 62%)' } : {}) }}>
      <span aria-hidden style={{ flex: '0 0 auto', width: 38, height: 38, borderRadius: 11, background: destaque ? 'var(--nb-ok-bg)' : 'var(--nb-accent-wash)', color: destaque ? 'var(--nb-ok)' : 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}>
        <Icon name={icon} size={18} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="nb-eyebrow" style={{ fontSize: 9.5, lineHeight: 1.3 }}>{label}</div>
        <div className="nb-num" style={{ fontSize: 20, fontWeight: 680, color, lineHeight: 1.15, letterSpacing: '-.01em' }}>{brl(v.valor)}</div>
        <div style={{ fontSize: 10.5, color: 'var(--nb-ink-faint)' }}>{num(v.count)} {v.count === 1 ? 'lançamento' : 'lançamentos'}</div>
      </div>
    </Root>
  );
}

/* ---------------- Strip (3 blocos) ---------------- */
function Strip({ label, hint, icon, v, tone, href }: { label: string; hint: string; icon: string; v: { valor: number; count: number }; tone?: 'ok' | 'warn'; href?: string }) {
  const color = tone === 'ok' ? 'var(--nb-ok)' : tone === 'warn' ? 'var(--nb-warn)' : 'var(--nb-ink)';
  const Root: any = href ? 'a' : 'div';
  const rootProps: any = href
    ? { href, className: 'nb-card nb-card-pad nb-card-link', 'aria-label': `${label} — ver detalhes` }
    : { className: 'nb-card nb-card-pad' };
  return (
    <Root {...rootProps} style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'inherit', textDecoration: 'none' }}>
      <span aria-hidden style={{ flex: '0 0 auto', width: 46, height: 46, borderRadius: 13, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}>
        <Icon name={icon} size={22} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="nb-eyebrow" style={{ fontSize: 10 }}>{label}</div>
        <div className="nb-num" style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.1, letterSpacing: '-.02em' }}>{brl(v.valor)}</div>
        <div style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{num(v.count)} {hint}</div>
      </div>
    </Root>
  );
}

/* ---------------- Cabeçalho ordenável ---------------- */
function SortTh({ col, f, onSort, right, children }: { col: string; f: Filtros; onSort: (c: string) => void; right?: boolean; children: React.ReactNode }) {
  const on = f.ordenar === col;
  return (
    <th style={{ textAlign: right ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort(col)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: on ? 'var(--nb-accent-deep)' : undefined }}>
        {right && <SortArrow on={on} dir={f.dir} />}{children}{!right && <SortArrow on={on} dir={f.dir} />}
      </span>
    </th>
  );
}
function SortArrow({ on, dir }: { on: boolean; dir: 'asc' | 'desc' }) {
  if (!on) return <Icon name="ArrowUpDown" size={12} className="nb-ink-faint" />;
  return <span style={{ display: 'inline-flex', transform: dir === 'asc' ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}><Icon name="ChevronDown" size={13} /></span>;
}

/* ---------------- Mini stat (card mobile) ---------------- */
function Mini({ label, v, strong, tone }: { label: string; v: string; strong?: boolean; tone?: 'ok' | 'bad' }) {
  const color = tone === 'ok' ? 'var(--nb-ok)' : tone === 'bad' ? 'var(--nb-bad)' : 'var(--nb-ink)';
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: 'var(--nb-ink-faint)', fontFamily: 'var(--nb-mono)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</div>
      <div className="nb-num" style={{ fontSize: strong ? 15 : 13.5, fontWeight: strong ? 660 : 560, color }}>{v}</div>
    </div>
  );
}

/* ---------------- Estado vazio ---------------- */
function Vazio({ onNovo, onLimpar, temFiltro }: { onNovo: () => void; onLimpar: () => void; temFiltro: boolean }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', textAlign: 'center', padding: '56px 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span aria-hidden style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', display: 'grid', placeItems: 'center', color: 'var(--nb-ink-faint)' }}>
          <Icon name="ReceiptText" size={24} />
        </span>
        <div style={{ fontFamily: 'var(--nb-serif)', fontSize: 18, color: 'var(--nb-ink)' }}>Nenhum lançamento encontrado</div>
        <div style={{ fontSize: 13, color: 'var(--nb-ink-faint)', maxWidth: '38ch', lineHeight: 1.5 }}>
          Não há lançamentos para este filtro. Ajuste o período, limpe os filtros ou registre um novo atendimento.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          <button className="nb-btn nb-btn-primary" onClick={onNovo} style={{ fontSize: 13 }}><Icon name="Plus" size={16} /> Criar lançamento</button>
          {temFiltro && <button className="nb-btn nb-btn-ghost" onClick={onLimpar} style={{ fontSize: 13 }}><Icon name="RotateCcw" size={15} /> Limpar filtros</button>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Skeleton ---------------- */
function SkeletonLanc() {
  return (
    <>
      <div className="v2-kpi-grid" style={{ marginBottom: 14 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="nb-card nb-card-pad" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Skel h={38} w={38} r={11} /><div style={{ flex: 1 }}><Skel h={10} w="70%" /><Skel h={22} w="55%" style={{ marginTop: 8 }} /></div>
          </div>
        ))}
      </div>
      <div className="v2-3col" style={{ marginBottom: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="nb-card nb-card-pad" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Skel h={46} w={46} r={13} /><div style={{ flex: 1 }}><Skel h={10} w="60%" /><Skel h={26} w="50%" style={{ marginTop: 8 }} /></div>
          </div>
        ))}
      </div>
      <div className="nb-card nb-card-pad">
        {Array.from({ length: 8 }).map((_, i) => <Skel key={i} h={20} style={{ marginBottom: 12 }} />)}
      </div>
    </>
  );
}

/* ---------------- CSS local (responsivo tabela → cards) ---------------- */
const CSS = `
.v2-root .lv2-cards{display:none}
.v2-root .lv2-act{padding:6px 8px;color:var(--nb-ink-soft)}
.v2-root .lv2-act:hover{color:var(--nb-accent)}
.v2-root .lv2-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 16px;border-top:1px solid var(--nb-rule)}
@media(max-width:900px){
  .v2-root .lv2-table-wrap{display:none}
  .v2-root .lv2-cards{display:flex;flex-direction:column;gap:10px;padding:12px}
  .v2-root .lv2-card{border:1px solid var(--nb-rule);border-radius:14px;background:var(--nb-surface);padding:14px;cursor:pointer;transition:border-color .15s,box-shadow .15s}
  .v2-root .lv2-card:hover{border-color:var(--nb-accent);box-shadow:var(--nb-shadow-md)}
}
`;
