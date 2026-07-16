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
  return createPortal(children, document.body);
}
