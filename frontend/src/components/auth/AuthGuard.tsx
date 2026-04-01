'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';

import { canAccessPath } from '@/lib/permissions';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, employee, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Only make redirect decisions once loading is complete
        if (!loading) {
            if (!user) {
                // Not authenticated: send to login if not already there
                if (pathname !== '/login') {
                    console.log('[AuthGuard] Not authenticated, redirecting to /login');
                    router.replace('/login');
                }
            } else {
                // Authenticated: send to dashboard if on login page
                if (pathname === '/login') {
                    console.log('[AuthGuard] Already authenticated, redirecting to /dashboard');
                    router.replace('/dashboard');
                }
            }
        }
    }, [user, loading, pathname, router]);

    // Check for role-based path access
    const hasRoleAccess = canAccessPath(employee?.roleId, pathname);

    // Show loading screen only if we're still loading AND have no user session yet
    if (loading && !user) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                width: '100vw',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-dark)',
                color: 'white'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                    <Loader2 className="spin-icon" size={32} />
                    <span style={{ marginLeft: '12px', fontSize: '1rem', color: 'var(--text-secondary)' }}>Verifying Session...</span>
                </div>
                {/* Fallback link if loading takes too long */}
                <button 
                    onClick={() => router.push('/login')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        opacity: 0.7
                    }}
                >
                    Taking too long? Return to Login
                </button>
            </div>
        );
    }

    if (!user && pathname !== '/login') {
        return null;
    }


    // Role-based Path protection
    if (user && employee && !hasRoleAccess && pathname !== '/login' && pathname !== '/dashboard') {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                width: '100vw',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-dark)',
                color: 'white',
                padding: '24px',
                textAlign: 'center'
            }}>
                <ShieldAlert size={48} style={{ marginBottom: '16px', color: '#EF4444' }} />
                <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Access Denied</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '24px' }}>
                    You don't have the required permissions to access this page. 
                    This area is restricted to {pathname.startsWith('/employees') ? 'ADMINs' : 'authorized personnel'} only.
                </p>
                <button 
                    onClick={() => router.push('/dashboard')}
                    style={{
                        background: 'var(--purple-main)',
                        border: 'none',
                        color: 'white',
                        padding: '10px 24px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'opacity 0.2s'
                    }}
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return <>{children}</>;
}
