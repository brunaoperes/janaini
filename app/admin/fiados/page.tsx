'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import Modal from '@/components/Modal';
import Button from '@/components/Button';

interface Fiado {
  id: number;
  colaborador_id: number;
  cliente_id: number;
  valor_total: number;
  data: string;
  servicos_nomes: string;
  status: string;
  observacoes?: string;
  cliente?: { id: number; nome: string; telefone: string };
  colaborador?: { id: number; nome: string; porcentagem_comissao: number };
  pagamento_fiado?: {
    id: number;
    valor_pago: number;
    forma_pagamento: string;
    data_pagamento: string;
    registrado_por_nome?: string;
    observacoes?: string;
  };
}

interface Colaborador {
  id: number;
  nome: string;
}

interface FormaPagamento {
  codigo: string;
  nome: string;
}

export default function FiadosPage() {
  const [fiados, setFiados] = useState<Fiado[]>([]);
  const [loading, setLoading] = useState(true);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [totais, setTotais] = useState({
    pendente: 0,
    pago: 0,
    quantidade_pendente: 0,
    quantidade_pago: 0,
  });

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<'pendente' | 'pago' | 'todos'>('pendente');
  const [filtroColaborador, setFiltroColaborador] = useState('');

  // Modal de pagamento
  const [showPagarModal, setShowPagarModal] = useState(false);
  const [selectedFiado, setSelectedFiado] = useState<Fiado | null>(null);
  const [pagamentoForm, setPagamentoForm] = useState({
    valorPago: '',
    formaPagamento: 'pix',
    dataPagamento: format(new Date(), 'yyyy-MM-dd'),
    observacoes: '',
  });
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  // Modal de detalhes
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [detalheFiado, setDetalheFiado] = useState<Fiado | null>(null);

  useEffect(() => {
    loadFiados();
  }, [filtroStatus, filtroColaborador]);

  const loadFiados = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: filtroStatus,
      });
      if (filtroColaborador) {
        params.append('colaboradorId', filtroColaborador);
      }

      const response = await fetch(`/api/fiados?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar fiados');
      }

      setFiados(data.fiados || []);
      setTotais(data.totais || { pendente: 0, pago: 0, quantidade_pendente: 0, quantidade_pago: 0 });
      setColaboradores(data.colaboradores || []);
      setFormasPagamento(data.formasPagamento || []);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar fiados');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalPagar = (fiado: Fiado) => {
    setSelectedFiado(fiado);
    setPagamentoForm({
      valorPago: fiado.valor_total.toFixed(2),
      formaPagamento: 'pix',
      dataPagamento: format(new Date(), 'yyyy-MM-dd'),
      observacoes: '',
    });
    setShowPagarModal(true);
  };

  const handlePagarFiado = async () => {
    if (!selectedFiado) return;

    setSalvandoPagamento(true);
    try {
      const response = await fetch('/api/fiados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lancamentoId: selectedFiado.id,
          valorPago: parseFloat(pagamentoForm.valorPago),
          formaPagamento: pagamentoForm.formaPagamento,
          dataPagamento: pagamentoForm.dataPagamento,
          observacoes: pagamentoForm.observacoes || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao registrar pagamento');
      }

      toast.success('Fiado marcado como pago!');
      setShowPagarModal(false);
      setSelectedFiado(null);
      loadFiados();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar pagamento');
    } finally {
      setSalvandoPagamento(false);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const getNomeFormaPagamento = (codigo: string) => {
    const forma = formasPagamento.find(f => f.codigo === codigo);
    return forma?.nome || codigo;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FCEBFB] via-[#EAD5FF] to-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-purple-100 shadow-soft">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
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
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Controle de Fiados
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-6">
        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-4 border-l-4 border-orange-500">
            <p className="text-sm text-gray-500">Fiados Pendentes</p>
            <p className="text-2xl font-bold text-orange-600">{totais.quantidade_pendente}</p>
            <p className="text-sm text-gray-600">{formatarMoeda(totais.pendente)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-500">Fiados Pagos</p>
            <p className="text-2xl font-bold text-green-600">{totais.quantidade_pago}</p>
            <p className="text-sm text-gray-600">{formatarMoeda(totais.pago)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-4 border-l-4 border-red-500 col-span-2 md:col-span-2">
            <p className="text-sm text-gray-500">Total em Aberto</p>
            <p className="text-3xl font-bold text-red-600">{formatarMoeda(totais.pendente)}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="pendente">Pendentes</option>
                <option value="pago">Pagos</option>
                <option value="todos">Todos</option>
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
              <select
                value={filtroColaborador}
                onChange={(e) => setFiltroColaborador(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Todos</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Lista de Fiados */}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {fiados.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500">Nenhum fiado encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Colaborador</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Serviço</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Valor</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fiados.map((fiado) => (
                      <tr key={fiado.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {format(parseISO(fiado.data), "dd/MM/yyyy", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{fiado.cliente?.nome || '-'}</div>
                          <div className="text-xs text-gray-500">{fiado.cliente?.telefone || ''}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {fiado.colaborador?.nome || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {fiado.servicos_nomes || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          {formatarMoeda(fiado.valor_total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {fiado.status === 'pendente' ? (
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                              Pendente
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              Pago
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {fiado.status === 'pendente' ? (
                              <button
                                onClick={() => abrirModalPagar(fiado)}
                                className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                              >
                                Marcar Pago
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setDetalheFiado(fiado);
                                  setShowDetalhes(true);
                                }}
                                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                              >
                                Ver Detalhes
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Pagamento */}
      <Modal
        isOpen={showPagarModal}
        onClose={() => {
          setShowPagarModal(false);
          setSelectedFiado(null);
        }}
        title="Marcar Fiado como Pago"
        size="md"
      >
        {selectedFiado && (
          <div className="space-y-4">
            {/* Info do Fiado */}
            <div className="bg-orange-50 p-4 rounded-xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-orange-600">Cliente</label>
                  <p className="text-gray-800 font-medium">{selectedFiado.cliente?.nome}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-orange-600">Valor Original</label>
                  <p className="text-gray-800 font-medium">{formatarMoeda(selectedFiado.valor_total)}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-orange-600">Serviço</label>
                  <p className="text-gray-800">{selectedFiado.servicos_nomes}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-orange-600">Data do Serviço</label>
                  <p className="text-gray-800">{format(parseISO(selectedFiado.data), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
              </div>
            </div>

            {/* Formulário de Pagamento */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Pago *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={pagamentoForm.valorPago}
                    onChange={(e) => setPagamentoForm(prev => ({ ...prev, valorPago: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de Pagamento *
                </label>
                <select
                  value={pagamentoForm.formaPagamento}
                  onChange={(e) => setPagamentoForm(prev => ({ ...prev, formaPagamento: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  {formasPagamento.map(fp => (
                    <option key={fp.codigo} value={fp.codigo}>{fp.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data do Pagamento *
                </label>
                <input
                  type="date"
                  value={pagamentoForm.dataPagamento}
                  onChange={(e) => setPagamentoForm(prev => ({ ...prev, dataPagamento: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  O valor entrará no faturamento desta data
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={pagamentoForm.observacoes}
                  onChange={(e) => setPagamentoForm(prev => ({ ...prev, observacoes: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Anotações sobre o pagamento..."
                />
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowPagarModal(false);
                  setSelectedFiado(null);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handlePagarFiado}
                disabled={salvandoPagamento || !pagamentoForm.valorPago || !pagamentoForm.dataPagamento}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {salvandoPagamento ? 'Salvando...' : 'Confirmar Pagamento'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Detalhes */}
      <Modal
        isOpen={showDetalhes}
        onClose={() => {
          setShowDetalhes(false);
          setDetalheFiado(null);
        }}
        title="Detalhes do Pagamento"
        size="md"
      >
        {detalheFiado && detalheFiado.pagamento_fiado && (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-green-600">Cliente</label>
                  <p className="text-gray-800 font-medium">{detalheFiado.cliente?.nome}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-green-600">Serviço</label>
                  <p className="text-gray-800">{detalheFiado.servicos_nomes}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-green-600">Data do Serviço</label>
                  <p className="text-gray-800">{format(parseISO(detalheFiado.data), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-green-600">Valor Original</label>
                  <p className="text-gray-800">{formatarMoeda(detalheFiado.valor_total)}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Dados do Pagamento</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500">Valor Pago</label>
                  <p className="text-gray-800 font-bold text-lg">{formatarMoeda(detalheFiado.pagamento_fiado.valor_pago)}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Forma de Pagamento</label>
                  <p className="text-gray-800">{getNomeFormaPagamento(detalheFiado.pagamento_fiado.forma_pagamento)}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Data do Pagamento</label>
                  <p className="text-gray-800">{format(parseISO(detalheFiado.pagamento_fiado.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Registrado Por</label>
                  <p className="text-gray-800">{detalheFiado.pagamento_fiado.registrado_por_nome || '-'}</p>
                </div>
              </div>
              {detalheFiado.pagamento_fiado.observacoes && (
                <div className="mt-3">
                  <label className="text-xs font-semibold text-gray-500">Observações</label>
                  <p className="text-gray-800 text-sm">{detalheFiado.pagamento_fiado.observacoes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDetalhes(false);
                  setDetalheFiado(null);
                }}
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
