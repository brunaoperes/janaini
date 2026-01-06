'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { supabase, Colaborador, Agendamento, Cliente } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { format, addHours, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import ClienteAutocomplete from '@/components/ClienteAutocomplete';

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

  // Verificar permissão de acesso
  useEffect(() => {
    if (authLoading || !id) return;

    // Admin pode ver qualquer colaborador
    if (isAdmin) return;

    // Usuário com vínculo só pode acessar sua própria página
    if (profile?.colaborador_id) {
      if (profile.colaborador_id.toString() !== id) {
        setAccessDenied(true);
      }
    }
  }, [authLoading, isAdmin, profile, id]);

  // Form states
  const [novoAgendamento, setNovoAgendamento] = useState({
    cliente: null as Cliente | null,
    data_hora: '',
    descricao_servico: '',
  });

  const [lancamento, setLancamento] = useState({
    valor_total: '',
    forma_pagamento: 'dinheiro',
  });

  useEffect(() => {
    if (id) loadColaborador();
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
      .gte('data_hora', startDate.toISOString())
      .lte('data_hora', endDate.toISOString())
      .order('data_hora');

    if (data && !error) {
      setAgendamentos(data);
    }
  };

  const criarAgendamento = async () => {
    if (!novoAgendamento.cliente || !novoAgendamento.data_hora) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const { error } = await supabase.from('agendamentos').insert({
      cliente_id: novoAgendamento.cliente.id,
      colaborador_id: id,
      data_hora: novoAgendamento.data_hora,
      descricao_servico: novoAgendamento.descricao_servico,
    });

    if (!error) {
      setShowNovoAgendamento(false);
      setNovoAgendamento({
        cliente: null,
        data_hora: '',
        descricao_servico: '',
      });
      loadAgendamentos();
    }
  };

  const finalizarAtendimento = async () => {
    if (!selectedAgendamento || !lancamento.valor_total) {
      alert('Preencha o valor do atendimento');
      return;
    }

    const valorTotal = parseFloat(lancamento.valor_total);
    const comissaoColaborador = (valorTotal * (colaborador?.porcentagem_comissao || 0)) / 100;
    const comissaoSalao = valorTotal - comissaoColaborador;

    const { error } = await supabase.from('lancamentos').insert({
      colaborador_id: id,
      cliente_id: selectedAgendamento.cliente_id,
      valor_total: valorTotal,
      forma_pagamento: lancamento.forma_pagamento,
      comissao_colaborador: comissaoColaborador,
      comissao_salao: comissaoSalao,
      data: new Date().toISOString(),
    });

    if (!error) {
      // Deletar o agendamento após finalizar
      await supabase.from('agendamentos').delete().eq('id', selectedAgendamento.id);

      setShowFinalizarAtendimento(false);
      setSelectedAgendamento(null);
      setLancamento({ valor_total: '', forma_pagamento: 'dinheiro' });
      loadAgendamentos();
      alert('Atendimento finalizado com sucesso!');
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

  if (authLoading || loading) return <LoadingSpinner />;

  // Acesso negado - usuário tentando acessar página de outro colaborador
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
              Você não tem permissão para acessar a área de outro colaborador.
            </p>
            <Link
              href={`/colaboradores/${profile?.colaborador_id}`}
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all"
            >
              Ir para minha área
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!colaborador) return <div className="text-center py-8">Colaborador não encontrado</div>;

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
            Olá, {colaborador.nome}!
          </h1>
          {/* Mostrar comissão apenas para admin ou o próprio colaborador */}
          {(isAdmin || profile?.colaborador_id?.toString() === id) && (
            <p className="text-gray-600">Sua comissão: {colaborador.porcentagem_comissao}%</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Minha Agenda</h2>
            <button
              onClick={() => setShowNovoAgendamento(true)}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
            >
              + Novo Agendamento
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
                      </div>
                      {agendamento.descricao_servico && (
                        <p className="text-gray-600 text-sm">{agendamento.descricao_servico}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedAgendamento(agendamento);
                        setShowFinalizarAtendimento(true);
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm"
                    >
                      Finalizar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Novo Agendamento */}
        {showNovoAgendamento && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
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
                  <label className="block text-gray-700 font-medium mb-2">Serviço</label>
                  <input
                    type="text"
                    value={novoAgendamento.descricao_servico}
                    onChange={(e) => setNovoAgendamento({ ...novoAgendamento, descricao_servico: e.target.value })}
                    placeholder="Ex: Corte e escova"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNovoAgendamento(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={criarAgendamento}
                  className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Finalizar Atendimento */}
        {showFinalizarAtendimento && selectedAgendamento && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Finalizar Atendimento</h3>

              <div className="bg-purple-50 rounded-lg p-4 mb-6">
                <p className="font-semibold text-gray-800">{selectedAgendamento.cliente?.nome}</p>
                <p className="text-gray-600 text-sm">{selectedAgendamento.descricao_servico}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Valor Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={lancamento.valor_total}
                    onChange={(e) => setLancamento({ ...lancamento, valor_total: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Forma de Pagamento</label>
                  <select
                    value={lancamento.forma_pagamento}
                    onChange={(e) => setLancamento({ ...lancamento, forma_pagamento: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="credito">Cartão de Crédito</option>
                    <option value="debito">Cartão de Débito</option>
                    <option value="pix">PIX</option>
                  </select>
                </div>

                {lancamento.valor_total && (
                  <div className="bg-green-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Sua comissão ({colaborador.porcentagem_comissao}%):</span>
                      <span className="font-bold text-green-700">
                        R$ {((parseFloat(lancamento.valor_total) * colaborador.porcentagem_comissao) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Comissão do salão:</span>
                      <span className="font-bold text-purple-700">
                        R$ {(parseFloat(lancamento.valor_total) - (parseFloat(lancamento.valor_total) * colaborador.porcentagem_comissao) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowFinalizarAtendimento(false);
                    setSelectedAgendamento(null);
                    setLancamento({ valor_total: '', forma_pagamento: 'dinheiro' });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={finalizarAtendimento}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
