import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro fatal:', error);
    return NextResponse.json({ error: 'Erro ao deletar' }, { status: 500 });
  }
}
