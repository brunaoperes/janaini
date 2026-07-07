import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/api-auth';
import { auditCreate, auditUpdate } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Fechamento de caixa diário. SOMENTE admin.
// "Previsto" = o que o sistema registrou por forma de pagamento no dia. "Informado" = o que o
// operador conta na mão. A diferença aponta furo/sobra de caixa.
const n = (v: unknown) => Number(v) || 0;
export const FORMAS = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado', 'outros'] as const;
const normaliza = (f?: string | null) => {
  const s = (f || 'outros').toLowerCase();
  if (s.includes('din')) return 'dinheiro';
  if (s.includes('pix')) return 'pix';
  if (s.includes('deb')) return 'cartao_debito';
  if (s.includes('cred') || s === 'cartao') return 'cartao_credito';
  if (s.includes('fiad')) return 'fiado';
  return (FORMAS as readonly string[]).includes(s) ? s : 'outros';
};

async function previstoDoDia(dia: string) {
  const [lancRes, fiadoRes] = await Promise.all([
    supabase.from('lancamentos').select('valor_total, forma_pagamento, status, is_fiado, is_troca_gratis').gte('data', `${dia}T00:00:00`).lte('data', `${dia}T23:59:59`),
    supabase.from('pagamentos_fiado').select('valor_pago, forma_pagamento').gte('data_pagamento', `${dia}T00:00:00`).lte('data_pagamento', `${dia}T23:59:59`),
  ]);
  const prev: Record<string, number> = Object.fromEntries(FORMAS.map((f) => [f, 0]));
  for (const l of lancRes.data || []) {
    if (l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis) prev[normaliza(l.forma_pagamento)] += n(l.valor_total);
  }
  // fiado recebido no dia entra pela forma com que foi pago (ou "dinheiro" se ausente)
  for (const p of fiadoRes.data || []) prev[normaliza(p.forma_pagamento) === 'fiado' ? 'dinheiro' : normaliza(p.forma_pagamento)] += n(p.valor_pago);
  return prev;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const dia = new URL(request.url).searchParams.get('data') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [{ data: caixa }, previsto] = await Promise.all([
    supabase.from('caixas_diarios').select('*').eq('data', dia).maybeSingle(),
    previstoDoDia(dia),
  ]);
  // histórico recente
  const { data: historico } = await supabase.from('caixas_diarios').select('data, total_previsto, total_informado, diferenca, status').order('data', { ascending: false }).limit(10);
  return jsonResponse({ data: dia, caixa, previsto, historico: historico || [] });
}

// POST: fecha o caixa do dia com os valores informados
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const body = await request.json();
  const dia: string = body.data;
  if (!dia) return errorResponse('Data é obrigatória.', 400);
  const informado: Record<string, number> = {};
  for (const f of FORMAS) informado[f] = n(body.informado?.[f]);
  const previsto = await previstoDoDia(dia);

  const totalPrev = Object.values(previsto).reduce((s, v) => s + v, 0);
  const totalInf = Object.values(informado).reduce((s, v) => s + v, 0);
  const dados = {
    data: dia, responsavel_nome: auth.profile.nome || auth.profile.username || 'Admin',
    previsto, informado, total_previsto: totalPrev, total_informado: totalInf, diferenca: totalInf - totalPrev,
    status: 'fechado', observacoes: body.observacoes || null, fechado_em: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('caixas_diarios').upsert(dados, { onConflict: 'data' }).select().single();
  if (error) return errorResponse(error.message, 500);
  try { await auditCreate({ userId: auth.profile.id, userName: dados.responsavel_nome, modulo: 'Sistema', tabela: 'caixas_diarios', registroId: data.id, dadosNovo: data, metodo: 'POST', endpoint: '/api/v2/caixa' }); } catch { /* */ }
  return jsonResponse({ data });
}

// PUT: reabre o caixa (registra em log; não bloqueia — apenas sinaliza)
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const dia = new URL(request.url).searchParams.get('data');
  if (!dia) return errorResponse('Data é obrigatória.', 400);
  const { data: atual } = await supabase.from('caixas_diarios').select('*').eq('data', dia).maybeSingle();
  if (!atual) return errorResponse('Não há caixa fechado nesta data.', 404);
  const { data, error } = await supabase.from('caixas_diarios').update({ status: 'reaberto', updated_at: new Date().toISOString() }).eq('data', dia).select().single();
  if (error) return errorResponse(error.message, 500);
  try { await auditUpdate({ userId: auth.profile.id, userName: auth.profile.nome || 'Admin', modulo: 'Sistema', tabela: 'caixas_diarios', registroId: data.id, dadosAnterior: atual, dadosNovo: data, metodo: 'PUT', endpoint: '/api/v2/caixa' }); } catch { /* */ }
  return jsonResponse({ data });
}
