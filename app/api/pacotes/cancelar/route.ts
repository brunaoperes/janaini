import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auditUpdate } from '@/lib/audit';
import { pacoteCancelSchema, formatZodErrors } from '@/lib/validations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

async function getAuthUser(supabase: ReturnType<typeof createClient>) {
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

// POST - Cancelar pacote com reembolso proporcional
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = pacoteCancelSchema.safeParse(body);
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

    // Buscar pacote
    const { data: pacote, error: pacoteError } = await supabase
      .from('pacotes')
      .select(`
        *,
        colaborador_vendedor:colaboradores!pacotes_colaborador_vendedor_id_fkey(id, nome, porcentagem_comissao)
      `)
      .eq('id', data.pacote_id)
      .single();

    if (pacoteError || !pacote) {
      return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 });
    }

    if (pacote.status === 'cancelado') {
      return NextResponse.json({ error: 'Este pacote já foi cancelado' }, { status: 400 });
    }

    // Calcular reembolso máximo permitido (proporcional às sessões não usadas)
    const sessoesRestantes = pacote.quantidade_total - pacote.quantidade_usada;
    const reembolsoMaximo = pacote.valor_por_sessao * sessoesRestantes;

    if (data.valor_reembolso > reembolsoMaximo) {
      return NextResponse.json({
        error: `Valor de reembolso máximo permitido: R$ ${reembolsoMaximo.toFixed(2)} (${sessoesRestantes} sessões restantes)`
      }, { status: 400 });
    }

    const authUser = await getAuthUser(supabase);
    let lancamentoReembolso = null;

    // Se houver valor de reembolso, criar lançamento negativo
    if (data.valor_reembolso > 0) {
      // Calcular comissão proporcional a ser estornada
      const porcentagem = pacote.colaborador_vendedor?.porcentagem_comissao || 50;
      const comissaoEstorno = (data.valor_reembolso * porcentagem) / 100;
      const salaoEstorno = data.valor_reembolso - comissaoEstorno;

      const lancamentoData = {
        colaborador_id: pacote.colaborador_vendedor_id,
        cliente_id: pacote.cliente_id,
        valor_total: -data.valor_reembolso, // Valor negativo
        comissao_colaborador: -comissaoEstorno,
        comissao_salao: -salaoEstorno,
        data: new Date().toISOString().split('T')[0],
        servicos_nomes: `Reembolso Pacote: ${pacote.nome} (${sessoesRestantes} sessões)`,
        status: 'concluido',
        forma_pagamento: data.forma_reembolso || pacote.forma_pagamento,
        data_pagamento: new Date().toISOString(),
        tipo_lancamento: 'pacote_reembolso',
        pacote_id: pacote.id,
        observacoes: `Cancelamento: ${data.motivo_cancelamento}`,
      };

      const { data: lancamento, error: lancError } = await supabase
        .from('lancamentos')
        .insert(lancamentoData)
        .select()
        .single();

      if (lancError) {
        console.error('[API/pacotes/cancelar] Erro ao criar lançamento de reembolso:', lancError);
        return NextResponse.json({ error: lancError.message }, { status: 500 });
      }

      lancamentoReembolso = lancamento;
    }

    // Atualizar pacote para cancelado
    const pacoteAnterior = { ...pacote };
    const { data: pacoteAtualizado, error: updateError } = await supabase
      .from('pacotes')
      .update({
        status: 'cancelado',
        data_cancelamento: new Date().toISOString(),
        motivo_cancelamento: data.motivo_cancelamento,
        valor_reembolso: data.valor_reembolso,
        lancamento_reembolso_id: lancamentoReembolso?.id || null,
      })
      .eq('id', data.pacote_id)
      .select()
      .single();

    if (updateError) {
      // Rollback: deletar lançamento de reembolso
      if (lancamentoReembolso) {
        await supabase.from('lancamentos').delete().eq('id', lancamentoReembolso.id);
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Auditoria
    if (authUser) {
      await auditUpdate({
        ...authUser,
        modulo: 'Lancamentos',
        tabela: 'pacotes',
        registroId: pacote.id,
        dadosAnterior: pacoteAnterior,
        dadosNovo: pacoteAtualizado,
        metodo: 'POST',
        endpoint: '/api/pacotes/cancelar',
      });
    }

    return NextResponse.json({
      success: true,
      message: data.valor_reembolso > 0
        ? `Pacote cancelado com reembolso de R$ ${data.valor_reembolso.toFixed(2)}`
        : 'Pacote cancelado sem reembolso',
      pacote: pacoteAtualizado,
      lancamentoReembolso,
    });

  } catch (error: unknown) {
    console.error('[API/pacotes/cancelar] Erro fatal:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
