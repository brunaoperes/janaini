'use client';

import './theme.css';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/v2/layout/Sidebar';

/**
 * Shell da V2. Isolado da produção:
 *  - herda AuthProvider/Toast do layout raiz (nada é reprovisionado);
 *  - o acesso é restrito a admin AQUI (client-side), sem alterar o middleware;
 *  - todo o tema vive sob .v2-root (theme.css) e não vaza para o resto do app.
 */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!loading && profile && !isAdmin) {
      const t = setTimeout(() => router.replace('/'), 2200);
      return () => clearTimeout(t);
    }
  }, [loading, profile, isAdmin, router]);

  return (
    <div className="v2-root">
      {loading ? (
        <Center>Carregando prévia…</Center>
      ) : !isAdmin ? (
        <Center>
          <div style={{ textAlign: 'center', maxWidth: 380 }}>
            <p style={{ fontFamily: 'var(--nb-serif)', fontSize: 22, margin: '0 0 8px' }}>Prévia V2 restrita</p>
            <p style={{ color: 'var(--nb-ink-soft)', fontSize: 14, margin: 0 }}>Esta versão em desenvolvimento é visível apenas para administradores. Redirecionando…</p>
          </div>
        </Center>
      ) : (
        <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100dvh' }}>
          <Sidebar />
          <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
        </div>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, color: 'var(--nb-ink-soft)' }}>{children}</div>;
}
