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

        try {
            setLoading(true);

            // Step 1: Supabase Auth login
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError || !authData.session) {
                console.error('[Login] Auth error:', authError);
                if (authError?.message?.includes('Invalid login credentials')) {
                    throw new Error('Invalid email or password. Please try again.');
                }
                if (authError?.message?.includes('Email not confirmed')) {
                    throw new Error('Your email address has not been confirmed yet.');
                }
                throw new Error(authError?.message || 'Login failed. Check your credentials.');
            }

            console.log('[Login] Auth success:', authData.user?.id);

            // Step 2: Fetch employee profile to get role info
            const { data: employee, error: empError } = await supabase
                .from('employees')
                .select('id, email, roleId, firstName, lastName')
                .eq('id', authData.user.id)
                .maybeSingle();

            if (empError) {
                console.error('[Login] Employee fetch error:', empError);
                await supabase.auth.signOut();
                throw new Error('Unable to retrieve your employee profile. Please contact support.');
            }

            if (!employee) {
                console.warn('[Login] No employee profile found for user UID:', authData.user.id);
                // System will handle missing profile in AuthGuard/useAuth
                // We just redirect now that session is active
            } else {
                console.log('[Login] Employee profile found:', employee);
            }

            // Step 3: Redirect to dashboard using router for SPA transition
            console.log('[Login] Auth verified. Transitioning to dashboard...');
            router.replace('/dashboard');

        } catch (err: any) {
            console.error('[Login] Error:', err);
            setError(err.message || 'Verification failed. Double check your credentials.');
        } finally {
            // Keep loading true if redirecting to avoid flickering
            // setLoading(false); 
        }
    };

    const isFormValid = email.trim().length > 0 && password.trim().length > 0;

    return (
        <div className="login-card">
            <div className="login-header">
                <div className="login-logo">
                    <div className="login-icon"></div>
                    TripleS <span style={{ color: 'var(--purple-light)' }}>OS</span>
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
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="password">Password</label>
                    <div className="password-input-wrapper">
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            className="flat-input with-toggle"
                            placeholder="*************"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            required
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
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
                    <div className="error-message">
                        {error}
                    </div>
                )}
            </form>
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="login-page-wrapper">
            <Suspense fallback={<div>Loading...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    );
}
