-- ============================================================
-- NaviBelle V2 — Fase 4: Fechamento de caixa diário
-- Aplicada em produção em 2026-07-07 (via Management API).
-- Este arquivo versiona a estrutura para reaplicação/auditoria.
-- Aditiva e não-destrutiva: cria uma tabela nova, não altera nada existente.
-- ============================================================

create table if not exists caixas_diarios (
  id serial primary key,
  data date not null unique,                 -- 1 caixa por dia
  responsavel_nome varchar(120),             -- quem fechou
  previsto jsonb not null default '{}',       -- {dinheiro, pix, cartao_debito, cartao_credito, fiado, outros}
  informado jsonb not null default '{}',      -- valores contados na mão pelo operador
  total_previsto decimal(10,2) default 0,
  total_informado decimal(10,2) default 0,
  diferenca decimal(10,2) default 0,          -- informado - previsto (negativo = falta; positivo = sobra)
  status varchar(12) not null default 'aberto' check (status in ('aberto','fechado','reaberto')),
  observacoes text,
  fechado_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table caixas_diarios enable row level security;
drop policy if exists caixa_auth on caixas_diarios;
create policy caixa_auth on caixas_diarios for all to authenticated using (true) with check (true);

-- "Previsto" é calculado no servidor a partir dos lançamentos concluídos do dia (regra V2),
-- por forma de pagamento, + fiados recebidos no dia. A tabela guarda o snapshot ao fechar.
-- Reabertura muda status para 'reaberto' e é registrada em audit_logs (não bloqueia edições).
