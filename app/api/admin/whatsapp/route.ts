import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET: Retorna templates + histórico de mensagens
export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if (isAuthError(authResult)) return authResult;

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  const secao = searchParams.get('secao') || 'templates';

  if (secao === 'templates') {
    const { data: templates, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates });
  }

  // Histórico de mensagens
  const tipo = searchParams.get('tipo');
  const status = searchParams.get('status');
  const dataInicio = searchParams.get('dataInicio');
  const dataFim = searchParams.get('dataFim');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('mensagens_whatsapp')
    .select('*, clientes(nome)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tipo && tipo !== 'todos') {
    query = query.eq('tipo', tipo);
  }
  if (status && status !== 'todos') {
    query = query.eq('status', status);
  }
  if (dataInicio) {
    query = query.gte('created_at', `${dataInicio}T00:00:00`);
  }
  if (dataFim) {
    query = query.lte('created_at', `${dataFim}T23:59:59`);
  }

  const { data: mensagens, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    mensagens,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

// PUT: Atualizar template
export async function PUT(request: Request) {
  const authResult = await requireAdmin();
  if (isAuthError(authResult)) return authResult;

  const supabase = getSupabase();
  const body = await request.json();
  const { id, template, ativo } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID do template é obrigatório' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (template !== undefined) updateData.template = template;
  if (ativo !== undefined) updateData.ativo = ativo;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nenhum dado para atualizar' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('whatsapp_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}
