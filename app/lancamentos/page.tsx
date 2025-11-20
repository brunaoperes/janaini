'use client';

import { useEffect, useState } from 'react';
import { supabase, Servico } from '@/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { lancamentoSchema, formatZodErrors } from '@/lib/validations';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { TableSkeleton } from '@/components/SkeletonLoader';
import FiltrosAvancados, { FiltrosLancamentos } from '@/components/FiltrosAvancados';
import { exportarLancamentosParaExcel, exportarLancamentosParaPDF, LancamentoExport } from '@/lib/export-utils';

interface LancamentoComRelacoes {
  id: number;
  colaborador_id: number;
  cliente_id: number | null;
  valor_total: number;
  forma_pagamento: string;
  comissao_colaborador: number;
  comissao_salao: number;
  data: string;
  colaboradores?: { nome: string; porcentagem_comissao: number } | null;
  clientes?: { nome: string } | null;
}

interface Lancamento {
  id: number;
  colaborador_id: number;
  cliente_id: number | null;
  valor_total: number;
  forma_pagamento: string;
  comissao_colaborador: number;
  comissao_salao: number;
  data: string;
}

interface Colaborador {
  id: number;
  nome: string;
  porcentagem_comissao: number;
}

interface Cliente {
  id: number;
  nome: string;
  telefone: string;
}

// Serviços carregados dinamicamente do banco de dados

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { value: 'credito', label: 'Crédito', icon: '💳' },
  { value: 'debito', label: 'Débito', icon: '💳' },
  { value: 'pix', label: 'PIX', icon: '📱' },
];

export default function LancamentosPage() {
  const [lancamentos, setLancamentos] = useState<LancamentoComRelacoes[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'todos' | 'hoje' | 'semana'>('hoje');
  const [editingLancamento, setEditingLancamento] = useState<Lancamento | null>(null);
  const [formErrors, setFormErrors] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({
    isOpen: false,
    id: null,
  });

  // Filtros avançados
  const [filtrosAvancados, setFiltrosAvancados] = useState<FiltrosLancamentos>({
    dataInicio: '',
    dataFim: '',
    colaboradorId: '',
    clienteId: '',
    formaPagamento: '',
    buscaCliente: '',
  });

  // Estado do formulário
  const [formData, setFormData] = useState({
    colaborador_id: '',
    cliente_id: '',
    valor_total: '',
    forma_pagamento: 'dinheiro',
    servico_preset: '',
  });

  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, filtrosAvancados]);

  useEffect(() => {
    loadData();
  }, [selectedFilter, currentPage, filtrosAvancados]);

  async function loadData() {
    setLoading(true);

    // Carregar colaboradores
    const { data: colabData } = await supabase
      .from('colaboradores')
      .select('*')
      .order('nome');

    if (colabData) setColaboradores(colabData);

    // Carregar clientes
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('*')
      .order('nome');

    if (clienteData) setClientes(clienteData);

    // Carregar serviços ativos
    const { data: servicoData } = await supabase
      .from('servicos')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (servicoData) setServicos(servicoData);

    // Carregar lançamentos com filtro e paginação (incluindo relações)
    const hoje = new Date();
    let baseQuery = supabase
      .from('lancamentos')
      .select(`
        *,
        colaboradores(nome, porcentagem_comissao),
        clientes(nome)
      `, { count: 'exact' });

    // Aplicar filtro rápido (hoje/semana/todos)
    if (selectedFilter === 'hoje') {
      const inicioDia = new Date(hoje.setHours(0, 0, 0, 0));
      baseQuery = baseQuery.gte('data', inicioDia.toISOString());
    } else if (selectedFilter === 'semana') {
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() - 7);
      baseQuery = baseQuery.gte('data', inicioSemana.toISOString());
    }

    // Aplicar filtros avançados
    if (filtrosAvancados.dataInicio) {
      baseQuery = baseQuery.gte('data', new Date(filtrosAvancados.dataInicio).toISOString());
    }
    if (filtrosAvancados.dataFim) {
      const dataFim = new Date(filtrosAvancados.dataFim);
      dataFim.setHours(23, 59, 59, 999);
      baseQuery = baseQuery.lte('data', dataFim.toISOString());
    }
    if (filtrosAvancados.colaboradorId) {
      baseQuery = baseQuery.eq('colaborador_id', Number(filtrosAvancados.colaboradorId));
    }
    if (filtrosAvancados.clienteId) {
      baseQuery = baseQuery.eq('cliente_id', Number(filtrosAvancados.clienteId));
    }
    if (filtrosAvancados.formaPagamento) {
      baseQuery = baseQuery.eq('forma_pagamento', filtrosAvancados.formaPagamento);
    }

    // Buscar total de registros e dados paginados
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    const { data: lancData, count } = await baseQuery
      .order('data', { ascending: false })
      .range(from, to);

    // Aplicar filtro de busca por nome de cliente (client-side para evitar complexidade de full-text search)
    let lancamentosFiltrados = lancData || [];
    if (filtrosAvancados.buscaCliente && lancData) {
      const buscaLower = filtrosAvancados.buscaCliente.toLowerCase();
      lancamentosFiltrados = lancData.filter((lanc: any) =>
        lanc.clientes?.nome?.toLowerCase().includes(buscaLower)
      );
    }

    setLancamentos(lancamentosFiltrados);
    if (count !== null) setTotalCount(count);

    setLoading(false);
  }

  function handleServicoPresetChange(servicoNome: string) {
    const servico = servicos.find((s) => s.nome === servicoNome);
    if (servico) {
      setFormData((prev) => ({
        ...prev,
        servico_preset: servicoNome,
        valor_total: servico.valor.toString(),
      }));
    }
  }

  function handleColaboradorChange(colaboradorId: string) {
    const colab = colaboradores.find((c) => c.id === Number(colaboradorId));
    setSelectedColaborador(colab || null);
    setFormData((prev) => ({
      ...prev,
      colaborador_id: colaboradorId,
    }));
  }

  function calcularComissoes() {
    if (!selectedColaborador || !formData.valor_total) {
      return { comissaoColaborador: 0, comissaoSalao: 0 };
    }

    const valorTotal = parseFloat(formData.valor_total);
    const comissaoColaborador = (valorTotal * selectedColaborador.porcentagem_comissao) / 100;
    const comissaoSalao = valorTotal - comissaoColaborador;

    return { comissaoColaborador, comissaoSalao };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErrors('');
    setIsSubmitting(true);

    try {
      // Validação com Zod
      const validationData = {
        colaborador_id: formData.colaborador_id ? Number(formData.colaborador_id) : undefined,
        cliente_id: formData.cliente_id ? Number(formData.cliente_id) : undefined,
        valor_total: formData.valor_total ? parseFloat(formData.valor_total) : undefined,
        forma_pagamento: formData.forma_pagamento,
      };

      const validation = lancamentoSchema.safeParse(validationData);

      if (!validation.success) {
        setFormErrors(formatZodErrors(validation.error));
        setIsSubmitting(false);
        return;
      }

      const { comissaoColaborador, comissaoSalao } = calcularComissoes();

      const lancamentoData = {
        colaborador_id: validation.data.colaborador_id,
        cliente_id: validation.data.cliente_id || null,
        valor_total: validation.data.valor_total,
        forma_pagamento: validation.data.forma_pagamento,
        comissao_colaborador: comissaoColaborador,
        comissao_salao: comissaoSalao,
      };

      let error;

      if (editingLancamento) {
        // Atualizar lançamento existente
        const result = await supabase
          .from('lancamentos')
          .update(lancamentoData)
          .eq('id', editingLancamento.id);
        error = result.error;
      } else {
        // Criar novo lançamento
        const result = await supabase
          .from('lancamentos')
          .insert([{ ...lancamentoData, data: new Date().toISOString() }]);
        error = result.error;
      }

      if (error) {
        console.error('Erro ao salvar lançamento:', error);
        toast.error('Erro ao salvar lançamento!');
      } else {
        toast.success(editingLancamento ? 'Lançamento atualizado com sucesso!' : 'Lançamento criado com sucesso!');
        setShowModal(false);
        setEditingLancamento(null);
        setFormData({
          colaborador_id: '',
          cliente_id: '',
          valor_total: '',
          forma_pagamento: 'dinheiro',
          servico_preset: '',
        });
        setSelectedColaborador(null);
        loadData();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(lancamento: Lancamento) {
    setEditingLancamento(lancamento);
    setFormData({
      colaborador_id: lancamento.colaborador_id.toString(),
      cliente_id: lancamento.cliente_id?.toString() || '',
      valor_total: lancamento.valor_total.toString(),
      forma_pagamento: lancamento.forma_pagamento,
      servico_preset: '',
    });
    const colab = colaboradores.find(c => c.id === lancamento.colaborador_id);
    setSelectedColaborador(colab || null);
    setFormErrors('');
    setShowModal(true);
  }

  function openDeleteConfirm(id: number) {
    setDeleteConfirm({ isOpen: true, id });
  }

  async function confirmDelete() {
    if (!deleteConfirm.id) return;

    const { error } = await supabase
      .from('lancamentos')
      .delete()
      .eq('id', deleteConfirm.id);

    if (error) {
      console.error('Erro ao excluir lançamento:', error);
      toast.error('Erro ao excluir lançamento!');
    } else {
      toast.success('Lançamento excluído com sucesso!');
      loadData();
    }

    setDeleteConfirm({ isOpen: false, id: null });
  }

  // Funções de exportação
  function prepararDadosParaExportacao(): LancamentoExport[] {
    return lancamentos.map((lanc) => ({
      data: format(new Date(lanc.data), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      colaboradora: lanc.colaboradores?.nome || 'Desconhecida',
      cliente: lanc.clientes?.nome || 'Sem cliente',
      valor_total: lanc.valor_total,
      forma_pagamento: lanc.forma_pagamento,
      comissao_colaborador: lanc.comissao_colaborador,
      comissao_salao: lanc.comissao_salao,
    }));
  }

  function handleExportarExcel() {
    const dados = prepararDadosParaExportacao();
    const nomeArquivo = `lancamentos_${format(new Date(), 'yyyy-MM-dd_HH-mm')}`;
    exportarLancamentosParaExcel(dados, nomeArquivo);
    toast.success('Arquivo Excel baixado com sucesso!');
  }

  function handleExportarPDF() {
    const dados = prepararDadosParaExportacao();
    const nomeArquivo = `lancamentos_${format(new Date(), 'yyyy-MM-dd_HH-mm')}`;
    exportarLancamentosParaPDF(dados, nomeArquivo);
    toast.success('Arquivo PDF baixado com sucesso!');
  }

  const { comissaoColaborador, comissaoSalao } = calcularComissoes();

  const totalDia = lancamentos.reduce((acc, l) => acc + l.valor_total, 0);
  const totalComissoes = lancamentos.reduce((acc, l) => acc + l.comissao_colaborador, 0);
  const totalSalao = lancamentos.reduce((acc, l) => acc + l.comissao_salao, 0);

  const getColaboradorNome = (lanc: LancamentoComRelacoes) => {
    return lanc.colaboradores?.nome || 'Desconhecido';
  };

  const getClienteNome = (lanc: LancamentoComRelacoes) => {
    if (!lanc.cliente_id) return 'Cliente avulso';
    return lanc.clientes?.nome || 'Desconhecido';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header com navegação */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-purple-100 shadow-soft">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="flex items-center gap-2 text-purple-600 hover:text-purple-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Voltar</span>
              </Link>
              <div className="h-6 w-px bg-purple-200" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  💰 Naví Belle - Lançamentos
                </h1>
                <p className="text-sm text-gray-600">Registre atendimentos e gerencie pagamentos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Ações rápidas */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
            {/* Botões de exportação */}
            <div className="flex gap-3">
              <button
                onClick={handleExportarExcel}
                disabled={lancamentos.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-xl font-medium shadow-md hover:shadow-lg hover:bg-green-700 transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
              >
                <span className="text-xl">📊</span>
                Exportar Excel
              </button>
              <button
                onClick={handleExportarPDF}
                disabled={lancamentos.length === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-xl font-medium shadow-md hover:shadow-lg hover:bg-red-700 transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
              >
                <span className="text-xl">📄</span>
                Exportar PDF
              </button>
            </div>

            {/* Botão novo lançamento */}
            <div>
              <button
                onClick={() => {
                  setShowModal(true);
                  setFormErrors('');
                }}
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                ✨ Novo Lançamento
              </button>
            </div>
          </div>

          {/* Estatísticas rápidas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-pink-200 shadow-lg">
              <p className="text-sm text-gray-600 mb-1">Total {selectedFilter === 'hoje' ? 'Hoje' : selectedFilter === 'semana' ? 'na Semana' : ''}</p>
              <p className="text-3xl font-bold text-pink-600">R$ {totalDia.toFixed(2)}</p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-purple-200 shadow-lg">
              <p className="text-sm text-gray-600 mb-1">Comissões</p>
              <p className="text-3xl font-bold text-purple-600">R$ {totalComissoes.toFixed(2)}</p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-blue-200 shadow-lg">
              <p className="text-sm text-gray-600 mb-1">Salão</p>
              <p className="text-3xl font-bold text-blue-600">R$ {totalSalao.toFixed(2)}</p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-green-200 shadow-lg">
              <p className="text-sm text-gray-600 mb-1">Atendimentos</p>
              <p className="text-3xl font-bold text-green-600">{lancamentos.length}</p>
            </div>
          </div>

          {/* Filtros rápidos */}
          <div className="flex gap-3 mb-6">
            {[
              { value: 'hoje', label: 'Hoje' },
              { value: 'semana', label: 'Última Semana' },
              { value: 'todos', label: 'Todos' },
            ].map((filtro) => (
              <button
                key={filtro.value}
                onClick={() => setSelectedFilter(filtro.value as any)}
                className={`px-6 py-2 rounded-xl font-medium transition-all duration-200 ${
                  selectedFilter === filtro.value
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                    : 'bg-white/70 text-gray-700 hover:bg-white'
                }`}
              >
                {filtro.label}
              </button>
            ))}
          </div>

          {/* Filtros Avançados */}
          <FiltrosAvancados
            filtros={filtrosAvancados}
            onFiltrosChange={setFiltrosAvancados}
            colaboradores={colaboradores}
            clientes={clientes}
            formasPagamento={FORMAS_PAGAMENTO}
          />
        </div>

        {/* Lista de lançamentos */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
          {/* Versão Desktop - Tabela */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Data/Hora</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Colaboradora</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Cliente</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Valor</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Pagamento</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Comissão</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Salão</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : lancamentos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Nenhum lançamento encontrado
                    </td>
                  </tr>
                ) : (
                  lancamentos.map((lanc) => (
                    <tr key={lanc.id} className="border-b border-gray-100 hover:bg-pink-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm">
                        {format(new Date(lanc.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-pink-100 to-purple-100 text-sm font-medium text-purple-700">
                          {getColaboradorNome(lanc)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{getClienteNome(lanc)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-green-600">R$ {lanc.valor_total.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                          {FORMAS_PAGAMENTO.find((f) => f.value === lanc.forma_pagamento)?.icon}{' '}
                          {lanc.forma_pagamento.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-purple-600 font-medium">
                        R$ {lanc.comissao_colaborador.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-blue-600 font-medium">R$ {lanc.comissao_salao.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(lanc)}
                            className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors text-xs"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(lanc.id)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors text-xs"
                          >
                            🗑️ Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Versão Mobile - Cards */}
          <div className="md:hidden">
            {loading ? (
              <div className="px-6 py-12 text-center text-gray-500">
                Carregando...
              </div>
            ) : lancamentos.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                Nenhum lançamento encontrado
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {lancamentos.map((lanc) => (
                  <div key={lanc.id} className="p-4 hover:bg-pink-50/30 transition-colors">
                    {/* Header do Card */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 mb-1">
                          {format(new Date(lanc.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                        <div className="inline-flex items-center px-2 py-1 rounded-full bg-gradient-to-r from-pink-100 to-purple-100 text-xs font-medium text-purple-700">
                          {getColaboradorNome(lanc)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          R$ {lanc.valor_total.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Informações */}
                    <div className="space-y-2 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cliente:</span>
                        <span className="font-medium text-gray-800">{getClienteNome(lanc)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pagamento:</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                          {FORMAS_PAGAMENTO.find((f) => f.value === lanc.forma_pagamento)?.icon}{' '}
                          {lanc.forma_pagamento.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Comissão:</span>
                        <span className="text-purple-600 font-medium">
                          R$ {lanc.comissao_colaborador.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Salão:</span>
                        <span className="text-blue-600 font-medium">
                          R$ {lanc.comissao_salao.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleEdit(lanc)}
                        className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors text-xs"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(lanc.id)}
                        className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors text-xs"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Paginação */}
          {totalCount > itemsPerPage && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Mostrando <span className="font-semibold">{((currentPage - 1) * itemsPerPage) + 1}</span> a{' '}
                  <span className="font-semibold">{Math.min(currentPage * itemsPerPage, totalCount)}</span> de{' '}
                  <span className="font-semibold">{totalCount}</span> lançamentos
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Anterior
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.ceil(totalCount / itemsPerPage) }, (_, i) => i + 1)
                      .filter(page => {
                        const totalPages = Math.ceil(totalCount / itemsPerPage);
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 1) return true;
                        return false;
                      })
                      .map((page, index, array) => (
                        <div key={page} className="flex gap-1">
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-3 py-2 text-gray-500">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              currentPage === page
                                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        </div>
                      ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Próximo →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal de novo lançamento */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-modal-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-pink-500 via-purple-600 to-blue-600 p-6 rounded-t-3xl">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">
                    {editingLancamento ? '✏️ Editar Lançamento' : '✨ Novo Lançamento'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingLancamento(null);
                    }}
                    className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Erros de validação */}
                {formErrors && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">⚠️</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-red-800 mb-1">Erro de validação</h4>
                        <p className="text-sm text-red-700 whitespace-pre-line">{formErrors}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Serviço Preset */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">🎨 Serviço Rápido</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {servicos.map((servico) => (
                      <button
                        key={servico.id}
                        type="button"
                        onClick={() => handleServicoPresetChange(servico.nome)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          formData.servico_preset === servico.nome
                            ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {servico.nome}
                        <span className="block text-xs mt-1">R$ {servico.valor.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Colaboradora */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    👩‍💼 Colaboradora *
                  </label>
                  <select
                    value={formData.colaborador_id}
                    onChange={(e) => handleColaboradorChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors"
                    required
                  >
                    <option value="">Selecione uma colaboradora</option>
                    {colaboradores.map((colab) => (
                      <option key={colab.id} value={colab.id}>
                        {colab.nome} ({colab.porcentagem_comissao}% comissão)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cliente */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">👤 Cliente (opcional)</label>
                  <select
                    value={formData.cliente_id}
                    onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors"
                  >
                    <option value="">Cliente avulso</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome} - {cliente.telefone}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Valor */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">💰 Valor Total *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_total}
                    onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors text-lg font-bold"
                    placeholder="0.00"
                    required
                  />
                </div>

                {/* Forma de pagamento */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">💳 Forma de Pagamento</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {FORMAS_PAGAMENTO.map((forma) => (
                      <button
                        key={forma.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, forma_pagamento: forma.value })}
                        className={`px-4 py-3 rounded-xl font-medium transition-all ${
                          formData.forma_pagamento === forma.value
                            ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span className="text-2xl block mb-1">{forma.icon}</span>
                        <span className="text-xs">{forma.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview de comissões */}
                {selectedColaborador && formData.valor_total && (
                  <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-blue-50 rounded-2xl p-6 border-2 border-purple-200">
                    <h3 className="font-semibold text-gray-800 mb-4">📊 Divisão de Valores</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Valor Total:</span>
                        <span className="text-xl font-bold text-green-600">R$ {parseFloat(formData.valor_total).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">
                          Comissão {selectedColaborador.nome} ({selectedColaborador.porcentagem_comissao}%):
                        </span>
                        <span className="text-xl font-bold text-purple-600">R$ {comissaoColaborador.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Comissão Salão:</span>
                        <span className="text-xl font-bold text-blue-600">R$ {comissaoSalao.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botões */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Salvando...
                      </span>
                    ) : (
                      <>{editingLancamento ? 'Atualizar' : '✨ Criar Lançamento'}</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dialog de Confirmação de Exclusão */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
          onConfirm={confirmDelete}
          title="Excluir Lançamento"
          message="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
          confirmText="Excluir"
          cancelText="Cancelar"
          type="danger"
        />
      </div>
    </div>
  );
}
