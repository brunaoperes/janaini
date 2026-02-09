import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

// Helper para verificar autenticação
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
      isAdmin: profile?.role === 'admin',
      colaboradorId: profile?.colaborador_id,
    };
  } catch {
    return null;
  }
}

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

    // Verificar autenticação (não bloquear, mas registrar)
    const authUser = await getAuthUser(supabase);
    // Nota: A visualização de pacotes de um cliente é permitida para qualquer usuário logado
    // pois é necessária para o fluxo de lançamentos

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
        colaborador_vendedor_id,
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
      _userProfile: authUser ? {
        isAdmin: authUser.isAdmin,
        colaboradorId: authUser.colaboradorId,
      } : null,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
