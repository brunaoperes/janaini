import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

// GET - Buscar pacotes ativos de um cliente (para uso no módulo de lançamentos)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clienteId = parseInt(id, 10);

    if (isNaN(clienteId)) {
      return NextResponse.json({ error: 'ID do cliente inválido' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar pacotes expirados
    await supabase.rpc('verificar_pacotes_expirados');

    const { searchParams } = new URL(request.url);
    const apenasAtivos = searchParams.get('apenasAtivos') !== 'false';

    let query = supabase
      .from('pacotes')
      .select(`
        id,
        nome,
        servico_id,
        quantidade_total,
        quantidade_usada,
        valor_total,
        valor_por_sessao,
        data_venda,
        data_validade,
        status,
        servico:servicos(id, nome, valor, duracao_minutos)
      `)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });

    if (apenasAtivos) {
      query = query.eq('status', 'ativo');
    }

    const { data: pacotes, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Adicionar info de sessões disponíveis
    const pacotesComInfo = (pacotes || []).map(p => ({
      ...p,
      sessoes_disponiveis: p.quantidade_total - p.quantidade_usada,
      validade_formatada: p.data_validade
        ? new Date(p.data_validade).toLocaleDateString('pt-BR')
        : 'Sem validade',
      progresso_percentual: Math.round((p.quantidade_usada / p.quantidade_total) * 100),
    }));

    return NextResponse.json({
      pacotes: pacotesComInfo,
      total: pacotesComInfo.length,
      totalAtivos: pacotesComInfo.filter(p => p.status === 'ativo').length,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
