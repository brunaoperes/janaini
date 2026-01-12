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

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dias = parseInt(searchParams.get('dias') || '30', 10);
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    const hoje = new Date();
    const hojeStr = formatDate(hoje);

    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const inicioMesStr = formatDate(inicioMes);
    const fimMesStr = formatDate(fimMes);

    console.log('=== API DASHBOARD ===');
    console.log('Hoje:', hojeStr);
    console.log('Inicio Mes:', inicioMesStr);
    console.log('Fim Mes:', fimMesStr);
    console.log('Dias gráfico:', dias);
    console.log('Data início personalizada:', dataInicio);
    console.log('Data fim personalizada:', dataFim);

    // Faturamento do dia (com detalhes)
    // IMPORTANTE: Excluir fiados pendentes (is_fiado=true com status pendente)
    // e excluir troca/grátis (is_troca_gratis=true)
    // Fiados pagos entram pelo pagamento (pagamentos_fiado), não pelo lançamento original
    const { data: faturamentoDia, error: errDia } = await supabase
      .from('lancamentos')
      .select(`
        id,
        valor_total,
        forma_pagamento,
        servicos_nomes,
        data,
        is_fiado,
        is_troca_gratis,
        status,
        clientes(nome),
        colaboradores(nome)
      `)
      .gte('data', `${hojeStr}T00:00:00`)
      .lte('data', `${hojeStr}T23:59:59`)
      .order('data', { ascending: false });

    console.log('Faturamento dia:', faturamentoDia?.length, 'erro:', errDia?.message);

    // Filtrar para faturamento: apenas lançamentos normais (não fiado, não troca/grátis)
    const lancamentosNormaisDia = faturamentoDia?.filter((l: any) =>
      !l.is_fiado && !l.is_troca_gratis
    ) || [];

    // Buscar pagamentos de fiado do dia (fiados que foram pagos hoje)
    const { data: pagamentosFiadoDia } = await supabase
      .from('pagamentos_fiado')
      .select('valor_pago, data_pagamento')
      .gte('data_pagamento', hojeStr)
      .lte('data_pagamento', hojeStr);

    const totalPagamentosFiadoDia = pagamentosFiadoDia?.reduce((sum, p) => sum + (p.valor_pago || 0), 0) || 0;
    const totalDia = lancamentosNormaisDia.reduce((sum, l) => sum + (l.valor_total || 0), 0) + totalPagamentosFiadoDia;
    const lancamentosHoje = faturamentoDia || [];

    // Faturamento do mês (com detalhes)
    // IMPORTANTE: Mesma lógica - excluir fiados pendentes e troca/grátis
    const { data: faturamentoMes, error: errMes } = await supabase
      .from('lancamentos')
      .select(`
        id,
        valor_total,
        forma_pagamento,
        servicos_nomes,
        data,
        is_fiado,
        is_troca_gratis,
        status,
        clientes(nome),
        colaboradores(nome)
      `)
      .gte('data', `${inicioMesStr}T00:00:00`)
      .lte('data', `${fimMesStr}T23:59:59`)
      .order('data', { ascending: false });

    console.log('Faturamento mes:', faturamentoMes?.length, 'erro:', errMes?.message);

    // Filtrar para faturamento: apenas lançamentos normais (não fiado, não troca/grátis)
    const lancamentosNormaisMes = faturamentoMes?.filter((l: any) =>
      !l.is_fiado && !l.is_troca_gratis
    ) || [];

    // Buscar pagamentos de fiado do mês
    const { data: pagamentosFiadoMes } = await supabase
      .from('pagamentos_fiado')
      .select('valor_pago, data_pagamento')
      .gte('data_pagamento', inicioMesStr)
      .lte('data_pagamento', fimMesStr);

    const totalPagamentosFiadoMes = pagamentosFiadoMes?.reduce((sum, p) => sum + (p.valor_pago || 0), 0) || 0;
    const totalMes = lancamentosNormaisMes.reduce((sum, l) => sum + (l.valor_total || 0), 0) + totalPagamentosFiadoMes;
    const lancamentosMes = faturamentoMes || [];

    // Total de clientes
    const { count: totalClientes, error: errClientes } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true });

    console.log('Total clientes:', totalClientes, 'erro:', errClientes?.message);

    // Agendamentos de hoje
    const { count: agendamentosHoje, error: errAgend } = await supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .gte('data_hora', `${hojeStr}T00:00:00`)
      .lte('data_hora', `${hojeStr}T23:59:59`);

    console.log('Agendamentos hoje:', agendamentosHoje, 'erro:', errAgend?.message);

    // Top 5 Colaboradoras (por valor total)
    // IMPORTANTE: Excluir fiados pendentes e troca/grátis
    const { data: topColaboradoras } = await supabase
      .from('lancamentos')
      .select(`
        colaborador_id,
        valor_total,
        is_fiado,
        is_troca_gratis,
        colaboradores(nome)
      `)
      .gte('data', `${inicioMesStr}T00:00:00`)
      .lte('data', `${fimMesStr}T23:59:59`);

    // Buscar pagamentos de fiado do mês para incluir no ranking
    const { data: pagamentosFiadoColabs } = await supabase
      .from('pagamentos_fiado')
      .select(`
        valor_pago,
        lancamento:lancamentos(colaborador_id, colaborador:colaboradores(nome))
      `)
      .gte('data_pagamento', inicioMesStr)
      .lte('data_pagamento', fimMesStr);

    const colaboradorasMap = new Map();

    // Adicionar lançamentos normais (não fiado, não troca/grátis)
    topColaboradoras?.filter((l: any) => !l.is_fiado && !l.is_troca_gratis).forEach((lanc: any) => {
      const id = lanc.colaborador_id;
      const nome = lanc.colaboradores?.nome || 'Desconhecida';
      const valor = lanc.valor_total || 0;

      if (!colaboradorasMap.has(id)) {
        colaboradorasMap.set(id, { nome, total: 0 });
      }
      colaboradorasMap.get(id).total += valor;
    });

    // Adicionar pagamentos de fiado
    pagamentosFiadoColabs?.forEach((pag: any) => {
      const id = pag.lancamento?.colaborador_id;
      const nome = pag.lancamento?.colaborador?.nome || 'Desconhecida';
      const valor = pag.valor_pago || 0;

      if (id) {
        if (!colaboradorasMap.has(id)) {
          colaboradorasMap.set(id, { nome, total: 0 });
        }
        colaboradorasMap.get(id).total += valor;
      }
    });

    const topColab = Array.from(colaboradorasMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Top 10 Clientes (por valor total gasto no mês)
    // IMPORTANTE: Excluir fiados pendentes e troca/grátis
    const { data: topClientesData } = await supabase
      .from('lancamentos')
      .select(`
        cliente_id,
        valor_total,
        is_fiado,
        is_troca_gratis,
        clientes(nome)
      `)
      .gte('data', `${inicioMesStr}T00:00:00`)
      .lte('data', `${fimMesStr}T23:59:59`)
      .not('cliente_id', 'is', null);

    // Buscar pagamentos de fiado para clientes
    const { data: pagamentosFiadoClientes } = await supabase
      .from('pagamentos_fiado')
      .select(`
        valor_pago,
        lancamento:lancamentos(cliente_id, cliente:clientes(nome))
      `)
      .gte('data_pagamento', inicioMesStr)
      .lte('data_pagamento', fimMesStr);

    console.log('Top clientes data:', topClientesData?.length, 'registros');

    const clientesMap = new Map();

    // Adicionar lançamentos normais (não fiado, não troca/grátis)
    topClientesData?.filter((l: any) => !l.is_fiado && !l.is_troca_gratis).forEach((lanc: any) => {
      const id = lanc.cliente_id;
      const nome = lanc.clientes?.nome || 'Desconhecido';
      const valor = lanc.valor_total || 0;

      if (!clientesMap.has(id)) {
        clientesMap.set(id, { id, nome, visitas: 0, total: 0 });
      }
      clientesMap.get(id).visitas += 1;
      clientesMap.get(id).total += valor;
    });

    // Adicionar pagamentos de fiado
    pagamentosFiadoClientes?.forEach((pag: any) => {
      const id = pag.lancamento?.cliente_id;
      const nome = pag.lancamento?.cliente?.nome || 'Desconhecido';
      const valor = pag.valor_pago || 0;

      if (id) {
        if (!clientesMap.has(id)) {
          clientesMap.set(id, { id, nome, visitas: 0, total: 0 });
        }
        clientesMap.get(id).visitas += 1;
        clientesMap.get(id).total += valor;
      }
    });

    // Ordenar por valor total (maior primeiro) e pegar os 10 melhores
    const topClientes = Array.from(clientesMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Próximos agendamentos de hoje
    const agoraStr = hoje.toTimeString().slice(0, 8);
    const { data: proximosAgendamentos } = await supabase
      .from('agendamentos')
      .select(`
        id,
        data_hora,
        duracao_minutos,
        clientes(nome),
        colaboradores(nome)
      `)
      .gte('data_hora', `${hojeStr}T${agoraStr}`)
      .lte('data_hora', `${hojeStr}T23:59:59`)
      .order('data_hora', { ascending: true })
      .limit(5);

    // Faturamento do período selecionado (padrão: últimos 30 dias)
    let chartDataInicio: string;
    let chartDataFim: string;

    if (dataInicio && dataFim) {
      // Período personalizado
      chartDataInicio = dataInicio;
      chartDataFim = dataFim;
    } else {
      // Período baseado em dias
      const inicioGrafico = new Date();
      inicioGrafico.setDate(inicioGrafico.getDate() - dias);
      chartDataInicio = formatDate(inicioGrafico);
      chartDataFim = hojeStr;
    }

    // Faturamento do período (gráfico)
    // IMPORTANTE: Excluir fiados pendentes e troca/grátis
    const { data: faturamentoPeriodo } = await supabase
      .from('lancamentos')
      .select('data, valor_total, is_fiado, is_troca_gratis')
      .gte('data', `${chartDataInicio}T00:00:00`)
      .lte('data', `${chartDataFim}T23:59:59`)
      .order('data', { ascending: true });

    // Buscar pagamentos de fiado do período
    const { data: pagamentosFiadoPeriodo } = await supabase
      .from('pagamentos_fiado')
      .select('data_pagamento, valor_pago')
      .gte('data_pagamento', chartDataInicio)
      .lte('data_pagamento', chartDataFim);

    const faturamentoPorDia = new Map();

    // Adicionar lançamentos normais (não fiado, não troca/grátis)
    faturamentoPeriodo?.filter((l: any) => !l.is_fiado && !l.is_troca_gratis).forEach((lanc: any) => {
      const data = new Date(lanc.data).toLocaleDateString('pt-BR');
      if (!faturamentoPorDia.has(data)) {
        faturamentoPorDia.set(data, 0);
      }
      faturamentoPorDia.set(data, faturamentoPorDia.get(data) + (lanc.valor_total || 0));
    });

    // Adicionar pagamentos de fiado (pelo dia do pagamento)
    pagamentosFiadoPeriodo?.forEach((pag: any) => {
      const data = new Date(pag.data_pagamento).toLocaleDateString('pt-BR');
      if (!faturamentoPorDia.has(data)) {
        faturamentoPorDia.set(data, 0);
      }
      faturamentoPorDia.set(data, faturamentoPorDia.get(data) + (pag.valor_pago || 0));
    });

    const chartData = Array.from(faturamentoPorDia.entries()).map(([data, valor]) => ({
      data,
      valor,
    }));

    // Total do período do gráfico
    const totalLancamentosNormais = faturamentoPeriodo?.filter((l: any) => !l.is_fiado && !l.is_troca_gratis)
      .reduce((sum, l) => sum + (l.valor_total || 0), 0) || 0;
    const totalPagamentosFiadoPeriodo = pagamentosFiadoPeriodo?.reduce((sum, p) => sum + (p.valor_pago || 0), 0) || 0;
    const totalPeriodoGrafico = totalLancamentosNormais + totalPagamentosFiadoPeriodo;

    return jsonResponse({
      totalDia,
      totalMes,
      totalClientes: totalClientes || 0,
      agendamentosHoje: agendamentosHoje || 0,
      topColaboradoras: topColab,
      topClientes,
      proximosAgendamentos: proximosAgendamentos || [],
      chartData,
      lancamentosHoje,
      lancamentosMes,
      totalPeriodoGrafico,
    });
  } catch (error: any) {
    console.error('Erro no dashboard API:', error);
    return errorResponse(error.message, 500);
  }
}
