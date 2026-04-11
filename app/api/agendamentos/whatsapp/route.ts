import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/api-auth';
import { agendarOuEnviarMensagem, normalizarTelefone, validarTelefone } from '@/lib/whatsapp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

// POST: Disparar mensagens WhatsApp para um agendamento (confirmação + lembrete ou pós-venda)
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

  const paramsBase = {
    agendamentoId: agendamento.id,
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    clienteTelefone: cliente.telefone,
    colaboradorNome: colaborador.nome,
    dataHora: agendamento.data_hora,
  };

  // Verificar se é passado ou futuro
  const dataAgendamento = new Date(agendamento.data_hora);
  const diffHoras = (dataAgendamento.getTime() - Date.now()) / (1000 * 60 * 60);

  try {
    if (diffHoras < 0) {
      // Passado: não enviar nada automaticamente
      // Pós-venda será enviado pelo cron quando o lançamento for concluído
      return NextResponse.json({ success: true, message: 'Agendamento no passado, pós-venda será enviado após conclusão' });
    } else {
      // Futuro: confirmação + lembrete
      await agendarOuEnviarMensagem({
        ...paramsBase,
        tipo: 'confirmacao',
        dataProgramada: new Date(),
      });

      // Lembrete: programar para 21h BRT do dia anterior
      const match = agendamento.data_hora.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const diaAnterior = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        diaAnterior.setDate(diaAnterior.getDate() - 1);
        const dataLembrete = new Date(Date.UTC(
          diaAnterior.getFullYear(),
          diaAnterior.getMonth(),
          diaAnterior.getDate() + 1,
          0, 0, 0
        ));

        if (dataLembrete > new Date()) {
          await agendarOuEnviarMensagem({
            ...paramsBase,
            tipo: 'lembrete',
            dataProgramada: dataLembrete,
          });
        } else if (diffHoras > 1) {
          await agendarOuEnviarMensagem({
            ...paramsBase,
            tipo: 'lembrete',
            dataProgramada: new Date(),
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[WhatsApp] Erro ao disparar:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
