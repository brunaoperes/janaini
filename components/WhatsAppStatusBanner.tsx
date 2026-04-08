'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface WhatsAppStatus {
  connected: boolean;
  erros: number;
}

export default function WhatsAppStatusBanner() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    verificarStatus();
  }, []);

  async function verificarStatus() {
    try {
      const [configRes, statsRes] = await Promise.all([
        fetch('/api/admin/whatsapp?secao=config'),
        fetch('/api/admin/whatsapp?secao=stats'),
      ]);

      if (!configRes.ok || !statsRes.ok) return;

      const configData = await configRes.json();
      const statsData = await statsRes.json();

      setStatus({
        connected: configData.config?.zapi_connected ?? true,
        erros: statsData.stats?.erros ?? 0,
      });
    } catch {
      // Silencioso - não atrapalha a página principal
    }
  }

  if (!status || dismissed) return null;

  const temProblema = !status.connected || status.erros > 0;
  if (!temProblema) return null;

  return (
    <div className={`border-b ${!status.connected
      ? 'bg-red-50 border-red-200'
      : 'bg-amber-50 border-amber-200'
    }`}>
      <div className="container mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            !status.connected ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            <svg className={`w-4 h-4 ${!status.connected ? 'text-red-600' : 'text-amber-600'}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              {!status.connected && (
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              )}
            </svg>
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${!status.connected ? 'text-red-800' : 'text-amber-800'}`}>
              {!status.connected
                ? 'WhatsApp desconectado — mensagens nao estao sendo enviadas'
                : `${status.erros} mensagem(ns) com erro de envio`
              }
            </p>
            <p className={`text-xs ${!status.connected ? 'text-red-600' : 'text-amber-600'}`}>
              {!status.connected
                ? 'Reconecte a instancia Z-API para retomar os envios automaticos'
                : 'Verifique o historico de mensagens para mais detalhes'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/admin/whatsapp"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !status.connected
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-amber-600 text-white hover:bg-amber-700'
            }`}
          >
            Ver detalhes
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className={`p-1 rounded-lg transition-colors ${
              !status.connected
                ? 'text-red-400 hover:text-red-600 hover:bg-red-100'
                : 'text-amber-400 hover:text-amber-600 hover:bg-amber-100'
            }`}
            title="Fechar alerta"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
