'use client';

import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PermissionsPage() {
    return (
        <div className="main-content fade-in" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 100px)' }}>

            <div style={{ textAlign: 'center', maxWidth: '500px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto', position: 'relative' }}>
                    <ShieldAlert size={40} style={{ color: '#EF4444' }} />
                    <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: 'var(--bg-dark)', borderRadius: '50%', padding: '4px' }}>
                        <Lock size={16} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                </div>

                <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '16px', background: 'linear-gradient(135deg, white 0%, rgba(255,255,255,0.7) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Access Restricted
                </h1>

                <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', lineHeight: '1.6', marginBottom: '32px' }}>
                    The advanced Role & Permissions engine (Phase 2) is currently locked down for final security auditing.
                    <br /><br />
                    Standard preset RBAC (Admin, Manager, Employee) is active. Granular overrides will be available in the next deployment cycle.
                </p>

                <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', padding: '12px 24px', borderRadius: '24px', textDecoration: 'none', border: '1px solid var(--glass-border)', transition: 'all 0.2s', fontWeight: 600 }} className="hoverable">
                    <ArrowLeft size={18} />
                    Return to Dashboard
                </Link>
            </div>

        </div>
    );
}
