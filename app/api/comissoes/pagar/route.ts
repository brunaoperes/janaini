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

    // Verificar se algum lançamento já foi pago — em QUALQUER colaborador (#11),
    // não só no mesmo (evita pagar 2x o mesmo lançamento por colaboradores diferentes).
    const { data: pagamentosExistentes } = await supabase
      .from('pagamentos_comissao')
      .select('lancamentos_ids');

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

    // #1 — RECOMPUTAR o valor no servidor a partir dos lançamentos reais (não confiar no
    // valor_liquido vindo do cliente). Líquido = comissão do colaborador nesses lançamentos:
    // comissao_colaborador (não compartilhado) OU a divisão dele (compartilhado).
    const { data: lancsPagar } = await supabase
      .from('lancamentos')
      .select('id, colaborador_id, comissao_colaborador, compartilhado')
      .in('id', lancamentos_ids);

    const sharedIds = (lancsPagar || []).filter((l: any) => l.compartilhado).map((l: any) => l.id);
    const divMap: Record<number, number> = {};
    if (sharedIds.length > 0) {
      const { data: divs } = await supabase
        .from('lancamento_divisoes')
        .select('lancamento_id, comissao_calculada')
        .in('lancamento_id', sharedIds)
        .eq('colaborador_id', colaborador_id);
      (divs || []).forEach((d: any) => {
        divMap[d.lancamento_id] = (divMap[d.lancamento_id] || 0) + (d.comissao_calculada || 0);
      });
    }

    let valorLiquidoServidor = 0;
    for (const l of (lancsPagar || []) as any[]) {
      if (l.compartilhado) valorLiquidoServidor += divMap[l.id] || 0;
      else if (Number(l.colaborador_id) === Number(colaborador_id)) valorLiquidoServidor += (l.comissao_colaborador || 0);
    }
    valorLiquidoServidor = Math.round(valorLiquidoServidor * 100) / 100;

    const valorBrutoFinal = typeof valor_bruto === 'number' ? valor_bruto : valorLiquidoServidor;
    const totalDescontosFinal = Math.round((valorBrutoFinal - valorLiquidoServidor) * 100) / 100;

    // Registrar pagamento (valores do SERVIDOR, não do cliente)
    const { data: pagamento, error: insertError } = await supabase
      .from('pagamentos_comissao')
      .insert({
        colaborador_id,
        periodo_inicio,
        periodo_fim,
        valor_bruto: valorBrutoFinal,
        total_descontos: totalDescontosFinal >= 0 ? totalDescontosFinal : 0,
        valor_liquido: valorLiquidoServidor,
        forma_pagamento_comissao: forma_pagamento_comissao || 'pix',
        observacoes,
        pago_por: userId,
        lancamentos_ids,
        detalhes_calculo,
      })
      .select()
      .single();

    if (insertError) {
      // 23P01 = exclusion_violation, 23505 = unique_violation → a constraint do banco barrou um
      // pagamento concorrente do MESMO lançamento (proteção atômica contra duplo-pagamento por
      // corrida, que a checagem application-level acima não cobre sozinha).
      if (insertError.code === '23P01' || insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Estes lançamentos acabaram de ser pagos em outro registro. Atualize a tela e confira.' },
          { status: 409 }
        );
      }
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
