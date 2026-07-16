'use client';

import './theme.css';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/v2/layout/Sidebar';
import { V2NavProvider } from '@/components/v2/layout/nav-context';

/**
 * Shell da V2. Isolado da produção:
 *  - herda AuthProvider/Toast do layout raiz (nada é reprovisionado);
 *  - o acesso é restrito a admin AQUI (client-side), sem alterar o middleware;
 *  - todo o tema vive sob .v2-root (theme.css) e não vaza para o resto do app.
 *
 * Sem auto-redirect: enquanto o perfil carrega, mostramos "carregando"; se o perfil
 * chegar e NÃO for admin, mostramos a mensagem restrita (com link manual). Isso evita
 * a race condition anterior, em que um estado transitório expulsava até admins.
 */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const isAdmin = profile?.role === 'admin';
  // Só BLOQUEIA quando há certeza de não-admin (perfil resolvido e role != admin).
  // Se o perfil ainda não resolveu (timeout do AuthContext deixa profile=null com loading=false),
  // renderizamos a casca mesmo assim — as APIs exigem admin, então nada sensível vaza; e assim
  // a tela nunca fica presa em "Carregando".
  const bloqueado = !loading && !!profile && !isAdmin;

  return (
    <div className="v2-root">
      {loading ? (
        <Center>Carregando prévia…</Center>
      ) : bloqueado ? (
        <Center>
          <div style={{ textAlign: 'center', maxWidth: 380 }}>
            <p style={{ fontFamily: 'var(--nb-serif)', fontSize: 22, margin: '0 0 8px' }}>Prévia V2 restrita</p>
            <p style={{ color: 'var(--nb-ink-soft)', fontSize: 14, margin: '0 0 16px' }}>Esta versão em desenvolvimento é visível apenas para administradores.</p>
            <a href="/" className="nb-btn nb-btn-primary" style={{ textDecoration: 'none' }}>Voltar ao sistema</a>
          </div>
        </Center>
      ) : (
        <V2NavProvider>
          <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100dvh' }}>
            <Sidebar />
            <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
          </div>
        </V2NavProvider>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, color: 'var(--nb-ink-soft)' }}>{children}</div>;
}
