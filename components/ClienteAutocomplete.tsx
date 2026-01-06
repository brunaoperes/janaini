'use client';

import { useState, useEffect } from 'react';
import { Cliente } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface ClienteAutocompleteProps {
  onSelect: (cliente: Cliente | null) => void;
  selectedCliente?: Cliente | null;
}

export default function ClienteAutocomplete({ onSelect, selectedCliente }: ClienteAutocompleteProps) {
  const [search, setSearch] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientPhone, setNewClientPhone] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (search.length > 0 && !selectedCliente) {
      searchClientes(search);
    } else {
      setClientes([]);
      setShowDropdown(false);
    }
  }, [search, selectedCliente]);

  const searchClientes = async (query: string) => {
    try {
      const response = await fetch(`/api/clientes?search=${encodeURIComponent(query)}`);
      const result = await response.json();

      if (result.data) {
        setClientes(result.data);
        setShowDropdown(true);
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
  };

  const handleSelect = (cliente: Cliente) => {
    onSelect(cliente);
    setSearch('');
    setShowDropdown(false);
    setShowNewClientForm(false);
  };

  const handleCreateClient = async () => {
    if (!search.trim()) {
      toast.error('Digite o nome do cliente');
      return;
    }
    if (!newClientPhone.trim() || newClientPhone.length < 10) {
      toast.error('Digite um telefone válido (mínimo 10 dígitos)');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: search.trim(),
          telefone: newClientPhone.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Erro ao criar cliente:', result.error);
        toast.error('Erro ao cadastrar cliente');
        return;
      }

      toast.success(`Cliente "${result.data.nome}" cadastrado!`);
      handleSelect(result.data);
      setNewClientPhone('');
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao cadastrar cliente');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClear = () => {
    onSelect(null);
    setSearch('');
    setShowDropdown(false);
    setShowNewClientForm(false);
    setNewClientPhone('');
  };

  // Verifica se o nome digitado já existe exatamente
  const exactMatch = clientes.some(c => c.nome.toLowerCase() === search.toLowerCase());

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={selectedCliente ? selectedCliente.nome : search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (selectedCliente) onSelect(null);
            setShowNewClientForm(false);
          }}
          placeholder="Digite o nome do cliente..."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {selectedCliente && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {showDropdown && !selectedCliente && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {clientes.map((cliente) => (
            <div
              key={cliente.id}
              onClick={() => handleSelect(cliente)}
              className="px-4 py-3 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-800">{cliente.nome}</div>
              <div className="text-sm text-gray-500">{cliente.telefone}</div>
            </div>
          ))}

          {/* Opção de cadastrar novo cliente */}
          {search.length >= 2 && !exactMatch && (
            <div
              onClick={() => setShowNewClientForm(true)}
              className="px-4 py-3 hover:bg-green-50 cursor-pointer border-t border-gray-200 bg-gray-50"
            >
              <div className="font-medium text-green-600 flex items-center gap-2">
                <span>+</span>
                <span>Cadastrar "{search}"</span>
              </div>
              <div className="text-sm text-gray-500">Clique para criar novo cliente</div>
            </div>
          )}
        </div>
      )}

      {/* Mostrar opção de cadastrar quando não há resultados */}
      {showDropdown && clientes.length === 0 && search.length >= 2 && !selectedCliente && !showNewClientForm && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg">
          <div
            onClick={() => setShowNewClientForm(true)}
            className="px-4 py-3 hover:bg-green-50 cursor-pointer"
          >
            <div className="font-medium text-green-600 flex items-center gap-2">
              <span>+</span>
              <span>Cadastrar "{search}"</span>
            </div>
            <div className="text-sm text-gray-500">Cliente não encontrado. Clique para cadastrar.</div>
          </div>
        </div>
      )}

      {/* Formulário de novo cliente */}
      {showNewClientForm && !selectedCliente && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4">
          <div className="font-medium text-gray-800 mb-3">
            Cadastrar: <span className="text-purple-600">{search}</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Telefone *</label>
              <input
                type="tel"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewClientForm(false)}
                className="flex-1 px-3 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateClient}
                disabled={isCreating}
                className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {isCreating ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
