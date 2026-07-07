// Navegação da V2. Os ícones referenciam nomes do lucide-react (resolvidos em components/v2/ui/Icon).

export type NavItem = { label: string; href: string; icon: string };

/** Menu lateral principal (espelha o mockup aprovado). */
export const NAV_MAIN: NavItem[] = [
  { label: 'Dashboard', href: '/v2/dashboard', icon: 'LayoutDashboard' },
  { label: 'Agenda', href: '/v2/agenda', icon: 'CalendarDays' },
  { label: 'Lançamentos', href: '/v2/lancamentos', icon: 'ReceiptText' },
  { label: 'Clientes', href: '/v2/clientes', icon: 'Users' },
  { label: 'Colaboradoras', href: '/v2/colaboradoras', icon: 'UserCog' },
  { label: 'Serviços', href: '/v2/servicos', icon: 'Scissors' },
  { label: 'Financeiro', href: '/v2/financeiro', icon: 'Wallet' },
  { label: 'Comissões', href: '/v2/comissoes', icon: 'HandCoins' },
  { label: 'Relatórios', href: '/v2/relatorios', icon: 'ChartColumnIncreasing' },
  { label: 'Estoque', href: '/v2/estoque', icon: 'Package' },
  { label: 'WhatsApp', href: '/v2/whatsapp', icon: 'MessageCircle' },
  { label: 'Configurações', href: '/v2/configuracoes', icon: 'Settings' },
];

/** Rodapé do menu. */
export const NAV_FOOT: NavItem[] = [
  { label: 'Painel de Gestão', href: '/v2/admin', icon: 'LayoutGrid' },
  { label: 'Ajuda e Suporte', href: '/v2/configuracoes', icon: 'CircleHelp' },
];

/**
 * Agrupamento do Painel de Gestão por área (Seção 7 da auditoria).
 * `route` aponta para a rota V2 quando existe; itens ainda não migrados podem apontar para null.
 */
export const ADMIN_AREAS: { area: string; icon: string; itens: { label: string; href: string | null; icon: string }[] }[] = [
  {
    area: 'Operação do dia', icon: 'Sun',
    itens: [
      { label: 'Agenda', href: '/v2/agenda', icon: 'CalendarDays' },
      { label: 'Lançamentos', href: '/v2/lancamentos', icon: 'ReceiptText' },
      { label: 'Fechamento de caixa', href: null, icon: 'Calculator' },
      { label: 'Fiados', href: null, icon: 'Clock' },
    ],
  },
  {
    area: 'Financeiro & gestão', icon: 'ChartPie',
    itens: [
      { label: 'Dashboard', href: '/v2/dashboard', icon: 'LayoutDashboard' },
      { label: 'Financeiro / DRE', href: '/v2/financeiro', icon: 'Wallet' },
      { label: 'Comissões', href: '/v2/comissoes', icon: 'HandCoins' },
      { label: 'Relatórios', href: '/v2/relatorios', icon: 'ChartColumnIncreasing' },
      { label: 'Estoque', href: '/v2/estoque', icon: 'Package' },
    ],
  },
  {
    area: 'Cadastros', icon: 'FolderOpen',
    itens: [
      { label: 'Clientes', href: '/v2/clientes', icon: 'Users' },
      { label: 'Colaboradoras', href: '/v2/colaboradoras', icon: 'UserCog' },
      { label: 'Serviços', href: '/v2/servicos', icon: 'Scissors' },
      { label: 'Pacotes', href: null, icon: 'Gift' },
    ],
  },
  {
    area: 'Configuração & sistema', icon: 'SlidersHorizontal',
    itens: [
      { label: 'Usuários', href: null, icon: 'UserPlus' },
      { label: 'Permissões', href: null, icon: 'ShieldCheck' },
      { label: 'Formas de pagamento', href: null, icon: 'CreditCard' },
      { label: 'WhatsApp', href: '/v2/whatsapp', icon: 'MessageCircle' },
      { label: 'Logs de auditoria', href: null, icon: 'ScrollText' },
    ],
  },
];
