import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auditCreate } from '@/lib/audit';
import { mensalidadePagamentoSchema, formatZodErrors } from '@/lib/validations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      isAdmin: profile?.role === 'admin',
    };
  } catch {
    return null;
  }
}

// GET - Listar cobranças (com filtros)
// Params: pacoteId, status (pendente|paga|atrasada|todas), proximosDias (alerta dashboard)
export async function GET(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Atualizar status "atrasada" pra cobranças vencidas
    await supabase.rpc('marcar_mensalidades_atrasadas');

    const { searchParams } = new URL(request.url);
    const pacoteId = searchParams.get('pacoteId');
    const status = searchParams.get('status');
    const proximosDias = searchParams.get('proximosDias'); // ex: 7

    let query = supabase
      .from('mensalidade_cobrancas')
      .select(`
        *,
        pacote:pacotes(
          id, nome, tipo, cliente_id, colaborador_vendedor_id, valor_mensal,
          cliente:clientes(id, nome, telefone),
          colaborador_vendedor:colaboradores!pacotes_colaborador_vendedor_id_fkey(id, nome, porcentagem_comissao)
        )
      `)
      .order('data_vencimento', { ascending: true });

    if (pacoteId) {
      query = query.eq('pacote_id', parseInt(pacoteId, 10));
    }
    if (status && status !== 'todas') {
      query = query.eq('status', status);
    }
    if (proximosDias) {
      const hoje = new Date().toISOString().split('T')[0];
      const futuro = new Date();
      futuro.setDate(futuro.getDate() + parseInt(proximosDias, 10));
      const futuroStr = futuro.toISOString().split('T')[0];
      query = query.gte('data_vencimento', hoje).lte('data_vencimento', futuroStr).neq('status', 'paga');
    }

    const { data: cobrancas, error } = await query;

    if (error) {
      console.error('[API/pacotes/cobrancas] Erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      cobrancas: cobrancas || [],
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });

  } catch (error: unknown) {
    console.error('[API/pacotes/cobrancas] Erro fatal GET:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Registrar pagamento de uma cobrança
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = mensalidadePagamentoSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: formatZodErrors(validation.error) },
        { status: 400 }
      );
    }

    const data = validation.data;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Buscar cobrança + pacote + colaborador
    const { data: cobranca, error: cobError } = await supabase
      .from('mensalidade_cobrancas')
      .select(`
        *,
        pacote:pacotes(
          id, cliente_id, servico_id, colaborador_vendedor_id, nome,
          servico:servicos(nome),
          colaborador_vendedor:colaboradores!pacotes_colaborador_vendedor_id_fkey(id, nome, porcentagem_comissao)
        )
      `)
      .eq('id', data.cobranca_id)
      .single();

    if (cobError || !cobranca) {
      return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 });
    }

    if (cobranca.status === 'paga') {
      return NextResponse.json({ error: 'Cobrança já está paga' }, { status: 400 });
    }

    if (cobranca.status === 'cancelada') {
      return NextResponse.json({ error: 'Cobrança cancelada não pode ser paga' }, { status: 400 });
    }

    const pacote = cobranca.pacote;
    if (!pacote) {
      return NextResponse.json({ error: 'Pacote vinculado não encontrado' }, { status: 404 });
    }

    // Calcular comissão da cobrança paga
    const colaboradorVendedor = pacote.colaborador_vendedor;
    const porcentagemComissao = colaboradorVendedor?.porcentagem_comissao || 50;
    const valorPago = Number(cobranca.valor);

    // Taxa da forma de pagamento
    const { data: formaPgto } = await supabase
      .from('formas_pagamento')
      .select('taxa_percentual')
      .eq('codigo', data.forma_pagamento)
      .single();
    const taxaPercentual = formaPgto?.taxa_percentual || 0;

    const comissaoBruta = (valorPago * porcentagemComissao) / 100;
    const valorTaxa = (comissaoBruta * taxaPercentual) / 100;
    const comissaoVendedor = comissaoBruta - valorTaxa;
    const comissaoSalao = valorPago - comissaoVendedor;

    const authUser = await getAuthUser(supabase);
    const dataPagamento = data.data_pagamento || new Date().toISOString();
    const mesRefDate = new Date(cobranca.mes_referencia);
    const mesNome = mesRefDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    // Criar lançamento financeiro
    const lancamentoData = {
      colaborador_id: pacote.colaborador_vendedor_id,
      cliente_id: pacote.cliente_id,
      valor_total: valorPago,
      comissao_colaborador: comissaoVendedor,
      comissao_salao: comissaoSalao,
      taxa_pagamento: valorTaxa,
      data: dataPagamento.split('T')[0],
      servicos_ids: [pacote.servico_id],
      servicos_nomes: `Mensalidade ${pacote.servico?.nome || ''} - ${mesNome}`,
      status: 'concluido',
      forma_pagamento: data.forma_pagamento,
      data_pagamento: dataPagamento,
      tipo_lancamento: 'pacote_venda',
      pacote_id: pacote.id,
      observacoes: data.observacoes || null,
    };

    const { data: lancamento, error: lancError } = await supabase
      .from('lancamentos')
      .insert(lancamentoData)
      .select()
      .single();

    if (lancError) {
      console.error('[API/pacotes/cobrancas] Erro ao criar lançamento:', lancError);
      return NextResponse.json({ error: lancError.message }, { status: 500 });
    }

    // Atualizar cobrança
    const { data: cobAtualizada, error: updateError } = await supabase
      .from('mensalidade_cobrancas')
      .update({
        status: 'paga',
        data_pagamento: dataPagamento,
        forma_pagamento: data.forma_pagamento,
        lancamento_id: lancamento.id,
        observacoes: data.observacoes || cobranca.observacoes,
      })
      .eq('id', data.cobranca_id)
      .select()
      .single();

    if (updateError) {
      // Rollback do lançamento
      await supabase.from('lancamentos').delete().eq('id', lancamento.id);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (authUser) {
      await auditCreate({
        ...authUser,
        modulo: 'Lancamentos',
        tabela: 'mensalidade_cobrancas',
        registroId: data.cobranca_id,
        dadosNovo: { ...cobAtualizada, lancamento_criado: lancamento.id },
        metodo: 'POST',
        endpoint: '/api/pacotes/cobrancas',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Mensalidade de ${mesNome} registrada!`,
      cobranca: cobAtualizada,
      lancamento,
    });

  } catch (error: unknown) {
    console.error('[API/pacotes/cobrancas] Erro fatal POST:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
