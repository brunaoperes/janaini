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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const startDateAnterior = searchParams.get('startDateAnterior');
    const endDateAnterior = searchParams.get('endDateAnterior');
    const colaboradorId = searchParams.get('colaboradorId');
    const pagamento = searchParams.get('pagamento');

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

    return jsonResponse({
      lancamentos: lancamentos || [],
      lancamentosAnterior: lancamentosAnterior || [],
      colaboradores: colaboradores || [],
    });
  } catch (error: any) {
    console.error('Erro na API de relatórios:', error);
    return errorResponse(error.message, 500);
  }
}
