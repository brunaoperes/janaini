'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase, Servico, Colaborador, Cliente } from '@/lib/supabase';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { lancamentoSchema, formatZodErrors } from '@/lib/validations';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import ClienteAutocomplete from '@/components/ClienteAutocomplete';

// Função para parsear data/hora sem conversão de timezone
const parseAsLocalTime = (dataHora: string): Date => {
  const semTimezone = dataHora.replace(/([+-]\d{2}:\d{2}|Z)$/, '');
  const partes = semTimezone.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/);

  if (partes) {
    const [_, ano, mes, dia, hora, minuto, segundo = '0'] = partes;
    return new Date(
      parseInt(ano),
      parseInt(mes) - 1,
      parseInt(dia),
      parseInt(hora),
      parseInt(minuto),
      parseInt(segundo)
    );
  }

  const partesData = semTimezone.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (partesData) {
    const [_, ano, mes, dia] = partesData;
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), 12, 0, 0);
  }

  return new Date(dataHora);
};

interface DivisaoColaborador {
  colaborador_id: number;
  valor: number;
  colaborador?: {
    id: number;
    nome: string;
    porcentagem_comissao: number;
  };
}

interface LancamentoComRelacoes {
  id: number;
  colaborador_id: number;
  cliente_id: number;
  valor_total: number;
  forma_pagamento: string | null;
  comissao_colaborador: number | null;
  comissao_salao: number | null;
  valor_comissao?: number | null;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  servicos_ids: number[] | null;
  servicos_nomes: string | null;
  status: string;
  observacoes: string | null;
  colaboradores?: { nome: string; porcentagem_comissao: number } | null;
  clientes?: { nome: string } | null;
  _canViewComissao?: boolean;
  compartilhado?: boolean;
  divisoes?: DivisaoColaborador[];
  is_fiado?: boolean;
  is_troca_gratis?: boolean;
}

interface UserProfile {
  isAdmin: boolean;
  colaboradorId: number | null;
}

interface FormaPagamentoDB {
  id: number;
  nome: string;
  codigo: string;
  icone: string;
  taxa_percentual: number;
  ativo: boolean;
}

type TabType = 'hoje' | 'pendentes' | 'finalizados' | 'futuros';

export default function LancamentosPage() {
  const [lancamentos, setLancamentos] = useState<LancamentoComRelacoes[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [formasPagamentoDB, setFormasPagamentoDB] = useState<FormaPagamentoDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formErrors, setFormErrors] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nova estrutura de filtros
  const [activeTab, setActiveTab] = useState<TabType>('hoje');
  const [filtroColaborador, setFiltroColaborador] = useState<number | 'todos'>('todos');

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({
    isOpen: false,
    id: null,
  });

  const [formData, setFormData] = useState({
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
  });

  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [jaRealizado, setJaRealizado] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [filtroServico, setFiltroServico] = useState('');
  const [compartilhado, setCompartilhado] = useState(false);
  const [divisoes, setDivisoes] = useState<{ colaborador_id: number; valor: string }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  // Filtrar lançamentos por aba e colaborador
  const lancamentosFiltrados = useMemo(() => {
    const hoje = startOfDay(new Date());
    const fimHoje = endOfDay(new Date());

    let filtered = lancamentos;

    // Filtro por colaborador
    if (filtroColaborador !== 'todos') {
      filtered = filtered.filter(l => l.colaborador_id === filtroColaborador);
    }

    // Filtro por aba
    switch (activeTab) {
      case 'hoje':
        // Lançamentos do dia atual (qualquer status)
        filtered = filtered.filter(l => {
          const dataLanc = parseAsLocalTime(l.data);
          return dataLanc >= hoje && dataLanc <= fimHoje;
        });
        break;

      case 'pendentes':
        // Lançamentos com data <= hoje E status = pendente
        filtered = filtered.filter(l => {
          const dataLanc = parseAsLocalTime(l.data);
          return dataLanc <= fimHoje && l.status === 'pendente';
        });
        break;

      case 'finalizados':
        // Lançamentos concluídos (qualquer data)
        filtered = filtered.filter(l => l.status === 'concluido');
        break;

      case 'futuros':
        // Lançamentos com data > hoje (agendamentos futuros)
        filtered = filtered.filter(l => {
          const dataLanc = parseAsLocalTime(l.data);
          return dataLanc > fimHoje;
        });
        break;
    }

    return filtered;
  }, [lancamentos, activeTab, filtroColaborador]);

  // Contadores para cada aba
  const contadores = useMemo(() => {
    const hoje = startOfDay(new Date());
    const fimHoje = endOfDay(new Date());

    let filtered = lancamentos;
    if (filtroColaborador !== 'todos') {
      filtered = filtered.filter(l => l.colaborador_id === filtroColaborador);
    }

    return {
      hoje: filtered.filter(l => {
        const dataLanc = parseAsLocalTime(l.data);
        return dataLanc >= hoje && dataLanc <= fimHoje;
      }).length,
      pendentes: filtered.filter(l => {
        const dataLanc = parseAsLocalTime(l.data);
        return dataLanc <= fimHoje && l.status === 'pendente';
      }).length,
      finalizados: filtered.filter(l => l.status === 'concluido').length,
      futuros: filtered.filter(l => {
        const dataLanc = parseAsLocalTime(l.data);
        return dataLanc > fimHoje;
      }).length,
    };
  }, [lancamentos, filtroColaborador]);

  async function loadData(retryCount = 0) {
    setLoading(true);

    try {
      // Carregar todos os lançamentos (sem filtro de data na API)
      const url = `/api/lancamentos?filtro=todos&_t=${Date.now()}`;

      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        if (retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 500));
          return loadData(retryCount + 1);
        }
        throw new Error(`Erro ao carregar dados (status: ${response.status})`);
      }

      const data = await response.json();

      const colaboradoresData = data.colaboradores || [];
      const servicosData = data.servicos || [];

      setColaboradores(colaboradoresData);
      setClientes(data.clientes || []);
      setServicos(servicosData);
      setFormasPagamentoDB(data.formasPagamento || []);
      setLancamentos(data.lancamentos || []);

      if (data._userProfile) {
        setUserProfile(data._userProfile);

        if (data._userProfile.colaboradorId) {
          const colaboradorDoUsuario = colaboradoresData.find(
            (c: Colaborador) => c.id === data._userProfile.colaboradorId
          );

          if (colaboradorDoUsuario && !editingId) {
            setSelectedColaborador(colaboradorDoUsuario);
            setFormData(prev => ({
              ...prev,
              colaborador_id: colaboradorDoUsuario.id.toString(),
            }));
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  function calcularValorTotal(servicosIds: number[]): number {
    return servicosIds.reduce((total, id) => {
      const servico = servicos.find(s => s.id === id);
      return total + (servico?.valor || 0);
    }, 0);
  }

  function handleServicoToggle(servicoId: number) {
    const novosServicos = formData.servicos_ids.includes(servicoId)
      ? formData.servicos_ids.filter(id => id !== servicoId)
      : [...formData.servicos_ids, servicoId];

    const valorTotal = calcularValorTotal(novosServicos);

    setFormData(prev => ({
      ...prev,
      servicos_ids: novosServicos,
      valor_total: valorTotal.toFixed(2),
    }));
  }

  function handleColaboradorChange(colaboradorId: string) {
    const colab = colaboradores.find(c => c.id === Number(colaboradorId));
    setSelectedColaborador(colab || null);
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

      if (jaRealizado && !formData.forma_pagamento && !formData.is_fiado && !formData.is_troca_gratis) {
        setFormErrors('Selecione uma forma de pagamento');
        setIsSubmitting(false);
        return;
      }

      if (compartilhado) {
        if (divisoes.length < 2) {
          setFormErrors('Serviço compartilhado precisa de pelo menos 2 colaboradores');
          setIsSubmitting(false);
          return;
        }

        const valorTotal = parseFloat(formData.valor_total) || 0;
        const somaDivisoes = divisoes.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0);

        if (somaDivisoes > valorTotal) {
          setFormErrors(`Soma das divisões (R$ ${somaDivisoes.toFixed(2)}) excede o valor total (R$ ${valorTotal.toFixed(2)})`);
          setIsSubmitting(false);
          return;
        }

        const temValorNegativo = divisoes.some(d => parseFloat(d.valor) < 0);
        if (temValorNegativo) {
          setFormErrors('Valores não podem ser negativos');
          setIsSubmitting(false);
          return;
        }

        const temColaboradorDuplicado = divisoes.some((d, i) =>
          divisoes.findIndex(x => x.colaborador_id === d.colaborador_id) !== i
        );
        if (temColaboradorDuplicado) {
          setFormErrors('Não pode repetir colaborador na divisão');
          setIsSubmitting(false);
          return;
        }
      }

      let statusFinal = 'pendente';
      if (formData.is_fiado) {
        statusFinal = 'pendente';
      } else if (formData.is_troca_gratis) {
        statusFinal = 'concluido';
      } else if (jaRealizado) {
        statusFinal = 'concluido';
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
        forma_pagamento: jaRealizado ? formData.forma_pagamento as 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito' : undefined,
      };

      const validation = lancamentoSchema.safeParse(validationData);
      if (!validation.success) {
        setFormErrors(formatZodErrors(validation.error));
        setIsSubmitting(false);
        return;
      }

      let taxaPercentual = 0;
      let valorTaxa = 0;
      if (jaRealizado && formData.forma_pagamento && !formData.is_fiado && !formData.is_troca_gratis) {
        const { data: formaPagamento } = await supabase
          .from('formas_pagamento')
          .select('taxa_percentual')
          .eq('codigo', formData.forma_pagamento)
          .single();

        taxaPercentual = formaPagamento?.taxa_percentual || 0;
        valorTaxa = (validationData.valor_total * taxaPercentual) / 100;
      }

      let comissaoColaborador = 0;
      let comissaoSalao = 0;

      if (formData.is_troca_gratis) {
        comissaoColaborador = 0;
        comissaoSalao = 0;
      } else if (formData.is_fiado) {
        const porcentagem = selectedColaborador?.porcentagem_comissao || 50;
        const comissaoBruta = (validationData.valor_total * porcentagem) / 100;
        comissaoColaborador = comissaoBruta;
        comissaoSalao = validationData.valor_total - comissaoBruta;
      } else {
        const porcentagem = selectedColaborador?.porcentagem_comissao || 50;
        const comissaoBruta = (validationData.valor_total * porcentagem) / 100;
        comissaoColaborador = comissaoBruta - valorTaxa;
        comissaoSalao = validationData.valor_total - comissaoBruta;
      }

      const horaInicioFormatada = formData.hora_inicio.length === 5 ? `${formData.hora_inicio}:00` : formData.hora_inicio;
      const dataCompleta = `${formData.data}T${horaInicioFormatada}`;

      const valorTotalFinal = formData.is_troca_gratis ? 0 : validationData.valor_total;

      let formaPagamentoFinal = null;
      let dataPagamentoFinal = null;

      if (formData.is_fiado) {
        formaPagamentoFinal = 'fiado';
        dataPagamentoFinal = null;
      } else if (formData.is_troca_gratis) {
        formaPagamentoFinal = 'troca_gratis';
        dataPagamentoFinal = new Date().toISOString();
      } else if (jaRealizado && formData.forma_pagamento) {
        formaPagamentoFinal = formData.forma_pagamento;
        dataPagamentoFinal = new Date().toISOString();
      }

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
        compartilhado: compartilhado,
        is_fiado: formData.is_fiado || false,
        is_troca_gratis: formData.is_troca_gratis || false,
        valor_referencia: formData.is_troca_gratis && formData.valor_referencia
          ? parseFloat(formData.valor_referencia)
          : null,
      };

      let lancamento;
      let lancError;

      if (editingId) {
        const result = await supabase
          .from('lancamentos')
          .update(lancamentoData)
          .eq('id', editingId)
          .select()
          .single();
        lancamento = result.data;
        lancError = result.error;
      } else {
        const result = await supabase
          .from('lancamentos')
          .insert(lancamentoData)
          .select()
          .single();
        lancamento = result.data;
        lancError = result.error;
      }

      if (lancError) {
        console.error('Erro ao salvar lançamento:', lancError.message);
        toast.error(`Erro: ${lancError.message || 'Erro ao salvar lançamento'}`);
        setIsSubmitting(false);
        return;
      }

      if (compartilhado && divisoes.length > 0) {
        if (editingId) {
          await supabase
            .from('lancamento_divisoes')
            .delete()
            .eq('lancamento_id', editingId);
        }

        const divisoesParaSalvar = divisoes.map(d => {
          const colab = colaboradores.find(c => c.id === d.colaborador_id);
          const porcentagemColab = colab?.porcentagem_comissao || 50;
          const valorDivisao = parseFloat(d.valor) || 0;
          const comissaoCalculada = (valorDivisao * porcentagemColab) / 100;

          return {
            lancamento_id: lancamento.id,
            colaborador_id: d.colaborador_id,
            valor: valorDivisao,
            comissao_calculada: comissaoCalculada,
          };
        });

        const { error: divError } = await supabase
          .from('lancamento_divisoes')
          .insert(divisoesParaSalvar);

        if (divError) {
          console.error('Erro ao salvar divisões:', divError);
        }
      } else if (editingId) {
        await supabase
          .from('lancamento_divisoes')
          .delete()
          .eq('lancamento_id', editingId);
      }

      const [hInicio, mInicio] = formData.hora_inicio.split(':').map(Number);
      const [hFim, mFim] = formData.hora_fim.split(':').map(Number);
      const duracaoTotal = (hFim * 60 + mFim) - (hInicio * 60 + mInicio);

      const colaboradoresIdsAgenda = compartilhado
        ? divisoes.map(d => d.colaborador_id)
        : [validationData.colaborador_id];

      if (editingId) {
        const { error: agendError } = await supabase
          .from('agendamentos')
          .update({
            cliente_id: validationData.cliente_id,
            colaborador_id: validationData.colaborador_id,
            data_hora: dataCompleta,
            descricao_servico: servicosNomes,
            duracao_minutos: duracaoTotal,
            valor_estimado: validationData.valor_total,
            status: statusFinal,
            colaboradores_ids: colaboradoresIdsAgenda,
          })
          .eq('lancamento_id', editingId);

        if (agendError) {
          console.error('Erro ao atualizar agendamento:', agendError);
        }
      } else {
        const { error: agendError } = await supabase
          .from('agendamentos')
          .insert({
            cliente_id: validationData.cliente_id,
            colaborador_id: validationData.colaborador_id,
            data_hora: dataCompleta,
            descricao_servico: servicosNomes,
            duracao_minutos: duracaoTotal,
            valor_estimado: validationData.valor_total,
            lancamento_id: lancamento.id,
            status: statusFinal,
            colaboradores_ids: colaboradoresIdsAgenda,
          });

        if (agendError) {
          console.error('Erro ao criar agendamento:', agendError);
        }
      }

      let msgExtra = '';
      if (formData.is_fiado) {
        msgExtra = ' - Marcado como FIADO (pendente)';
      } else if (formData.is_troca_gratis) {
        msgExtra = ' - Troca/Grátis registrado';
      } else if (valorTaxa > 0) {
        msgExtra = ` (Taxa ${taxaPercentual}%: -R$ ${valorTaxa.toFixed(2)})`;
      }
      toast.success((editingId ? 'Lançamento atualizado!' : 'Lançamento criado!') + msgExtra);
      setShowModal(false);
      resetForm();
      loadData();

    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao salvar');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    let preSelectedColaboradorId = '';
    let preSelectedColaborador: Colaborador | null = null;

    if (userProfile?.colaboradorId) {
      const colaboradorDoUsuario = colaboradores.find(c => c.id === userProfile.colaboradorId);
      if (colaboradorDoUsuario) {
        preSelectedColaboradorId = colaboradorDoUsuario.id.toString();
        preSelectedColaborador = colaboradorDoUsuario;
      }
    }

    setFormData({
      colaborador_id: preSelectedColaboradorId,
      cliente_id: '',
      data: format(new Date(), 'yyyy-MM-dd'),
      hora_inicio: '09:00',
      hora_fim: '10:00',
      servicos_ids: [],
      valor_total: '',
      observacoes: '',
      forma_pagamento: '',
      is_fiado: false,
      is_troca_gratis: false,
      valor_referencia: '',
    });
    setSelectedColaborador(preSelectedColaborador);
    setSelectedCliente(null);
    setJaRealizado(false);
    setEditingId(null);
    setFormErrors('');
    setFiltroServico('');
    setCompartilhado(false);
    setDivisoes([]);
  }

  async function handleEdit(lanc: LancamentoComRelacoes) {
    const { data: lancFresh, error } = await supabase
      .from('lancamentos')
      .select('*')
      .eq('id', lanc.id)
      .single();

    if (error || !lancFresh) {
      toast.error('Erro ao carregar dados do lançamento');
      console.error('Erro ao buscar lançamento:', error);
      return;
    }

    const cliente = clientes.find(c => c.id === lancFresh.cliente_id);
    const colaborador = colaboradores.find(c => c.id === lancFresh.colaborador_id);

    const dataStr = lancFresh.data.split('T')[0];
    const horaInicio = lancFresh.hora_inicio ? lancFresh.hora_inicio.substring(0, 5) : '09:00';
    const horaFim = lancFresh.hora_fim ? lancFresh.hora_fim.substring(0, 5) : '10:00';

    let servicosIds = lancFresh.servicos_ids || [];
    if (servicosIds.length === 0 && lancFresh.servicos_nomes) {
      const nomesServicos = lancFresh.servicos_nomes.split(' + ').map((s: string) => s.trim());
      servicosIds = nomesServicos
        .map((nome: string) => {
          const servico = servicos.find(s => s.nome.toLowerCase() === nome.toLowerCase());
          return servico?.id;
        })
        .filter((id: number | undefined): id is number => id !== undefined);
    }

    setFormData({
      colaborador_id: lancFresh.colaborador_id.toString(),
      cliente_id: lancFresh.cliente_id.toString(),
      data: dataStr,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      servicos_ids: servicosIds,
      valor_total: lancFresh.valor_total.toFixed(2),
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

    const { data: divisoesData } = await supabase
      .from('lancamento_divisoes')
      .select('colaborador_id, valor')
      .eq('lancamento_id', lancFresh.id);

    if (divisoesData && divisoesData.length > 0) {
      setCompartilhado(true);
      setDivisoes(divisoesData.map((d: { colaborador_id: number; valor: number }) => ({
        colaborador_id: d.colaborador_id,
        valor: d.valor.toFixed(2),
      })));
    } else {
      setCompartilhado(false);
      setDivisoes([]);
    }

    setShowModal(true);
  }

  async function handleDelete(id: number) {
    try {
      const response = await fetch(`/api/lancamentos/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Erro ao excluir');
        return;
      }

      toast.success('Excluído com sucesso!');
      loadData();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir');
    }
    setDeleteConfirm({ isOpen: false, id: null });
  }

  function getStatusBadge(status: string, lanc: LancamentoComRelacoes) {
    if (lanc.is_fiado) {
      return <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">Fiado</span>;
    }
    if (lanc.is_troca_gratis) {
      return <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">Troca/Grátis</span>;
    }
    switch (status) {
      case 'pendente':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Pendente</span>;
      case 'concluido':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Concluído</span>;
      case 'cancelado':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Cancelado</span>;
      default:
        return null;
    }
  }

  const tabs: { key: TabType; label: string; color: string }[] = [
    { key: 'hoje', label: 'Hoje', color: 'blue' },
    { key: 'pendentes', label: 'Pendentes', color: 'yellow' },
    { key: 'finalizados', label: 'Finalizados', color: 'green' },
    { key: 'futuros', label: 'Futuros', color: 'purple' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <Link href="/" className="text-purple-600 hover:text-purple-800 text-sm mb-2 inline-block">
              ← Voltar ao Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-800">Lançamentos</h1>
            <p className="text-gray-600">Gerencie os atendimentos do salão</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            disabled={loading}
            className="mt-4 md:mt-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-xl">+</span>
            {loading ? 'Carregando...' : 'Novo Lançamento'}
          </button>
        </div>

        {/* Filtro por Colaborador */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium text-gray-700">Filtrar por colaborador:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFiltroColaborador('todos')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filtroColaborador === 'todos'
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-purple-100'
                }`}
              >
                Todos
              </button>
              {colaboradores.map(colab => (
                <button
                  key={colab.id}
                  onClick={() => setFiltroColaborador(colab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filtroColaborador === colab.id
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-purple-100'
                  }`}
                >
                  {colab.nome}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Abas de Status */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex flex-wrap">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 min-w-[120px] px-4 py-4 text-sm font-medium transition-all relative ${
                    activeTab === tab.key
                      ? 'text-purple-600 bg-purple-50'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>{tab.label}</span>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                      activeTab === tab.key
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {contadores[tab.key]}
                    </span>
                  </div>
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Lançamentos */}
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : lancamentosFiltrados.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Nenhum lançamento encontrado</p>
              <p className="text-sm text-gray-400 mt-1">
                {filtroColaborador !== 'todos' && 'Tente remover o filtro de colaborador'}
              </p>
            </div>
          ) : (
            <>
              {/* Tabela para Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data/Hora</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Colaboradora</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Serviços</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Valor</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Comissão</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pagamento</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lancamentosFiltrados.map(lanc => (
                      <tr key={lanc.id} className="hover:bg-purple-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-800">
                            {format(parseAsLocalTime(lanc.data), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {lanc.hora_inicio} - {lanc.hora_fim}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {clientes.find(c => c.id === lanc.cliente_id)?.nome || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {colaboradores.find(c => c.id === lanc.colaborador_id)?.nome || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                          {lanc.servicos_nomes || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">
                          R$ {lanc.valor_total.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {lanc._canViewComissao && lanc.comissao_colaborador ? (
                            <span className="font-semibold text-purple-600">
                              R$ {lanc.comissao_colaborador.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(lanc.status, lanc)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {lanc.forma_pagamento && !lanc.is_fiado && !lanc.is_troca_gratis ? (
                            <span className="text-gray-700">
                              {formasPagamentoDB.find(f => f.codigo === lanc.forma_pagamento)?.nome || lanc.forma_pagamento}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(lanc)}
                              className="text-blue-500 hover:text-blue-700 transition-colors p-1"
                              title="Editar"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ isOpen: true, id: lanc.id })}
                              className="text-red-500 hover:text-red-700 transition-colors p-1"
                              title="Excluir"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards para Mobile */}
              <div className="md:hidden divide-y divide-gray-100">
                {lancamentosFiltrados.map(lanc => (
                  <div key={lanc.id} className="p-4 hover:bg-purple-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-gray-800">
                          {clientes.find(c => c.id === lanc.cliente_id)?.nome || 'Cliente não identificado'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {colaboradores.find(c => c.id === lanc.colaborador_id)?.nome || '-'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          R$ {lanc.valor_total.toFixed(2)}
                        </div>
                        {getStatusBadge(lanc.status, lanc)}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <span>📅</span>
                        <span>{format(parseAsLocalTime(lanc.data), 'dd/MM/yyyy', { locale: ptBR })}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>🕐</span>
                        <span>{lanc.hora_inicio} - {lanc.hora_fim}</span>
                      </div>
                    </div>

                    {lanc.servicos_nomes && (
                      <div className="text-sm text-gray-600 mb-3 line-clamp-2">
                        <span className="font-medium">Serviços:</span> {lanc.servicos_nomes}
                      </div>
                    )}

                    {lanc._canViewComissao && lanc.comissao_colaborador && (
                      <div className="text-sm text-purple-600 mb-3">
                        <span className="font-medium">Comissão:</span> R$ {lanc.comissao_colaborador.toFixed(2)}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleEdit(lanc)}
                        className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ isOpen: true, id: lanc.id })}
                        className="px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Modal Novo Lançamento */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800">
                  {editingId ? 'Editar Lançamento' : 'Novo Lançamento'}
                </h2>
                <p className="text-gray-500 text-sm">
                  {editingId ? 'Modifique os dados do atendimento' : 'Preencha os dados do atendimento'}
                </p>
              </div>

              <div className="p-6 space-y-6">
                {formErrors && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm whitespace-pre-line">
                    {formErrors}
                  </div>
                )}

                {/* Colaboradora */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Colaboradora *
                  </label>
                  <select
                    value={formData.colaborador_id}
                    onChange={(e) => handleColaboradorChange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Selecione...</option>
                    {colaboradores.map(c => {
                      const showComissao = userProfile?.isAdmin || userProfile?.colaboradorId === c.id;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.nome}{showComissao ? ` (${c.porcentagem_comissao}%)` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Cliente */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente *
                  </label>
                  <ClienteAutocomplete
                    selectedCliente={selectedCliente}
                    onSelect={(cliente) => {
                      setSelectedCliente(cliente);
                      setFormData(prev => ({ ...prev, cliente_id: cliente?.id?.toString() || '' }));
                    }}
                  />
                </div>

                {/* Data e Horários */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data *
                    </label>
                    <input
                      type="date"
                      value={formData.data}
                      onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:contents gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Início *
                      </label>
                      <input
                        type="time"
                        value={formData.hora_inicio}
                        onChange={(e) => setFormData(prev => ({ ...prev, hora_inicio: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fim *
                      </label>
                      <input
                        type="time"
                        value={formData.hora_fim}
                        onChange={(e) => setFormData(prev => ({ ...prev, hora_fim: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Serviços */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Serviços * (selecione um ou mais)
                  </label>
                  <input
                    type="text"
                    placeholder="Pesquisar serviço..."
                    value={filtroServico}
                    onChange={(e) => setFiltroServico(e.target.value)}
                    className="w-full px-4 py-2 mb-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-xl">
                    {servicos
                      .filter(s => s.nome.toLowerCase().includes(filtroServico.toLowerCase()))
                      .map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleServicoToggle(s.id)}
                          className={`text-left px-3 py-2 rounded-lg text-sm transition-all ${
                            formData.servicos_ids.includes(s.id)
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-purple-100'
                          }`}
                        >
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor Total * (editável para descontos)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.valor_total}
                      onChange={(e) => setFormData(prev => ({ ...prev, valor_total: e.target.value }))}
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                      placeholder="0.00"
                    />
                  </div>
                  {selectedColaborador && formData.valor_total &&
                    (userProfile?.isAdmin || userProfile?.colaboradorId === selectedColaborador.id) && (
                    <p className="text-xs text-gray-500 mt-1">
                      Comissão: R$ {((parseFloat(formData.valor_total) * selectedColaborador.porcentagem_comissao) / 100).toFixed(2)}
                      ({selectedColaborador.porcentagem_comissao}%)
                    </p>
                  )}
                </div>

                {/* Serviço já realizado */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jaRealizado}
                      onChange={(e) => {
                        setJaRealizado(e.target.checked);
                        if (!e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            forma_pagamento: '',
                            is_fiado: false,
                            is_troca_gratis: false,
                            valor_referencia: '',
                          }));
                        }
                      }}
                      className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="font-medium text-gray-700">Serviço já foi realizado</span>
                  </label>

                  {jaRealizado && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-gray-600">Como foi recebido o pagamento?</p>
                      <div className="flex flex-wrap gap-2">
                        {formasPagamentoDB
                          .filter(f => f.codigo !== 'fiado' && f.codigo !== 'troca_gratis')
                          .map(forma => (
                            <button
                              key={forma.codigo}
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                forma_pagamento: forma.codigo,
                                is_fiado: false,
                                is_troca_gratis: false,
                                valor_referencia: '',
                              }))}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                formData.forma_pagamento === forma.codigo && !formData.is_fiado && !formData.is_troca_gratis
                                  ? 'bg-green-500 text-white'
                                  : 'bg-white border border-gray-200 text-gray-700 hover:border-green-300'
                              }`}
                            >
                              <span>{forma.icone}</span>
                              <span>{forma.nome}</span>
                              {forma.taxa_percentual > 0 && (
                                <span className={`text-xs ${formData.forma_pagamento === forma.codigo ? 'text-green-200' : 'text-red-500'}`}>
                                  ({forma.taxa_percentual}%)
                                </span>
                              )}
                            </button>
                          ))
                        }

                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            forma_pagamento: 'fiado',
                            is_fiado: true,
                            is_troca_gratis: false,
                            valor_referencia: '',
                          }))}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            formData.is_fiado
                              ? 'bg-orange-500 text-white'
                              : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-300'
                          }`}
                        >
                          <span>📝</span>
                          <span>Fiado</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            forma_pagamento: 'troca_gratis',
                            is_fiado: false,
                            is_troca_gratis: true,
                            valor_total: '0',
                          }))}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            formData.is_troca_gratis
                              ? 'bg-purple-500 text-white'
                              : 'bg-white border border-gray-200 text-gray-700 hover:border-purple-300'
                          }`}
                        >
                          <span>🎁</span>
                          <span>Troca / Grátis</span>
                        </button>
                      </div>

                      {formData.is_fiado && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                          <p className="text-orange-800 font-medium flex items-center gap-2">
                            <span>📝</span> Fiado selecionado
                          </p>
                          <ul className="text-orange-700 mt-2 space-y-1 list-disc list-inside">
                            <li>O serviço será marcado como <strong>pendente</strong></li>
                            <li>Não entrará no faturamento até ser pago</li>
                            <li>Você poderá receber o pagamento em Controle de Fiados</li>
                          </ul>
                        </div>
                      )}

                      {formData.is_troca_gratis && (
                        <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="text-purple-800 font-medium flex items-center gap-2 mb-2">
                            <span>🎁</span> Troca / Grátis selecionado
                          </p>
                          <p className="text-purple-700 text-sm mb-3">
                            O valor será R$ 0,00 (sem faturamento e sem comissão).
                          </p>
                          <div>
                            <label className="block text-sm font-medium text-purple-700 mb-1">
                              Valor de referência (opcional)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={formData.valor_referencia}
                                onChange={(e) => setFormData(prev => ({ ...prev, valor_referencia: e.target.value }))}
                                className="w-full pl-10 pr-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                                placeholder="0.00"
                              />
                            </div>
                            <p className="text-xs text-purple-600 mt-1">
                              Apenas para referência/histórico. Não entra em relatórios.
                            </p>
                          </div>
                        </div>
                      )}

                      {formData.forma_pagamento && formData.valor_total && selectedColaborador &&
                       !formData.is_fiado && !formData.is_troca_gratis &&
                       (userProfile?.isAdmin || userProfile?.colaboradorId === selectedColaborador.id) && (() => {
                        const formaSelecionada = formasPagamentoDB.find(f => f.codigo === formData.forma_pagamento);
                        const taxa = formaSelecionada?.taxa_percentual || 0;
                        if (taxa <= 0) return null;
                        const valorTotal = parseFloat(formData.valor_total);
                        const valorTaxa = (valorTotal * taxa) / 100;
                        const comissaoBruta = (valorTotal * selectedColaborador.porcentagem_comissao) / 100;
                        const comissaoLiquida = comissaoBruta - valorTaxa;
                        return (
                          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                            <p className="text-yellow-800 font-medium">Taxa de {formaSelecionada?.nome}: {taxa}%</p>
                            <ul className="text-yellow-700 mt-1 space-y-1">
                              <li>Comissão bruta: R$ {comissaoBruta.toFixed(2)}</li>
                              <li>Taxa descontada: -R$ {valorTaxa.toFixed(2)}</li>
                              <li className="font-bold">Comissão líquida: R$ {comissaoLiquida.toFixed(2)}</li>
                            </ul>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Serviço Compartilhado */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compartilhado}
                      onChange={(e) => {
                        setCompartilhado(e.target.checked);
                        if (e.target.checked && divisoes.length === 0) {
                          const valorTotal = parseFloat(formData.valor_total) || 0;
                          const valorMetade = valorTotal / 2;
                          setDivisoes([
                            { colaborador_id: selectedColaborador?.id || 0, valor: valorMetade.toFixed(2) },
                            { colaborador_id: 0, valor: valorMetade.toFixed(2) },
                          ]);
                        }
                      }}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
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
                              <select
                                value={div.colaborador_id}
                                onChange={(e) => {
                                  const newDivisoes = [...divisoes];
                                  newDivisoes[index].colaborador_id = parseInt(e.target.value);
                                  setDivisoes(newDivisoes);
                                }}
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-blue-500"
                              >
                                <option value={0}>Selecione...</option>
                                {colaboradores.map(c => (
                                  <option key={c.id} value={c.id}>{c.nome}</option>
                                ))}
                              </select>

                              <div className="flex items-center gap-1">
                                <span className="text-gray-500 text-sm">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={div.valor}
                                  onChange={(e) => {
                                    const newDivisoes = [...divisoes];
                                    newDivisoes[index].valor = e.target.value;
                                    setDivisoes(newDivisoes);
                                  }}
                                  className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 text-right"
                                  placeholder="0.00"
                                />
                              </div>

                              <span className="text-sm text-blue-600 font-medium w-12 text-right">
                                {percentual}%
                              </span>

                              {colab && (
                                <span className="text-xs text-gray-400">
                                  (Com: {colab.porcentagem_comissao}%)
                                </span>
                              )}

                              {divisoes.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newDivisoes = divisoes.filter((_, i) => i !== index);
                                    setDivisoes(newDivisoes);
                                  }}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDivisoes([...divisoes, { colaborador_id: 0, valor: '0' }]);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
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
                              <span className={isValid ? 'text-green-700' : 'text-red-700'}>
                                Total dividido: R$ {somaDivisoes.toFixed(2)} / R$ {valorTotal.toFixed(2)}
                              </span>
                              {diferenca > 0 && (
                                <span className="text-orange-600 font-medium">
                                  Restam R$ {diferenca.toFixed(2)}
                                </span>
                              )}
                              {diferenca < 0 && (
                                <span className="text-red-600 font-medium">
                                  Excede R$ {Math.abs(diferenca).toFixed(2)}
                                </span>
                              )}
                              {diferenca === 0 && somaDivisoes > 0 && (
                                <span className="text-green-600 font-medium">✓ OK</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                    placeholder="Observações opcionais..."
                  />
                </div>
              </div>

              {/* Footer do Modal */}
              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : (editingId ? 'Atualizar Lançamento' : 'Salvar Lançamento')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title="Excluir Lançamento"
          message="Tem certeza que deseja excluir este lançamento? O agendamento vinculado também será removido."
          onConfirm={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
          onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        />
      </div>
    </div>
  );
}
