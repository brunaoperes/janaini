'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 4 horas em milissegundos
const INACTIVITY_TIMEOUT = 4 * 60 * 60 * 1000;

// Prefixo da chave do localStorage (será completado com userId)
const LAST_ACTIVITY_KEY_PREFIX = 'navi_belle_last_activity_';

// Helper para obter a chave completa do localStorage
function getActivityKey(userId?: string): string {
  return userId ? `${LAST_ACTIVITY_KEY_PREFIX}${userId}` : `${LAST_ACTIVITY_KEY_PREFIX}anonymous`;
}

/**
 * Hook para rastrear atividade do usuário e fazer logout por inatividade
 *
 * Funcionalidades:
 * - Atualiza timestamp a cada interação do usuário
 * - Verifica inatividade a cada minuto
 * - Faz logout automático após 4 horas sem atividade
 * - Verifica ao voltar de outra aba/janela
 * - Usa chave específica por usuário para evitar conflito entre admins
 */
export function useActivityTracker(userId?: string) {
  const router = useRouter();
  const lastActivityRef = useRef<number>(Date.now());
  const isLoggingOutRef = useRef<boolean>(false);
  const activityKey = getActivityKey(userId);

  // Função para fazer logout por inatividade
  const logoutByInactivity = useCallback(async () => {
    // Evita múltiplos logouts
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      // Limpar localStorage do usuário atual
      localStorage.removeItem(activityKey);

      // Fazer logout no Supabase
      await supabase.auth.signOut();

      // Redirecionar para login com mensagem
      router.push('/login?expired=true');
    } catch (error) {
      console.error('Erro ao fazer logout por inatividade:', error);
      // Mesmo com erro, redirecionar
      router.push('/login');
    }
  }, [router, activityKey]);

  // Atualizar última atividade
  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    try {
      localStorage.setItem(activityKey, now.toString());
    } catch (error) {
      // localStorage pode falhar em modo privado
      console.warn('Não foi possível salvar última atividade:', error);
    }
  }, [activityKey]);

  // Verificar inatividade
  const checkInactivity = useCallback(() => {
    try {
      const lastActivityStr = localStorage.getItem(activityKey);

      if (!lastActivityStr) {
        // Se não tem registro, inicializar
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
  }, [logoutByInactivity, updateActivity, activityKey]);

  useEffect(() => {
    // Inicializar última atividade
    updateActivity();

    // Eventos que indicam atividade do usuário
    const activityEvents = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'mousemove', // Adicionar movimento do mouse
    ];

    // Throttle para não atualizar a cada pixel de movimento
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledUpdateActivity = () => {
      if (throttleTimeout) return;

      throttleTimeout = setTimeout(() => {
        updateActivity();
        throttleTimeout = null;
      }, 1000); // Atualiza no máximo 1x por segundo
    };

    // Adicionar listeners de atividade
    activityEvents.forEach(event => {
      window.addEventListener(event, throttledUpdateActivity, { passive: true });
    });

    // Verificar inatividade a cada minuto
    const inactivityInterval = setInterval(checkInactivity, 60000);

    // Verificar ao focar na janela (voltou de outra aba)
    const handleFocus = () => {
      checkInactivity();
    };
    window.addEventListener('focus', handleFocus);

    // Verificar quando a página fica visível novamente
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, throttledUpdateActivity);
      });

      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }

      clearInterval(inactivityInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateActivity, checkInactivity]);

  // Retornar função para atualizar manualmente (útil após ações importantes)
  return { updateActivity };
}

/**
 * Inicializa a última atividade no login
 * Deve ser chamado após login bem-sucedido
 * @param userId - ID do usuário logado
 */
export function initializeActivity(userId?: string) {
  try {
    const key = getActivityKey(userId);
    localStorage.setItem(key, Date.now().toString());
  } catch (error) {
    console.warn('Não foi possível inicializar última atividade:', error);
  }
}

/**
 * Limpa o registro de atividade no logout
 * Deve ser chamado antes do logout
 * @param userId - ID do usuário a limpar
 */
export function clearActivity(userId?: string) {
  try {
    const key = getActivityKey(userId);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Não foi possível limpar última atividade:', error);
  }
}
