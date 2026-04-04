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

    // Note: Legacy cookie-based auth is deprecated. 
    // We now rely on client-side AuthGuard + Supabase sessions to avoid redirection race conditions.
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
