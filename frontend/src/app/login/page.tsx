'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { setAuthToken } from '@/lib/auth';
import { LogIn, Loader2 } from 'lucide-react';
import './Login.css';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // The UI represents these as Username and Password to the user
    // but under the hood they securely map to employeeId and roleId
    // to preserve the existing backend API endpoint and logic seamlessly
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
            const res = await api.login(email, password);
            if (res.access_token) {
                setAuthToken(res.access_token);
                // Force full refresh to establish new jwt decode context across the hydration tree
                window.location.href = '/dashboard';
            } else {
                setError('Login failed. No token received.');
            }
        } catch (err: any) {
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
