'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// 4 horas em milissegundos
const INACTIVITY_TIMEOUT = 4 * 60 * 60 * 1000;

// Prefixo da chave do localStorage (será completado com userId)
const LAST_ACTIVITY_KEY_PREFIX = 'navi_belle_last_activity_';

/**
 * Componente que rastreia atividade do usuário
 * Faz logout automático após 4 horas de inatividade
 * Usa chave específica por usuário para evitar conflitos entre múltiplos admins
 */
export default function ActivityTracker() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const isLoggingOutRef = useRef<boolean>(false);

  // Chave específica por usuário
  const activityKey = useMemo(() => {
    return user?.id ? `${LAST_ACTIVITY_KEY_PREFIX}${user.id}` : `${LAST_ACTIVITY_KEY_PREFIX}anonymous`;
  }, [user?.id]);

  // Função para fazer logout por inatividade
  const logoutByInactivity = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      localStorage.removeItem(activityKey);
      await supabase.auth.signOut();
      router.push('/login?expired=true');
    } catch (error) {
      console.error('Erro ao fazer logout por inatividade:', error);
      router.push('/login');
    }
  }, [router, activityKey]);

  // Atualizar última atividade
  const updateActivity = useCallback(() => {
    if (!isAuthenticated) return;

    try {
      localStorage.setItem(activityKey, Date.now().toString());
    } catch (error) {
      // localStorage pode falhar em modo privado
    }
  }, [isAuthenticated, activityKey]);

  // Verificar inatividade
  const checkInactivity = useCallback(() => {
    if (!isAuthenticated) return;

    try {
      const lastActivityStr = localStorage.getItem(activityKey);

      if (!lastActivityStr) {
        updateActivity();
        return;
      }

      const lastActivity = parseInt(lastActivityStr, 10);
      const elapsed = Date.now() - lastActivity;

      if (elapsed > INACTIVITY_TIMEOUT) {
        console.log('Sessão expirada por inatividade após 4 horas');
        logoutByInactivity();
      }
    } catch (error) {
      console.warn('Erro ao verificar inatividade:', error);
    }
  }, [isAuthenticated, logoutByInactivity, updateActivity, activityKey]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Inicializar última atividade
    updateActivity();

    // Eventos que indicam atividade
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    // Throttle para performance
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledUpdateActivity = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        updateActivity();
        throttleTimeout = null;
      }, 1000);
    };

    // Adicionar listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, throttledUpdateActivity, { passive: true });
    });

    // Verificar inatividade a cada minuto
    const inactivityInterval = setInterval(checkInactivity, 60000);

    // Verificar ao focar na janela
    const handleFocus = () => checkInactivity();
    window.addEventListener('focus', handleFocus);

    // Verificar quando a página fica visível
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, throttledUpdateActivity);
      });
      if (throttleTimeout) clearTimeout(throttleTimeout);
      clearInterval(inactivityInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, updateActivity, checkInactivity]);

  return null;
}
