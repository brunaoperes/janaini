import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

/**
 * Backfill one-time: cria os agendamentos faltantes para lançamentos órfãos
 * (lançamentos com horário que nunca entraram na tabela `agendamentos` porque a
 * criação do agendamento falhou no passado). Idempotente: só cria o que falta.
 *
 * Protegido por CRON_SECRET. Use ?dry=1 para apenas listar sem gravar.
 *   curl -H "Authorization: Bearer $CRON_SECRET" ".../api/admin/backfill-agendamentos?dry=1"
 */
async function handle(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dry = searchParams.get('dry') === '1';
  const reparar = searchParams.get('repararDataHora') === '1';
  const repararHF = searchParams.get('repararHoraFim') === '1';

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Modo reparo: registros com hora_fim <= hora_inicio. Corrige (UPDATE) em
  // lançamento E agendamento:
  //   • INVERTIDO (fim < início, ex.: 16:30→10:00): hora_fim = início + 30min
  //   • DURAÇÃO-ZERO (fim == início): hora_fim = início + 5min
  if (repararHF) {
    const mm = (v?: string | null): number | null => {
      if (!v || !/^\d{2}:\d{2}/.test(v)) return null;
      const [h, m] = v.slice(0, 5).split(':').map(Number); return h * 60 + m;
    };
    const { data: lancs, error: lErr } = await supabase
      .from('lancamentos').select('id, hora_inicio, hora_fim')
      .not('hora_inicio', 'is', null).not('hora_fim', 'is', null);
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

    const invalidos = (lancs || []).filter((l: any) => {
      const hi = mm(l.hora_inicio), hf = mm(l.hora_fim);
      return hi != null && hf != null && hf <= hi;
    });

    const rel: any[] = [];
    let corrigidos = 0;
    for (const l of invalidos as any[]) {
      const hi = String(l.hora_inicio).slice(0, 5);
      const hiMin = mm(hi) as number;
      const invertido = (mm(l.hora_fim) as number) < hiMin; // < = invertido; == = duração-zero
      const offset = invertido ? 30 : 5;
      const fimMin = hiMin + offset;
      const novoHF = `${String(Math.floor(fimMin / 60)).padStart(2, '0')}:${String(fimMin % 60).padStart(2, '0')}`;
      const tipo = invertido ? 'invertido(+30)' : 'zero(+5)';
      if (dry) { rel.push({ lancamento_id: l.id, tipo, inicio: hi, de: l.hora_fim, para: novoHF, acao: 'corrigiria' }); continue; }
      const { error: e1 } = await supabase.from('lancamentos').update({ hora_fim: novoHF }).eq('id', l.id);
      const { error: e2 } = await supabase.from('agendamentos').update({ hora_fim: novoHF, duracao_minutos: offset }).eq('lancamento_id', l.id);
      if (e1 || e2) { rel.push({ lancamento_id: l.id, acao: 'ERRO', erro: (e1 || e2)?.message }); }
      else { corrigidos++; rel.push({ lancamento_id: l.id, tipo, inicio: hi, de: l.hora_fim, para: novoHF, acao: 'corrigido' }); }
    }
    return NextResponse.json({ modo: 'repararHoraFim', dry, invalidos_encontrados: invalidos.length, corrigidos, relatorio: rel });
  }

  // ── Modo reparo: agendamentos cujo data_hora ficou em 00:00:00 mas têm
  // hora_inicio válida (some da agenda porque a grade posiciona por data_hora).
  // Corrige data_hora = dia + hora_inicio. Só UPDATE, nunca deleta.
  if (reparar) {
    const { data: ags, error: agErr } = await supabase
      .from('agendamentos')
      .select('id, data_hora, hora_inicio')
      .not('hora_inicio', 'is', null);
    if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 });

    const quebrados = (ags || []).filter((a: any) => {
      const hi = String(a.hora_inicio || '').slice(0, 5);
      const horaDataHora = (String(a.data_hora || '').match(/[T ](\d{2}:\d{2})/)?.[1]) || '';
      return /^\d{2}:\d{2}$/.test(hi) && hi !== '00:00' && horaDataHora === '00:00';
    });

    const rel: any[] = [];
    let corrigidos = 0;
    for (const a of quebrados as any[]) {
      const dia = String(a.data_hora).split(/[T ]/)[0];
      const novo = `${dia} ${String(a.hora_inicio).slice(0, 5)}:00`;
      if (dry) { rel.push({ id: a.id, de: a.data_hora, para: novo, acao: 'corrigiria' }); continue; }
      const { error: upErr } = await supabase.from('agendamentos').update({ data_hora: novo }).eq('id', a.id);
      if (upErr) { rel.push({ id: a.id, acao: 'ERRO', erro: upErr.message }); }
      else { corrigidos++; rel.push({ id: a.id, de: a.data_hora, para: novo, acao: 'corrigido' }); }
    }
    return NextResponse.json({ modo: 'repararDataHora', dry, quebrados_encontrados: quebrados.length, corrigidos, relatorio: rel });
  }

  // Lançamentos candidatos: têm horário e não estão cancelados
  const { data: lancamentos, error: lancErr } = await supabase
    .from('lancamentos')
    .select('id, colaborador_id, cliente_id, valor_total, data, hora_inicio, hora_fim, servicos_nomes, status, observacoes, compartilhado, is_troca_gratis')
    .not('hora_inicio', 'is', null)
    .neq('status', 'cancelado');

  if (lancErr) {
    return NextResponse.json({ error: lancErr.message }, { status: 500 });
  }

  const ids = (lancamentos || []).map((l: any) => l.id);
  const agendByLanc = new Set<number>();
  // Buscar em lotes quais lançamentos já têm agendamento
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const { data: ags } = await supabase
      .from('agendamentos')
      .select('lancamento_id')
      .in('lancamento_id', lote);
    (ags || []).forEach((a: any) => { if (a.lancamento_id != null) agendByLanc.add(a.lancamento_id); });
  }

  const orfaos = (lancamentos || []).filter((l: any) => !agendByLanc.has(l.id));

  const toMin = (v?: string | null): number | null => {
    if (!v || !/^\d{2}:\d{2}/.test(v)) return null;
    const [h, m] = v.slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  };

  const relatorio: any[] = [];
  let criados = 0;

  for (const l of orfaos as any[]) {
    const ini = toMin(l.hora_inicio);
    const fim = toMin(l.hora_fim);
    const duracao = ini != null && fim != null && fim > ini ? fim - ini : 60;
    // data pode vir "2026-06-03 11:00:00" ou "2026-06-03T11:00:00"
    const horaIni = (l.hora_inicio || '').slice(0, 5) || (String(l.data).match(/[T ](\d{2}:\d{2})/)?.[1] ?? null);

    const item: any = {
      lancamento_id: l.id,
      cliente_id: l.cliente_id,
      colaborador_id: l.colaborador_id,
      data: l.data,
      hora_inicio: horaIni,
      servico: l.servicos_nomes,
    };

    if (dry) {
      relatorio.push({ ...item, acao: 'criaria' });
      continue;
    }

    // data_hora PRECISA conter a hora (a grade da agenda posiciona o card por ela);
    // l.data às vezes guarda só a data (meia-noite) → junta com a hora_inicio.
    const diaL = String(l.data).split(/[T ]/)[0];
    const dataHoraFinal = horaIni ? `${diaL} ${horaIni}:00` : l.data;

    const { error: insErr } = await supabase.from('agendamentos').insert({
      lancamento_id: l.id,
      colaborador_id: l.colaborador_id,
      cliente_id: l.cliente_id,
      data_hora: dataHoraFinal,
      descricao_servico: l.servicos_nomes,
      duracao_minutos: duracao,
      valor_estimado: l.valor_total,
      hora_inicio: horaIni,
      hora_fim: l.hora_fim ? String(l.hora_fim).slice(0, 5) : null,
      status: 'pendente',
      observacoes: l.observacoes || null,
    });

    if (insErr) {
      relatorio.push({ ...item, acao: 'ERRO', erro: insErr.message });
    } else {
      criados++;
      relatorio.push({ ...item, acao: 'criado' });
    }
  }

  return NextResponse.json({
    dry,
    total_lancamentos_com_horario: ids.length,
    orfaos_encontrados: orfaos.length,
    criados,
    relatorio,
  });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
