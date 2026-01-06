import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const dynamic = 'force-dynamic';

// Buscar clientes (com pesquisa opcional)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = supabase
      .from('clientes')
      .select('*')
      .order('nome');

    if (search) {
      query = query.ilike('nome', `%${search}%`).limit(10);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar clientes:', error);
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ data: data || [] });
  } catch (error: any) {
    console.error('Erro na API de clientes:', error);
    return errorResponse(error.message, 500);
  }
}

// Criar novo cliente
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, telefone, aniversario } = body;

    if (!nome || !telefone) {
      return errorResponse('Nome e telefone são obrigatórios', 400);
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert({ nome, telefone, aniversario: aniversario || null })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar cliente:', error);
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ data });
  } catch (error: any) {
    console.error('Erro na API de clientes POST:', error);
    return errorResponse(error.message, 500);
  }
}
