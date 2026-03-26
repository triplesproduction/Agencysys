import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    const { pathname } = request.nextUrl;

    const isLoginPath = pathname === '/login';

    if (!token && !isLoginPath && !pathname.startsWith('/api/v1') && !pathname.startsWith('/api/auth')) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (token && isLoginPath) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (pathname.startsWith('/api/v1') && token) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('Authorization', `Bearer ${token}`);
        return NextResponse.next({
            request: { headers: requestHeaders },
        });
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
        '/test-suite',
        '/login',
        '/api/v1/:path*'
    ]
};
