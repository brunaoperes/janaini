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
    const data = searchParams.get('data');

    // Carregar colaboradores
    const { data: colaboradores } = await supabase
      .from('colaboradores')
      .select('*')
      .order('nome');

    // Carregar clientes
    const { data: clientes } = await supabase
      .from('clientes')
      .select('*')
      .order('nome');

    // Carregar serviços ativos
    const { data: servicos } = await supabase
      .from('servicos')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    // Carregar formas de pagamento
    const { data: formasPagamento } = await supabase
      .from('formas_pagamento')
      .select('*')
      .eq('ativo', true)
      .order('ordem');

    // Carregar agendamentos do dia
    let agendamentos: any[] = [];
    if (data) {
      const { data: agendData, error } = await supabase
        .from('agendamentos')
        .select(`
          *,
          cliente:clientes!fk_agendamentos_cliente(*),
          colaborador:colaboradores!fk_agendamentos_colaborador(*)
        `)
        .gte('data_hora', `${data}T00:00:00`)
        .lte('data_hora', `${data}T23:59:59`)
        .order('data_hora', { ascending: true });

      if (error) {
        console.error('Erro ao carregar agendamentos:', error);
      } else {
        agendamentos = agendData || [];
      }
    }

    return jsonResponse({
      agendamentos,
      colaboradores: colaboradores || [],
      clientes: clientes || [],
      servicos: servicos || [],
      formasPagamento: formasPagamento || [],
    });
  } catch (error: any) {
    console.error('Erro na API de agenda:', error);
    return errorResponse(error.message, 500);
  }
}
