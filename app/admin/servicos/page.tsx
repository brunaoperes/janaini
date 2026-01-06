'use client';

import { useState, useEffect } from 'react';
import { supabase, Servico } from '@/lib/supabase';
import Link from 'next/link';
import { servicoSchema, formatZodErrors } from '@/lib/validations';
import toast from 'react-hot-toast';

export default function ServicosAdminPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [formErrors, setFormErrors] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    duracao_minutos: 60,
    valor: 0,
    descricao: '',
    ativo: true,
  });

  useEffect(() => {
    loadServicos();
  }, []);

  async function loadServicos() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin?tabela=servicos');
      const result = await response.json();
      setServicos(result.data || []);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      toast.error('Erro ao carregar serviços');
    }
    setLoading(false);
  }

  function abrirModalNovo() {
    setEditingServico(null);
    setFormData({
      nome: '',
      duracao_minutos: 60,
      valor: 0,
      descricao: '',
      ativo: true,
    });
    setFormErrors('');
    setShowModal(true);
  }

  function abrirModalEditar(servico: Servico) {
    setEditingServico(servico);
    setFormData({
      nome: servico.nome,
      duracao_minutos: servico.duracao_minutos,
      valor: servico.valor,
      descricao: servico.descricao || '',
      ativo: servico.ativo,
    });
    setFormErrors('');
    setShowModal(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setFormErrors('');
    setIsSubmitting(true);

    try {
      // Validação com Zod
      const validation = servicoSchema.safeParse(formData);

      if (!validation.success) {
        setFormErrors(formatZodErrors(validation.error));
        return;
      }

      const servicoData = {
        nome: validation.data.nome,
        duracao_minutos: validation.data.duracao_minutos,
        valor: validation.data.valor,
        descricao: validation.data.descricao || '',
        ativo: validation.data.ativo,
      };

      if (editingServico) {
        // Atualizar
        const response = await fetch('/api/admin', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabela: 'servicos', id: editingServico.id, dados: servicoData }),
        });

        if (!response.ok) {
          console.error('Erro ao atualizar serviço');
          toast.error('Erro ao atualizar serviço');
        } else {
          toast.success('Serviço atualizado com sucesso!');
          setShowModal(false);
          loadServicos();
        }
      } else {
        // Criar novo
        const response = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabela: 'servicos', dados: servicoData }),
        });

        if (!response.ok) {
          console.error('Erro ao criar serviço');
          toast.error('Erro ao criar serviço');
        } else {
          toast.success('Serviço criado com sucesso!');
          setShowModal(false);
          loadServicos();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExcluir(servico: Servico) {
    if (!confirm(`⚠️ Tem certeza que deseja excluir o serviço "${servico.nome}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin?tabela=servicos&id=${servico.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        console.error('Erro ao excluir serviço');
        toast.error('Erro ao excluir serviço');
      } else {
        toast.success('Serviço excluído com sucesso!');
        loadServicos();
      }
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      toast.error('Erro ao excluir serviço');
    }
  }

  async function toggleAtivo(servico: Servico) {
    try {
      const response = await fetch('/api/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabela: 'servicos', id: servico.id, dados: { ativo: !servico.ativo } }),
      });

      if (!response.ok) {
        console.error('Erro ao atualizar status');
        toast.error('Erro ao atualizar status');
      } else {
        toast.success(`Serviço ${!servico.ativo ? 'ativado' : 'desativado'} com sucesso!`);
        loadServicos();
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-purple-100">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/agenda"
                className="text-purple-600 hover:text-purple-700 transition-colors"
              >
                ← Voltar
              </Link>
              <h1 className="text-2xl font-bold text-gray-800">💅 Gerenciar Serviços</h1>
            </div>
            <button
              onClick={abrirModalNovo}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              + Novo Serviço
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Serviços */}
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicos.map((servico) => (
            <div
              key={servico.id}
              className={`bg-white rounded-2xl shadow-lg border-2 p-6 transition-all transform hover:scale-105 ${
                servico.ativo
                  ? 'border-purple-200 hover:border-purple-400'
                  : 'border-gray-200 opacity-60'
              }`}
            >
              {/* Header do Card */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800">{servico.nome}</h3>
                  <p className="text-sm text-purple-600 font-semibold mt-1">
                    {servico.duracao_minutos} minutos
                  </p>
                </div>
                <button
                  onClick={() => toggleAtivo(servico)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    servico.ativo
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {servico.ativo ? 'Ativo' : 'Inativo'}
                </button>
              </div>

              {/* Descrição */}
              {servico.descricao && (
                <p className="text-sm text-gray-600 mb-4">{servico.descricao}</p>
              )}

              {/* Ações */}
              <div className="flex gap-2">
                <button
                  onClick={() => abrirModalEditar(servico)}
                  className="flex-1 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg font-semibold hover:bg-purple-100 transition-colors"
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => handleExcluir(servico)}
                  className="flex-1 px-4 py-2 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-colors"
                >
                  🗑️ Excluir
                </button>
              </div>
            </div>
          ))}
        </div>

        {servicos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Nenhum serviço cadastrado ainda.</p>
            <button
              onClick={abrirModalNovo}
              className="mt-4 px-6 py-3 bg-purple-500 text-white rounded-xl font-semibold hover:bg-purple-600 transition-colors"
            >
              Criar Primeiro Serviço
            </button>
          </div>
        )}
      </div>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full animate-modal-in"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {editingServico ? '✏️ Editar Serviço' : '✨ Novo Serviço'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSalvar} className="p-6 space-y-5">
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

              {/* Nome */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome do Serviço *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="Ex: Corte de Cabelo"
                  required
                />
              </div>

              {/* Duração */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Duração (minutos) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.duracao_minutos}
                  onChange={(e) => setFormData({ ...formData, duracao_minutos: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* Valor */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  💰 Valor (R$) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="Ex: 80.00"
                  required
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descrição (opcional)
                </label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors resize-none"
                  rows={3}
                  placeholder="Descrição do serviço..."
                />
              </div>

              {/* Ativo */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="ativo" className="text-sm font-semibold text-gray-700">
                  Serviço ativo (disponível para seleção)
                </label>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
                    <>{editingServico ? 'Atualizar' : 'Criar'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
