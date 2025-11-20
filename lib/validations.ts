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

// Schema para Lançamento
export const lancamentoSchema = z.object({
  colaborador_id: z.number({
    required_error: 'Selecione uma colaboradora',
    invalid_type_error: 'Colaboradora inválida',
  }).positive('Selecione uma colaboradora válida'),
  cliente_id: z.number({
    invalid_type_error: 'Cliente inválido',
  }).positive('Selecione um cliente válido').optional(),
  valor_total: z.number({
    required_error: 'Valor total é obrigatório',
    invalid_type_error: 'Valor total deve ser um número',
  }).positive('Valor total deve ser maior que 0'),
  forma_pagamento: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'], {
    required_error: 'Selecione uma forma de pagamento',
    invalid_type_error: 'Forma de pagamento inválida',
  }),
});

export type LancamentoFormData = z.infer<typeof lancamentoSchema>;

// Schema para Agendamento
export const agendamentoSchema = z.object({
  cliente_id: z.number({
    required_error: 'Selecione um cliente',
    invalid_type_error: 'Cliente inválido',
  }).positive('Selecione um cliente válido'),
  colaborador_id: z.number({
    required_error: 'Selecione uma colaboradora',
    invalid_type_error: 'Colaboradora inválida',
  }).positive('Selecione uma colaboradora válida'),
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
export function formatZodErrors(errors: z.ZodError): string {
  return errors.errors.map(err => err.message).join('\n');
}
