'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import Button from '@/components/Button';

export default function MinhaContaPage() {
  const { user, profile, loading: authLoading, isAdmin } = useAuth();

  // Estados para troca de senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const handleTrocarSenha = async (e: React.FormEvent) => {
    e.preventDefault();

    if (novaSenha !== confirmaSenha) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (novaSenha.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    // Admin não precisa de senha atual
    if (!isAdmin && !senhaAtual) {
      toast.error('Informe sua senha atual');
      return;
    }

    setSalvandoSenha(true);

    try {
      const response = await fetch('/api/usuarios/senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senhaAtual: isAdmin ? undefined : senhaAtual,
          novaSenha,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao trocar senha');
      }

      toast.success('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmaSenha('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao trocar senha');
    } finally {
      setSalvandoSenha(false);
    }
  };

  if (authLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FCEBFB] via-[#EAD5FF] to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Você precisa estar logado para acessar esta página.</p>
          <Link href="/login" className="text-purple-600 hover:underline">
            Fazer Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FCEBFB] via-[#EAD5FF] to-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-purple-100 shadow-soft">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-purple-600 hover:text-purple-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Voltar</span>
              </Link>
              <div className="h-6 w-px bg-purple-200" />
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Minha Conta
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-6 max-w-2xl">
        {/* Informações do Usuário */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Informações do Perfil
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl">
              <label className="text-xs font-semibold text-gray-500 uppercase">Nome</label>
              <p className="text-gray-800 font-medium mt-1">{profile?.nome || '-'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <label className="text-xs font-semibold text-gray-500 uppercase">Usuário</label>
              <p className="text-gray-800 font-medium mt-1">{profile?.username || '-'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <label className="text-xs font-semibold text-gray-500 uppercase">Email</label>
              <p className="text-gray-800 font-medium mt-1">{user?.email || '-'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <label className="text-xs font-semibold text-gray-500 uppercase">Perfil</label>
              <p className="mt-1">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {isAdmin ? 'Administrador' : 'Usuário'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Trocar Senha */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Trocar Senha
          </h2>

          <form onSubmit={handleTrocarSenha} className="space-y-4">
            {/* Senha Atual (apenas para usuários não-admin) */}
            {!isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha Atual *
                </label>
                <div className="relative">
                  <input
                    type={showSenhaAtual ? 'text' : 'password'}
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
                    placeholder="Digite sua senha atual"
                    required={!isAdmin}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showSenhaAtual ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {isAdmin && (
              <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                Como administrador, você não precisa informar a senha atual.
              </p>
            )}

            {/* Nova Senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nova Senha *
              </label>
              <div className="relative">
                <input
                  type={showNovaSenha ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNovaSenha(!showNovaSenha)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNovaSenha ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {novaSenha && novaSenha.length < 6 && (
                <p className="text-xs text-orange-600 mt-1">A senha deve ter pelo menos 6 caracteres</p>
              )}
            </div>

            {/* Confirmar Nova Senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar Nova Senha *
              </label>
              <input
                type={showNovaSenha ? 'text' : 'password'}
                value={confirmaSenha}
                onChange={(e) => setConfirmaSenha(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Digite novamente a nova senha"
                required
              />
              {novaSenha && confirmaSenha && novaSenha !== confirmaSenha && (
                <p className="text-xs text-red-600 mt-1">As senhas não coincidem</p>
              )}
            </div>

            {/* Botão */}
            <div className="pt-4">
              <Button
                type="submit"
                variant="primary"
                disabled={salvandoSenha || novaSenha.length < 6 || novaSenha !== confirmaSenha || (!isAdmin && !senhaAtual)}
                className="w-full py-3"
              >
                {salvandoSenha ? 'Salvando...' : 'Trocar Senha'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
