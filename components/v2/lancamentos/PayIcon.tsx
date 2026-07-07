'use client';

/**
 * Ícones de forma de pagamento — SVG INLINE premium (sem rede, sem dependência externa).
 * Traço fino (~1.6), cor herdada de `currentColor`, 16–18px. Combina com a paleta V2.
 * Normaliza a forma crua do banco → um dos ícones abaixo.
 */

export type FormaKey = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'fiado' | 'multiplo' | 'outros';

export function normalizaForma(f?: string | null): FormaKey {
  const s = (f || '').toLowerCase();
  if (!s) return 'outros';
  if (s.includes('pix')) return 'pix';
  if (s.includes('deb')) return 'cartao_debito';
  if (s.includes('cred') || s === 'cartao') return 'cartao_credito';
  if (s.includes('din')) return 'dinheiro';
  if (s.includes('fiad')) return 'fiado';
  if (s.includes('mult') || s.includes('/')) return 'multiplo';
  return 'outros';
}

export const NOME_FORMA_UI: Record<FormaKey, string> = {
  pix: 'Pix', cartao_credito: 'Crédito', cartao_debito: 'Débito',
  dinheiro: 'Dinheiro', fiado: 'Fiado', multiplo: 'Múltiplo', outros: 'Outros',
};

const svg = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const ICONS: Record<FormaKey, (s: number) => React.ReactNode> = {
  // Pix — losango com as quatro pontas (marca característica), em traço
  pix: (s) => svg(s, <>
    <path d="M12 3.2 8.6 6.6a2 2 0 0 1-2.83 0L3.2 4" opacity="0" />
    <path d="M12 3.4 20.6 12 12 20.6 3.4 12z" />
    <path d="M8.2 8.2 12 12l3.8-3.8M8.2 15.8 12 12l3.8 3.8" />
  </>),
  // Crédito — cartão com faixa e chip
  cartao_credito: (s) => svg(s, <>
    <rect x="2.5" y="5" width="19" height="14" rx="2.4" />
    <path d="M2.5 9.5h19" />
    <path d="M6 15.5h4" />
  </>),
  // Débito — cartão com faixa e "moeda" (diferencia do crédito)
  cartao_debito: (s) => svg(s, <>
    <rect x="2.5" y="5" width="19" height="14" rx="2.4" />
    <path d="M2.5 9.5h19" />
    <circle cx="17.5" cy="15" r="1.6" />
  </>),
  // Dinheiro — cédula
  dinheiro: (s) => svg(s, <>
    <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
    <circle cx="12" cy="12" r="2.4" />
    <path d="M5.5 9.5h.01M18.5 14.5h.01" />
  </>),
  // Fiado — nota/recibo com relógio
  fiado: (s) => svg(s, <>
    <path d="M6 3.5h7.5L18 8v9.5a1.6 1.6 0 0 1-1.6 1.6H6A1.6 1.6 0 0 1 4.4 17.5V5.1A1.6 1.6 0 0 1 6 3.5Z" />
    <path d="M13 3.6V8h4.4" />
    <circle cx="11" cy="14" r="3" />
    <path d="M11 12.6V14l1 .8" />
  </>),
  // Múltiplo — camadas
  multiplo: (s) => svg(s, <>
    <path d="M12 3.5 21 8l-9 4.5L3 8z" />
    <path d="M3.5 12 12 16.3 20.5 12" />
    <path d="M3.5 15.8 12 20 20.5 15.8" opacity=".55" />
  </>),
  // Outros — círculo genérico
  outros: (s) => svg(s, <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8.5v3.7l2.4 1.4" />
  </>),
};

export default function PayIcon({ forma, size = 17, className }: { forma?: string | null; size?: number; className?: string }) {
  const key = normalizaForma(forma);
  return <span className={className} style={{ display: 'inline-flex', color: 'inherit' }}>{ICONS[key](size)}</span>;
}

/** Label amigável a partir da forma crua (ou 'Múltiplo'). */
export function labelForma(forma?: string | null): string {
  return NOME_FORMA_UI[normalizaForma(forma)];
}
