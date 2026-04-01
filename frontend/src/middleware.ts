import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    const userSession = request.cookies.get('user_session')?.value;
    const { pathname } = request.nextUrl;

    // Exclude static files and internal Next.js paths from middleware processing
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.includes('.') // common static files (.ico, .png, etc.)
    ) {
        return NextResponse.next();
    }

    const isLoginPath = pathname === '/login';

    // 1. If token but no user_session — state is corrupted, force clear and login
    if (token && !userSession && !isLoginPath) {
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('token');
        response.cookies.delete('user_session'); // Extra safety
        return response;
    }

    // 2. Unauthenticated: catch-all redirect to login for protected routes
    if (!token && !isLoginPath) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 3. Already logged in: redirect away from login page to dashboard
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
