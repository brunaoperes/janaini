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

    const [
      { data: colaboradores, error: colabError },
      { data: clientes, error: clientesError },
      { data: servicos, error: servicosError },
      { data: formasPagamento, error: formasError }
    ] = await Promise.all([
      supabase.from('colaboradores').select('*').order('nome'),
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
      supabase.from('formas_pagamento').select('*').eq('ativo', true).order('ordem')
    ]);

    // Log de erros se houver
    if (colabError) console.error('[API/lancamentos] Erro colaboradores:', colabError);
    if (clientesError) console.error('[API/lancamentos] Erro clientes:', clientesError);
    if (servicosError) console.error('[API/lancamentos] Erro servicos:', servicosError);
    if (formasError) console.error('[API/lancamentos] Erro formas:', formasError);

    console.log('[API/lancamentos] Dados carregados:', {
      colaboradores: colaboradores?.length || 0,
      clientes: clientes?.length || 0,
      servicos: servicos?.length || 0,
      formasPagamento: formasPagamento?.length || 0,
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
