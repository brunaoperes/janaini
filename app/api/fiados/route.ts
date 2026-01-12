import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auditCreate, auditUpdate } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

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

// GET - Listar fiados pendentes
export async function GET(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pendente'; // pendente, pago, todos
    const colaboradorId = searchParams.get('colaboradorId');
    const clienteId = searchParams.get('clienteId');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    // Buscar lançamentos marcados como fiado
    let query = supabase
      .from('lancamentos')
      .select(`
        *,
        cliente:clientes!fk_lancamentos_cliente(id, nome, telefone),
        colaborador:colaboradores!fk_lancamentos_colaborador(id, nome, porcentagem_comissao)
      `)
      .eq('is_fiado', true)
      .order('data', { ascending: false });

    // Filtro por status
    if (status === 'pendente') {
      query = query.eq('status', 'pendente');
    } else if (status === 'pago') {
      query = query.eq('status', 'concluido');
    }

    // Outros filtros
    if (colaboradorId) {
      query = query.eq('colaborador_id', colaboradorId);
    }
    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }
    if (dataInicio) {
      query = query.gte('data', dataInicio);
    }
    if (dataFim) {
      query = query.lte('data', dataFim);
    }

    const { data: fiados, error } = await query;

    if (error) {
      console.error('[API/fiados] Erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Para fiados pagos, buscar detalhes do pagamento
    const fiadosIds = (fiados || []).filter(f => f.status === 'concluido').map(f => f.id);
    let pagamentosMap: Record<number, any> = {};

    if (fiadosIds.length > 0) {
      const { data: pagamentos } = await supabase
        .from('pagamentos_fiado')
        .select('*')
        .in('lancamento_id', fiadosIds);

      (pagamentos || []).forEach(p => {
        pagamentosMap[p.lancamento_id] = p;
      });
    }

    // Combinar dados
    const fiadosComPagamento = (fiados || []).map(fiado => ({
      ...fiado,
      pagamento_fiado: pagamentosMap[fiado.id] || null,
    }));

    // Calcular totais
    const totalPendente = fiadosComPagamento
      .filter(f => f.status === 'pendente')
      .reduce((sum, f) => sum + (f.valor_total || 0), 0);

    const totalPago = fiadosComPagamento
      .filter(f => f.status === 'concluido')
      .reduce((sum, f) => sum + (f.pagamento_fiado?.valor_pago || f.valor_total || 0), 0);

    // Buscar colaboradores para filtro
    const { data: colaboradores } = await supabase
      .from('colaboradores')
      .select('id, nome')
      .order('nome');

    // Buscar formas de pagamento (exceto fiado e troca)
    const { data: formasPagamento } = await supabase
      .from('formas_pagamento')
      .select('codigo, nome')
      .eq('ativo', true)
      .not('codigo', 'in', '(fiado,troca_gratis)')
      .order('ordem');

    return NextResponse.json({
      fiados: fiadosComPagamento,
      totais: {
        pendente: totalPendente,
        pago: totalPago,
        quantidade_pendente: fiadosComPagamento.filter(f => f.status === 'pendente').length,
        quantidade_pago: fiadosComPagamento.filter(f => f.status === 'concluido').length,
      },
      colaboradores: colaboradores || [],
      formasPagamento: formasPagamento || [],
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error: any) {
    console.error('[API/fiados] Erro fatal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Marcar fiado como pago
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      lancamentoId,
      valorPago,
      formaPagamento,
      dataPagamento,
      observacoes,
    } = body;

    if (!lancamentoId || !valorPago || !formaPagamento || !dataPagamento) {
      return NextResponse.json(
        { error: 'Dados incompletos. Informe lancamentoId, valorPago, formaPagamento e dataPagamento.' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Buscar lançamento
    const { data: lancamento, error: lancError } = await supabase
      .from('lancamentos')
      .select(`
        *,
        colaborador:colaboradores!fk_lancamentos_colaborador(id, nome, porcentagem_comissao)
      `)
      .eq('id', lancamentoId)
      .single();

    if (lancError || !lancamento) {
      return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 });
    }

    if (!lancamento.is_fiado) {
      return NextResponse.json({ error: 'Este lançamento não é um fiado' }, { status: 400 });
    }

    if (lancamento.status === 'concluido') {
      return NextResponse.json({ error: 'Este fiado já foi pago' }, { status: 400 });
    }

    // Obter usuário autenticado
    const authUser = await getAuthUser(supabase);

    // Buscar taxa da forma de pagamento
    const { data: formaPgto } = await supabase
      .from('formas_pagamento')
      .select('taxa_percentual')
      .eq('codigo', formaPagamento)
      .single();

    const taxaPercentual = formaPgto?.taxa_percentual || 0;
    const porcentagemComissao = lancamento.colaborador?.porcentagem_comissao || 50;

    // Calcular comissão (com desconto da taxa se houver)
    const comissaoBruta = (valorPago * porcentagemComissao) / 100;
    const descontoTaxa = (comissaoBruta * taxaPercentual) / 100;
    const comissaoLiquida = comissaoBruta - descontoTaxa;
    const comissaoSalao = valorPago - comissaoLiquida;

    // Criar registro de pagamento
    const { data: pagamento, error: pagError } = await supabase
      .from('pagamentos_fiado')
      .insert({
        lancamento_id: lancamentoId,
        valor_pago: valorPago,
        forma_pagamento: formaPagamento,
        data_pagamento: dataPagamento,
        registrado_por: authUser?.userId,
        registrado_por_nome: authUser?.userName,
        observacoes,
        comissao_colaborador: comissaoLiquida,
        comissao_salao: comissaoSalao,
      })
      .select()
      .single();

    if (pagError) {
      console.error('[API/fiados] Erro ao criar pagamento:', pagError);
      return NextResponse.json({ error: pagError.message }, { status: 500 });
    }

    // Atualizar lançamento para concluído
    const { error: updateError } = await supabase
      .from('lancamentos')
      .update({
        status: 'concluido',
        data_pagamento: dataPagamento,
      })
      .eq('id', lancamentoId);

    if (updateError) {
      console.error('[API/fiados] Erro ao atualizar lançamento:', updateError);
      // Rollback: deletar pagamento
      await supabase.from('pagamentos_fiado').delete().eq('id', pagamento.id);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Registrar auditoria
    if (authUser) {
      await auditCreate({
        ...authUser,
        modulo: 'Lancamentos',
        tabela: 'pagamentos_fiado',
        registroId: pagamento.id,
        dadosNovo: {
          ...pagamento,
          lancamento_original: lancamento,
        },
        metodo: 'POST',
        endpoint: '/api/fiados',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Fiado marcado como pago com sucesso!',
      pagamento,
    });

  } catch (error: any) {
    console.error('[API/fiados] Erro fatal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
