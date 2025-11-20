'use client';

import { useState, useEffect } from 'react';
import { supabase, Cliente } from '@/lib/supabase';

interface ClienteAutocompleteProps {
  onSelect: (cliente: Cliente) => void;
  selectedCliente?: Cliente | null;
}

export default function ClienteAutocomplete({ onSelect, selectedCliente }: ClienteAutocompleteProps) {
  const [search, setSearch] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (search.length > 0) {
      searchClientes(search);
    } else {
      setClientes([]);
    }
  }, [search]);

  const searchClientes = async (query: string) => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .ilike('nome', `%${query}%`)
      .limit(10);

    if (data && !error) {
      setClientes(data);
      setShowDropdown(true);
    }
  };

  const handleSelect = (cliente: Cliente) => {
    onSelect(cliente);
    setSearch(cliente.nome);
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={selectedCliente ? selectedCliente.nome : search}
        onChange={(e) => {
          setSearch(e.target.value);
          if (selectedCliente) onSelect(null as any);
        }}
        placeholder="Digite o nome da cliente..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
      />

      {showDropdown && clientes.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {clientes.map((cliente) => (
            <div
              key={cliente.id}
              onClick={() => handleSelect(cliente)}
              className="px-4 py-3 hover:bg-purple-50 cursor-pointer border-b last:border-b-0"
            >
              <div className="font-medium">{cliente.nome}</div>
              <div className="text-sm text-gray-500">{cliente.telefone}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
