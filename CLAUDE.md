# NaviBelle - Sistema para Salão (Janaini)

## Stack
Next.js 15 (App Router) + React 18 + TypeScript + Tailwind 3.4 + Supabase (PostgreSQL + Auth + RLS) + Zod 4.1

## Deploy
- **Principal:** Vercel (push na `main` = auto-deploy) — https://navibelle.com.br
- **Repo:** https://github.com/brunaoperes/janaini
- **Banco:** Supabase project `owtupbpktcjgnekqjiso`

## Comandos
```bash
npm run dev    # localhost:3000
npm run build  # build produção
npm run seed   # tsx scripts/seed-lancamentos.ts
```

## Padrões
- Schemas Zod em `lib/validations.ts` para TODOS os formulários
- APIs usam `createClient(url, serviceRoleKey)` + `getAuthUser()` inline
- Auditoria: `lib/audit.ts` (auditCreate, auditUpdate, auditDelete)
- Toast: `react-hot-toast` para feedback
- `export const dynamic = 'force-dynamic'` em todas as APIs
- Headers: `Cache-Control: no-store`
- Modais inline no próprio componente (não separar)
- Export Excel/PDF: `lib/export-utils.ts`

## WhatsApp (WAHA)
- Provedor: **WAHA self-hosted** (NÃO usa mais Z-API). Vars: `WAHA_URL`, `WAHA_SESSION`, `WAHA_API_KEY`. Envio via `POST {WAHA_URL}/api/sendText` (header `X-Api-Key`).
- Cron 21h BRT (`0 0 * * *` UTC = 00:00 UTC), plano Hobby 1x/dia
- 6 templates: confirmacao, lembrete, pos_venda, agenda_colaborador, agenda_colaborador_vazia, pendentes_colaborador
- Regra: agendamento passado → NÃO envia confirmação/lembrete/pós-venda
- Pós-venda só quando status=concluido E data_pagamento preenchido
- Dedup por telefone + tipo + conteúdo

## Cuidados
- NÃO usar sed em .tsx/.ts — usar Edit tool
- Remover console.log após debug
- Admin auto: brunoinfoperes@gmail.com
- Inatividade 4h = auto-logout (middleware)

## Contexto completo
Detalhes completos (modelos, APIs, páginas): ver `~/.claude/projects/-mnt-c-Users-Bruno/memory/navibelle_complete.md`
