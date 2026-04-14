import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { buildLoginPath, isUserAdmin, sanitizeRedirectPath } from '@/lib/auth';

export default async function proxy(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname.startsWith('/login');
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth/callback');

  // 로그인이 안 되어 있으면 로그인 후 원래 경로로 복귀할 수 있게 next 파라미터를 유지한다.
  if (!user && !isLoginRoute && !isAuthCallback) {
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(new URL(buildLoginPath(nextPath), request.url));
  }

  // 로그인 상태에서 로그인 창에 접근하면 next 또는 홈으로 보낸다.
  if (user && isLoginRoute) {
    const nextPath = sanitizeRedirectPath(request.nextUrl.searchParams.get('next'));
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  // 어드민 라우트 접근 시 관리자 이메일 확인
  if (isAdminRoute) {
    if (!isUserAdmin(user)) {
      const url = request.nextUrl.clone();
      url.pathname = '/'; // 일반 화면으로 튕겨냄
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/ (let API routes handle their own auth)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
