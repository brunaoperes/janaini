'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { signIn, signUp } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Login] Iniciando submit...', { isLogin });

    // Validação diferente para login e cadastro
    if (isLogin) {
      if (!emailOrUsername || !password) {
        toast.error('Preencha todos os campos');
        return;
      }
    } else {
      if (!nome || !username || !email || !password) {
        toast.error('Preencha todos os campos');
        return;
      }
    }

    setLoading(true);

    // Timeout de segurança para não ficar travado
    const timeoutId = setTimeout(() => {
      console.log('[Login] Timeout atingido, resetando loading');
      setLoading(false);
      toast.error('A operação demorou muito. Tente novamente.');
    }, 30000); // 30 segundos

    try {
      if (isLogin) {
        console.log('[Login] Chamando signIn...');
        const { error } = await signIn(emailOrUsername, password);
        console.log('[Login] signIn retornou:', { error: error?.message });

        clearTimeout(timeoutId);

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Email/usuário ou senha incorretos');
          } else if (error.message.includes('Usuário não encontrado')) {
            toast.error('Usuário não encontrado');
          } else if (error.message.includes('banned') || error.message.includes('User is banned')) {
            toast.error('Sua conta está desativada. Entre em contato com o administrador.');
          } else {
            toast.error(error.message);
          }
          setLoading(false);
        } else {
          toast.success('Login realizado com sucesso!');
          console.log('[Login] Redirecionando para home...');
          // Aguarda um pouco para o cookie ser setado antes de redirecionar
          // Usar replace para garantir que a página de login não fique no histórico
          await new Promise(resolve => setTimeout(resolve, 300));
          // Forçar reload completo para garantir que os cookies são lidos
          window.location.replace('/');
        }
      } else {
        console.log('[Login] Iniciando cadastro...');

        // Validações do cadastro
        if (!nome.trim()) {
          toast.error('Por favor, informe seu nome');
          clearTimeout(timeoutId);
          setLoading(false);
          return;
        }
        if (!username.trim()) {
          toast.error('Por favor, informe um nome de usuário');
          clearTimeout(timeoutId);
          setLoading(false);
          return;
        }
        if (username.length < 3) {
          toast.error('O nome de usuário deve ter pelo menos 3 caracteres');
          clearTimeout(timeoutId);
          setLoading(false);
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          toast.error('O nome de usuário só pode conter letras, números e underscore');
          clearTimeout(timeoutId);
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          toast.error('A senha deve ter pelo menos 6 caracteres');
          clearTimeout(timeoutId);
          setLoading(false);
          return;
        }

        console.log('[Login] Chamando signUp...');
        const { error } = await signUp(email, password, nome, username);
        console.log('[Login] signUp retornou:', { error: error?.message });

        clearTimeout(timeoutId);

        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('Este email já está cadastrado');
          } else if (error.message.includes('já está em uso')) {
            toast.error('Este nome de usuário já está em uso');
          } else if (error.message.includes('Password')) {
            toast.error('A senha deve ter pelo menos 6 caracteres');
          } else {
            toast.error(error.message || 'Erro ao criar conta');
          }
          setLoading(false);
        } else {
          toast.success('Conta criada com sucesso! Faça login para continuar.');
          setIsLogin(true);
          setPassword('');
          setEmailOrUsername(username);
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('[Login] Erro catch:', err);
      clearTimeout(timeoutId);
      toast.error('Erro ao processar solicitação');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Naví Belle</h1>
          <p className="text-gray-500 text-sm">Studio de Beleza</p>
        </div>

        {/* Toggle Login/Cadastro */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              isLogin
                ? 'bg-white text-purple-600 shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              !isLogin
                ? 'bg-white text-purple-600 shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isLogin ? (
            // Campos de Login
            <>
              <div>
                <label htmlFor="emailOrUsername" className="block text-sm font-medium text-gray-700 mb-1">
                  Email ou Usuário
                </label>
                <input
                  id="emailOrUsername"
                  type="text"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="seu@email.com ou usuario"
                  required
                />
              </div>
            </>
          ) : (
            // Campos de Cadastro
            <>
              <div>
                <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo
                </label>
                <input
                  id="nome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome de Usuário
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="seu_usuario"
                    required
                    minLength={3}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Apenas letras, números e underscore</p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="••••••••"
              required
              minLength={isLogin ? 1 : 6}
            />
            {!isLogin && (
              <p className="text-xs text-gray-500 mt-1">Mínimo de 6 caracteres</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processando...
              </>
            ) : (
              isLogin ? 'Entrar' : 'Criar Conta'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Sistema de gestão para salões de beleza</p>
          {mounted && <p className="text-green-500 text-xs mt-2">JS Ativo</p>}
        </div>
      </div>
    </div>
  );
}
