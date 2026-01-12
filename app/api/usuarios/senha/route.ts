import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, novaSenha, senhaAtual } = body;

    if (!novaSenha || novaSenha.length < 6) {
      return NextResponse.json(
        { error: 'A nova senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Obter usuário autenticado
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    });

    const { data: { user: currentUser } } = await supabaseAuth.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Cliente admin para operações privilegiadas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Buscar perfil do usuário atual
    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    const isAdmin = currentProfile?.role === 'admin';

    // CASO 1: Usuário trocando a própria senha
    if (!userId || userId === currentUser.id) {
      // Usuário comum precisa informar senha atual
      if (!isAdmin && !senhaAtual) {
        return NextResponse.json(
          { error: 'Informe sua senha atual para confirmar a alteração' },
          { status: 400 }
        );
      }

      // Verificar senha atual (para usuários comuns)
      if (!isAdmin && senhaAtual) {
        const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
          email: currentUser.email!,
          password: senhaAtual,
        });

        if (signInError) {
          return NextResponse.json(
            { error: 'Senha atual incorreta' },
            { status: 400 }
          );
        }
      }

      // Atualizar senha do próprio usuário
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        currentUser.id,
        { password: novaSenha }
      );

      if (updateError) {
        console.error('[API/senha] Erro ao atualizar senha:', updateError);
        return NextResponse.json(
          { error: 'Erro ao atualizar senha: ' + updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Senha alterada com sucesso!'
      });
    }

    // CASO 2: Admin trocando senha de outro usuário
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Apenas administradores podem alterar senha de outros usuários' },
        { status: 403 }
      );
    }

    // Verificar se o usuário alvo existe
    const { data: targetUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar senha do usuário alvo
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: novaSenha }
    );

    if (updateError) {
      console.error('[API/senha] Erro ao atualizar senha:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar senha: ' + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Senha do usuário ${targetUser.user?.email} alterada com sucesso!`
    });

  } catch (error: any) {
    console.error('[API/senha] Erro fatal:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
