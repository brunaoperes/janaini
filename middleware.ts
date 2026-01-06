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

export async function middleware(request: NextRequest) {
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

  const pathname = request.nextUrl.pathname;

  // Verificar se é rota pública
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  // Se é rota pública, apenas retorna
  if (isPublicRoute) {
    return supabaseResponse;
  }

  // Tenta obter o usuário
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Se não está autenticado, redireciona para login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Verificar se é rota admin
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));

  if (isAdminRoute) {
    // Buscar perfil do usuário para verificar role
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Se não encontrou perfil ou não é admin, redirecionar para acesso negado
    if (error || !profile || profile.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/acesso-negado';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
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
