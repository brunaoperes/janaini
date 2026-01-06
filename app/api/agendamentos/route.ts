import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      colaborador_id,
      cliente_id,
      data_hora,
      descricao_servico,
      duracao_minutos,
      valor_estimado,
      hora_inicio,
      hora_fim,
    } = body;

    console.log('[API/agendamentos] Criando agendamento:', { colaborador_id, cliente_id, data_hora });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Buscar colaborador para calcular comissão
    const { data: colaborador } = await supabase
      .from('colaboradores')
      .select('porcentagem_comissao')
      .eq('id', colaborador_id)
      .single();

    const porcentagemComissao = colaborador?.porcentagem_comissao || 50;
    const comissaoColaborador = (valor_estimado * porcentagemComissao) / 100;
    const comissaoSalao = valor_estimado - comissaoColaborador;

    // 1. Criar lançamento primeiro (pendente)
    const { data: lancamento, error: lancError } = await supabase
      .from('lancamentos')
      .insert({
        colaborador_id,
        cliente_id,
        valor_total: valor_estimado,
        comissao_colaborador: comissaoColaborador,
        comissao_salao: comissaoSalao,
        data: data_hora,
        hora_inicio,
        hora_fim: hora_fim || hora_inicio,
        servicos_nomes: descricao_servico,
        status: 'pendente',
      })
      .select()
      .single();

    if (lancError) {
      console.error('[API/agendamentos] Erro ao criar lançamento:', lancError);
      return NextResponse.json({ error: lancError.message }, { status: 500 });
    }

    console.log('[API/agendamentos] Lançamento criado:', lancamento.id);

    // 2. Criar agendamento vinculado ao lançamento
    const { data: agendamento, error: agendError } = await supabase
      .from('agendamentos')
      .insert({
        colaborador_id,
        cliente_id,
        data_hora,
        descricao_servico,
        duracao_minutos,
        valor_estimado,
        lancamento_id: lancamento.id,
        status: 'pendente',
      })
      .select()
      .single();

    if (agendError) {
      console.error('[API/agendamentos] Erro ao criar agendamento:', agendError);
      // Rollback: deletar lançamento criado
      await supabase.from('lancamentos').delete().eq('id', lancamento.id);
      return NextResponse.json({ error: agendError.message }, { status: 500 });
    }

    console.log('[API/agendamentos] Agendamento criado:', agendamento.id);

    return NextResponse.json({
      success: true,
      agendamento,
      lancamento,
    });

  } catch (error: any) {
    console.error('[API/agendamentos] Erro fatal:', error);
    return NextResponse.json({ error: 'Erro ao criar agendamento' }, { status: 500 });
  }
}
