'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import Button from '@/components/Button';
import ClienteAutocomplete from '@/components/ClienteAutocomplete';

// Interfaces
interface Cliente {
  id: number;
  nome: string;
  telefone: string;
}

interface Colaborador {
  id: number;
  nome: string;
  porcentagem_comissao: number;
}

interface Servico {
  id: number;
  nome: string;
  valor: number;
  duracao_minutos: number;
}

interface FormaPagamento {
  codigo: string;
  nome: string;
  icone?: string;
  taxa_percentual?: number;
}

interface Pacote {
  id: number;
  cliente_id: number;
  servico_id: number;
  colaborador_vendedor_id: number;
  nome: string;
  quantidade_total: number;
  quantidade_usada: number;
  valor_total: number;
  valor_por_sessao: number;
  desconto_percentual?: number;
  comissao_vendedor: number;
  comissao_salao: number;
  data_venda: string;
  data_validade?: string;
  data_cancelamento?: string;
  status: 'ativo' | 'expirado' | 'concluido' | 'cancelado';
  motivo_cancelamento?: string;
  valor_reembolso?: number;
  forma_pagamento?: string;
  observacoes?: string;
  cliente?: Cliente;
  servico?: Servico;
  colaborador_vendedor?: Colaborador;
}

interface PacoteUso {
  id: number;
  pacote_id: number;
  colaborador_executor_id: number;
  data_uso: string;
  hora_inicio?: string;
  hora_fim?: string;
  observacoes?: string;
  registrado_por_nome?: string;
  colaborador_executor?: { id: number; nome: string };
}

interface Totais {
  ativos: number;
  expirados: number;
  concluidos: number;
  cancelados: number;
  valor_total_vendas: number;
}

export default function PacotesAdminPage() {
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [totais, setTotais] = useState<Totais>({ ativos: 0, expirados: 0, concluidos: 0, cancelados: 0, valor_total_vendas: 0 });
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Modais
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [showUsoModal, setShowUsoModal] = useState(false);
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [pacoteSelecionado, setPacoteSelecionado] = useState<Pacote | null>(null);
  const [usosPacote, setUsosPacote] = useState<PacoteUso[]>([]);
  const [loadingUsos, setLoadingUsos] = useState(false);

  // Formulário novo pacote
  const [formNovo, setFormNovo] = useState({
    cliente_id: 0,
    servico_id: 0,
    colaborador_vendedor_id: 0,
    quantidade_total: 4,
    valor_total: 0,
    desconto_percentual: 0,
    data_validade: '',
    forma_pagamento: '',
    observacoes: '',
  });

  // Formulário uso
  const [formUso, setFormUso] = useState({
    colaborador_executor_id: 0,
    data_uso: format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: '',
    hora_fim: '',
    observacoes: '',
  });

  // Formulário cancelamento
  const [formCancelar, setFormCancelar] = useState({
    motivo_cancelamento: '',
    valor_reembolso: 0,
    forma_reembolso: '',
  });

  const [salvando, setSalvando] = useState(false);
  const [selectedClienteNovo, setSelectedClienteNovo] = useState<Cliente | null>(null);

  // Carregar dados
  const loadPacotes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroStatus !== 'todos') {
        params.set('status', filtroStatus);
      }

      const response = await fetch(`/api/pacotes?${params.toString()}`);
      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setPacotes(data.pacotes || []);
      setClientes(data.clientes || []);
      setColaboradores(data.colaboradores || []);
      setServicos(data.servicos || []);
      setFormasPagamento(data.formasPagamento || []);
      setTotais(data.totais || { ativos: 0, expirados: 0, concluidos: 0, cancelados: 0, valor_total_vendas: 0 });
    } catch {
      toast.error('Erro ao carregar pacotes');
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => {
    loadPacotes();
  }, [loadPacotes]);

  // Carregar usos de um pacote
  const loadUsos = async (pacoteId: number) => {
    try {
      setLoadingUsos(true);
      const response = await fetch(`/api/pacotes/uso?pacoteId=${pacoteId}`);
      const data = await response.json();
      setUsosPacote(data.usos || []);
    } catch {
      toast.error('Erro ao carregar histórico de usos');
    } finally {
      setLoadingUsos(false);
    }
  };

  // Calcular valor sugerido baseado no serviço
  const calcularValorSugerido = (servicoId: number, quantidade: number, desconto: number) => {
    const servico = servicos.find(s => s.id === servicoId);
    if (!servico) return 0;
    const valorBruto = servico.valor * quantidade;
    const valorComDesconto = valorBruto * (1 - desconto / 100);
    return Math.round(valorComDesconto * 100) / 100;
  };

  // Atualizar valor quando serviço ou quantidade muda
  useEffect(() => {
    if (formNovo.servico_id && formNovo.quantidade_total) {
      const valorSugerido = calcularValorSugerido(
        formNovo.servico_id,
        formNovo.quantidade_total,
        formNovo.desconto_percentual
      );
      setFormNovo(prev => ({ ...prev, valor_total: valorSugerido }));
    }
  }, [formNovo.servico_id, formNovo.quantidade_total, formNovo.desconto_percentual, servicos]);

  // Criar novo pacote
  const handleCriarPacote = async () => {
    if (!selectedClienteNovo || !formNovo.servico_id || !formNovo.colaborador_vendedor_id || !formNovo.forma_pagamento) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSalvando(true);
      const response = await fetch('/api/pacotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formNovo, cliente_id: selectedClienteNovo.id }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success('Pacote criado com sucesso!');
      setShowNovoModal(false);
      setSelectedClienteNovo(null);
      setFormNovo({
        cliente_id: 0,
        servico_id: 0,
        colaborador_vendedor_id: 0,
        quantidade_total: 4,
        valor_total: 0,
        desconto_percentual: 0,
        data_validade: '',
        forma_pagamento: '',
        observacoes: '',
      });
      loadPacotes();
    } catch {
      toast.error('Erro ao criar pacote');
    } finally {
      setSalvando(false);
    }
  };

  // Registrar uso
  const handleRegistrarUso = async () => {
    if (!pacoteSelecionado || !formUso.colaborador_executor_id || !formUso.data_uso) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSalvando(true);
      const response = await fetch('/api/pacotes/uso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pacote_id: pacoteSelecionado.id,
          ...formUso,
        }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success(data.message || 'Sessão registrada!');
      setShowUsoModal(false);
      setFormUso({
        colaborador_executor_id: 0,
        data_uso: format(new Date(), 'yyyy-MM-dd'),
        hora_inicio: '',
        hora_fim: '',
        observacoes: '',
      });
      loadPacotes();
    } catch {
      toast.error('Erro ao registrar uso');
    } finally {
      setSalvando(false);
    }
  };

  // Cancelar pacote
  const handleCancelarPacote = async () => {
    if (!pacoteSelecionado || !formCancelar.motivo_cancelamento) {
      toast.error('Informe o motivo do cancelamento');
      return;
    }

    try {
      setSalvando(true);
      const response = await fetch('/api/pacotes/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pacote_id: pacoteSelecionado.id,
          ...formCancelar,
        }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success(data.message || 'Pacote cancelado!');
      setShowCancelarModal(false);
      setFormCancelar({
        motivo_cancelamento: '',
        valor_reembolso: 0,
        forma_reembolso: '',
      });
      loadPacotes();
    } catch {
      toast.error('Erro ao cancelar pacote');
    } finally {
      setSalvando(false);
    }
  };

  // Abrir modal de detalhes
  const abrirDetalhes = (pacote: Pacote) => {
    setPacoteSelecionado(pacote);
    loadUsos(pacote.id);
    setShowDetalhesModal(true);
  };

  // Abrir modal de uso
  const abrirUso = (pacote: Pacote) => {
    setPacoteSelecionado(pacote);
    setShowUsoModal(true);
  };

  // Abrir modal de cancelamento
  const abrirCancelamento = (pacote: Pacote) => {
    setPacoteSelecionado(pacote);
    const sessoesRestantes = pacote.quantidade_total - pacote.quantidade_usada;
    const reembolsoMaximo = pacote.valor_por_sessao * sessoesRestantes;
    setFormCancelar({
      motivo_cancelamento: '',
      valor_reembolso: reembolsoMaximo,
      forma_reembolso: pacote.forma_pagamento || '',
    });
    setShowCancelarModal(true);
  };

  // Helper para cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-green-100 text-green-800';
      case 'expirado': return 'bg-yellow-100 text-yellow-800';
      case 'concluido': return 'bg-blue-100 text-blue-800';
      case 'cancelado': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper para texto do status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'ativo': return 'Ativo';
      case 'expirado': return 'Expirado';
      case 'concluido': return 'Concluído';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-soft flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-soft">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-purple-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="p-2 rounded-xl bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Pacotes de Sessões
                </h1>
                <p className="text-sm text-gray-500">Gerencie pacotes pré-pagos</p>
              </div>
            </div>
            <Button onClick={() => setShowNovoModal(true)}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Pacote
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 border border-green-100">
            <p className="text-sm text-gray-600">Ativos</p>
            <p className="text-2xl font-bold text-green-600">{totais.ativos}</p>
          </div>
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 border border-yellow-100">
            <p className="text-sm text-gray-600">Expirados</p>
            <p className="text-2xl font-bold text-yellow-600">{totais.expirados}</p>
          </div>
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 border border-blue-100">
            <p className="text-sm text-gray-600">Concluídos</p>
            <p className="text-2xl font-bold text-blue-600">{totais.concluidos}</p>
          </div>
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 border border-red-100">
            <p className="text-sm text-gray-600">Cancelados</p>
            <p className="text-2xl font-bold text-red-600">{totais.cancelados}</p>
          </div>
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 border border-purple-100 col-span-2 md:col-span-1">
            <p className="text-sm text-gray-600">Total Vendas</p>
            <p className="text-2xl font-bold text-purple-600">
              R$ {totais.valor_total_vendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 border border-purple-100 mb-6">
          <div className="flex flex-wrap gap-2">
            {['todos', 'ativo', 'expirado', 'concluido', 'cancelado'].map(status => (
              <button
                key={status}
                onClick={() => setFiltroStatus(status)}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  filtroStatus === status
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'todos' ? 'Todos' : getStatusText(status)}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de pacotes */}
        {pacotes.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-8 border border-purple-100 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-gray-500">Nenhum pacote encontrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pacotes.map(pacote => {
              const progresso = (pacote.quantidade_usada / pacote.quantidade_total) * 100;
              const sessoesRestantes = pacote.quantidade_total - pacote.quantidade_usada;

              return (
                <div
                  key={pacote.id}
                  className="bg-white/60 backdrop-blur-xl rounded-2xl p-5 border border-purple-100 hover:shadow-lg transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Info principal */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-gray-800">{pacote.nome}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pacote.status)}`}>
                          {getStatusText(pacote.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {pacote.cliente?.nome || 'Cliente'}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {pacote.servico?.nome || 'Serviço'}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {format(new Date(pacote.data_venda), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        {pacote.data_validade && (
                          <span className="flex items-center gap-1 text-orange-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Validade: {format(new Date(pacote.data_validade), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progresso e valor */}
                    <div className="flex items-center gap-6">
                      <div className="text-center min-w-[120px]">
                        <p className="text-sm text-gray-500 mb-1">Sessões</p>
                        <p className="text-lg font-bold text-gray-800">
                          {pacote.quantidade_usada} / {pacote.quantidade_total}
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              progresso >= 100 ? 'bg-blue-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(progresso, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-center min-w-[100px]">
                        <p className="text-sm text-gray-500 mb-1">Valor</p>
                        <p className="text-lg font-bold text-purple-600">
                          R$ {pacote.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => abrirDetalhes(pacote)}
                          className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          title="Ver detalhes"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>

                        {pacote.status === 'ativo' && sessoesRestantes > 0 && (
                          <button
                            onClick={() => abrirUso(pacote)}
                            className="p-2 rounded-xl bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                            title="Registrar uso"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}

                        {pacote.status === 'ativo' && (
                          <button
                            onClick={() => abrirCancelamento(pacote)}
                            className="p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                            title="Cancelar pacote"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Novo Pacote */}
      {showNovoModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-5 rounded-t-3xl sticky top-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Vender Novo Pacote</h3>
                <button
                  onClick={() => setShowNovoModal(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Cliente */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cliente *</label>
                <ClienteAutocomplete
                  selectedCliente={selectedClienteNovo}
                  onSelect={(cliente) => setSelectedClienteNovo(cliente)}
                />
              </div>

              {/* Serviço */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Serviço *</label>
                <select
                  value={formNovo.servico_id}
                  onChange={(e) => setFormNovo(prev => ({ ...prev, servico_id: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="">Selecione um serviço</option>
                  {servicos.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nome} - R$ {s.valor.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Colaborador vendedor */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Vendedora *</label>
                <select
                  value={formNovo.colaborador_vendedor_id}
                  onChange={(e) => setFormNovo(prev => ({ ...prev, colaborador_vendedor_id: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="">Selecione a vendedora</option>
                  {colaboradores.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.porcentagem_comissao}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantidade e Desconto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Qtd. Sessões *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formNovo.quantidade_total}
                    onChange={(e) => setFormNovo(prev => ({ ...prev, quantidade_total: parseInt(e.target.value) || 1 }))}
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Desconto %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formNovo.desconto_percentual}
                    onChange={(e) => setFormNovo(prev => ({ ...prev, desconto_percentual: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              </div>

              {/* Valor total */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Valor Total *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formNovo.valor_total}
                  onChange={(e) => setFormNovo(prev => ({ ...prev, valor_total: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                {formNovo.valor_total > 0 && formNovo.quantidade_total > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    R$ {(formNovo.valor_total / formNovo.quantidade_total).toFixed(2)} por sessão
                  </p>
                )}
              </div>

              {/* Data de validade */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Data de Validade</label>
                <input
                  type="date"
                  value={formNovo.data_validade}
                  onChange={(e) => setFormNovo(prev => ({ ...prev, data_validade: e.target.value }))}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <p className="text-xs text-gray-500 mt-1">Deixe em branco para sem validade</p>
              </div>

              {/* Forma de pagamento */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Forma de Pagamento *</label>
                <select
                  value={formNovo.forma_pagamento}
                  onChange={(e) => setFormNovo(prev => ({ ...prev, forma_pagamento: e.target.value }))}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="">Selecione</option>
                  {formasPagamento.map(f => (
                    <option key={f.codigo} value={f.codigo}>{f.nome}</option>
                  ))}
                </select>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Observações</label>
                <textarea
                  value={formNovo.observacoes}
                  onChange={(e) => setFormNovo(prev => ({ ...prev, observacoes: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setShowNovoModal(false)} fullWidth>
                  Cancelar
                </Button>
                <Button onClick={handleCriarPacote} isLoading={salvando} fullWidth>
                  Vender Pacote
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Uso */}
      {showUsoModal && pacoteSelecionado && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-500 to-teal-500 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Registrar Uso de Sessão</h3>
                <button
                  onClick={() => setShowUsoModal(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Info do pacote */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-semibold text-gray-800">{pacoteSelecionado.nome}</p>
                <p className="text-sm text-gray-600">{pacoteSelecionado.cliente?.nome}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Sessões: {pacoteSelecionado.quantidade_usada} / {pacoteSelecionado.quantidade_total}
                </p>
              </div>

              {/* Colaborador executor */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quem realizou o serviço? *</label>
                <select
                  value={formUso.colaborador_executor_id}
                  onChange={(e) => setFormUso(prev => ({ ...prev, colaborador_executor_id: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">Selecione</option>
                  {colaboradores.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              {/* Data */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Data do uso *</label>
                <input
                  type="date"
                  value={formUso.data_uso}
                  onChange={(e) => setFormUso(prev => ({ ...prev, data_uso: e.target.value }))}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>

              {/* Horário */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Hora Início</label>
                  <input
                    type="time"
                    value={formUso.hora_inicio}
                    onChange={(e) => setFormUso(prev => ({ ...prev, hora_inicio: e.target.value }))}
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Hora Fim</label>
                  <input
                    type="time"
                    value={formUso.hora_fim}
                    onChange={(e) => setFormUso(prev => ({ ...prev, hora_fim: e.target.value }))}
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Observações</label>
                <textarea
                  value={formUso.observacoes}
                  onChange={(e) => setFormUso(prev => ({ ...prev, observacoes: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setShowUsoModal(false)} fullWidth>
                  Cancelar
                </Button>
                <Button variant="success" onClick={handleRegistrarUso} isLoading={salvando} fullWidth>
                  Registrar Sessão
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar Pacote */}
      {showCancelarModal && pacoteSelecionado && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Cancelar Pacote</h3>
                <button
                  onClick={() => setShowCancelarModal(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Info do pacote */}
              <div className="bg-red-50 rounded-xl p-4">
                <p className="font-semibold text-gray-800">{pacoteSelecionado.nome}</p>
                <p className="text-sm text-gray-600">{pacoteSelecionado.cliente?.nome}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Sessões usadas: {pacoteSelecionado.quantidade_usada} / {pacoteSelecionado.quantidade_total}
                </p>
                <p className="text-sm font-medium text-red-600 mt-2">
                  Reembolso máximo: R$ {((pacoteSelecionado.quantidade_total - pacoteSelecionado.quantidade_usada) * pacoteSelecionado.valor_por_sessao).toFixed(2)}
                </p>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Motivo do cancelamento *</label>
                <textarea
                  value={formCancelar.motivo_cancelamento}
                  onChange={(e) => setFormCancelar(prev => ({ ...prev, motivo_cancelamento: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  placeholder="Descreva o motivo do cancelamento..."
                />
              </div>

              {/* Valor do reembolso */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Valor do reembolso</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={(pacoteSelecionado.quantidade_total - pacoteSelecionado.quantidade_usada) * pacoteSelecionado.valor_por_sessao}
                  value={formCancelar.valor_reembolso}
                  onChange={(e) => setFormCancelar(prev => ({ ...prev, valor_reembolso: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <p className="text-xs text-gray-500 mt-1">Defina 0 para cancelar sem reembolso</p>
              </div>

              {/* Forma de reembolso */}
              {formCancelar.valor_reembolso > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Forma de reembolso</label>
                  <select
                    value={formCancelar.forma_reembolso}
                    onChange={(e) => setFormCancelar(prev => ({ ...prev, forma_reembolso: e.target.value }))}
                    className="w-full px-4 py-3 border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400"
                  >
                    <option value="">Mesma forma do pagamento</option>
                    {formasPagamento.map(f => (
                      <option key={f.codigo} value={f.codigo}>{f.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setShowCancelarModal(false)} fullWidth>
                  Voltar
                </Button>
                <Button variant="danger" onClick={handleCancelarPacote} isLoading={salvando} fullWidth>
                  Confirmar Cancelamento
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes do Pacote */}
      {showDetalhesModal && pacoteSelecionado && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-5 rounded-t-3xl sticky top-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Detalhes do Pacote</h3>
                <button
                  onClick={() => setShowDetalhesModal(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Info geral */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Cliente</p>
                  <p className="font-semibold">{pacoteSelecionado.cliente?.nome}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Serviço</p>
                  <p className="font-semibold">{pacoteSelecionado.servico?.nome}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Vendedora</p>
                  <p className="font-semibold">{pacoteSelecionado.colaborador_vendedor?.nome}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Data da Venda</p>
                  <p className="font-semibold">{format(new Date(pacoteSelecionado.data_venda), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Valor Total</p>
                  <p className="font-semibold text-purple-600">R$ {pacoteSelecionado.valor_total.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Valor por Sessão</p>
                  <p className="font-semibold">R$ {pacoteSelecionado.valor_por_sessao.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Sessões</p>
                  <p className="font-semibold">{pacoteSelecionado.quantidade_usada} / {pacoteSelecionado.quantidade_total}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pacoteSelecionado.status)}`}>
                    {getStatusText(pacoteSelecionado.status)}
                  </span>
                </div>
              </div>

              {/* Histórico de usos */}
              <div>
                <h4 className="font-bold text-gray-800 mb-4">Histórico de Usos</h4>
                {loadingUsos ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : usosPacote.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Nenhum uso registrado</p>
                ) : (
                  <div className="space-y-3">
                    {usosPacote.map((uso, index) => (
                      <div key={uso.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{format(new Date(uso.data_uso), "dd/MM/yyyy", { locale: ptBR })}</p>
                            <p className="text-sm text-gray-500">
                              {uso.colaborador_executor?.nome || 'Colaborador'}
                              {uso.hora_inicio && ` - ${uso.hora_inicio}`}
                              {uso.hora_fim && ` às ${uso.hora_fim}`}
                            </p>
                          </div>
                        </div>
                        {uso.observacoes && (
                          <p className="text-sm text-gray-500 max-w-xs truncate">{uso.observacoes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botão fechar */}
              <div className="mt-6">
                <Button variant="secondary" onClick={() => setShowDetalhesModal(false)} fullWidth>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
