import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAuth, isAuthError } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const dynamic = 'force-dynamic';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) {
      return authResult;
    }

    const { profile } = authResult;
    const isAdmin = profile.role === 'admin';

    const { searchParams } = new URL(request.url);
    const dias = parseInt(searchParams.get('dias') || '30', 10);
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const colaboradorIdParam = searchParams.get('colaboradorId');

    let colaboradorIdFiltro: string | null = null;
    if (!isAdmin) {
      colaboradorIdFiltro = profile.colaborador_id;
    } else {
      colaboradorIdFiltro = colaboradorIdParam || null;
    }

    const hoje = new Date();
    const hojeStr = formatDate(hoje);

    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const inicioMesStr = formatDate(inicioMes);
    const fimMesStr = formatDate(fimMes);

    let chartDataInicio: string;
    let chartDataFim: string;
    if (dataInicio && dataFim) {
      chartDataInicio = dataInicio;
      chartDataFim = dataFim;
    } else {
      const inicioGrafico = new Date();
      inicioGrafico.setDate(inicioGrafico.getDate() - dias);
      chartDataInicio = formatDate(inicioGrafico);
      chartDataFim = hojeStr;
    }

    const diasPeriodo = Math.ceil((new Date(chartDataFim).getTime() - new Date(chartDataInicio).getTime()) / (1000 * 60 * 60 * 24));

    const agoraStr = hoje.toTimeString().slice(0, 8);

    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const amanhaStr = formatDate(amanha);

    const fimProjecao = new Date();
    fimProjecao.setDate(fimProjecao.getDate() + 30);
    const fimProjecaoStr = formatDate(fimProjecao);

    const inicioProjecaoPeriodo = new Date();
    inicioProjecaoPeriodo.setDate(inicioProjecaoPeriodo.getDate() + 1);
    const fimProjecaoPeriodo = new Date();
    fimProjecaoPeriodo.setDate(fimProjecaoPeriodo.getDate() + diasPeriodo);

    // Helper para aplicar filtro por colaborador
    const applyColabFilter = (q: any): any =>
      colaboradorIdFiltro ? q.eq('colaborador_id', colaboradorIdFiltro) : q;

    // ========== TODAS AS QUERIES EM PARALELO ==========
    const [
      faturamentoDiaRes,
      pagamentosFiadoDiaRaw,
      faturamentoMesRes,
      pagamentosFiadoMesRaw,
      totalClientesRes,
      agendamentosHojeRes,
      topColaboradorasRes,
      pagamentosFiadoColabsRawRes,
      topClientesDataRes,
      pagamentosFiadoClientesRawRes,
      proximosAgendamentosRes,
      faturamentoPeriodoRes,
      pagamentosFiadoPeriodoRawRes,
      comissoesPeriodoRes,
      colaboradoresComissaoRes,
      agendamentosFuturosPeriodoRes,
      comissoesMesRes,
      agendamentosFuturosRes,
      colabsListaRes,
    ] = await Promise.all([
      // 1. Faturamento do dia
      applyColabFilter(
        supabase
          .from('lancamentos')
          .select(`
            id, valor_total, forma_pagamento, servicos_nomes, data,
            is_fiado, is_troca_gratis, status, colaborador_id,
            clientes(nome), colaboradores(nome)
          `)
          .gte('data', `${hojeStr}T00:00:00`)
          .lte('data', `${hojeStr}T23:59:59`)
      ).order('data', { ascending: false }),

      // 2. Pagamentos fiado do dia
      supabase
        .from('pagamentos_fiado')
        .select(`valor_pago, data_pagamento, lancamento:lancamentos(colaborador_id)`)
        .gte('data_pagamento', hojeStr)
        .lte('data_pagamento', hojeStr),

      // 3. Faturamento do mês
      applyColabFilter(
        supabase
          .from('lancamentos')
          .select(`
            id, valor_total, forma_pagamento, servicos_nomes, data,
            is_fiado, is_troca_gratis, status, colaborador_id,
            clientes(nome), colaboradores(nome)
          `)
          .gte('data', `${inicioMesStr}T00:00:00`)
          .lte('data', `${fimMesStr}T23:59:59`)
      ).order('data', { ascending: false }),

      // 4. Pagamentos fiado do mês
      supabase
        .from('pagamentos_fiado')
        .select(`valor_pago, data_pagamento, lancamento:lancamentos(colaborador_id)`)
        .gte('data_pagamento', inicioMesStr)
        .lte('data_pagamento', fimMesStr),

      // 5. Total de clientes
      supabase.from('clientes').select('*', { count: 'exact', head: true }),

      // 6. Agendamentos de hoje (count)
      applyColabFilter(
        supabase
          .from('agendamentos')
          .select('*', { count: 'exact', head: true })
          .gte('data_hora', `${hojeStr}T00:00:00`)
          .lte('data_hora', `${hojeStr}T23:59:59`)
      ),

      // 7. Top colaboradoras
      applyColabFilter(
        supabase
          .from('lancamentos')
          .select(`colaborador_id, valor_total, status, is_fiado, is_troca_gratis, colaboradores(nome)`)
          .gte('data', `${inicioMesStr}T00:00:00`)
          .lte('data', `${fimMesStr}T23:59:59`)
      ),

      // 8. Pagamentos fiado para ranking de colabs
      supabase
        .from('pagamentos_fiado')
        .select(`valor_pago, lancamento:lancamentos(colaborador_id, colaborador:colaboradores(nome))`)
        .gte('data_pagamento', inicioMesStr)
        .lte('data_pagamento', fimMesStr),

      // 9. Top clientes
      applyColabFilter(
        supabase
          .from('lancamentos')
          .select(`cliente_id, colaborador_id, valor_total, status, is_fiado, is_troca_gratis, clientes(nome)`)
          .gte('data', `${inicioMesStr}T00:00:00`)
          .lte('data', `${fimMesStr}T23:59:59`)
          .not('cliente_id', 'is', null)
      ),

      // 10. Pagamentos fiado para ranking de clientes
      supabase
        .from('pagamentos_fiado')
        .select(`valor_pago, lancamento:lancamentos(cliente_id, colaborador_id, cliente:clientes(nome))`)
        .gte('data_pagamento', inicioMesStr)
        .lte('data_pagamento', fimMesStr),

      // 11. Próximos agendamentos
      applyColabFilter(
        supabase
          .from('agendamentos')
          .select(`id, data_hora, duracao_minutos, colaborador_id, clientes(nome), colaboradores(nome)`)
          .gte('data_hora', `${hojeStr}T${agoraStr}`)
          .lte('data_hora', `${hojeStr}T23:59:59`)
      ).order('data_hora', { ascending: true }).limit(5),

      // 12. Faturamento do período (gráfico)
      applyColabFilter(
        supabase
          .from('lancamentos')
          .select('data, valor_total, status, is_fiado, is_troca_gratis, colaborador_id')
          .gte('data', `${chartDataInicio}T00:00:00`)
          .lte('data', `${chartDataFim}T23:59:59`)
      ).order('data', { ascending: true }),

      // 13. Pagamentos fiado do período (gráfico)
      supabase
        .from('pagamentos_fiado')
        .select(`data_pagamento, valor_pago, lancamento:lancamentos(colaborador_id)`)
        .gte('data_pagamento', chartDataInicio)
        .lte('data_pagamento', chartDataFim),

      // 14. Comissões do período
      applyColabFilter(
        supabase
          .from('lancamentos')
          .select('comissao_colaborador, colaborador_id')
          .gte('data', `${chartDataInicio}T00:00:00`)
          .lte('data', `${chartDataFim}T23:59:59`)
          .eq('status', 'concluido')
          .or('is_fiado.is.null,is_fiado.eq.false')
          .eq('is_troca_gratis', false)
      ),

      // 15. Colaboradores (% média de comissão)
      supabase.from('colaboradores').select('porcentagem_comissao'),

      // 16. Agendamentos futuros (projeção período)
      applyColabFilter(
        supabase
          .from('agendamentos')
          .select('valor_estimado, colaborador_id')
          .gte('data_hora', `${formatDate(inicioProjecaoPeriodo)}T00:00:00`)
          .lte('data_hora', `${formatDate(fimProjecaoPeriodo)}T23:59:59`)
          .neq('status', 'concluido')
          .neq('status', 'cancelado')
      ),

      // 17. Comissões do mês
      applyColabFilter(
        supabase
          .from('lancamentos')
          .select('comissao_colaborador, colaborador_id')
          .gte('data', `${inicioMesStr}T00:00:00`)
          .lte('data', `${fimMesStr}T23:59:59`)
          .eq('status', 'concluido')
          .or('is_fiado.is.null,is_fiado.eq.false')
          .eq('is_troca_gratis', false)
      ),

      // 18. Agendamentos futuros (projeção 30 dias)
      applyColabFilter(
        supabase
          .from('agendamentos')
          .select('valor_estimado, colaborador_id')
          .gte('data_hora', `${amanhaStr}T00:00:00`)
          .lte('data_hora', `${fimProjecaoStr}T23:59:59`)
          .neq('status', 'concluido')
          .neq('status', 'cancelado')
      ),

      // 19. Lista de colaboradores (só se admin)
      isAdmin
        ? supabase.from('colaboradores').select('id, nome').order('nome')
        : Promise.resolve({ data: [] as { id: number; nome: string }[], error: null }),
    ]);

    // ========== PROCESSAMENTO EM MEMÓRIA ==========

    const faturamentoDia = faturamentoDiaRes.data;
    const lancamentosNormaisDia = faturamentoDia?.filter((l: any) =>
      l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis
    ) || [];

    const pagamentosFiadoDia = colaboradorIdFiltro
      ? pagamentosFiadoDiaRaw.data?.filter((p: any) => p.lancamento?.colaborador_id === Number(colaboradorIdFiltro))
      : pagamentosFiadoDiaRaw.data;

    const totalPagamentosFiadoDia = pagamentosFiadoDia?.reduce((sum, p) => sum + (p.valor_pago || 0), 0) || 0;
    const totalDia = lancamentosNormaisDia.reduce((sum: number, l: any) => sum + (l.valor_total || 0), 0) + totalPagamentosFiadoDia;
    const lancamentosHoje = faturamentoDia || [];

    const faturamentoMes = faturamentoMesRes.data;
    const lancamentosNormaisMes = faturamentoMes?.filter((l: any) =>
      l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis
    ) || [];

    const pagamentosFiadoMes = colaboradorIdFiltro
      ? pagamentosFiadoMesRaw.data?.filter((p: any) => p.lancamento?.colaborador_id === Number(colaboradorIdFiltro))
      : pagamentosFiadoMesRaw.data;

    const totalPagamentosFiadoMes = pagamentosFiadoMes?.reduce((sum, p) => sum + (p.valor_pago || 0), 0) || 0;
    const totalMes = lancamentosNormaisMes.reduce((sum: number, l: any) => sum + (l.valor_total || 0), 0) + totalPagamentosFiadoMes;
    const lancamentosMes = faturamentoMes || [];

    const totalClientes = totalClientesRes.count || 0;
    const agendamentosHoje = agendamentosHojeRes.count || 0;

    // Top colaboradoras
    const pagamentosFiadoColabs = colaboradorIdFiltro
      ? pagamentosFiadoColabsRawRes.data?.filter((p: any) => p.lancamento?.colaborador_id === Number(colaboradorIdFiltro))
      : pagamentosFiadoColabsRawRes.data;

    const colaboradorasMap = new Map();
    topColaboradorasRes.data?.filter((l: any) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis).forEach((lanc: any) => {
      const id = lanc.colaborador_id;
      const nome = lanc.colaboradores?.nome || 'Desconhecida';
      const valor = lanc.valor_total || 0;
      if (!colaboradorasMap.has(id)) colaboradorasMap.set(id, { nome, total: 0 });
      colaboradorasMap.get(id).total += valor;
    });
    pagamentosFiadoColabs?.forEach((pag: any) => {
      const id = pag.lancamento?.colaborador_id;
      const nome = pag.lancamento?.colaborador?.nome || 'Desconhecida';
      const valor = pag.valor_pago || 0;
      if (id) {
        if (!colaboradorasMap.has(id)) colaboradorasMap.set(id, { nome, total: 0 });
        colaboradorasMap.get(id).total += valor;
      }
    });
    const topColab = Array.from(colaboradorasMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);

    // Top clientes
    const pagamentosFiadoClientes = colaboradorIdFiltro
      ? pagamentosFiadoClientesRawRes.data?.filter((p: any) => p.lancamento?.colaborador_id === Number(colaboradorIdFiltro))
      : pagamentosFiadoClientesRawRes.data;

    const clientesMap = new Map();
    topClientesDataRes.data?.filter((l: any) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis).forEach((lanc: any) => {
      const id = lanc.cliente_id;
      const nome = lanc.clientes?.nome || 'Desconhecido';
      const valor = lanc.valor_total || 0;
      if (!clientesMap.has(id)) clientesMap.set(id, { id, nome, visitas: 0, total: 0 });
      clientesMap.get(id).visitas += 1;
      clientesMap.get(id).total += valor;
    });
    pagamentosFiadoClientes?.forEach((pag: any) => {
      const id = pag.lancamento?.cliente_id;
      const nome = pag.lancamento?.cliente?.nome || 'Desconhecido';
      const valor = pag.valor_pago || 0;
      if (id) {
        if (!clientesMap.has(id)) clientesMap.set(id, { id, nome, visitas: 0, total: 0 });
        clientesMap.get(id).visitas += 1;
        clientesMap.get(id).total += valor;
      }
    });
    const topClientes = Array.from(clientesMap.values()).sort((a, b) => b.total - a.total).slice(0, 10);

    // Faturamento do período (gráfico)
    const pagamentosFiadoPeriodo = colaboradorIdFiltro
      ? pagamentosFiadoPeriodoRawRes.data?.filter((p: any) => p.lancamento?.colaborador_id === Number(colaboradorIdFiltro))
      : pagamentosFiadoPeriodoRawRes.data;

    const faturamentoPorDia = new Map();
    faturamentoPeriodoRes.data?.filter((l: any) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis).forEach((lanc: any) => {
      const data = new Date(lanc.data).toLocaleDateString('pt-BR');
      if (!faturamentoPorDia.has(data)) faturamentoPorDia.set(data, 0);
      faturamentoPorDia.set(data, faturamentoPorDia.get(data) + (lanc.valor_total || 0));
    });
    pagamentosFiadoPeriodo?.forEach((pag: any) => {
      const data = new Date(pag.data_pagamento).toLocaleDateString('pt-BR');
      if (!faturamentoPorDia.has(data)) faturamentoPorDia.set(data, 0);
      faturamentoPorDia.set(data, faturamentoPorDia.get(data) + (pag.valor_pago || 0));
    });
    const chartData = Array.from(faturamentoPorDia.entries()).map(([data, valor]) => ({ data, valor }));

    const totalLancamentosNormais = faturamentoPeriodoRes.data?.filter((l: any) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis)
      .reduce((sum: number, l: any) => sum + (l.valor_total || 0), 0) || 0;
    const totalPagamentosFiadoPeriodo = pagamentosFiadoPeriodo?.reduce((sum, p) => sum + (p.valor_pago || 0), 0) || 0;
    const totalPeriodoGrafico = totalLancamentosNormais + totalPagamentosFiadoPeriodo;

    const comissaoRealizadaPeriodo = (comissoesPeriodoRes.data || []).reduce((sum: number, l: any) => sum + (l.comissao_colaborador || 0), 0);
    const faturamentoLiquidoPeriodo = totalPeriodoGrafico - comissaoRealizadaPeriodo;

    // Média de comissão
    const mediaComissao = colaboradoresComissaoRes.data && colaboradoresComissaoRes.data.length > 0
      ? colaboradoresComissaoRes.data.reduce((sum, c) => sum + (c.porcentagem_comissao || 0), 0) / colaboradoresComissaoRes.data.length
      : 50;

    // Projeção do período
    const projecaoFaturamentoPeriodo = (agendamentosFuturosPeriodoRes.data || []).reduce((sum: number, a: any) => sum + (a.valor_estimado || 0), 0);
    const projecaoComissaoPeriodo = (projecaoFaturamentoPeriodo * mediaComissao) / 100;
    const projecaoLiquidoPeriodo = projecaoFaturamentoPeriodo - projecaoComissaoPeriodo;

    // Comissão do mês
    const comissaoRealizadaMes = (comissoesMesRes.data || []).reduce((sum: number, l: any) => sum + (l.comissao_colaborador || 0), 0);
    const faturamentoLiquidoMes = totalMes - comissaoRealizadaMes;

    // Projeção 30 dias
    const projecaoFaturamento = (agendamentosFuturosRes.data || []).reduce((sum: number, a: any) => sum + (a.valor_estimado || 0), 0);
    const projecaoComissao = (projecaoFaturamento * mediaComissao) / 100;

    const colaboradoresLista = isAdmin ? (colabsListaRes.data || []) : [];

    return jsonResponse({
      totalDia,
      totalMes,
      totalClientes,
      agendamentosHoje,
      topColaboradoras: topColab,
      topClientes,
      proximosAgendamentos: proximosAgendamentosRes.data || [],
      chartData,
      lancamentosHoje,
      lancamentosMes,
      totalPeriodoGrafico,
      isAdmin,
      colaboradorId: profile.colaborador_id,
      colaboradorIdFiltro,
      colaboradores: colaboradoresLista,
      comissaoRealizadaMes,
      faturamentoLiquidoMes,
      projecaoFaturamento,
      projecaoComissao,
      comissaoRealizadaPeriodo,
      faturamentoLiquidoPeriodo,
      projecaoFaturamentoPeriodo,
      projecaoComissaoPeriodo,
      projecaoLiquidoPeriodo,
      diasPeriodo,
    });
  } catch (error: any) {
    console.error('Erro no dashboard API:', error);
    return errorResponse(error.message, 500);
  }
}
