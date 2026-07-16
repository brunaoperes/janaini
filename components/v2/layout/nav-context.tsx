'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type NavCtx = { open: boolean; setOpen: (v: boolean) => void; toggle: () => void };

const Ctx = createContext<NavCtx>({ open: false, setOpen: () => {}, toggle: () => {} });

/** Estado do menu lateral (drawer no mobile). Compartilhado entre Sidebar e Topbar. */
export function V2NavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  return <Ctx.Provider value={{ open, setOpen, toggle }}>{children}</Ctx.Provider>;
}

export const useV2Nav = () => useContext(Ctx);
