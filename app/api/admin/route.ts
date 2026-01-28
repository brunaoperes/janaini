import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { auditCreate, auditUpdate, auditDelete, type ModuloAudit } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const dynamic = 'force-dynamic';

// Mapeamento de tabela para módulo de auditoria
const tabelaParaModulo: Record<string, ModuloAudit> = {
  clientes: 'Clientes',
  colaboradores: 'Usuarios',
  servicos: 'Servicos',
  formas_pagamento: 'Sistema',
  usuarios: 'Usuarios',
  lancamentos: 'Lancamentos',
  agendamentos: 'Agenda',
  pacotes: 'Lancamentos',
  pacote_usos: 'Lancamentos',
};

// Helper para obter dados do usuário autenticado
async function getAuthUser() {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('nome, role')
      .eq('id', user.id)
      .single();

    return {
      userId: user.id,
      userEmail: user.email || undefined,
      userName: profile?.nome,
      userRole: profile?.role,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tabela = searchParams.get('tabela');
    const id = searchParams.get('id');

    if (!tabela) {
      return errorResponse('Tabela não especificada', 400);
    }

    // Validar tabelas permitidas
    const tabelasPermitidas = ['clientes', 'colaboradores', 'servicos', 'formas_pagamento', 'usuarios', 'lancamentos', 'agendamentos', 'pacotes', 'pacote_usos'];
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

    const tabelasPermitidas = ['clientes', 'colaboradores', 'servicos', 'formas_pagamento', 'usuarios', 'lancamentos', 'agendamentos', 'pacotes', 'pacote_usos'];
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

    // Registrar auditoria
    const authUser = await getAuthUser();
    if (authUser && data) {
      await auditCreate({
        ...authUser,
        modulo: tabelaParaModulo[tabela] || 'Sistema',
        tabela,
        registroId: data.id,
        dadosNovo: data,
        metodo: 'POST',
        endpoint: '/api/admin',
      });
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

    const tabelasPermitidas = ['clientes', 'colaboradores', 'servicos', 'formas_pagamento', 'usuarios', 'lancamentos', 'agendamentos', 'pacotes', 'pacote_usos'];
    if (!tabelasPermitidas.includes(tabela)) {
      return errorResponse('Tabela não permitida', 403);
    }

    // Buscar dados anteriores para auditoria
    const { data: dadosAnterior } = await supabase
      .from(tabela)
      .select('*')
      .eq('id', id)
      .single();

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

    // Registrar auditoria
    const authUser = await getAuthUser();
    if (authUser && data) {
      await auditUpdate({
        ...authUser,
        modulo: tabelaParaModulo[tabela] || 'Sistema',
        tabela,
        registroId: id,
        dadosAnterior: dadosAnterior || {},
        dadosNovo: data,
        metodo: 'PUT',
        endpoint: '/api/admin',
      });
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

    const tabelasPermitidas = ['clientes', 'colaboradores', 'servicos', 'formas_pagamento', 'usuarios', 'lancamentos', 'agendamentos', 'pacotes', 'pacote_usos'];
    if (!tabelasPermitidas.includes(tabela)) {
      return errorResponse('Tabela não permitida', 403);
    }

    const idNum = parseInt(id, 10);

    // Buscar dados anteriores para auditoria
    const { data: dadosAnterior } = await supabase
      .from(tabela)
      .select('*')
      .eq('id', idNum)
      .single();

    const { error } = await supabase
      .from(tabela)
      .delete()
      .eq('id', idNum);

    if (error) {
      console.error(`Erro ao deletar de ${tabela}:`, error);
      return errorResponse(error.message, 500);
    }

    // Registrar auditoria
    const authUser = await getAuthUser();
    if (authUser && dadosAnterior) {
      await auditDelete({
        ...authUser,
        modulo: tabelaParaModulo[tabela] || 'Sistema',
        tabela,
        registroId: idNum,
        dadosAnterior,
        metodo: 'DELETE',
        endpoint: '/api/admin',
      });
    }

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error('Erro na API admin DELETE:', error);
    return errorResponse(error.message, 500);
  }
}
