import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

type TipoMensagem = 'confirmacao' | 'lembrete' | 'pos_venda' | 'agenda_colaborador' | 'agenda_colaborador_vazia' | 'pendentes_colaborador';

interface ZApiResponse {
  zapiMessageId?: string;
  messageId?: string;
  [key: string]: unknown;
}

interface AgendarMensagemParams {
  agendamentoId: number;
  tipo: TipoMensagem;
  clienteId: number;
  clienteNome: string;
  clienteTelefone: string;
  colaboradorNome: string;
  dataHora: string;
  dataProgramada: Date;
}

// ============================================================================
// NORMALIZAÇÃO E VALIDAÇÃO DE TELEFONE
// ============================================================================

export function normalizarTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '');

  if (digitos.startsWith('55')) {
    return digitos;
  }

  return `55${digitos}`;
}

export function validarTelefone(telefoneNormalizado: string): boolean {
  if (!telefoneNormalizado.startsWith('55')) return false;
  if (telefoneNormalizado.length < 12 || telefoneNormalizado.length > 13) return false;
  return true;
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ============================================================================
// TEMPLATES DE MENSAGEM
// ============================================================================

// O banco armazena horário local (BRT) como UTC (sem conversão).
// Extraímos direto da string ISO para evitar conversão de timezone.
function formatarData(dataHora: string): string {
  // Extrair YYYY-MM-DD da string e formatar como DD/MM/YYYY
  const match = dataHora.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return format(new Date(dataHora), "dd/MM/yyyy", { locale: ptBR });
}

function formatarHorario(dataHora: string): string {
  // Extrair HH:MM direto da string ISO (antes de qualquer conversão de timezone)
  const match = dataHora.match(/[T ](\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  return format(new Date(dataHora), "HH:mm", { locale: ptBR });
}

// Templates fallback (usados se o banco não retornar)
const TEMPLATES_FALLBACK: Record<TipoMensagem, string> = {
  confirmacao: `Olá, {nome}! ✨
Seu horário na Naví Belle Studio de Beleza foi agendado com sucesso.

💇‍♀️ Profissional: {profissional}
📅 Data: {data}
⏰ Horário: {horario}

Estamos te esperando para um momento especial 💖
Não se atrase e até breve!`,

  lembrete: `Olá, {nome}! 💬
Passando para te lembrar do seu horário na Naví Belle Studio de Beleza.

💇‍♀️ Profissional: {profissional}
📅 Amanhã, dia {data}
⏰ Horário: {horario}

Já estamos preparando tudo para te atender da melhor forma ✨
Te esperamos!`,

  pos_venda: `Olá, {nome}! 💖
Foi um prazer te atender na Naví Belle Studio de Beleza.

💇‍♀️ Profissional: {profissional}

Esperamos que você tenha amado a experiência ✨
Sua opinião é muito importante para nós.

Se puder, deixe sua avaliação no Google 👇
https://g.page/r/CVNlyTG4OjJLEBM/review

Muito obrigado pela confiança 💫
Volte sempre!`,

  agenda_colaborador: `Bom dia, {nome}! 📋
Sua agenda para amanha ({data}):

{agenda}
Total: {total} atendimento(s)

Tenha um otimo dia de trabalho! ✨`,

  agenda_colaborador_vazia: `Ola, {nome}! 📋
Voce nao tem nenhum agendamento para amanha ({data}).

Aproveite para descansar! 😊`,

  pendentes_colaborador: `{nome}, voce tem {total} agendamento(s) pendente(s) de hoje que precisam ser fechados:

{pendentes}

Por favor, finalize esses atendimentos no sistema!`,
};

function aplicarPlaceholders(template: string, nome: string, profissional: string, dataHora: string): string {
  return template
    .replace(/\{nome\}/g, nome)
    .replace(/\{profissional\}/g, profissional)
    .replace(/\{data\}/g, formatarData(dataHora))
    .replace(/\{horario\}/g, formatarHorario(dataHora));
}

async function buscarTemplateDoBanco(tipo: TipoMensagem): Promise<{ template: string; ativo: boolean } | null> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('template, ativo')
      .eq('tipo', tipo)
      .single();

    if (data) {
      return { template: data.template, ativo: data.ativo };
    }
    return null;
  } catch {
    return null;
  }
}

export async function verificarTemplateAtivo(tipo: TipoMensagem): Promise<boolean> {
  const result = await buscarTemplateDoBanco(tipo);
  // Se não encontrou no banco, considera ativo (usa fallback)
  if (!result) return true;
  return result.ativo;
}

export async function gerarMensagem(tipo: TipoMensagem, nome: string, profissional: string, dataHora: string): Promise<string> {
  const resultado = await buscarTemplateDoBanco(tipo);
  const template = resultado?.template || TEMPLATES_FALLBACK[tipo];
  return aplicarPlaceholders(template, nome, profissional, dataHora);
}

export async function gerarMensagemAgendaColaborador(
  nomeColaborador: string,
  data: string, // DD/MM/YYYY
  agendamentos: { horario: string; cliente: string; servico: string }[]
): Promise<{ mensagem: string; ativo: boolean }> {
  const resultado = await buscarTemplateDoBanco('agenda_colaborador');
  const ativo = resultado ? resultado.ativo : true;
  const template = resultado?.template || TEMPLATES_FALLBACK['agenda_colaborador'];

  if (agendamentos.length === 0) {
    // Sem agendamentos: usar template vazio do banco
    const resultadoVazio = await buscarTemplateDoBanco('agenda_colaborador_vazia');
    const ativoVazio = resultadoVazio ? resultadoVazio.ativo : true;
    const templateVazio = resultadoVazio?.template || TEMPLATES_FALLBACK['agenda_colaborador_vazia'];
    const mensagem = templateVazio
      .replace(/\{nome\}/g, nomeColaborador)
      .replace(/\{data\}/g, data);
    return { mensagem, ativo: ativoVazio };
  }

  // Montar a lista de agendamentos
  const agendaTexto = agendamentos
    .map((ag, i) => `${i + 1}. ${ag.horario} - ${ag.cliente}\n   ${ag.servico}`)
    .join('\n\n');

  const mensagem = template
    .replace(/\{nome\}/g, nomeColaborador)
    .replace(/\{data\}/g, data)
    .replace(/\{agenda\}/g, agendaTexto)
    .replace(/\{total\}/g, String(agendamentos.length));

  return { mensagem, ativo };
}

export async function gerarMensagemPendentesColaborador(
  nomeColaborador: string,
  pendentes: { horario: string; cliente: string; servico: string }[]
): Promise<{ mensagem: string; ativo: boolean }> {
  const resultado = await buscarTemplateDoBanco('pendentes_colaborador');
  const ativo = resultado ? resultado.ativo : true;
  const template = resultado?.template || TEMPLATES_FALLBACK['pendentes_colaborador'];

  if (pendentes.length === 0) return { mensagem: '', ativo: false };

  const pendentesTexto = pendentes
    .map((p, i) => `${i + 1}. ${p.horario} - ${p.cliente}\n   ${p.servico}`)
    .join('\n\n');

  const mensagem = template
    .replace(/\{nome\}/g, nomeColaborador)
    .replace(/\{pendentes\}/g, pendentesTexto)
    .replace(/\{total\}/g, String(pendentes.length));

  return { mensagem, ativo };
}

// ============================================================================
// ENVIO VIA Z-API
// ============================================================================

export async function verificarStatusInstancia(): Promise<{ connected: boolean; status: string; error?: string }> {
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
    return { connected: false, status: 'not_configured', error: 'Z-API não configurada: ZAPI_INSTANCE_ID ou ZAPI_TOKEN ausentes' };
  }

  try {
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/status`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Client-Token': ZAPI_CLIENT_TOKEN || '',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { connected: false, status: 'error', error: `Z-API erro ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const connected = data.connected === true || data.status === 'connected';
    return {
      connected,
      status: data.status || (connected ? 'connected' : 'disconnected'),
      error: connected ? undefined : 'Instância Z-API desconectada. Conecte escaneando o QR Code em app.z-api.io',
    };
  } catch (err: any) {
    return { connected: false, status: 'error', error: `Erro ao verificar status: ${err.message}` };
  }
}

export async function enviarMensagemZApi(telefone: string, mensagem: string): Promise<ZApiResponse> {
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
    throw new Error('Z-API não configurada: ZAPI_INSTANCE_ID ou ZAPI_TOKEN ausentes');
  }

  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_CLIENT_TOKEN || '',
    },
    body: JSON.stringify({
      phone: telefone,
      message: mensagem,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Z-API erro ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // Z-API pode retornar 200 mas com erro no body
  if (data.error) {
    throw new Error(`Z-API: ${typeof data.error === 'string' ? data.error : JSON.stringify(data.error)}`);
  }

  return data;
}

// ============================================================================
// ORQUESTRAÇÃO
// ============================================================================

export async function processarEnvio(mensagemId: number, telefone: string, mensagemTexto: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  // Buscar tentativas atuais
  const { data: msgAtual } = await supabase
    .from('mensagens_whatsapp')
    .select('tentativas')
    .eq('id', mensagemId)
    .single();

  const tentativasAtual = (msgAtual?.tentativas || 0) + 1;

  try {
    const zapiResponse = await enviarMensagemZApi(telefone, mensagemTexto);

    await supabase
      .from('mensagens_whatsapp')
      .update({
        status: 'enviado',
        data_envio: new Date().toISOString(),
        zapi_response: zapiResponse,
        tentativas: tentativasAtual,
      })
      .eq('id', mensagemId);

    return true;
  } catch (error: any) {
    console.error(`[WhatsApp] Erro ao enviar mensagem ${mensagemId}:`, error.message);

    await supabase
      .from('mensagens_whatsapp')
      .update({
        status: 'erro',
        erro_mensagem: error.message,
        tentativas: tentativasAtual,
      })
      .eq('id', mensagemId);

    return false;
  }
}

export async function agendarOuEnviarMensagem(params: AgendarMensagemParams): Promise<void> {
  const supabase = getSupabaseClient();
  const telefoneNormalizado = normalizarTelefone(params.clienteTelefone);

  if (!validarTelefone(telefoneNormalizado)) {
    return;
  }

  // Verificar se template está ativo antes de enviar
  const templateAtivo = await verificarTemplateAtivo(params.tipo);
  if (!templateAtivo) {
    return;
  }

  const mensagemTexto = await gerarMensagem(params.tipo, params.clienteNome, params.colaboradorNome, params.dataHora);

  // Verificar duplicidade: mesmo telefone + mesmo tipo + mesma mensagem (mesmo conteúdo = mesmo procedimento/horário)
  const { data: duplicada } = await supabase
    .from('mensagens_whatsapp')
    .select('id')
    .eq('telefone_destino', telefoneNormalizado)
    .eq('tipo', params.tipo)
    .eq('mensagem', mensagemTexto)
    .in('status', ['enviado', 'pendente'])
    .limit(1);

  if (duplicada && duplicada.length > 0) {
    return;
  }

  // Inserir no banco (ignorar se já existe)
  const { data: mensagem, error } = await supabase
    .from('mensagens_whatsapp')
    .insert({
      agendamento_id: params.agendamentoId,
      tipo: params.tipo,
      cliente_id: params.clienteId,
      telefone_destino: telefoneNormalizado,
      mensagem: mensagemTexto,
      status: 'pendente',
      data_programada: params.dataProgramada.toISOString(),
    })
    .select()
    .single();

  if (error) {
    // Duplicidade (UNIQUE constraint) — ignorar silenciosamente
    if (error.code === '23505') {
      return;
    }
    console.error(`[WhatsApp] Erro ao agendar mensagem:`, error);
    return;
  }

  // Se data_programada <= agora, enviar imediatamente
  if (mensagem && params.dataProgramada <= new Date()) {
    await processarEnvio(mensagem.id, telefoneNormalizado, mensagemTexto);
  }
}
