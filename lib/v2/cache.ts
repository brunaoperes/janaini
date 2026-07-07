// Cache client-side em memória (RAM apenas) para as telas V2.
//
// Objetivo: stale-while-revalidate — ao reabrir uma tela já vista, mostrar os
// últimos dados NA HORA (sem skeleton) e revalidar em segundo plano.
//
// - Vive a nível de módulo: sobrevive à navegação SPA entre as telas /v2.
// - Zera no reload da página (aceitável — e evita persistir dados financeiros
//   no disco; por isso NÃO usa localStorage/sessionStorage).
// - A chave DEVE ser a URL completa (com a querystring dos filtros), para que
//   cada combinação de filtros tenha seu próprio cache.

type Entry = { data: unknown; ts: number };

const mem = new Map<string, Entry>();

/** Retorna o dado cacheado desta chave, ou `undefined` se nunca foi visto. */
export function getCache<T>(key: string): T | undefined {
  return mem.get(key)?.data as T | undefined;
}

/** Guarda o dado desta chave (chave = URL completa com filtros). */
export function setCache(key: string, data: unknown): void {
  mem.set(key, { data, ts: Date.now() });
}

/**
 * Invalida o cache. Sem `prefix`, limpa tudo. Com `prefix`, remove só as chaves
 * que começam com ele (ex.: `/api/v2/` após uma mutação, para a revalidação
 * seguinte trazer o dado novo em vez de mostrar o antigo).
 */
export function invalidateCache(prefix?: string): void {
  if (!prefix) { mem.clear(); return; }
  for (const k of mem.keys()) if (k.startsWith(prefix)) mem.delete(k);
}
