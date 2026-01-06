import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

    // Tentar obter perfil do usuário para filtrar serviços
    let userProfile: { role?: string; colaborador_id?: number } | null = null;
    try {
      const cookieStore = await cookies();
      const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
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
    const { data: servicosData } = await supabase
      .from('servicos')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    // FILTRO DE SERVIÇOS: usuário não-admin só vê serviços do seu colaborador
    // Admin ou usuário sem perfil (fallback) vê todos os serviços
    let servicos = servicosData || [];
    console.log('[API/agenda] Filtro serviços - isAdmin:', isAdmin, 'colaboradorId:', userColaboradorId, 'total serviços:', servicos.length);

    if (!isAdmin && userColaboradorId) {
      servicos = servicos.filter((s: any) =>
        s.colaboradores_ids && Array.isArray(s.colaboradores_ids) && s.colaboradores_ids.includes(userColaboradorId)
      );
      console.log('[API/agenda] Serviços filtrados:', servicos.length);
    }

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
      servicos,
      formasPagamento: formasPagamento || [],
      _userProfile: {
        isAdmin,
        colaboradorId: userColaboradorId,
      },
    });
  } catch (error: any) {
    console.error('Erro na API de agenda:', error);
    return errorResponse(error.message, 500);
  }
}
