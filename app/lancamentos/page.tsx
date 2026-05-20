'use client';

import { useEffect, useState, useMemo } from 'react';
import { Servico, Colaborador, Cliente } from '@/lib/supabase';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import NovoLancamentoModal from '@/components/NovoLancamentoModal';

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
  pagamentos?: { forma_pagamento: string; valor: number; taxa_percentual?: number; ordem?: number }[];
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
  const [editLancamentoId, setEditLancamentoId] = useState<number | null>(null);

  // Nova estrutura de filtros
  const [activeTab, setActiveTab] = useState<TabType>('hoje');
  const [filtroColaborador, setFiltroColaborador] = useState<number | 'todos'>('todos');
  const [filtroTravado, setFiltroTravado] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({
    isOpen: false,
    id: null,
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

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

  async function loadData(retryCount = 0, showLoading = true) {
    if (showLoading) setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // Carregar todos os lançamentos (sem filtro de data na API)
      const url = `/api/lancamentos?filtro=todos&_t=${Date.now()}`;

      const response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 500));
          return loadData(retryCount + 1, false);
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

        // Se não for admin, travar o filtro no colaborador do usuário
        if (!data._userProfile.isAdmin && data._userProfile.colaboradorId) {
          setFiltroColaborador(data._userProfile.colaboradorId);
          setFiltroTravado(true);
        }
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Erro ao carregar dados:', error);
      if (error.name === 'AbortError') {
        toast.error('Carregamento demorou demais. Tente atualizar a página.');
      } else {
        toast.error('Erro ao carregar lançamentos.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(lanc: LancamentoComRelacoes) {
    setEditLancamentoId(lanc.id);
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
      loadData(0, false);
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
            onClick={() => { setEditLancamentoId(null); setShowModal(true); }}
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
              {filtroTravado && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  (seu perfil)
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Botão "Todos" - só aparece para admin */}
              {!filtroTravado && (
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
              )}
              {/* Se filtro travado, mostra apenas o colaborador do usuário */}
              {filtroTravado ? (
                colaboradores
                  .filter(colab => colab.id === filtroColaborador)
                  .map(colab => (
                    <div
                      key={colab.id}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-500 text-white shadow-md cursor-default flex items-center gap-2"
                    >
                      {colab.nome}
                      <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  ))
              ) : (
                colaboradores.map(colab => (
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
                ))
              )}
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
                  className={`flex-1 md:min-w-[120px] px-4 py-4 text-sm font-medium transition-all relative ${
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
                          {(() => {
                            const pags = (lanc as any).pagamentos as { forma_pagamento: string; valor: number }[] | undefined;
                            if (pags && pags.length > 0 && !lanc.is_fiado && !lanc.is_troca_gratis) {
                              if (pags.length === 1) {
                                return <span className="text-gray-700">{formasPagamentoDB.find(f => f.codigo === pags[0].forma_pagamento)?.nome || pags[0].forma_pagamento}</span>;
                              }
                              return (
                                <div className="text-xs space-y-0.5">
                                  {pags.map((p, i) => (
                                    <div key={i} className="text-gray-700">
                                      {formasPagamentoDB.find(f => f.codigo === p.forma_pagamento)?.nome || p.forma_pagamento}
                                      <span className="text-gray-500"> · R$ {Number(p.valor).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            if (lanc.forma_pagamento && !lanc.is_fiado && !lanc.is_troca_gratis) {
                              return <span className="text-gray-700">{formasPagamentoDB.find(f => f.codigo === lanc.forma_pagamento)?.nome || lanc.forma_pagamento}</span>;
                            }
                            return <span className="text-gray-400">-</span>;
                          })()}
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

        {/* Modal Novo Lançamento (componente compartilhado com a Agenda) */}
        <NovoLancamentoModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSaved={() => loadData(0, false)}
          colaboradores={colaboradores}
          clientes={clientes}
          servicos={servicos}
          formasPagamentoDB={formasPagamentoDB}
          userProfile={userProfile}
          editLancamentoId={editLancamentoId}
        />


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
