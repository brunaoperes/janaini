'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import PageShell from '@/components/v2/layout/PageShell';
import { Card } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { EmptyState, Segmented } from '@/components/v2/dashboard/_shared';
import { brl, num } from '@/lib/v2/formatters';
import {
  HORAS, INICIO_MIN, FIM_MIN, JANELA_MIN, horaParaMin, minDeISO, marcarConflitos,
  contarConflitos, corColab, statusVisual, Bloco,
} from '@/components/v2/agenda/timeline-utils';
import AgendaFilters, { FiltrosAgenda, FILTROS_VAZIOS, temFiltroAtivo } from '@/components/v2/agenda/AgendaFilters';
import AgendaAnalytics from '@/components/v2/agenda/AgendaAnalytics';
import AgendaDetalhe from '@/components/v2/agenda/AgendaDetalhe';
import AgendamentoModal, { AgendamentoEdit } from '@/components/v2/agenda/AgendamentoModal';
import TimelineBlock from '@/components/v2/agenda/TimelineBlock';
import { useTimelineDnd } from '@/components/v2/agenda/useTimelineDnd';
import { StatusBadge, Avatar, hhmm } from '@/components/v2/agenda/_ui';
import { getCache, setCache, invalidateCache } from '@/lib/v2/cache';

const hojeBRT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
function addDias(iso: string, n: number) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function rotuloData(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  const s = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Vista = 'dia' | 'semana';

export default function AgendaV2() {
  const [data, setData] = useState(hojeBRT());
  const [vista, setVista] = useState<Vista>('dia');
  const [ags, setAgs] = useState<any[]>([]);
  const [colabs, setColabs] = useState<any[]>([]);
  const [servicosDisp, setServicosDisp] = useState<string[]>([]);
  const [servicosCat, setServicosCat] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const reqAgenda = useRef(0);
  const [filtros, setFiltros] = useState<FiltrosAgenda>(FILTROS_VAZIOS);
  const [sel, setSel] = useState<Bloco | null>(null);
  // Modal de criar/editar agendamento (null = fechado).
  const [novoModal, setNovoModal] = useState<null | { colabId?: number | null; hora?: string | null }>(null);
  const [editAg, setEditAg] = useState<AgendamentoEdit | null>(null);
  const [agora, setAgora] = useState<number>(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });

  useEffect(() => {
    const t = setInterval(() => { const d = new Date(); setAgora(d.getHours() * 60 + d.getMinutes()); }, 60000);
    return () => clearInterval(t);
  }, []);

  const carregar = useCallback(async (dia: string) => {
    const id = ++reqAgenda.current;
    const aplicar = (j: any) => {
      setAgs(j.agendamentos || []);
      setColabs(j.colaboradores || []);
      setServicosCat(j.servicos || []);
      const nomes = Array.from(new Set((j.servicos || []).map((s: any) => s.nome).filter(Boolean))) as string[];
      setServicosDisp(nomes.sort((a, b) => a.localeCompare(b, 'pt-BR')));
    };
    const url = `/api/agenda?data=${dia}`;
    const cached = getCache<any>(url);
    if (cached !== undefined) { aplicar(cached); setLoading(false); } // mostra na hora, sem skeleton
    else setLoading(true);
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (id !== reqAgenda.current) return; // resposta de um dia anterior — descarta (não sobrescreve o dia atual)
      if (r.ok) { aplicar(j); setCache(url, j); setErro(false); }
      else if (cached === undefined) setErro(true);
    } catch { if (id === reqAgenda.current && cached === undefined) setErro(true); }
    finally { if (id === reqAgenda.current) setLoading(false); }
  }, []);
  useEffect(() => { carregar(data); }, [data, carregar]);

  // ---- Mover / redimensionar agendamentos (drag + resize) ----
  // Estado sempre-atual dos agendamentos p/ snapshot de rollback sem recriar os callbacks.
  const agsRef = useRef(ags);
  useEffect(() => { agsRef.current = ags; }, [ags]);

  // Persistência otimista: atualiza o estado local na hora e faz PUT; em erro, faz rollback + toast.
  const persist = useCallback(async (
    id: number,
    inicioMin: number,
    fimMin: number,
    colaboradorId: number | null | undefined,
    ok: string,
  ) => {
    const prev = agsRef.current.find((a) => a.id === id);
    if (!prev) return;
    const hi = hhmm(inicioMin);
    const hf = hhmm(fimMin);
    const dataHora = `${data} ${hi}:00`;
    const patch: any = { data_hora: dataHora, hora_inicio: hi, hora_fim: hf, duracao_minutos: fimMin - inicioMin };
    if (colaboradorId !== undefined) patch.colaborador_id = colaboradorId;

    setAgs((cur) => cur.map((a) => (a.id === id ? { ...a, ...patch } : a))); // otimista
    try {
      const r = await fetch('/api/agendamentos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.error) throw new Error(j?.error || 'Falha ao salvar');
      // move/resize persistido → cache da agenda (e do dashboard) fica obsoleto
      invalidateCache('/api/agenda'); invalidateCache('/api/v2/');
      toast.success(ok);
    } catch (err: any) {
      setAgs((cur) => cur.map((a) => (a.id === id ? prev : a))); // rollback
      const msg = typeof err?.message === 'string' && /inválido|Horário/i.test(err.message)
        ? err.message : 'Não foi possível salvar. Tente novamente.';
      toast.error(msg);
    }
  }, [data]);

  const dnd = useTimelineDnd({
    onCommitMove: ({ id, colaboradorId, inicioMin, fimMin }) =>
      persist(id, inicioMin, fimMin, colaboradorId, `Movido para ${hhmm(inicioMin)}`),
    onCommitResize: ({ id, inicioMin, fimMin }) =>
      persist(id, inicioMin, fimMin, undefined, `Duração ajustada · ${hhmm(inicioMin)}–${hhmm(fimMin)}`),
  });

  // ---- Abrir modal de criar/editar agendamento ----
  const abrirNovo = useCallback(() => { setEditAg(null); setNovoModal({}); }, []);

  // Guarda: o browser sintetiza um "click" no ancestral comum após um drag que solta em
  // outro elemento. Marcamos o fim de cada arraste para ignorar esse click fantasma.
  const dragEndRef = useRef(0);
  const prevActiveRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevActiveRef.current != null && dnd.activeId == null) dragEndRef.current = Date.now();
    prevActiveRef.current = dnd.activeId;
  }, [dnd.activeId]);

  // Clique num espaço VAZIO da timeline: pré-preenche colaboradora + horário (snap 15 min).
  const abrirVago = useCallback((e: React.MouseEvent<HTMLDivElement>, colabId: number) => {
    if ((e.target as HTMLElement).closest('[data-agid]')) return; // clicou num bloco existente
    if (dnd.activeId != null) return;                             // arraste em andamento
    if (Date.now() - dragEndRef.current < 350) return;            // click fantasma pós-drag
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const min = INICIO_MIN + ((e.clientX - rect.left) / rect.width) * JANELA_MIN;
    const snapped = Math.max(INICIO_MIN, Math.min(FIM_MIN - 15, Math.round(min / 15) * 15));
    setEditAg(null);
    setNovoModal({ colabId, hora: hhmm(snapped) });
  }, [dnd.activeId]);

  // Editar: usa o registro BRUTO do agendamento (tem cliente_id, observações etc.).
  const abrirEdicao = useCallback((id: number) => {
    const a = agsRef.current.find((x) => x.id === id);
    if (!a) return;
    setSel(null);
    setNovoModal(null);
    setEditAg({
      id: a.id,
      cliente_id: a.cliente_id,
      colaborador_id: a.colaborador_id,
      data_hora: a.data_hora,
      descricao_servico: a.descricao_servico,
      duracao_minutos: a.duracao_minutos,
      valor_estimado: a.valor_estimado,
      hora_inicio: a.hora_inicio,
      hora_fim: a.hora_fim,
      observacoes: a.observacoes,
      cliente: a.cliente ? { nome: a.cliente.nome, telefone: a.cliente.telefone } : null,
    });
  }, []);

  const fecharModal = useCallback(() => { setNovoModal(null); setEditAg(null); }, []);
  const aposSalvar = useCallback(() => { fecharModal(); invalidateCache('/api/agenda'); invalidateCache('/api/v2/'); carregar(data); }, [fecharModal, carregar, data]);

  // Todos os blocos do dia (a API já exclui cancelados)
  const todosBlocos = useMemo<Bloco[]>(() => ags.map((a): Bloco => {
    const ini = horaParaMin(a.hora_inicio) ?? minDeISO(a.data_hora) ?? INICIO_MIN;
    const fim = horaParaMin(a.hora_fim) ?? (ini + (a.duracao_minutos || 60));
    return {
      id: a.id,
      colaboradorId: a.colaborador_id,
      colaboradoresIds: a.colaboradores_ids,
      inicioMin: ini,
      fimMin: Math.max(ini + 15, fim),
      cliente: a.cliente?.nome || a.cliente_nome || 'Cliente',
      telefone: a.cliente?.telefone || null,
      servico: a.descricao_servico || '',
      colaboradorNome: a.colaborador?.nome || null,
      status: statusVisual(a),
      valor: a.lancamento?.valor_total || 0,
      valorEstimado: Number(a.valor_estimado) || 0,
    };
  }), [ags]);

  // A receita prevista só é confiável se houver valor_estimado preenchido em algum agendamento.
  const receitaConfiavel = useMemo(() => todosBlocos.some((b) => b.valorEstimado > 0), [todosBlocos]);

  // Aplica filtros → blocos exibidos (com conflitos remarcados sobre o conjunto visível)
  const blocos = useMemo<Bloco[]>(() => {
    const q = filtros.busca.trim().toLowerCase();
    const filtrados = todosBlocos.map((b) => ({ ...b, conflito: false })).filter((b) => {
      if (filtros.colaboradora !== 'todas') {
        const id = Number(filtros.colaboradora);
        if (b.colaboradorId !== id && !b.colaboradoresIds?.includes(id)) return false;
      }
      if (filtros.status !== 'todos' && b.status !== filtros.status) return false;
      if (filtros.servico !== 'todos' && !b.servico.toLowerCase().includes(filtros.servico.toLowerCase())) return false;
      if (q) {
        const alvo = `${b.cliente} ${b.telefone || ''} ${b.servico}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
    return marcarConflitos(filtrados);
  }, [todosBlocos, filtros]);

  // Colaboradoras exibidas: se filtrou por uma, mostra só ela
  const colabsExibidas = useMemo(() => (
    filtros.colaboradora !== 'todas' ? colabs.filter((c) => String(c.id) === filtros.colaboradora) : colabs
  ), [colabs, filtros.colaboradora]);

  const corDe = useMemo(() => {
    const map = new Map<number, string>();
    colabs.forEach((c, i) => map.set(c.id, corColab(i)));
    return (id: number | null) => (id != null && map.get(id)) || 'var(--nb-ink-faint)';
  }, [colabs]);

  const blocosDe = useCallback((colabId: number) => (
    blocos.filter((b) => b.colaboradorId === colabId || b.colaboradoresIds?.includes(colabId))
  ), [blocos]);

  // KPIs (respeitam filtros)
  const totalAg = blocos.length;
  const receitaEstimada = blocos.reduce((s, b) => s + b.valorEstimado, 0);
  const receitaLancada = blocos.reduce((s, b) => s + b.valor, 0);
  const minutosOcupados = blocos.reduce((s, b) => s + (b.fimMin - b.inicioMin), 0);
  const colabsComAgenda = new Set(blocos.map((b) => b.colaboradorId).filter((v) => v != null)).size;
  const ocupacao = colabsComAgenda ? Math.min(100, (minutosOcupados / (600 * colabsComAgenda)) * 100) : null;
  const conflitos = contarConflitos(blocos);

  const ehHoje = data === hojeBRT();
  const posAgora = ((agora - INICIO_MIN) / JANELA_MIN) * 100;
  const vazioGeral = !loading && vista === 'dia' && totalAg === 0;

  const actions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <button className="nb-btn nb-btn-ghost" onClick={() => setData(addDias(data, -1))} aria-label="Dia anterior" style={{ padding: 9 }}><Icon name="ChevronLeft" size={17} /></button>
        <button className="nb-btn nb-btn-ghost" onClick={() => setData(hojeBRT())} disabled={ehHoje}>Hoje</button>
        <button className="nb-btn nb-btn-ghost" onClick={() => setData(addDias(data, 1))} aria-label="Próximo dia" style={{ padding: 9 }}><Icon name="ChevronRight" size={17} /></button>
      </div>
      <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="nb-input" style={{ width: 148 }} />
      <Segmented value={vista} onChange={setVista} options={[['dia', 'Dia'], ['semana', 'Semana']] as const} />
      <button className="nb-btn nb-btn-primary" onClick={abrirNovo}><Icon name="Plus" size={16} /> Novo agendamento</button>
    </div>
  );

  return (
    <PageShell title="Agenda" subtitle={rotuloData(data)} actions={actions}>
      {erro && ags.length === 0 && (
        <div className="nb-card nb-card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, borderColor: 'var(--nb-bad)' }}>
          <Icon name="TriangleAlert" size={18} className="nb-bad" />
          <span style={{ flex: 1, fontSize: 14, color: 'var(--nb-ink)' }}>Não foi possível carregar a agenda deste dia.</span>
          <button className="nb-btn nb-btn-ghost" onClick={() => carregar(data)}>Tentar de novo</button>
        </div>
      )}
      {/* Filtros */}
      <AgendaFilters filtros={filtros} setFiltros={setFiltros} colabs={colabs} servicos={servicosDisp} resultados={totalAg} />

      {/* KPIs */}
      <div className="v2-kpis" style={{ marginBottom: 18 }}>
        <Kpi icon="CalendarDays" label="Agendamentos" value={loading ? '—' : num(totalAg)} sub={temFiltroAtivo(filtros) ? 'No filtro atual' : 'Total do dia'} />
        <Kpi
          icon="DollarSign" label="Receita prevista" href="/v2/relatorios"
          value={loading ? '—' : receitaConfiavel ? brl(receitaEstimada) : receitaLancada > 0 ? brl(receitaLancada) : '—'}
          sub={loading ? '' : receitaConfiavel ? 'Baseado nos agendamentos' : receitaLancada > 0 ? 'Sem estimativa · valor lançado' : 'Sem valores registrados'}
          alerta={!loading && !receitaConfiavel && receitaLancada > 0}
        />
        <Kpi
          icon="Gauge" label="Taxa de ocupação"
          value={loading || ocupacao == null ? '—' : `${ocupacao.toFixed(0)}%`}
          sub={ocupacao == null ? 'Sem agenda no período' : 'Carga (base 10h úteis)'}
        />
        <Kpi icon="TriangleAlert" label="Conflitos" value={loading ? '—' : num(conflitos)} sub={conflitos > 0 ? 'Requer atenção' : 'Nenhum conflito'} tone={conflitos > 0 ? 'warn' : undefined} />
      </div>

      {vista === 'semana' ? (
        <Card>
          <EmptyState
            icon="CalendarDays"
            titulo="Visão de semana em breve"
            texto="A grade semanal está sendo preparada. Por enquanto, use a visão de Dia — os indicadores e a linha do tempo já estão completos."
            acao={{ label: 'Voltar para o Dia', onClick: () => setVista('dia') }}
            h={220}
          />
        </Card>
      ) : (
        <>
          {/* Timeline desktop */}
          <Card pad={false} className="v2-agenda-desk">
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 960 }}>
                {/* régua de horas */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--nb-rule)', position: 'sticky', top: 0, background: 'var(--nb-surface)', zIndex: 3 }}>
                  <div style={{ ...NOMECOL, borderRight: '1px solid var(--nb-rule)', display: 'flex', alignItems: 'center' }}><span className="nb-eyebrow" style={{ fontSize: 10 }}>Profissionais</span></div>
                  <div style={{ flex: 1, position: 'relative', height: 30 }}>
                    {HORAS.map((h) => {
                      // MESMA fórmula dos blocos (posBarra) → régua alinhada com os agendamentos
                      const left = ((h * 60 - INICIO_MIN) / JANELA_MIN) * 100;
                      const transform = h === INICIO_MIN / 60 ? 'none' : h === FIM_MIN / 60 ? 'translateX(-100%)' : 'translateX(-50%)';
                      return (
                        <span key={h} style={{ position: 'absolute', left: `${left}%`, top: 9, transform, fontSize: 11, color: 'var(--nb-ink-faint)', fontFamily: 'var(--nb-mono)', whiteSpace: 'nowrap' }}>{String(h).padStart(2, '0')}h</span>
                      );
                    })}
                  </div>
                </div>

                {/* linhas por profissional */}
                <div style={{ position: 'relative' }}>
                  {loading ? (
                    [0, 1, 2, 3].map((i) => (
                      <div key={i} style={{ display: 'flex', height: 72, borderBottom: '1px solid var(--nb-rule-soft)' }}>
                        <div style={{ ...NOMECOL, display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div className="v2-skel" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                          <div className="v2-skel" style={{ width: 90, height: 12 }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: `${(i * 12) % 40 + 4}%` }}>
                          <div className="v2-skel" style={{ width: '18%', height: 46, borderRadius: 8 }} />
                        </div>
                      </div>
                    ))
                  ) : colabsExibidas.length === 0 ? (
                    <Vazio texto="Nenhuma profissional cadastrada." />
                  ) : colabsExibidas.map((c) => {
                    const bs = blocosDe(c.id);
                    return (
                      <div key={c.id} style={{ display: 'flex', borderBottom: '1px solid var(--nb-rule-soft)', minHeight: 72 }}>
                        <div style={{ ...NOMECOL, borderRight: '1px solid var(--nb-rule)', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar nome={c.nome} cor={corDe(c.id)} size={30} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                            <span style={{ fontSize: 11, color: 'var(--nb-ink-faint)' }}>{bs.length} agend.</span>
                          </span>
                        </div>
                        <div data-colab-row data-colab-id={c.id} onClick={(e) => abrirVago(e, c.id)} style={{ flex: 1, position: 'relative', cursor: 'copy' }} title="Clique num espaço livre para agendar">
                          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                            {HORAS.map((h) => {
                              const left = ((h * 60 - INICIO_MIN) / JANELA_MIN) * 100;
                              return <div key={h} style={{ position: 'absolute', left: `${left}%`, top: 0, bottom: 0, borderLeft: '1px solid var(--nb-rule-soft)' }} />;
                            })}
                          </div>
                          {bs.map((b) => (
                            <TimelineBlock
                              key={b.id}
                              b={b}
                              corBarra={corDe(b.colaboradorId)}
                              onOpen={() => setSel(b)}
                              onBeginMove={(e) => dnd.beginMove(e, b, () => setSel(b))}
                              onBeginResize={(e, side) => dnd.beginResize(e, b, side)}
                              isSource={dnd.activeId === b.id}
                              interactive={b.status !== 'cancelado'}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* estado vazio geral: grade limpa + banner */}
                  {vazioGeral && colabsExibidas.length > 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                      <div style={{ pointerEvents: 'auto', textAlign: 'center', background: 'var(--nb-surface)', border: '1px solid var(--nb-rule)', borderRadius: 14, boxShadow: 'var(--nb-shadow-md)', padding: '20px 26px', maxWidth: 380 }}>
                        <span aria-hidden style={{ display: 'inline-grid', placeItems: 'center', width: 44, height: 44, borderRadius: 12, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', color: 'var(--nb-ink-faint)', marginBottom: 8 }}><Icon name="CalendarOff" size={20} /></span>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--nb-ink)' }}>Nenhum agendamento encontrado</div>
                        <div style={{ fontSize: 12.5, color: 'var(--nb-ink-faint)', margin: '4px 0 12px' }}>
                          {temFiltroAtivo(filtros) ? 'Ajuste os filtros ou selecione outra data.' : 'Use os filtros ou selecione outra data.'}
                        </div>
                        <button className="nb-btn nb-btn-primary" onClick={abrirNovo}><Icon name="Plus" size={15} /> Criar agendamento</button>
                      </div>
                    </div>
                  )}

                  {/* linha do horário atual — o container externo cobre SÓ a área da grade (a partir da
                      coluna de nomes), e a linha usa posAgora% dessa área. Evita o calc() inválido anterior. */}
                  {ehHoje && posAgora >= 0 && posAgora <= 100 && !loading && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: NOMECOL.width, right: 0, zIndex: 4, pointerEvents: 'none' }}>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${posAgora}%`, width: 2, background: 'var(--nb-bad)' }}>
                        <span style={{ position: 'absolute', top: 4, left: 4, background: 'var(--nb-bad)', color: '#fff', fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--nb-mono)', padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap', boxShadow: 'var(--nb-shadow)' }}>{hhmm(agora)}</span>
                        <span style={{ position: 'absolute', top: -1, left: -3, width: 8, height: 8, borderRadius: '50%', background: 'var(--nb-bad)' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* legenda */}
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 12, fontSize: 12, color: 'var(--nb-ink-soft)', alignItems: 'center' }}>
            <Leg cor="var(--nb-ok)" texto="Confirmado" />
            <Leg cor="var(--nb-warn)" texto="Em execução" />
            <Leg cor="#64748B" texto="Concluído" />
            <Leg cor="var(--nb-bad)" texto="Cancelado" />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="TriangleAlert" size={13} className="nb-bad" /> Conflito</span>
            <span style={{ color: 'var(--nb-ink-faint)', marginLeft: 'auto' }}>Clique em um agendamento para ver detalhes.</span>
          </div>

          {/* Lista mobile */}
          <div className="v2-agenda-mob" style={{ display: 'none', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            {loading ? (
              [0, 1].map((i) => <Card key={i}><div className="v2-skel" style={{ height: 60 }} /></Card>)
            ) : vazioGeral ? (
              <Card><EmptyState icon="CalendarOff" titulo="Nenhum agendamento encontrado" texto={temFiltroAtivo(filtros) ? 'Ajuste os filtros ou selecione outra data.' : 'Use os filtros ou selecione outra data.'} acao={{ label: 'Criar agendamento', onClick: abrirNovo }} /></Card>
            ) : colabsExibidas.map((c) => {
              const bs = blocosDe(c.id).sort((a, b) => a.inicioMin - b.inicioMin);
              return (
                <Card key={c.id} pad={false}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderBottom: '1px solid var(--nb-rule-soft)' }}>
                    <Avatar nome={c.nome} cor={corDe(c.id)} size={26} />
                    <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{c.nome}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{bs.length} agend.</span>
                    <button className="nb-btn nb-btn-quiet" onClick={() => { setEditAg(null); setNovoModal({ colabId: c.id }); }} aria-label={`Agendar para ${c.nome}`} style={{ padding: 6 }}><Icon name="Plus" size={16} /></button>
                  </div>
                  {bs.length === 0 ? <div style={{ padding: 14, fontSize: 13, color: 'var(--nb-ink-faint)' }}>Sem agendamentos.</div> : bs.map((b) => (
                    <button key={b.id} onClick={() => setSel(b)} style={{ width: '100%', display: 'grid', gridTemplateColumns: '54px 3px 1fr auto', gap: 10, alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--nb-rule-soft)', background: 'transparent', border: 'none', borderBottomLeftRadius: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
                      <span className="nb-num" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--nb-accent-deep)' }}>{hhmm(b.inicioMin)}</span>
                      <span style={{ alignSelf: 'stretch', background: corDe(b.colaboradorId), borderRadius: 2 }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 560, overflow: 'hidden' }}>
                          {b.conflito && <Icon name="TriangleAlert" size={12} className="nb-bad" />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.cliente}</span>
                        </span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--nb-ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.servico}</span>
                      </span>
                      <StatusBadge status={b.status} size="sm" />
                    </button>
                  ))}
                </Card>
              );
            })}
          </div>

          {/* Analytics inferior */}
          {!loading && totalAg > 0 && (
            <AgendaAnalytics blocos={blocos} colabs={colabsExibidas} corDe={corDe} receitaConfiavel={receitaConfiavel} />
          )}
        </>
      )}

      {/* Preview de arraste/resize — segue o cursor (opacidade + sombra + borda mauve). */}
      {dnd.preview && (
        <div style={{
          position: 'fixed', left: dnd.preview.leftPx, top: dnd.preview.topPx,
          width: Math.max(dnd.preview.widthPx, 2), height: dnd.preview.heightPx,
          borderRadius: 9, background: 'var(--nb-surface)', border: '1.5px solid var(--nb-accent)',
          boxShadow: 'var(--nb-shadow-md)', zIndex: 60, pointerEvents: 'none', padding: '5px 8px',
          overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1, opacity: 0.96,
        }}>
          <span className="nb-num" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--nb-accent-deep)', fontFamily: 'var(--nb-mono)' }}>
            {hhmm(dnd.preview.inicioMin)}–{hhmm(dnd.preview.fimMin)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--nb-ink-faint)' }}>{dnd.preview.mode === 'move' ? 'Movendo' : 'Redimensionando'}</span>
        </div>
      )}

      {sel && (
        <AgendaDetalhe
          bloco={sel}
          cor={corDe(sel.colaboradorId)}
          receitaConfiavel={receitaConfiavel}
          onClose={() => setSel(null)}
          onEdit={() => abrirEdicao(sel.id)}
        />
      )}

      {(novoModal !== null || editAg !== null) && (
        <AgendamentoModal
          colabs={colabs}
          servicos={servicosCat}
          dataPadrao={data}
          preColabId={novoModal?.colabId ?? null}
          preHoraInicio={novoModal?.hora ?? null}
          agendamento={editAg}
          onClose={fecharModal}
          onSaved={aposSalvar}
        />
      )}
    </PageShell>
  );
}

const NOMECOL: React.CSSProperties = { width: 168, flex: '0 0 168px', padding: '0 14px', position: 'sticky', left: 0, background: 'var(--nb-surface)', zIndex: 2 };

function Kpi({ icon, label, value, sub, tone, alerta, href }: { icon: string; label: string; value: string; sub?: string; tone?: 'warn'; alerta?: boolean; href?: string }) {
  const Root: any = href ? 'a' : 'div';
  const rootProps: any = href
    ? { href, className: 'nb-card nb-card-pad nb-card-link', 'aria-label': `${label} — ver detalhes` }
    : { className: 'nb-card nb-card-pad' };
  return (
    <Root {...rootProps} style={{ display: 'flex', alignItems: 'center', gap: 13, color: 'inherit', textDecoration: 'none' }}>
      <span aria-hidden style={{ width: 42, height: 42, borderRadius: 11, background: '#F0E7D8', color: 'var(--nb-gold)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><Icon name={icon} size={19} /></span>
      <div style={{ minWidth: 0 }}>
        <div className="nb-eyebrow" style={{ fontSize: 10 }}>{label}</div>
        <div className="nb-num" style={{ fontSize: 22, fontWeight: 680, color: tone === 'warn' ? 'var(--nb-warn)' : 'var(--nb-ink)', lineHeight: 1.12 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: alerta ? 'var(--nb-warn)' : 'var(--nb-ink-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>{alerta && <Icon name="Info" size={11} />}{sub}</div>}
      </div>
    </Root>
  );
}
function Leg({ cor, texto }: { cor: string; texto: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: cor }} />{texto}</span>;
}
function Vazio({ texto }: { texto: string }) {
  return <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--nb-ink-faint)', fontSize: 13 }}>{texto}</div>;
}
