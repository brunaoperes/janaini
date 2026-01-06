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

// GET - Listar todas as permissões e grupos
export async function GET(request: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return errorResponse('Acesso negado: apenas administradores', 403);
    }

    const supabaseAdmin = getSupabaseAdmin();
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'all';

    // Buscar permissões disponíveis
    const { data: permissions, error: permError } = await supabaseAdmin
      .from('permissions')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (permError) {
      console.error('Erro ao buscar permissões:', permError);
      return errorResponse(permError.message, 500);
    }

    // Buscar grupos de permissões
    const { data: groups, error: groupError } = await supabaseAdmin
      .from('permission_groups')
      .select('*')
      .order('display_name', { ascending: true });

    if (groupError) {
      console.error('Erro ao buscar grupos:', groupError);
      return errorResponse(groupError.message, 500);
    }

    // Buscar relações grupo-permissão
    const { data: groupPermissions, error: gpError } = await supabaseAdmin
      .from('group_permissions')
      .select('*');

    if (gpError) {
      console.error('Erro ao buscar relações:', gpError);
      return errorResponse(gpError.message, 500);
    }

    // Organizar dados dos grupos com suas permissões
    const groupsWithPermissions = groups?.map(group => ({
      ...group,
      permissions: groupPermissions?.filter(gp => gp.group_id === group.id).map(gp => gp.permission_id) || []
    })) || [];

    // Agrupar permissões por categoria
    const permissionsByCategory: Record<string, typeof permissions> = {};
    permissions?.forEach(perm => {
      if (!permissionsByCategory[perm.category]) {
        permissionsByCategory[perm.category] = [];
      }
      permissionsByCategory[perm.category].push(perm);
    });

    return jsonResponse({
      permissions: permissions || [],
      permissionsByCategory,
      groups: groupsWithPermissions,
      groupPermissions: groupPermissions || []
    });
  } catch (error: any) {
    console.error('Erro na API de permissões:', error);
    return errorResponse(error.message, 500);
  }
}

// POST - Criar novo grupo de permissões
export async function POST(request: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return errorResponse('Acesso negado: apenas administradores', 403);
    }

    const body = await request.json();
    const { name, display_name, description, permissions: permissionIds } = body;

    // Validações
    if (!name || !display_name) {
      return errorResponse('Nome e nome de exibição são obrigatórios', 400);
    }

    // Validar formato do nome (slug)
    if (!/^[a-z0-9_]+$/.test(name)) {
      return errorResponse('O nome deve conter apenas letras minúsculas, números e underscore', 400);
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Verificar se nome já existe
    const { data: existing } = await supabaseAdmin
      .from('permission_groups')
      .select('id')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      return errorResponse('Já existe um grupo com este nome', 400);
    }

    // Criar grupo
    const { data: newGroup, error: groupError } = await supabaseAdmin
      .from('permission_groups')
      .insert({
        name,
        display_name,
        description: description || null,
        is_system: false
      })
      .select()
      .single();

    if (groupError) {
      console.error('Erro ao criar grupo:', groupError);
      return errorResponse(groupError.message, 500);
    }

    // Adicionar permissões ao grupo
    if (permissionIds && permissionIds.length > 0) {
      const groupPermissionsData = permissionIds.map((permId: number) => ({
        group_id: newGroup.id,
        permission_id: permId
      }));

      const { error: gpError } = await supabaseAdmin
        .from('group_permissions')
        .insert(groupPermissionsData);

      if (gpError) {
        console.error('Erro ao adicionar permissões:', gpError);
        // Não falha, grupo foi criado
      }
    }

    return jsonResponse({
      success: true,
      message: 'Grupo de permissões criado com sucesso',
      group: { ...newGroup, permissions: permissionIds || [] }
    });
  } catch (error: any) {
    console.error('Erro na API POST permissões:', error);
    return errorResponse(error.message, 500);
  }
}

// PUT - Atualizar grupo de permissões
export async function PUT(request: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return errorResponse('Acesso negado: apenas administradores', 403);
    }

    const body = await request.json();
    const { groupId, display_name, description, permissions: permissionIds, action } = body;

    if (!groupId) {
      return errorResponse('ID do grupo é obrigatório', 400);
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Buscar grupo
    const { data: group, error: findError } = await supabaseAdmin
      .from('permission_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (findError || !group) {
      return errorResponse('Grupo não encontrado', 404);
    }

    // Ação: atualizar permissões do grupo
    if (action === 'updatePermissions') {
      // Remover todas as permissões atuais
      await supabaseAdmin
        .from('group_permissions')
        .delete()
        .eq('group_id', groupId);

      // Adicionar novas permissões
      if (permissionIds && permissionIds.length > 0) {
        const groupPermissionsData = permissionIds.map((permId: number) => ({
          group_id: groupId,
          permission_id: permId
        }));

        const { error: gpError } = await supabaseAdmin
          .from('group_permissions')
          .insert(groupPermissionsData);

        if (gpError) {
          console.error('Erro ao atualizar permissões:', gpError);
          return errorResponse(gpError.message, 500);
        }
      }

      return jsonResponse({
        success: true,
        message: 'Permissões atualizadas com sucesso'
      });
    }

    // Ação: atualizar dados do grupo
    if (action === 'updateGroup') {
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (display_name) updateData.display_name = display_name;
      if (description !== undefined) updateData.description = description;

      const { error: updateError } = await supabaseAdmin
        .from('permission_groups')
        .update(updateData)
        .eq('id', groupId);

      if (updateError) {
        console.error('Erro ao atualizar grupo:', updateError);
        return errorResponse(updateError.message, 500);
      }

      return jsonResponse({
        success: true,
        message: 'Grupo atualizado com sucesso'
      });
    }

    return errorResponse('Ação não especificada', 400);
  } catch (error: any) {
    console.error('Erro na API PUT permissões:', error);
    return errorResponse(error.message, 500);
  }
}

// DELETE - Excluir grupo de permissões
export async function DELETE(request: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return errorResponse('Acesso negado: apenas administradores', 403);
    }

    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId');

    if (!groupId) {
      return errorResponse('ID do grupo é obrigatório', 400);
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Buscar grupo
    const { data: group, error: findError } = await supabaseAdmin
      .from('permission_groups')
      .select('*')
      .eq('id', parseInt(groupId))
      .single();

    if (findError || !group) {
      return errorResponse('Grupo não encontrado', 404);
    }

    // Verificar se é grupo do sistema
    if (group.is_system) {
      return errorResponse('Não é possível excluir grupos do sistema', 400);
    }

    // Verificar se há usuários usando este grupo
    const { data: usersWithGroup } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('permission_group_id', parseInt(groupId))
      .limit(1);

    if (usersWithGroup && usersWithGroup.length > 0) {
      return errorResponse('Não é possível excluir: existem usuários vinculados a este grupo', 400);
    }

    // Deletar relações grupo-permissão (cascade já faz isso, mas por garantia)
    await supabaseAdmin
      .from('group_permissions')
      .delete()
      .eq('group_id', parseInt(groupId));

    // Deletar grupo
    const { error: deleteError } = await supabaseAdmin
      .from('permission_groups')
      .delete()
      .eq('id', parseInt(groupId));

    if (deleteError) {
      console.error('Erro ao excluir grupo:', deleteError);
      return errorResponse(deleteError.message, 500);
    }

    return jsonResponse({
      success: true,
      message: 'Grupo excluído com sucesso'
    });
  } catch (error: any) {
    console.error('Erro na API DELETE permissões:', error);
    return errorResponse(error.message, 500);
  }
}
