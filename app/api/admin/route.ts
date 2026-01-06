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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tabela = searchParams.get('tabela');
    const id = searchParams.get('id');

    if (!tabela) {
      return errorResponse('Tabela não especificada', 400);
    }

    // Validar tabelas permitidas
    const tabelasPermitidas = ['clientes', 'colaboradores', 'servicos', 'formas_pagamento', 'usuarios', 'lancamentos', 'agendamentos'];
    if (!tabelasPermitidas.includes(tabela)) {
      return errorResponse('Tabela não permitida', 403);
    }

    let query = supabase.from(tabela).select('*');

    if (id) {
      query = query.eq('id', parseInt(id, 10));
    }

    // Ordenação padrão por nome ou data
    if (['clientes', 'colaboradores', 'servicos', 'usuarios'].includes(tabela)) {
      query = query.order('nome');
    } else if (tabela === 'formas_pagamento') {
      query = query.order('ordem');
    } else {
      query = query.order('id', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Erro ao carregar ${tabela}:`, error);
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ data: data || [] });
  } catch (error: any) {
    console.error('Erro na API admin:', error);
    return errorResponse(error.message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tabela, dados } = body;

    if (!tabela || !dados) {
      return errorResponse('Tabela e dados são obrigatórios', 400);
    }

    const tabelasPermitidas = ['clientes', 'colaboradores', 'servicos', 'formas_pagamento', 'usuarios', 'lancamentos', 'agendamentos'];
    if (!tabelasPermitidas.includes(tabela)) {
      return errorResponse('Tabela não permitida', 403);
    }

    const { data, error } = await supabase
      .from(tabela)
      .insert(dados)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao inserir em ${tabela}:`, error);
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ data });
  } catch (error: any) {
    console.error('Erro na API admin POST:', error);
    return errorResponse(error.message, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { tabela, id, dados } = body;

    if (!tabela || !id || !dados) {
      return errorResponse('Tabela, id e dados são obrigatórios', 400);
    }

    const tabelasPermitidas = ['clientes', 'colaboradores', 'servicos', 'formas_pagamento', 'usuarios', 'lancamentos', 'agendamentos'];
    if (!tabelasPermitidas.includes(tabela)) {
      return errorResponse('Tabela não permitida', 403);
    }

    const { data, error } = await supabase
      .from(tabela)
      .update(dados)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao atualizar ${tabela}:`, error);
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ data });
  } catch (error: any) {
    console.error('Erro na API admin PUT:', error);
    return errorResponse(error.message, 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tabela = searchParams.get('tabela');
    const id = searchParams.get('id');

    if (!tabela || !id) {
      return errorResponse('Tabela e id são obrigatórios', 400);
    }

    const tabelasPermitidas = ['clientes', 'colaboradores', 'servicos', 'formas_pagamento', 'usuarios', 'lancamentos', 'agendamentos'];
    if (!tabelasPermitidas.includes(tabela)) {
      return errorResponse('Tabela não permitida', 403);
    }

    const { error } = await supabase
      .from(tabela)
      .delete()
      .eq('id', parseInt(id, 10));

    if (error) {
      console.error(`Erro ao deletar de ${tabela}:`, error);
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error('Erro na API admin DELETE:', error);
    return errorResponse(error.message, 500);
  }
}
