'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import PageShell from '@/components/v2/layout/PageShell';
import { Card } from '@/components/v2/ui/Card';
import Button from '@/components/v2/ui/Button';
import Icon from '@/components/v2/ui/Icon';
import { brl, num, pct, iniciais, mesExtenso } from '@/lib/v2/formatters';
import { Delta, Skel, EmptyState } from '@/components/v2/dashboard/_shared';
import FiltrosBar from '@/components/v2/colaboradoras/Filtros';
import ColabCard from '@/components/v2/colaboradoras/ColabCard';
import Lateral from '@/components/v2/colaboradoras/Lateral';
import DesempenhoDrawer from '@/components/v2/colaboradoras/DesempenhoDrawer';
import { aplicarFiltros, FILTROS_PADRAO, type Colab, type ColabResp, type Filtros, type DistItem } from '@/components/v2/colaboradoras/types';
import { getCache, setCache, invalidateCache } from '@/lib/v2/cache';

const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

export default function ColaboradorasV2() {
  const [mes, setMes] = useState(mesAtual());
  const [data, setData] = useState<ColabResp | null>(null);
  const [busy, setBusy] = useState(true);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO);
  const [form, setForm] = useState<{ aberto: boolean; editando: Colab | null }>({ aberto: false, editando: null });
  const [desempenho, setDesempenho] = useState<Colab | null>(null);
  const reqId = useRef(0);

  const carregar = useCallback(async (m: string) => {
    const id = ++reqId.current;
    const url = `/api/v2/colaboradoras?mes=${m}`;
    const cached = getCache<ColabResp>(url);
    if (cached !== undefined) setData(cached); // mostra na hora, sem skeleton
    setBusy(true); setErro('');
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (id !== reqId.current) return;
      if (r.ok) { setData(j); setCache(url, j); }
      else if (cached === undefined) setErro(j.error || 'Erro ao carregar a equipe.');
    } catch {
      if (id === reqId.current && cached === undefined) setErro('Erro de conexão.');
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }, []);
  useEffect(() => { carregar(mes); }, [mes, carregar]);

  const colabs = data?.colaboradoras ?? [];
  const funcoes = useMemo(() => Array.from(new Set(colabs.map((c) => c.funcao || 'Sem função definida'))).sort(), [colabs]);

  // ---- derivações client-side (grid + ranking + agenda + insights reagem sem reload) ----
  const filtradas = useMemo(() => aplicarFiltros(colabs, filtros), [colabs, filtros]);
  const derivado = useMemo(() => {
    const totFat = filtradas.reduce((s, c) => s + c.faturamento, 0);
    const totAtend = filtradas.reduce((s, c) => s + c.atendimentos, 0);
    const ranking = filtradas.filter((c) => c.faturamento > 0).sort((a, b) => b.faturamento - a.faturamento)
      .map((c) => ({ id: c.id, nome: c.nome, funcao: c.funcao, faturamento: c.faturamento, atendimentos: c.atendimentos, ticket: c.ticket }));
    const idsF = new Set(filtradas.map((c) => String(c.id)));
    const agItens = (data?.agendaHoje.itens ?? []).filter((a) => idsF.has(a.id));
    const agTotal = agItens.reduce((s, a) => s + a.atendimentos, 0);
    const distAcc: Record<string, number> = {};
    for (const c of filtradas) { const f = c.funcao || 'Sem função definida'; distAcc[f] = (distAcc[f] || 0) + 1; }
    const total = filtradas.length || 1;
    const dist: DistItem[] = Object.entries(distAcc).map(([funcao, count]) => ({ funcao, count, pct: (count / total) * 100 })).sort((a, b) => b.count - a.count);
    const topAtend = [...filtradas].filter((c) => c.atendimentos > 0).sort((a, b) => b.atendimentos - a.atendimentos)[0] || null;
    const comAgenda = new Set(agItens.map((a) => a.id));
    const semAgenda = data?.insights.temAgendaHoje ? filtradas.filter((c) => !comAgenda.has(String(c.id))).map((c) => c.nome) : [];
    return {
      totFat, totAtend, ranking,
      agenda: { total: agTotal, itens: agItens },
      distribuicao: { total: filtradas.length, itens: dist },
      insights: {
        maiorFaturamento: ranking[0] ? { nome: ranking[0].nome, valor: ranking[0].faturamento, pctDoTotal: totFat > 0 ? (ranking[0].faturamento / totFat) * 100 : 0 } : null,
        maisAtendimentos: topAtend ? { nome: topAtend.nome, qtd: topAtend.atendimentos, pctDoTotal: totAtend > 0 ? (topAtend.atendimentos / totAtend) * 100 : 0 } : null,
        semAgendaHoje: semAgenda,
        temAgendaHoje: !!data?.insights.temAgendaHoje,
        comissaoPendente: data?.insights.comissaoPendente.valor ?? 0,
      },
    };
  }, [filtradas, data]);

  const destaqueId = derivado.ranking[0]?.id ?? null;
  const patch = (p: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...p }));

  const actions = (
    <>
      <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="nb-input" style={{ width: 170 }} />
      <Button icon="Plus" onClick={() => setForm({ aberto: true, editando: null })}>Nova colaboradora</Button>
    </>
  );

  const primeiraCarga = !data && busy;

  return (
    <PageShell title="Colaboradoras" subtitle="Equipe, agenda e performance" actions={actions}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 14px', flexWrap: 'wrap' }}>
        <span className="nb-eyebrow">Performance de</span>
        <span style={{ fontFamily: 'var(--nb-serif)', fontSize: 18, color: 'var(--nb-ink)' }}>{mesExtenso(mes)}</span>
        {busy && data && <Icon name="RotateCcw" size={14} className="nb-ink-faint" />}
      </div>

      {erro && !data && <Card><p style={{ margin: 0, color: 'var(--nb-bad)' }}>{erro}</p></Card>}

      {primeiraCarga ? (
        <Skeleton />
      ) : data && colabs.length === 0 ? (
        <div className="nb-card nb-card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '56px 24px' }}>
          <span aria-hidden style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}><Icon name="Users" size={24} /></span>
          <p style={{ margin: 0, fontFamily: 'var(--nb-serif)', fontSize: 19, color: 'var(--nb-ink)' }}>Nenhuma colaboradora cadastrada</p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--nb-ink-soft)', maxWidth: '40ch' }}>Cadastre a equipe do salão para acompanhar faturamento, comissão e atendimentos de cada profissional.</p>
          <Button icon="Plus" onClick={() => setForm({ aberto: true, editando: null })}>Nova colaboradora</Button>
        </div>
      ) : data && (
        <div className={busy ? 'v2-busy' : undefined}>
          {/* KPIs */}
          <div className="v2-kpi-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
            <Kpi label="Colaboradoras ativas" icon="Users" value={num(data.kpis.ativas.value)} k={data.kpis.ativas} fmt={num} anteriorLabel="mês anterior" />
            <Kpi label="Faturamento do mês" icon="Wallet" value={brl(data.kpis.faturamento.value)} k={data.kpis.faturamento} fmt={brl} anteriorLabel="mês anterior" href="/v2/relatorios" />
            <Kpi label="Comissão total" icon="HandCoins" value={brl(data.kpis.comissao.value)} k={data.kpis.comissao} fmt={brl} anteriorLabel="mês anterior" tone="accent" href="/v2/comissoes" />
            <Kpi label="Atendimentos" icon="Scissors" value={num(data.kpis.atendimentos.value)} k={data.kpis.atendimentos} fmt={num} anteriorLabel="mês anterior" href="/v2/lancamentos" />
          </div>

          <div style={{ marginTop: 16 }}>
            <FiltrosBar filtros={filtros} funcoes={funcoes} total={colabs.length} mostrando={filtradas.length} onChange={patch} onClear={() => setFiltros(FILTROS_PADRAO)} />
          </div>

          {/* grid principal + lateral */}
          <div className="v2-2col">
            <div>
              {filtradas.length === 0 ? (
                <Card><EmptyState icon="Search" titulo="Nenhuma colaboradora encontrada." texto="Ajuste os filtros ou limpe a busca para ver a equipe." acao={{ label: 'Limpar filtros', onClick: () => setFiltros(FILTROS_PADRAO) }} /></Card>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 16 }}>
                  {filtradas.map((c) => (
                    <ColabCard key={c.id} c={c} destaque={c.id === destaqueId}
                      onEditar={() => setForm({ aberto: true, editando: c })}
                      onDesempenho={() => setDesempenho(c)}
                      onAgenda={() => { window.location.href = '/v2/agenda'; }} />
                  ))}
                </div>
              )}
            </div>
            <Lateral ranking={derivado.ranking} agenda={derivado.agenda} distribuicao={derivado.distribuicao} onVerRanking={() => setFiltros(FILTROS_PADRAO)} />
          </div>

          {/* insights */}
          <Insights ins={derivado.insights} />
        </div>
      )}

      {form.aberto && (
        <ColabForm
          editando={form.editando}
          onFechar={() => setForm({ aberto: false, editando: null })}
          onSalvo={() => { setForm({ aberto: false, editando: null }); invalidateCache('/api/v2/'); carregar(mes); }}
        />
      )}

      {desempenho && (
        <DesempenhoDrawer
          colab={desempenho}
          mesLabel={mesExtenso(mes)}
          rankPos={(() => { const i = derivado.ranking.findIndex((r) => r.id === desempenho.id); return i >= 0 ? i + 1 : null; })()}
          totalFat={derivado.totFat}
          totalAtend={derivado.totAtend}
          onClose={() => setDesempenho(null)}
          onEditar={() => { setForm({ aberto: true, editando: desempenho }); setDesempenho(null); }}
        />
      )}
    </PageShell>
  );
}

/* ---------- KPI ---------- */
function Kpi({ label, icon, value, k, fmt, anteriorLabel, tone, href }: {
  label: string; icon: string; value: string; k: { anterior: number | null; delta: number | null }; fmt: (v: number | null | undefined) => string; anteriorLabel: string; tone?: 'accent'; href?: string;
}) {
  const Root: any = href ? 'a' : 'div';
  const rootProps: any = href
    ? { href, className: 'nb-card nb-card-pad nb-card-link', 'aria-label': `${label} — ver detalhes` }
    : { className: 'nb-card nb-card-pad' };
  return (
    <Root {...rootProps} style={{ display: 'flex', flexDirection: 'column', gap: 10, color: 'inherit', textDecoration: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="nb-eyebrow">{label}</span>
        <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', display: 'grid', placeItems: 'center', color: 'var(--nb-accent-deep)' }}><Icon name={icon} size={17} /></span>
      </div>
      <div className="nb-num" style={{ fontSize: 24, fontWeight: 680, lineHeight: 1.1, color: tone === 'accent' ? 'var(--nb-accent-deep)' : 'var(--nb-ink)' }}>{value}</div>
      <Delta delta={k.delta} anterior={k.anterior} anteriorLabel={anteriorLabel} fmt={fmt} />
      {href && (
        <span className="nb-card-link-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 560, color: 'var(--nb-accent)', marginTop: 'auto' }}>
          Ver detalhes <Icon name="ArrowRight" size={12} />
        </span>
      )}
    </Root>
  );
}

/* ---------- Insights ---------- */
function Insights({ ins }: { ins: {
  maiorFaturamento: { nome: string; valor: number; pctDoTotal: number } | null;
  maisAtendimentos: { nome: string; qtd: number; pctDoTotal: number } | null;
  semAgendaHoje: string[];
  temAgendaHoje: boolean;
  comissaoPendente: number;
} }) {
  const semAgendaTxt = !ins.temAgendaHoje
    ? 'Nenhum agendamento hoje'
    : ins.semAgendaHoje.length === 0
      ? 'Toda a equipe tem agenda'
      : ins.semAgendaHoje.slice(0, 3).join(', ') + (ins.semAgendaHoje.length > 3 ? ` +${ins.semAgendaHoje.length - 3}` : '');

  return (
    <div className="nb-card nb-card-pad" style={{ marginTop: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 18 }}>
        <Insight icon="Trophy" label="Maior faturamento"
          titulo={ins.maiorFaturamento?.nome ?? '—'}
          valor={ins.maiorFaturamento ? `${brl(ins.maiorFaturamento.valor)} · ${pct(ins.maiorFaturamento.pctDoTotal, { casas: 0 })} do total` : 'Sem dados no período'} />
        <Insight icon="Scissors" label="Mais atendimentos"
          titulo={ins.maisAtendimentos?.nome ?? '—'}
          valor={ins.maisAtendimentos ? `${num(ins.maisAtendimentos.qtd)} atend. · ${pct(ins.maisAtendimentos.pctDoTotal, { casas: 0 })} do total` : 'Sem dados no período'} />
        <Insight icon="CalendarOff" label="Sem agenda hoje" titulo={semAgendaTxt} valor={ins.temAgendaHoje && ins.semAgendaHoje.length > 0 ? `${ins.semAgendaHoje.length} sem horário marcado` : ' '} />
        <Insight icon="Clock" label="Comissão pendente" titulo={brl(ins.comissaoPendente)} valor="Pendente + fiado em aberto" href="/v2/comissoes" hrefLabel="Ver detalhes" />
      </div>
    </div>
  );
}

function Insight({ icon, label, titulo, valor, href, hrefLabel }: { icon: string; label: string; titulo: string; valor: string; href?: string; hrefLabel?: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
      <span aria-hidden style={{ flex: '0 0 auto', width: 38, height: 38, borderRadius: 10, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', display: 'grid', placeItems: 'center', color: 'var(--nb-accent-deep)' }}><Icon name={icon} size={17} /></span>
      <div style={{ minWidth: 0 }}>
        <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>{label}</div>
        <div style={{ fontSize: 14.5, fontWeight: 620, color: 'var(--nb-ink)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</div>
        <div className="nb-num" style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', marginTop: 2 }}>{valor}</div>
        {href && <a href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 560, color: 'var(--nb-accent)', textDecoration: 'none', marginTop: 4 }}>{hrefLabel} <Icon name="ArrowRight" size={12} /></a>}
      </div>
    </div>
  );
}

/* ---------- Skeleton ---------- */
function Skeleton() {
  return (
    <>
      <div className="v2-kpi-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="nb-card nb-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Skel h={11} w={90} /><Skel h={34} w={34} r={10} /></div>
            <Skel h={26} w="55%" /><Skel h={12} w="80%" />
          </div>
        ))}
      </div>
      <div className="v2-2col" style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="nb-card nb-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}><Skel h={46} w={46} r={23} /><div style={{ flex: 1 }}><Skel h={15} w="70%" /><Skel h={11} w="45%" style={{ marginTop: 8 }} /></div></div>
              <Skel h={34} r={8} /><Skel h={44} r={8} />
            </div>
          ))}
        </div>
        <div className="nb-card nb-card-pad"><Skel h={16} w={140} /><Skel h={200} r={12} style={{ marginTop: 16 }} /></div>
      </div>
    </>
  );
}

/* ---------- Form (edita o nome ORIGINAL para preservar a "(Função)") ---------- */
function ColabForm({ editando, onFechar, onSalvo }: { editando: Colab | null; onFechar: () => void; onSalvo: () => void }) {
  const [nome, setNome] = useState(editando?.nomeOriginal ?? '');
  const [telefone, setTelefone] = useState(editando?.telefone ?? '');
  const [porcentagem, setPorcentagem] = useState(editando ? String(editando.porcentagem_comissao) : '');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) { toast.error('Informe o nome da colaboradora.'); return; }
    const perc = parseFloat(porcentagem.replace(',', '.')) || 0;
    setSalvando(true);
    try {
      const url = editando ? `/api/v2/colaboradoras?id=${editando.id}` : '/api/v2/colaboradoras';
      const r = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), telefone: telefone.trim(), porcentagem_comissao: perc }),
      });
      if (r.ok) { toast.success(editando ? 'Colaboradora atualizada!' : 'Colaboradora cadastrada!'); onSalvo(); }
      else toast.error((await r.json()).error || 'Erro ao salvar.');
    } catch { toast.error('Erro de conexão.'); } finally { setSalvando(false); }
  };

  return (
    <div role="dialog" aria-modal="true" onClick={onFechar}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'color-mix(in srgb, var(--nb-ink) 32%, transparent)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="nb-card nb-card-pad" style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 640, color: 'var(--nb-ink)' }}>{editando ? 'Editar colaboradora' : 'Nova colaboradora'}</h3>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="nb-btn nb-btn-ghost" style={{ padding: 7 }}><Icon name="X" size={16} /></button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="nb-eyebrow" style={{ fontSize: 10 }}>Nome</span>
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (Função)" className="nb-input" />
          <span style={{ fontSize: 11, color: 'var(--nb-ink-faint)' }}>A função é lida do nome entre parênteses. Ex.: <em>Talita (Manicure)</em>.</span>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="nb-eyebrow" style={{ fontSize: 10 }}>Telefone</span>
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" placeholder="(00) 00000-0000" className="nb-input nb-num" />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="nb-eyebrow" style={{ fontSize: 10 }}>Comissão (%)</span>
          <div style={{ position: 'relative' }}>
            <input value={porcentagem} onChange={(e) => setPorcentagem(e.target.value)} inputMode="decimal" placeholder="40" className="nb-input nb-num" style={{ paddingRight: 34 }} onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }} />
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', fontSize: 14 }}>%</span>
          </div>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onFechar} className="nb-btn nb-btn-quiet">Cancelar</button>
          <Button icon="Check" onClick={salvar} disabled={salvando}>{salvando ? '…' : 'Salvar'}</Button>
        </div>
      </div>
    </div>
  );
}
