import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

interface LancamentoComissao {
  id: number;
  colaborador_id: number;
  valor_total: number;
  forma_pagamento: string | null;
  comissao_colaborador: number | null;
  data: string;
  status: string;
  servicos_nomes: string | null;
  cliente_nome?: string;
}

interface FormasPagamento {
  codigo: string;
  taxa_percentual: number;
}

interface ComissaoCalculada {
  colaborador_id: number;
  colaborador_nome: string;
  total_servicos: number;
  total_bruto: number;
  total_descontos: number;
  total_liquido: number;
  lancamentos: {
    id: number;
    data: string;
    servicos: string;
    cliente: string;
    valor_servico: number;
    comissao_bruta: number;
    forma_pagamento: string;
    taxa_aplicada: number;
    desconto: number;
    comissao_liquida: number;
  }[];
}

export async function GET(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const colaboradorId = searchParams.get('colaboradorId');

    // Obter perfil do usuário para verificar permissões
    let userProfile: { role?: string; colaborador_id?: number } | null = null;
    try {
      const cookieStore = await cookies();
      const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() { return cookieStore.getAll(); },
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

    // Se não é admin e não tem colaborador_id, não pode ver nada
    if (!isAdmin && !userColaboradorId) {
      return NextResponse.json({
        comissoes: [],
        historico: [],
        colaboradores: [],
        formasPagamento: [],
        _userProfile: { isAdmin: false, colaboradorId: null },
        _error: 'Usuário não vinculado a colaborador'
      });
    }

    // Buscar formas de pagamento com taxas
    const { data: formasPagamento } = await supabase
      .from('formas_pagamento')
      .select('codigo, nome, taxa_percentual')
      .eq('ativo', true);

    const taxasPorForma: Record<string, number> = {};
    (formasPagamento || []).forEach((fp: any) => {
      taxasPorForma[fp.codigo] = fp.taxa_percentual || 0;
    });

    // Buscar colaboradores
    const { data: colaboradores } = await supabase
      .from('colaboradores')
      .select('id, nome, porcentagem_comissao')
      .order('nome');

    // Definir período padrão (mês atual)
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const periodoInicio = dataInicio || primeiroDiaMes.toISOString().split('T')[0];
    const periodoFim = dataFim || ultimoDiaMes.toISOString().split('T')[0];

    // Buscar lançamentos do período
    // IMPORTANTE: Excluir fiados (is_fiado=true) e troca/grátis (is_troca_gratis=true)
    // Fiados pagos serão incluídos separadamente via pagamentos_fiado
    let query = supabase
      .from('lancamentos')
      .select(`
        id,
        colaborador_id,
        valor_total,
        forma_pagamento,
        comissao_colaborador,
        data,
        status,
        servicos_nomes,
        compartilhado,
        is_fiado,
        is_troca_gratis,
        clientes!fk_lancamentos_cliente(nome)
      `)
      .gte('data', periodoInicio)
      .lte('data', periodoFim)
      .eq('status', 'concluido')
      .order('data', { ascending: true });

    // Filtro por colaborador (apenas para não-compartilhados, compartilhados serão tratados separadamente)
    // Para admin ou filtro "todos", buscar todos os lançamentos
    // Para usuário comum, também buscar todos e filtrar depois

    const { data: lancamentos, error: lancError } = await query;

    if (lancError) {
      console.error('Erro ao buscar lançamentos:', lancError);
      return NextResponse.json({ error: lancError.message }, { status: 500 });
    }

    // Buscar lançamentos já pagos no período
    const { data: pagamentosExistentes } = await supabase
      .from('pagamentos_comissao')
      .select('lancamentos_ids')
      .gte('periodo_inicio', periodoInicio)
      .lte('periodo_fim', periodoFim);

    // Criar set de lançamentos já pagos
    const lancamentosPagos = new Set<number>();
    (pagamentosExistentes || []).forEach((p: any) => {
      (p.lancamentos_ids || []).forEach((id: number) => lancamentosPagos.add(id));
    });

    // Buscar divisões para lançamentos compartilhados
    const lancamentosIds = (lancamentos || []).map((l: any) => l.id);
    let divisoesMap: Record<number, any[]> = {};

    if (lancamentosIds.length > 0) {
      const { data: divisoes } = await supabase
        .from('lancamento_divisoes')
        .select('lancamento_id, colaborador_id, valor, comissao_calculada')
        .in('lancamento_id', lancamentosIds);

      (divisoes || []).forEach((div: any) => {
        if (!divisoesMap[div.lancamento_id]) {
          divisoesMap[div.lancamento_id] = [];
        }
        divisoesMap[div.lancamento_id].push(div);
      });
    }

    // Calcular comissões por colaborador
    const comissoesPorColaborador: Record<number, ComissaoCalculada> = {};

    // Função auxiliar para adicionar comissão a um colaborador
    const adicionarComissao = (
      colabId: number,
      colabNome: string,
      lancId: number,
      lancData: string,
      servicosNomes: string,
      clienteNome: string,
      valorServico: number,
      comissaoBruta: number,
      formaPagamento: string,
      taxaAplicada: number,
      compartilhado: boolean
    ) => {
      const desconto = (comissaoBruta * taxaAplicada) / 100;
      const comissaoLiquida = comissaoBruta - desconto;

      if (!comissoesPorColaborador[colabId]) {
        comissoesPorColaborador[colabId] = {
          colaborador_id: colabId,
          colaborador_nome: colabNome,
          total_servicos: 0,
          total_bruto: 0,
          total_descontos: 0,
          total_liquido: 0,
          lancamentos: [],
        };
      }

      comissoesPorColaborador[colabId].total_servicos++;
      comissoesPorColaborador[colabId].total_bruto += comissaoBruta;
      comissoesPorColaborador[colabId].total_descontos += desconto;
      comissoesPorColaborador[colabId].total_liquido += comissaoLiquida;
      comissoesPorColaborador[colabId].lancamentos.push({
        id: lancId,
        data: lancData,
        servicos: servicosNomes + (compartilhado ? ' (compartilhado)' : ''),
        cliente: clienteNome,
        valor_servico: valorServico,
        comissao_bruta: comissaoBruta,
        forma_pagamento: formaPagamento,
        taxa_aplicada: taxaAplicada,
        desconto: desconto,
        comissao_liquida: comissaoLiquida,
      });
    };

    // Processar lançamentos normais (excluir is_fiado e is_troca_gratis)
    (lancamentos || []).forEach((lanc: any) => {
      // Pular se já foi pago
      if (lancamentosPagos.has(lanc.id)) return;

      // IMPORTANTE: Pular fiados e troca/grátis - fiados pagos são tratados separadamente
      if (lanc.is_fiado || lanc.is_troca_gratis) return;

      const formaPagamento = lanc.forma_pagamento || 'dinheiro';
      const taxaAplicada = taxasPorForma[formaPagamento] || 0;
      const clienteNome = lanc.clientes?.nome || 'Cliente não identificado';
      const servicosNomes = lanc.servicos_nomes || 'Serviço não especificado';

      // Verificar se é lançamento compartilhado
      const divisoes = divisoesMap[lanc.id] || [];

      if (lanc.compartilhado && divisoes.length > 0) {
        // Lançamento compartilhado: calcular comissão para cada colaborador na divisão
        divisoes.forEach((div: any) => {
          const colaborador = colaboradores?.find((c: any) => c.id === div.colaborador_id);
          if (!colaborador) return;

          // Filtrar por colaborador se necessário
          if (colaboradorId && colaboradorId !== 'todos' && div.colaborador_id !== Number(colaboradorId)) return;
          if (!isAdmin && userColaboradorId && div.colaborador_id !== userColaboradorId) return;

          const valorDivisao = div.valor || 0;
          const porcentagemComissao = colaborador.porcentagem_comissao || 50;
          const comissaoBruta = div.comissao_calculada || (valorDivisao * porcentagemComissao / 100);

          adicionarComissao(
            div.colaborador_id,
            colaborador.nome,
            lanc.id,
            lanc.data,
            servicosNomes,
            clienteNome,
            valorDivisao,
            comissaoBruta,
            formaPagamento,
            taxaAplicada,
            true
          );
        });
      } else {
        // Lançamento simples: usar lógica original
        const colaborador = colaboradores?.find((c: any) => c.id === lanc.colaborador_id);
        if (!colaborador) return;

        // Filtrar por colaborador se necessário
        if (colaboradorId && colaboradorId !== 'todos' && lanc.colaborador_id !== Number(colaboradorId)) return;
        if (!isAdmin && userColaboradorId && lanc.colaborador_id !== userColaboradorId) return;

        const valorServico = lanc.valor_total || 0;
        const porcentagemComissao = colaborador.porcentagem_comissao || 50;
        const comissaoBruta = lanc.comissao_colaborador || (valorServico * porcentagemComissao / 100);

        adicionarComissao(
          lanc.colaborador_id,
          colaborador.nome,
          lanc.id,
          lanc.data,
          servicosNomes,
          clienteNome,
          valorServico,
          comissaoBruta,
          formaPagamento,
          taxaAplicada,
          false
        );
      }
    });

    // Buscar pagamentos de fiado do período (fiados que foram pagos)
    // A comissão do fiado é calculada no momento do pagamento
    const { data: pagamentosFiado } = await supabase
      .from('pagamentos_fiado')
      .select(`
        id,
        lancamento_id,
        valor_pago,
        forma_pagamento,
        data_pagamento,
        comissao_colaborador,
        lancamento:lancamentos(
          id,
          colaborador_id,
          servicos_nomes,
          data,
          cliente:clientes!fk_lancamentos_cliente(nome),
          colaborador:colaboradores!fk_lancamentos_colaborador(nome)
        )
      `)
      .gte('data_pagamento', periodoInicio)
      .lte('data_pagamento', periodoFim);

    // Processar pagamentos de fiado como comissões
    (pagamentosFiado || []).forEach((pag: any) => {
      if (!pag.lancamento) return;

      const lanc = pag.lancamento;
      const colaborador = colaboradores?.find((c: any) => c.id === lanc.colaborador_id);
      if (!colaborador) return;

      // Filtrar por colaborador se necessário
      if (colaboradorId && colaboradorId !== 'todos' && lanc.colaborador_id !== Number(colaboradorId)) return;
      if (!isAdmin && userColaboradorId && lanc.colaborador_id !== userColaboradorId) return;

      // Pular se já foi pago em pagamentos_comissao
      if (lancamentosPagos.has(lanc.id)) return;

      const clienteNome = lanc.cliente?.nome || 'Cliente não identificado';
      const servicosNomes = lanc.servicos_nomes || 'Serviço não especificado';
      const formaPagamento = pag.forma_pagamento || 'dinheiro';
      const taxaAplicada = taxasPorForma[formaPagamento] || 0;

      // A comissão do fiado já foi calculada com taxa no momento do pagamento
      // Então usamos diretamente o valor gravado (comissao_colaborador já é líquido)
      const comissaoBruta = pag.comissao_colaborador || 0;

      adicionarComissao(
        lanc.colaborador_id,
        colaborador.nome,
        lanc.id,
        pag.data_pagamento, // Usar data do pagamento, não do serviço
        servicosNomes + ' (Fiado pago)',
        clienteNome,
        pag.valor_pago,
        comissaoBruta,
        formaPagamento,
        0, // Taxa já está incluída no cálculo de comissão do fiado
        false
      );
    });

    const comissoes = Object.values(comissoesPorColaborador);

    // Buscar histórico de pagamentos
    let historicoQuery = supabase
      .from('pagamentos_comissao')
      .select(`
        *,
        colaborador:colaboradores(nome),
        admin:profiles!pagamentos_comissao_pago_por_fkey(nome)
      `)
      .order('pago_em', { ascending: false })
      .limit(50);

    if (!isAdmin && userColaboradorId) {
      historicoQuery = historicoQuery.eq('colaborador_id', userColaboradorId);
    }

    const { data: historico } = await historicoQuery;

    return NextResponse.json({
      comissoes,
      historico: historico || [],
      colaboradores: isAdmin ? colaboradores : colaboradores?.filter((c: any) => c.id === userColaboradorId),
      formasPagamento: formasPagamento || [],
      periodo: { inicio: periodoInicio, fim: periodoFim },
      _userProfile: { isAdmin, colaboradorId: userColaboradorId },
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });

  } catch (error: any) {
    console.error('Erro na API de comissões:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
