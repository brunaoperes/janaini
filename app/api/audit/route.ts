import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Verificar se é admin
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    // Parâmetros de filtro
    const { searchParams } = new URL(request.url);
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const modulo = searchParams.get('modulo');
    const acao = searchParams.get('acao');
    const userId = searchParams.get('userId');
    const resultado = searchParams.get('resultado');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Construir query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (dataInicio) {
      query = query.gte('created_at', `${dataInicio}T00:00:00`);
    }
    if (dataFim) {
      query = query.lte('created_at', `${dataFim}T23:59:59`);
    }
    if (modulo && modulo !== 'todos') {
      query = query.eq('modulo', modulo);
    }
    if (acao && acao !== 'todos') {
      query = query.eq('acao', acao);
    }
    if (userId && userId !== 'todos') {
      query = query.eq('user_id', userId);
    }
    if (resultado && resultado !== 'todos') {
      query = query.eq('resultado', resultado);
    }

    // Paginação
    query = query.range(offset, offset + limit - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('[API/audit] Erro ao buscar logs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Buscar lista de usuários únicos para filtro
    const { data: usuarios } = await supabase
      .from('audit_logs')
      .select('user_id, usuario_email, usuario_nome')
      .not('user_id', 'is', null);

    // Remover duplicatas
    const usuariosUnicos = usuarios?.reduce((acc: any[], curr) => {
      if (!acc.find(u => u.user_id === curr.user_id)) {
        acc.push(curr);
      }
      return acc;
    }, []) || [];

    // Estatísticas rápidas
    const { data: stats } = await supabase.rpc('audit_stats', {
      p_data_inicio: dataInicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      p_data_fim: dataFim || new Date().toISOString().split('T')[0],
    }).maybeSingle();

    return NextResponse.json({
      logs: logs || [],
      total: count || 0,
      usuarios: usuariosUnicos,
      stats: stats || null,
      pagination: {
        limit,
        offset,
        hasMore: count ? offset + limit < count : false,
      },
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error: any) {
    console.error('[API/audit] Erro fatal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
