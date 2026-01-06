'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface HealthCheckState {
  isHealthy: boolean;
  isChecking: boolean;
  lastCheck: Date | null;
  retryCount: number;
  consecutiveFailures: number;
}

const HEALTH_CHECK_INTERVAL = 30000; // 30 segundos
const MAX_CONSECUTIVE_FAILURES = 2; // Mostrar overlay após 2 falhas consecutivas

export function useHealthCheck() {
  const [state, setState] = useState<HealthCheckState>({
    isHealthy: true,
    isChecking: false,
    lastCheck: null,
    retryCount: 0,
    consecutiveFailures: 0,
  });

  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  const checkHealth = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    setState((prev) => ({ ...prev, isChecking: true }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout

      const response = await fetch('/api/health', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setState((prev) => ({
          ...prev,
          isHealthy: true,
          isChecking: false,
          lastCheck: new Date(),
          consecutiveFailures: 0,
        }));
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      setState((prev) => {
        const newFailures = prev.consecutiveFailures + 1;
        return {
          ...prev,
          isHealthy: newFailures < MAX_CONSECUTIVE_FAILURES,
          isChecking: false,
          lastCheck: new Date(),
          consecutiveFailures: newFailures,
        };
      });
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  const manualRetry = useCallback(async () => {
    setState((prev) => ({ ...prev, retryCount: prev.retryCount + 1 }));
    await checkHealth();
  }, [checkHealth]);

  // Verificação inicial e periódica
  useEffect(() => {
    // Verificação inicial após 2 segundos (dá tempo do app carregar)
    const initialTimeout = setTimeout(() => {
      checkHealth();
    }, 2000);

    // Verificação periódica
    checkIntervalRef.current = setInterval(() => {
      checkHealth();
    }, HEALTH_CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkHealth]);

  // Verificar quando a janela volta ao foco (usuário voltou para a aba)
  useEffect(() => {
    const handleFocus = () => {
      checkHealth();
    };

    const handleOnline = () => {
      checkHealth();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [checkHealth]);

  return {
    isHealthy: state.isHealthy,
    isChecking: state.isChecking,
    retryCount: state.retryCount,
    checkHealth: manualRetry,
  };
}

// Hook para interceptar erros de fetch globalmente
export function useGlobalFetchErrorHandler() {
  const [hasError, setHasError] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reportError = useCallback(() => {
    setErrorCount((prev) => {
      const newCount = prev + 1;
      if (newCount >= 3) {
        setHasError(true);
      }
      return newCount;
    });

    // Resetar contador após 10 segundos sem erros
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setErrorCount(0);
    }, 10000);
  }, []);

  const clearError = useCallback(() => {
    setHasError(false);
    setErrorCount(0);
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  return { hasError, reportError, clearError };
}
