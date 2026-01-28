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
  colaboradores_ids?: number[]; // IDs dos colaboradores (para serviços compartilhados)
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
  // Campos para Fiado e Troca/Grátis
  is_fiado?: boolean;
  is_troca_gratis?: boolean;
  valor_referencia?: number; // Valor de referência para troca/grátis
  // Campos para Pacotes
  tipo_lancamento?: 'servico' | 'pacote_venda' | 'pacote_reembolso';
  pacote_id?: number;
  // Relacionamentos
  colaborador?: Colaborador;
  cliente?: Cliente;
  servicos?: Servico[];
  pagamento_fiado?: PagamentoFiado;
};

export type PagamentoFiado = {
  id: number;
  lancamento_id: number;
  valor_pago: number;
  forma_pagamento: string;
  data_pagamento: string;
  created_at: string;
  registrado_por?: string;
  registrado_por_nome?: string;
  observacoes?: string;
  comissao_colaborador?: number;
  comissao_salao?: number;
};

// ============================================================================
// TIPOS PARA PACOTES PRÉ-PAGOS
// ============================================================================

export type PacoteStatus = 'ativo' | 'expirado' | 'concluido' | 'cancelado';

export type Pacote = {
  id: number;
  cliente_id: number;
  servico_id: number;
  colaborador_vendedor_id: number;
  lancamento_venda_id?: number;
  nome: string;
  quantidade_total: number;
  quantidade_usada: number;
  valor_total: number;
  valor_por_sessao: number;
  desconto_percentual?: number;
  comissao_vendedor: number;
  comissao_salao: number;
  data_venda: string;
  data_validade?: string;
  data_cancelamento?: string;
  status: PacoteStatus;
  motivo_cancelamento?: string;
  valor_reembolso?: number;
  lancamento_reembolso_id?: number;
  forma_pagamento?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
  // Relacionamentos
  cliente?: Cliente;
  servico?: Servico;
  colaborador_vendedor?: Colaborador;
};

export type PacoteUso = {
  id: number;
  pacote_id: number;
  colaborador_executor_id: number;
  agendamento_id?: number;
  data_uso: string;
  hora_inicio?: string;
  hora_fim?: string;
  observacoes?: string;
  registrado_por?: string;
  registrado_por_nome?: string;
  created_at?: string;
  // Relacionamentos
  pacote?: Pacote;
  colaborador_executor?: Colaborador;
};
