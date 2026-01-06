import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Função para obter o cliente admin (lazy initialization)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Função para verificar se o usuário atual é admin
async function verifyAdmin() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return { isAdmin: false, userId: null };

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    return { isAdmin: profile?.role === 'admin', userId: user.id };
  } catch {
    return { isAdmin: false, userId: null };
  }
}

export async function GET() {
  try {
    // Verificar se é admin
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return errorResponse('Acesso negado: apenas administradores', 403);
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Buscar usuários usando a view auth.users (via service role)
    // Primeiro, buscar todos os profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        username,
        nome,
        role,
        colaborador_id,
        created_at
      `)
      .order('nome');

    if (profilesError) {
      console.error('Erro ao buscar profiles:', profilesError);
      return errorResponse(profilesError.message, 500);
    }

    // Buscar dados de auth.users usando a API admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error('Erro ao buscar auth users:', authError);
      return errorResponse(authError.message, 500);
    }

    // Buscar colaboradores para vincular nomes
    const { data: colaboradores } = await supabaseAdmin
      .from('colaboradores')
      .select('id, nome');

    const colaboradoresMap = new Map(colaboradores?.map(c => [c.id, c.nome]) || []);

    // Combinar dados
    const usuarios = profiles?.map(profile => {
      const authUser = authData.users.find(u => u.id === profile.id) as any;
      // Verificar se usuário está banido (desativado)
      const isBanned = authUser?.banned_until ? new Date(authUser.banned_until) > new Date() : false;
      return {
        id: profile.id,
        email: authUser?.email || '',
        username: profile.username,
        nome: profile.nome,
        role: profile.role,
        colaborador_id: profile.colaborador_id,
        colaborador_nome: profile.colaborador_id ? colaboradoresMap.get(profile.colaborador_id) || null : null,
        created_at: profile.created_at,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        ativo: !isBanned,
      };
    }) || [];

    return jsonResponse({ usuarios });
  } catch (error: any) {
    console.error('Erro na API de usuários:', error);
    return errorResponse(error.message, 500);
  }
}

// Criar novo usuário
export async function POST(request: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return errorResponse('Acesso negado: apenas administradores', 403);
    }

    const body = await request.json();
    const { email, password, nome, username, role = 'user' } = body;

    // Validações
    if (!email || !password || !nome || !username) {
      return errorResponse('Email, senha, nome e username são obrigatórios', 400);
    }

    if (password.length < 6) {
      return errorResponse('A senha deve ter pelo menos 6 caracteres', 400);
    }

    if (role !== 'admin' && role !== 'user') {
      return errorResponse('Role inválido. Use "admin" ou "user"', 400);
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirma o email automaticamente
      user_metadata: {
        nome,
        username,
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário auth:', authError);
      if (authError.message.includes('already been registered')) {
        return errorResponse('Este email já está cadastrado', 400);
      }
      return errorResponse(authError.message, 500);
    }

    if (!authData.user) {
      return errorResponse('Erro ao criar usuário', 500);
    }

    // Criar perfil na tabela profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        nome,
        username,
        role,
      });

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError);
      // Se falhou ao criar perfil, deletar o usuário auth
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return errorResponse(profileError.message, 500);
    }

    console.log('[API Usuarios] Usuário criado com sucesso:', email);

    return jsonResponse({
      success: true,
      message: 'Usuário criado com sucesso',
      usuario: {
        id: authData.user.id,
        email,
        nome,
        username,
        role,
      }
    });
  } catch (error: any) {
    console.error('Erro na API POST usuários:', error);
    return errorResponse(error.message, 500);
  }
}

// Atualizar usuário (colaborador, role, dados)
export async function PUT(request: Request) {
  try {
    const { isAdmin, userId: currentUserId } = await verifyAdmin();
    if (!isAdmin) {
      return errorResponse('Acesso negado: apenas administradores', 403);
    }

    const body = await request.json();
    const { userId, colaboradorId, role, nome, username, action } = body;

    if (!userId) {
      return errorResponse('userId é obrigatório', 400);
    }

    const supabaseAdmin = getSupabaseAdmin();

    console.log('[API Usuarios] Action:', action, 'Role:', role, 'UserId:', userId);

    // Ação específica: atualizar role (permissão) - VERIFICAR PRIMEIRO
    if (action === 'updateRole') {
      if (!role || (role !== 'admin' && role !== 'user')) {
        return errorResponse('Role inválido. Use "admin" ou "user"', 400);
      }

      // Não permitir que o admin remova sua própria permissão de admin
      if (userId === currentUserId && role !== 'admin') {
        return errorResponse('Você não pode remover sua própria permissão de administrador', 400);
      }

      console.log('[API Usuarios] Atualizando role para:', role);

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ role })
        .eq('id', userId);

      if (error) {
        console.error('Erro ao atualizar role:', error);
        return errorResponse(error.message, 500);
      }

      console.log('[API Usuarios] Role atualizado com sucesso');
      return jsonResponse({ success: true, message: 'Permissão atualizada' });
    }

    // Ação específica: atualizar colaborador
    if (action === 'updateColaborador') {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ colaborador_id: colaboradorId ?? null })
        .eq('id', userId);

      if (error) {
        console.error('Erro ao atualizar colaborador:', error);
        return errorResponse(error.message, 500);
      }

      return jsonResponse({ success: true, message: 'Colaborador atualizado' });
    }

    // Ação específica: desativar/ativar usuário
    if (action === 'toggleStatus') {
      const { ativo } = body;

      // Atualizar status do usuário no Supabase Auth
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: ativo ? 'none' : '876000h' // 100 anos = desativado
      });

      if (authError) {
        console.error('Erro ao atualizar status auth:', authError);
        return errorResponse(authError.message, 500);
      }

      console.log('[API Usuarios] Status do usuário atualizado:', ativo ? 'ativo' : 'desativado');
      return jsonResponse({ success: true, message: ativo ? 'Usuário ativado' : 'Usuário desativado' });
    }

    // Ação específica: atualizar dados do usuário
    if (action === 'updateProfile') {
      const updateData: Record<string, string> = {};
      if (nome) updateData.nome = nome;
      if (username) updateData.username = username;

      if (Object.keys(updateData).length === 0) {
        return errorResponse('Nenhum dado para atualizar', 400);
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('Erro ao atualizar perfil:', error);
        return errorResponse(error.message, 500);
      }

      return jsonResponse({ success: true, message: 'Perfil atualizado' });
    }

    return errorResponse('Ação não especificada', 400);
  } catch (error: any) {
    console.error('Erro na API PUT usuários:', error);
    return errorResponse(error.message, 500);
  }
}
