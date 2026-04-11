import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/api-auth';
import { auditCreate } from '@/lib/audit';

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
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { searchParams } = new URL(request.url);
    const filtro = searchParams.get('filtro') || 'hoje';

    // Tentar obter perfil do usuário (não crítico)
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
    } catch {
      // Continua sem perfil
    }

    const isAdmin = userProfile?.role === 'admin';
    const userColaboradorId = userProfile?.colaborador_id;

    // Carregar dados em paralelo
    const [colaboradoresRes, clientesRes, servicosRes, formasRes] = await Promise.all([
      supabase.from('colaboradores').select('*').order('nome'),
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
      supabase.from('formas_pagamento').select('*').eq('ativo', true).order('ordem')
    ]);

    const colaboradores = colaboradoresRes.data || [];
    const clientes = clientesRes.data || [];
    let servicos = servicosRes.data || [];
    const formasPagamento = formasRes.data || [];

    // FILTRO DE SERVIÇOS: usuário não-admin só vê serviços do seu colaborador
    if (!isAdmin && userColaboradorId) {
      const colabId = Number(userColaboradorId);
      servicos = servicos.filter((s: any) => {
        if (!s.colaboradores_ids || !Array.isArray(s.colaboradores_ids)) {
          return false;
        }
        const idsAsNumbers = s.colaboradores_ids.map((id: any) => Number(id));
        return idsAsNumbers.includes(colabId);
      });
    }

    // Carregar lançamentos
    let query = supabase
      .from('lancamentos')
      .select('*')
      .order('data', { ascending: false });

    // FILTRO POR PERMISSÃO: usuário não-admin só vê seus próprios lançamentos
    if (!isAdmin && userColaboradorId) {
      query = query.eq('colaborador_id', userColaboradorId);
    } else if (!isAdmin && !userColaboradorId) {
      // Usuário sem colaborador_id vinculado não vê nenhum lançamento
      return NextResponse.json({
        lancamentos: [],
        colaboradores,
        clientes,
        servicos,
        formasPagamento,
        _userProfile: {
          isAdmin: false,
          colaboradorId: null,
        },
        _warning: 'Seu usuário não está vinculado a nenhum colaborador. Contate o administrador.',
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      });
    }

    if (filtro === 'hoje') {
      // Usar timezone de Brasília corretamente
      const hojeStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      // hojeStr = "2026-01-06" (formato YYYY-MM-DD)

      // Buscar lançamentos cuja data começa com a data de hoje
      // Usando filter para cast para date
      query = query.filter('data::date', 'eq', hojeStr);
    } else if (filtro === 'pendentes') {
      query = query.eq('status', 'pendente');
    }

    const { data: lancamentos, error: lancError } = await query.limit(100);

    if (lancError) {
      console.error('[API/lancamentos] Erro:', lancError);
    }

    // Buscar divisões para lançamentos compartilhados
    const lancamentosIds = (lancamentos || []).map((l: any) => l.id);
    let divisoesMap: Record<number, any[]> = {};

    if (lancamentosIds.length > 0) {
      const { data: divisoes } = await supabase
        .from('lancamento_divisoes')
        .select(`
          lancamento_id,
          colaborador_id,
          valor,
          comissao_calculada,
          colaborador:colaboradores(id, nome, porcentagem_comissao)
        `)
        .in('lancamento_id', lancamentosIds);

      // Agrupar divisões por lançamento
      (divisoes || []).forEach((div: any) => {
        if (!divisoesMap[div.lancamento_id]) {
          divisoesMap[div.lancamento_id] = [];
        }
        divisoesMap[div.lancamento_id].push(div);
      });
    }

    // Filtrar comissões baseado nas permissões e adicionar divisões
    let lancamentosFiltrados = lancamentos || [];
    if (!isAdmin && userColaboradorId) {
      lancamentosFiltrados = lancamentosFiltrados.map((lanc: any) => {
        const divisoes = divisoesMap[lanc.id] || [];
        // Para usuário comum, filtrar divisões para mostrar apenas onde ele participa
        const divisoesFiltradas = divisoes.filter((d: any) => d.colaborador_id === userColaboradorId);
        return {
          ...lanc,
          comissao_colaborador: lanc.colaborador_id === userColaboradorId ? lanc.comissao_colaborador : null,
          comissao_salao: lanc.colaborador_id === userColaboradorId ? lanc.comissao_salao : null,
          _canViewComissao: lanc.colaborador_id === userColaboradorId,
          compartilhado: divisoes.length > 0,
          divisoes: divisoesFiltradas,
        };
      });
    } else if (!isAdmin && !userColaboradorId) {
      lancamentosFiltrados = lancamentosFiltrados.map((lanc: any) => ({
        ...lanc,
        comissao_colaborador: null,
        comissao_salao: null,
        _canViewComissao: false,
        compartilhado: false,
        divisoes: [],
      }));
    } else {
      // Admin vê tudo
      lancamentosFiltrados = lancamentosFiltrados.map((lanc: any) => {
        const divisoes = divisoesMap[lanc.id] || [];
        return {
          ...lanc,
          _canViewComissao: true,
          compartilhado: divisoes.length > 0,
          divisoes: divisoes,
        };
      });
    }

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
    console.error('[API/lancamentos] Erro fatal:', error?.message || error);
    return fallbackResponse();
  }
}

// Helper para obter dados do usuário autenticado
async function getAuthUser(supabase: any) {
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

export async function POST(request: Request) {
  try {
    // Verificar autenticação
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const body = await request.json();

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Inserir lançamento
    const { data: lancamento, error: lancError } = await supabase
      .from('lancamentos')
      .insert(body)
      .select()
      .single();

    if (lancError) {
      console.error('[API/lancamentos] Erro ao criar lançamento:', lancError);
      return NextResponse.json({ error: lancError.message }, { status: 500 });
    }

    // Registrar auditoria
    const authUser = await getAuthUser(supabase);
    if (authUser) {
      await auditCreate({
        ...authUser,
        modulo: 'Lancamentos',
        tabela: 'lancamentos',
        registroId: lancamento.id,
        dadosNovo: lancamento,
        metodo: 'POST',
        endpoint: '/api/lancamentos',
      });
    }

    return NextResponse.json({ data: lancamento });
  } catch (error: any) {
    console.error('[API/lancamentos] Erro fatal POST:', error?.message || error);
    return NextResponse.json({ error: 'Erro ao criar lançamento' }, { status: 500 });
  }
}
