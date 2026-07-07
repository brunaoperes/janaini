import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Colaboradoras V2 (equipe + performance do mês). SOMENTE admin.
// Regra de "válido": status='concluido' && !is_fiado && !is_troca_gratis (mesma da V2 inteira).
const n = (v: unknown) => Number(v) || 0;
const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
function rangeMes(mes: string) { const [a, m] = mes.split('-').map(Number); const u = new Date(a, m, 0).getDate(); return { ini: `${mes}-01`, fim: `${mes}-${String(u).padStart(2, '0')}` }; }

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const mes = new URL(request.url).searchParams.get('mes') || mesAtual();
  const { ini, fim } = rangeMes(mes);

  const [colabRes, lancRes] = await Promise.all([
    supabase.from('colaboradores').select('id, nome, telefone, porcentagem_comissao').order('nome', { ascending: true }),
    supabase.from('lancamentos')
      .select('valor_total, comissao_colaborador, status, is_fiado, is_troca_gratis, colaborador_id')
      .gte('data', `${ini}T00:00:00`).lte('data', `${fim}T23:59:59`),
  ]);
  if (colabRes.error) return errorResponse(colabRes.error.message, 500);
  if (lancRes.error) return errorResponse(lancRes.error.message, 500);

  // Agrega em memória (sem N+1): uma passada nos lançamentos válidos do mês.
  const validos = (lancRes.data || []).filter((l) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis);
  const acc: Record<string, { faturamento: number; comissao: number; atendimentos: number }> = {};
  for (const l of validos) {
    const id = l.colaborador_id;
    if (!id) continue;
    (acc[id] ||= { faturamento: 0, comissao: 0, atendimentos: 0 });
    acc[id].faturamento += n(l.valor_total);
    acc[id].comissao += n(l.comissao_colaborador);
    acc[id].atendimentos += 1;
  }

  const colaboradoras = (colabRes.data || []).map((c) => {
    const v = acc[c.id] || { faturamento: 0, comissao: 0, atendimentos: 0 };
    return {
      id: c.id,
      nome: c.nome,
      telefone: c.telefone ?? null,
      porcentagem_comissao: n(c.porcentagem_comissao),
      faturamento: v.faturamento,
      comissao: v.comissao,
      atendimentos: v.atendimentos,
    };
  });

  return jsonResponse({ colaboradoras, mes });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  let body: { nome?: string; telefone?: string; porcentagem_comissao?: number };
  try { body = await request.json(); } catch { return errorResponse('Corpo inválido.', 400); }

  const nome = (body.nome || '').trim();
  if (!nome) return errorResponse('Informe o nome da colaboradora.', 400);
  const telefone = (body.telefone || '').trim() || null;
  const porcentagem = Math.max(0, Math.min(100, n(body.porcentagem_comissao)));

  const { data, error } = await supabase
    .from('colaboradores')
    .insert({ nome, telefone, porcentagem_comissao: porcentagem })
    .select('id, nome, telefone, porcentagem_comissao')
    .single();
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ colaboradora: data }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return errorResponse('Informe o id da colaboradora.', 400);

  let body: { nome?: string; telefone?: string; porcentagem_comissao?: number };
  try { body = await request.json(); } catch { return errorResponse('Corpo inválido.', 400); }

  const nome = (body.nome || '').trim();
  if (!nome) return errorResponse('Informe o nome da colaboradora.', 400);
  const telefone = (body.telefone || '').trim() || null;
  const porcentagem = Math.max(0, Math.min(100, n(body.porcentagem_comissao)));

  const { data, error } = await supabase
    .from('colaboradores')
    .update({ nome, telefone, porcentagem_comissao: porcentagem })
    .eq('id', id)
    .select('id, nome, telefone, porcentagem_comissao')
    .single();
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ colaboradora: data });
}
