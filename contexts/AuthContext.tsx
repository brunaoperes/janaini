'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
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
  const profileRef = useRef<Profile | null>(null);
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
        profileRef.current = null;
        return;
      }

      if (data) {
        const p = {
          ...data,
          role: data.role || 'user',
          colaborador_id: data.colaborador_id || null
        };
        setProfile(p);
        profileRef.current = p;
        return;
      }

      // Perfil não existe, criar um básico para usuários antigos
      // Novos perfis sempre começam como 'user' (colaborador) - admin deve ser atribuído manualmente
      const username = userEmail?.split('@')[0] || `user_${userId.slice(0, 8)}`;
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: username,
          nome: username,
          role: 'user',
        })
        .select('id, username, nome, role, colaborador_id')
        .single();

      if (insertError) {
        console.error('Erro ao criar perfil:', insertError);
        setProfile(null);
        profileRef.current = null;
        return;
      }

      if (newProfile) {
        const p = {
          ...newProfile,
          colaborador_id: newProfile.colaborador_id || null
        };
        setProfile(p);
        profileRef.current = p;
      } else {
        setProfile(null);
        profileRef.current = null;
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar perfil:', err);
      setProfile(null);
      profileRef.current = null;
    }
  };

  useEffect(() => {
    let isMounted = true;
    let profileLoaded = false; // Flag para evitar carregamento duplicado

    // Verificar sessão atual
    const initAuth = async () => {
      try {
        // Usar Promise.race com timeout de 15 segundos
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 15000)
        );

        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;

        if (!isMounted) return;

        const session = result?.data?.session;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user && !profileLoaded) {
          profileLoaded = true;
          await loadProfile(session.user.id, session.user.email);
        }
      } catch (err) {
        // Retry uma vez em caso de timeout
        try {
          const { data } = await supabase.auth.getSession();
          if (!isMounted) return;
          const session = data?.session;
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user && !profileLoaded) {
            profileLoaded = true;
            await loadProfile(session.user.id, session.user.email);
          }
        } catch {
          // Limpar storage corrompido e redirecionar para login
          const alreadyCleaned = sessionStorage.getItem('auth_cleaned');
          if (!alreadyCleaned) {
            sessionStorage.setItem('auth_cleaned', '1');
            // Limpar dados do Supabase no localStorage
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('sb-') || key.includes('supabase')) {
                localStorage.removeItem(key);
              }
            });
            window.location.href = '/login';
            return;
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;


        // Ignorar INITIAL_SESSION pois initAuth já trata
        if (event === 'INITIAL_SESSION') {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Só carregar perfil em eventos de login real (não no INITIAL_SESSION)
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          // Se perfil já foi carregado e usuário é o mesmo, não recarregar
          if (profileLoaded && profileRef.current?.id === session.user.id) {
            return;
          }

          try {
            profileLoaded = true;
            await loadProfile(session.user.id, session.user.email);
          } catch (err) {
            console.error('AuthContext: Erro ao carregar perfil:', err);
          }
        } else if (!session) {
          setProfile(null);
          profileRef.current = null;
          profileLoaded = false;
        }

        setLoading(false);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Função para verificar se é email
  const isEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  // Login com email ou username
  const signIn = async (emailOrUsername: string, password: string) => {
    let email = emailOrUsername;

    // Se não for email, buscar o email pelo username
    if (!isEmail(emailOrUsername)) {
      try {
        // Timeout de 10 segundos para a RPC
        const rpcPromise = supabase.rpc('get_email_by_username', {
          p_username: emailOrUsername
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout ao buscar usuário')), 10000)
        );

        const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

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

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

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
    try {
      // Verificar se username já existe (com timeout de 5 segundos)
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
          return {
            error: new Error('Este nome de usuário já está em uso')
          };
        }
      } catch (checkErr: any) {
        // Continuar mesmo com timeout - o Supabase vai rejeitar se duplicado
      }

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

      if (error) {
        return { error };
      }

      // Se usuário foi criado, criar o perfil manualmente (caso o trigger não funcione)
      if (data?.user) {
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
          }
        } catch (profileErr: any) {
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
    profileRef.current = null;
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
