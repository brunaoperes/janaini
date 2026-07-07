import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Comissões V2 por profissional (realizado no mês). SOMENTE admin.
// Regra: atendimentos concluídos válidos (não fiado, não troca). "A pagar" = comissao_colaborador (já líquida de taxa).
const n = (v: unknown) => Number(v) || 0;
function rangeMes(mes: string) { const [a, m] = mes.split('-').map(Number); const u = new Date(a, m, 0).getDate(); return { ini: `${mes}-01`, fim: `${mes}-${String(u).padStart(2, '0')}` }; }

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const mes = new URL(request.url).searchParams.get('mes') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
  const { ini, fim } = rangeMes(mes);

  const [lancRes, colabRes] = await Promise.all([
    supabase.from('lancamentos')
      .select('valor_total, comissao_colaborador, taxa_pagamento, status, is_fiado, is_troca_gratis, colaborador_id')
      .gte('data', `${ini}T00:00:00`).lte('data', `${fim}T23:59:59`),
    supabase.from('colaboradores').select('id, nome'),
  ]);
  if (lancRes.error) return errorResponse(lancRes.error.message, 500);

  const validos = (lancRes.data || []).filter((l) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis);
  const colabMap = new Map((colabRes.data || []).map((c) => [c.id, c.nome]));

  const acc: Record<number, { atendimentos: number; faturamento: number; aPagar: number; taxa: number }> = {};
  for (const l of validos) {
    const id = l.colaborador_id;
    if (!id) continue;
    (acc[id] ||= { atendimentos: 0, faturamento: 0, aPagar: 0, taxa: 0 });
    acc[id].atendimentos += 1;
    acc[id].faturamento += n(l.valor_total);
    acc[id].aPagar += n(l.comissao_colaborador);
    acc[id].taxa += n(l.taxa_pagamento);
  }

  const comissoes = Object.entries(acc)
    .map(([id, v]) => ({ colaborador_id: Number(id), nome: colabMap.get(Number(id)) || 'Sem nome', ...v }))
    .sort((a, b) => b.aPagar - a.aPagar);

  const totais = comissoes.reduce(
    (s, c) => ({ atendimentos: s.atendimentos + c.atendimentos, faturamento: s.faturamento + c.faturamento, aPagar: s.aPagar + c.aPagar, taxa: s.taxa + c.taxa }),
    { atendimentos: 0, faturamento: 0, aPagar: 0, taxa: 0 }
  );

  return jsonResponse({ mes, comissoes, totais });
}
