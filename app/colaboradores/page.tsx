'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { supabase, Colaborador } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ColaboradoresPage() {
  const { profile, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    // Se usuário tem vínculo com colaborador, redireciona automaticamente
    if (profile?.colaborador_id && !isAdmin) {
      setRedirecting(true);
      router.push(`/colaboradores/${profile.colaborador_id}`);
      return;
    }

    loadColaboradores();
  }, [authLoading, profile, isAdmin, router]);

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

  if (authLoading || loading || redirecting) return <LoadingSpinner />;

  // Se usuário não é admin e não tem vínculo
  if (!isAdmin && !profile?.colaborador_id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <Link href="/" className="text-purple-600 hover:text-purple-800">
              ← Voltar
            </Link>
          </div>

          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">🔗</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Conta não vinculada
            </h1>
            <p className="text-gray-600 mb-6">
              Sua conta ainda não está vinculada a uma colaboradora.
              Entre em contato com o administrador para fazer o vínculo.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all"
            >
              Voltar ao Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/" className="text-purple-600 hover:text-purple-800">
            ← Voltar
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
          {isAdmin ? 'Colaboradoras' : 'Selecione seu nome'}
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
                {/* Mostrar comissão apenas para admin */}
                {isAdmin && (
                  <p className="text-gray-600">
                    Comissão: {colaborador.porcentagem_comissao}%
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
