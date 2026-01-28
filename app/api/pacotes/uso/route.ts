import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auditCreate, auditDelete } from '@/lib/audit';
import { pacoteUsoSchema, formatZodErrors } from '@/lib/validations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAuthUser(supabase: any) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('nome, role')
      .eq('id', user.id)
      .single();

    return {
      userId: user.id,
      userEmail: user.email || undefined,
      userName: profile?.nome,
      userRole: profile?.role,
    };
  } catch {
    return null;
  }
}

// GET - Listar usos de um pacote
export async function GET(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const pacoteId = searchParams.get('pacoteId');

    if (!pacoteId) {
      return NextResponse.json({ error: 'pacoteId é obrigatório' }, { status: 400 });
    }

    const { data: usos, error } = await supabase
      .from('pacote_usos')
      .select(`
        *,
        colaborador_executor:colaboradores!pacote_usos_colaborador_executor_id_fkey(id, nome)
      `)
      .eq('pacote_id', pacoteId)
      .order('data_uso', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Buscar colaboradores para o formulário
    const { data: colaboradores } = await supabase
      .from('colaboradores')
      .select('id, nome')
      .order('nome');

    return NextResponse.json({
      usos: usos || [],
      colaboradores: colaboradores || [],
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Registrar uso de sessão
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = pacoteUsoSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: formatZodErrors(validation.error) },
        { status: 400 }
      );
    }

    const data = validation.data;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar se pacote existe e está ativo
    const { data: pacote, error: pacoteError } = await supabase
      .from('pacotes')
      .select('*')
      .eq('id', data.pacote_id)
      .single();

    if (pacoteError || !pacote) {
      return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 });
    }

    // Validações
    if (pacote.status !== 'ativo') {
      const statusMsg: Record<string, string> = {
        'expirado': 'Este pacote expirou e não pode mais ser utilizado',
        'concluido': 'Este pacote já foi completamente utilizado',
        'cancelado': 'Este pacote foi cancelado',
      };
      return NextResponse.json({
        error: statusMsg[pacote.status] || 'Pacote não está ativo'
      }, { status: 400 });
    }

    if (pacote.quantidade_usada >= pacote.quantidade_total) {
      return NextResponse.json({
        error: 'Todas as sessões deste pacote já foram utilizadas'
      }, { status: 400 });
    }

    // Verificar validade
    if (pacote.data_validade) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const validade = new Date(pacote.data_validade);
      validade.setHours(0, 0, 0, 0);

      if (hoje > validade) {
        // Atualizar status para expirado
        await supabase
          .from('pacotes')
          .update({ status: 'expirado' })
          .eq('id', pacote.id);

        return NextResponse.json({
          error: 'Este pacote expirou em ' + new Date(pacote.data_validade).toLocaleDateString('pt-BR')
        }, { status: 400 });
      }
    }

    const authUser = await getAuthUser(supabase);

    // Registrar uso (trigger atualiza quantidade_usada automaticamente)
    const usoData = {
      pacote_id: data.pacote_id,
      colaborador_executor_id: data.colaborador_executor_id,
      data_uso: data.data_uso,
      hora_inicio: data.hora_inicio || null,
      hora_fim: data.hora_fim || null,
      observacoes: data.observacoes || null,
      registrado_por: authUser?.userId,
      registrado_por_nome: authUser?.userName,
    };

    const { data: uso, error: usoError } = await supabase
      .from('pacote_usos')
      .insert(usoData)
      .select(`
        *,
        colaborador_executor:colaboradores!pacote_usos_colaborador_executor_id_fkey(id, nome)
      `)
      .single();

    if (usoError) {
      console.error('[API/pacotes/uso] Erro ao registrar uso:', usoError);
      return NextResponse.json({ error: usoError.message }, { status: 500 });
    }

    // Buscar pacote atualizado
    const { data: pacoteAtualizado } = await supabase
      .from('pacotes')
      .select('quantidade_usada, quantidade_total, status')
      .eq('id', data.pacote_id)
      .single();

    // Auditoria
    if (authUser) {
      await auditCreate({
        ...authUser,
        modulo: 'Lancamentos',
        tabela: 'pacote_usos',
        registroId: uso.id,
        dadosNovo: { ...uso, pacote: pacoteAtualizado },
        metodo: 'POST',
        endpoint: '/api/pacotes/uso',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Sessão ${pacoteAtualizado?.quantidade_usada}/${pacoteAtualizado?.quantidade_total} registrada!`,
      uso,
      pacote: pacoteAtualizado,
    });

  } catch (error: unknown) {
    console.error('[API/pacotes/uso] Erro fatal:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Remover uso de sessão
export async function DELETE(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const usoId = searchParams.get('id');

    if (!usoId) {
      return NextResponse.json({ error: 'ID do uso é obrigatório' }, { status: 400 });
    }

    // Buscar uso antes de deletar para auditoria
    const { data: usoAnterior } = await supabase
      .from('pacote_usos')
      .select('*')
      .eq('id', parseInt(usoId, 10))
      .single();

    if (!usoAnterior) {
      return NextResponse.json({ error: 'Uso não encontrado' }, { status: 404 });
    }

    // Deletar (trigger atualiza quantidade_usada automaticamente)
    const { error } = await supabase
      .from('pacote_usos')
      .delete()
      .eq('id', parseInt(usoId, 10));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auditoria
    const authUser = await getAuthUser(supabase);
    if (authUser) {
      await auditDelete({
        ...authUser,
        modulo: 'Lancamentos',
        tabela: 'pacote_usos',
        registroId: parseInt(usoId, 10),
        dadosAnterior: usoAnterior,
        metodo: 'DELETE',
        endpoint: '/api/pacotes/uso',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Uso removido com sucesso',
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
