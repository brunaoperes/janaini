import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente com service role para bypass de RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Tipos de ação
export type AcaoAudit = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS_DENIED';

// Módulos do sistema
export type ModuloAudit = 'Agenda' | 'Lancamentos' | 'Usuarios' | 'Servicos' | 'Clientes' | 'Comissoes' | 'Auth' | 'Sistema';

// Resultado da operação
export type ResultadoAudit = 'success' | 'error' | 'denied';

// Interface do log de auditoria
export interface AuditLogInput {
  // Identificação do usuário (opcional para alguns casos)
  userId?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;

  // Detalhes da ação
  acao: AcaoAudit;
  modulo: ModuloAudit;
  tabela?: string;
  registroId?: number;

  // Contexto (opcional - será extraído dos headers se não fornecido)
  metodo?: string;
  endpoint?: string;

  // Dados do registro
  dadosAnterior?: Record<string, any> | null;
  dadosNovo?: Record<string, any> | null;
  camposAlterados?: string[];

  // Resultado
  resultado?: ResultadoAudit;
  erroCodigo?: string;
  erroMensagem?: string;
}

/**
 * Extrai informações do contexto da requisição
 */
async function extrairContexto() {
  try {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      || headersList.get('x-real-ip')
      || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Detectar plataforma baseado no user-agent
    let plataforma = 'web';
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      plataforma = 'mobile';
    }

    return { ip, userAgent, plataforma };
  } catch {
    return { ip: 'unknown', userAgent: 'unknown', plataforma: 'unknown' };
  }
}

/**
 * Calcula quais campos foram alterados entre dois objetos
 */
function calcularCamposAlterados(anterior: Record<string, any> | null, novo: Record<string, any> | null): string[] {
  if (!anterior || !novo) return [];

  const campos: string[] = [];
  const todasChaves = new Set([...Object.keys(anterior), ...Object.keys(novo)]);

  for (const chave of todasChaves) {
    // Ignorar campos de metadados
    if (['created_at', 'updated_at', 'id'].includes(chave)) continue;

    const valorAnterior = JSON.stringify(anterior[chave]);
    const valorNovo = JSON.stringify(novo[chave]);

    if (valorAnterior !== valorNovo) {
      campos.push(chave);
    }
  }

  return campos;
}

/**
 * Registra um log de auditoria no banco de dados
 *
 * @param input - Dados do log de auditoria
 * @returns Promise<void>
 *
 * @example
 * ```ts
 * await registrarAudit({
 *   userId: user.id,
 *   userEmail: user.email,
 *   userName: profile.nome,
 *   userRole: profile.role,
 *   acao: 'CREATE',
 *   modulo: 'Lancamentos',
 *   tabela: 'lancamentos',
 *   registroId: lancamento.id,
 *   dadosNovo: lancamento,
 *   resultado: 'success',
 * });
 * ```
 */
export async function registrarAudit(input: AuditLogInput): Promise<void> {
  try {
    const contexto = await extrairContexto();

    // Calcular campos alterados se não fornecido
    const camposAlterados = input.camposAlterados
      || calcularCamposAlterados(input.dadosAnterior || null, input.dadosNovo || null);

    const logData = {
      user_id: input.userId || null,
      usuario_email: input.userEmail || null,
      usuario_nome: input.userName || null,
      usuario_role: input.userRole || null,
      acao: input.acao,
      modulo: input.modulo,
      tabela: input.tabela || null,
      registro_id: input.registroId || null,
      metodo: input.metodo || null,
      endpoint: input.endpoint || null,
      ip_origem: contexto.ip,
      user_agent: contexto.userAgent,
      plataforma: contexto.plataforma,
      dados_anterior: input.dadosAnterior || null,
      dados_novo: input.dadosNovo || null,
      campos_alterados: camposAlterados.length > 0 ? camposAlterados : null,
      resultado: input.resultado || 'success',
      erro_codigo: input.erroCodigo || null,
      erro_mensagem: input.erroMensagem || null,
    };

    const { error } = await supabaseAdmin
      .from('audit_logs')
      .insert(logData);

    if (error) {
      // Log apenas no console para não afetar a operação principal
      console.error('[Audit] Erro ao registrar log:', error.message);
    }
  } catch (err) {
    // Nunca deixar erro de auditoria afetar a operação principal
    console.error('[Audit] Erro inesperado:', err);
  }
}

/**
 * Registra um acesso negado
 */
export async function registrarAcessoNegado(input: {
  userId?: string;
  userEmail?: string;
  endpoint: string;
  motivo: string;
}): Promise<void> {
  await registrarAudit({
    userId: input.userId,
    userEmail: input.userEmail,
    acao: 'ACCESS_DENIED',
    modulo: 'Auth',
    endpoint: input.endpoint,
    resultado: 'denied',
    erroMensagem: input.motivo,
  });
}

/**
 * Registra um login bem-sucedido
 */
export async function registrarLogin(input: {
  userId: string;
  userEmail: string;
  userName?: string;
  userRole?: string;
}): Promise<void> {
  await registrarAudit({
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    userRole: input.userRole,
    acao: 'LOGIN',
    modulo: 'Auth',
    resultado: 'success',
  });
}

/**
 * Registra um logout
 */
export async function registrarLogout(input: {
  userId: string;
  userEmail?: string;
}): Promise<void> {
  await registrarAudit({
    userId: input.userId,
    userEmail: input.userEmail,
    acao: 'LOGOUT',
    modulo: 'Auth',
    resultado: 'success',
  });
}

/**
 * Helper para criar um log de CREATE
 */
export async function auditCreate(input: {
  userId?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  modulo: ModuloAudit;
  tabela: string;
  registroId: number;
  dadosNovo: Record<string, any>;
  metodo?: string;
  endpoint?: string;
}): Promise<void> {
  await registrarAudit({
    ...input,
    acao: 'CREATE',
    resultado: 'success',
  });
}

/**
 * Helper para criar um log de UPDATE
 */
export async function auditUpdate(input: {
  userId?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  modulo: ModuloAudit;
  tabela: string;
  registroId: number;
  dadosAnterior: Record<string, any>;
  dadosNovo: Record<string, any>;
  metodo?: string;
  endpoint?: string;
}): Promise<void> {
  await registrarAudit({
    ...input,
    acao: 'UPDATE',
    resultado: 'success',
  });
}

/**
 * Helper para criar um log de DELETE
 */
export async function auditDelete(input: {
  userId?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  modulo: ModuloAudit;
  tabela: string;
  registroId: number;
  dadosAnterior: Record<string, any>;
  metodo?: string;
  endpoint?: string;
}): Promise<void> {
  await registrarAudit({
    ...input,
    acao: 'DELETE',
    resultado: 'success',
  });
}

/**
 * Helper para registrar erro em uma operação
 */
export async function auditError(input: {
  userId?: string;
  userEmail?: string;
  acao: AcaoAudit;
  modulo: ModuloAudit;
  tabela?: string;
  registroId?: number;
  erroCodigo: string;
  erroMensagem: string;
  metodo?: string;
  endpoint?: string;
}): Promise<void> {
  await registrarAudit({
    ...input,
    resultado: 'error',
  });
}
