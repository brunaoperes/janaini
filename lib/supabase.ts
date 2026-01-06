import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

// Client para componentes do browser (use client)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Client para Server Components e Server Actions (usa service role se disponível para bypass de RLS)
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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
  colaboradores_ids?: number[];
  created_at?: string;
};

export type Agendamento = {
  id: number;
  cliente_id: number;
  colaborador_id: number;
  data_hora: string;
  descricao_servico: string;
  duracao_minutos?: number;
  valor_estimado?: number; // Valor estimado dos serviços
  lancamento_id?: number; // Vínculo com lançamento
  status?: 'pendente' | 'executando' | 'concluido' | 'cancelado';
  cliente?: Cliente;
  colaborador?: Colaborador;
  lancamento?: Lancamento;
};

export type Lancamento = {
  id: number;
  colaborador_id: number;
  cliente_id: number;
  valor_total: number;
  forma_pagamento?: string; // Opcional até concluir
  comissao_colaborador: number;
  comissao_salao: number;
  data: string;
  hora_inicio?: string;
  hora_fim?: string;
  servicos_ids?: number[];
  servicos_nomes?: string;
  status?: 'pendente' | 'concluido' | 'cancelado';
  observacoes?: string;
  data_pagamento?: string;
  colaborador?: Colaborador;
  cliente?: Cliente;
  servicos?: Servico[];
};
