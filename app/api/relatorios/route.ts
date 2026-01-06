import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

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

// Função para obter o perfil do usuário autenticado
async function getUserProfile() {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, colaborador_id')
      .eq('id', user.id)
      .single();

    return profile;
  } catch {
    return null;
  }
}

// Função para filtrar comissões baseado nas permissões
function filterComissoes(lancamentos: any[], isAdmin: boolean, userColaboradorId: number | null) {
  if (isAdmin) {
    return lancamentos.map(lanc => ({ ...lanc, _canViewComissao: true }));
  }

  if (userColaboradorId) {
    return lancamentos.map(lanc => ({
      ...lanc,
      comissao_colaborador: lanc.colaborador_id === userColaboradorId ? lanc.comissao_colaborador : null,
      comissao_salao: lanc.colaborador_id === userColaboradorId ? lanc.comissao_salao : null,
      _canViewComissao: lanc.colaborador_id === userColaboradorId,
    }));
  }

  // Usuário sem vínculo não vê nenhuma comissão
  return lancamentos.map(lanc => ({
    ...lanc,
    comissao_colaborador: null,
    comissao_salao: null,
    _canViewComissao: false,
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const startDateAnterior = searchParams.get('startDateAnterior');
    const endDateAnterior = searchParams.get('endDateAnterior');
    const colaboradorId = searchParams.get('colaboradorId');
    const pagamento = searchParams.get('pagamento');

    // Obter perfil do usuário para filtrar comissões
    const userProfile = await getUserProfile();
    const isAdmin = userProfile?.role === 'admin';
    const userColaboradorId = userProfile?.colaborador_id;

    // Carregar colaboradores
    const { data: colaboradores } = await supabase
      .from('colaboradores')
      .select('*')
      .order('nome');

    // Query principal de lançamentos
    let query = supabase
      .from('lancamentos')
      .select(`
        *,
        colaboradores(nome, porcentagem_comissao),
        clientes(nome, telefone)
      `)
      .gte('data', startDate)
      .lte('data', endDate)
      .order('data', { ascending: false });

    if (colaboradorId && colaboradorId !== 'todos') {
      query = query.eq('colaborador_id', parseInt(colaboradorId, 10));
    }

    if (pagamento && pagamento !== 'todos') {
      query = query.eq('forma_pagamento', pagamento);
    }

    const { data: lancamentos, error } = await query;

    if (error) {
      console.error('Erro ao carregar lançamentos:', error);
      return errorResponse(error.message, 500);
    }

    // Query período anterior
    let queryAnterior = supabase
      .from('lancamentos')
      .select(`
        *,
        colaboradores(nome, porcentagem_comissao),
        clientes(nome, telefone)
      `)
      .gte('data', startDateAnterior)
      .lte('data', endDateAnterior)
      .order('data', { ascending: false });

    if (colaboradorId && colaboradorId !== 'todos') {
      queryAnterior = queryAnterior.eq('colaborador_id', parseInt(colaboradorId, 10));
    }

    if (pagamento && pagamento !== 'todos') {
      queryAnterior = queryAnterior.eq('forma_pagamento', pagamento);
    }

    const { data: lancamentosAnterior } = await queryAnterior;

    // Filtrar comissões baseado nas permissões do usuário
    const lancamentosFiltrados = filterComissoes(lancamentos || [], isAdmin, userColaboradorId);
    const lancamentosAnteriorFiltrados = filterComissoes(lancamentosAnterior || [], isAdmin, userColaboradorId);

    return jsonResponse({
      lancamentos: lancamentosFiltrados,
      lancamentosAnterior: lancamentosAnteriorFiltrados,
      colaboradores: colaboradores || [],
      _userProfile: {
        isAdmin,
        colaboradorId: userColaboradorId,
      },
    });
  } catch (error: any) {
    console.error('Erro na API de relatórios:', error);
    return errorResponse(error.message, 500);
  }
}
