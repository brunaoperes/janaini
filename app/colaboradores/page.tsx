'use client';

import { useState, useEffect } from 'react';

export const dynamic = 'force-dynamic';
import { supabase, Colaborador } from '@/lib/supabase';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ColaboradoresPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadColaboradores();
  }, []);

  const loadColaboradores = async () => {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('*')
      .order('nome');

    if (data && !error) {
      setColaboradores(data);
    }
    setLoading(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/" className="text-purple-600 hover:text-purple-800">
            ← Voltar
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
          Selecione seu nome
        </h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {colaboradores.map((colaborador) => (
            <Link
              key={colaborador.id}
              href={`/colaboradores/${colaborador.id}`}
              className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-all hover:scale-105 border-t-4 border-purple-500"
            >
              <div className="text-center">
                <div className="text-6xl mb-4">👤</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {colaborador.nome}
                </h2>
                <p className="text-gray-600">
                  Comissão: {colaborador.porcentagem_comissao}%
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
