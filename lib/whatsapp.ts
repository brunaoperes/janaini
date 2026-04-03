import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

type TipoMensagem = 'confirmacao' | 'lembrete' | 'pos_venda';

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

function formatarData(dataHora: string): string {
  return format(new Date(dataHora), "dd/MM/yyyy", { locale: ptBR });
}

function formatarHorario(dataHora: string): string {
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
};

function aplicarPlaceholders(template: string, nome: string, profissional: string, dataHora: string): string {
  return template
    .replace(/\{nome\}/g, nome)
    .replace(/\{profissional\}/g, profissional)
    .replace(/\{data\}/g, formatarData(dataHora))
    .replace(/\{horario\}/g, formatarHorario(dataHora));
}

async function buscarTemplateDoBanco(tipo: TipoMensagem): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('template, ativo')
      .eq('tipo', tipo)
      .single();

    if (data?.ativo && data.template) {
      return data.template;
    }
    return null;
  } catch {
    return null;
  }
}

export async function gerarMensagem(tipo: TipoMensagem, nome: string, profissional: string, dataHora: string): Promise<string> {
  // Tentar buscar template do banco
  const templateDoBanco = await buscarTemplateDoBanco(tipo);
  const template = templateDoBanco || TEMPLATES_FALLBACK[tipo];
  return aplicarPlaceholders(template, nome, profissional, dataHora);
}

// ============================================================================
// ENVIO VIA Z-API
// ============================================================================

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

  return response.json();
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

    console.log(`[WhatsApp] Mensagem ${mensagemId} enviada com sucesso para ${telefone}`);
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
    console.warn(`[WhatsApp] Telefone inválido para cliente ${params.clienteNome}: ${params.clienteTelefone}`);
    return;
  }

  const mensagemTexto = await gerarMensagem(params.tipo, params.clienteNome, params.colaboradorNome, params.dataHora);

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
      console.log(`[WhatsApp] Mensagem ${params.tipo} já existe para agendamento ${params.agendamentoId}`);
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
