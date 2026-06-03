import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

/**
 * One-time: marca lançamento(s) e agendamento(s) vinculado(s) como status='cancelado'
 * (NÃO deleta). Protegido por CRON_SECRET. ?ids=387  ?dry=1 só lista.
 */
async function handle(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const url = new URL(request.url);
  const dry = url.searchParams.get('dry') === '1';
  const ids = (url.searchParams.get('ids') || '')
    .split(',').map(s => Number(s.trim())).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ error: 'ids obrigatório (?ids=1,2)' }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rel: any[] = [];
  for (const id of ids) {
    const { data: lc } = await supabase
      .from('lancamentos').select('id, status, valor_total, servicos_nomes, hora_inicio').eq('id', id).single();
    if (!lc) { rel.push({ lancamento_id: id, acao: 'NÃO ENCONTRADO' }); continue; }
    if (dry) { rel.push({ lancamento_id: id, servico: lc.servicos_nomes, hora: lc.hora_inicio, status_atual: lc.status, acao: 'cancelaria' }); continue; }
    const { error: e1 } = await supabase.from('lancamentos').update({ status: 'cancelado' }).eq('id', id);
    const { error: e2 } = await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('lancamento_id', id);
    if (e1 || e2) rel.push({ lancamento_id: id, acao: 'ERRO', erro: (e1 || e2)?.message });
    else rel.push({ lancamento_id: id, servico: lc.servicos_nomes, hora: lc.hora_inicio, status_antes: lc.status, acao: 'cancelado' });
  }
  return NextResponse.json({ dry, relatorio: rel });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
