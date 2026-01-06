'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function AcessoNegadoPage() {
  const { isAuthenticated, profile } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Ícone */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Título */}
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Acesso Negado
        </h1>

        {/* Mensagem */}
        <p className="text-gray-600 mb-8">
          Você não tem permissão para acessar esta área.
          {isAuthenticated && profile && (
            <span className="block mt-2 text-sm text-gray-500">
              Logado como: <strong>{profile.nome}</strong> ({profile.role === 'admin' ? 'Administrador' : 'Usuário'})
            </span>
          )}
        </p>

        {/* Informação adicional */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 mb-8 border border-pink-100 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-3">
            Por que estou vendo isso?
          </h2>
          <ul className="text-left text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-pink-500 mt-0.5">•</span>
              <span>Esta área é restrita a administradores do sistema</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-500 mt-0.5">•</span>
              <span>Seu perfil de usuário não possui as permissões necessárias</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-500 mt-0.5">•</span>
              <span>Se você acredita que deveria ter acesso, entre em contato com o administrador</span>
            </li>
          </ul>
        </div>

        {/* Botões */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all shadow-lg shadow-pink-500/25"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Voltar ao Início
          </Link>

          <Link
            href="/agenda"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all border border-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Ver Agenda
          </Link>
        </div>

        {/* Logo */}
        <div className="mt-12 text-center">
          <span className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Naví Belle
          </span>
          <p className="text-xs text-gray-400 mt-1">Studio de Beleza</p>
        </div>
      </div>
    </div>
  );
}
