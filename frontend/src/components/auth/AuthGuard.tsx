'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading) {
            if (!user && pathname !== '/login') {
                console.log('[AuthGuard] Not authenticated, redirecting to /login');
                router.push('/login');
            } else if (user && pathname === '/login') {
                console.log('[AuthGuard] Already authenticated, redirecting to /dashboard');
                router.push('/dashboard');
            }
        }
    }, [user, loading, pathname, router]);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                height: '100vh',
                width: '100vw',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-dark)',
                color: 'white'
            }}>
                <Loader2 className="spin-icon" size={32} />
                <span style={{ marginLeft: '12px', fontSize: '1rem', color: 'var(--text-secondary)' }}>Verifying Session...</span>
            </div>
        );
    }

    if (!user && pathname !== '/login') {
        return null;
    }

    return <>{children}</>;
}
