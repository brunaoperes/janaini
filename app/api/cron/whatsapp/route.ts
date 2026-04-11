import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { processarEnvio, agendarOuEnviarMensagem, enviarMensagemZApi, gerarMensagemAgendaColaborador, gerarMensagemPendentesColaborador, normalizarTelefone, validarTelefone } from '@/lib/whatsapp';

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
    agenda_colaboradores: { encontrados: 0, enviados: 0, erros: 0 },
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

          // Comparar em BRT: data_hora é horário local, somar 3h para UTC
          const agMatch = agendamento?.data_hora?.match?.(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
          const agPassou = agMatch ? new Date(Date.UTC(
            parseInt(agMatch[1]), parseInt(agMatch[2]) - 1, parseInt(agMatch[3]),
            parseInt(agMatch[4]) + 3, parseInt(agMatch[5])
          )).getTime() < Date.now() : false;

          if (agendamento && agPassou) {
            await supabase
              .from('mensagens_whatsapp')
              .update({ status: 'erro', erro_mensagem: 'Cancelado: agendamento já passou' })
              .eq('id', msg.id);
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

    // Buscar agendamentos concluídos
    const { data: agendConcluidos } = await supabase
      .from('agendamentos')
      .select(`
        id,
        data_hora,
        cliente_id,
        colaborador_id,
        lancamento_id,
        clientes!inner(id, nome, telefone),
        colaboradores!inner(id, nome)
      `)
      .eq('status', 'concluido')
      .not('lancamento_id', 'is', null);

    // Filtrar: verificar se o lançamento vinculado está concluído e pago há mais de 15 min
    let concluidos: any[] = [];
    if (agendConcluidos && agendConcluidos.length > 0) {
      const lancIds = agendConcluidos.map(a => a.lancamento_id).filter(Boolean);
      const { data: lancamentos } = await supabase
        .from('lancamentos')
        .select('id, status, data_pagamento')
        .in('id', lancIds)
        .eq('status', 'concluido')
        .not('data_pagamento', 'is', null)
        .lte('data_pagamento', quinzeMinAtras);

      const lancPagosIds = new Set((lancamentos || []).map(l => l.id));
      concluidos = agendConcluidos.filter(a => lancPagosIds.has(a.lancamento_id));
    }

    if (concluidos.length > 0) {
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
          continue;
        }

        const telefoneNorm = normalizarTelefone(cliente.telefone);
        if (!validarTelefone(telefoneNorm)) {
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

  // ========================================================================
  // PASSO D: Enviar agenda do dia para colaboradores (manhã)
  // ========================================================================
  try {
    // Calcular "amanhã" em BRT de forma confiável
    const agora = new Date();
    // Usar toLocaleDateString para obter a data atual em BRT
    const hojeBRTStr = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    // Somar 1 dia
    const hojeBRT = new Date(hojeBRTStr + 'T12:00:00'); // noon to avoid DST issues
    hojeBRT.setDate(hojeBRT.getDate() + 1);
    const diaStr = hojeBRT.toISOString().split('T')[0]; // YYYY-MM-DD

    // Buscar colaboradores com telefone
    const { data: colaboradores } = await supabase
      .from('colaboradores')
      .select('id, nome, telefone')
      .not('telefone', 'is', null)
      .neq('telefone', '');

    if (colaboradores && colaboradores.length > 0) {
      resultado.agenda_colaboradores.encontrados = colaboradores.length;

      for (const colab of colaboradores) {
        const telefoneNorm = normalizarTelefone(colab.telefone!);
        if (!validarTelefone(telefoneNorm)) {
          continue;
        }

        // Buscar agendamentos do dia para este colaborador
        const { data: agendamentos } = await supabase
          .from('agendamentos')
          .select('data_hora, descricao_servico, clientes(nome)')
          .eq('colaborador_id', colab.id)
          .gte('data_hora', `${diaStr} 00:00:00`)
          .lte('data_hora', `${diaStr} 23:59:59`)
          .neq('status', 'cancelado')
          .order('data_hora', { ascending: true });

        // Montar lista de agendamentos
        const dataFormatada = `${diaStr.split('-')[2]}/${diaStr.split('-')[1]}/${diaStr.split('-')[0]}`;

        let mensagem: string;
        let ativo: boolean;

        if (!agendamentos || agendamentos.length === 0) {
          // Sem agendamentos: enviar mensagem informando
          const resultado = await gerarMensagemAgendaColaborador(colab.nome, dataFormatada, []);
          mensagem = resultado.mensagem;
          ativo = resultado.ativo;
        } else {
          const listaAgendamentos = agendamentos.map((ag: any) => {
            const horarioMatch = ag.data_hora.match(/[T ](\d{2}):(\d{2})/);
            return {
              horario: horarioMatch ? `${horarioMatch[1]}:${horarioMatch[2]}` : '--:--',
              cliente: ag.clientes?.nome || 'Cliente',
              servico: ag.descricao_servico || 'Servico',
            };
          });

          const resultado = await gerarMensagemAgendaColaborador(
            colab.nome, dataFormatada, listaAgendamentos
          );
          mensagem = resultado.mensagem;
          ativo = resultado.ativo;
        }

        if (!ativo) {
          continue;
        }

        try {
          // Buscar pendentes do dia atual (hoje em BRT)
          const hojeStr = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

          const { data: pendentesHoje } = await supabase
            .from('agendamentos')
            .select('data_hora, descricao_servico, clientes(nome)')
            .eq('colaborador_id', colab.id)
            .gte('data_hora', `${hojeStr} 00:00:00`)
            .lte('data_hora', `${hojeStr} 23:59:59`)
            .eq('status', 'pendente')
            .order('data_hora', { ascending: true });

          // Se tem pendentes, adicionar aviso na mensagem
          let mensagemFinal = mensagem;

          if (pendentesHoje && pendentesHoje.length > 0) {
            const listaPendentes = pendentesHoje.map((p: any) => {
              const horMatch = p.data_hora.match(/[T ](\d{2}):(\d{2})/);
              return {
                horario: horMatch ? `${horMatch[1]}:${horMatch[2]}` : '--:--',
                cliente: p.clientes?.nome || 'Cliente',
                servico: p.descricao_servico || 'Servico',
              };
            });

            const { mensagem: msgPendentes, ativo: ativoPendentes } = await gerarMensagemPendentesColaborador(
              colab.nome, listaPendentes
            );

            if (ativoPendentes && msgPendentes) {
              mensagemFinal = mensagem + '\n\n---\n\n' + msgPendentes;
            }
          }

          await enviarMensagemZApi(telefoneNorm, mensagemFinal);
          resultado.agenda_colaboradores.enviados++;
        } catch (err: any) {
          resultado.agenda_colaboradores.erros++;
          console.error(`[Cron/WhatsApp] Erro ao enviar agenda para ${colab.nome}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error('[Cron/WhatsApp] Erro no passo D (agenda colaboradores):', error);
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    resultado,
  });
}
