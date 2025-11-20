import { supabase } from './supabase';

export interface ConflictCheck {
  hasConflict: boolean;
  conflictingAppointment?: {
    id: number;
    data_hora: string;
    cliente_nome: string;
    duracao_minutos: number;
  };
}

/**
 * Verifica se há conflito de horário para um agendamento
 * @param colaboradorId ID da colaboradora
 * @param dataHora Data e hora do agendamento
 * @param duracaoMinutos Duração do serviço em minutos
 * @param agendamentoId ID do agendamento atual (para edição)
 * @returns Objeto com informação sobre conflito
 */
export async function verificarConflitoAgenda(
  colaboradorId: number,
  dataHora: string,
  duracaoMinutos: number,
  agendamentoId?: number
): Promise<ConflictCheck> {
  const inicioNovo = new Date(dataHora);
  const fimNovo = new Date(inicioNovo.getTime() + duracaoMinutos * 60000);

  // Buscar agendamentos da colaboradora no mesmo dia
  const inicioDia = new Date(inicioNovo);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(inicioDia);
  fimDia.setHours(23, 59, 59, 999);

  let query = supabase
    .from('agendamentos')
    .select(`
      id,
      data_hora,
      duracao_minutos,
      clientes(nome)
    `)
    .eq('colaborador_id', colaboradorId)
    .gte('data_hora', inicioDia.toISOString())
    .lte('data_hora', fimDia.toISOString());

  // Se estiver editando, excluir o próprio agendamento da verificação
  if (agendamentoId) {
    query = query.neq('id', agendamentoId);
  }

  const { data: agendamentos, error } = await query;

  if (error) {
    console.error('Erro ao verificar conflitos:', error);
    return { hasConflict: false };
  }

  if (!agendamentos || agendamentos.length === 0) {
    return { hasConflict: false };
  }

  // Verificar sobreposição de horários
  for (const agendamento of agendamentos) {
    const inicioExistente = new Date(agendamento.data_hora);
    const duracaoExistente = agendamento.duracao_minutos || 60;
    const fimExistente = new Date(inicioExistente.getTime() + duracaoExistente * 60000);

    // Verifica se há sobreposição
    // Casos de conflito:
    // 1. Novo começa antes do existente terminar E termina depois do existente começar
    const hasSobreposicao = inicioNovo < fimExistente && fimNovo > inicioExistente;

    if (hasSobreposicao) {
      return {
        hasConflict: true,
        conflictingAppointment: {
          id: agendamento.id,
          data_hora: agendamento.data_hora,
          cliente_nome: (agendamento.clientes as any)?.nome || 'Cliente não identificado',
          duracao_minutos: duracaoExistente,
        },
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Formata conflito para exibição ao usuário
 */
export function formatarMensagemConflito(conflito: ConflictCheck): string {
  if (!conflito.hasConflict || !conflito.conflictingAppointment) {
    return '';
  }

  const { data_hora, cliente_nome, duracao_minutos } = conflito.conflictingAppointment;
  const inicio = new Date(data_hora);
  const fim = new Date(inicio.getTime() + duracao_minutos * 60000);

  const horaInicio = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const horaFim = fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return `Conflito de horário! Já existe um agendamento para ${cliente_nome} das ${horaInicio} às ${horaFim}.`;
}
