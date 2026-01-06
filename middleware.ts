import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Rotas que requerem acesso de administrador
const ADMIN_ROUTES = [
  '/admin',
];

// Rotas públicas que não precisam de autenticação
const PUBLIC_ROUTES = [
  '/login',
  '/acesso-negado',
];

// Função para adicionar headers anti-cache
function addNoCacheHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log(`[Middleware] ${request.method} ${pathname}`);

  // Criar response base
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: Sempre chamar getUser() para refresh do token
  // Isso atualiza os cookies de sessão automaticamente
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log(`[Middleware] Auth check - User: ${user?.email || 'null'}, Error: ${authError?.message || 'none'}`);

  // Verificar se é rota pública
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  // Se é rota pública
  if (isPublicRoute) {
    console.log(`[Middleware] Rota pública: ${pathname}`);
    // Se já está logado e tenta acessar /login, redireciona para home
    if (pathname === '/login' && user) {
      console.log(`[Middleware] Usuário já logado, redirecionando para home`);
      const url = request.nextUrl.clone();
      url.pathname = '/';
      const redirectResponse = NextResponse.redirect(url);
      return addNoCacheHeaders(redirectResponse);
    }
    return addNoCacheHeaders(supabaseResponse);
  }

  // Se não está autenticado, redireciona para login
  if (!user) {
    console.log(`[Middleware] Não autenticado, redirecionando para /login`);
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirectResponse = NextResponse.redirect(url);
    return addNoCacheHeaders(redirectResponse);
  }

  // Verificar se é rota admin
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));

  if (isAdminRoute) {
    console.log(`[Middleware] Rota admin: ${pathname}, verificando permissão...`);

    // Buscar perfil do usuário para verificar role
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log(`[Middleware] Profile: ${JSON.stringify(profile)}, Error: ${error?.message || 'none'}`);

    // Se não encontrou perfil ou não é admin, redirecionar para acesso negado
    if (error || !profile || profile.role !== 'admin') {
      console.log(`[Middleware] Acesso negado para ${user.email}`);
      const url = request.nextUrl.clone();
      url.pathname = '/acesso-negado';
      const redirectResponse = NextResponse.redirect(url);
      return addNoCacheHeaders(redirectResponse);
    }

    console.log(`[Middleware] Acesso admin permitido para ${user.email}`);
  }

  return addNoCacheHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - api routes (proteção feita nas próprias rotas)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)',
  ],
};
