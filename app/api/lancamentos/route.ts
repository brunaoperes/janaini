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
    console.log('[API/lancamentos] getUserProfile: Iniciando...');
    const cookieStore = await cookies();
    console.log('[API/lancamentos] getUserProfile: Cookies obtidos');

    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    console.log('[API/lancamentos] getUserProfile: User obtido:', !!user, userError?.message);

    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, colaborador_id')
      .eq('id', user.id)
      .single();

    console.log('[API/lancamentos] getUserProfile: Profile obtido:', !!profile, profileError?.message);
    return profile;
  } catch (error: any) {
    console.error('[API/lancamentos] getUserProfile: ERRO:', error?.message || error);
    return null;
  }
}

export async function GET(request: Request) {
  const startTime = Date.now();
  console.log('[API/lancamentos] Iniciando requisição...');

  try {
    const { searchParams } = new URL(request.url);
    const filtro = searchParams.get('filtro') || 'hoje';
    console.log('[API/lancamentos] Filtro:', filtro);

    // Obter perfil do usuário para filtrar comissões
    const userProfile = await getUserProfile();
    const isAdmin = userProfile?.role === 'admin';
    const userColaboradorId = userProfile?.colaborador_id;
    console.log('[API/lancamentos] UserProfile:', { isAdmin, userColaboradorId });

    // Carregar todos os dados em paralelo para melhor performance
    console.log('[API/lancamentos] Carregando dados em paralelo...');

    let colaboradores: any[] = [];
    let clientes: any[] = [];
    let servicos: any[] = [];
    let formasPagamento: any[] = [];

    try {
      const results = await Promise.all([
        supabase.from('colaboradores').select('*').order('nome'),
        supabase.from('clientes').select('*').order('nome'),
        supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
        supabase.from('formas_pagamento').select('*').eq('ativo', true).order('ordem')
      ]);

      colaboradores = results[0].data || [];
      clientes = results[1].data || [];
      servicos = results[2].data || [];
      formasPagamento = results[3].data || [];

      // Log de erros se houver
      if (results[0].error) console.error('[API/lancamentos] Erro colaboradores:', results[0].error);
      if (results[1].error) console.error('[API/lancamentos] Erro clientes:', results[1].error);
      if (results[2].error) console.error('[API/lancamentos] Erro servicos:', results[2].error);
      if (results[3].error) console.error('[API/lancamentos] Erro formas:', results[3].error);
    } catch (parallelError: any) {
      console.error('[API/lancamentos] ERRO no Promise.all:', parallelError?.message || parallelError);
      // Continuar mesmo com erro - retornar arrays vazios
    }

    console.log('[API/lancamentos] Dados carregados:', {
      colaboradores: colaboradores.length,
      clientes: clientes.length,
      servicos: servicos.length,
      formasPagamento: formasPagamento.length,
      tempoMs: Date.now() - startTime
    });

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
        // Ocultar comissao_colaborador se não for o colaborador do lançamento
        comissao_colaborador: lanc.colaborador_id === userColaboradorId ? lanc.comissao_colaborador : null,
        comissao_salao: lanc.colaborador_id === userColaboradorId ? lanc.comissao_salao : null,
        // Flag para indicar se pode ver a comissão
        _canViewComissao: lanc.colaborador_id === userColaboradorId,
      }));
    } else if (!isAdmin && !userColaboradorId) {
      // Usuário sem vínculo não vê nenhuma comissão
      lancamentosFiltrados = lancamentosFiltrados.map((lanc: any) => ({
        ...lanc,
        comissao_colaborador: null,
        comissao_salao: null,
        _canViewComissao: false,
      }));
    } else {
      // Admin vê tudo
      lancamentosFiltrados = lancamentosFiltrados.map((lanc: any) => ({
        ...lanc,
        _canViewComissao: true,
      }));
    }

    const responseData = {
      lancamentos: lancamentosFiltrados,
      colaboradores: colaboradores || [],
      clientes: clientes || [],
      servicos: servicos || [],
      formasPagamento: formasPagamento || [],
      _userProfile: {
        isAdmin,
        colaboradorId: userColaboradorId,
      },
    };

    console.log('[API/lancamentos] Enviando resposta:', {
      lancamentos: responseData.lancamentos.length,
      colaboradores: responseData.colaboradores.length,
      clientes: responseData.clientes.length,
      servicos: responseData.servicos.length,
      formasPagamento: responseData.formasPagamento.length,
      tempoTotalMs: Date.now() - startTime
    });

    return jsonResponse(responseData);
  } catch (error: any) {
    console.error('[API/lancamentos] ERRO:', error);
    return errorResponse(error.message, 500);
  }
}
