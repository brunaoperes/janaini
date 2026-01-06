'use client';

import { useEffect, useState } from 'react';
import { supabase, Servico, Colaborador, Cliente } from '@/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { lancamentoSchema, formatZodErrors } from '@/lib/validations';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import ClienteAutocomplete from '@/components/ClienteAutocomplete';

// Função para parsear data/hora sem conversão de timezone
// PostgreSQL retorna: "2025-01-06T17:30:00+00:00"
// Queremos interpretar: 17:30 como horário local (não UTC)
const parseAsLocalTime = (dataHora: string): Date => {
  // Remover timezone (+00:00, Z, etc) da string
  const semTimezone = dataHora.replace(/([+-]\d{2}:\d{2}|Z)$/, '');

  // Parsear como local (formato: YYYY-MM-DDTHH:MM:SS ou YYYY-MM-DD HH:MM:SS)
  const partes = semTimezone.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/);

  if (partes) {
    const [_, ano, mes, dia, hora, minuto, segundo = '0'] = partes;
    return new Date(
      parseInt(ano),
      parseInt(mes) - 1, // Mês é 0-indexed
      parseInt(dia),
      parseInt(hora),
      parseInt(minuto),
      parseInt(segundo)
    );
  }

  // Fallback para formato só data (YYYY-MM-DD)
  const partesData = semTimezone.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (partesData) {
    const [_, ano, mes, dia] = partesData;
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), 12, 0, 0);
  }

  // Último fallback
  return new Date(dataHora);
};

interface LancamentoComRelacoes {
  id: number;
  colaborador_id: number;
  cliente_id: number;
  valor_total: number;
  forma_pagamento: string | null;
  comissao_colaborador: number | null;
  comissao_salao: number | null;
  valor_comissao?: number | null; // Campo retornado pela API (filtrado por permissão)
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
}

interface UserProfile {
  isAdmin: boolean;
  colaboradorId: number | null;
}

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { value: 'pix', label: 'PIX', icon: '📱' },
  { value: 'cartao_debito', label: 'Débito', icon: '💳' },
  { value: 'cartao_credito', label: 'Crédito', icon: '💳' },
];


interface FormaPagamentoDB {
  id: number;
  nome: string;
  codigo: string;
  icone: string;
  taxa_percentual: number;
  ativo: boolean;
}

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
  const [selectedFilter, setSelectedFilter] = useState<'todos' | 'hoje' | 'pendentes'>('hoje');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({
    isOpen: false,
    id: null,
  });

  // Estado do formulário unificado
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
  });

  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [jaRealizado, setJaRealizado] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedFilter]);

  async function loadData(retryCount = 0) {
    setLoading(true);

    try {
      const url = `/api/lancamentos?filtro=${selectedFilter}&_t=${Date.now()}`;

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

      console.log('[Lancamentos] Dados recebidos:', {
        colaboradores: colaboradoresData.length,
        servicos: servicosData.length,
        userProfile: data._userProfile,
      });

      setColaboradores(colaboradoresData);
      setClientes(data.clientes || []);
      setServicos(servicosData);
      setFormasPagamentoDB(data.formasPagamento || []);
      setLancamentos(data.lancamentos || []);

      if (data._userProfile) {
        setUserProfile(data._userProfile);

        console.log('[Lancamentos] UserProfile:', {
          isAdmin: data._userProfile.isAdmin,
          colaboradorId: data._userProfile.colaboradorId,
          editingId: editingId,
        });

        // Pré-selecionar colaborador do usuário logado (se tiver colaboradorId e não estiver editando)
        if (data._userProfile.colaboradorId) {
          const colaboradorDoUsuario = colaboradoresData.find(
            (c: Colaborador) => c.id === data._userProfile.colaboradorId
          );
          console.log('[Lancamentos] Colaborador encontrado:', colaboradorDoUsuario?.nome);

          if (colaboradorDoUsuario && !editingId) {
            setSelectedColaborador(colaboradorDoUsuario);
            setFormData(prev => ({
              ...prev,
              colaborador_id: colaboradorDoUsuario.id.toString(),
            }));
            console.log('[Lancamentos] Colaborador pré-selecionado:', colaboradorDoUsuario.nome);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calcular valor total baseado nos serviços selecionados
  function calcularValorTotal(servicosIds: number[]): number {
    return servicosIds.reduce((total, id) => {
      const servico = servicos.find(s => s.id === id);
      return total + (servico?.valor || 0);
    }, 0);
  }

  // Calcular hora fim baseada na duração dos serviços
  function calcularHoraFim(horaInicio: string, servicosIds: number[]): string {
    const duracaoTotal = servicosIds.reduce((total, id) => {
      const servico = servicos.find(s => s.id === id);
      return total + (servico?.duracao_minutos || 60);
    }, 0);

    const [h, m] = horaInicio.split(':').map(Number);
    const minutosInicio = h * 60 + m;
    const minutosFim = minutosInicio + duracaoTotal;

    const horaFim = Math.floor(minutosFim / 60);
    const minFim = minutosFim % 60;

    return `${horaFim.toString().padStart(2, '0')}:${minFim.toString().padStart(2, '0')}`;
  }

  // Atualizar serviços selecionados (apenas valor, não altera horário)
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

  // Selecionar colaboradora
  function handleColaboradorChange(colaboradorId: string) {
    const colab = colaboradores.find(c => c.id === Number(colaboradorId));
    setSelectedColaborador(colab || null);
    setFormData(prev => ({ ...prev, colaborador_id: colaboradorId }));
  }

  // Salvar lançamento (e criar agendamento automaticamente)
  async function handleSubmit() {
    setFormErrors('');
    setIsSubmitting(true);

    try {
      // Preparar dados para validação
      const servicosNomes = formData.servicos_ids
        .map(id => servicos.find(s => s.id === id)?.nome)
        .filter(Boolean)
        .join(' + ');

      // Validar forma de pagamento se já realizado
      if (jaRealizado && !formData.forma_pagamento) {
        setFormErrors('Selecione uma forma de pagamento');
        setIsSubmitting(false);
        return;
      }

      const statusFinal = jaRealizado ? 'concluido' : 'pendente';

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

      // Validar com Zod
      const validation = lancamentoSchema.safeParse(validationData);
      if (!validation.success) {
        setFormErrors(formatZodErrors(validation.error));
        setIsSubmitting(false);
        return;
      }

      // Buscar taxa da forma de pagamento (se já realizado)
      let taxaPercentual = 0;
      let valorTaxa = 0;
      if (jaRealizado && formData.forma_pagamento) {
        const { data: formaPagamento } = await supabase
          .from('formas_pagamento')
          .select('taxa_percentual')
          .eq('codigo', formData.forma_pagamento)
          .single();

        taxaPercentual = formaPagamento?.taxa_percentual || 0;
        valorTaxa = (validationData.valor_total * taxaPercentual) / 100;
      }

      // Calcular comissões (taxa é descontada da comissão do colaborador)
      const porcentagem = selectedColaborador?.porcentagem_comissao || 50;
      const comissaoBruta = (validationData.valor_total * porcentagem) / 100;
      const comissaoColaborador = comissaoBruta - valorTaxa;
      const comissaoSalao = validationData.valor_total - comissaoBruta;

      // Montar data/hora completa (garantir formato HH:MM:SS)
      const horaInicioFormatada = formData.hora_inicio.length === 5 ? `${formData.hora_inicio}:00` : formData.hora_inicio;
      const dataCompleta = `${formData.data}T${horaInicioFormatada}`;

      const lancamentoData = {
        colaborador_id: validationData.colaborador_id,
        cliente_id: validationData.cliente_id,
        valor_total: validationData.valor_total,
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
        forma_pagamento: jaRealizado ? formData.forma_pagamento : null,
        data_pagamento: jaRealizado ? new Date().toISOString() : null,
      };

      let lancamento;
      let lancError;

      if (editingId) {
        // ATUALIZAR lançamento existente
        const result = await supabase
          .from('lancamentos')
          .update(lancamentoData)
          .eq('id', editingId)
          .select()
          .single();
        lancamento = result.data;
        lancError = result.error;
      } else {
        // INSERIR novo lançamento
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

      // Calcular duração real baseada nos horários definidos pelo usuário
      const [hInicio, mInicio] = formData.hora_inicio.split(':').map(Number);
      const [hFim, mFim] = formData.hora_fim.split(':').map(Number);
      const duracaoTotal = (hFim * 60 + mFim) - (hInicio * 60 + mInicio);

      if (editingId) {
        // Atualizar agendamento vinculado
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
          })
          .eq('lancamento_id', editingId);

        if (agendError) {
          console.error('Erro ao atualizar agendamento:', agendError);
        }
      } else {
        // Criar novo agendamento vinculado
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
          });

        if (agendError) {
          console.error('Erro ao criar agendamento:', agendError);
        }
      }

      const msgTaxa = valorTaxa > 0 ? ` (Taxa ${taxaPercentual}%: -R$ ${valorTaxa.toFixed(2)})` : '';
      toast.success((editingId ? 'Lançamento atualizado!' : 'Lançamento criado!') + msgTaxa);
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
    setFormData({
      colaborador_id: '',
      cliente_id: '',
      data: format(new Date(), 'yyyy-MM-dd'),
      hora_inicio: '09:00',
      hora_fim: '10:00',
      servicos_ids: [],
      valor_total: '',
      observacoes: '',
      forma_pagamento: '',
    });
    setSelectedColaborador(null);
    setSelectedCliente(null);
    setJaRealizado(false);
    setEditingId(null);
    setFormErrors('');
  }

  // Função para editar um lançamento - BUSCA DADOS FRESCOS DO BANCO
  async function handleEdit(lanc: LancamentoComRelacoes) {
    // Buscar dados atualizados do banco
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

    // Extrair a data do campo data (que pode ter horário)
    const dataStr = lancFresh.data.split('T')[0];

    // Extrair apenas HH:MM do horário (pode vir como HH:MM:SS do banco)
    const horaInicio = lancFresh.hora_inicio ? lancFresh.hora_inicio.substring(0, 5) : '09:00';
    const horaFim = lancFresh.hora_fim ? lancFresh.hora_fim.substring(0, 5) : '10:00';

    // Se não tem servicos_ids mas tem servicos_nomes, tentar parsear
    let servicosIds = lancFresh.servicos_ids || [];
    if (servicosIds.length === 0 && lancFresh.servicos_nomes) {
      // Parsear "Corte + Escova + Manicure" para encontrar os IDs
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
    });

    setSelectedCliente(cliente || null);
    setSelectedColaborador(colaborador || null);
    setJaRealizado(lancFresh.status === 'concluido');
    setEditingId(lancFresh.id);
    setShowModal(true);
  }

  async function handleDelete(id: number) {
    try {
      // Usar API para deletar (bypass RLS)
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

  function getStatusBadge(status: string) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
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

        {/* Filtros */}
        <div className="flex gap-2 mb-6">
          {(['hoje', 'pendentes', 'todos'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedFilter === filter
                  ? 'bg-purple-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-purple-100'
              }`}
            >
              {filter === 'hoje' ? 'Hoje' : filter === 'pendentes' ? 'Pendentes' : 'Todos'}
            </button>
          ))}
        </div>

        {/* Lista de Lançamentos */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : lancamentos.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhum lançamento encontrado
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
                    {lancamentos.map(lanc => (
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
                          {getStatusBadge(lanc.status)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {lanc.forma_pagamento ? (
                            FORMAS_PAGAMENTO.find(f => f.value === lanc.forma_pagamento)?.label || lanc.forma_pagamento
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(lanc)}
                              className="text-blue-500 hover:text-blue-700 transition-colors"
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ isOpen: true, id: lanc.id })}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              title="Excluir"
                            >
                              🗑️
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
                {lancamentos.map(lanc => (
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
                        {getStatusBadge(lanc.status)}
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

                    {lanc.forma_pagamento && (
                      <div className="text-sm text-gray-600 mb-3">
                        <span className="font-medium">Pagamento:</span> {FORMAS_PAGAMENTO.find(f => f.value === lanc.forma_pagamento)?.label || lanc.forma_pagamento}
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
                        className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ isOpen: true, id: lanc.id })}
                        className="px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors"
                      >
                        🗑️
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
                      // Mostrar % comissão apenas para admin ou próprio colaborador
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
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-xl">
                    {servicos.map(s => (
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
                      onChange={(e) => setJaRealizado(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="font-medium text-gray-700">Serviço já foi realizado</span>
                  </label>

                  {jaRealizado && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-gray-600">Como foi recebido o pagamento?</p>
                      <div className="flex flex-wrap gap-2">
                        {formasPagamentoDB.length > 0 ? (
                          formasPagamentoDB.map(forma => (
                            <button
                              key={forma.codigo}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, forma_pagamento: forma.codigo }))}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                formData.forma_pagamento === forma.codigo
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
                        ) : (
                          FORMAS_PAGAMENTO.map(forma => (
                            <button
                              key={forma.value}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, forma_pagamento: forma.value }))}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                formData.forma_pagamento === forma.value
                                  ? 'bg-green-500 text-white'
                                  : 'bg-white border border-gray-200 text-gray-700 hover:border-green-300'
                              }`}
                            >
                              <span>{forma.icon}</span>
                              <span>{forma.label}</span>
                            </button>
                          ))
                        )}
                      </div>

                      {/* Preview da taxa quando selecionada uma forma com taxa */}
                      {/* Só mostra se for admin ou o próprio colaborador */}
                      {formData.forma_pagamento && formData.valor_total && selectedColaborador &&
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
