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

        if (session?.user) {
          console.log('AuthContext: Carregando perfil...');
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
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('AuthContext: onAuthStateChange - carregando perfil...');
          try {
            await loadProfile(session.user.id, session.user.email);
            console.log('AuthContext: onAuthStateChange - perfil carregado');
          } catch (err) {
            console.error('AuthContext: Erro ao carregar perfil:', err);
          }
        } else {
          setProfile(null);
        }

        setLoading(false);
        console.log('AuthContext: onAuthStateChange - loading finalizado');

        if (event === 'SIGNED_OUT') {
          router.push('/login');
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Função para verificar se é email
  const isEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  // Login com email ou username
  const signIn = async (emailOrUsername: string, password: string) => {
    let email = emailOrUsername;

    // Se não for email, buscar o email pelo username
    if (!isEmail(emailOrUsername)) {
      const { data, error } = await supabase.rpc('get_email_by_username', {
        p_username: emailOrUsername
      });

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
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Inicializar rastreamento de atividade após login bem-sucedido
    if (!error) {
      initializeActivity();
    }

    return { error };
  };

  // Cadastro com username
  const signUp = async (email: string, password: string, nome: string, username: string) => {
    // Verificar se username já existe
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username.toLowerCase())
      .single();

    if (existingUser) {
      return {
        error: new Error('Este nome de usuário já está em uso')
      };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome: nome,
          username: username.toLowerCase(),
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Limpar rastreamento de atividade antes do logout
    clearActivity();
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
