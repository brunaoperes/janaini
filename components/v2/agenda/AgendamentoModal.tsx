'use client';

// Modal PREMIUM de criar/editar agendamento da Agenda V2.
// Reaproveita a API de produção POST/PUT /api/agendamentos (não a altera).
// Cliente: autocomplete /api/clientes?search + cadastro inline via POST /api/clientes.
// Colaboradora: select. Serviços: catálogo (pré-preenche duração/valor/descrição, editáveis).
// Data + hora início + duração → hora fim automática. Valor estimado + observações.
//
// Isolado em /v2 — visual champagne/grafite/mauve (theme.css), zero emoji.

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/v2/ui/Icon';
import Button from '@/components/v2/ui/Button';
import { brl } from '@/lib/v2/formatters';
import { Avatar } from './_ui';

// ---- tipos leves (evita acoplar aos tipos de produção) ---------------------
type Colab = { id: number; nome: string; porcentagem_comissao?: number };
type Servico = { id: number; nome: string; duracao_minutos?: number; valor?: number; descricao?: string | null };
type ClienteLite = { id: number; nome: string; telefone?: string | null };

export type AgendamentoEdit = {
  id: number;
  cliente_id: number;
  colaborador_id: number;
  data_hora: string;
  descricao_servico?: string | null;
  duracao_minutos?: number | null;
  valor_estimado?: number | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  observacoes?: string | null;
  cliente?: { nome?: string; telefone?: string | null } | null;
};

type Props = {
  colabs: Colab[];
  servicos: Servico[];
  /** Data padrão (dia aberto na agenda), 'YYYY-MM-DD'. */
  dataPadrao: string;
  /** Pré-preenchimento ao clicar num espaço vazio da timeline. */
  preColabId?: number | null;
  preHoraInicio?: string | null; // 'HH:MM'
  /** Quando presente, abre em modo EDIÇÃO. */
  agendamento?: AgendamentoEdit | null;
  onClose: () => void;
  onSaved: () => void; // recarrega a agenda
};

// ---- helpers de horário -----------------------------------------------------
const clampMin = (m: number) => Math.max(0, Math.min(23 * 60 + 59, m));
const minToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const hhmmToMin = (s?: string | null): number | null => {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const soDigitos = (s: string) => (s || '').replace(/\D/g, '');

// Extrai HH:MM de um data_hora ('YYYY-MM-DD HH:MM:SS' ou ISO) sem depender de fuso.
const horaDeDataHora = (dh?: string | null): string | null => {
  if (!dh) return null;
  const m = /[T ](\d{2}):(\d{2})/.exec(dh);
  return m ? `${m[1]}:${m[2]}` : null;
};
const dataDeDataHora = (dh?: string | null): string | null => {
  if (!dh) return null;
  const m = /(\d{4}-\d{2}-\d{2})/.exec(dh);
  return m ? m[1] : null;
};

export default function AgendamentoModal({
  colabs, servicos, dataPadrao, preColabId, preHoraInicio, agendamento, onClose, onSaved,
}: Props) {
  const editando = !!agendamento;

  // ---- estado do cliente ----------------------------------------------------
  const [clienteId, setClienteId] = useState<number | null>(agendamento?.cliente_id ?? null);
  const [clienteNome, setClienteNome] = useState<string>(agendamento?.cliente?.nome ?? '');
  const [clienteTel, setClienteTel] = useState<string>(agendamento?.cliente?.telefone ?? '');
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<ClienteLite[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [showSug, setShowSug] = useState(false);
  // cadastro inline
  const [criando, setCriando] = useState(false);
  const [novoTelefone, setNovoTelefone] = useState('');
  const [salvandoCliente, setSalvandoCliente] = useState(false);

  // ---- demais campos --------------------------------------------------------
  const [colaboradorId, setColaboradorId] = useState<number | ''>(
    agendamento?.colaborador_id ?? (preColabId ?? '')
  );
  const [servSel, setServSel] = useState<string[]>(
    agendamento?.descricao_servico ? agendamento.descricao_servico.split(' + ').map((s) => s.trim()).filter(Boolean) : []
  );
  const [buscaServico, setBuscaServico] = useState('');
  const [data, setData] = useState<string>(
    (editando ? dataDeDataHora(agendamento?.data_hora) : null) || dataPadrao
  );
  const [horaInicio, setHoraInicio] = useState<string>(
    (editando ? (agendamento?.hora_inicio || horaDeDataHora(agendamento?.data_hora)) : preHoraInicio) || '09:00'
  );
  const [duracao, setDuracao] = useState<number>(agendamento?.duracao_minutos || 60);
  const [valor, setValor] = useState<string>(
    agendamento?.valor_estimado != null && agendamento.valor_estimado > 0 ? String(agendamento.valor_estimado) : ''
  );
  const [observacoes, setObservacoes] = useState<string>(agendamento?.observacoes || '');
  const [salvando, setSalvando] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  // Fecha no ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Autocomplete de cliente (debounce 250ms)
  useEffect(() => {
    if (clienteId) return; // já selecionado
    const q = busca.trim();
    if (q.length < 2) { setSugestoes([]); return; }
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/clientes?search=${encodeURIComponent(q)}`, { cache: 'no-store' });
        const j = await r.json();
        if (vivo) { setSugestoes((j.data || []) as ClienteLite[]); setShowSug(true); }
      } catch { /* silencioso */ }
      finally { if (vivo) setBuscando(false); }
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [busca, clienteId]);

  // Mapa nome→serviço (normalizado) para somar duração/valor a partir dos nomes selecionados.
  const mapaServ = useMemo(() => {
    const m = new Map<string, Servico>();
    for (const s of servicos) m.set(norm(s.nome), s);
    return m;
  }, [servicos]);

  // Ao (re)selecionar serviços, recomputa duração/valor a partir do catálogo (mantém editável).
  const aplicarServicos = (nomes: string[]) => {
    setServSel(nomes);
    const encontrados = nomes.map((n) => mapaServ.get(norm(n))).filter(Boolean) as Servico[];
    if (encontrados.length > 0) {
      const somaDur = encontrados.reduce((a, s) => a + (Number(s.duracao_minutos) || 0), 0);
      const somaVal = encontrados.reduce((a, s) => a + (Number(s.valor) || 0), 0);
      if (somaDur > 0) setDuracao(somaDur);
      if (somaVal > 0) setValor(String(somaVal));
    }
  };
  const toggleServico = (nome: string) => {
    const existe = servSel.some((s) => norm(s) === norm(nome));
    aplicarServicos(existe ? servSel.filter((s) => norm(s) !== norm(nome)) : [...servSel, nome]);
  };

  const servicosFiltrados = useMemo(() => {
    const q = norm(buscaServico);
    const lista = q ? servicos.filter((s) => norm(s.nome).includes(q)) : servicos;
    return lista.slice(0, 60);
  }, [servicos, buscaServico]);

  const inicioMin = hhmmToMin(horaInicio);
  const horaFim = inicioMin != null && duracao > 0 ? minToHHMM(clampMin(inicioMin + duracao)) : null;
  const descricaoServico = servSel.join(' + ');

  async function selecionarNovoCliente() {
    const nome = busca.trim();
    if (nome.length < 2) { toast.error('Informe o nome do cliente.'); return; }
    if (soDigitos(novoTelefone).length < 8) { toast.error('Informe um telefone válido.'); return; }
    setSalvandoCliente(true);
    try {
      const r = await fetch('/api/clientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, telefone: novoTelefone.trim() }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || 'Não foi possível cadastrar o cliente.'); return; }
      const c = j.data as ClienteLite;
      setClienteId(c.id); setClienteNome(c.nome); setClienteTel(c.telefone || novoTelefone.trim());
      setCriando(false); setShowSug(false); setBusca(''); setNovoTelefone('');
      toast.success('Cliente cadastrado.');
    } catch { toast.error('Erro de conexão ao cadastrar cliente.'); }
    finally { setSalvandoCliente(false); }
  }

  function escolherCliente(c: ClienteLite) {
    setClienteId(c.id); setClienteNome(c.nome); setClienteTel(c.telefone || '');
    setShowSug(false); setBusca(''); setSugestoes([]);
  }
  function limparCliente() {
    setClienteId(null); setClienteNome(''); setClienteTel('');
    setBusca(''); setCriando(false);
    setTimeout(() => buscaRef.current?.focus(), 0);
  }

  async function salvar() {
    if (!clienteId) { toast.error('Selecione ou cadastre um cliente.'); return; }
    if (!colaboradorId) { toast.error('Selecione a profissional.'); return; }
    if (!data) { toast.error('Informe a data.'); return; }
    if (inicioMin == null) { toast.error('Informe a hora de início.'); return; }
    if (!(duracao > 0)) { toast.error('A duração deve ser maior que zero.'); return; }
    if (!descricaoServico) { toast.error('Selecione ao menos um serviço.'); return; }

    const valorEstimado = Math.round((parseFloat(valor.replace(',', '.')) || 0) * 100) / 100;
    const dataHora = `${data} ${horaInicio}:00`;
    const payload: Record<string, any> = {
      colaborador_id: Number(colaboradorId),
      cliente_id: clienteId,
      data_hora: dataHora,
      descricao_servico: descricaoServico,
      duracao_minutos: duracao,
      valor_estimado: valorEstimado,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      observacoes: observacoes.trim() || null,
    };

    setSalvando(true);
    try {
      const r = await fetch('/api/agendamentos', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editando ? { id: agendamento!.id, ...payload } : payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.error) { toast.error(j?.error || 'Não foi possível salvar o agendamento.'); return; }
      toast.success(editando ? 'Agendamento atualizado.' : 'Agendamento criado.');
      if (j?.aviso) toast(j.aviso, { icon: '⚠️', duration: 6000 });
      onSaved();
    } catch { toast.error('Erro de conexão.'); }
    finally { setSalvando(false); }
  }

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'color-mix(in srgb, var(--nb-ink) 40%, transparent)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="nb-card"
        style={{ width: '100%', maxWidth: 560, maxHeight: '94dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--nb-rule)' }}>
          <span aria-hidden style={{ width: 40, height: 40, borderRadius: 11, background: '#F0E7D8', color: 'var(--nb-gold)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
            <Icon name={editando ? 'CalendarClock' : 'CalendarDays'} size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>{editando ? 'Editar agendamento' : 'Novo agendamento'}</div>
            <div style={{ fontSize: 16, fontWeight: 620, color: 'var(--nb-ink)' }}>{editando ? (clienteNome || 'Agendamento') : 'Agendar atendimento'}</div>
          </div>
          <button className="nb-btn nb-btn-quiet" onClick={onClose} aria-label="Fechar"><Icon name="X" size={18} /></button>
        </div>

        {/* corpo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* CLIENTE */}
          <Campo label="Cliente" obrig>
            {clienteId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', borderRadius: 12, padding: '9px 12px' }}>
                <Avatar nome={clienteNome} cor="var(--nb-accent-deep)" size={30} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clienteNome}</span>
                  {clienteTel && <span style={{ fontSize: 12, color: 'var(--nb-ink-faint)' }}>{clienteTel}</span>}
                </span>
                <button className="nb-btn nb-btn-quiet" onClick={limparCliente} style={{ fontSize: 12, padding: '4px 8px' }}>Trocar</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', pointerEvents: 'none' }}><Icon name="Search" size={16} /></span>
                <input
                  ref={buscaRef} className="nb-input" value={busca} autoFocus
                  onChange={(e) => { setBusca(e.target.value); setShowSug(true); setCriando(false); }}
                  onFocus={() => setShowSug(true)}
                  placeholder="Buscar cliente pelo nome…" style={{ paddingLeft: 34 }}
                />
                {showSug && busca.trim().length >= 2 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 5, background: 'var(--nb-surface)', border: '1px solid var(--nb-rule)', borderRadius: 12, boxShadow: 'var(--nb-shadow-md)', maxHeight: 240, overflowY: 'auto' }}>
                    {buscando ? (
                      <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--nb-ink-faint)' }}>Buscando…</div>
                    ) : sugestoes.length > 0 ? (
                      sugestoes.map((c) => (
                        <button key={c.id} onClick={() => escolherCliente(c)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--nb-rule-soft)', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
                          <Avatar nome={c.nome} cor="var(--nb-accent-deep)" size={26} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                            {c.telefone && <span style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{c.telefone}</span>}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--nb-ink-faint)' }}>Nenhum cliente encontrado.</div>
                    )}
                    {/* cadastro inline */}
                    {!criando ? (
                      <button onClick={() => setCriando(true)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--nb-surface-2)', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'var(--nb-accent-deep)', fontWeight: 560, fontSize: 13 }}>
                        <Icon name="UserPlus" size={15} /> Cadastrar “{busca.trim()}”
                      </button>
                    ) : (
                      <div style={{ padding: '10px 12px', background: 'var(--nb-surface-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="nb-eyebrow" style={{ fontSize: 9.5 }}>Novo cliente · {busca.trim()}</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input className="nb-input" value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} placeholder="Telefone (WhatsApp)" inputMode="tel" style={{ flex: 1 }} />
                          <Button icon="Check" onClick={selecionarNovoCliente} disabled={salvandoCliente} style={{ whiteSpace: 'nowrap' }}>
                            {salvandoCliente ? 'Salvando…' : 'Cadastrar'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Campo>

          {/* PROFISSIONAL */}
          <Campo label="Profissional" obrig>
            <select className="v2-select" value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value ? Number(e.target.value) : '')} style={{ width: '100%' }}>
              <option value="">Selecione a profissional…</option>
              {colabs.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>

          {/* SERVIÇOS */}
          <Campo label="Serviços" obrig>
            {servSel.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {servSel.map((s) => (
                  <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', border: '1px solid var(--nb-accent)', borderRadius: 20, padding: '3px 6px 3px 10px', fontSize: 12.5, fontWeight: 560 }}>
                    {s}
                    <button onClick={() => toggleServico(s)} aria-label={`Remover ${s}`} style={{ display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}><Icon name="X" size={13} /></button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', pointerEvents: 'none' }}><Icon name="Scissors" size={15} /></span>
              <input className="nb-input" value={buscaServico} onChange={(e) => setBuscaServico(e.target.value)} placeholder="Buscar serviço do catálogo…" style={{ paddingLeft: 34 }} />
            </div>
            <div style={{ marginTop: 8, maxHeight: 168, overflowY: 'auto', border: '1px solid var(--nb-rule)', borderRadius: 10 }}>
              {servicosFiltrados.length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--nb-ink-faint)' }}>Nenhum serviço encontrado.</div>
              ) : servicosFiltrados.map((s) => {
                const marcado = servSel.some((x) => norm(x) === norm(s.nome));
                return (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--nb-rule-soft)', cursor: 'pointer', background: marcado ? 'var(--nb-accent-wash)' : 'transparent' }}>
                    <input type="checkbox" checked={marcado} onChange={() => toggleServico(s.nome)} style={{ accentColor: 'var(--nb-accent)' }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nome}</span>
                    <span style={{ display: 'inline-flex', gap: 8, flex: '0 0 auto' }}>
                      {!!s.duracao_minutos && <span className="nb-num" style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{s.duracao_minutos}min</span>}
                      {!!s.valor && <span className="nb-num" style={{ fontSize: 12, fontWeight: 560, color: 'var(--nb-ink-soft)' }}>{brl(s.valor)}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </Campo>

          {/* DATA + HORA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo label="Data" obrig>
              <input type="date" className="v2-select" value={data} onChange={(e) => setData(e.target.value)} style={{ width: '100%', paddingRight: 12 }} />
            </Campo>
            <Campo label="Hora de início" obrig>
              <input type="time" step={300} className="v2-select" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} style={{ width: '100%', paddingRight: 12 }} />
            </Campo>
          </div>

          {/* DURAÇÃO + VALOR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo label="Duração (min)" obrig>
              <input type="number" min={15} step={15} className="nb-input nb-num" value={duracao || ''} onChange={(e) => setDuracao(Math.max(0, Number(e.target.value) || 0))} />
            </Campo>
            <Campo label="Valor estimado">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', fontSize: 13, pointerEvents: 'none' }}>R$</span>
                <input type="number" min={0} step="0.01" className="nb-input nb-num" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" style={{ paddingLeft: 34 }} />
              </div>
            </Campo>
          </div>

          {/* Término calculado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--nb-ink-soft)', background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', borderRadius: 10, padding: '9px 12px' }}>
            <Icon name="Clock" size={15} />
            {horaFim
              ? <span>Término previsto às <strong className="nb-num" style={{ color: 'var(--nb-ink)' }}>{horaFim}</strong> · {horaInicio}–{horaFim}</span>
              : <span>Informe hora de início e duração para calcular o término.</span>}
          </div>

          {/* OBSERVAÇÕES */}
          <Campo label="Observações (opcional)">
            <textarea className="nb-input" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex.: cliente prefere café, alergia a amônia…" rows={2} style={{ resize: 'vertical', minHeight: 46 }} />
          </Campo>
        </div>

        {/* footer */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 18px', borderTop: '1px solid var(--nb-rule)' }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancelar</Button>
          <Button icon="Check" onClick={salvar} disabled={salvando} style={{ flex: 1, justifyContent: 'center' }}>
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar agendamento'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, obrig, children }: { label: string; obrig?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="nb-eyebrow" style={{ fontSize: 9.5 }}>
        {label}{obrig && <span style={{ color: 'var(--nb-accent-deep)', marginLeft: 3 }}>*</span>}
      </span>
      {children}
    </label>
  );
}
