-- Serviços por colaboradora: cada colaboradora pode criar seus próprios serviços,
-- visíveis/editáveis só por ela. Serviços do salão continuam globais (dono nulo).
-- Aplicada em produção em 2026-07-06.

alter table servicos add column if not exists dono_colaborador_id integer references colaboradores(id) on delete cascade;
create index if not exists idx_servicos_dono on servicos(dono_colaborador_id);
comment on column servicos.dono_colaborador_id is 'Colaboradora dona do servico (criou). NULL = servico global do salao. Servico com dono so a dona usa/edita.';
