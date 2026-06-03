'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import GlassCard from '@/components/GlassCard';

export default function RootError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log unhandled errors intentionally — this surfaces in error monitoring tools (Sentry/LogRocket)
        console.error('Unhandled app-level error:', error);
    }, [error]);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
            background: 'var(--bg-dark)',
            color: 'white'
        }}>
            <GlassCard style={{
                maxWidth: '500px',
                width: '100%',
                padding: '40px',
                textAlign: 'center',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '20px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px'
                }}>
                    <AlertTriangle size={32} style={{ color: '#EF4444' }} />
                </div>
                
                <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    marginBottom: '12px',
                    letterSpacing: '-0.02em'
                }}>
                    Application Error
                </h2>
                
                <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    marginBottom: '32px'
                }}>
                    An unexpected client-side error occurred while rendering the page component.
                </p>

                <button
                    onClick={() => reset()}
                    style={{
                        background: 'var(--purple-main)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 24px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                >
                    <RefreshCw size={16} /> Recover State
                </button>
            </GlassCard>
        </div>
    );
}
