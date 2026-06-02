import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

/**
 * One-time: desativa um serviço por id (ativo=false). Protegido por CRON_SECRET.
 *   curl -H "Authorization: Bearer $CRON_SECRET" ".../api/admin/deactivate-servico?id=101"
 */
async function handle(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: antes } = await supabase.from('servicos').select('id, nome, ativo').eq('id', id).single();
  if (!antes) return NextResponse.json({ error: 'serviço não encontrado' }, { status: 404 });

  const { error } = await supabase.from('servicos').update({ ativo: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, servico: { id: antes.id, nome: antes.nome, ativo_antes: antes.ativo, ativo_agora: false } });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
