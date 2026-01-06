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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filtro = searchParams.get('filtro') || 'hoje';

    // Obter perfil do usuário para filtrar comissões
    const userProfile = await getUserProfile();
    const isAdmin = userProfile?.role === 'admin';
    const userColaboradorId = userProfile?.colaborador_id;

    // Carregar colaboradores
    const { data: colaboradores } = await supabase
      .from('colaboradores')
      .select('*')
      .order('nome');

    // Carregar clientes
    const { data: clientes } = await supabase
      .from('clientes')
      .select('*')
      .order('nome');

    // Carregar serviços ativos
    const { data: servicos } = await supabase
      .from('servicos')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    // Carregar formas de pagamento
    const { data: formasPagamento } = await supabase
      .from('formas_pagamento')
      .select('*')
      .eq('ativo', true)
      .order('ordem');

    // Carregar lançamentos com filtro
    let query = supabase
      .from('lancamentos')
      .select('*')
      .order('data', { ascending: false });

    if (filtro === 'hoje') {
      const hoje = new Date();
      const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      query = query.like('data', `${hojeStr}%`);
    } else if (filtro === 'pendentes') {
      query = query.eq('status', 'pendente');
    }

    const { data: lancamentos, error } = await query.limit(100);

    if (error) {
      console.error('Erro ao carregar lançamentos:', error);
      return errorResponse(error.message, 500);
    }

    // Filtrar comissões: usuário comum só vê sua própria comissão
    let lancamentosFiltrados = lancamentos || [];
    if (!isAdmin && userColaboradorId) {
      lancamentosFiltrados = lancamentosFiltrados.map((lanc: any) => ({
        ...lanc,
        // Ocultar valor_comissao se não for o colaborador do lançamento
        valor_comissao: lanc.colaborador_id === userColaboradorId ? lanc.valor_comissao : null,
        // Flag para indicar se pode ver a comissão
        _canViewComissao: lanc.colaborador_id === userColaboradorId,
      }));
    } else if (!isAdmin && !userColaboradorId) {
      // Usuário sem vínculo não vê nenhuma comissão
      lancamentosFiltrados = lancamentosFiltrados.map((lanc: any) => ({
        ...lanc,
        valor_comissao: null,
        _canViewComissao: false,
      }));
    } else {
      // Admin vê tudo
      lancamentosFiltrados = lancamentosFiltrados.map((lanc: any) => ({
        ...lanc,
        _canViewComissao: true,
      }));
    }

    return jsonResponse({
      lancamentos: lancamentosFiltrados,
      colaboradores: colaboradores || [],
      clientes: clientes || [],
      servicos: servicos || [],
      formasPagamento: formasPagamento || [],
      _userProfile: {
        isAdmin,
        colaboradorId: userColaboradorId,
      },
    });
  } catch (error: any) {
    console.error('Erro na API de lançamentos:', error);
    return errorResponse(error.message, 500);
  }
}
