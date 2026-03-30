'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { supabase, Colaborador, Agendamento, Cliente, Servico } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import ClienteAutocomplete from '@/components/ClienteAutocomplete';
import toast from 'react-hot-toast';
import { verificarConflitoAgenda, formatarMensagemConflito } from '@/lib/agendamento-utils';

interface FormaPagamentoDB {
  id: number;
  nome: string;
  codigo: string;
  icone: string;
  taxa_percentual: number;
  ativo: boolean;
}

export default function ColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [id, setId] = useState<string>('');
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovoAgendamento, setShowNovoAgendamento] = useState(false);
  const [showFinalizarAtendimento, setShowFinalizarAtendimento] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [formasPagamentoDB, setFormasPagamentoDB] = useState<FormaPagamentoDB[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verificar permissao de acesso
  useEffect(() => {
    if (authLoading || !id) return;

    // Admin pode ver qualquer colaborador
    if (isAdmin) return;

    // Usuario com vinculo so pode acessar sua propria pagina
    if (profile?.colaborador_id) {
      if (profile.colaborador_id.toString() !== id) {
        setAccessDenied(true);
      }
    }
  }, [authLoading, isAdmin, profile, id]);

  // Form states for novo agendamento
  const [novoAgendamento, setNovoAgendamento] = useState({
    cliente: null as Cliente | null,
    data_hora: '',
    servicos_ids: [] as number[],
  });

  // Form states for finalizar atendimento
  const [lancamento, setLancamento] = useState({
    valor_total: '',
    forma_pagamento: '',
    is_fiado: false,
    is_troca_gratis: false,
    valor_referencia: '',
    servicos_ids: [] as number[],
  });

  useEffect(() => {
    if (id) {
      loadColaborador();
      loadServicos();
      loadFormasPagamento();
    }
  }, [id]);

  useEffect(() => {
    if (colaborador) {
      loadAgendamentos();
    }
  }, [colaborador, selectedDate]);

  const loadColaborador = async () => {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('*')
      .eq('id', id)
      .single();

    if (data && !error) {
      setColaborador(data);
    }
    setLoading(false);
  };

  const loadServicos = async () => {
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (data && !error) {
      // Filter to only services this colaborador can do
      const servicosDoColaborador = data.filter(
        (s: Servico) => s.colaboradores_ids?.includes(Number(id))
      );
      setServicos(servicosDoColaborador);
    }
  };

  const loadFormasPagamento = async () => {
    const { data, error } = await supabase
      .from('formas_pagamento')
      .select('*')
      .eq('ativo', true)
      .order('ordem');

    if (data && !error) {
      setFormasPagamentoDB(data);
    }
  };

  const loadAgendamentos = async () => {
    const startDate = startOfDay(new Date(selectedDate));
    const endDate = endOfDay(new Date(selectedDate));

    const { data, error } = await supabase
      .from('agendamentos')
      .select(`
        *,
        cliente:clientes(*),
        colaborador:colaboradores(*)
      `)
      .eq('colaborador_id', id)
      .neq('status', 'concluido')
      .gte('data_hora', startDate.toISOString())
      .lte('data_hora', endDate.toISOString())
      .order('data_hora');

    if (data && !error) {
      setAgendamentos(data);
    }
  };

  // Calculate total duration from selected services
  const calcularDuracaoTotal = (servicosIds: number[]) => {
    return servicosIds.reduce((total, sId) => {
      const servico = servicos.find(s => s.id === sId);
      return total + (servico?.duracao_minutos || 60);
    }, 0);
  };

  // Calculate total value from selected services
  const calcularValorTotal = (servicosIds: number[]) => {
    return servicosIds.reduce((total, sId) => {
      const servico = servicos.find(s => s.id === sId);
      return total + (servico?.valor || 0);
    }, 0);
  };

  // Get service names
  const getServicosNomes = (servicosIds: number[]) => {
    return servicosIds
      .map(sId => servicos.find(s => s.id === sId)?.nome)
      .filter(Boolean)
      .join(' + ');
  };

  const toggleServicoAgendamento = (servicoId: number) => {
    setNovoAgendamento(prev => {
      const ids = prev.servicos_ids;
      if (ids.includes(servicoId)) {
        return { ...prev, servicos_ids: ids.filter(id => id !== servicoId) };
      } else {
        return { ...prev, servicos_ids: [...ids, servicoId] };
      }
    });
  };

  const toggleServicoLancamento = (servicoId: number) => {
    setLancamento(prev => {
      const ids = prev.servicos_ids;
      let newIds: number[];
      if (ids.includes(servicoId)) {
        newIds = ids.filter(id => id !== servicoId);
      } else {
        newIds = [...ids, servicoId];
      }
      const novoValor = calcularValorTotal(newIds);
      return {
        ...prev,
        servicos_ids: newIds,
        valor_total: novoValor > 0 ? novoValor.toFixed(2) : '',
      };
    });
  };

  const criarAgendamento = async () => {
    if (!novoAgendamento.cliente || !novoAgendamento.data_hora) {
      toast.error('Preencha todos os campos obrigatorios');
      return;
    }

    if (novoAgendamento.servicos_ids.length === 0) {
      toast.error('Selecione pelo menos um servico');
      return;
    }

    setIsSubmitting(true);

    try {
      const duracaoTotal = calcularDuracaoTotal(novoAgendamento.servicos_ids);
      const descricaoServico = getServicosNomes(novoAgendamento.servicos_ids);
      const valorEstimado = calcularValorTotal(novoAgendamento.servicos_ids);

      // Check for scheduling conflicts
      const conflito = await verificarConflitoAgenda(
        Number(id),
        novoAgendamento.data_hora,
        duracaoTotal
      );

      if (conflito.hasConflict) {
        toast.error(formatarMensagemConflito(conflito));
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from('agendamentos').insert({
        cliente_id: novoAgendamento.cliente.id,
        colaborador_id: id,
        data_hora: novoAgendamento.data_hora,
        descricao_servico: descricaoServico,
        duracao_minutos: duracaoTotal,
        valor_estimado: valorEstimado,
        status: 'pendente',
      });

      if (error) {
        toast.error('Erro ao criar agendamento');
        console.error(error);
      } else {
        setShowNovoAgendamento(false);
        setNovoAgendamento({
          cliente: null,
          data_hora: '',
          servicos_ids: [],
        });
        loadAgendamentos();
        toast.success('Agendamento criado com sucesso!');
      }
    } catch (err) {
      toast.error('Erro ao criar agendamento');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const finalizarAtendimento = async () => {
    if (!selectedAgendamento) {
      toast.error('Nenhum agendamento selecionado');
      return;
    }

    // Validation based on type
    if (!lancamento.is_fiado && !lancamento.is_troca_gratis) {
      if (!lancamento.forma_pagamento || !lancamento.valor_total) {
        toast.error('Preencha a forma de pagamento e o valor');
        return;
      }
    } else if (lancamento.is_fiado && !lancamento.valor_total) {
      toast.error('Preencha o valor do atendimento');
      return;
    }

    setIsSubmitting(true);

    try {
      const valorTotal = lancamento.is_troca_gratis ? 0 : parseFloat(lancamento.valor_total);
      const servicosNomes = lancamento.servicos_ids.length > 0
        ? getServicosNomes(lancamento.servicos_ids)
        : selectedAgendamento.descricao_servico;

      // Determine status
      const statusFinal = lancamento.is_fiado ? 'pendente' : 'concluido';

      // Fetch payment method tax (only for normal payments)
      let taxaPercentual = 0;
      let valorTaxa = 0;
      if (!lancamento.is_fiado && !lancamento.is_troca_gratis && lancamento.forma_pagamento) {
        const { data: formaPagamento } = await supabase
          .from('formas_pagamento')
          .select('taxa_percentual')
          .eq('codigo', lancamento.forma_pagamento)
          .single();

        taxaPercentual = formaPagamento?.taxa_percentual || 0;
        valorTaxa = (valorTotal * taxaPercentual) / 100;
      }

      // Calculate commissions
      let comissaoColaborador = 0;
      let comissaoSalao = 0;

      if (lancamento.is_troca_gratis) {
        // Troca/Gratis: zero commissions
        comissaoColaborador = 0;
        comissaoSalao = 0;
      } else {
        const porcentagem = colaborador?.porcentagem_comissao || 50;
        const comissaoBruta = (valorTotal * porcentagem) / 100;

        if (lancamento.is_fiado) {
          // Fiado: commissions calculated but no tax deduction
          comissaoColaborador = comissaoBruta;
          comissaoSalao = valorTotal - comissaoBruta;
        } else {
          // Normal: tax deducted from colaborador commission
          comissaoColaborador = comissaoBruta - valorTaxa;
          comissaoSalao = valorTotal - comissaoBruta;
        }
      }

      // Determine payment method and payment date
      let formaPagamentoFinal: string | null = lancamento.forma_pagamento || null;
      let dataPagamentoFinal: string | null = new Date().toISOString();

      if (lancamento.is_fiado) {
        formaPagamentoFinal = 'fiado';
        dataPagamentoFinal = null;
      } else if (lancamento.is_troca_gratis) {
        formaPagamentoFinal = 'troca_gratis';
      }

      // Extract date/time from agendamento
      const dataAgendamento = selectedAgendamento.data_hora.split('T')[0];
      const horaAgendamento = selectedAgendamento.data_hora.split('T')[1]?.substring(0, 5) || '00:00';
      const dataLancamento = `${dataAgendamento}T${horaAgendamento}:00`;

      // Create lancamento
      const { data: novoLancamento, error: lancError } = await supabase
        .from('lancamentos')
        .insert({
          colaborador_id: Number(id),
          cliente_id: selectedAgendamento.cliente_id,
          valor_total: valorTotal,
          forma_pagamento: formaPagamentoFinal,
          comissao_colaborador: comissaoColaborador,
          comissao_salao: comissaoSalao,
          taxa_pagamento: valorTaxa,
          data: dataLancamento,
          hora_inicio: horaAgendamento,
          status: statusFinal,
          data_pagamento: dataPagamentoFinal,
          is_fiado: lancamento.is_fiado || false,
          is_troca_gratis: lancamento.is_troca_gratis || false,
          servicos_ids: lancamento.servicos_ids.length > 0 ? lancamento.servicos_ids : null,
          servicos_nomes: servicosNomes,
          valor_referencia: lancamento.is_troca_gratis && lancamento.valor_referencia
            ? parseFloat(lancamento.valor_referencia)
            : null,
        })
        .select()
        .single();

      if (lancError) throw lancError;

      // Update agendamento status to 'concluido' and link to lancamento (DO NOT DELETE)
      const { error: agendError } = await supabase
        .from('agendamentos')
        .update({
          status: lancamento.is_fiado ? 'pendente' : 'concluido',
          lancamento_id: novoLancamento.id,
        })
        .eq('id', selectedAgendamento.id);

      if (agendError) throw agendError;

      setShowFinalizarAtendimento(false);
      setSelectedAgendamento(null);
      setLancamento({
        valor_total: '',
        forma_pagamento: '',
        is_fiado: false,
        is_troca_gratis: false,
        valor_referencia: '',
        servicos_ids: [],
      });
      loadAgendamentos();

      // Success message
      if (lancamento.is_fiado) {
        toast.success('Servico marcado como FIADO! Aguardando pagamento.');
      } else if (lancamento.is_troca_gratis) {
        toast.success('Troca/Gratis registrado com sucesso!');
      } else {
        toast.success('Atendimento finalizado com sucesso!');
      }
    } catch (err) {
      toast.error('Erro ao finalizar atendimento');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const gerarHorariosDisponiveis = () => {
    const horarios = [];
    for (let i = 8; i <= 18; i++) {
      horarios.push(`${i.toString().padStart(2, '0')}:00`);
      if (i < 18) horarios.push(`${i.toString().padStart(2, '0')}:30`);
    }
    return horarios;
  };

  // Calculate preview values for the summary
  const getPreviewValues = () => {
    if (!lancamento.valor_total || !colaborador) return null;

    const valorTotal = parseFloat(lancamento.valor_total);
    if (isNaN(valorTotal) || valorTotal <= 0) return null;

    if (lancamento.is_troca_gratis) {
      return {
        comissaoColaborador: 0,
        comissaoSalao: 0,
        valorTaxa: 0,
        taxaPercentual: 0,
      };
    }

    const porcentagem = colaborador.porcentagem_comissao || 50;
    const comissaoBruta = (valorTotal * porcentagem) / 100;

    if (lancamento.is_fiado) {
      return {
        comissaoColaborador: comissaoBruta,
        comissaoSalao: valorTotal - comissaoBruta,
        valorTaxa: 0,
        taxaPercentual: 0,
      };
    }

    // Normal: check for payment method tax
    const formaSelecionada = formasPagamentoDB.find(f => f.codigo === lancamento.forma_pagamento);
    const taxaPercentual = formaSelecionada?.taxa_percentual || 0;
    const valorTaxa = (valorTotal * taxaPercentual) / 100;
    const comissaoColaborador = comissaoBruta - valorTaxa;
    const comissaoSalao = valorTotal - comissaoBruta;

    return {
      comissaoColaborador,
      comissaoSalao,
      valorTaxa,
      taxaPercentual,
    };
  };

  if (authLoading || loading) return <LoadingSpinner />;

  // Acesso negado - usuario tentando acessar pagina de outro colaborador
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Acesso Negado
            </h1>
            <p className="text-gray-600 mb-6">
              Voce nao tem permissao para acessar a area de outro colaborador.
            </p>
            <Link
              href={`/colaboradores/${profile?.colaborador_id}`}
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all"
            >
              Ir para minha area
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!colaborador) return <div className="text-center py-8">Colaborador nao encontrado</div>;

  const previewValues = getPreviewValues();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/colaboradores" className="text-purple-600 hover:text-purple-800">
            ← Voltar
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Ola, {colaborador.nome}!
          </h1>
          {/* Mostrar comissao apenas para admin ou o proprio colaborador */}
          {(isAdmin || profile?.colaborador_id?.toString() === id) && (
            <p className="text-gray-600">Sua comissao: {colaborador.porcentagem_comissao}%</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Minha Agenda</h2>
            <button
              onClick={() => setShowNovoAgendamento(true)}
              disabled={loading}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Carregando...' : '+ Novo Agendamento'}
            </button>
          </div>

          <div className="mb-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="space-y-3">
            {agendamentos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum agendamento para esta data</p>
            ) : (
              agendamentos.map((agendamento) => (
                <div
                  key={agendamento.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-purple-600">
                          {format(new Date(agendamento.data_hora), 'HH:mm')}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {agendamento.cliente?.nome}
                        </span>
                        {agendamento.status && agendamento.status !== 'pendente' && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            agendamento.status === 'concluido' ? 'bg-green-100 text-green-700' :
                            agendamento.status === 'cancelado' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {agendamento.status}
                          </span>
                        )}
                      </div>
                      {agendamento.descricao_servico && (
                        <p className="text-gray-600 text-sm">{agendamento.descricao_servico}</p>
                      )}
                      {agendamento.duracao_minutos && (
                        <p className="text-gray-400 text-xs mt-1">{agendamento.duracao_minutos} min</p>
                      )}
                    </div>
                    {agendamento.status !== 'concluido' && (
                      <button
                        onClick={() => {
                          setSelectedAgendamento(agendamento);
                          // Pre-populate services value if available
                          const valorEstimado = agendamento.valor_estimado;
                          setLancamento({
                            valor_total: valorEstimado ? valorEstimado.toFixed(2) : '',
                            forma_pagamento: '',
                            is_fiado: false,
                            is_troca_gratis: false,
                            valor_referencia: '',
                            servicos_ids: [],
                          });
                          setShowFinalizarAtendimento(true);
                        }}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm"
                      >
                        Finalizar
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Novo Agendamento */}
        {showNovoAgendamento && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Novo Agendamento</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Cliente</label>
                  <ClienteAutocomplete
                    onSelect={(cliente) => setNovoAgendamento({ ...novoAgendamento, cliente })}
                    selectedCliente={novoAgendamento.cliente}
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Data e Hora</label>
                  <input
                    type="datetime-local"
                    value={novoAgendamento.data_hora}
                    onChange={(e) => setNovoAgendamento({ ...novoAgendamento, data_hora: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Servicos</label>
                  {servicos.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nenhum servico disponivel para este colaborador</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                      {servicos.map((servico) => (
                        <label
                          key={servico.id}
                          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                            novoAgendamento.servicos_ids.includes(servico.id)
                              ? 'bg-purple-100 border-2 border-purple-400'
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={novoAgendamento.servicos_ids.includes(servico.id)}
                              onChange={() => toggleServicoAgendamento(servico.id)}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <div>
                              <span className="font-medium text-gray-800">{servico.nome}</span>
                              <span className="text-gray-500 text-sm ml-2">({servico.duracao_minutos} min)</span>
                            </div>
                          </div>
                          <span className="text-green-600 font-semibold text-sm">
                            R$ {servico.valor.toFixed(2)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {novoAgendamento.servicos_ids.length > 0 && (
                    <div className="mt-2 p-3 bg-purple-50 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Duracao total:</span>
                        <span className="font-semibold">{calcularDuracaoTotal(novoAgendamento.servicos_ids)} min</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600">Valor estimado:</span>
                        <span className="font-semibold text-green-600">
                          R$ {calcularValorTotal(novoAgendamento.servicos_ids).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowNovoAgendamento(false);
                    setNovoAgendamento({ cliente: null, data_hora: '', servicos_ids: [] });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 transition"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  onClick={criarAgendamento}
                  disabled={isSubmitting}
                  className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Criando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Finalizar Atendimento */}
        {showFinalizarAtendimento && selectedAgendamento && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Finalizar Atendimento</h3>

              <div className="bg-purple-50 rounded-lg p-4 mb-6">
                <p className="font-semibold text-gray-800">{selectedAgendamento.cliente?.nome}</p>
                <p className="text-gray-600 text-sm">{selectedAgendamento.descricao_servico}</p>
              </div>

              <div className="space-y-4">
                {/* Service picker */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Servicos realizados</label>
                  {servicos.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                      {servicos.map((servico) => (
                        <label
                          key={servico.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                            lancamento.servicos_ids.includes(servico.id)
                              ? 'bg-green-100 border-2 border-green-400'
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={lancamento.servicos_ids.includes(servico.id)}
                              onChange={() => toggleServicoLancamento(servico.id)}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                            />
                            <span className="font-medium text-gray-800 text-sm">{servico.nome}</span>
                          </div>
                          <span className="text-green-600 font-semibold text-sm">
                            R$ {servico.valor.toFixed(2)}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Nenhum servico cadastrado para este colaborador</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Valor Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={lancamento.valor_total}
                    onChange={(e) => setLancamento({ ...lancamento, valor_total: e.target.value })}
                    placeholder="0.00"
                    disabled={lancamento.is_troca_gratis}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  />
                </div>

                {/* Payment method selector */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Forma de Pagamento</label>
                  <div className="flex flex-wrap gap-2">
                    {formasPagamentoDB
                      .filter(f => f.codigo !== 'fiado' && f.codigo !== 'troca_gratis')
                      .map(forma => (
                        <button
                          key={forma.codigo}
                          type="button"
                          onClick={() => setLancamento(prev => ({
                            ...prev,
                            forma_pagamento: forma.codigo,
                            is_fiado: false,
                            is_troca_gratis: false,
                            valor_referencia: '',
                          }))}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            lancamento.forma_pagamento === forma.codigo && !lancamento.is_fiado && !lancamento.is_troca_gratis
                              ? 'bg-green-500 text-white'
                              : 'bg-white border border-gray-200 text-gray-700 hover:border-green-300'
                          }`}
                        >
                          <span>{forma.icone}</span>
                          <span>{forma.nome}</span>
                          {forma.taxa_percentual > 0 && (
                            <span className={`text-xs ${lancamento.forma_pagamento === forma.codigo && !lancamento.is_fiado && !lancamento.is_troca_gratis ? 'text-green-200' : 'text-red-500'}`}>
                              ({forma.taxa_percentual}%)
                            </span>
                          )}
                        </button>
                      ))
                    }

                    {/* Fiado button */}
                    <button
                      type="button"
                      onClick={() => setLancamento(prev => ({
                        ...prev,
                        forma_pagamento: 'fiado',
                        is_fiado: true,
                        is_troca_gratis: false,
                        valor_referencia: '',
                      }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        lancamento.is_fiado
                          ? 'bg-orange-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-300'
                      }`}
                    >
                      📝 Fiado
                    </button>

                    {/* Troca/Gratis button */}
                    <button
                      type="button"
                      onClick={() => setLancamento(prev => ({
                        ...prev,
                        forma_pagamento: 'troca_gratis',
                        is_fiado: false,
                        is_troca_gratis: true,
                        valor_total: '0',
                      }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        lancamento.is_troca_gratis
                          ? 'bg-purple-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-purple-300'
                      }`}
                    >
                      🎁 Troca / Gratis
                    </button>
                  </div>
                </div>

                {/* Fiado info */}
                {lancamento.is_fiado && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                    <p className="text-orange-800 font-medium flex items-center gap-2">
                      📝 Fiado selecionado
                    </p>
                    <ul className="text-orange-700 mt-2 space-y-1 list-disc list-inside">
                      <li>O servico sera marcado como <strong>pendente</strong></li>
                      <li>Nao entrara no faturamento ate ser pago</li>
                      <li>Voce podera receber o pagamento em Controle de Fiados</li>
                    </ul>
                  </div>
                )}

                {/* Troca/Gratis info */}
                {lancamento.is_troca_gratis && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-purple-800 font-medium flex items-center gap-2 mb-2">
                      🎁 Troca / Gratis selecionado
                    </p>
                    <p className="text-purple-700 text-sm mb-3">
                      O valor sera R$ 0,00 (sem faturamento e sem comissao).
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-purple-700 mb-1">
                        Valor de referencia (opcional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={lancamento.valor_referencia}
                          onChange={(e) => setLancamento(prev => ({ ...prev, valor_referencia: e.target.value }))}
                          className="w-full pl-10 pr-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="0.00"
                        />
                      </div>
                      <p className="text-xs text-purple-600 mt-1">
                        Apenas para referencia/historico. Nao entra em relatorios.
                      </p>
                    </div>
                  </div>
                )}

                {/* Commission preview */}
                {previewValues && !lancamento.is_troca_gratis && lancamento.valor_total && (
                  <div className="bg-green-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Comissao bruta ({colaborador.porcentagem_comissao}%):</span>
                      <span className="font-bold text-gray-700">
                        R$ {((parseFloat(lancamento.valor_total) * colaborador.porcentagem_comissao) / 100).toFixed(2)}
                      </span>
                    </div>
                    {previewValues.valorTaxa > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-600 text-sm">Taxa {lancamento.forma_pagamento} ({previewValues.taxaPercentual}%):</span>
                        <span className="font-bold text-red-600 text-sm">
                          - R$ {previewValues.valorTaxa.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-700">Sua comissao liquida:</span>
                      <span className="font-bold text-green-700">
                        R$ {previewValues.comissaoColaborador.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Comissao do salao:</span>
                      <span className="font-bold text-purple-700">
                        R$ {previewValues.comissaoSalao.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {lancamento.is_troca_gratis && (
                  <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
                    Sem comissoes (Troca/Gratis)
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowFinalizarAtendimento(false);
                    setSelectedAgendamento(null);
                    setLancamento({
                      valor_total: '',
                      forma_pagamento: '',
                      is_fiado: false,
                      is_troca_gratis: false,
                      valor_referencia: '',
                      servicos_ids: [],
                    });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 transition"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  onClick={finalizarAtendimento}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Finalizando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
