'use client';

import { useEffect, useState } from 'react';
import { supabase, Servico, Colaborador, Cliente } from '@/lib/supabase';
import { format } from 'date-fns';
import { lancamentoSchema, formatZodErrors } from '@/lib/validations';
import toast from 'react-hot-toast';
import ClienteAutocomplete from '@/components/ClienteAutocomplete';
import MultiPagamento from '@/components/MultiPagamento';
import { PagamentoForm, FormaPagamentoDB, calcularPagamentos, validarPagamentos } from '@/lib/pagamento-utils';

interface UserProfile {
  isAdmin: boolean;
  colaboradorId: number | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  colaboradores: Colaborador[];
  clientes: Cliente[];
  servicos: Servico[];
  formasPagamentoDB: FormaPagamentoDB[];
  userProfile: UserProfile | null;
  // Edição: id do lançamento (o modal busca os dados via API). Se null/undefined = novo.
  editLancamentoId?: number | null;
  // Pré-preenchimento ao criar novo (ex: data selecionada na Agenda)
  initialData?: string;
}

const FORM_VAZIO = {
  colaborador_id: '',
  cliente_id: '',
  data: format(new Date(), 'yyyy-MM-dd'),
  hora_inicio: '09:00',
  hora_fim: '10:00',
  servicos_ids: [] as number[],
  valor_total: '',
  observacoes: '',
  forma_pagamento: '',
  is_fiado: false,
  is_troca_gratis: false,
  valor_referencia: '',
};

// Horários de início selecionáveis por toque (chips) — 07:00 às 21:00 de 30 em 30 min
const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let m = 7 * 60; m <= 21 * 60; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
})();

// Soma minutos a um horário "HH:MM" e devolve "HH:MM" (limitado ao mesmo dia)
const somaMinutos = (hhmm: string, min: number): string => {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  let t = h * 60 + m + min;
  if (t > 23 * 60 + 59) t = 23 * 60 + 59;
  if (t < 0) t = 0;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export default function NovoLancamentoModal({
  isOpen,
  onClose,
  onSaved,
  colaboradores,
  clientes,
  servicos,
  formasPagamentoDB,
  userProfile,
  editLancamentoId,
  initialData,
}: Props) {
  const [formData, setFormData] = useState({ ...FORM_VAZIO });
  const [pagamentos, setPagamentos] = useState<PagamentoForm[]>([]);
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [jaRealizado, setJaRealizado] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filtroServico, setFiltroServico] = useState('');
  const [compartilhado, setCompartilhado] = useState(false);
  const [divisoes, setDivisoes] = useState<{ colaborador_id: number; valor: string }[]>([]);
  const [formErrors, setFormErrors] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializa o form quando o modal abre
  useEffect(() => {
    if (!isOpen) return;
    if (editLancamentoId) {
      carregarParaEdicao(editLancamentoId);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editLancamentoId]);

  function resetForm() {
    let preColabId = '';
    let preColab: Colaborador | null = null;
    if (userProfile?.colaboradorId) {
      const c = colaboradores.find(c => c.id === userProfile.colaboradorId);
      if (c) { preColabId = c.id.toString(); preColab = c; }
    }
    setFormData({ ...FORM_VAZIO, colaborador_id: preColabId, data: initialData || FORM_VAZIO.data });
    setSelectedColaborador(preColab);
    setSelectedCliente(null);
    setJaRealizado(false);
    setEditingId(null);
    setFormErrors('');
    setFiltroServico('');
    setCompartilhado(false);
    setDivisoes([]);
    setPagamentos([]);
  }

  async function carregarParaEdicao(id: number) {
    try {
      const response = await fetch(`/api/lancamentos/${id}`);
      if (!response.ok) { toast.error('Erro ao carregar dados do lançamento'); return; }
      const result = await response.json();
      const lancFresh = result.data || result;
      if (!lancFresh || !lancFresh.id) { toast.error('Lançamento não encontrado'); return; }

      const cliente = clientes.find(c => c.id === lancFresh.cliente_id);
      const colaborador = colaboradores.find(c => c.id === lancFresh.colaborador_id);

      const dataRaw = String(lancFresh.data || '');
      const dataMatch = dataRaw.match(/(\d{4}-\d{2}-\d{2})/);
      const dataStr = dataMatch ? dataMatch[1] : (dataRaw.split('T')[0] || format(new Date(), 'yyyy-MM-dd'));
      const horaInicio = lancFresh.hora_inicio ? lancFresh.hora_inicio.substring(0, 5) : '09:00';
      const horaFim = lancFresh.hora_fim ? lancFresh.hora_fim.substring(0, 5) : '10:00';

      let servicosIds: number[] = lancFresh.servicos_ids || [];
      if (servicosIds.length === 0 && lancFresh.servicos_nomes) {
        const nomes = lancFresh.servicos_nomes.split(' + ').map((s: string) => s.trim());
        servicosIds = nomes
          .map((nome: string) => servicos.find(s => s.nome.toLowerCase() === nome.toLowerCase())?.id)
          .filter((id: number | undefined): id is number => id !== undefined);
      }

      setFormData({
        colaborador_id: lancFresh.colaborador_id != null ? String(lancFresh.colaborador_id) : '',
        cliente_id: lancFresh.cliente_id != null ? String(lancFresh.cliente_id) : '',
        data: dataStr,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        servicos_ids: servicosIds,
        valor_total: (lancFresh.valor_total ?? 0).toFixed(2),
        observacoes: lancFresh.observacoes || '',
        forma_pagamento: lancFresh.forma_pagamento || '',
        is_fiado: lancFresh.is_fiado || false,
        is_troca_gratis: lancFresh.is_troca_gratis || false,
        valor_referencia: lancFresh.valor_referencia ? lancFresh.valor_referencia.toString() : '',
      });
      setSelectedCliente(cliente || null);
      setSelectedColaborador(colaborador || null);
      setJaRealizado(lancFresh.status === 'concluido' || lancFresh.is_fiado || lancFresh.is_troca_gratis);
      setEditingId(lancFresh.id);
      setFormErrors('');
      setFiltroServico('');
      setCompartilhado(false);
      setDivisoes([]);

      if (Array.isArray(lancFresh.pagamentos) && lancFresh.pagamentos.length > 0) {
        setPagamentos(lancFresh.pagamentos.map((p: any) => ({
          forma_pagamento: p.forma_pagamento,
          valor: Number(p.valor).toFixed(2),
        })));
      } else if (lancFresh.forma_pagamento && !lancFresh.is_fiado && !lancFresh.is_troca_gratis && lancFresh.forma_pagamento !== 'multiplo') {
        setPagamentos([{ forma_pagamento: lancFresh.forma_pagamento, valor: Number(lancFresh.valor_total).toFixed(2) }]);
      } else {
        setPagamentos([]);
      }

      try {
        const { data: divisoesData } = await supabase
          .from('lancamento_divisoes')
          .select('colaborador_id, valor')
          .eq('lancamento_id', id);
        if (divisoesData && divisoesData.length > 0) {
          setCompartilhado(true);
          setDivisoes(divisoesData.map((d: { colaborador_id: number; valor: number }) => ({
            colaborador_id: d.colaborador_id,
            valor: d.valor.toFixed(2),
          })));
        }
      } catch { /* ignora */ }
    } catch (err: any) {
      toast.error('Erro ao abrir edição: ' + (err.message || 'erro desconhecido'));
    }
  }

  function calcularValorTotal(servicosIds: number[]): number {
    return servicosIds.reduce((total, id) => total + (servicos.find(s => s.id === id)?.valor || 0), 0);
  }

  // Duração total dos serviços selecionados (soma duracao_minutos; mínimo 30min)
  function calcularDuracaoTotal(ids: number[]): number {
    const total = ids.reduce((acc, id) => {
      const s = servicos.find(x => x.id === id);
      return acc + (s?.duracao_minutos && s.duracao_minutos > 0 ? s.duracao_minutos : 0);
    }, 0);
    return total > 0 ? total : 30;
  }

  // Ao escolher o início (chip ou campo), recalcula o Fim pela duração dos serviços
  function handleHoraInicioChange(novoInicio: string) {
    setFormData(prev => ({
      ...prev,
      hora_inicio: novoInicio,
      hora_fim: somaMinutos(novoInicio, calcularDuracaoTotal(prev.servicos_ids)),
    }));
  }

  function handleServicoToggle(servicoId: number) {
    const novos = formData.servicos_ids.includes(servicoId)
      ? formData.servicos_ids.filter(id => id !== servicoId)
      : [...formData.servicos_ids, servicoId];
    setFormData(prev => ({
      ...prev,
      servicos_ids: novos,
      valor_total: calcularValorTotal(novos).toFixed(2),
      // Fim recalculado automaticamente pela duração dos serviços
      hora_fim: somaMinutos(prev.hora_inicio, calcularDuracaoTotal(novos)),
    }));
  }

  function handleColaboradorChange(colaboradorId: string) {
    setSelectedColaborador(colaboradores.find(c => c.id === Number(colaboradorId)) || null);
    setFormData(prev => ({ ...prev, colaborador_id: colaboradorId }));
  }

  async function handleSubmit() {
    setFormErrors('');
    setIsSubmitting(true);
    try {
      const servicosNomes = formData.servicos_ids
        .map(id => servicos.find(s => s.id === id)?.nome)
        .filter(Boolean)
        .join(' + ');

      const isRecebimentoMonetario = jaRealizado && !formData.is_fiado && !formData.is_troca_gratis;

      if (isRecebimentoMonetario) {
        const erroPag = validarPagamentos(pagamentos, parseFloat(formData.valor_total) || 0);
        if (erroPag) { setFormErrors(erroPag); setIsSubmitting(false); return; }
      }

      if (compartilhado) {
        if (divisoes.length < 2) { setFormErrors('Serviço compartilhado precisa de pelo menos 2 colaboradores'); setIsSubmitting(false); return; }
        const valorTotal = parseFloat(formData.valor_total) || 0;
        const somaDivisoes = divisoes.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0);
        // Soma das divisões precisa BATER com o total (antes só barrava se passasse; se sobrasse,
        // a comissão saía a menos e o valor "sumia"). Tolerância de 1 centavo.
        if (Math.abs(somaDivisoes - valorTotal) > 0.01) { setFormErrors(`Soma das divisões (R$ ${somaDivisoes.toFixed(2)}) precisa ser igual ao valor total (R$ ${valorTotal.toFixed(2)})`); setIsSubmitting(false); return; }
        if (divisoes.some(d => parseFloat(d.valor) < 0)) { setFormErrors('Valores não podem ser negativos'); setIsSubmitting(false); return; }
        if (divisoes.some((d, i) => divisoes.findIndex(x => x.colaborador_id === d.colaborador_id) !== i)) { setFormErrors('Não pode repetir colaborador na divisão'); setIsSubmitting(false); return; }
      }

      let statusFinal = 'pendente';
      if (formData.is_fiado) statusFinal = 'pendente';
      else if (formData.is_troca_gratis) statusFinal = 'concluido';
      else if (jaRealizado) statusFinal = 'concluido';

      const porcentagemColab = selectedColaborador?.porcentagem_comissao || 50;
      let valorTaxa = 0, comissaoColaborador = 0, comissaoSalao = 0;
      let pagamentosDetalhados: any[] = [];
      let formaPagamentoPrincipal = '';

      if (formData.is_troca_gratis) {
        comissaoColaborador = 0; comissaoSalao = 0;
      } else if (formData.is_fiado) {
        const valorTotalNum = parseFloat(formData.valor_total) || 0;
        const comissaoBruta = (valorTotalNum * porcentagemColab) / 100;
        comissaoColaborador = comissaoBruta;
        comissaoSalao = valorTotalNum - comissaoBruta;
      } else if (isRecebimentoMonetario) {
        const calc = calcularPagamentos(pagamentos, porcentagemColab, formasPagamentoDB);
        pagamentosDetalhados = calc.detalhados;
        valorTaxa = calc.valorTaxa;
        comissaoColaborador = calc.comissaoColaborador;
        comissaoSalao = calc.comissaoSalao;
        formaPagamentoPrincipal = calc.formaPrincipal;
      }

      // Compartilhado: comissão do lançamento = soma das comissões das divisões (cada
      // colaborador pela sua %), pra os totais de dashboard/relatórios baterem com /api/comissoes.
      if (compartilhado && divisoes.length > 0 && !formData.is_troca_gratis) {
        const valorTotalNum = parseFloat(formData.valor_total) || 0;
        comissaoColaborador = divisoes.reduce((acc, d) => {
          const colab = colaboradores.find(c => c.id === d.colaborador_id);
          return acc + (parseFloat(d.valor) || 0) * ((colab?.porcentagem_comissao || 50) / 100);
        }, 0);
        comissaoSalao = valorTotalNum - comissaoColaborador;
      }

      const validationData = {
        colaborador_id: Number(formData.colaborador_id),
        cliente_id: Number(formData.cliente_id),
        data: formData.data,
        hora_inicio: formData.hora_inicio,
        hora_fim: formData.hora_fim,
        servicos_ids: formData.servicos_ids,
        servicos_nomes: servicosNomes,
        valor_total: parseFloat(formData.valor_total),
        observacoes: formData.observacoes || undefined,
        status: statusFinal as 'pendente' | 'concluido',
        forma_pagamento: jaRealizado ? formaPagamentoPrincipal : undefined,
      };

      const validation = lancamentoSchema.safeParse(validationData);
      if (!validation.success) { setFormErrors(formatZodErrors(validation.error)); setIsSubmitting(false); return; }

      if (!formData.hora_inicio) { toast.error('Horário de início é obrigatório'); setIsSubmitting(false); return; }

      // Horário de fim precisa ser depois do início (evita duração negativa, ex.: 16:30 → 10:00)
      if (formData.hora_fim) {
        const [hi, mi] = formData.hora_inicio.split(':').map(Number);
        const [hf, mf] = formData.hora_fim.split(':').map(Number);
        if ((hf * 60 + mf) <= (hi * 60 + mi)) {
          setFormErrors('O horário de término deve ser depois do horário de início.');
          toast.error('Horário de término deve ser depois do início.');
          setIsSubmitting(false);
          return;
        }
      }

      const horaInicioFormatada = formData.hora_inicio.length === 5 ? `${formData.hora_inicio}:00` : formData.hora_inicio;
      const dataCompleta = `${formData.data} ${horaInicioFormatada}`;
      const valorTotalFinal = formData.is_troca_gratis ? 0 : validationData.valor_total;

      const [hInicio, mInicio] = formData.hora_inicio.split(':').map(Number);
      const [hFim, mFim] = formData.hora_fim.split(':').map(Number);
      const duracaoTotal = (hFim * 60 + mFim) - (hInicio * 60 + mInicio);
      const colaboradoresIdsAgenda = compartilhado ? divisoes.map(d => d.colaborador_id) : [validationData.colaborador_id];

      // Pré-checagem de conflito de horário ANTES de criar o lançamento (somente em criação).
      // Evita lançamento órfão: se o horário estiver ocupado, nada é criado e o usuário é avisado.
      if (!editingId) {
        try {
          const checkRes = await fetch('/api/agendamentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apenasVerificar: true,
              colaborador_id: validationData.colaborador_id,
              cliente_id: validationData.cliente_id,
              data_hora: dataCompleta,
              hora_inicio: formData.hora_inicio,
              hora_fim: formData.hora_fim || formData.hora_inicio,
              duracao_minutos: duracaoTotal,
            }),
          });
          if (checkRes.status === 409) {
            const errJson = await checkRes.json().catch(() => ({}));
            setFormErrors(errJson.error || 'Conflito de horário: este colaborador já tem algo marcado nesse horário.');
            toast.error(errJson.error || 'Conflito de horário nesse horário.');
            setIsSubmitting(false);
            return;
          }
          // Aviso não-bloqueante (ex.: mesma cliente em atendimento simultâneo)
          const checkJson = await checkRes.json().catch(() => ({}));
          if (checkJson?.aviso) toast(checkJson.aviso, { icon: '⚠️', duration: 5000 });
        } catch {
          // Se a verificação falhar por rede, segue o fluxo normal (o POST real ainda revalida).
        }
      }

      let formaPagamentoFinal: string | null = null;
      let dataPagamentoFinal: string | null = null;
      if (formData.is_fiado) { formaPagamentoFinal = 'fiado'; dataPagamentoFinal = null; }
      else if (formData.is_troca_gratis) { formaPagamentoFinal = 'troca_gratis'; dataPagamentoFinal = new Date().toISOString(); }
      else if (isRecebimentoMonetario) { formaPagamentoFinal = formaPagamentoPrincipal; dataPagamentoFinal = new Date().toISOString(); }

      const lancamentoData = {
        colaborador_id: validationData.colaborador_id,
        cliente_id: validationData.cliente_id,
        valor_total: valorTotalFinal,
        comissao_colaborador: comissaoColaborador,
        comissao_salao: comissaoSalao,
        taxa_pagamento: valorTaxa,
        data: dataCompleta,
        hora_inicio: formData.hora_inicio,
        hora_fim: formData.hora_fim,
        servicos_ids: formData.servicos_ids,
        servicos_nomes: servicosNomes,
        status: statusFinal,
        observacoes: formData.observacoes || null,
        forma_pagamento: formaPagamentoFinal,
        data_pagamento: dataPagamentoFinal,
        compartilhado,
        is_fiado: formData.is_fiado || false,
        is_troca_gratis: formData.is_troca_gratis || false,
        valor_referencia: formData.is_troca_gratis && formData.valor_referencia ? parseFloat(formData.valor_referencia) : null,
        pagamentos: isRecebimentoMonetario ? pagamentosDetalhados : [],
      };

      let lancamento: any = null;
      try {
        const url = editingId ? `/api/lancamentos/${editingId}` : '/api/lancamentos';
        const res = await fetch(url, {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lancamentoData),
        });
        if (!res.ok) {
          const errText = await res.text();
          toast.error(`Erro ao ${editingId ? 'atualizar' : 'criar'}: ${errText}`);
          setIsSubmitting(false);
          return;
        }
        lancamento = (await res.json()).data;
      } catch (fetchErr: any) {
        toast.error(`Erro de conexão: ${fetchErr.message}`);
        setIsSubmitting(false);
        return;
      }

      if (!lancamento) { toast.error('Erro: lançamento não retornado pela API'); setIsSubmitting(false); return; }

      // Criação/atualização do agendamento (AWAITED): o lançamento só é considerado
      // concluído se entrar na agenda. Antes era "fire-and-forget" e o toast de sucesso
      // aparecia mesmo quando o agendamento falhava → sumia da agenda sem ninguém notar.
      let agendamentoOk = true;
      let agendamentoErro = '';
      {
        try {
          if (compartilhado && divisoes.length > 0) {
            if (editingId) await supabase.from('lancamento_divisoes').delete().eq('lancamento_id', editingId);
            const divisoesParaSalvar = divisoes.map(d => {
              const colab = colaboradores.find(c => c.id === d.colaborador_id);
              return {
                lancamento_id: lancamento.id,
                colaborador_id: d.colaborador_id,
                valor: parseFloat(d.valor) || 0,
                comissao_calculada: ((parseFloat(d.valor) || 0) * (colab?.porcentagem_comissao || 50)) / 100,
              };
            });
            await supabase.from('lancamento_divisoes').insert(divisoesParaSalvar);
          } else if (editingId) {
            await supabase.from('lancamento_divisoes').delete().eq('lancamento_id', editingId);
          }

          if (editingId) {
            const agendRes = await fetch('/api/agendamentos', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lancamento_id: editingId,
                cliente_id: validationData.cliente_id,
                colaborador_id: validationData.colaborador_id,
                data_hora: dataCompleta,
                descricao_servico: servicosNomes,
                duracao_minutos: duracaoTotal,
                valor_estimado: validationData.valor_total,
                status: statusFinal,
                colaboradores_ids: colaboradoresIdsAgenda,
              }),
            });
            if (!agendRes.ok) {
              agendamentoOk = false;
              agendamentoErro = await agendRes.text().catch(() => '');
              console.error('[NovoLancamento] agendamento não atualizado:', agendRes.status, agendamentoErro);
            }
          } else {
            const agendRes = await fetch('/api/agendamentos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lancamento_id: lancamento.id,
                colaborador_id: validationData.colaborador_id,
                cliente_id: validationData.cliente_id,
                data_hora: dataCompleta,
                descricao_servico: servicosNomes,
                duracao_minutos: duracaoTotal,
                valor_estimado: validationData.valor_total,
                hora_inicio: formData.hora_inicio,
                hora_fim: formData.hora_fim || formData.hora_inicio,
                colaboradores_ids: colaboradoresIdsAgenda,
              }),
            });
            if (!agendRes.ok) {
              agendamentoOk = false;
              agendamentoErro = await agendRes.text().catch(() => '');
              console.error('[NovoLancamento] agendamento não criado:', agendRes.status, agendamentoErro);
            }
          }
        } catch (err: any) {
          agendamentoOk = false;
          agendamentoErro = err?.message || 'erro desconhecido';
          console.error('[NovoLancamento] erro ao criar agendamento/divisões:', err);
        }
      }

      let msgExtra = '';
      if (formData.is_fiado) msgExtra = ' - Marcado como FIADO (pendente)';
      else if (formData.is_troca_gratis) msgExtra = ' - Troca/Grátis registrado';
      else if (isRecebimentoMonetario && pagamentos.length > 1) msgExtra = ` - ${pagamentos.length} formas de pagamento`;
      else if (valorTaxa > 0) msgExtra = ` (Taxa: -R$ ${valorTaxa.toFixed(2)})`;

      if (agendamentoOk) {
        toast.success((editingId ? 'Lançamento atualizado!' : 'Lançamento criado!') + msgExtra);
      } else {
        // Lançamento salvo, mas NÃO entrou na agenda — avisa de forma clara e persistente.
        const motivo = agendamentoErro && agendamentoErro.toLowerCase().includes('conflito')
          ? ' (conflito de horário)'
          : '';
        toast.error(
          `Lançamento salvo, mas NÃO apareceu na agenda${motivo}. Edite o horário e salve de novo, ou avise o administrador.`,
          { duration: 9000 }
        );
      }
      onClose();
      onSaved();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao salvar');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800">{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
          <p className="text-gray-500 text-sm">{editingId ? 'Modifique os dados do atendimento' : 'Preencha os dados do atendimento'}</p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {formErrors && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm whitespace-pre-line">{formErrors}</div>
          )}

          {/* Colaboradora */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Colaboradora *</label>
            <select
              value={formData.colaborador_id}
              onChange={(e) => handleColaboradorChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Selecione...</option>
              {colaboradores.map(c => {
                const showComissao = userProfile?.isAdmin || userProfile?.colaboradorId === c.id;
                return <option key={c.id} value={c.id}>{c.nome}{showComissao ? ` (${c.porcentagem_comissao}%)` : ''}</option>;
              })}
            </select>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cliente *</label>
            <ClienteAutocomplete
              selectedCliente={selectedCliente}
              onSelect={(cliente) => {
                setSelectedCliente(cliente);
                setFormData(prev => ({ ...prev, cliente_id: cliente?.id?.toString() || '' }));
              }}
            />
          </div>

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data *</label>
            <input type="date" value={formData.data} onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500" />
          </div>

          {/* Início — escolha por toque (chips de 30 em 30 min) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Início *</label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-xl">
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleHoraInicioChange(slot)}
                  className={`px-2 py-2 rounded-lg text-sm font-semibold transition-all ${formData.hora_inicio === slot ? 'bg-purple-500 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-purple-100'}`}
                >
                  {slot}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <span>Outro horário:</span>
              <input
                type="time"
                value={formData.hora_inicio}
                onChange={(e) => handleHoraInicioChange(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Fim — calculado automaticamente pela duração do serviço (ajustável) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fim <span className="text-xs font-normal text-gray-400">— automático ({calcularDuracaoTotal(formData.servicos_ids)}min); ajuste se precisar</span>
            </label>
            <input type="time" value={formData.hora_fim} onChange={(e) => setFormData(prev => ({ ...prev, hora_fim: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500" />
          </div>

          {/* Serviços */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Serviços * (selecione um ou mais)</label>
            <input type="text" placeholder="Pesquisar serviço..." value={filtroServico} onChange={(e) => setFiltroServico(e.target.value)} className="w-full px-4 py-2 mb-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-xl">
              {servicos.filter(s => s.nome.toLowerCase().includes(filtroServico.toLowerCase())).map(s => (
                <button key={s.id} type="button" onClick={() => handleServicoToggle(s.id)} className={`text-left px-3 py-2 rounded-lg text-sm transition-all ${formData.servicos_ids.includes(s.id) ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-purple-100'}`}>
                  <div className="font-medium truncate">{s.nome}</div>
                  <div className="text-xs opacity-75">R$ {s.valor.toFixed(2)}</div>
                </button>
              ))}
            </div>
            {servicos.filter(s => s.nome.toLowerCase().includes(filtroServico.toLowerCase())).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-2">Nenhum serviço encontrado</p>
            )}
          </div>

          {/* Valor Total */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Valor Total * (editável para descontos)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
              <input type="number" step="0.01" value={formData.valor_total} onChange={(e) => setFormData(prev => ({ ...prev, valor_total: e.target.value }))} className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500" placeholder="0.00" />
            </div>
            {selectedColaborador && formData.valor_total && (userProfile?.isAdmin || userProfile?.colaboradorId === selectedColaborador.id) && (
              <p className="text-xs text-gray-500 mt-1">
                Comissão: R$ {((parseFloat(formData.valor_total) * selectedColaborador.porcentagem_comissao) / 100).toFixed(2)} ({selectedColaborador.porcentagem_comissao}%)
              </p>
            )}
          </div>

          {/* Serviço já realizado */}
          <div className="bg-gray-50 rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={jaRealizado} onChange={(e) => {
                setJaRealizado(e.target.checked);
                if (!e.target.checked) {
                  setFormData(prev => ({ ...prev, forma_pagamento: '', is_fiado: false, is_troca_gratis: false, valor_referencia: '' }));
                  setPagamentos([]);
                }
              }} className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
              <span className="font-medium text-gray-700">Serviço já foi realizado</span>
            </label>

            {jaRealizado && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-gray-600">Como foi recebido o pagamento?</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setFormData(prev => ({ ...prev, forma_pagamento: 'fiado', is_fiado: true, is_troca_gratis: false, valor_referencia: '' })); setPagamentos([]); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${formData.is_fiado ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-300'}`}>
                    <span>📝</span><span>Fiado</span>
                  </button>
                  <button type="button" onClick={() => { setFormData(prev => ({ ...prev, forma_pagamento: 'troca_gratis', is_fiado: false, is_troca_gratis: true, valor_total: '0' })); setPagamentos([]); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${formData.is_troca_gratis ? 'bg-purple-500 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-purple-300'}`}>
                    <span>🎁</span><span>Troca / Grátis</span>
                  </button>
                </div>

                {!formData.is_fiado && !formData.is_troca_gratis && (
                  <MultiPagamento
                    pagamentos={pagamentos}
                    setPagamentos={setPagamentos}
                    valorTotal={parseFloat(formData.valor_total) || 0}
                    formasPagamentoDB={formasPagamentoDB}
                    porcentagemComissao={selectedColaborador?.porcentagem_comissao}
                    canViewComissao={!!selectedColaborador && (userProfile?.isAdmin || userProfile?.colaboradorId === selectedColaborador.id)}
                  />
                )}

                {formData.is_fiado && (
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                    <p className="text-orange-800 font-medium flex items-center gap-2"><span>📝</span> Fiado selecionado</p>
                    <ul className="text-orange-700 mt-2 space-y-1 list-disc list-inside">
                      <li>O serviço será marcado como <strong>pendente</strong></li>
                      <li>Não entrará no faturamento até ser pago</li>
                      <li>Você poderá receber o pagamento em Controle de Fiados</li>
                    </ul>
                  </div>
                )}

                {formData.is_troca_gratis && (
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-purple-800 font-medium flex items-center gap-2 mb-2"><span>🎁</span> Troca / Grátis selecionado</p>
                    <p className="text-purple-700 text-sm mb-3">O valor será R$ 0,00 (sem faturamento e sem comissão).</p>
                    <div>
                      <label className="block text-sm font-medium text-purple-700 mb-1">Valor de referência (opcional)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                        <input type="number" step="0.01" value={formData.valor_referencia} onChange={(e) => setFormData(prev => ({ ...prev, valor_referencia: e.target.value }))} className="w-full pl-10 pr-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="0.00" />
                      </div>
                      <p className="text-xs text-purple-600 mt-1">Apenas para referência/histórico. Não entra em relatórios.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Serviço Compartilhado */}
          <div className="bg-blue-50 rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={compartilhado} onChange={(e) => {
                setCompartilhado(e.target.checked);
                if (e.target.checked && divisoes.length === 0) {
                  const valorTotal = parseFloat(formData.valor_total) || 0;
                  const valorMetade = valorTotal / 2;
                  setDivisoes([
                    { colaborador_id: selectedColaborador?.id || 0, valor: valorMetade.toFixed(2) },
                    { colaborador_id: 0, valor: valorMetade.toFixed(2) },
                  ]);
                }
              }} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="font-medium text-gray-700">Serviço compartilhado</span>
            </label>

            {compartilhado && (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-gray-600">Divida o valor entre os colaboradores:</p>
                <div className="space-y-3">
                  {divisoes.map((div, index) => {
                    const colab = colaboradores.find(c => c.id === div.colaborador_id);
                    const valorTotal = parseFloat(formData.valor_total) || 0;
                    const valorDiv = parseFloat(div.valor) || 0;
                    const percentual = valorTotal > 0 ? ((valorDiv / valorTotal) * 100).toFixed(0) : '0';
                    return (
                      <div key={index} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-blue-200">
                        <select value={div.colaborador_id} onChange={(e) => { const nd = [...divisoes]; nd[index].colaborador_id = parseInt(e.target.value); setDivisoes(nd); }} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-blue-500">
                          <option value={0}>Selecione...</option>
                          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500 text-sm">R$</span>
                          <input type="number" step="0.01" min="0" value={div.valor} onChange={(e) => { const nd = [...divisoes]; nd[index].valor = e.target.value; setDivisoes(nd); }} className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 text-right" placeholder="0.00" />
                        </div>
                        <span className="text-sm text-blue-600 font-medium w-12 text-right">{percentual}%</span>
                        {colab && <span className="text-xs text-gray-400">(Com: {colab.porcentagem_comissao}%)</span>}
                        {divisoes.length > 2 && (
                          <button type="button" onClick={() => setDivisoes(divisoes.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700 p-1">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setDivisoes([...divisoes, { colaborador_id: 0, valor: '0' }])} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Adicionar colaborador
                </button>
                {(() => {
                  const valorTotal = parseFloat(formData.valor_total) || 0;
                  const somaDivisoes = divisoes.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0);
                  const diferenca = valorTotal - somaDivisoes;
                  const isValid = diferenca >= 0 && somaDivisoes > 0;
                  return (
                    <div className={`p-3 rounded-lg text-sm ${isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex justify-between items-center">
                        <span className={isValid ? 'text-green-700' : 'text-red-700'}>Total dividido: R$ {somaDivisoes.toFixed(2)} / R$ {valorTotal.toFixed(2)}</span>
                        {diferenca > 0 && <span className="text-orange-600 font-medium">Restam R$ {diferenca.toFixed(2)}</span>}
                        {diferenca < 0 && <span className="text-red-600 font-medium">Excede R$ {Math.abs(diferenca).toFixed(2)}</span>}
                        {diferenca === 0 && somaDivisoes > 0 && <span className="text-green-600 font-medium">✓ OK</span>}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
            <textarea value={formData.observacoes} onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500" placeholder="Observações opcionais..." />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50">
            {isSubmitting ? 'Salvando...' : (editingId ? 'Atualizar Lançamento' : 'Salvar Lançamento')}
          </button>
        </div>
      </div>
    </div>
  );
}
