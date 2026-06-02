import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

/**
 * One-time: corrige serviços com duração inválida (<5min, placeholder de cadastro)
 * para 30min. Protegido por CRON_SECRET. ?dry=1 só lista.
 */
async function handle(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get('dry') === '1';
  const NOVA = 30;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: servicos, error } = await supabase
    .from('servicos')
    .select('id, nome, duracao_minutos, ativo')
    .or('duracao_minutos.is.null,duracao_minutos.lt.5');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const alvos = servicos || [];
  const rel: any[] = [];
  let corrigidos = 0;
  for (const s of alvos as any[]) {
    if (dry) { rel.push({ id: s.id, nome: s.nome, de: s.duracao_minutos, para: NOVA, ativo: s.ativo, acao: 'corrigiria' }); continue; }
    const { error: upErr } = await supabase.from('servicos').update({ duracao_minutos: NOVA }).eq('id', s.id);
    if (upErr) rel.push({ id: s.id, nome: s.nome, acao: 'ERRO', erro: upErr.message });
    else { corrigidos++; rel.push({ id: s.id, nome: s.nome, de: s.duracao_minutos, para: NOVA, ativo: s.ativo, acao: 'corrigido' }); }
  }
  return NextResponse.json({ dry, alvos: alvos.length, corrigidos, relatorio: rel });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
