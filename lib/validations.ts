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

// ============================================================================
// SCHEMAS PARA PACOTES PRÉ-PAGOS
// ============================================================================

// Schema para criar Pacote (venda)
export const pacoteCreateSchema = z.object({
  cliente_id: z.number({ message: 'Selecione um cliente' })
    .positive('Selecione um cliente válido'),
  servico_id: z.number({ message: 'Selecione um serviço' })
    .positive('Selecione um serviço válido'),
  colaborador_vendedor_id: z.number({ message: 'Selecione a vendedora' })
    .positive('Selecione uma vendedora válida'),
  quantidade_total: z.number({ message: 'Informe a quantidade de sessões' })
    .min(1, 'Quantidade mínima é 1 sessão')
    .max(100, 'Quantidade máxima é 100 sessões'),
  valor_total: z.number({ message: 'Informe o valor total' })
    .min(0, 'Valor não pode ser negativo'),
  desconto_percentual: z.number()
    .min(0, 'Desconto não pode ser negativo')
    .max(100, 'Desconto máximo é 100%')
    .optional(),
  data_validade: z.string()
    .optional()
    .refine((date) => {
      if (!date) return true;
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime()) && parsedDate > new Date();
    }, 'Data de validade deve ser futura'),
  forma_pagamento: z.string({ message: 'Selecione uma forma de pagamento' })
    .min(1, 'Selecione uma forma de pagamento'),
  observacoes: z.string().max(500, 'Observações devem ter no máximo 500 caracteres').optional(),
});

export type PacoteCreateFormData = z.infer<typeof pacoteCreateSchema>;

// Schema para usar sessão do Pacote
export const pacoteUsoSchema = z.object({
  pacote_id: z.number({ message: 'Selecione um pacote' })
    .positive('Selecione um pacote válido'),
  colaborador_executor_id: z.number({ message: 'Selecione a colaboradora que realizou' })
    .positive('Selecione uma colaboradora válida'),
  data_uso: z.string({ message: 'Informe a data do uso' })
    .min(1, 'Informe a data'),
  hora_inicio: z.string().optional(),
  hora_fim: z.string().optional(),
  observacoes: z.string().max(500, 'Observações devem ter no máximo 500 caracteres').optional(),
});

export type PacoteUsoFormData = z.infer<typeof pacoteUsoSchema>;

// Schema para cancelar Pacote
export const pacoteCancelSchema = z.object({
  pacote_id: z.number().positive(),
  motivo_cancelamento: z.string()
    .min(5, 'Motivo deve ter pelo menos 5 caracteres')
    .max(500, 'Motivo deve ter no máximo 500 caracteres'),
  valor_reembolso: z.number()
    .min(0, 'Valor de reembolso não pode ser negativo'),
  forma_reembolso: z.string().optional(),
});

export type PacoteCancelFormData = z.infer<typeof pacoteCancelSchema>;
