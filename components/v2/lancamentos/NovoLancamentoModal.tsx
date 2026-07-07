'use client';

/**
 * NovoLancamentoModal (V2) — modal premium para criar/editar um lançamento.
 *
 * Isolado em /v2. NÃO altera a produção: reusa a API de escrita
 *   POST  /api/lancamentos        (novo)
 *   PUT   /api/lancamentos/:id     (edição)
 * e o cálculo financeiro de `lib/pagamento-utils` (calcularPagamentos / validarPagamentos).
 * A regra financeira é IDÊNTICA à do NovoLancamentoModal de produção — nada foi reimplementado
 * "do zero": a lógica de comissão/taxa/parte-do-salão foi copiada e apenas revestida com o visual V2.
 *
 * Identidade preservada: valor_total = comissao_colaborador + comissao_salao + taxa_pagamento.
 *
 * Dados de referência (colaboradoras, serviços, formas de pagamento, perfil) vêm da própria
 * GET /api/lancamentos (mesma fonte da produção), carregados uma vez e cacheados no módulo.
 *
 * Fora de escopo (usar a tela clássica): serviços COMPARTILHADOS (divisão entre colaboradoras).
 * Lançamentos compartilhados são detectados e a edição é redirecionada para a tela clássica.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/v2/ui/Icon';
import Button from '@/components/v2/ui/Button';
import PayIcon from './PayIcon';
import { Avatar } from './_shared';
import { brl } from '@/lib/v2/formatters';
import {
  PagamentoForm,
  FormaPagamentoDB,
  calcularPagamentos,
  validarPagamentos,
} from '@/lib/pagamento-utils';
import { lancamentoSchema, formatZodErrors } from '@/lib/validations';

/* ---------------------------------------------------------------- tipos */
type Colaborador = { id: number; nome: string; porcentagem_comissao: number };
type Cliente = { id: number; nome: string; telefone: string | null };
type Servico = { id: number; nome: string; valor: number; duracao_minutos: number };
type UserProfile = { isAdmin: boolean; colaboradorId: number | null };

interface Props {
  open: boolean;
  /** id do lançamento a editar; null/undefined = novo */
  editId?: number | null;
  onClose: () => void;
  /** chamado após salvar com sucesso (a página recarrega a lista) */
  onSaved: () => void;
}

/* ---------------------------------------------------------------- helpers de horário (iguais à produção) */
const hojeBRT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

const somaMinutos = (hhmm: string, min: number): string => {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  let t = h * 60 + m + min;
  if (t > 23 * 60 + 59) t = 23 * 60 + 59;
  if (t < 0) t = 0;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/* ---------------------------------------------------------------- cache de dados de referência (uma carga) */
type RefData = {
  colaboradores: Colaborador[];
  clientes: Cliente[];
  servicos: Servico[];
  formasPagamento: FormaPagamentoDB[];
  userProfile: UserProfile;
};
let REF_CACHE: RefData | null = null;

async function carregarRef(): Promise<RefData> {
  if (REF_CACHE) return REF_CACHE;
  const r = await fetch('/api/lancamentos?filtro=hoje', { cache: 'no-store' });
  const j = await r.json();
  REF_CACHE = {
    colaboradores: j.colaboradores || [],
    clientes: j.clientes || [],
    servicos: j.servicos || [],
    formasPagamento: j.formasPagamento || [],
    userProfile: {
      isAdmin: !!j._userProfile?.isAdmin,
      colaboradorId: j._userProfile?.colaboradorId ?? null,
    },
  };
  return REF_CACHE;
}

const FORM_VAZIO = {
  colaborador_id: '',
  cliente_id: '',
  data: hojeBRT(),
  hora_inicio: '09:00',
  hora_fim: '10:00',
  servicos_ids: [] as number[],
  valor_total: '',
  observacoes: '',
  is_fiado: false,
  is_troca_gratis: false,
  valor_referencia: '',
};

/* ================================================================ componente */
export default function NovoLancamentoModal({ open, editId, onClose, onSaved }: Props) {
  const [ref, setRef] = useState<RefData | null>(REF_CACHE);
  const [carregandoRef, setCarregandoRef] = useState(false);
  const [carregandoEdicao, setCarregandoEdicao] = useState(false);
  const [bloqueado, setBloqueado] = useState<string | null>(null); // compartilhado → usa tela clássica
  const edicaoReq = useRef(0); // guarda de corrida: só a última carga de edição aplica o form

  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [pagamentos, setPagamentos] = useState<PagamentoForm[]>([]);
  const [jaRealizado, setJaRealizado] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [filtroServico, setFiltroServico] = useState('');

  const colaboradores = ref?.colaboradores || [];
  const servicos = ref?.servicos || [];
  const formasPagamentoDB = ref?.formasPagamento || [];
  const userProfile = ref?.userProfile || null;

  const selectedColaborador = useMemo(
    () => colaboradores.find((c) => c.id === Number(form.colaborador_id)) || null,
    [colaboradores, form.colaborador_id],
  );

  /* ------------------------------------------------ carga de dados de referência ao abrir */
  useEffect(() => {
    if (!open || ref) return;
    let vivo = true;
    setCarregandoRef(true);
    carregarRef()
      .then((d) => { if (vivo) setRef(d); })
      .catch(() => { if (vivo) toast.error('Não foi possível carregar os dados do formulário.'); })
      .finally(() => { if (vivo) setCarregandoRef(false); });
    return () => { vivo = false; };
  }, [open, ref]);

  /* ------------------------------------------------ inicializa/reseta o form ao abrir */
  useEffect(() => {
    if (!open) return;
    setErro('');
    setBloqueado(null);
    if (editId) {
      void carregarParaEdicao(editId);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId, ref]);

  /* ------------------------------------------------ ESC fecha */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, salvando, onClose]);

  function resetForm() {
    // pré-seleciona a colaboradora do próprio usuário (não-admin), igual à produção
    let preColabId = '';
    if (userProfile?.colaboradorId) {
      const c = colaboradores.find((x) => x.id === userProfile.colaboradorId);
      if (c) preColabId = String(c.id);
    }
    setForm({ ...FORM_VAZIO, data: hojeBRT(), colaborador_id: preColabId });
    setPagamentos([]);
    setJaRealizado(false);
    setEditingId(null);
    setFiltroServico('');
  }

  async function carregarParaEdicao(id: number) {
    const meu = ++edicaoReq.current; // esta é a carga mais recente
    setCarregandoEdicao(true);
    try {
      const res = await fetch(`/api/lancamentos/${id}`, { cache: 'no-store' });
      if (!res.ok) { toast.error('Erro ao carregar dados do lançamento'); onClose(); return; }
      const result = await res.json();
      const l = result.data || result;
      if (!l || !l.id) { toast.error('Lançamento não encontrado'); onClose(); return; }

      // Compartilhado é tratado apenas na tela clássica (divisão entre colaboradoras).
      if (l.compartilhado) {
        setBloqueado(`/lancamentos?editar=${l.id}`);
        setEditingId(l.id);
        setCarregandoEdicao(false);
        return;
      }

      const dataRaw = String(l.data || '');
      const dataMatch = dataRaw.match(/(\d{4}-\d{2}-\d{2})/);
      const dataStr = dataMatch ? dataMatch[1] : (dataRaw.split('T')[0] || hojeBRT());
      const horaInicio = l.hora_inicio ? String(l.hora_inicio).substring(0, 5) : '09:00';
      const horaFim = l.hora_fim ? String(l.hora_fim).substring(0, 5) : '10:00';

      // serviços do lançamento — fonte primária: servicos_ids (normalizado p/ number[]).
      let servicosIds: number[] = Array.isArray(l.servicos_ids)
        ? l.servicos_ids.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x))
        : [];
      // fallback: sem ids mas com nomes → casa por nome no catálogo (separador " + "; nome único pode ter "/").
      if (servicosIds.length === 0 && l.servicos_nomes && servicos.length > 0) {
        const nomes = String(l.servicos_nomes).split(/\s*\+\s*/).map((s: string) => s.trim().toLowerCase()).filter(Boolean);
        servicosIds = servicos.filter((s) => nomes.includes(s.nome.trim().toLowerCase())).map((s) => s.id);
      }

      if (meu !== edicaoReq.current) return; // uma carga mais nova assumiu — não sobrescreve com dado velho

      setForm({
        colaborador_id: l.colaborador_id != null ? String(l.colaborador_id) : '',
        cliente_id: l.cliente_id != null ? String(l.cliente_id) : '',
        data: dataStr,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        servicos_ids: servicosIds,
        valor_total: (l.valor_total ?? 0).toFixed(2),
        observacoes: l.observacoes || '',
        is_fiado: !!l.is_fiado,
        is_troca_gratis: !!l.is_troca_gratis,
        valor_referencia: l.valor_referencia != null ? String(l.valor_referencia) : '',
      });
      setJaRealizado(l.status === 'concluido' || !!l.is_fiado || !!l.is_troca_gratis);
      setEditingId(l.id);
      setFiltroServico('');

      // cliente selecionado (para o autocomplete)
      const cli = (ref?.clientes || []).find((c) => c.id === l.cliente_id);
      setClienteSel(cli || (l.cliente_id ? { id: l.cliente_id, nome: l.cliente_nome || 'Cliente', telefone: null } : null));

      if (Array.isArray(l.pagamentos) && l.pagamentos.length > 0) {
        setPagamentos(l.pagamentos.map((p: any) => ({
          forma_pagamento: p.forma_pagamento,
          valor: Number(p.valor).toFixed(2),
        })));
      } else if (l.forma_pagamento && !l.is_fiado && !l.is_troca_gratis && l.forma_pagamento !== 'multiplo') {
        setPagamentos([{ forma_pagamento: l.forma_pagamento, valor: Number(l.valor_total).toFixed(2) }]);
      } else {
        setPagamentos([]);
      }
    } catch (e: any) {
      toast.error('Erro ao abrir edição: ' + (e?.message || 'erro desconhecido'));
      onClose();
    } finally {
      setCarregandoEdicao(false);
    }
  }

  /* ------------------------------------------------ cliente selecionado (autocomplete) */
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);
  useEffect(() => { if (!open) setClienteSel(null); }, [open]);

  /* ------------------------------------------------ serviços / valores */
  const somaCatalogo = useMemo(
    () => form.servicos_ids.reduce((t, id) => t + (servicos.find((s) => s.id === id)?.valor || 0), 0),
    [form.servicos_ids, servicos],
  );
  const duracaoTotal = useMemo(() => {
    const t = form.servicos_ids.reduce((acc, id) => {
      const s = servicos.find((x) => x.id === id);
      return acc + (s?.duracao_minutos && s.duracao_minutos > 0 ? s.duracao_minutos : 0);
    }, 0);
    return t > 0 ? t : 30;
  }, [form.servicos_ids, servicos]);

  function toggleServico(id: number) {
    setForm((prev) => {
      const novos = prev.servicos_ids.includes(id)
        ? prev.servicos_ids.filter((x) => x !== id)
        : [...prev.servicos_ids, id];
      const soma = novos.reduce((t, sid) => t + (servicos.find((s) => s.id === sid)?.valor || 0), 0);
      const dur = novos.reduce((acc, sid) => {
        const s = servicos.find((x) => x.id === sid);
        return acc + (s?.duracao_minutos && s.duracao_minutos > 0 ? s.duracao_minutos : 0);
      }, 0) || 30;
      return {
        ...prev,
        servicos_ids: novos,
        valor_total: prev.is_troca_gratis ? prev.valor_total : soma.toFixed(2),
        hora_fim: somaMinutos(prev.hora_inicio, dur),
      };
    });
  }

  function setHoraInicio(v: string) {
    setForm((prev) => ({ ...prev, hora_inicio: v, hora_fim: somaMinutos(v, duracaoTotal) }));
  }

  /* ------------------------------------------------ PREVIEW do cálculo (mesma fórmula da produção) */
  const isRecebimentoMonetario = jaRealizado && !form.is_fiado && !form.is_troca_gratis;
  const porcentagemColab = selectedColaborador?.porcentagem_comissao ?? 50;
  const valorTotalNum = parseFloat(form.valor_total) || 0;

  const preview = useMemo(() => {
    let valorTaxa = 0, comissaoColaborador = 0, comissaoSalao = 0;
    if (form.is_troca_gratis) {
      // tudo zero
    } else if (form.is_fiado) {
      comissaoColaborador = (valorTotalNum * porcentagemColab) / 100;
      comissaoSalao = valorTotalNum - comissaoColaborador;
    } else if (isRecebimentoMonetario && pagamentos.length > 0) {
      const calc = calcularPagamentos(pagamentos, porcentagemColab, formasPagamentoDB);
      valorTaxa = calc.valorTaxa;
      comissaoColaborador = calc.comissaoColaborador;
      comissaoSalao = calc.comissaoSalao;
    } else {
      // ainda não recebido: estimativa bruta pela % da colaboradora (sem taxa)
      comissaoColaborador = (valorTotalNum * porcentagemColab) / 100;
      comissaoSalao = valorTotalNum - comissaoColaborador;
    }
    return {
      bruto: form.is_troca_gratis ? 0 : valorTotalNum,
      taxa: valorTaxa,
      comissao: comissaoColaborador,
      salao: comissaoSalao,
      confirmado: form.is_troca_gratis || form.is_fiado || (isRecebimentoMonetario && pagamentos.length > 0),
    };
  }, [form.is_troca_gratis, form.is_fiado, valorTotalNum, porcentagemColab, isRecebimentoMonetario, pagamentos, formasPagamentoDB]);

  const somaPag = pagamentos.reduce((a, p) => a + (parseFloat(p.valor) || 0), 0);
  const canViewComissao = !!selectedColaborador && (userProfile?.isAdmin || userProfile?.colaboradorId === selectedColaborador.id);

  /* ------------------------------------------------ salvar (lógica idêntica à produção) */
  async function handleSubmit() {
    setErro('');
    setSalvando(true);
    try {
      const servicosNomes = form.servicos_ids
        .map((id) => servicos.find((s) => s.id === id)?.nome)
        .filter(Boolean)
        .join(' + ');

      const recebeuAgora = jaRealizado && !form.is_fiado && !form.is_troca_gratis;

      if (recebeuAgora) {
        const erroPag = validarPagamentos(pagamentos, valorTotalNum);
        if (erroPag) { setErro(erroPag); setSalvando(false); return; }
      }

      let statusFinal: 'pendente' | 'concluido' = 'pendente';
      if (form.is_fiado) statusFinal = 'pendente';
      else if (form.is_troca_gratis) statusFinal = 'concluido';
      else if (jaRealizado) statusFinal = 'concluido';

      let valorTaxa = 0, comissaoColaborador = 0, comissaoSalao = 0;
      let pagamentosDetalhados: any[] = [];
      let formaPagamentoPrincipal = '';

      if (form.is_troca_gratis) {
        comissaoColaborador = 0; comissaoSalao = 0;
      } else if (form.is_fiado) {
        const comissaoBruta = (valorTotalNum * porcentagemColab) / 100;
        comissaoColaborador = comissaoBruta;
        comissaoSalao = valorTotalNum - comissaoBruta;
      } else if (recebeuAgora) {
        const calc = calcularPagamentos(pagamentos, porcentagemColab, formasPagamentoDB);
        pagamentosDetalhados = calc.detalhados;
        valorTaxa = calc.valorTaxa;
        comissaoColaborador = calc.comissaoColaborador;
        comissaoSalao = calc.comissaoSalao;
        formaPagamentoPrincipal = calc.formaPrincipal;
      }

      // validação de esquema (mesmos campos exigidos pela produção)
      const validationData = {
        colaborador_id: Number(form.colaborador_id),
        cliente_id: Number(form.cliente_id),
        data: form.data,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
        servicos_ids: form.servicos_ids,
        servicos_nomes: servicosNomes,
        valor_total: valorTotalNum,
        observacoes: form.observacoes || undefined,
        status: statusFinal,
        forma_pagamento: jaRealizado ? formaPagamentoPrincipal : undefined,
      };
      const validation = lancamentoSchema.safeParse(validationData);
      if (!validation.success) { setErro(formatZodErrors(validation.error)); setSalvando(false); return; }

      if (!form.hora_inicio) { setErro('Horário de início é obrigatório'); setSalvando(false); return; }
      // término > início
      const [hi, mi] = form.hora_inicio.split(':').map(Number);
      const [hf, mf] = form.hora_fim.split(':').map(Number);
      if (form.hora_fim && (hf * 60 + mf) <= (hi * 60 + mi)) {
        setErro('O horário de término deve ser depois do horário de início.');
        setSalvando(false); return;
      }

      const horaInicioFmt = form.hora_inicio.length === 5 ? `${form.hora_inicio}:00` : form.hora_inicio;
      const dataCompleta = `${form.data} ${horaInicioFmt}`;
      const valorTotalFinal = form.is_troca_gratis ? 0 : valorTotalNum;
      const duracaoMin = (hf * 60 + mf) - (hi * 60 + mi);

      // Pré-checagem de conflito de horário (apenas na criação) — evita lançamento órfão
      if (!editingId) {
        try {
          const chk = await fetch('/api/agendamentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apenasVerificar: true,
              colaborador_id: validationData.colaborador_id,
              cliente_id: validationData.cliente_id,
              data_hora: dataCompleta,
              hora_inicio: form.hora_inicio,
              hora_fim: form.hora_fim || form.hora_inicio,
              duracao_minutos: duracaoMin,
            }),
          });
          if (chk.status === 409) {
            const j = await chk.json().catch(() => ({}));
            setErro(j.error || 'Conflito de horário: esta profissional já tem algo marcado nesse horário.');
            setSalvando(false); return;
          }
          const j = await chk.json().catch(() => ({}));
          if (j?.aviso) toast(j.aviso, { icon: '⚠️', duration: 5000 });
        } catch { /* rede falhou; o POST real revalida */ }
      }

      let formaPagamentoFinal: string | null = null;
      let dataPagamentoFinal: string | null = null;
      if (form.is_fiado) { formaPagamentoFinal = 'fiado'; dataPagamentoFinal = null; }
      else if (form.is_troca_gratis) { formaPagamentoFinal = 'troca_gratis'; dataPagamentoFinal = new Date().toISOString(); }
      else if (recebeuAgora) { formaPagamentoFinal = formaPagamentoPrincipal; dataPagamentoFinal = new Date().toISOString(); }

      const lancamentoData = {
        colaborador_id: validationData.colaborador_id,
        cliente_id: validationData.cliente_id,
        valor_total: valorTotalFinal,
        comissao_colaborador: comissaoColaborador,
        comissao_salao: comissaoSalao,
        taxa_pagamento: valorTaxa,
        data: dataCompleta,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
        servicos_ids: form.servicos_ids,
        servicos_nomes: servicosNomes,
        status: statusFinal,
        observacoes: form.observacoes || null,
        forma_pagamento: formaPagamentoFinal,
        data_pagamento: dataPagamentoFinal,
        compartilhado: false,
        is_fiado: form.is_fiado || false,
        is_troca_gratis: form.is_troca_gratis || false,
        valor_referencia: form.is_troca_gratis && form.valor_referencia ? parseFloat(form.valor_referencia) : null,
        pagamentos: recebeuAgora ? pagamentosDetalhados : [],
      };

      // POST (novo) ou PUT (edição) — mesma API da produção
      let lancamento: any = null;
      try {
        const url = editingId ? `/api/lancamentos/${editingId}` : '/api/lancamentos';
        const res = await fetch(url, {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lancamentoData),
        });
        if (!res.ok) {
          const t = await res.text();
          setErro(`Erro ao ${editingId ? 'atualizar' : 'criar'}: ${t}`);
          setSalvando(false); return;
        }
        lancamento = (await res.json()).data;
      } catch (e: any) {
        setErro(`Erro de conexão: ${e?.message || 'desconhecido'}`);
        setSalvando(false); return;
      }
      if (!lancamento) { setErro('Lançamento não retornado pela API'); setSalvando(false); return; }

      // Sincroniza a Agenda (awaited, não-bloqueante) — mesmo comportamento da produção
      let agendaOk = true;
      try {
        if (editingId) {
          const r = await fetch('/api/agendamentos', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lancamento_id: editingId,
              cliente_id: validationData.cliente_id,
              colaborador_id: validationData.colaborador_id,
              data_hora: dataCompleta,
              descricao_servico: servicosNomes,
              duracao_minutos: duracaoMin,
              valor_estimado: valorTotalNum,
              status: statusFinal,
              colaboradores_ids: [validationData.colaborador_id],
            }),
          });
          agendaOk = r.ok;
        } else {
          const r = await fetch('/api/agendamentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lancamento_id: lancamento.id,
              colaborador_id: validationData.colaborador_id,
              cliente_id: validationData.cliente_id,
              data_hora: dataCompleta,
              descricao_servico: servicosNomes,
              duracao_minutos: duracaoMin,
              valor_estimado: valorTotalNum,
              hora_inicio: form.hora_inicio,
              hora_fim: form.hora_fim || form.hora_inicio,
              colaboradores_ids: [validationData.colaborador_id],
            }),
          });
          agendaOk = r.ok;
        }
      } catch { agendaOk = false; }

      let extra = '';
      if (form.is_fiado) extra = ' — marcado como FIADO (pendente)';
      else if (form.is_troca_gratis) extra = ' — troca/grátis registrado';
      else if (recebeuAgora && pagamentos.length > 1) extra = ` — ${pagamentos.length} formas de pagamento`;
      else if (valorTaxa > 0) extra = ` (taxa −${brl(valorTaxa)})`;

      if (agendaOk) {
        toast.success((editingId ? 'Lançamento atualizado!' : 'Lançamento criado!') + extra);
      } else {
        toast.error('Lançamento salvo, mas NÃO apareceu na agenda. Edite o horário e salve de novo.', { duration: 9000 });
      }
      onClose();
      onSaved();
    } catch (e) {
      console.error('[NovoLancamentoModal] erro', e);
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (!open) return null;

  const titulo = editingId ? 'Editar lançamento' : 'Novo lançamento';
  const carregando = carregandoRef || carregandoEdicao || !ref;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="v2-root nlm-overlay"
    >
      <style>{CSS}</style>
      <div className="nb-card nlm-card" onClick={(e) => e.stopPropagation()}>
        {/* ---------------- header ---------------- */}
        <div className="nlm-header">
          <div style={{ minWidth: 0 }}>
            <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>{editingId ? 'Editar atendimento' : 'Registrar atendimento'}</div>
            <div style={{ fontFamily: 'var(--nb-serif)', fontSize: 20, color: 'var(--nb-ink)' }}>{titulo}</div>
          </div>
          <button className="nb-btn nb-btn-quiet" onClick={onClose} aria-label="Fechar" disabled={salvando}><Icon name="X" size={18} /></button>
        </div>

        {/* ---------------- corpo ---------------- */}
        {bloqueado ? (
          <div className="nlm-body">
            <div className="nlm-note nlm-note-warn">
              <Icon name="TriangleAlert" size={16} />
              <div>
                <strong>Atendimento compartilhado.</strong> A divisão entre profissionais é editada na tela clássica.
              </div>
            </div>
            <a href={bloqueado} className="nb-btn nb-btn-primary" style={{ justifyContent: 'center', textDecoration: 'none' }}>
              <Icon name="SlidersHorizontal" size={16} /> Abrir editor clássico
            </a>
          </div>
        ) : carregando ? (
          <div className="nlm-body">
            <div className="v2-skel" style={{ height: 44, borderRadius: 10 }} />
            <div className="v2-skel" style={{ height: 44, borderRadius: 10 }} />
            <div className="v2-skel" style={{ height: 120, borderRadius: 10 }} />
          </div>
        ) : (
          <div className="nlm-body">
            {erro && (
              <div className="nlm-note nlm-note-bad" style={{ whiteSpace: 'pre-line' }}>
                <Icon name="CircleAlert" size={16} />
                <div>{erro}</div>
              </div>
            )}

            {/* Profissional */}
            <Campo label="Profissional" req>
              <select
                className="v2-select" style={{ width: '100%' }}
                value={form.colaborador_id}
                onChange={(e) => setForm((p) => ({ ...p, colaborador_id: e.target.value }))}
              >
                <option value="">Selecione…</option>
                {colaboradores.map((c) => {
                  const mostra = userProfile?.isAdmin || userProfile?.colaboradorId === c.id;
                  return <option key={c.id} value={c.id}>{c.nome}{mostra ? ` · ${c.porcentagem_comissao}%` : ''}</option>;
                })}
              </select>
            </Campo>

            {/* Cliente */}
            <Campo label="Cliente" req>
              <ClienteBusca
                selecionado={clienteSel}
                onSelect={(c) => { setClienteSel(c); setForm((p) => ({ ...p, cliente_id: c ? String(c.id) : '' })); }}
              />
            </Campo>

            {/* Data + Início + Fim */}
            <div className="nlm-grid3">
              <Campo label="Data" req>
                <input type="date" className="v2-select" style={{ width: '100%', paddingRight: 12 }}
                  value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
              </Campo>
              <Campo label="Início" req>
                <input type="time" className="v2-select" style={{ width: '100%', paddingRight: 12 }}
                  value={form.hora_inicio} onChange={(e) => setHoraInicio(e.target.value)} />
              </Campo>
              <Campo label={`Fim · ${duracaoTotal}min`}>
                <input type="time" className="v2-select" style={{ width: '100%', paddingRight: 12 }}
                  value={form.hora_fim} onChange={(e) => setForm((p) => ({ ...p, hora_fim: e.target.value }))} />
              </Campo>
            </div>

            {/* Serviços */}
            <Campo label="Serviços" req hint="selecione um ou mais">
              <input
                className="nb-input" placeholder="Pesquisar serviço…"
                value={filtroServico} onChange={(e) => setFiltroServico(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div className="nlm-serv-grid">
                {servicos
                  .filter((s) => s.nome.toLowerCase().includes(filtroServico.toLowerCase()))
                  .map((s) => {
                    const on = form.servicos_ids.some((id) => Number(id) === Number(s.id));
                    return (
                      <button key={s.id} type="button" onClick={() => toggleServico(s.id)}
                        className={`nlm-serv ${on ? 'is-on' : ''}`}>
                        <span className="nlm-serv-nome">{s.nome}</span>
                        <span className="nlm-serv-val nb-num">{brl(s.valor)}</span>
                      </button>
                    );
                  })}
                {servicos.filter((s) => s.nome.toLowerCase().includes(filtroServico.toLowerCase())).length === 0 && (
                  <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--nb-ink-faint)', fontSize: 13, margin: '8px 0' }}>Nenhum serviço encontrado</p>
                )}
              </div>
            </Campo>

            {/* Valor total (editável = desconto) */}
            <Campo label="Valor total" req hint="edite para aplicar desconto">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', fontSize: 13 }}>R$</span>
                <input
                  type="number" step="0.01" min="0" className="nb-input nb-num"
                  style={{ paddingLeft: 34 }}
                  value={form.valor_total} placeholder="0,00"
                  disabled={form.is_troca_gratis}
                  onChange={(e) => setForm((p) => ({ ...p, valor_total: e.target.value }))}
                />
              </div>
              {somaCatalogo > 0 && Math.abs(somaCatalogo - valorTotalNum) > 0.01 && !form.is_troca_gratis && (
                <div style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', marginTop: 4 }}>
                  Catálogo: {brl(somaCatalogo)} · Desconto: <span style={{ color: 'var(--nb-warn)' }}>{brl(somaCatalogo - valorTotalNum)}</span>
                </div>
              )}
            </Campo>

            {/* Já realizado + pagamento */}
            <div className="nlm-box">
              <label className="nlm-check">
                <input type="checkbox" checked={jaRealizado} onChange={(e) => {
                  setJaRealizado(e.target.checked);
                  if (!e.target.checked) {
                    setForm((p) => ({ ...p, is_fiado: false, is_troca_gratis: false, valor_referencia: '' }));
                    setPagamentos([]);
                  }
                }} style={{ accentColor: 'var(--nb-accent)' }} />
                <span>Serviço já foi realizado</span>
              </label>

              {jaRealizado && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button"
                      className={`nlm-tag ${form.is_fiado ? 'is-on-warn' : ''}`}
                      onClick={() => { setForm((p) => ({ ...p, is_fiado: true, is_troca_gratis: false, valor_referencia: '' })); setPagamentos([]); }}>
                      <PayIcon forma="fiado" size={15} /> Fiado
                    </button>
                    <button type="button"
                      className={`nlm-tag ${form.is_troca_gratis ? 'is-on-accent' : ''}`}
                      onClick={() => { setForm((p) => ({ ...p, is_troca_gratis: true, is_fiado: false, valor_total: '0' })); setPagamentos([]); }}>
                      <Icon name="Gift" size={15} /> Troca / grátis
                    </button>
                  </div>

                  {!form.is_fiado && !form.is_troca_gratis && (
                    <MultiPagamentoV2
                      pagamentos={pagamentos}
                      setPagamentos={setPagamentos}
                      valorTotal={valorTotalNum}
                      formasPagamentoDB={formasPagamentoDB}
                    />
                  )}

                  {form.is_fiado && (
                    <div className="nlm-note nlm-note-warn">
                      <Icon name="Info" size={15} />
                      <div>Fica <strong>pendente</strong>, fora do faturamento até ser pago. Receba depois em Controle de Fiados.</div>
                    </div>
                  )}

                  {form.is_troca_gratis && (
                    <div className="nlm-note nlm-note-accent">
                      <Icon name="Gift" size={15} />
                      <div style={{ width: '100%' }}>
                        <div style={{ marginBottom: 8 }}>Valor R$ 0,00 (sem faturamento nem comissão).</div>
                        <div style={{ position: 'relative', maxWidth: 200 }}>
                          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', fontSize: 13 }}>R$</span>
                          <input type="number" step="0.01" min="0" className="nb-input nb-num" style={{ paddingLeft: 34 }}
                            placeholder="Referência (opcional)"
                            value={form.valor_referencia}
                            onChange={(e) => setForm((p) => ({ ...p, valor_referencia: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Observações */}
            <Campo label="Observações">
              <textarea className="nb-input" rows={2} placeholder="Opcional…"
                value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
            </Campo>

            {/* PREVIEW do cálculo */}
            <div className="nlm-preview">
              <div className="nb-eyebrow" style={{ fontSize: 9.5, marginBottom: 10 }}>
                {preview.confirmado ? 'Como fica' : 'Estimativa'}
              </div>
              <PrevLinha label="Valor bruto" v={brl(preview.bruto)} />
              <PrevLinha label="Taxa da maquininha" v={preview.taxa ? `− ${brl(preview.taxa)}` : '—'} tone={preview.taxa ? 'bad' : undefined} />
              <PrevLinha label={`Comissão da profissional${selectedColaborador ? ` · ${porcentagemColab}%` : ''}`}
                v={canViewComissao || !selectedColaborador ? brl(preview.comissao) : '—'} />
              <PrevLinha label="Ficou pro salão" v={brl(preview.salao)} tone="ok" destaque />
              {isRecebimentoMonetario && pagamentos.length > 0 && Math.abs(somaPag - valorTotalNum) > 0.01 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--nb-bad)' }}>
                  Soma dos pagamentos ({brl(somaPag)}) ≠ total ({brl(valorTotalNum)}).
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- footer ---------------- */}
        {!bloqueado && (
          <div className="nlm-footer">
            <Button variant="ghost" onClick={onClose} disabled={salvando} style={{ justifyContent: 'center' }}>Cancelar</Button>
            <Button icon={salvando ? undefined : 'Check'} onClick={handleSubmit} disabled={salvando || carregando} style={{ justifyContent: 'center', flex: 1 }}>
              {salvando ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Salvar lançamento'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================ Cliente — autocomplete + criar inline */
function ClienteBusca({ selecionado, onSelect }: { selecionado: Cliente | null; onSelect: (c: Cliente | null) => void }) {
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(false);
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [novoTel, setNovoTel] = useState('');
  const [salvandoCli, setSalvandoCli] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!aberto || q.trim().length < 2) { setResultados([]); return; }
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/clientes?search=${encodeURIComponent(q.trim())}`, { cache: 'no-store' });
        const j = await r.json();
        if (vivo) setResultados(j.data || []);
      } catch { if (vivo) setResultados([]); }
      finally { if (vivo) setBuscando(false); }
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, aberto]);

  async function criarCliente() {
    if (q.trim().length < 2) { toast.error('Informe o nome do cliente'); return; }
    if (novoTel.replace(/\D/g, '').length < 8) { toast.error('Informe um telefone válido'); return; }
    setSalvandoCli(true);
    try {
      const r = await fetch('/api/clientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: q.trim(), telefone: novoTel.trim() }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || 'Erro ao criar cliente'); return; }
      toast.success('Cliente criado');
      onSelect(j.data);
      setAberto(false); setCriando(false); setQ(''); setNovoTel('');
    } catch { toast.error('Erro de conexão'); }
    finally { setSalvandoCli(false); }
  }

  if (selecionado) {
    return (
      <div className="nlm-cli-sel">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Avatar nome={selecionado.nome} size={26} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selecionado.nome}{selecionado.telefone ? <span style={{ color: 'var(--nb-ink-faint)' }}> · {selecionado.telefone}</span> : null}
          </span>
        </span>
        <button className="nb-btn nb-btn-quiet" onClick={() => { onSelect(null); setQ(''); }} aria-label="Trocar cliente"><Icon name="X" size={15} /></button>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', pointerEvents: 'none' }}>
          <Icon name="Search" size={15} />
        </span>
        <input
          className="nb-input" style={{ paddingLeft: 32 }}
          placeholder="Buscar cliente pelo nome…"
          value={q} onChange={(e) => { setQ(e.target.value); setAberto(true); setCriando(false); }}
          onFocus={() => setAberto(true)}
        />
      </div>

      {aberto && (
        <div className="nlm-drop">
          {buscando && <div className="nlm-drop-msg">Buscando…</div>}
          {!buscando && q.trim().length >= 2 && resultados.map((c) => (
            <button key={c.id} type="button" className="nlm-drop-item" onClick={() => { onSelect(c); setAberto(false); setQ(''); }}>
              <Avatar nome={c.nome} size={24} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.nome}{c.telefone ? <span style={{ color: 'var(--nb-ink-faint)' }}> · {c.telefone}</span> : null}
              </span>
            </button>
          ))}
          {!buscando && q.trim().length >= 2 && resultados.length === 0 && !criando && (
            <button type="button" className="nlm-drop-item" onClick={() => setCriando(true)} style={{ color: 'var(--nb-accent)' }}>
              <Icon name="UserPlus" size={16} /> Criar cliente “{q.trim()}”
            </button>
          )}
          {q.trim().length < 2 && !criando && <div className="nlm-drop-msg">Digite pelo menos 2 letras…</div>}

          {criando && (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12.5, color: 'var(--nb-ink-soft)' }}>Novo cliente: <strong>{q.trim()}</strong></div>
              <input className="nb-input" placeholder="Telefone (ex.: 11 91234-5678)" value={novoTel}
                onChange={(e) => setNovoTel(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="nb-btn nb-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }} onClick={() => setCriando(false)}>Voltar</button>
                <button className="nb-btn nb-btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }} onClick={criarCliente} disabled={salvandoCli}>
                  {salvandoCli ? 'Criando…' : 'Criar e usar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================ Multi-pagamento V2 (espelha MultiPagamento) */
function MultiPagamentoV2({ pagamentos, setPagamentos, valorTotal, formasPagamentoDB }: {
  pagamentos: PagamentoForm[];
  setPagamentos: (p: PagamentoForm[]) => void;
  valorTotal: number;
  formasPagamentoDB: FormaPagamentoDB[];
}) {
  const formasDisponiveis = formasPagamentoDB.filter((f) => f.codigo !== 'fiado' && f.codigo !== 'troca_gratis');
  const somaPag = pagamentos.reduce((a, p) => a + (parseFloat(p.valor) || 0), 0);
  const restante = valorTotal - somaPag;
  const podeAdicionar = pagamentos.length < formasDisponiveis.length;

  const add = () => {
    const usadas = new Set(pagamentos.map((p) => p.forma_pagamento));
    const prox = formasDisponiveis.find((f) => !usadas.has(f.codigo));
    if (!prox) return;
    const novoValor = pagamentos.length === 0 && valorTotal > 0
      ? valorTotal.toFixed(2)
      : restante > 0 ? restante.toFixed(2) : '';
    setPagamentos([...pagamentos, { forma_pagamento: prox.codigo, valor: novoValor }]);
  };
  const upd = (i: number, campo: keyof PagamentoForm, v: string) =>
    setPagamentos(pagamentos.map((p, idx) => (idx === i ? { ...p, [campo]: v } : p)));
  const rem = (i: number) => setPagamentos(pagamentos.filter((_, idx) => idx !== i));

  return (
    <div className="nlm-pag">
      {pagamentos.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--nb-ink-faint)', margin: 0 }}>Nenhuma forma adicionada.</p>
      )}
      {pagamentos.map((pag, i) => {
        const usadasOutras = new Set(pagamentos.filter((_, x) => x !== i).map((p) => p.forma_pagamento));
        return (
          <div key={i} className="nlm-pag-row">
            <span style={{ color: 'var(--nb-accent)', flex: '0 0 auto' }}><PayIcon forma={pag.forma_pagamento} size={16} /></span>
            <select className="v2-select" style={{ flex: 1, minWidth: 0 }} value={pag.forma_pagamento}
              onChange={(e) => upd(i, 'forma_pagamento', e.target.value)}>
              <option value="">Selecione…</option>
              {formasDisponiveis
                .filter((f) => f.codigo === pag.forma_pagamento || !usadasOutras.has(f.codigo))
                .map((f) => (
                  <option key={f.codigo} value={f.codigo}>
                    {f.nome}{f.taxa_percentual > 0 ? ` (taxa ${f.taxa_percentual}%)` : ''}
                  </option>
                ))}
            </select>
            <div style={{ position: 'relative', width: 118, flex: '0 0 auto' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', fontSize: 13 }}>R$</span>
              <input type="number" step="0.01" min="0" className="nb-input nb-num" style={{ paddingLeft: 30, textAlign: 'right' }}
                value={pag.valor} placeholder="0,00" onChange={(e) => upd(i, 'valor', e.target.value)} />
            </div>
            <button type="button" className="nb-btn nb-btn-quiet" onClick={() => rem(i)} aria-label="Remover"><Icon name="X" size={15} /></button>
          </div>
        );
      })}

      <div className="nlm-pag-foot">
        <button type="button" className="nb-btn nb-btn-ghost" onClick={add} disabled={!podeAdicionar} style={{ fontSize: 12.5, padding: '6px 10px' }}>
          <Icon name="Plus" size={14} /> Adicionar forma
        </button>
        {pagamentos.length > 0 && (
          <span className="nb-num" style={{ fontSize: 12, color: 'var(--nb-ink-soft)' }}>
            {brl(somaPag)} / {brl(valorTotal)}
            {Math.abs(restante) > 0.01
              ? <span style={{ marginLeft: 8, color: restante > 0 ? 'var(--nb-warn)' : 'var(--nb-bad)' }}>
                  {restante > 0 ? `falta ${brl(restante)}` : `excede ${brl(Math.abs(restante))}`}
                </span>
              : <span style={{ marginLeft: 8, color: 'var(--nb-ok)' }}>OK</span>}
          </span>
        )}
      </div>
    </div>
  );
}

/* ================================================================ subcomponentes visuais */
function Campo({ label, children, req, hint }: { label: string; children: React.ReactNode; req?: boolean; hint?: string }) {
  return (
    <label className="v2-field" style={{ gap: 6 }}>
      <span style={{ fontFamily: 'var(--nb-mono)', fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--nb-ink-faint)' }}>
        {label}{req && <span style={{ color: 'var(--nb-accent)' }}> *</span>}
        {hint && <span style={{ textTransform: 'none', letterSpacing: 0, marginLeft: 6, color: 'var(--nb-ink-faint)' }}>— {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function PrevLinha({ label, v, tone, destaque }: { label: string; v: string; tone?: 'ok' | 'bad'; destaque?: boolean }) {
  const color = tone === 'ok' ? 'var(--nb-ok)' : tone === 'bad' ? 'var(--nb-bad)' : 'var(--nb-ink)';
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
      padding: destaque ? '8px 0 2px' : '4px 0',
      borderTop: destaque ? '1px solid var(--nb-rule-soft)' : undefined, marginTop: destaque ? 4 : 0,
    }}>
      <span style={{ fontSize: 12.5, color: 'var(--nb-ink-soft)' }}>{label}</span>
      <span className="nb-num" style={{ fontSize: destaque ? 17 : 13.5, fontWeight: destaque ? 700 : 560, color }}>{v}</span>
    </div>
  );
}

/* ================================================================ CSS local */
const CSS = `
.nlm-overlay{position:fixed;inset:0;z-index:90;background:color-mix(in srgb, var(--nb-ink) 36%, transparent);display:grid;place-items:center;padding:16px}
.nlm-card{width:100%;max-width:600px;max-height:92dvh;display:flex;flex-direction:column;overflow:hidden;padding:0}
.nlm-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--nb-rule);flex:0 0 auto}
.nlm-body{flex:1 1 auto;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:16px}
.nlm-footer{flex:0 0 auto;display:flex;gap:10px;padding:14px 18px;border-top:1px solid var(--nb-rule)}
.nlm-grid3{display:grid;grid-template-columns:1.1fr .95fr .95fr;gap:12px}
.nlm-serv-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:210px;overflow-y:auto;padding:2px}
.nlm-serv{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:9px 11px;border:1px solid var(--nb-rule);border-radius:var(--nb-r);background:var(--nb-surface);cursor:pointer;transition:border-color .12s,background .12s}
.nlm-serv:hover{border-color:var(--nb-accent)}
.nlm-serv.is-on{border-color:var(--nb-accent);background:var(--nb-accent-wash)}
.nlm-serv-nome{font-size:13px;font-weight:560;color:var(--nb-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.nlm-serv-val{font-size:11.5px;color:var(--nb-ink-soft)}
.nlm-serv.is-on .nlm-serv-val{color:var(--nb-accent-deep)}
.nlm-box{border:1px solid var(--nb-rule);border-radius:var(--nb-r-lg);background:var(--nb-surface-2);padding:14px}
.nlm-check{display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;font-weight:560;color:var(--nb-ink)}
.nlm-tag{display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border:1px solid var(--nb-rule);border-radius:var(--nb-r);background:var(--nb-surface);color:var(--nb-ink-soft);font-size:13px;font-weight:560;cursor:pointer;transition:all .12s}
.nlm-tag:hover{border-color:var(--nb-accent)}
.nlm-tag.is-on-warn{background:var(--nb-warn-bg);border-color:#E7D4B4;color:var(--nb-warn)}
.nlm-tag.is-on-accent{background:var(--nb-accent-wash);border-color:#E7D2D8;color:var(--nb-accent-deep)}
.nlm-pag{display:flex;flex-direction:column;gap:8px;background:var(--nb-surface);border:1px solid var(--nb-rule);border-radius:var(--nb-r);padding:10px}
.nlm-pag-row{display:flex;align-items:center;gap:8px}
.nlm-pag-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--nb-rule-soft)}
.nlm-preview{border:1px solid var(--nb-rule);border-radius:var(--nb-r-lg);background:var(--nb-surface-2);padding:14px 16px}
.nlm-note{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:var(--nb-r);border:1px solid var(--nb-rule);font-size:12.5px;line-height:1.5;color:var(--nb-ink-soft)}
.nlm-note-bad{background:var(--nb-bad-bg);border-color:#E7CFC9;color:var(--nb-bad)}
.nlm-note-warn{background:var(--nb-warn-bg);border-color:#E7D4B4;color:var(--nb-warn)}
.nlm-note-accent{background:var(--nb-accent-wash);border-color:#E7D2D8;color:var(--nb-accent-deep)}
.nlm-cli-sel{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 8px 7px 10px;border:1px solid var(--nb-rule);border-radius:var(--nb-r);background:var(--nb-surface);font-size:14px;color:var(--nb-ink);min-width:0}
.nlm-drop{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:5;background:var(--nb-surface);border:1px solid var(--nb-rule);border-radius:var(--nb-r);box-shadow:var(--nb-shadow-md);max-height:260px;overflow-y:auto;padding:4px}
.nlm-drop-item{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:8px 10px;border-radius:8px;background:transparent;border:none;cursor:pointer;font-size:13.5px;color:var(--nb-ink)}
.nlm-drop-item:hover{background:var(--nb-surface-2)}
.nlm-drop-msg{padding:10px 12px;font-size:12.5px;color:var(--nb-ink-faint)}
@media(max-width:560px){
  .nlm-overlay{padding:0}
  .nlm-card{max-width:100%;max-height:100dvh;height:100dvh;border-radius:0}
  .nlm-grid3{grid-template-columns:1fr 1fr}
  .nlm-grid3>label:first-child{grid-column:1/-1}
  .nlm-serv-grid{grid-template-columns:1fr}
}
`;
