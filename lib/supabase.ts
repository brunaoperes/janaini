import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Cliente = {
  id: number;
  nome: string;
  telefone: string;
  aniversario: string;
};

export type Colaborador = {
  id: number;
  nome: string;
  porcentagem_comissao: number;
};

export type Servico = {
  id: number;
  nome: string;
  duracao_minutos: number;
  valor: number;
  descricao?: string;
  ativo: boolean;
  created_at?: string;
};

export type Agendamento = {
  id: number;
  cliente_id: number;
  colaborador_id: number;
  data_hora: string;
  descricao_servico: string;
  duracao_minutos?: number; // Duração em minutos (padrão: 60)
  cliente?: Cliente;
  colaborador?: Colaborador;
};

export type Lancamento = {
  id: number;
  colaborador_id: number;
  cliente_id: number;
  valor_total: number;
  forma_pagamento: string;
  comissao_colaborador: number;
  comissao_salao: number;
  data: string;
  colaborador?: Colaborador;
  cliente?: Cliente;
};
