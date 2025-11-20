'use client';

import { useState, useEffect } from 'react';
export const dynamic = 'force-dynamic';
import { supabase, Colaborador } from '@/lib/supabase';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { colaboradorSchema, formatZodErrors } from '@/lib/validations';
import toast from 'react-hot-toast';

const COLORS = [
  { gradient: 'from-pink-400 to-pink-600', bg: 'bg-pink-50', border: 'border-pink-300' },
  { gradient: 'from-purple-400 to-purple-600', bg: 'bg-purple-50', border: 'border-purple-300' },
  { gradient: 'from-blue-400 to-blue-600', bg: 'bg-blue-50', border: 'border-blue-300' },
  { gradient: 'from-violet-400 to-violet-600', bg: 'bg-violet-50', border: 'border-violet-300' },
  { gradient: 'from-fuchsia-400 to-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-300' },
  { gradient: 'from-rose-400 to-rose-600', bg: 'bg-rose-50', border: 'border-rose-300' },
];

export default function ColaboradoresAdminPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(null);
  const [formErrors, setFormErrors] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    porcentagem_comissao: '50',
  });

  useEffect(() => {
    loadColaboradores();
  }, []);

  const loadColaboradores = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('colaboradores')
      .select('*')
      .order('nome');

    if (data && !error) {
      setColaboradores(data);
      await loadStats(data);
    }
    setLoading(false);
  };

  const loadStats = async (colaboradores: Colaborador[]) => {
    const hoje = new Date();
    const inicioMes = startOfMonth(hoje);
    const fimMes = endOfMonth(hoje);

    // Carregar lançamentos do mês
    const { data: lancamentos } = await supabase
      .from('lancamentos')
      .select('*')
      .gte('data', inicioMes.toISOString())
      .lte('data', fimMes.toISOString());

    // Calcular stats por colaboradora
    const statsMap: any = {};

    colaboradores.forEach((colab) => {
      const lancamentosColab = lancamentos?.filter((l) => l.colaborador_id === colab.id) || [];
      const totalFaturado = lancamentosColab.reduce((sum, l) => sum + l.valor_total, 0);
      const totalComissao = lancamentosColab.reduce((sum, l) => sum + l.comissao_colaborador, 0);
      const atendimentos = lancamentosColab.length;

      statsMap[colab.id] = {
        atendimentos,
        faturamento: totalFaturado,
        comissao: totalComissao,
      };
    });

    setStats(statsMap);
  };

  const handleSubmit = async () => {
    setFormErrors('');
    setIsSubmitting(true);

    try {
      // Validação com Zod
      const validationData = {
        nome: formData.nome,
        porcentagem_comissao: parseFloat(formData.porcentagem_comissao),
      };

      const validation = colaboradorSchema.safeParse(validationData);

      if (!validation.success) {
        setFormErrors(formatZodErrors(validation.error));
        return;
      }

      const data = {
        nome: validation.data.nome,
        porcentagem_comissao: validation.data.porcentagem_comissao,
      };

      if (editingColaborador) {
        const { error } = await supabase
          .from('colaboradores')
          .update(data)
          .eq('id', editingColaborador.id);

        if (error) {
          console.error('Erro ao atualizar colaboradora:', error);
          toast.error('Erro ao atualizar colaboradora');
        } else {
          toast.success('Colaboradora atualizada com sucesso!');
          loadColaboradores();
          closeModal();
        }
      } else {
        const { error } = await supabase.from('colaboradores').insert(data);

        if (error) {
          console.error('Erro ao criar colaboradora:', error);
          toast.error('Erro ao criar colaboradora');
        } else {
          toast.success('Colaboradora criada com sucesso!');
          loadColaboradores();
          closeModal();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta colaboradora?')) {
      const { error } = await supabase.from('colaboradores').delete().eq('id', id);

      if (error) {
        console.error('Erro ao excluir colaboradora:', error);
        toast.error('Erro ao excluir colaboradora');
      } else {
        toast.success('Colaboradora excluída com sucesso!');
        loadColaboradores();
      }
    }
  };

  const openModal = (colaborador?: Colaborador) => {
    if (colaborador) {
      setEditingColaborador(colaborador);
      setFormData({
        nome: colaborador.nome,
        porcentagem_comissao: colaborador.porcentagem_comissao.toString(),
      });
    } else {
      setEditingColaborador(null);
      setFormData({ nome: '', porcentagem_comissao: '50' });
    }
    setFormErrors('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingColaborador(null);
    setFormData({ nome: '', porcentagem_comissao: '50' });
  };

  const getColor = (index: number) => COLORS[index % COLORS.length];

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
                  Naví Belle - Colaboradoras
                </h1>
                <p className="text-sm text-gray-600">Gerencie sua equipe</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin/servicos"
                className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-purple-300 text-purple-600 rounded-xl font-medium hover:bg-purple-50 hover:border-purple-400 transition-all shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Gerenciar Serviços
              </Link>
              <button
                onClick={() => openModal()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/30 hover:shadow-xl"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nova Colaboradora
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">
        {/* Resumo Geral */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft animate-fade-in-up">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total de Colaboradoras</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {colaboradores.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Atendimentos no Mês</p>
                <p className="text-3xl font-bold text-gray-800">
                  {Object.values(stats).reduce((sum: number, s: any) => sum + s.atendimentos, 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Comissões do Mês</p>
                <p className="text-3xl font-bold text-gray-800">
                  R$ {Object.values(stats).reduce((sum: number, s: any) => sum + s.comissao, 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cards de Colaboradoras */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {colaboradores.map((colaborador, index) => {
            const color = getColor(index);
            const colabStats = stats[colaborador.id] || { atendimentos: 0, faturamento: 0, comissao: 0 };

            return (
              <div
                key={colaborador.id}
                className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft hover:shadow-soft-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in-up group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${color.gradient} flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform`}>
                      {colaborador.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{colaborador.nome}</h3>
                      <p className="text-sm text-gray-600">Comissão: {colaborador.porcentagem_comissao}%</p>
                    </div>
                  </div>
                </div>

                {/* Estatísticas */}
                <div className="space-y-3 mb-4 pt-4 border-t border-purple-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Atendimentos</span>
                    <span className="text-lg font-bold text-purple-600">{colabStats.atendimentos}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Faturamento</span>
                    <span className="text-lg font-bold text-gray-800">R$ {colabStats.faturamento.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Comissão</span>
                    <span className="text-lg font-bold text-green-600">R$ {colabStats.comissao.toFixed(2)}</span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-4 border-t border-purple-100">
                  <button
                    onClick={() => openModal(colaborador)}
                    className="flex-1 px-4 py-2 bg-purple-100 text-purple-700 rounded-xl font-medium hover:bg-purple-200 transition-colors text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(colaborador.id)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200 transition-colors text-sm"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {colaboradores.length === 0 && (
          <div className="text-center py-16 bg-white/60 backdrop-blur-xl rounded-2xl border border-purple-100">
            <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-600 text-lg mb-4">Nenhuma colaboradora cadastrada</p>
            <button
              onClick={() => openModal()}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all"
            >
              Cadastrar Primeira Colaboradora
            </button>
          </div>
        )}
      </div>

      {/* Modal Premium */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {editingColaborador ? 'Editar Colaboradora' : 'Nova Colaboradora'}
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white transition-all"
                  placeholder="Digite o nome"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Porcentagem de Comissão (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.porcentagem_comissao}
                    onChange={(e) => setFormData({ ...formData, porcentagem_comissao: e.target.value })}
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white transition-all"
                    placeholder="50"
                  />
                  <span className="absolute right-4 top-3 text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Exemplo: 50% significa que a colaboradora recebe metade do valor do serviço
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
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <>{editingColaborador ? 'Salvar Alterações' : 'Cadastrar'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
