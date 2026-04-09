'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';

import { canAccessPath } from '@/lib/permissions';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, employee, loading, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading) {
            if (!user && pathname !== '/login') {
                console.log('[AUTH DEBUG] AuthGuard: redirecting guest to /login');
                // Use window.location.href for guest redirects to clear potential stuck SPA state
                window.location.href = '/login';
            } else if (user && pathname === '/login') {
                console.log('[AUTH DEBUG] AuthGuard: redirecting authenticated user to /dashboard');
                router.replace('/dashboard');
            }
        }
    }, [user, loading, pathname, router]);

    // While auth is initializing, show a branded loader — on ALL routes including /login
    // This prevents the white-flash caused by rendering before the session is known
    if (loading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                width: '100vw',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#020203',
                color: 'white',
                zIndex: 9999,
                position: 'fixed',
                inset: 0,
            }}>
                <div style={{ position: 'relative', width: '100px', height: '100px', marginBottom: '32px' }}>
                     <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(139, 92, 246, 0.1)', borderRadius: '50%' }}></div>
                     <div style={{ 
                        position: 'absolute', 
                        inset: '-4px', 
                        border: '3px solid transparent', 
                        borderTop: '3px solid #7C3AED', 
                        borderRadius: '50%', 
                        animation: 'spin-infinite 1s ease-in-out infinite' 
                    }}></div>
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '0.1em', opacity: 0.8 }}>
                    TripleS OS <span style={{ opacity: 0.5, fontWeight: 400 }}>|</span> INITIALIZING
                </h2>
                <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                    Establishing Secure Session...
                </div>
                <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes spin-infinite { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}} />
            </div>
        );
    }

    // Auth resolved — redirect unauthenticated users away from protected routes
    if (!user && pathname !== '/login') {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                width: '100vw',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#020203',
                color: 'white',
                zIndex: 9999,
                position: 'fixed',
                inset: 0,
            }}>
                <div style={{ position: 'relative', width: '100px', height: '100px', marginBottom: '32px' }}>
                     <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(139, 92, 246, 0.1)', borderRadius: '50%' }}></div>
                     <div style={{ 
                        position: 'absolute', 
                        inset: '-4px', 
                        border: '3px solid transparent', 
                        borderTop: '3px solid #7C3AED', 
                        borderRadius: '50%', 
                        animation: 'spin-infinite 1s ease-in-out infinite' 
                    }}></div>
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '0.1em', opacity: 0.8 }}>
                    TripleS OS <span style={{ opacity: 0.5, fontWeight: 400 }}>|</span> REDIRECTING
                </h2>
                <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                    Navigating to Secure Access...
                </div>
                <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes spin-infinite { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}} />
            </div>
        );
    }

    // Role check only AFTER we are sure loading and profile resolution are done
    const hasRoleAccess = employee ? canAccessPath(employee.roleId, pathname) : true;

    // 2. Critical Access Denied: We HAVE a user but NO employee record was found in DB
    // This happens for unlinked accounts (rare case)
    if (user && !employee && pathname !== '/login') {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                width: '100vw',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#020203',
                color: 'white',
                padding: '24px',
                textAlign: 'center'
            }}>
                <ShieldAlert size={48} style={{ marginBottom: '16px', color: '#F59E0B' }} />
                <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Profile Sync Error</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '400px', marginBottom: '24px', fontSize: '0.9rem' }}>
                    Authenticated, but no organizational record was found. 
                    Please contact your manager to initialize your TripleS OS profile.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => window.location.reload()} className="hoverable" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>Refresh Account</button>
                    <button onClick={() => signOut()} className="hoverable" style={{ background: 'var(--purple-main)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Sign Out</button>
                </div>
            </div>
        );
    }

    // 3. Permission Redirect
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
                <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Access Restricted</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '24px' }}>
                    Your current role does not have permission to view {pathname}.
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
                        fontWeight: 600
                    }}
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return <>{children}</>;
}
