import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

/**
 * One-time: lançamentos de reembolso de pacote (tipo_lancamento='pacote_reembolso')
 * gravados POSITIVOS antes do fix inflavam o faturamento. Inverte o sinal de
 * valor_total/comissao_colaborador/comissao_salao/taxa_pagamento (UPDATE, não deleta).
 * Protegido por CRON_SECRET. ?dry=1 só lista.
 */
async function handle(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get('dry') === '1';

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Reembolsos com valor POSITIVO (os criados antes do fix)
  const { data: reembolsos, error } = await supabase
    .from('lancamentos')
    .select('id, valor_total, comissao_colaborador, comissao_salao, taxa_pagamento, servicos_nomes, data')
    .eq('tipo_lancamento', 'pacote_reembolso')
    .gt('valor_total', 0);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rel: any[] = [];
  let corrigidos = 0;
  for (const r of (reembolsos || []) as any[]) {
    if (dry) { rel.push({ id: r.id, data: r.data, servico: r.servicos_nomes, de: r.valor_total, para: -r.valor_total, acao: 'inverteria' }); continue; }
    const { error: upErr } = await supabase.from('lancamentos').update({
      valor_total: -Math.abs(r.valor_total || 0),
      comissao_colaborador: -Math.abs(r.comissao_colaborador || 0),
      comissao_salao: -Math.abs(r.comissao_salao || 0),
      taxa_pagamento: -Math.abs(r.taxa_pagamento || 0),
    }).eq('id', r.id);
    if (upErr) rel.push({ id: r.id, acao: 'ERRO', erro: upErr.message });
    else { corrigidos++; rel.push({ id: r.id, data: r.data, servico: r.servicos_nomes, de: r.valor_total, para: -r.valor_total, acao: 'invertido' }); }
  }
  return NextResponse.json({ dry, encontrados: (reembolsos || []).length, corrigidos, relatorio: rel });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
