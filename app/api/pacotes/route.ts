import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auditCreate, auditUpdate, auditDelete } from '@/lib/audit';
import { pacoteCreateSchema, pacoteUpdateSchema, formatZodErrors } from '@/lib/validations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

// Helper para obter dados do usuário autenticado
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
      .select('nome, role, colaborador_id')
      .eq('id', user.id)
      .single();

    return {
      userId: user.id,
      userEmail: user.email || undefined,
      userName: profile?.nome,
      userRole: profile?.role,
      colaboradorId: profile?.colaborador_id,
      isAdmin: profile?.role === 'admin',
    };
  } catch {
    return null;
  }
}

// GET - Listar pacotes
export async function GET(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar permissões do usuário
    const authUser = await getAuthUser(supabase);
    const isAdmin = authUser?.isAdmin || false;
    const userColaboradorId = authUser?.colaboradorId;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const clienteId = searchParams.get('clienteId');
    let colaboradorId = searchParams.get('colaboradorId');

    // PERMISSÃO: Se não for admin, forçar filtro pelo seu colaborador_id
    if (!isAdmin && userColaboradorId) {
      colaboradorId = userColaboradorId.toString();
    }

    // Verificar pacotes expirados antes de buscar
    await supabase.rpc('verificar_pacotes_expirados');

    // Query base com relacionamentos
    let query = supabase
      .from('pacotes')
      .select(`
        *,
        cliente:clientes(id, nome, telefone),
        servico:servicos(id, nome, valor, duracao_minutos),
        colaborador_vendedor:colaboradores!pacotes_colaborador_vendedor_id_fkey(id, nome, porcentagem_comissao)
      `)
      .order('created_at', { ascending: false });

    // Filtros
    if (status && status !== 'todos') {
      query = query.eq('status', status);
    }
    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }
    if (colaboradorId) {
      query = query.eq('colaborador_vendedor_id', colaboradorId);
    }

    const { data: pacotes, error } = await query;

    if (error) {
      console.error('[API/pacotes] Erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Buscar dados auxiliares para o formulário
    const [clientesRes, colaboradoresRes, servicosRes, formasRes] = await Promise.all([
      supabase.from('clientes').select('id, nome, telefone').order('nome'),
      supabase.from('colaboradores').select('id, nome, porcentagem_comissao').order('nome'),
      supabase.from('servicos').select('id, nome, valor, duracao_minutos').eq('ativo', true).order('nome'),
      supabase.from('formas_pagamento').select('codigo, nome, icone, taxa_percentual').eq('ativo', true).not('codigo', 'in', '(fiado,troca_gratis)').order('ordem'),
    ]);

    // Calcular totais
    const totais = {
      ativos: (pacotes || []).filter(p => p.status === 'ativo').length,
      expirados: (pacotes || []).filter(p => p.status === 'expirado').length,
      concluidos: (pacotes || []).filter(p => p.status === 'concluido').length,
      cancelados: (pacotes || []).filter(p => p.status === 'cancelado').length,
      valor_total_vendas: (pacotes || []).filter(p => p.status !== 'cancelado').reduce((sum, p) => sum + (p.valor_total || 0), 0),
    };

    return NextResponse.json({
      pacotes: pacotes || [],
      totais,
      clientes: clientesRes.data || [],
      colaboradores: colaboradoresRes.data || [],
      servicos: servicosRes.data || [],
      formasPagamento: formasRes.data || [],
      _userProfile: {
        isAdmin,
        colaboradorId: userColaboradorId,
      },
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error: unknown) {
    console.error('[API/pacotes] Erro fatal:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Helper: calcula data de vencimento dentro de um mês de referência
function dataVencimentoNoMes(mesReferencia: Date, diaVencimento: number): string {
  const ano = mesReferencia.getFullYear();
  const mes = mesReferencia.getMonth(); // 0-indexed
  // Último dia do mês
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const diaEfetivo = Math.min(diaVencimento, ultimoDia);
  const data = new Date(ano, mes, diaEfetivo);
  return data.toISOString().split('T')[0];
}

// POST - Criar novo pacote (venda)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar com Zod (discriminated union pelo campo "tipo")
    const validation = pacoteCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: formatZodErrors(validation.error) },
        { status: 400 }
      );
    }

    const data = validation.data;
    const tipo = data.tipo;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Buscar dados do serviço, colaborador e forma de pagamento
    const [servicoRes, colaboradorRes, formaPgtoRes] = await Promise.all([
      supabase.from('servicos').select('nome, valor').eq('id', data.servico_id).single(),
      supabase.from('colaboradores').select('nome, porcentagem_comissao').eq('id', data.colaborador_vendedor_id).single(),
      supabase.from('formas_pagamento').select('taxa_percentual').eq('codigo', data.forma_pagamento).single(),
    ]);

    const servico = servicoRes.data;
    const colaborador = colaboradorRes.data;
    const taxaPercentual = formaPgtoRes.data?.taxa_percentual || 0;

    if (!servico || !colaborador) {
      return NextResponse.json({ error: 'Serviço ou colaborador não encontrado' }, { status: 404 });
    }

    const porcentagemComissao = colaborador.porcentagem_comissao || 50;
    const authUser = await getAuthUser(supabase);

    if (tipo === 'sessoes') {
      // ===== PACOTE POR SESSÕES =====
      const valorPorSessao = data.quantidade_total > 0
        ? data.valor_total / data.quantidade_total
        : 0;
      const comissaoBruta = (data.valor_total * porcentagemComissao) / 100;
      const valorTaxa = (comissaoBruta * taxaPercentual) / 100;
      const comissaoVendedor = comissaoBruta - valorTaxa;
      const comissaoSalao = data.valor_total - comissaoVendedor;

      const lancamentoData = {
        colaborador_id: data.colaborador_vendedor_id,
        cliente_id: data.cliente_id,
        valor_total: data.valor_total,
        comissao_colaborador: comissaoVendedor,
        comissao_salao: comissaoSalao,
        taxa_pagamento: valorTaxa,
        data: new Date().toISOString().split('T')[0],
        servicos_ids: [data.servico_id],
        servicos_nomes: `Venda Pacote: ${servico.nome} (${data.quantidade_total} sessões)`,
        status: 'concluido',
        forma_pagamento: data.forma_pagamento,
        data_pagamento: new Date().toISOString(),
        tipo_lancamento: 'pacote_venda',
        observacoes: data.observacoes || null,
      };

      const { data: lancamento, error: lancError } = await supabase
        .from('lancamentos')
        .insert(lancamentoData)
        .select()
        .single();

      if (lancError) {
        console.error('[API/pacotes] Erro ao criar lançamento:', lancError);
        return NextResponse.json({ error: lancError.message }, { status: 500 });
      }

      const nomePacote = `Pacote ${data.quantidade_total} Sessões - ${servico.nome}`;
      const pacoteData = {
        tipo: 'sessoes',
        cliente_id: data.cliente_id,
        servico_id: data.servico_id,
        colaborador_vendedor_id: data.colaborador_vendedor_id,
        lancamento_venda_id: lancamento.id,
        nome: nomePacote,
        quantidade_total: data.quantidade_total,
        quantidade_usada: 0,
        valor_total: data.valor_total,
        valor_por_sessao: valorPorSessao,
        desconto_percentual: data.desconto_percentual || 0,
        comissao_vendedor: comissaoVendedor,
        comissao_salao: comissaoSalao,
        data_venda: new Date().toISOString().split('T')[0],
        data_validade: data.data_validade || null,
        status: 'ativo',
        forma_pagamento: data.forma_pagamento,
        observacoes: data.observacoes || null,
      };

      const { data: pacote, error: pacoteError } = await supabase
        .from('pacotes')
        .insert(pacoteData)
        .select(`
          *,
          cliente:clientes(id, nome),
          servico:servicos(id, nome),
          colaborador_vendedor:colaboradores!pacotes_colaborador_vendedor_id_fkey(id, nome)
        `)
        .single();

      if (pacoteError) {
        await supabase.from('lancamentos').delete().eq('id', lancamento.id);
        return NextResponse.json({ error: pacoteError.message }, { status: 500 });
      }

      await supabase.from('lancamentos').update({ pacote_id: pacote.id }).eq('id', lancamento.id);

      if (authUser) {
        await auditCreate({
          ...authUser,
          modulo: 'Lancamentos',
          tabela: 'pacotes',
          registroId: pacote.id,
          dadosNovo: pacote,
          metodo: 'POST',
          endpoint: '/api/pacotes',
        });
      }

      return NextResponse.json({ success: true, message: 'Pacote criado!', pacote, lancamento });
    }

    // ===== MENSALIDADE =====
    // Cria o pacote sem lançamento financeiro inicial (cobranças mensais serão pagas individualmente)
    const nomePacote = `Mensalidade ${servico.nome} (${data.sessoes_por_mes}/mês, ${data.duracao_meses} meses)`;
    // quantidade_total = sessoes_por_mes × duracao_meses (limite total do contrato)
    const quantidadeTotal = data.sessoes_por_mes * data.duracao_meses;
    const valorContratoTotal = data.valor_mensal * data.duracao_meses;

    const pacoteData = {
      tipo: 'mensalidade',
      cliente_id: data.cliente_id,
      servico_id: data.servico_id,
      colaborador_vendedor_id: data.colaborador_vendedor_id,
      lancamento_venda_id: null,
      nome: nomePacote,
      quantidade_total: quantidadeTotal,
      quantidade_usada: 0,
      valor_total: valorContratoTotal,
      valor_por_sessao: data.valor_mensal / data.sessoes_por_mes,
      desconto_percentual: 0,
      comissao_vendedor: 0, // calculado a cada cobrança paga
      comissao_salao: 0,
      data_venda: new Date().toISOString().split('T')[0],
      data_validade: null, // controlado por cobranças
      status: 'ativo',
      forma_pagamento: data.forma_pagamento,
      observacoes: data.observacoes || null,
      // Campos mensalidade
      valor_mensal: data.valor_mensal,
      sessoes_por_mes: data.sessoes_por_mes,
      duracao_meses: data.duracao_meses,
      dia_vencimento: data.dia_vencimento,
    };

    const { data: pacote, error: pacoteError } = await supabase
      .from('pacotes')
      .insert(pacoteData)
      .select(`
        *,
        cliente:clientes(id, nome),
        servico:servicos(id, nome),
        colaborador_vendedor:colaboradores!pacotes_colaborador_vendedor_id_fkey(id, nome)
      `)
      .single();

    if (pacoteError) {
      console.error('[API/pacotes] Erro ao criar mensalidade:', pacoteError);
      return NextResponse.json({ error: pacoteError.message }, { status: 500 });
    }

    // Gerar cobranças mensais (uma por mês de contrato)
    const hoje = new Date();
    const cobrancas: any[] = [];
    for (let i = 0; i < data.duracao_meses; i++) {
      const mesRef = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const dataVenc = dataVencimentoNoMes(mesRef, data.dia_vencimento);
      cobrancas.push({
        pacote_id: pacote.id,
        mes_referencia: mesRef.toISOString().split('T')[0],
        data_vencimento: dataVenc,
        valor: data.valor_mensal,
        status: 'pendente',
      });
    }

    const { error: cobError } = await supabase
      .from('mensalidade_cobrancas')
      .insert(cobrancas);

    if (cobError) {
      console.error('[API/pacotes] Erro ao gerar cobranças:', cobError);
      await supabase.from('pacotes').delete().eq('id', pacote.id);
      return NextResponse.json({ error: 'Erro ao gerar cobranças: ' + cobError.message }, { status: 500 });
    }

    if (authUser) {
      await auditCreate({
        ...authUser,
        modulo: 'Lancamentos',
        tabela: 'pacotes',
        registroId: pacote.id,
        dadosNovo: { ...pacote, cobrancas_geradas: cobrancas.length },
        metodo: 'POST',
        endpoint: '/api/pacotes',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Mensalidade criada com ${cobrancas.length} cobranças mensais!`,
      pacote,
    });

  } catch (error: unknown) {
    console.error('[API/pacotes] Erro fatal POST:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Editar pacote
export async function PUT(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar permissões
    const authUser = await getAuthUser(supabase);
    if (!authUser?.isAdmin) {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem editar pacotes.' }, { status: 403 });
    }

    const body = await request.json();

    // Validar com Zod
    const validation = pacoteUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: formatZodErrors(validation.error) },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Buscar pacote atual
    const { data: pacoteAtual, error: fetchError } = await supabase
      .from('pacotes')
      .select('*')
      .eq('id', data.pacote_id)
      .single();

    if (fetchError || !pacoteAtual) {
      return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 });
    }

    const tipoPacote = pacoteAtual.tipo || 'sessoes';

    // Pacote por sessões: validar quantidade_total >= quantidade_usada
    if (tipoPacote === 'sessoes' && typeof data.quantidade_total === 'number' && data.quantidade_total < pacoteAtual.quantidade_usada) {
      return NextResponse.json(
        { error: `Quantidade total não pode ser menor que as sessões já usadas (${pacoteAtual.quantidade_usada})` },
        { status: 400 }
      );
    }

    // Buscar dados do serviço, colaborador e forma de pagamento
    const [servicoRes, colaboradorRes, formaPgtoRes] = await Promise.all([
      supabase.from('servicos').select('nome, valor').eq('id', data.servico_id).single(),
      supabase.from('colaboradores').select('nome, porcentagem_comissao').eq('id', data.colaborador_vendedor_id).single(),
      supabase.from('formas_pagamento').select('taxa_percentual').eq('codigo', data.forma_pagamento).single(),
    ]);

    const servico = servicoRes.data;
    const colaborador = colaboradorRes.data;
    const taxaPercentual = formaPgtoRes.data?.taxa_percentual || 0;

    if (!servico || !colaborador) {
      return NextResponse.json({ error: 'Serviço ou colaborador não encontrado' }, { status: 404 });
    }

    const porcentagemComissao = colaborador.porcentagem_comissao || 50;

    // Montar update payload conforme o tipo
    let updatePayload: Record<string, unknown>;
    let nomePacote: string;
    let valorTaxa = 0;
    let comissaoVendedor = 0;
    let comissaoSalao = 0;

    if (tipoPacote === 'sessoes') {
      const valorTotal = data.valor_total || pacoteAtual.valor_total || 0;
      const quantidadeTotal = data.quantidade_total || pacoteAtual.quantidade_total || 1;
      const valorPorSessao = quantidadeTotal > 0 ? valorTotal / quantidadeTotal : 0;
      const comissaoBruta = (valorTotal * porcentagemComissao) / 100;
      valorTaxa = (comissaoBruta * taxaPercentual) / 100;
      comissaoVendedor = comissaoBruta - valorTaxa;
      comissaoSalao = valorTotal - comissaoVendedor;
      nomePacote = `Pacote ${quantidadeTotal} Sessões - ${servico.nome}`;

      updatePayload = {
        cliente_id: data.cliente_id,
        servico_id: data.servico_id,
        colaborador_vendedor_id: data.colaborador_vendedor_id,
        nome: nomePacote,
        quantidade_total: quantidadeTotal,
        valor_total: valorTotal,
        valor_por_sessao: valorPorSessao,
        desconto_percentual: data.desconto_percentual || 0,
        comissao_vendedor: comissaoVendedor,
        comissao_salao: comissaoSalao,
        data_validade: data.data_validade || null,
        forma_pagamento: data.forma_pagamento,
        observacoes: data.observacoes || null,
      };
    } else {
      // Mensalidade — atualiza só campos editáveis sem regenerar cobranças
      const valorMensal = data.valor_mensal ?? pacoteAtual.valor_mensal ?? 0;
      const sessoesPorMes = data.sessoes_por_mes ?? pacoteAtual.sessoes_por_mes ?? 0;
      const duracaoMeses = data.duracao_meses ?? pacoteAtual.duracao_meses ?? 0;
      nomePacote = `Mensalidade ${servico.nome} (${sessoesPorMes}/mês, ${duracaoMeses} meses)`;

      updatePayload = {
        cliente_id: data.cliente_id,
        servico_id: data.servico_id,
        colaborador_vendedor_id: data.colaborador_vendedor_id,
        nome: nomePacote,
        valor_mensal: valorMensal,
        sessoes_por_mes: sessoesPorMes,
        duracao_meses: duracaoMeses,
        dia_vencimento: data.dia_vencimento ?? pacoteAtual.dia_vencimento,
        forma_pagamento: data.forma_pagamento,
        observacoes: data.observacoes || null,
      };
    }

    // Atualizar pacote
    const { data: pacoteAtualizado, error: updateError } = await supabase
      .from('pacotes')
      .update(updatePayload)
      .eq('id', data.pacote_id)
      .select(`
        *,
        cliente:clientes(id, nome),
        servico:servicos(id, nome),
        colaborador_vendedor:colaboradores!pacotes_colaborador_vendedor_id_fkey(id, nome)
      `)
      .single();

    if (updateError) {
      console.error('[API/pacotes] Erro ao atualizar pacote:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Atualizar lançamento vinculado se existir (apenas pacote de sessões tem lancamento_venda_id)
    if (tipoPacote === 'sessoes' && pacoteAtual.lancamento_venda_id) {
      const valorTotal = data.valor_total || pacoteAtual.valor_total || 0;
      const quantidadeTotal = data.quantidade_total || pacoteAtual.quantidade_total || 1;
      await supabase
        .from('lancamentos')
        .update({
          colaborador_id: data.colaborador_vendedor_id,
          cliente_id: data.cliente_id,
          valor_total: valorTotal,
          comissao_colaborador: comissaoVendedor,
          comissao_salao: comissaoSalao,
          taxa_pagamento: valorTaxa,
          servicos_nomes: `Venda Pacote: ${servico.nome} (${quantidadeTotal} sessões)`,
          forma_pagamento: data.forma_pagamento,
        })
        .eq('id', pacoteAtual.lancamento_venda_id);
    }

    // Registrar auditoria
    await auditUpdate({
      ...authUser,
      modulo: 'Lancamentos',
      tabela: 'pacotes',
      registroId: data.pacote_id,
      dadosAnterior: pacoteAtual,
      dadosNovo: pacoteAtualizado,
      metodo: 'PUT',
      endpoint: '/api/pacotes',
    });

    return NextResponse.json({
      success: true,
      message: 'Pacote atualizado com sucesso!',
      pacote: pacoteAtualizado,
    });

  } catch (error: unknown) {
    console.error('[API/pacotes] Erro fatal PUT:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Excluir pacote
export async function DELETE(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar permissões
    const authUser = await getAuthUser(supabase);
    if (!authUser?.isAdmin) {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem excluir pacotes.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do pacote é obrigatório' }, { status: 400 });
    }

    const pacoteId = parseInt(id);

    // Buscar pacote para auditoria
    const { data: pacoteAtual, error: fetchError } = await supabase
      .from('pacotes')
      .select('*')
      .eq('id', pacoteId)
      .single();

    if (fetchError || !pacoteAtual) {
      return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 });
    }

    // Deletar pacote (pacote_usos CASCADE, lancamentos.pacote_id SET NULL)
    const { error: deleteError } = await supabase
      .from('pacotes')
      .delete()
      .eq('id', pacoteId);

    if (deleteError) {
      console.error('[API/pacotes] Erro ao excluir pacote:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Registrar auditoria
    await auditDelete({
      ...authUser,
      modulo: 'Lancamentos',
      tabela: 'pacotes',
      registroId: pacoteId,
      dadosAnterior: pacoteAtual,
      metodo: 'DELETE',
      endpoint: '/api/pacotes',
    });

    return NextResponse.json({
      success: true,
      message: 'Pacote excluído com sucesso!',
    });

  } catch (error: unknown) {
    console.error('[API/pacotes] Erro fatal DELETE:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
