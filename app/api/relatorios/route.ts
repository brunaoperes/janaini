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
    // Novo filtro: incluir/excluir fiados e troca/grátis
    const incluirFiados = searchParams.get('incluirFiados') === 'true';
    const incluirTroca = searchParams.get('incluirTroca') === 'true';

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

    // Filtrar fiados e troca/grátis se necessário
    let lancamentosFinal = lancamentos || [];
    if (!incluirFiados) {
      lancamentosFinal = lancamentosFinal.filter((l: any) => !l.is_fiado);
    }
    if (!incluirTroca) {
      lancamentosFinal = lancamentosFinal.filter((l: any) => !l.is_troca_gratis);
    }

    // Buscar pagamentos de fiado do período (para incluir no faturamento)
    let pagamentosFiado: any[] = [];
    if (incluirFiados) {
      const { data: pagamentos } = await supabase
        .from('pagamentos_fiado')
        .select(`
          id,
          valor_pago,
          forma_pagamento,
          data_pagamento,
          comissao_colaborador,
          comissao_salao,
          lancamento:lancamentos(
            id,
            colaborador_id,
            cliente_id,
            servicos_nomes,
            colaboradores(nome, porcentagem_comissao),
            clientes(nome, telefone)
          )
        `)
        .gte('data_pagamento', startDate)
        .lte('data_pagamento', endDate);

      pagamentosFiado = pagamentos || [];
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

    // Filtrar período anterior também
    let lancamentosAnteriorFinal = lancamentosAnterior || [];
    if (!incluirFiados) {
      lancamentosAnteriorFinal = lancamentosAnteriorFinal.filter((l: any) => !l.is_fiado);
    }
    if (!incluirTroca) {
      lancamentosAnteriorFinal = lancamentosAnteriorFinal.filter((l: any) => !l.is_troca_gratis);
    }

    // Filtrar comissões baseado nas permissões do usuário
    const lancamentosFiltrados = filterComissoes(lancamentosFinal, isAdmin, userColaboradorId);
    const lancamentosAnteriorFiltrados = filterComissoes(lancamentosAnteriorFinal, isAdmin, userColaboradorId);

    // Calcular totais
    const totalFaturamento = lancamentosFinal
      .filter((l: any) => !l.is_fiado && !l.is_troca_gratis)
      .reduce((sum: number, l: any) => sum + (l.valor_total || 0), 0);

    // Adicionar pagamentos de fiado ao faturamento
    const totalPagamentosFiado = pagamentosFiado.reduce((sum, p) => sum + (p.valor_pago || 0), 0);

    // Totais de fiados e troca para exibição
    const totalFiadosPendentes = (lancamentos || [])
      .filter((l: any) => l.is_fiado && l.status === 'pendente')
      .reduce((sum: number, l: any) => sum + (l.valor_total || 0), 0);

    const totalTrocaGratis = (lancamentos || [])
      .filter((l: any) => l.is_troca_gratis)
      .length;

    return jsonResponse({
      lancamentos: lancamentosFiltrados,
      lancamentosAnterior: lancamentosAnteriorFiltrados,
      colaboradores: colaboradores || [],
      pagamentosFiado: pagamentosFiado,
      totais: {
        faturamento: totalFaturamento + totalPagamentosFiado,
        faturamentoSemFiados: totalFaturamento,
        pagamentosFiado: totalPagamentosFiado,
        fiadosPendentes: totalFiadosPendentes,
        trocaGratisQtd: totalTrocaGratis,
      },
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
