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

  // Aplica o perfil no estado + ref + cache local. O cache (localStorage) permite hidratar o
  // perfil INSTANTANEAMENTE no reload, sem depender da query (que às vezes estoura o timeout de 5s
  // e deixava o app "sem admin" momentaneamente — caía na versão antiga e escondia opções de admin).
  const CACHE_KEY = 'nb_profile';
  const aplicarProfile = (p: Profile | null) => {
    setProfile(p);
    profileRef.current = p;
    try {
      if (p) localStorage.setItem(CACHE_KEY, JSON.stringify(p));
      else localStorage.removeItem(CACHE_KEY);
    } catch { /* localStorage indisponível */ }
  };

  // Lê o perfil em cache (usado no init para não esperar a query).
  const lerProfileCache = (userId: string): Profile | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw) as Profile;
      return p && p.id === userId ? p : null;
    } catch { return null; }
  };

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
        if (!profileRef.current) aplicarProfile(null); // preserva o perfil do cache, se houver
        return;
      }

      if (data) {
        aplicarProfile({ ...data, role: data.role || 'user', colaborador_id: data.colaborador_id || null });
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
        if (!profileRef.current) aplicarProfile(null);
        return;
      }

      aplicarProfile(newProfile ? { ...newProfile, colaborador_id: newProfile.colaborador_id || null } : null);
    } catch (err) {
      console.error('Erro inesperado ao carregar perfil:', err);
      if (!profileRef.current) aplicarProfile(null); // timeout: mantém o perfil do cache
    }
  };

  useEffect(() => {
    let isMounted = true;
    let profileLoaded = false; // Flag para evitar carregamento duplicado

    // Verificar sessão atual (timeout tolerante — cold start no celular pode ser lento)
    const nukeELogin = () => {
      // Limpa storage do supabase e vai pro /login — SÓ quando temos certeza de que não há sessão.
      const alreadyCleaned = sessionStorage.getItem('auth_cleaned');
      if (alreadyCleaned) return;
      sessionStorage.setItem('auth_cleaned', '1');
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-') || key.includes('supabase')) localStorage.removeItem(key);
        });
      } catch {}
      window.location.href = '/login';
    };
    const aplicarSessao = (session: any) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && !profileLoaded) {
        profileLoaded = true;
        // Hidrata o perfil do cache NA HORA — assim, mesmo que a query demore/estoure o timeout,
        // o app já sabe quem é o usuário (e que é admin) e não cai na versão antiga.
        const cache = lerProfileCache(session.user.id);
        if (cache) { setProfile(cache); profileRef.current = cache; }
        Promise.race([
          loadProfile(session.user.id, session.user.email),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Profile timeout')), 5000)),
        ]).then(() => { try { sessionStorage.removeItem('auth_cleaned'); } catch {} }).catch(() => {});
      }
    };
    const initAuth = async () => {
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000)),
        ]) as any;
        if (!isMounted) return;
        aplicarSessao(result?.data?.session);
      } catch {
        // Um TIMEOUT aqui é rede lenta no boot, NÃO sessão inválida. Antes isso deslogava e mandava
        // pro /login (que o middleware rebate pra "/"), causando o "hard-load de /v2 cai na home".
        // Tentamos recuperar a sessão de novo SEM deslogar antes da hora.
        if (!isMounted) return;
        try {
          const retry: any = await Promise.race([
            supabase.auth.getSession(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000)),
          ]);
          if (!isMounted) return;
          if (retry?.data?.session?.user) {
            aplicarSessao(retry.data.session); // sessão recuperada — NÃO redireciona
          } else {
            nukeELogin(); // getSession respondeu e realmente não há sessão
          }
        } catch {
          // Nem o retry respondeu (rede muito ruim). NÃO desloga: o middleware já protege a rota no
          // servidor e a sessão entra pelo onAuthStateChange quando a rede voltar. Só encerra o loading.
        }
      } finally {
        if (isMounted) setLoading(false);
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
    aplicarProfile(null); // limpa estado + cache do perfil
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
