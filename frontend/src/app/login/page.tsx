'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogIn, Loader2, Eye, EyeOff } from 'lucide-react';
import './Login.css';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [email, setEmail] = useState(searchParams?.get('email') || '');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email.trim() || !password.trim()) {
            setError('Both Email and Password are required');
            return;
        }

        setLoading(true);

        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError || !authData.session) {
                if (authError?.message?.includes('Invalid login credentials')) {
                    throw new Error('Invalid email or password. Please try again.');
                }
                if (authError?.message?.includes('Email not confirmed')) {
                    throw new Error('Your email address has not been confirmed yet.');
                }
                throw new Error(authError?.message || 'Login failed. Check your credentials.');
            }

            // Success — AuthGuard will handle the redirect to /dashboard
            // Keep loading=true so there's no flicker
            router.replace('/dashboard');

        } catch (err: any) {
            setError(err.message || 'Verification failed. Double check your credentials.');
            setLoading(false);
        }
    };

    const isFormValid = email.trim().length > 0 && password.trim().length > 0;

    return (
        <div className="login-card">
            <div className="login-header">
                <div className="login-logo" style={{ flexDirection: 'row', gap: '20px', justifyContent: 'center', marginBottom: '24px' }}>
                    <img src="/logo.png" alt="TripleS" style={{ width: '64px', height: '64px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                        <div style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-1px', lineHeight: '1' }}>TripleS <span style={{ color: 'var(--purple-light)', fontWeight: '900' }}>OS</span></div>
                        <div style={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '6px' }}>Internal Agency Software</div>
                    </div>
                </div>
                <p className="login-subtitle">Sign in to your dashboard to continue</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label" htmlFor="email">Email Address</label>
                    <input
                        id="email"
                        type="email"
                        className="flat-input"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        required
                        autoComplete="email"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="password">Password</label>
                    <div className="password-input-wrapper">
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            className="flat-input with-toggle"
                            placeholder="*************"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            required
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                    <button type="submit" className="login-submit" disabled={loading || !isFormValid}>
                        {loading ? (
                            <>
                                <Loader2 size={18} className="spin-icon" style={{ marginRight: '8px' }} />
                                Authenticating...
                            </>
                        ) : (
                            <>
                                <LogIn size={18} style={{ marginRight: '8px' }} />
                                Sign In
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="error-message">{error}</div>
                )}
            </form>
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="login-page-wrapper">
            <Suspense fallback={
                <div className="login-card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '300px',
                }}>
                    <Loader2 size={32} style={{
                        color: 'var(--purple-main)',
                        animation: 'spin 1s linear infinite',
                    }} />
                </div>
            }>
                <LoginForm />
            </Suspense>
        </div>
    );
}
