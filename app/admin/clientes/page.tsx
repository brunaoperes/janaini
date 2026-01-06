'use client';

import { useState, useEffect } from 'react';
export const dynamic = 'force-dynamic';
import { supabase, Cliente } from '@/lib/supabase';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { format, differenceInDays, parseISO } from 'date-fns';

export default function ClientesAdminPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesStats, setClientesStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAniversariantes, setFilterAniversariantes] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    aniversario: '',
  });

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/admin?tabela=clientes');
      const result = await response.json();

      if (result.data) {
        setClientes(result.data);
        await loadStats(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
    setLoading(false);
  };

  const loadStats = async (clientes: Cliente[]) => {
    try {
      // Carregar lançamentos para cada cliente
      const lancResponse = await fetch('/api/admin?tabela=lancamentos');
      const lancResult = await lancResponse.json();
      const lancamentos = lancResult.data || [];

      // Carregar agendamentos para cada cliente
      const agendResponse = await fetch('/api/admin?tabela=agendamentos');
      const agendResult = await agendResponse.json();
      const agendamentos = agendResult.data || [];

      const statsMap: any = {};

      clientes.forEach((cliente) => {
        const lancamentosCliente = lancamentos?.filter((l: any) => l.cliente_id === cliente.id) || [];
        const agendamentosCliente = agendamentos?.filter((a: any) => a.cliente_id === cliente.id) || [];

        // Último lançamento (atendimento concluído)
        const ultimoLancamento = lancamentosCliente.length > 0
          ? lancamentosCliente.sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime())[0]
          : null;

        // Último agendamento (pode ser pendente ou concluído)
        const ultimoAgendamento = agendamentosCliente.length > 0
          ? agendamentosCliente.sort((a: any, b: any) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())[0]
          : null;

        // Usar a data mais recente entre lançamento e agendamento
        let ultimaVisita = null;
        if (ultimoLancamento && ultimoAgendamento) {
          const dataLanc = new Date(ultimoLancamento.data).getTime();
          const dataAgend = new Date(ultimoAgendamento.data_hora).getTime();
          ultimaVisita = dataLanc > dataAgend ? ultimoLancamento.data : ultimoAgendamento.data_hora.split('T')[0];
        } else if (ultimoLancamento) {
          ultimaVisita = ultimoLancamento.data;
        } else if (ultimoAgendamento) {
          ultimaVisita = ultimoAgendamento.data_hora.split('T')[0];
        }

        statsMap[cliente.id] = {
          totalAtendimentos: lancamentosCliente.length,
          totalAgendamentos: agendamentosCliente.length,
          totalGasto: lancamentosCliente.reduce((sum: number, l: any) => sum + l.valor_total, 0),
          ultimoAtendimento: ultimaVisita,
        };
      });

      setClientesStats(statsMap);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.nome || !formData.telefone) {
      alert('Preencha os campos obrigatórios');
      return;
    }

    try {
      if (editingCliente) {
        const response = await fetch('/api/admin', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabela: 'clientes', id: editingCliente.id, dados: formData }),
        });

        if (response.ok) {
          loadClientes();
          closeModal();
        }
      } else {
        const response = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabela: 'clientes', dados: formData }),
        });

        if (response.ok) {
          loadClientes();
          closeModal();
        }
      }
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        const response = await fetch(`/api/admin?tabela=clientes&id=${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          loadClientes();
        }
      } catch (error) {
        console.error('Erro ao excluir cliente:', error);
      }
    }
  };

  const openModal = (cliente?: Cliente) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        nome: cliente.nome,
        telefone: cliente.telefone,
        aniversario: cliente.aniversario || '',
      });
    } else {
      setEditingCliente(null);
      setFormData({ nome: '', telefone: '', aniversario: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCliente(null);
    setFormData({ nome: '', telefone: '', aniversario: '' });
  };

  const isAniversarianteDoMes = (aniversario: string | null) => {
    if (!aniversario) return false;
    const hoje = new Date();
    const dataNiver = new Date(aniversario);
    return dataNiver.getMonth() === hoje.getMonth();
  };

  const diasSemVisitar = (ultimoAtendimento: string | null) => {
    if (!ultimoAtendimento) return null;
    return differenceInDays(new Date(), parseISO(ultimoAtendimento));
  };

  const clientesFiltrados = clientes.filter((cliente) => {
    const matchSearch = cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       cliente.telefone.includes(searchTerm);
    const matchAniversariante = !filterAniversariantes || isAniversarianteDoMes(cliente.aniversario);
    return matchSearch && matchAniversariante;
  });

  const aniversariantesDoMes = clientes.filter((c) => isAniversarianteDoMes(c.aniversario));

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDECFB] via-[#E7D3FF] to-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-purple-100 shadow-soft">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="flex items-center gap-2 text-purple-600 hover:text-purple-800 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Voltar</span>
              </Link>
              <div className="h-6 w-px bg-purple-200" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Naví Belle - Clientes
                </h1>
                <p className="text-sm text-gray-600">Gerencie seus clientes</p>
              </div>
            </div>
            <button
              onClick={() => openModal()}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {loading ? 'Carregando...' : 'Novo Cliente'}
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">
        {/* Estatísticas Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft animate-fade-in-up">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total de Clientes</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {clientes.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Aniversariantes</p>
                <p className="text-3xl font-bold text-gray-800">{aniversariantesDoMes.length}</p>
                <p className="text-xs text-gray-500">este mês</p>
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Clientes Ativos</p>
                <p className="text-3xl font-bold text-gray-800">
                  {Object.values(clientesStats).filter((s: any) => s.totalAtendimentos > 0).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Ticket Médio</p>
                <p className="text-3xl font-bold text-gray-800">
                  R$ {
                    Object.values(clientesStats).length > 0
                      ? (Object.values(clientesStats).reduce((sum: number, s: any) => sum + s.totalGasto, 0) /
                         Object.values(clientesStats).filter((s: any) => s.totalAtendimentos > 0).length || 1).toFixed(2)
                      : '0.00'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Buscar Cliente</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Digite nome ou telefone..."
                  className="w-full px-4 py-3 pl-11 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition-all"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterAniversariantes}
                  onChange={(e) => setFilterAniversariantes(e.target.checked)}
                  className="w-5 h-5 rounded border-purple-300 text-pink-600 focus:ring-pink-500"
                />
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <span>Apenas Aniversariantes do Mês</span>
                  {aniversariantesDoMes.length > 0 && (
                    <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full text-xs font-bold">
                      {aniversariantesDoMes.length}
                    </span>
                  )}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Lista de Clientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clientesFiltrados.map((cliente, index) => {
            const stats = clientesStats[cliente.id] || { totalAtendimentos: 0, totalGasto: 0, ultimoAtendimento: null };
            const diasSemAtendimento = diasSemVisitar(stats.ultimoAtendimento);
            const isAniversariante = isAniversarianteDoMes(cliente.aniversario);

            return (
              <div
                key={cliente.id}
                className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft hover:shadow-soft-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in-up group relative overflow-hidden"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Badge Aniversariante */}
                {isAniversariante && (
                  <div className="absolute top-4 right-4">
                    <div className="px-3 py-1 bg-gradient-to-r from-pink-500 to-pink-600 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
                      </svg>
                      Aniversário
                    </div>
                  </div>
                )}

                {/* Header */}
                <div className="mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {cliente.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-800 truncate">{cliente.nome}</h3>
                      <p className="text-sm text-gray-600">{cliente.telefone}</p>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-2 mb-4 pt-4 border-t border-purple-100">
                  {cliente.aniversario && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Aniversário</span>
                      <span className="font-medium text-gray-800">
                        {format(new Date(cliente.aniversario), 'dd/MM')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Atendimentos</span>
                    <span className="font-bold text-purple-600">{stats.totalAtendimentos}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Gasto</span>
                    <span className="font-bold text-green-600">R$ {stats.totalGasto.toFixed(2)}</span>
                  </div>
                  {/* Última Visita */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Última visita</span>
                    {stats.ultimoAtendimento ? (
                      <div className="text-right">
                        <span className="font-medium text-gray-800 block">
                          {format(parseISO(stats.ultimoAtendimento), 'dd/MM/yyyy')}
                        </span>
                        <span className={`text-xs ${diasSemAtendimento && diasSemAtendimento > 60 ? 'text-red-600 font-semibold' : diasSemAtendimento && diasSemAtendimento > 30 ? 'text-orange-600' : 'text-gray-500'}`}>
                          há {diasSemAtendimento} dias
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Nunca visitou</span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-4 border-t border-purple-100">
                  <button
                    onClick={() => openModal(cliente)}
                    className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-medium hover:bg-blue-200 transition-colors text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(cliente.id)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200 transition-colors text-sm"
                  >
                    Excluir
                  </button>
                </div>

                {/* Alerta de inatividade */}
                {diasSemAtendimento && diasSemAtendimento > 60 && (
                  <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-700 font-medium">⚠️ Cliente inativo há mais de 60 dias</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {clientesFiltrados.length === 0 && (
          <div className="text-center py-16 bg-white/60 backdrop-blur-xl rounded-2xl border border-purple-100">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-gray-600 text-lg mb-4">
              {searchTerm || filterAniversariantes ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </p>
            {!searchTerm && !filterAniversariantes && (
              <button
                onClick={() => openModal()}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all"
              >
                Cadastrar Primeiro Cliente
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Premium */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full animate-modal-in"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
                </h3>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition-all"
                  placeholder="Digite o nome"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition-all"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Data de Aniversário
                </label>
                <input
                  type="date"
                  value={formData.aniversario}
                  onChange={(e) => setFormData({ ...formData, aniversario: e.target.value })}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition-all"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Você receberá lembretes de aniversários
                </p>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl"
                >
                  {editingCliente ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
