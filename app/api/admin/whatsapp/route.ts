import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/api-auth';
import { enviarMensagemZApi, normalizarTelefone, validarTelefone, verificarStatusInstancia } from '@/lib/whatsapp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET: Templates, histórico, stats e config
export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if (isAuthError(authResult)) return authResult;

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const secao = searchParams.get('secao') || 'templates';

  // TEMPLATES
  if (secao === 'templates') {
    const { data: templates, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ templates });
  }

  // STATS (contadores para o dashboard)
  if (secao === 'stats') {
    const [enviados, pendentes, erros, totalGeral] = await Promise.all([
      supabase.from('mensagens_whatsapp').select('id', { count: 'exact', head: true }).eq('status', 'enviado'),
      supabase.from('mensagens_whatsapp').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
      supabase.from('mensagens_whatsapp').select('id', { count: 'exact', head: true }).eq('status', 'erro'),
      supabase.from('mensagens_whatsapp').select('id', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      stats: {
        enviados: enviados.count || 0,
        pendentes: pendentes.count || 0,
        erros: erros.count || 0,
        total: totalGeral.count || 0,
      },
    });
  }

  // CONFIG (credenciais Z-API - mascaradas + status real da instância)
  if (secao === 'config') {
    const instanceId = process.env.ZAPI_INSTANCE_ID || '';
    const token = process.env.ZAPI_TOKEN || '';

    const statusInstancia = await verificarStatusInstancia();

    return NextResponse.json({
      config: {
        zapi_instance_id: instanceId ? `${instanceId.slice(0, 8)}...${instanceId.slice(-4)}` : 'Não configurado',
        zapi_token: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : 'Não configurado',
        zapi_configurado: !!(instanceId && token),
        zapi_connected: statusInstancia.connected,
        zapi_status: statusInstancia.status,
        zapi_status_error: statusInstancia.error,
        cron_schedule: 'A cada 30 minutos',
        tempo_lembrete: '24 horas antes',
        tempo_pos_venda: '15 minutos após conclusão',
        max_tentativas: 3,
      },
    });
  }

  // HISTÓRICO DE MENSAGENS
  const tipo = searchParams.get('tipo');
  const status = searchParams.get('status');
  const dataInicio = searchParams.get('dataInicio');
  const dataFim = searchParams.get('dataFim');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('mensagens_whatsapp')
    .select('*, clientes(nome)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tipo && tipo !== 'todos') {
    query = query.eq('tipo', tipo);
  }
  if (status && status !== 'todos') {
    query = query.eq('status', status);
  }
  if (dataInicio) {
    query = query.gte('created_at', `${dataInicio}T00:00:00`);
  }
  if (dataFim) {
    query = query.lte('created_at', `${dataFim}T23:59:59`);
  }

  const { data: mensagens, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    mensagens,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

// PUT: Atualizar template
export async function PUT(request: Request) {
  const authResult = await requireAdmin();
  if (isAuthError(authResult)) return authResult;

  const supabase = getSupabase();
  const body = await request.json();
  const { id, template, ativo } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID do template é obrigatório' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (template !== undefined) updateData.template = template;
  if (ativo !== undefined) updateData.ativo = ativo;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nenhum dado para atualizar' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('whatsapp_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}

// POST: Enviar mensagem de teste
export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if (isAuthError(authResult)) return authResult;

  const body = await request.json();
  const { telefone, mensagem } = body;

  if (!telefone || !mensagem) {
    return NextResponse.json({ error: 'Telefone e mensagem são obrigatórios' }, { status: 400 });
  }

  const telefoneNorm = normalizarTelefone(telefone);
  if (!validarTelefone(telefoneNorm)) {
    return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 });
  }

  try {
    // Verificar se instância está conectada antes de enviar
    const status = await verificarStatusInstancia();
    if (!status.connected) {
      return NextResponse.json({
        error: status.error || 'Instância Z-API desconectada. Conecte escaneando o QR Code em app.z-api.io',
      }, { status: 503 });
    }

    const response = await enviarMensagemZApi(telefoneNorm, mensagem);
    return NextResponse.json({ success: true, response });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
