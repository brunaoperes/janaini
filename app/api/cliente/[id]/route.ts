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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clienteId = parseInt(id, 10);

    if (isNaN(clienteId)) {
      return errorResponse('ID inválido', 400);
    }

    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .single();

    if (error) {
      console.error('Erro ao buscar cliente:', error);
      return errorResponse(error.message, 500);
    }

    if (!cliente) {
      return errorResponse('Cliente não encontrado', 404);
    }

    return jsonResponse(cliente);
  } catch (error: any) {
    console.error('Erro na API de cliente:', error);
    return errorResponse(error.message, 500);
  }
}
