'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface FormaPagamento {
  id: number;
  nome: string;
  codigo: string;
  icone: string;
  taxa_percentual: number;
  ativo: boolean;
  ordem: number;
}

export default function PagamentosPage() {
  const router = useRouter();
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedForma, setSelectedForma] = useState<FormaPagamento | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    icone: '💳',
    taxa_percentual: '0',
    ativo: true,
    ordem: 0,
  });

  const icones = ['💳', '📱', '💵', '🏦', '💰', '🪙', '📲', '🔄'];

  useEffect(() => {
    loadFormas();
  }, []);

  const loadFormas = async () => {
    try {
      const response = await fetch('/api/admin?tabela=formas_pagamento');
      const result = await response.json();
      setFormas(result.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar formas de pagamento:', error);
      toast.error('Erro ao carregar formas de pagamento');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (forma?: FormaPagamento) => {
    if (forma) {
      setSelectedForma(forma);
      setFormData({
        nome: forma.nome,
        codigo: forma.codigo,
        icone: forma.icone,
        taxa_percentual: forma.taxa_percentual.toString(),
        ativo: forma.ativo,
        ordem: forma.ordem,
      });
    } else {
      setSelectedForma(null);
      setFormData({
        nome: '',
        codigo: '',
        icone: '💳',
        taxa_percentual: '0',
        ativo: true,
        ordem: formas.length + 1,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim() || !formData.codigo.trim()) {
      toast.error('Preencha o nome e o código');
      return;
    }

    try {
      const payload = {
        nome: formData.nome.trim(),
        codigo: formData.codigo.toLowerCase().replace(/\s+/g, '_'),
        icone: formData.icone,
        taxa_percentual: parseFloat(formData.taxa_percentual) || 0,
        ativo: formData.ativo,
        ordem: formData.ordem,
      };

      if (selectedForma) {
        const response = await fetch('/api/admin', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabela: 'formas_pagamento', id: selectedForma.id, dados: payload }),
        });

        if (!response.ok) throw new Error('Erro ao atualizar');
        toast.success('Forma de pagamento atualizada!');
      } else {
        const response = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabela: 'formas_pagamento', dados: payload }),
        });

        if (!response.ok) throw new Error('Erro ao criar');
        toast.success('Forma de pagamento criada!');
      }

      setShowModal(false);
      loadFormas();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao salvar');
    }
  };

  const handleDelete = async () => {
    if (!selectedForma) return;

    try {
      const response = await fetch(`/api/admin?tabela=formas_pagamento&id=${selectedForma.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao excluir');
      toast.success('Forma de pagamento excluída!');
      setShowDeleteConfirm(false);
      setSelectedForma(null);
      loadFormas();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      toast.error(error.message || 'Erro ao excluir');
    }
  };

  const toggleAtivo = async (forma: FormaPagamento) => {
    try {
      const response = await fetch('/api/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabela: 'formas_pagamento', id: forma.id, dados: { ativo: !forma.ativo } }),
      });

      if (!response.ok) throw new Error('Erro ao alterar status');
      toast.success(forma.ativo ? 'Desativado!' : 'Ativado!');
      loadFormas();
    } catch (error: any) {
      toast.error('Erro ao alterar status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Formas de Pagamento</h1>
            <p className="text-gray-600 mt-1">
              Configure as formas de pagamento e suas taxas
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/admin')}>
              Voltar
            </Button>
            <Button onClick={() => handleOpenModal()}>
              + Nova Forma
            </Button>
          </div>
        </div>

        {/* Info sobre taxas */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="font-semibold text-yellow-800">Como funcionam as taxas?</h3>
              <p className="text-sm text-yellow-700 mt-1">
                A taxa configurada será <strong>descontada da comissão do colaborador</strong> ao finalizar um serviço.
                <br />
                Exemplo: Se a comissão é R$ 50 e a taxa do cartão é 3%, o colaborador recebe R$ 48,50.
              </p>
            </div>
          </div>
        </div>

        {/* Lista de Formas de Pagamento */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {formas.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <span className="text-4xl block mb-4">💳</span>
              Nenhuma forma de pagamento cadastrada
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {formas.map((forma) => (
                <div
                  key={forma.id}
                  className={`p-6 flex items-center justify-between hover:bg-purple-50 transition-colors ${
                    !forma.ativo ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center text-3xl">
                      {forma.icone}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-lg">{forma.nome}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                          {forma.codigo}
                        </span>
                        {forma.taxa_percentual > 0 ? (
                          <span className="text-xs bg-red-100 px-2 py-1 rounded text-red-600 font-medium">
                            Taxa: {forma.taxa_percentual.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-xs bg-green-100 px-2 py-1 rounded text-green-600 font-medium">
                            Sem taxa
                          </span>
                        )}
                        {!forma.ativo && (
                          <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-500">
                            Inativo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle Ativo */}
                    <button
                      onClick={() => toggleAtivo(forma)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        forma.ativo ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          forma.ativo ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>

                    {/* Editar */}
                    <button
                      onClick={() => handleOpenModal(forma)}
                      className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    {/* Excluir */}
                    <button
                      onClick={() => {
                        setSelectedForma(forma);
                        setShowDeleteConfirm(true);
                      }}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal de Edição */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={selectedForma ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}
        >
          <div className="space-y-5">
            {/* Nome */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome *
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="Ex: Cartão de Crédito"
              />
            </div>

            {/* Código */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Código (identificador único) *
              </label>
              <input
                type="text"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="Ex: cartao_credito"
                disabled={!!selectedForma}
              />
              {selectedForma && (
                <p className="text-xs text-gray-500 mt-1">O código não pode ser alterado após criação</p>
              )}
            </div>

            {/* Ícone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ícone
              </label>
              <div className="flex gap-2 flex-wrap">
                {icones.map((icone) => (
                  <button
                    key={icone}
                    type="button"
                    onClick={() => setFormData({ ...formData, icone })}
                    className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all ${
                      formData.icone === icone
                        ? 'bg-purple-500 scale-110 shadow-lg'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {icone}
                  </button>
                ))}
              </div>
            </div>

            {/* Taxa */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Taxa (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.taxa_percentual}
                  onChange={(e) => setFormData({ ...formData, taxa_percentual: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors pr-12"
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Essa taxa será descontada da comissão do colaborador
              </p>
            </div>

            {/* Preview do desconto */}
            {parseFloat(formData.taxa_percentual) > 0 && (
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-purple-700">
                  <strong>Exemplo:</strong> Em um serviço de R$ 100,00 com comissão de 50%:
                </p>
                <ul className="text-sm text-purple-600 mt-2 space-y-1">
                  <li>Comissão bruta: R$ 50,00</li>
                  <li>Taxa ({formData.taxa_percentual}%): -R$ {(50 * parseFloat(formData.taxa_percentual) / 100).toFixed(2)}</li>
                  <li className="font-bold">Comissão líquida: R$ {(50 - (50 * parseFloat(formData.taxa_percentual) / 100)).toFixed(2)}</li>
                </ul>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSave} className="flex-1">
                {selectedForma ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Confirm Delete */}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setSelectedForma(null);
          }}
          onConfirm={handleDelete}
          title="Excluir Forma de Pagamento"
          message={`Tem certeza que deseja excluir "${selectedForma?.nome}"? Esta ação não pode ser desfeita.`}
          type="danger"
          confirmText="Excluir"
        />
      </div>
    </div>
  );
}
