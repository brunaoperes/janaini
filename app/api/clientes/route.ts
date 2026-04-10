import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const dynamic = 'force-dynamic';

// Normalizar nome: remover emojis, capitalizar primeira letra de cada palavra
function normalizarNome(nome: string): string {
  // Remover emojis e caracteres especiais unicode (manter acentos)
  let limpo = nome
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // symbols & pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // transport & map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // dingbats
    .replace(/[\u{FE00}-\u{FEFF}]/gu, '')   // variation selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // supplemental symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // chess symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // symbols extended
    .replace(/[\u{200D}\u{FE0F}\u{20E3}]/gu, '') // zero width joiner, variation selector
    .replace(/[\u{1D400}-\u{1D7FF}]/gu, (match) => { // Mathematical alphanumeric symbols (𝒜𝒹𝓇𝒾𝒶𝓃𝒶 etc)
      // Converter caracteres matemáticos para ASCII
      const code = match.codePointAt(0)!;
      // Bold, Italic, Script, etc ranges → map to basic latin
      if (code >= 0x1D400 && code <= 0x1D419) return String.fromCharCode(code - 0x1D400 + 65); // Bold A-Z
      if (code >= 0x1D41A && code <= 0x1D433) return String.fromCharCode(code - 0x1D41A + 97); // Bold a-z
      if (code >= 0x1D434 && code <= 0x1D44D) return String.fromCharCode(code - 0x1D434 + 65); // Italic A-Z
      if (code >= 0x1D44E && code <= 0x1D467) return String.fromCharCode(code - 0x1D44E + 97); // Italic a-z
      if (code >= 0x1D468 && code <= 0x1D481) return String.fromCharCode(code - 0x1D468 + 65); // Bold Italic A-Z
      if (code >= 0x1D482 && code <= 0x1D49B) return String.fromCharCode(code - 0x1D482 + 97); // Bold Italic a-z
      if (code >= 0x1D49C && code <= 0x1D4B5) return String.fromCharCode(code - 0x1D49C + 65); // Script A-Z
      if (code >= 0x1D4B6 && code <= 0x1D4CF) return String.fromCharCode(code - 0x1D4B6 + 97); // Script a-z
      if (code >= 0x1D4D0 && code <= 0x1D4E9) return String.fromCharCode(code - 0x1D4D0 + 65); // Bold Script A-Z
      if (code >= 0x1D4EA && code <= 0x1D503) return String.fromCharCode(code - 0x1D4EA + 97); // Bold Script a-z
      return '';
    })
    .replace(/[~•]/g, '') // caracteres decorativos
    .replace(/\s+/g, ' ') // múltiplos espaços
    .trim();

  // Capitalizar primeira letra de cada palavra
  return limpo
    .split(' ')
    .filter(p => p.length > 0)
    .map(palavra => {
      // Preposições e artigos ficam minúsculos (exceto se for a primeira palavra)
      const lower = palavra.toLowerCase();
      const preposicoes = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na'];
      if (preposicoes.includes(lower)) return lower;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/^(.)/, (m) => m.toUpperCase()); // Garantir primeira letra maiúscula
}

// Buscar clientes (com pesquisa opcional)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = supabase
      .from('clientes')
      .select('*')
      .order('nome');

    if (search) {
      query = query.ilike('nome', `%${search}%`).limit(10);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar clientes:', error);
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ data: data || [] });
  } catch (error: any) {
    console.error('Erro na API de clientes:', error);
    return errorResponse(error.message, 500);
  }
}

// Criar novo cliente
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, telefone, aniversario } = body;

    if (!nome || !telefone) {
      return errorResponse('Nome e telefone são obrigatórios', 400);
    }

    const nomeNormalizado = normalizarNome(nome);

    // Verificar se já existe cliente com mesmo telefone
    const telefoneLimpo = telefone.replace(/\D/g, '');
    const { data: clienteExistente } = await supabase
      .from('clientes')
      .select('id, nome, telefone')
      .or(`telefone.eq.${telefone},telefone.eq.${telefoneLimpo}`)
      .limit(1);

    if (clienteExistente && clienteExistente.length > 0) {
      return errorResponse(`Ja existe um cliente com este telefone: ${clienteExistente[0].nome}`, 400);
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert({ nome: nomeNormalizado, telefone, aniversario: aniversario || null })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar cliente:', error);
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ data });
  } catch (error: any) {
    console.error('Erro na API de clientes POST:', error);
    return errorResponse(error.message, 500);
  }
}
