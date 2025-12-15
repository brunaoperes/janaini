import { z } from 'zod';

// Schema para Colaborador
export const colaboradorSchema = z.object({
  nome: z.string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  porcentagem_comissao: z.number()
    .min(0, 'Comissão deve ser no mínimo 0%')
    .max(100, 'Comissão deve ser no máximo 100%'),
});

export type ColaboradorFormData = z.infer<typeof colaboradorSchema>;

// Schema para Cliente
export const clienteSchema = z.object({
  nome: z.string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  telefone: z.string()
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .max(15, 'Telefone deve ter no máximo 15 dígitos')
    .regex(/^[\d\s\-\(\)]+$/, 'Telefone deve conter apenas números, espaços, hífens e parênteses'),
  aniversario: z.string()
    .optional()
    .refine((date) => {
      if (!date) return true;
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, 'Data de aniversário inválida'),
});

export type ClienteFormData = z.infer<typeof clienteSchema>;

// Schema para Serviço
export const servicoSchema = z.object({
  nome: z.string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  duracao_minutos: z.number()
    .min(1, 'Duração deve ser maior que 0 minutos')
    .max(480, 'Duração deve ser no máximo 8 horas (480 minutos)'),
  valor: z.number()
    .min(0, 'Valor deve ser maior ou igual a 0')
    .max(99999.99, 'Valor muito alto'),
  descricao: z.string()
    .max(500, 'Descrição deve ter no máximo 500 caracteres')
    .optional(),
  ativo: z.boolean(),
});

export type ServicoFormData = z.infer<typeof servicoSchema>;

// Schema para Lançamento (Unificado com Agendamento)
export const lancamentoSchema = z.object({
  colaborador_id: z.number({ message: 'Selecione uma colaboradora' })
    .positive('Selecione uma colaboradora válida'),
  cliente_id: z.number({ message: 'Selecione um cliente' })
    .positive('Selecione um cliente válido'),
  data: z.string({ message: 'Selecione uma data' })
    .min(1, 'Selecione uma data'),
  hora_inicio: z.string({ message: 'Selecione o horário de início' })
    .min(1, 'Selecione o horário de início'),
  hora_fim: z.string({ message: 'Selecione o horário de fim' })
    .min(1, 'Selecione o horário de fim'),
  servicos_ids: z.array(z.number()).min(1, 'Selecione pelo menos um serviço'),
  servicos_nomes: z.string().optional(),
  valor_total: z.number({ message: 'Valor total é obrigatório' })
    .positive('Valor total deve ser maior que 0'),
  forma_pagamento: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito']).optional(),
  observacoes: z.string().max(500, 'Observações devem ter no máximo 500 caracteres').optional(),
  status: z.enum(['pendente', 'concluido', 'cancelado']).default('pendente'),
});

export type LancamentoFormData = z.infer<typeof lancamentoSchema>;

// Schema para finalizar lançamento (marcar como concluído)
export const finalizarLancamentoSchema = z.object({
  forma_pagamento: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'], {
    message: 'Selecione uma forma de pagamento',
  }),
  valor_pago: z.number({ message: 'Valor pago é obrigatório' })
    .positive('Valor deve ser maior que 0'),
  data_pagamento: z.string().optional(),
});

export type FinalizarLancamentoFormData = z.infer<typeof finalizarLancamentoSchema>;

// Schema para Agendamento
export const agendamentoSchema = z.object({
  cliente_id: z.number({ message: 'Selecione um cliente' })
    .positive('Selecione um cliente válido'),
  colaborador_id: z.number({ message: 'Selecione uma colaboradora' })
    .positive('Selecione uma colaboradora válida'),
  data_hora: z.string()
    .refine((date) => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, 'Data e hora inválidas')
    .refine((date) => {
      const parsedDate = new Date(date);
      return parsedDate > new Date();
    }, 'Data e hora devem ser futuras'),
  descricao_servico: z.string()
    .min(3, 'Descrição deve ter pelo menos 3 caracteres')
    .max(200, 'Descrição deve ter no máximo 200 caracteres')
    .trim(),
  duracao_minutos: z.number()
    .min(1, 'Duração deve ser maior que 0 minutos')
    .max(480, 'Duração deve ser no máximo 8 horas')
    .optional(),
});

export type AgendamentoFormData = z.infer<typeof agendamentoSchema>;

// Função auxiliar para formatar erros do Zod
export function formatZodErrors(errors: z.ZodError | undefined | null): string {
  if (!errors || !errors.issues) {
    return 'Erro de validação';
  }
  return errors.issues.map(err => err.message).join('\n');
}
