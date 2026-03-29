// APG Manager RMS - Middleware bảo vệ routes
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/auth/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bỏ qua static files và API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  try {
    const session = await auth();
    const isLoggedIn = !!session?.user;

    if (!isLoggedIn && !isPublic) {
      const url = new URL('/auth/login', request.url);
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }

    if (isLoggedIn && isPublic) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  } catch (e) {
    // Nếu session lỗi, cho phép truy cập route công khai
    if (!isPublic) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
