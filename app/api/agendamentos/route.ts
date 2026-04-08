import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auditCreate } from '@/lib/audit';
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

    console.log('[API/agendamentos] Criando agendamento:', { colaborador_id, cliente_id, data_hora });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

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

    console.log('[API/agendamentos] Lançamento criado:', lancamento.id);

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

    console.log('[API/agendamentos] Agendamento criado:', agendamento.id);

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

          const dataAgendamento = new Date(data_hora);
          const diffHoras = (dataAgendamento.getTime() - Date.now()) / (1000 * 60 * 60);

          if (diffHoras < 0) {
            // Agendamento no passado: só enviar pós-venda (avaliação)
            console.log('[WhatsApp] Agendamento no passado, enviando apenas pos-venda');
            await agendarOuEnviarMensagem({
              ...paramsBase,
              tipo: 'pos_venda',
              dataProgramada: new Date(),
            });
          } else {
            // Agendamento no futuro: confirmação + lembrete
            await agendarOuEnviarMensagem({
              ...paramsBase,
              tipo: 'confirmacao',
              dataProgramada: new Date(),
            });

            // Lembrete: programar para 21h BRT do dia anterior ao agendamento
            // Extrair data do agendamento (formato: YYYY-MM-DDTHH:MM)
            const match = data_hora.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
              const diaAnterior = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
              diaAnterior.setDate(diaAnterior.getDate() - 1);
              // 21h BRT = 00h UTC do dia seguinte (que é o dia do agendamento)
              const dataLembrete = new Date(Date.UTC(
                diaAnterior.getFullYear(),
                diaAnterior.getMonth(),
                diaAnterior.getDate() + 1,
                0, 0, 0 // 00:00 UTC = 21:00 BRT
              ));

              if (dataLembrete > new Date()) {
                // Dia anterior ainda não chegou: agendar
                await agendarOuEnviarMensagem({
                  ...paramsBase,
                  tipo: 'lembrete',
                  dataProgramada: dataLembrete,
                });
              } else if (diffHoras > 1) {
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
          console.warn(`[WhatsApp] Telefone inválido: ${clienteData.telefone}`);
        }
      } else {
        console.warn('[WhatsApp] Cliente sem telefone ou colaborador não encontrado');
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
