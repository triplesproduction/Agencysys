import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ── Admin-only paths (server-enforced) ────────────────────────────────────────
// These paths must redirect any non-ADMIN role before the page bundle is served.
const ADMIN_ONLY_PATHS = [
    '/employees',
    '/leaves/approvals',
];

// ── Admin+Manager paths ────────────────────────────────────────────────────────
const ADMIN_OR_MANAGER_PATHS = [
    '/eod/reviews',
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
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
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

    // Skip prefetch requests — they are speculative and do not require full auth checks
    const isPrefetch = request.headers.get('Next-Router-Prefetch') === '1' || request.headers.get('Purpose') === 'prefetch';
    if (isPrefetch) {
        return supabaseResponse;
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // ── 1. Authentication gate ─────────────────────────────────────────────────
    // No session → redirect to login
    if (!user && !pathname.startsWith('/login') && !pathname.startsWith('/auth')) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    let employeeRow: any = null;
    if (user) {
        const { data } = await supabase
            .from('employees')
            .select('roleId, status')
            .eq('id', user.id)
            .maybeSingle();
        employeeRow = data;
    }

    const status = employeeRow?.status || 'ACTIVE';

    // Suspended user trying to access any page except login/auth -> redirect to login with error
    if (user && status !== 'ACTIVE' && !pathname.startsWith('/login') && !pathname.startsWith('/auth')) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('error', 'suspended');
        return NextResponse.redirect(url);
    }

    // Active authenticated user on login page → redirect to dashboard
    if (user && status === 'ACTIVE' && pathname.startsWith('/login')) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    // ── 2. Role-based authorization gate ──────────────────────────────────────
    if (user && status === 'ACTIVE') {
        const isAdminOnly = ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p));
        const isAdminOrManagerOnly = ADMIN_OR_MANAGER_PATHS.some(p => pathname.startsWith(p));

        if (isAdminOnly || isAdminOrManagerOnly) {
            const rawRole = employeeRow?.roleId || employeeRow?.role_id || '';
            const role = String(rawRole).toUpperCase();

            const isAdmin = role.includes('ADMIN');
            const isManager = role.includes('MANAGER');

            if (isAdminOnly && !isAdmin) {
                const url = request.nextUrl.clone();
                url.pathname = '/dashboard';
                return NextResponse.redirect(url);
            }

            if (isAdminOrManagerOnly && !isAdmin && !isManager) {
                const url = request.nextUrl.clone();
                url.pathname = '/dashboard';
                return NextResponse.redirect(url);
            }
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
         * - api (standard API routes)
         * - Public assets like .png, .jpg, etc.
         */
        '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};