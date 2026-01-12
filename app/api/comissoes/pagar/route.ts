import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auditCreate } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar se é admin e obter dados do usuário para auditoria
    let userId: string | null = null;
    let userEmail: string | undefined = undefined;
    let userName: string | undefined = undefined;
    let userRole: string | undefined = undefined;
    let isAdmin = false;

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
        userId = user.id;
        userEmail = user.email || undefined;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, nome')
          .eq('id', user.id)
          .single();
        isAdmin = profile?.role === 'admin';
        userName = profile?.nome;
        userRole = profile?.role;
      }
    } catch {
      // Continua sem perfil
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Apenas administradores podem registrar pagamentos de comissão' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      colaborador_id,
      periodo_inicio,
      periodo_fim,
      valor_bruto,
      total_descontos,
      valor_liquido,
      forma_pagamento_comissao,
      observacoes,
      lancamentos_ids,
      detalhes_calculo,
    } = body;

    // Validações
    if (!colaborador_id || !periodo_inicio || !periodo_fim || !lancamentos_ids?.length) {
      return NextResponse.json(
        { error: 'Dados incompletos para registrar pagamento' },
        { status: 400 }
      );
    }

    // Verificar se algum lançamento já foi pago
    const { data: pagamentosExistentes } = await supabase
      .from('pagamentos_comissao')
      .select('lancamentos_ids')
      .eq('colaborador_id', colaborador_id);

    const lancamentosJaPagos = new Set<number>();
    (pagamentosExistentes || []).forEach((p: any) => {
      (p.lancamentos_ids || []).forEach((id: number) => lancamentosJaPagos.add(id));
    });

    const lancamentosConflito = lancamentos_ids.filter((id: number) => lancamentosJaPagos.has(id));
    if (lancamentosConflito.length > 0) {
      return NextResponse.json(
        { error: `Alguns lançamentos já foram pagos: ${lancamentosConflito.join(', ')}` },
        { status: 400 }
      );
    }

    // Registrar pagamento
    const { data: pagamento, error: insertError } = await supabase
      .from('pagamentos_comissao')
      .insert({
        colaborador_id,
        periodo_inicio,
        periodo_fim,
        valor_bruto,
        total_descontos,
        valor_liquido,
        forma_pagamento_comissao: forma_pagamento_comissao || 'pix',
        observacoes,
        pago_por: userId,
        lancamentos_ids,
        detalhes_calculo,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir pagamento:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Registrar auditoria
    if (userId) {
      await auditCreate({
        userId,
        userEmail,
        userName,
        userRole,
        modulo: 'Comissoes',
        tabela: 'pagamentos_comissao',
        registroId: pagamento.id,
        dadosNovo: pagamento,
        metodo: 'POST',
        endpoint: '/api/comissoes/pagar',
      });
    }

    return NextResponse.json({
      success: true,
      pagamento,
      message: 'Pagamento registrado com sucesso!',
    });

  } catch (error: any) {
    console.error('Erro ao registrar pagamento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
