'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import MaintenanceOverlay from '@/components/MaintenanceOverlay';

interface HealthContextType {
  isHealthy: boolean;
  checkHealth: () => void;
}

const HealthContext = createContext<HealthContextType>({
  isHealthy: true,
  checkHealth: () => {},
});

export function useHealth() {
  return useContext(HealthContext);
}

interface HealthProviderProps {
  children: ReactNode;
}

export function HealthProvider({ children }: HealthProviderProps) {
  const { isHealthy, retryCount, checkHealth } = useHealthCheck();

  return (
    <HealthContext.Provider value={{ isHealthy, checkHealth }}>
      {children}
      <MaintenanceOverlay
        isVisible={!isHealthy}
        onRetry={checkHealth}
        retryCount={retryCount}
      />
    </HealthContext.Provider>
  );
}
