'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogIn, Loader2 } from 'lucide-react';
import './Login.css';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [email, setEmail] = useState(searchParams?.get('email') || '');
    const [password, setPassword] = useState('');
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
                throw new Error(authError?.message || 'Login failed. Check your credentials.');
            }

            console.log('[Login] Auth success:', authData.user?.id);

            // Step 2: Fetch employee profile to get role info
            const { data: employee, error: empError } = await supabase
                .from('employees')
                .select('id, email, roleId, firstName, lastName')
                .eq('id', authData.user.id)
                .single();

            if (empError || !employee) {
                console.error('[Login] Employee fetch error:', empError);
                await supabase.auth.signOut();
                throw new Error('Employee profile not found. Please contact your administrator.');
            }

            console.log('[Login] Employee profile:', employee);

            // Step 3: Write middleware-compatible cookies so protected routes stay accessible
            const token = authData.session.access_token;
            document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Lax`;
            document.cookie = `user_session=${encodeURIComponent(JSON.stringify({
                id: employee.id,
                roleId: employee.roleId,
                role: employee.roleId,
                firstName: employee.firstName,
                lastName: employee.lastName,
                sub: employee.id,
            }))}; path=/; max-age=86400; SameSite=Lax`;

            // Step 4: Redirect to dashboard
            console.log('[Login] Redirecting to dashboard...');
            window.location.href = '/dashboard';

        } catch (err: any) {
            console.error('[Login] Error:', err);
            setError(err.message || 'Verification failed. Double check your credentials.');
        } finally {
            setLoading(false);
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
                    <input
                        id="password"
                        type="password"
                        className="flat-input"
                        placeholder="*************"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        required
                    />
                </div>

                <div className="login-utils">
                    <label className="remember-me">
                        <input type="checkbox" className="remember-checkbox" />
                        Remember Me
                    </label>
                    <a href="#" className="forgot-link" onClick={(e) => e.preventDefault()}>
                        Forgot Password?
                    </a>
                </div>

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
