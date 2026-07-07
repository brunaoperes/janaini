import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/v2/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Configurações V2: formas de pagamento + parâmetros financeiros. SOMENTE admin.
// config_financeiro guarda valor como TEXTO por chave. meta_mensal é lida pelo dashboard — mantemos "número em texto".
const CHAVES_PERMITIDAS = ['meta_mensal', 'aliquota_imposto'] as const;
type ChaveConfig = (typeof CHAVES_PERMITIDAS)[number];

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function GET() {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const [formasRes, cfgRes] = await Promise.all([
    supabase.from('formas_pagamento').select('id, nome, codigo, icone, taxa_percentual, ativo, ordem').order('ordem', { ascending: true }),
    supabase.from('config_financeiro').select('chave, valor').in('chave', [...CHAVES_PERMITIDAS]),
  ]);
  if (formasRes.error) return errorResponse(formasRes.error.message, 500);
  if (cfgRes.error) return errorResponse(cfgRes.error.message, 500);

  const cfgMap = new Map((cfgRes.data || []).map((c) => [c.chave, c.valor]));
  const config = {
    meta_mensal: toNum(cfgMap.get('meta_mensal')),
    aliquota_imposto: toNum(cfgMap.get('aliquota_imposto')),
  };

  return jsonResponse({ formas: formasRes.data || [], config });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  let body: any;
  try { body = await request.json(); } catch { return errorResponse('Corpo inválido.', 400); }

  // --- Atualizar forma de pagamento ---
  if (body?.tipo === 'forma') {
    const id = body.id;
    if (id === undefined || id === null) return errorResponse('Informe o id da forma de pagamento.', 400);

    const patch: Record<string, unknown> = {};
    if (body.taxa_percentual !== undefined) {
      const taxa = Number(body.taxa_percentual);
      if (!Number.isFinite(taxa) || taxa < 0 || taxa > 100) return errorResponse('Taxa deve ser entre 0 e 100.', 400);
      patch.taxa_percentual = taxa;
    }
    if (body.ativo !== undefined) patch.ativo = !!body.ativo;
    if (Object.keys(patch).length === 0) return errorResponse('Nada para atualizar.', 400);

    const { data, error } = await supabase.from('formas_pagamento').update(patch).eq('id', id)
      .select('id, nome, codigo, icone, taxa_percentual, ativo, ordem').single();
    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ ok: true, forma: data });
  }

  // --- Upsert de configuração financeira ---
  if (body?.tipo === 'config') {
    const chave = body.chave as ChaveConfig;
    if (!CHAVES_PERMITIDAS.includes(chave)) return errorResponse('Chave não permitida.', 400);

    const valNum = toNum(body.valor);
    if (valNum === null || valNum < 0) return errorResponse('Valor inválido.', 400);
    if (chave === 'aliquota_imposto' && valNum > 100) return errorResponse('Alíquota deve ser entre 0 e 100.', 400);

    // Salva como número em texto (não quebra o formato consumido pelo dashboard).
    const { data, error } = await supabase.from('config_financeiro')
      .upsert({ chave, valor: String(valNum), updated_at: new Date().toISOString() }, { onConflict: 'chave' })
      .select('chave, valor').single();
    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ ok: true, config: { chave: data.chave, valor: toNum(data.valor) } });
  }

  return errorResponse('Tipo inválido. Use "forma" ou "config".', 400);
}
