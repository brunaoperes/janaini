import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Clientes V2 — busca e paginação NO SERVIDOR. Agrega histórico (atendimentos, total gasto,
// último atendimento) numa ÚNICA query de lançamentos por página (sem N+1). SOMENTE admin.
const n = (v: unknown) => Number(v) || 0;

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const p = new URL(request.url).searchParams;
  const page = Math.max(1, Number(p.get('page') || 1));
  const limit = Math.min(100, Math.max(5, Number(p.get('limit') || 30)));
  const search = (p.get('search') || '').trim();
  const from = (page - 1) * limit;

  // página de clientes (com contagem total)
  let q = supabase.from('clientes').select('id, nome, telefone, aniversario, created_at', { count: 'exact' });
  if (search) q = q.or(`nome.ilike.%${search}%,telefone.ilike.%${search}%`);
  q = q.order('nome', { ascending: true }).range(from, from + limit - 1);
  const { data: clientes, count, error } = await q;
  if (error) return errorResponse(error.message, 500);

  // agregação do histórico: UMA query dos lançamentos válidos dos clientes da página
  const ids = (clientes || []).map((c) => c.id);
  const acc: Record<number, { atendimentos: number; totalGasto: number; ultimo: string | null }> = {};
  if (ids.length) {
    const { data: lancs } = await supabase
      .from('lancamentos')
      .select('cliente_id, valor_total, data, status, is_fiado, is_troca_gratis')
      .in('cliente_id', ids)
      .eq('status', 'concluido')
      .eq('is_fiado', false)
      .eq('is_troca_gratis', false);
    for (const l of lancs || []) {
      const id = l.cliente_id as number;
      if (!id) continue;
      (acc[id] ||= { atendimentos: 0, totalGasto: 0, ultimo: null });
      acc[id].atendimentos += 1;
      acc[id].totalGasto += n(l.valor_total);
      if (l.data && (!acc[id].ultimo || l.data > acc[id].ultimo!)) acc[id].ultimo = l.data;
    }
  }

  const itens = (clientes || []).map((c) => {
    const a = acc[c.id] || { atendimentos: 0, totalGasto: 0, ultimo: null };
    return { id: c.id, nome: c.nome, telefone: c.telefone, aniversario: c.aniversario, atendimentos: a.atendimentos, totalGasto: a.totalGasto, ultimo: a.ultimo };
  });

  return jsonResponse({
    itens,
    paginacao: { page, limit, total: count || 0, paginas: Math.ceil((count || 0) / limit) },
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  let body: any;
  try { body = await request.json(); } catch { return errorResponse('Corpo inválido.', 400); }
  const nome = (body?.nome || '').trim();
  const telefone = (body?.telefone || '').trim();
  const aniversario = (body?.aniversario || '').trim() || null;
  if (!nome) return errorResponse('Nome é obrigatório.', 400);
  if (!telefone) return errorResponse('Telefone é obrigatório.', 400);

  const { data, error } = await supabase
    .from('clientes')
    .insert({ nome, telefone, aniversario })
    .select('id, nome, telefone, aniversario, created_at')
    .single();
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ cliente: data });
}
