'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';

import { canAccessPath } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import Preloader from '@/components/common/Preloader';

// Hard ceiling: if auth loading hasn't resolved in this many ms, force bail to /login
const AUTH_HARD_TIMEOUT_MS = 8000;

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, employee, loading, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    // Tracks how long we've been showing the preloader — hard bail after AUTH_HARD_TIMEOUT_MS
    const [authTimedOut, setAuthTimedOut] = useState(false);
    const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Grace period before showing the profile-missing error screen
    const [profileErrorReady, setProfileErrorReady] = useState(false);

    // ── Hard bail timeout on auth preloader ──────────────────────────────────
    useEffect(() => {
        if (loading) {
            authTimeoutRef.current = setTimeout(() => {
                // Only force redirect if we truly have no user — don't kick out someone
                // whose profile fetch is just slow.
                if (!user) {
                    logger.warn('[AuthGuard] Auth preloader timed out after 15s — no session, forcing /login redirect');
                    setAuthTimedOut(true);
                    window.location.href = '/login';
                } else {
                    logger.warn('[AuthGuard] Auth preloader timed out after 15s — user exists, staying put');
                    setAuthTimedOut(true);
                }
            }, AUTH_HARD_TIMEOUT_MS);
        } else {
            // Auth resolved — cancel timeout
            if (authTimeoutRef.current) {
                clearTimeout(authTimeoutRef.current);
                authTimeoutRef.current = null;
            }
            setAuthTimedOut(false);
        }

        return () => {
            if (authTimeoutRef.current) {
                clearTimeout(authTimeoutRef.current);
            }
        };
    }, [loading, user]);

    // ── Profile error grace period (reduced to 2.5s) ─────────────────────────
    useEffect(() => {
        setProfileErrorReady(false);
        if (user && !employee && !loading) {
            const t = setTimeout(() => setProfileErrorReady(true), 2500);
            return () => clearTimeout(t);
        }
    }, [user, employee, loading]);

    // ── Redirect effects ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!loading) {
            if (!user && pathname !== '/login') {
                logger.log('[AUTH] AuthGuard: no session — navigating to /login');
                window.location.href = '/login';
            } else if (user && pathname === '/login') {
                logger.log('[AUTH] AuthGuard: authenticated — navigating to /dashboard');
                router.replace('/dashboard');
            }
        }
    }, [user, loading, pathname, router]);

    // ── Auth initializing — show preloader ───────────────────────────────────
    // Only during first load when Supabase session hasn't resolved yet.
    if (loading && !authTimedOut) {
        return <Preloader statusText="Initializing TripleS OS..." />;
    }

    // ── No session — redirect already fired in useEffect, show nothing ────────
    // Return null (not a preloader) so we don't get stuck if redirect is slow.
    if (!user && pathname !== '/login') {
        return null;
    }

    // ── User set but employee profile not yet fetched ─────────────────────────
    if (user && !employee && pathname !== '/login') {
        if (!profileErrorReady) {
            return <Preloader statusText="Loading your profile..." />;
        }

        // Profile genuinely missing after 2.5s grace period
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw',
                alignItems: 'center', justifyContent: 'center', background: '#020203',
                color: 'white', padding: '24px', textAlign: 'center'
            }}>
                <ShieldAlert size={48} style={{ marginBottom: '16px', color: '#F59E0B' }} />
                <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Profile Sync Error</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '400px', marginBottom: '24px', fontSize: '0.9rem' }}>
                    Authenticated, but no organizational record was found.
                    Please contact your manager to initialize your TripleS OS profile.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                        Refresh Account
                    </button>
                    <button
                        onClick={() => {
                            signOut();
                            window.location.href = '/login';
                        }}
                        style={{ background: 'var(--purple-main)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    // ── Role-based access control ─────────────────────────────────────────────
    const hasRoleAccess = employee ? canAccessPath(employee.roleId, pathname) : true;
    if (user && employee && !hasRoleAccess && pathname !== '/login' && pathname !== '/dashboard') {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw',
                alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)',
                color: 'white', padding: '24px', textAlign: 'center'
            }}>
                <ShieldAlert size={48} style={{ marginBottom: '16px', color: '#EF4444' }} />
                <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Access Restricted</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '24px' }}>
                    Your current role does not have permission to view {pathname}.
                </p>
                <button
                    onClick={() => router.push('/dashboard')}
                    style={{ background: 'var(--purple-main)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return <>{children}</>;
}
