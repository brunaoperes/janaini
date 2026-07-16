'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renderiza os filhos no document.body — fora de qualquer ancestral com transform/filter/
 * backdrop-blur/contain, que viraria "containing block" e prenderia um overlay position:fixed
 * numa faixa da tela (bug nº1 da checklist). Só monta no cliente, evitando mismatch de hidratação.
 */
export default function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  if (!mounted) return null;
  // Embrulha em .v2-root: portado pro body, o conteúdo sai de dentro do container .v2-root e
  // perderia os tokens do tema (cores/fontes). Reaplicamos aqui. O wrapper não afeta o layout
  // porque os overlays filhos são position:fixed (fora do fluxo).
  return createPortal(<div className="v2-root">{children}</div>, document.body);
}
