import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Categorias de despesa (fixa/variável). SOMENTE admin.
export async function GET() {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const { data, error } = await supabase.from('categorias_despesa').select('*').order('tipo').order('nome');
  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ categorias: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const { nome, tipo } = await request.json();
  if (!nome || nome.trim().length < 2) return errorResponse('Informe um nome de categoria válido.', 400);
  const dados = { nome: nome.trim(), tipo: tipo === 'fixa' ? 'fixa' : 'variavel' };
  const { data, error } = await supabase.from('categorias_despesa').insert(dados).select().single();
  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ data });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID é obrigatório.', 400);
  const body = await request.json();
  const patch: Record<string, any> = {};
  if (body.nome !== undefined) patch.nome = String(body.nome).trim();
  if (body.tipo !== undefined) patch.tipo = body.tipo === 'fixa' ? 'fixa' : 'variavel';
  if (body.ativo !== undefined) patch.ativo = !!body.ativo;
  const { data, error } = await supabase.from('categorias_despesa').update(patch).eq('id', id).select().single();
  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID é obrigatório.', 400);
  // se já usada em despesas, apenas desativa (preserva histórico)
  const { data: usos } = await supabase.from('despesas').select('id').eq('categoria_id', id).limit(1);
  if (usos && usos.length > 0) {
    const { error } = await supabase.from('categorias_despesa').update({ ativo: false }).eq('id', id);
    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ desativada: true, message: 'Categoria já usada — foi desativada.' });
  }
  const { error } = await supabase.from('categorias_despesa').delete().eq('id', id);
  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ deleted: true });
}
