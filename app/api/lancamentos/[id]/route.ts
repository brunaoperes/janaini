import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auditDelete } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

// Helper para obter dados do usuário autenticado
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lancamentoId = parseInt(id);

    if (isNaN(lancamentoId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Buscar lançamento antes de deletar (para auditoria)
    const { data: lancamento } = await supabase
      .from('lancamentos')
      .select('*')
      .eq('id', lancamentoId)
      .single();

    // Obter usuário autenticado
    const authUser = await getAuthUser(supabase);

    // 1. Deletar agendamento vinculado (se existir)
    await supabase
      .from('agendamentos')
      .delete()
      .eq('lancamento_id', lancamentoId);

    // 2. Deletar lançamento
    const { error } = await supabase
      .from('lancamentos')
      .delete()
      .eq('id', lancamentoId);

    if (error) {
      console.error('Erro ao deletar lançamento:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Registrar auditoria
    if (authUser && lancamento) {
      await auditDelete({
        ...authUser,
        modulo: 'Lancamentos',
        tabela: 'lancamentos',
        registroId: lancamentoId,
        dadosAnterior: lancamento,
        metodo: 'DELETE',
        endpoint: `/api/lancamentos/${lancamentoId}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro fatal:', error);
    return NextResponse.json({ error: 'Erro ao deletar' }, { status: 500 });
  }
}
