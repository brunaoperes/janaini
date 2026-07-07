// ============================================================================
// Categoria DERIVADA do serviço (heurística) — NaviBelle V2.
//
// A tabela `servicos` NÃO tem coluna `categoria`. Em vez de inventar dados ou
// exigir migration, a categoria é INFERIDA por palavras-chave do nome + descrição.
// É honesto: o rótulo é uma classificação automática, não um dado cadastrado.
// Usado tanto no servidor (API, para contagem/filtro) quanto no cliente (chips/ícones).
//
// Prioridade de casamento: Pacotes primeiro (um "pacote de cabelo" é Pacote),
// depois Cabelo, Unhas, Sobrancelhas, Estética; sem casar → Outros.
// ============================================================================

export type CategoriaId = 'cabelo' | 'unhas' | 'sobrancelhas' | 'estetica' | 'pacotes' | 'outros';

// Ordem de EXIBIÇÃO dos chips (Outros sempre por último).
export const CATEGORIAS: { id: CategoriaId; label: string }[] = [
  { id: 'cabelo', label: 'Cabelo' },
  { id: 'unhas', label: 'Unhas' },
  { id: 'sobrancelhas', label: 'Sobrancelhas' },
  { id: 'estetica', label: 'Estética' },
  { id: 'pacotes', label: 'Pacotes' },
  { id: 'outros', label: 'Outros' },
];

export const LABEL_CAT: Record<CategoriaId, string> = {
  cabelo: 'Cabelo',
  unhas: 'Unhas',
  sobrancelhas: 'Sobrancelhas',
  estetica: 'Estética',
  pacotes: 'Pacotes',
  outros: 'Outros',
};

// Regras de palavra-chave, na ORDEM de prioridade de casamento.
const REGRAS: { id: CategoriaId; kw: RegExp }[] = [
  { id: 'pacotes', kw: /pacote|combo|\bkit\b|dia da noiva|\bnoiva\b|day\s?spa|promo(?:c|ç)/i },
  { id: 'cabelo', kw: /cabelo|corte|colora|\bcor\b|escova|mecha|luzes|\bluz\b|botox|hidrata|progressiva|selagem|reconstru|tintura|matiz|nutri|cauteriz|alisa|penteado|chapinha|babyliss|franja|barba|qu[íi]mica|relaxamento|def(?:i|í)ni(?:c|ç)/i },
  { id: 'unhas', kw: /unha|\bm[ãa]o|\bp[ée]s?\b|\bgel\b|esmalt|alongamento|manicure|pedicure|post(?:i|í)(?:c|ç)a|fibra|acrigel|banho de gel|cut(?:í|i)cula|spa dos p/i },
  { id: 'sobrancelhas', kw: /sobrancelha|henna|design|\bbrow\b|micropigment|bu(?:ç|c)o|bigode|\blash|c(?:í|i)lios|fio a fio/i },
  { id: 'estetica', kw: /pele|limpeza|peeling|facial|est(?:é|e)tica|depila|massagem|drenagem|corporal|\bspa\b|microagulha|revitaliza|dermo|argila|m(?:á|a)scara facial/i },
];

/** Infere a categoria a partir do nome (e descrição opcional). Nunca lança. */
export function derivarCategoria(nome?: string | null, descricao?: string | null): CategoriaId {
  const t = `${nome || ''} ${descricao || ''}`;
  for (const r of REGRAS) if (r.kw.test(t)) return r.id;
  return 'outros';
}
