/**
 * Sistema de Permissões - Naví Belle
 * Define todas as permissões disponíveis e suas associações por role
 */

// Constantes de permissões
export const PERMISSIONS = {
  // Permissões de Admin
  MANAGE_USERS: 'manage_users',
  MANAGE_COMMISSIONS: 'manage_commissions',
  VIEW_ALL_COMMISSIONS: 'view_all_commissions',
  ACCESS_ADMIN: 'access_admin',
  MANAGE_SERVICES: 'manage_services',
  MANAGE_COLLABORATORS: 'manage_collaborators',
  MANAGE_PAYMENTS: 'manage_payments',
  VIEW_REPORTS: 'view_reports',

  // Permissões de Usuário
  CREATE_APPOINTMENTS: 'create_appointments',
  CREATE_TRANSACTIONS: 'create_transactions',
  VIEW_APPOINTMENTS: 'view_appointments',
  VIEW_SERVICES: 'view_services',
  EDIT_SERVICE_VALUES: 'edit_service_values',
  VIEW_OWN_COMMISSION: 'view_own_commission',
  VIEW_CLIENTS: 'view_clients',
  CREATE_CLIENTS: 'create_clients',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export type Role = 'admin' | 'user';

// Mapeamento de permissões por role
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: Object.values(PERMISSIONS), // Admin tem todas as permissões
  user: [
    PERMISSIONS.CREATE_APPOINTMENTS,
    PERMISSIONS.CREATE_TRANSACTIONS,
    PERMISSIONS.VIEW_APPOINTMENTS,
    PERMISSIONS.VIEW_SERVICES,
    PERMISSIONS.EDIT_SERVICE_VALUES,
    PERMISSIONS.VIEW_OWN_COMMISSION,
    PERMISSIONS.VIEW_CLIENTS,
    PERMISSIONS.CREATE_CLIENTS,
  ],
};

/**
 * Verifica se um role tem uma permissão específica
 */
export function hasPermission(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Verifica se um role tem todas as permissões listadas
 */
export function hasAllPermissions(role: Role | undefined | null, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Verifica se um role tem pelo menos uma das permissões listadas
 */
export function hasAnyPermission(role: Role | undefined | null, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Rotas que requerem acesso de admin
 */
export const ADMIN_ROUTES = [
  '/admin',
  '/admin/usuarios',
  '/admin/colaboradores',
  '/admin/servicos',
  '/admin/pagamentos',
  '/admin/relatorios',
  '/admin/clientes',
  '/admin/dashboard',
];

/**
 * Verifica se uma rota requer acesso de admin
 */
export function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Rotas públicas (não requerem autenticação)
 */
export const PUBLIC_ROUTES = [
  '/login',
  '/acesso-negado',
];

/**
 * Verifica se uma rota é pública
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}
