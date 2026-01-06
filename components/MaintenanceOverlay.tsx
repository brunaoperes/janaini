'use client';

import { useState, useEffect } from 'react';

interface MaintenanceOverlayProps {
  isVisible: boolean;
  onRetry: () => void;
  retryCount: number;
}

export default function MaintenanceOverlay({ isVisible, onRetry, retryCount }: MaintenanceOverlayProps) {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (!isVisible) return;

    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRetry();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, onRetry, retryCount]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-fade-in">
        {/* Ícone animado */}
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-purple-600 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </div>

        {/* Título */}
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          Sistema em Atualização
        </h2>

        {/* Mensagem */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          O sistema está sendo atualizado para melhorar sua experiência.
          Por favor, aguarde alguns instantes.
        </p>

        {/* Barra de progresso */}
        <div className="mb-6">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000"
              style={{ width: `${((30 - countdown) / 30) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Tentando reconectar em {countdown} segundos...
          </p>
        </div>

        {/* Contador de tentativas */}
        {retryCount > 0 && (
          <p className="text-xs text-gray-400 mb-4">
            Tentativa {retryCount} de reconexão
          </p>
        )}

        {/* Botão de tentar novamente */}
        <button
          onClick={onRetry}
          className="w-full py-3 px-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Tentar Agora
        </button>

        {/* Dica */}
        <p className="text-xs text-gray-400 mt-4">
          Se o problema persistir, tente atualizar a página (F5)
        </p>
      </div>
    </div>
  );
}
