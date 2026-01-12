'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { initializeActivity, clearActivity } from '@/hooks/useActivityTracker';

interface Profile {
  id: string;
  username: string;
  nome: string;
  role: 'admin' | 'user';
  colaborador_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (emailOrUsername: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, nome: string, username: string) => Promise<{ error: AuthError | Error | null }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Função para carregar o perfil do usuário (ou criar se não existir)
  const loadProfile = async (userId: string, userEmail?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, nome, role, colaborador_id')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao carregar perfil:', error);
        setProfile(null);
        return;
      }

      if (data) {
        // Garantir que role existe
        setProfile({
          ...data,
          role: data.role || 'user',
          colaborador_id: data.colaborador_id || null
        });
        return;
      }

      // Perfil não existe, criar um básico para usuários antigos
      const username = userEmail?.split('@')[0] || `user_${userId.slice(0, 8)}`;
      const isAdminEmail = userEmail === 'brunoinfoperes@gmail.com';
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: username,
          nome: username,
          role: isAdminEmail ? 'admin' : 'user',
        })
        .select('id, username, nome, role, colaborador_id')
        .single();

      if (insertError) {
        console.error('Erro ao criar perfil:', insertError);
        setProfile(null);
        return;
      }

      if (newProfile) {
        setProfile({
          ...newProfile,
          colaborador_id: newProfile.colaborador_id || null
        });
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar perfil:', err);
      setProfile(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let profileLoaded = false; // Flag para evitar carregamento duplicado

    // Verificar sessão atual
    const initAuth = async () => {
      console.log('AuthContext: Iniciando...');

      try {
        // Usar Promise.race com timeout de 10 segundos
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 10000)
        );

        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;

        if (!isMounted) return;

        const session = result?.data?.session;
        console.log('AuthContext: Sessão obtida:', !!session);

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user && !profileLoaded) {
          console.log('AuthContext: Carregando perfil...');
          profileLoaded = true;
          await loadProfile(session.user.id, session.user.email);
          console.log('AuthContext: Perfil carregado');
        }
      } catch (err) {
        console.log('AuthContext: Erro ou timeout:', err);
      } finally {
        if (isMounted) {
          console.log('AuthContext: Finalizando loading');
          setLoading(false);
        }
      }
    };

    initAuth();

    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        console.log('AuthContext: onAuthStateChange:', event, !!session);

        // Ignorar INITIAL_SESSION pois initAuth já trata
        if (event === 'INITIAL_SESSION') {
          console.log('AuthContext: Ignorando INITIAL_SESSION (já tratado por initAuth)');
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Só carregar perfil em eventos de login real (não no INITIAL_SESSION)
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          // Se perfil já foi carregado e usuário é o mesmo, não recarregar
          if (profileLoaded && profile?.id === session.user.id) {
            console.log('AuthContext: Perfil já carregado, ignorando');
            return;
          }

          console.log('AuthContext: onAuthStateChange - carregando perfil...');
          try {
            profileLoaded = true;
            await loadProfile(session.user.id, session.user.email);
            console.log('AuthContext: onAuthStateChange - perfil carregado');
          } catch (err) {
            console.error('AuthContext: Erro ao carregar perfil:', err);
          }
        } else if (!session) {
          setProfile(null);
          profileLoaded = false;
        }

        setLoading(false);
        console.log('AuthContext: onAuthStateChange - loading finalizado');

        if (event === 'SIGNED_OUT') {
          profileLoaded = false;
          router.push('/login');
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, profile?.id]);

  // Função para verificar se é email
  const isEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  // Login com email ou username
  const signIn = async (emailOrUsername: string, password: string) => {
    console.log('[AuthContext] signIn iniciado para:', emailOrUsername);
    let email = emailOrUsername;

    // Se não for email, buscar o email pelo username
    if (!isEmail(emailOrUsername)) {
      console.log('[AuthContext] Buscando email pelo username...');
      try {
        // Timeout de 10 segundos para a RPC
        const rpcPromise = supabase.rpc('get_email_by_username', {
          p_username: emailOrUsername
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout ao buscar usuário')), 10000)
        );

        const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

        console.log('[AuthContext] Resultado RPC:', { data, error: error?.message });

        if (error || !data) {
          return {
            error: {
              message: 'Usuário não encontrado',
              name: 'AuthError',
              status: 400
            } as AuthError
          };
        }

        email = data;
      } catch (err: any) {
        console.error('[AuthContext] Erro ao buscar username:', err);
        return {
          error: {
            message: err.message || 'Erro ao buscar usuário',
            name: 'AuthError',
            status: 500
          } as AuthError
        };
      }
    }

    console.log('[AuthContext] Chamando signInWithPassword...');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('[AuthContext] signInWithPassword retornou:', { error: error?.message });

      // Inicializar rastreamento de atividade após login bem-sucedido
      // Passa o userId para criar chave única no localStorage
      if (!error) {
        const { data: sessionData } = await supabase.auth.getSession();
        initializeActivity(sessionData?.session?.user?.id);
      }

      return { error };
    } catch (err: any) {
      console.error('[AuthContext] Erro no signInWithPassword:', err);
      return {
        error: {
          message: err.message || 'Erro ao fazer login',
          name: 'AuthError',
          status: 500
        } as AuthError
      };
    }
  };

  // Cadastro com username
  const signUp = async (email: string, password: string, nome: string, username: string) => {
    console.log('[AuthContext] signUp iniciado para:', email);

    try {
      // Verificar se username já existe (com timeout de 5 segundos)
      console.log('[AuthContext] Verificando se username existe...');
      try {
        const checkPromise = supabase
          .from('profiles')
          .select('username')
          .eq('username', username.toLowerCase())
          .maybeSingle();

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );

        const result = await Promise.race([checkPromise, timeoutPromise]) as any;
        const { data: existingUser, error: checkError } = result;

        if (checkError) {
          console.error('[AuthContext] Erro ao verificar username:', checkError);
        }

        if (existingUser) {
          console.log('[AuthContext] Username já existe');
          return {
            error: new Error('Este nome de usuário já está em uso')
          };
        }
      } catch (checkErr: any) {
        console.log('[AuthContext] Timeout ou erro na verificação de username, continuando...', checkErr.message);
        // Continuar mesmo com timeout - o Supabase vai rejeitar se duplicado
      }

      console.log('[AuthContext] Chamando auth.signUp...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome: nome,
            username: username.toLowerCase(),
          },
        },
      });

      console.log('[AuthContext] signUp retornou:', { user: !!data?.user, error: error?.message });

      if (error) {
        return { error };
      }

      // Se usuário foi criado, criar o perfil manualmente (caso o trigger não funcione)
      if (data?.user) {
        console.log('[AuthContext] Criando perfil para novo usuário...');
        try {
          const profilePromise = supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: email,
              nome: nome,
              username: username.toLowerCase(),
              role: 'user',
            }, { onConflict: 'id' });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000)
          );

          const result = await Promise.race([profilePromise, timeoutPromise]) as any;

          if (result.error) {
            console.error('[AuthContext] Erro ao criar perfil:', result.error);
          } else {
            console.log('[AuthContext] Perfil criado com sucesso');
          }
        } catch (profileErr: any) {
          console.log('[AuthContext] Timeout ao criar perfil, mas usuário foi criado:', profileErr.message);
        }
      }

      return { error: null };
    } catch (err: any) {
      console.error('[AuthContext] Erro no signUp:', err);
      return {
        error: new Error(err.message || 'Erro ao criar conta')
      };
    }
  };

  const signOut = async () => {
    // Limpar rastreamento de atividade antes do logout
    // Passa o userId atual para limpar a chave correta
    clearActivity(user?.id);
    await supabase.auth.signOut();
    setProfile(null);
    router.push('/login');
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!user,
    isAdmin: profile?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
