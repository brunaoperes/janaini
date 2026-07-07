'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import PageShell from '@/components/v2/layout/PageShell';
import { Card } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { EmptyState, Segmented } from '@/components/v2/dashboard/_shared';
import { brl, num } from '@/lib/v2/formatters';
import {
  HORAS, INICIO_MIN, JANELA_MIN, horaParaMin, minDeISO, posBarra, marcarConflitos,
  contarConflitos, corColab, statusVisual, STATUS_META, Bloco,
} from '@/components/v2/agenda/timeline-utils';
import AgendaFilters, { FiltrosAgenda, FILTROS_VAZIOS, temFiltroAtivo } from '@/components/v2/agenda/AgendaFilters';
import AgendaAnalytics from '@/components/v2/agenda/AgendaAnalytics';
import AgendaDetalhe from '@/components/v2/agenda/AgendaDetalhe';
import { StatusBadge, Avatar, hhmm } from '@/components/v2/agenda/_ui';

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
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosAgenda>(FILTROS_VAZIOS);
  const [sel, setSel] = useState<Bloco | null>(null);
  const [agora, setAgora] = useState<number>(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });

  useEffect(() => {
    const t = setInterval(() => { const d = new Date(); setAgora(d.getHours() * 60 + d.getMinutes()); }, 60000);
    return () => clearInterval(t);
  }, []);

  const carregar = useCallback(async (dia: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/agenda?data=${dia}`, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) {
        setAgs(j.agendamentos || []);
        setColabs(j.colaboradores || []);
        const nomes = Array.from(new Set((j.servicos || []).map((s: any) => s.nome).filter(Boolean))) as string[];
        setServicosDisp(nomes.sort((a, b) => a.localeCompare(b, 'pt-BR')));
      }
    } catch { /* silencioso */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(data); }, [data, carregar]);

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
      <a href="/agenda" className="nb-btn nb-btn-primary" style={{ textDecoration: 'none' }}><Icon name="Plus" size={16} /> Novo agendamento</a>
    </div>
  );

  return (
    <PageShell title="Agenda" subtitle={rotuloData(data)} actions={actions}>
      {/* Filtros */}
      <AgendaFilters filtros={filtros} setFiltros={setFiltros} colabs={colabs} servicos={servicosDisp} resultados={totalAg} />

      {/* KPIs */}
      <div className="v2-kpis" style={{ marginBottom: 18 }}>
        <Kpi icon="CalendarDays" label="Agendamentos" value={loading ? '—' : num(totalAg)} sub={temFiltroAtivo(filtros) ? 'No filtro atual' : 'Total do dia'} />
        <Kpi
          icon="DollarSign" label="Receita prevista"
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
                  <div style={{ flex: 1, display: 'flex' }}>
                    {HORAS.map((h) => (
                      <div key={h} style={{ flex: 1, padding: '10px 0 8px', fontSize: 11, color: 'var(--nb-ink-faint)', fontFamily: 'var(--nb-mono)', borderLeft: '1px solid var(--nb-rule-soft)', textAlign: 'center' }}>{String(h).padStart(2, '0')}h</div>
                    ))}
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
                        <div style={{ flex: 1, position: 'relative' }}>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                            {HORAS.map((h) => <div key={h} style={{ flex: 1, borderLeft: '1px solid var(--nb-rule-soft)' }} />)}
                          </div>
                          {bs.map((b) => {
                            const { left, width } = posBarra(b);
                            const meta = STATUS_META[b.status];
                            const largo = width > 12;
                            return (
                              <button
                                key={b.id}
                                onClick={() => setSel(b)}
                                title={`${b.cliente} · ${b.servico}`}
                                style={{
                                  position: 'absolute', top: 7, bottom: 7, left: `${left}%`, width: `${width}%`,
                                  background: meta.bg, borderRadius: 9,
                                  borderLeft: `3px solid ${corDe(b.colaboradorId)}`,
                                  border: b.conflito ? '1.5px dashed var(--nb-bad)' : `1px solid ${meta.borda}`,
                                  boxShadow: 'var(--nb-shadow)', padding: '5px 8px', overflow: 'hidden', minWidth: 0,
                                  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1,
                                  cursor: 'pointer', textAlign: 'left', font: 'inherit',
                                }}
                              >
                                <span className="nb-num" style={{ fontSize: 10, color: 'var(--nb-ink-faint)', fontFamily: 'var(--nb-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {b.conflito && <Icon name="TriangleAlert" size={11} className="nb-bad" />}
                                  {largo ? `${hhmm(b.inicioMin)}–${hhmm(b.fimMin)}` : hhmm(b.inicioMin)}
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.cliente}</span>
                                {largo && b.servico && <span style={{ fontSize: 10.5, color: 'var(--nb-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.servico}</span>}
                                {width > 20 && <span style={{ marginTop: 2 }}><StatusBadge status={b.status} size="sm" /></span>}
                              </button>
                            );
                          })}
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
                        <a href="/agenda" className="nb-btn nb-btn-primary" style={{ textDecoration: 'none' }}><Icon name="Plus" size={15} /> Criar agendamento</a>
                      </div>
                    </div>
                  )}

                  {/* linha do horário atual */}
                  {ehHoje && posAgora >= 0 && posAgora <= 100 && !loading && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${NOMECOL.width}px + ${posAgora}% * (100% - ${NOMECOL.width}px) / 100)`, width: 2, background: 'var(--nb-bad)', zIndex: 4, pointerEvents: 'none' }}>
                      <span style={{ position: 'absolute', top: 4, left: 4, background: 'var(--nb-bad)', color: '#fff', fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--nb-mono)', padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap', boxShadow: 'var(--nb-shadow)' }}>{hhmm(agora)}</span>
                      <span style={{ position: 'absolute', top: -1, left: -3, width: 8, height: 8, borderRadius: '50%', background: 'var(--nb-bad)' }} />
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
              <Card><EmptyState icon="CalendarOff" titulo="Nenhum agendamento encontrado" texto={temFiltroAtivo(filtros) ? 'Ajuste os filtros ou selecione outra data.' : 'Use os filtros ou selecione outra data.'} acao={{ label: 'Criar agendamento', href: '/agenda' }} /></Card>
            ) : colabsExibidas.map((c) => {
              const bs = blocosDe(c.id).sort((a, b) => a.inicioMin - b.inicioMin);
              return (
                <Card key={c.id} pad={false}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderBottom: '1px solid var(--nb-rule-soft)' }}>
                    <Avatar nome={c.nome} cor={corDe(c.id)} size={26} />
                    <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{c.nome}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{bs.length} agend.</span>
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

      {sel && (
        <AgendaDetalhe bloco={sel} cor={corDe(sel.colaboradorId)} receitaConfiavel={receitaConfiavel} onClose={() => setSel(null)} />
      )}
    </PageShell>
  );
}

const NOMECOL: React.CSSProperties = { width: 168, flex: '0 0 168px', padding: '0 14px', position: 'sticky', left: 0, background: 'var(--nb-surface)', zIndex: 2 };

function Kpi({ icon, label, value, sub, tone, alerta }: { icon: string; label: string; value: string; sub?: string; tone?: 'warn'; alerta?: boolean }) {
  return (
    <div className="nb-card nb-card-pad" style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <span aria-hidden style={{ width: 42, height: 42, borderRadius: 11, background: '#F0E7D8', color: 'var(--nb-gold)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><Icon name={icon} size={19} /></span>
      <div style={{ minWidth: 0 }}>
        <div className="nb-eyebrow" style={{ fontSize: 10 }}>{label}</div>
        <div className="nb-num" style={{ fontSize: 22, fontWeight: 680, color: tone === 'warn' ? 'var(--nb-warn)' : 'var(--nb-ink)', lineHeight: 1.12 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: alerta ? 'var(--nb-warn)' : 'var(--nb-ink-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>{alerta && <Icon name="Info" size={11} />}{sub}</div>}
      </div>
    </div>
  );
}
function Leg({ cor, texto }: { cor: string; texto: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: cor }} />{texto}</span>;
}
function Vazio({ texto }: { texto: string }) {
  return <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--nb-ink-faint)', fontSize: 13 }}>{texto}</div>;
}
