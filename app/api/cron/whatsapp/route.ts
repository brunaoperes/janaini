import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { processarEnvio, agendarOuEnviarMensagem, normalizarTelefone, validarTelefone } from '@/lib/whatsapp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: Request) {
  // Validar CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabase = getSupabase();
  const resultado = {
    pendentes: { encontrados: 0, enviados: 0, erros: 0 },
    pos_venda: { encontrados: 0, enviados: 0, erros: 0 },
    retry: { encontrados: 0, enviados: 0, erros: 0 },
  };

  // ========================================================================
  // PASSO A: Enviar mensagens pendentes cuja data_programada já chegou
  // ========================================================================
  try {
    const { data: pendentes } = await supabase
      .from('mensagens_whatsapp')
      .select('*')
      .eq('status', 'pendente')
      .lte('data_programada', new Date().toISOString())
      .order('data_programada', { ascending: true })
      .limit(50);

    resultado.pendentes.encontrados = pendentes?.length || 0;

    if (pendentes) {
      for (const msg of pendentes) {
        // Não enviar confirmação/lembrete de agendamentos que já passaram
        if (msg.tipo === 'confirmacao' || msg.tipo === 'lembrete') {
          const { data: agendamento } = await supabase
            .from('agendamentos')
            .select('data_hora')
            .eq('id', msg.agendamento_id)
            .single();

          if (agendamento && new Date(agendamento.data_hora) < new Date()) {
            await supabase
              .from('mensagens_whatsapp')
              .update({ status: 'erro', erro_mensagem: 'Cancelado: agendamento já passou' })
              .eq('id', msg.id);
            console.log(`[Cron/WhatsApp] Mensagem ${msg.id} cancelada: agendamento já passou`);
            continue;
          }
        }

        const sucesso = await processarEnvio(msg.id, msg.telefone_destino, msg.mensagem);
        if (sucesso) {
          resultado.pendentes.enviados++;
        } else {
          resultado.pendentes.erros++;
        }
      }
    }
  } catch (error) {
    console.error('[Cron/WhatsApp] Erro no passo A (pendentes):', error);
  }

  // ========================================================================
  // PASSO B: Detectar agendamentos concluídos para pós-venda
  // ========================================================================
  try {
    const quinzeMinAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // Buscar agendamentos concluídos com lançamento pago há mais de 15 min
    const { data: concluidos } = await supabase
      .from('agendamentos')
      .select(`
        id,
        data_hora,
        cliente_id,
        colaborador_id,
        clientes!inner(id, nome, telefone),
        colaboradores!inner(id, nome),
        lancamentos!inner(id, data_pagamento, status)
      `)
      .eq('status', 'concluido')
      .eq('lancamentos.status', 'concluido')
      .not('lancamentos.data_pagamento', 'is', null)
      .lte('lancamentos.data_pagamento', quinzeMinAtras);

    if (concluidos) {
      // Filtrar os que já têm mensagem pos_venda
      const agendamentoIds = concluidos.map(a => a.id);

      const { data: jaEnviadas } = await supabase
        .from('mensagens_whatsapp')
        .select('agendamento_id')
        .in('agendamento_id', agendamentoIds)
        .eq('tipo', 'pos_venda');

      const idsJaEnviados = new Set((jaEnviadas || []).map(m => m.agendamento_id));
      const paraEnviar = concluidos.filter(a => !idsJaEnviados.has(a.id));

      resultado.pos_venda.encontrados = paraEnviar.length;

      for (const agendamento of paraEnviar) {
        const cliente = agendamento.clientes as any;
        const colaborador = agendamento.colaboradores as any;

        if (!cliente?.telefone) {
          console.warn(`[Cron/WhatsApp] Cliente ${cliente?.nome} sem telefone, pulando pós-venda`);
          continue;
        }

        const telefoneNorm = normalizarTelefone(cliente.telefone);
        if (!validarTelefone(telefoneNorm)) {
          console.warn(`[Cron/WhatsApp] Telefone inválido: ${cliente.telefone}`);
          continue;
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
          resultado.pos_venda.enviados++;
        } catch {
          resultado.pos_venda.erros++;
        }
      }
    }
  } catch (error) {
    console.error('[Cron/WhatsApp] Erro no passo B (pós-venda):', error);
  }

  // ========================================================================
  // PASSO C: Retry de mensagens com erro (max 3 tentativas)
  // ========================================================================
  try {
    const { data: comErro } = await supabase
      .from('mensagens_whatsapp')
      .select('*')
      .eq('status', 'erro')
      .lt('tentativas', 3)
      .not('erro_mensagem', 'like', 'Cancelado:%')
      .order('created_at', { ascending: true })
      .limit(20);

    resultado.retry.encontrados = comErro?.length || 0;

    if (comErro) {
      for (const msg of comErro) {
        // Resetar status para permitir nova tentativa
        await supabase
          .from('mensagens_whatsapp')
          .update({ status: 'pendente' })
          .eq('id', msg.id);

        const sucesso = await processarEnvio(msg.id, msg.telefone_destino, msg.mensagem);
        if (sucesso) {
          resultado.retry.enviados++;
        } else {
          resultado.retry.erros++;
        }
      }
    }
  } catch (error) {
    console.error('[Cron/WhatsApp] Erro no passo C (retry):', error);
  }

  console.log('[Cron/WhatsApp] Resultado:', JSON.stringify(resultado));

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    resultado,
  });
}
