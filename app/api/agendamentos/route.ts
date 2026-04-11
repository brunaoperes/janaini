import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auditCreate, auditUpdate } from '@/lib/audit';
import { requireAuth, isAuthError } from '@/lib/api-auth';
import { agendarOuEnviarMensagem, normalizarTelefone, validarTelefone } from '@/lib/whatsapp';

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

export async function POST(request: Request) {
  try {
    // Verificar autenticação
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const body = await request.json();
    const {
      colaborador_id,
      cliente_id,
      data_hora,
      descricao_servico,
      duracao_minutos,
      valor_estimado,
      hora_inicio,
      hora_fim,
      observacoes,
    } = body;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verificar conflito de horário para o mesmo colaborador
    const hiNovo = hora_inicio || data_hora.match(/[T ](\d{2}:\d{2})/)?.[1] || '00:00';
    const hfNovo = hora_fim || hiNovo;
    const [hIN, mIN] = hiNovo.split(':').map(Number);
    const [hFN, mFN] = hfNovo.split(':').map(Number);
    const inicioNovoMin = hIN * 60 + mIN;
    let fimNovoMin = hFN * 60 + mFN;
    if (fimNovoMin <= inicioNovoMin) {
      fimNovoMin = inicioNovoMin + (duracao_minutos || 60);
    }

    // Extrair dia — data_hora pode ser "2026-04-10 16:00:00" ou "2026-04-10T16:00:00"
    const diaMatch = data_hora.match(/(\d{4}-\d{2}-\d{2})/);
    const diaStr = diaMatch ? diaMatch[1] : data_hora.split('T')[0];

    // Buscar agendamentos do mesmo colaborador no mesmo dia
    const { data: agendamentosExistentes } = await supabase
      .from('agendamentos')
      .select('id, data_hora, duracao_minutos, hora_inicio, hora_fim, clientes(nome)')
      .eq('colaborador_id', colaborador_id)
      .gte('data_hora', `${diaStr} 00:00:00`)
      .lte('data_hora', `${diaStr} 23:59:59`)
      .neq('status', 'cancelado');

    // Buscar lançamentos do mesmo colaborador no mesmo dia
    const { data: lancamentosExistentes } = await supabase
      .from('lancamentos')
      .select('id, hora_inicio, hora_fim, data, clientes(nome)')
      .eq('colaborador_id', colaborador_id)
      .gte('data', `${diaStr} 00:00:00`)
      .lte('data', `${diaStr} 23:59:59`)
      .neq('status', 'cancelado');

    // Verificar conflito com agendamentos existentes
    if (agendamentosExistentes && agendamentosExistentes.length > 0) {
      for (const ag of agendamentosExistentes) {
        let agInicioMin: number;
        if (ag.hora_inicio) {
          const [aHI, aMI] = ag.hora_inicio.split(':').map(Number);
          agInicioMin = aHI * 60 + aMI;
        } else {
          const horMatch = ag.data_hora.match(/[T ](\d{2}):(\d{2})/);
          if (!horMatch) continue;
          agInicioMin = parseInt(horMatch[1]) * 60 + parseInt(horMatch[2]);
        }

        let agFimMin: number;
        if (ag.hora_fim && ag.hora_fim !== ag.hora_inicio) {
          const [aHF, aMF] = ag.hora_fim.split(':').map(Number);
          agFimMin = aHF * 60 + aMF;
          if (agFimMin <= agInicioMin) agFimMin = agInicioMin + (ag.duracao_minutos || 60);
        } else {
          agFimMin = agInicioMin + (ag.duracao_minutos || 60);
        }

        if (inicioNovoMin < agFimMin && fimNovoMin > agInicioMin) {
          const clienteNome = (ag.clientes as any)?.nome || 'outro cliente';
          const horStr = ag.hora_inicio || `${String(Math.floor(agInicioMin / 60)).padStart(2, '0')}:${String(agInicioMin % 60).padStart(2, '0')}`;
          return NextResponse.json({
            error: `Conflito de horario: este colaborador ja tem agendamento as ${horStr} com ${clienteNome}`,
          }, { status: 409 });
        }
      }
    }

    // Verificar conflito com lançamentos existentes
    if (lancamentosExistentes && lancamentosExistentes.length > 0) {
      for (const lc of lancamentosExistentes) {
        if (!lc.hora_inicio) continue;
        const [lcHI, lcMI] = lc.hora_inicio.split(':').map(Number);
        const lcInicioMin = lcHI * 60 + lcMI;
        let lcFimMin = lcInicioMin + 60;
        if (lc.hora_fim) {
          const [lcHF, lcMF] = lc.hora_fim.split(':').map(Number);
          lcFimMin = lcHF * 60 + lcMF;
          if (lcFimMin <= lcInicioMin) lcFimMin = lcInicioMin + 60;
        }

        if (inicioNovoMin < lcFimMin && fimNovoMin > lcInicioMin) {
          const clienteNome = (lc.clientes as any)?.nome || 'outro cliente';
          return NextResponse.json({
            error: `Conflito de horario: este colaborador ja tem lancamento as ${lc.hora_inicio} com ${clienteNome}`,
          }, { status: 409 });
        }
      }
    }

    // Buscar colaborador para calcular comissão
    const { data: colaborador } = await supabase
      .from('colaboradores')
      .select('porcentagem_comissao')
      .eq('id', colaborador_id)
      .single();

    const porcentagemComissao = colaborador?.porcentagem_comissao || 50;
    const comissaoColaborador = (valor_estimado * porcentagemComissao) / 100;
    const comissaoSalao = valor_estimado - comissaoColaborador;

    // 1. Criar lançamento primeiro (pendente)
    const { data: lancamento, error: lancError } = await supabase
      .from('lancamentos')
      .insert({
        colaborador_id,
        cliente_id,
        valor_total: valor_estimado,
        comissao_colaborador: comissaoColaborador,
        comissao_salao: comissaoSalao,
        data: data_hora,
        hora_inicio,
        hora_fim: hora_fim || hora_inicio,
        servicos_nomes: descricao_servico,
        status: 'pendente',
        observacoes: observacoes || null,
      })
      .select()
      .single();

    if (lancError) {
      console.error('[API/agendamentos] Erro ao criar lançamento:', lancError);
      return NextResponse.json({ error: lancError.message }, { status: 500 });
    }

    // 2. Criar agendamento vinculado ao lançamento
    const { data: agendamento, error: agendError } = await supabase
      .from('agendamentos')
      .insert({
        colaborador_id,
        cliente_id,
        data_hora,
        descricao_servico,
        duracao_minutos,
        valor_estimado,
        hora_inicio: hora_inicio || null,
        hora_fim: hora_fim || hora_inicio || null,
        lancamento_id: lancamento.id,
        status: 'pendente',
        observacoes: observacoes || null,
      })
      .select()
      .single();

    if (agendError) {
      console.error('[API/agendamentos] Erro ao criar agendamento:', agendError);
      // Rollback: deletar lançamento criado
      await supabase.from('lancamentos').delete().eq('id', lancamento.id);
      return NextResponse.json({ error: agendError.message }, { status: 500 });
    }

    // Registrar auditoria
    const authUser = await getAuthUser(supabase);
    if (authUser) {
      await auditCreate({
        ...authUser,
        modulo: 'Agenda',
        tabela: 'agendamentos',
        registroId: agendamento.id,
        dadosNovo: { ...agendamento, lancamento_id: lancamento.id },
        metodo: 'POST',
        endpoint: '/api/agendamentos',
      });
    }

    // Disparar mensagens WhatsApp (awaited, mas com try/catch para não afetar agendamento)
    try {
      const [{ data: clienteData }, { data: colaboradorData }] = await Promise.all([
        supabase.from('clientes').select('nome, telefone').eq('id', cliente_id).single(),
        supabase.from('colaboradores').select('nome').eq('id', colaborador_id).single(),
      ]);

      if (clienteData?.telefone && colaboradorData?.nome) {
        const telefoneNorm = normalizarTelefone(clienteData.telefone);
        if (validarTelefone(telefoneNorm)) {
          const paramsBase = {
            agendamentoId: agendamento.id,
            clienteId: cliente_id,
            clienteNome: clienteData.nome,
            clienteTelefone: clienteData.telefone,
            colaboradorNome: colaboradorData.nome,
            dataHora: data_hora,
          };

          // Comparar datas em BRT (banco armazena horário local sem timezone)
          // Converter data_hora para UTC adicionando 3h (BRT = UTC-3)
          const dataMatch = data_hora.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
          const agendamentoNoPassado = (() => {
            if (!dataMatch) return false;
            const [, ano, mes, dia, hora, min] = dataMatch;
            // Criar data como se fosse BRT, convertendo para UTC (+3h)
            const dataUTC = new Date(Date.UTC(
              parseInt(ano), parseInt(mes) - 1, parseInt(dia),
              parseInt(hora) + 3, parseInt(min)
            ));
            return dataUTC.getTime() < Date.now();
          })();

          if (agendamentoNoPassado) {
            // Agendamento no passado: não enviar nada automaticamente
            // Pós-venda será enviado pelo cron quando o lançamento for concluído
          } else {
            // Agendamento no futuro: confirmação + lembrete
            await agendarOuEnviarMensagem({
              ...paramsBase,
              tipo: 'confirmacao',
              dataProgramada: new Date(),
            });

            // Lembrete: programar para 21h BRT do dia anterior ao agendamento
            if (dataMatch) {
              const [, ano, mes, dia] = dataMatch;
              // 21h BRT do dia anterior = 00:00 UTC do dia do agendamento
              const dataLembrete = new Date(Date.UTC(
                parseInt(ano), parseInt(mes) - 1, parseInt(dia),
                0, 0, 0 // 00:00 UTC = 21:00 BRT do dia anterior
              ));

              // Calcular quantas horas faltam (em BRT)
              const horaAg = parseInt(dataMatch[4]);
              const minAg = parseInt(dataMatch[5]);
              const agendUTC = new Date(Date.UTC(parseInt(ano), parseInt(mes) - 1, parseInt(dia), horaAg + 3, minAg));
              const horasFaltam = (agendUTC.getTime() - Date.now()) / (1000 * 60 * 60);

              if (dataLembrete > new Date()) {
                // Dia anterior ainda não chegou: agendar
                await agendarOuEnviarMensagem({
                  ...paramsBase,
                  tipo: 'lembrete',
                  dataProgramada: dataLembrete,
                });
              } else if (horasFaltam > 1) {
                // Já passou das 21h do dia anterior mas falta mais de 1h: enviar agora
                await agendarOuEnviarMensagem({
                  ...paramsBase,
                  tipo: 'lembrete',
                  dataProgramada: new Date(),
                });
              }
              // Se < 1h, não envia lembrete
            }
          }
        } else {
        }
      } else {
      }
    } catch (whatsappError) {
      console.error('[WhatsApp] Erro ao disparar mensagens (não afeta agendamento):', whatsappError);
    }

    return NextResponse.json({
      success: true,
      agendamento,
      lancamento,
    });

  } catch (error: any) {
    console.error('[API/agendamentos] Erro fatal:', error);
    return NextResponse.json({ error: 'Erro ao criar agendamento' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    // Verificar autenticação
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do agendamento é obrigatório' }, { status: 400 });
    }

    const agendamentoId = parseInt(id);
    if (isNaN(agendamentoId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Buscar dados anteriores para auditoria
    const { data: dadosAnterior } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('id', agendamentoId)
      .single();

    if (!dadosAnterior) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });
    }

    // Atualizar agendamento
    const { data, error } = await supabase
      .from('agendamentos')
      .update(updateData)
      .eq('id', agendamentoId)
      .select()
      .single();

    if (error) {
      console.error('[API/agendamentos] Erro ao atualizar:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Registrar auditoria
    const authUser = await getAuthUser(supabase);
    if (authUser && data) {
      await auditUpdate({
        ...authUser,
        modulo: 'Agenda',
        tabela: 'agendamentos',
        registroId: agendamentoId,
        dadosAnterior,
        dadosNovo: data,
        metodo: 'PUT',
        endpoint: '/api/agendamentos',
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[API/agendamentos] Erro fatal PUT:', error);
    return NextResponse.json({ error: 'Erro ao atualizar agendamento' }, { status: 500 });
  }
}
