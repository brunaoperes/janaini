import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/api-auth';
import { agendarOuEnviarMensagem, normalizarTelefone, validarTelefone } from '@/lib/whatsapp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

// POST: Disparar mensagem pós-venda ao concluir agendamento
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  const { agendamentoId } = await request.json();

  if (!agendamentoId) {
    return NextResponse.json({ error: 'agendamentoId é obrigatório' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Buscar dados do agendamento com cliente e colaborador
  const { data: agendamento, error } = await supabase
    .from('agendamentos')
    .select(`
      id,
      data_hora,
      cliente_id,
      colaborador_id,
      clientes!inner(id, nome, telefone),
      colaboradores!inner(id, nome)
    `)
    .eq('id', agendamentoId)
    .single();

  if (error || !agendamento) {
    return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });
  }

  const cliente = agendamento.clientes as any;
  const colaborador = agendamento.colaboradores as any;

  if (!cliente?.telefone) {
    return NextResponse.json({ error: 'Cliente sem telefone cadastrado' }, { status: 400 });
  }

  const telefoneNorm = normalizarTelefone(cliente.telefone);
  if (!validarTelefone(telefoneNorm)) {
    return NextResponse.json({ error: 'Telefone do cliente inválido' }, { status: 400 });
  }

  try {
    await agendarOuEnviarMensagem({
      agendamentoId: agendamento.id,
      tipo: 'pos_venda',
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      clienteTelefone: cliente.telefone,
      colaboradorNome: colaborador.nome,
      dataHora: agendamento.data_hora,
      dataProgramada: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PósVenda] Erro ao disparar:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
