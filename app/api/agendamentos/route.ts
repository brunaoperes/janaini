import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auditCreate, auditUpdate } from '@/lib/audit';
import { requireAuth, isAuthError } from '@/lib/api-auth';
import { agendarOuEnviarMensagem, normalizarTelefone, validarTelefone } from '@/lib/whatsapp';
import { horarioInvalido } from '@/lib/horario';

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
      colaboradores_ids,
      lancamento_id: existingLancamentoId, // se vier, NÃO cria novo lançamento
      apenasVerificar, // se true, só checa conflito de horário e retorna (não cria nada)
    } = body;

    // Blindagem: término não pode ser <= início
    if (horarioInvalido(hora_inicio, hora_fim)) {
      return NextResponse.json({ error: 'Horário inválido: o término deve ser depois do início.' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // ── Verificação de conflito de horário ───────────────────────────────
    // (1) o mesmo COLABORADOR não pode ter dois horários sobrepostos;
    // (2) a mesma CLIENTE não pode estar em dois lugares ao mesmo tempo
    //     (mesmo com colaboradores diferentes).
    const diaMatch = data_hora.match(/(\d{4}-\d{2}-\d{2})/);
    const diaStr = diaMatch ? diaMatch[1] : data_hora.split('T')[0];

    // Converte um registro em [inícioMin, fimMin]. Duração inválida (<=0) = 60min.
    const intervalo = (hi?: string | null, hf?: string | null, dur?: number | null, dh?: string | null): [number, number] | null => {
      let ini: number | null = null;
      if (hi && /^\d{2}:\d{2}/.test(hi)) { const [h, m] = hi.slice(0, 5).split(':').map(Number); ini = h * 60 + m; }
      else if (dh) { const mm = dh.match(/[T ](\d{2}):(\d{2})/); if (mm) ini = parseInt(mm[1]) * 60 + parseInt(mm[2]); }
      if (ini == null) return null;
      let fim = ini + (dur && dur > 0 ? dur : 60);
      if (hf && /^\d{2}:\d{2}/.test(hf)) { const [h, m] = hf.slice(0, 5).split(':').map(Number); const f = h * 60 + m; if (f > ini) fim = f; }
      return [ini, fim];
    };

    const novoInt = intervalo(hora_inicio, hora_fim, duracao_minutos, data_hora);
    const inicioNovoMin = novoInt ? novoInt[0] : 0;
    const fimNovoMin = novoInt ? novoInt[1] : 60;
    const sobrepoe = (iv: [number, number] | null) => iv != null && inicioNovoMin < iv[1] && fimNovoMin > iv[0];

    // agendamentos tem 2 FKs p/ clientes e p/ colaboradores: embed sem FK explícita
    // dá erro PGRST201 e a query volta vazia (era por isso que o check falhava).
    const SEL_AG = 'id, data_hora, duracao_minutos, hora_inicio, hora_fim, lancamento_id, clientes!fk_agendamentos_cliente(nome), colaboradores!fk_agendamentos_colaborador(nome)';

    // (1) Conflito com o mesmo COLABORADOR (agendamentos + lançamentos)
    const [{ data: agColab }, { data: lcColab }] = await Promise.all([
      supabase.from('agendamentos').select(SEL_AG)
        .eq('colaborador_id', colaborador_id)
        .gte('data_hora', `${diaStr} 00:00:00`).lte('data_hora', `${diaStr} 23:59:59`)
        .neq('status', 'cancelado'),
      supabase.from('lancamentos').select('id, hora_inicio, hora_fim, data, clientes(nome)')
        .eq('colaborador_id', colaborador_id)
        .gte('data', `${diaStr} 00:00:00`).lte('data', `${diaStr} 23:59:59`)
        .neq('status', 'cancelado'),
    ]);

    for (const ag of (agColab || []) as any[]) {
      if (existingLancamentoId && ag.lancamento_id === existingLancamentoId) continue;
      if (sobrepoe(intervalo(ag.hora_inicio, ag.hora_fim, ag.duracao_minutos, ag.data_hora))) {
        const nome = ag.clientes?.nome || 'outro cliente';
        return NextResponse.json({ error: `Conflito de horário: este colaborador já tem agendamento às ${ag.hora_inicio || ''} com ${nome}` }, { status: 409 });
      }
    }
    for (const lc of (lcColab || []) as any[]) {
      if (existingLancamentoId && lc.id === existingLancamentoId) continue;
      if (sobrepoe(intervalo(lc.hora_inicio, lc.hora_fim, null, null))) {
        const nome = lc.clientes?.nome || 'outro cliente';
        return NextResponse.json({ error: `Conflito de horário: este colaborador já tem lançamento às ${lc.hora_inicio} com ${nome}` }, { status: 409 });
      }
    }

    // (2) Mesma CLIENTE no mesmo horário (com OUTRO colaborador) — NÃO bloqueia
    // (atendimento simultâneo mão+pé é legítimo), apenas devolve um aviso.
    let avisoCliente: string | undefined;
    if (cliente_id) {
      const [{ data: agCli }, { data: lcCli }] = await Promise.all([
        supabase.from('agendamentos').select(SEL_AG)
          .eq('cliente_id', cliente_id)
          .gte('data_hora', `${diaStr} 00:00:00`).lte('data_hora', `${diaStr} 23:59:59`)
          .neq('status', 'cancelado'),
        supabase.from('lancamentos').select('id, hora_inicio, hora_fim, data, colaboradores(nome)')
          .eq('cliente_id', cliente_id)
          .gte('data', `${diaStr} 00:00:00`).lte('data', `${diaStr} 23:59:59`)
          .neq('status', 'cancelado'),
      ]);

      for (const ag of (agCli || []) as any[]) {
        if (existingLancamentoId && ag.lancamento_id === existingLancamentoId) continue;
        if (sobrepoe(intervalo(ag.hora_inicio, ag.hora_fim, ag.duracao_minutos, ag.data_hora))) {
          const nome = ag.colaboradores?.nome || 'outro colaborador';
          avisoCliente = `Atenção: esta cliente já tem horário às ${ag.hora_inicio || ''} com ${nome} (atendimento simultâneo).`;
          break;
        }
      }
      if (!avisoCliente) {
        for (const lc of (lcCli || []) as any[]) {
          if (existingLancamentoId && lc.id === existingLancamentoId) continue;
          if (sobrepoe(intervalo(lc.hora_inicio, lc.hora_fim, null, null))) {
            const nome = lc.colaboradores?.nome || 'outro colaborador';
            avisoCliente = `Atenção: esta cliente já tem horário às ${lc.hora_inicio} com ${nome} (atendimento simultâneo).`;
            break;
          }
        }
      }
    }

    // Modo "só verificar": chegou aqui sem conflito (os checks acima retornam 409 se houver).
    // Usado pela tela de Lançamentos para validar o horário ANTES de criar o lançamento,
    // evitando lançamento órfão (salvo sem agendamento) quando há conflito.
    if (apenasVerificar) {
      return NextResponse.json({ ok: true, aviso: avisoCliente });
    }

    // Se veio lancamento_id, reaproveita; senão cria um lançamento pendente
    let lancamentoIdParaVincular: number;

    if (existingLancamentoId) {
      lancamentoIdParaVincular = existingLancamentoId;
    } else {
      // Buscar colaborador para calcular comissão
      const { data: colaborador } = await supabase
        .from('colaboradores')
        .select('porcentagem_comissao')
        .eq('id', colaborador_id)
        .single();

      const porcentagemComissao = colaborador?.porcentagem_comissao || 50;
      const comissaoColaborador = (valor_estimado * porcentagemComissao) / 100;
      const comissaoSalao = valor_estimado - comissaoColaborador;

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
      lancamentoIdParaVincular = lancamento.id;
    }

    // Criar agendamento vinculado ao lançamento (novo ou existente)
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
        lancamento_id: lancamentoIdParaVincular,
        status: 'pendente',
        observacoes: observacoes || null,
        colaboradores_ids: Array.isArray(colaboradores_ids) && colaboradores_ids.length > 0 ? colaboradores_ids : null,
      })
      .select()
      .single();

    if (agendError) {
      console.error('[API/agendamentos] Erro ao criar agendamento:', agendError);
      // Rollback só se criamos o lançamento aqui
      if (!existingLancamentoId) {
        await supabase.from('lancamentos').delete().eq('id', lancamentoIdParaVincular);
      }
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
        dadosNovo: { ...agendamento, lancamento_id: lancamentoIdParaVincular },
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
      lancamento_id: lancamentoIdParaVincular,
      aviso: avisoCliente,
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
    const { id, lancamento_id, ...updateData } = body;

    if (!id && !lancamento_id) {
      return NextResponse.json({ error: 'ID do agendamento ou lancamento_id é obrigatório' }, { status: 400 });
    }

    // Blindagem: término não pode ser <= início
    if (horarioInvalido(updateData.hora_inicio, updateData.hora_fim)) {
      return NextResponse.json({ error: 'Horário inválido: o término deve ser depois do início.' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Buscar dados anteriores para auditoria (por id ou lancamento_id)
    let dadosAnterior: any = null;
    let agendamentoId: number;

    if (id) {
      agendamentoId = parseInt(id);
      const { data } = await supabase.from('agendamentos').select('*').eq('id', agendamentoId).single();
      dadosAnterior = data;
    } else {
      const { data } = await supabase.from('agendamentos').select('*').eq('lancamento_id', lancamento_id).single();
      dadosAnterior = data;
      agendamentoId = dadosAnterior?.id;
    }

    if (!dadosAnterior || !agendamentoId) {
      // Auto-cura: se veio por lancamento_id e o agendamento não existe (lançamento órfão —
      // criado quando a criação do agendamento havia falhado), cria agora em vez de 404.
      if (lancamento_id && !id) {
        const horaIni = updateData.data_hora?.match(/[T ](\d{2}:\d{2})/)?.[1] || null;
        const { data: novo, error: insErr } = await supabase
          .from('agendamentos')
          .insert({
            lancamento_id,
            colaborador_id: updateData.colaborador_id,
            cliente_id: updateData.cliente_id,
            data_hora: updateData.data_hora,
            descricao_servico: updateData.descricao_servico,
            duracao_minutos: updateData.duracao_minutos,
            valor_estimado: updateData.valor_estimado,
            hora_inicio: horaIni,
            status: updateData.status || 'pendente',
            observacoes: updateData.observacoes || null,
            colaboradores_ids: Array.isArray(updateData.colaboradores_ids) && updateData.colaboradores_ids.length > 0 ? updateData.colaboradores_ids : null,
          })
          .select()
          .single();
        if (insErr) {
          console.error('[API/agendamentos] Erro ao auto-criar agendamento no PUT:', insErr);
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: novo, created: true });
      }
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
