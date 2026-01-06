import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

// Resposta de fallback em caso de erro total
function fallbackResponse() {
  return NextResponse.json({
    lancamentos: [],
    colaboradores: [],
    clientes: [],
    servicos: [],
    formasPagamento: [],
    _userProfile: {
      isAdmin: false,
      colaboradorId: null,
    },
    _error: 'Erro ao carregar dados. Tente novamente.',
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  });
}

export async function GET(request: Request) {
  console.log('[API/lancamentos] === INICIO DA REQUISICAO ===');

  try {
    // Criar cliente Supabase com service key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Obter parâmetros
    const { searchParams } = new URL(request.url);
    const filtro = searchParams.get('filtro') || 'hoje';
    console.log('[API/lancamentos] Filtro:', filtro);

    // Tentar obter perfil do usuário (não crítico - pode falhar)
    let userProfile: { role?: string; colaborador_id?: number } | null = null;
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
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, colaborador_id')
          .eq('id', user.id)
          .single();
        userProfile = profile;
      }
      console.log('[API/lancamentos] UserProfile obtido:', !!userProfile);
    } catch (profileError) {
      console.log('[API/lancamentos] Erro ao obter perfil (não crítico):', profileError);
      // Continua sem perfil
    }

    const isAdmin = userProfile?.role === 'admin';
    const userColaboradorId = userProfile?.colaborador_id;

    // Carregar dados em paralelo
    console.log('[API/lancamentos] Carregando dados...');

    const [colaboradoresRes, clientesRes, servicosRes, formasRes] = await Promise.all([
      supabase.from('colaboradores').select('*').order('nome'),
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
      supabase.from('formas_pagamento').select('*').eq('ativo', true).order('ordem')
    ]);

    const colaboradores = colaboradoresRes.data || [];
    const clientes = clientesRes.data || [];
    const servicos = servicosRes.data || [];
    const formasPagamento = formasRes.data || [];

    console.log('[API/lancamentos] Dados carregados:', {
      colaboradores: colaboradores.length,
      clientes: clientes.length,
      servicos: servicos.length,
      formasPagamento: formasPagamento.length,
    });

    // Carregar lançamentos
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

    const { data: lancamentos, error: lancError } = await query.limit(100);

    if (lancError) {
      console.error('[API/lancamentos] Erro lançamentos:', lancError);
    }

    // Filtrar comissões baseado nas permissões
    let lancamentosFiltrados = lancamentos || [];
    if (!isAdmin && userColaboradorId) {
      lancamentosFiltrados = lancamentosFiltrados.map((lanc: any) => ({
        ...lanc,
        comissao_colaborador: lanc.colaborador_id === userColaboradorId ? lanc.comissao_colaborador : null,
        comissao_salao: lanc.colaborador_id === userColaboradorId ? lanc.comissao_salao : null,
        _canViewComissao: lanc.colaborador_id === userColaboradorId,
      }));
    } else if (!isAdmin && !userColaboradorId) {
      lancamentosFiltrados = lancamentosFiltrados.map((lanc: any) => ({
        ...lanc,
        comissao_colaborador: null,
        comissao_salao: null,
        _canViewComissao: false,
      }));
    } else {
      lancamentosFiltrados = lancamentosFiltrados.map((lanc: any) => ({
        ...lanc,
        _canViewComissao: true,
      }));
    }

    console.log('[API/lancamentos] === SUCESSO ===');

    return NextResponse.json({
      lancamentos: lancamentosFiltrados,
      colaboradores,
      clientes,
      servicos,
      formasPagamento,
      _userProfile: {
        isAdmin,
        colaboradorId: userColaboradorId,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });

  } catch (error: any) {
    console.error('[API/lancamentos] === ERRO FATAL ===', error?.message || error);
    console.error('[API/lancamentos] Stack:', error?.stack);

    // Retornar resposta de fallback em vez de 500
    return fallbackResponse();
  }
}
