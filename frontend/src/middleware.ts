import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    const userSession = request.cookies.get('user_session')?.value;
    const { pathname } = request.nextUrl;

    const isLoginPath = pathname === '/login';

    // If token but no user_session — stale/corrupted state, force re-login
    if (token && !userSession && !isLoginPath) {
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('token');
        return response;
    }

    // Unauthenticated: redirect to login
    if (!token && !isLoginPath) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Already logged in: skip login page
    if (token && isLoginPath) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/',
        '/dashboard',
        '/dashboard/:path*',
        '/tasks',
        '/tasks/:path*',
        '/eod',
        '/eod/:path*',
        '/logs',
        '/logs/:path*',
        '/leaves',
        '/leaves/:path*',
        '/kpis',
        '/kpis/:path*',
        '/employees',
        '/employees/:path*',
        '/messaging',
        '/messaging/:path*',
        '/wiki',
        '/wiki/:path*',
        '/permissions',
        '/permissions/:path*',
        '/rulebook',
        '/rulebook/:path*',
        '/login',
    ],
};
