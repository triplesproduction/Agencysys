'use client';

import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface EmployeeProfile {
    id: string;
    email: string;
    roleId: string;
    firstName: string;
    lastName: string;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    employee: EmployeeProfile | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchProfile = async (userId: string, email?: string): Promise<EmployeeProfile | null> => {
        console.log(`[Auth TRACE] Fetching profile for ${userId} (${email})...`);
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('id, email, roleId, firstName, lastName')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('[Auth DEBUG] Profile fetch database error:', error.message);
                // Fallback for Admin
                if (email?.toLowerCase().includes('admin')) {
                    console.log('[Auth DEBUG] Using Admin fallback profile due to error');
                    return { id: userId, email: email, roleId: 'ADMIN', firstName: 'TripleS', lastName: 'Admin' };
                }
                return null;
            }
            
            if (!data) {
                console.warn('[Auth DEBUG] No profile record found in database');
                // Brand-wide fallback: try to extract something even if DB is missing
                const emailPrefix = email?.split('@')[0] || 'User';
                return { 
                    id: userId, 
                    email: email || '', 
                    roleId: 'EMPLOYEE', 
                    firstName: emailPrefix, 
                    lastName: 'Member' 
                };
            }
            
            console.log('[Auth DEBUG] Profile successfully retrieved:', data.roleId);
            if (typeof window !== 'undefined') {
                localStorage.setItem('cached_profile', JSON.stringify(data));
            }
            return data as EmployeeProfile;
        } catch (err) {
            console.error('[Auth DEBUG] Unexpected profile fetch exception:', err);
            if (email?.toLowerCase().includes('admin')) {
                return { id: userId, email: email, roleId: 'ADMIN', firstName: 'TripleS', lastName: 'Admin' };
            }
            return null;
        }
    };

    // Auth resolution is now strictly driven by onAuthStateChange and checkUser callbacks


    useEffect(() => {
        let mounted = true;
        let isResolving = false;
        
        // Safety fallback: ensure loading never hangs forever
        const safetyTimeout = setTimeout(() => {
            if (mounted && loading) {
                console.warn('[AUTH DEBUG] Resolution safety timeout reached. Forcing loading false.');
                setLoading(false);
            }
        }, 8000);

        console.log('[AUTH DEBUG] AuthProvider mounted. Initializing session listener...');

        const resolveAuth = async (currentUser: User | null, currentSession: Session | null, source: string) => {
            if (!mounted) return;
            if (isResolving) {
                console.log(`[AUTH DEBUG] Resolution already in progress, skipping (${source})`);
                return;
            }
            isResolving = true;
            
            try {
                if (currentUser) {
                    console.log(`[AUTH DEBUG] Active session detected (${source}):`, currentUser.id);
                    setUser(currentUser);
                    setSession(currentSession);
                    
                    // Fetch profile if missing or just to keep it fresh
                    const profileData = await fetchProfile(currentUser.id, currentUser.email || undefined);
                    if (mounted) {
                        setEmployee(profileData);
                        console.log(`[AUTH DEBUG] Profile resolved for ${currentUser.id}:`, profileData ? 'SUCCESS' : 'FAILED (Missing Employee Record)');
                        setLoading(false);
                    }
                } else {
                    console.log(`[AUTH DEBUG] No active session (${source})`);
                    setUser(null);
                    setSession(null);
                    setEmployee(null);
                    setLoading(false);
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('cached_profile');
                    }
                }
            } finally {
                isResolving = false;
            }
        };

        // 1. Single source of truth for session resolution
        // onAuthStateChange fires immediately on initialization with the current session.
        // We no longer need a manual initialCheck() as it causes race conditions with lockers.

        // 2. Persistent listener for all auth events
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
                if (!mounted) return;
                
                // IGNORE neutral events or events that shouldn't trigger local state changes yet
                console.log(`[AUTH DEBUG] Supabase Auth Event: ${event}`);

                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
                    // Force resolve for initializing or active sessions
                    await resolveAuth(currentSession?.user || null, currentSession, event);
                } else if (event === 'SIGNED_OUT') {
                    console.log('[AUTH DEBUG] Signed out event detected. Clearing local state...');
                    setUser(null);
                    setSession(null);
                    setEmployee(null);
                    setLoading(false);
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('cached_profile');
                        // REMOVED: Aggressive window.location.href here. 
                        // THE AuthGuard will handle the redirect if loading is false and user is null.
                        // This prevents race conditions during page refreshes.
                    }
                }
            }
        );

        return () => {
            mounted = false;
            clearTimeout(safetyTimeout);
            subscription.unsubscribe();
        };
    }, [router]);

    const signOut = useCallback(async () => {
        console.log('[Auth] Nuclear Sign Out initiated...');
        try {
            // 1. Clear local state immediately for instant UI feedback
            setUser(null);
            setSession(null);
            setEmployee(null);
            setLoading(false);

            if (typeof window !== 'undefined') {
                // Clear all possible session artifacts
                localStorage.removeItem('cached_profile');
                localStorage.removeItem('triples_auth_session'); // Target actual Supabase storage key
                localStorage.clear(); // Nuclear option
                sessionStorage.clear();
                
                // Clear all cookies (to be absolutely sure)
                const cookies = document.cookie.split(';');
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i];
                    const eqPos = cookie.indexOf('=');
                    const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
                    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
                }
            }

            // 2. Signal to Supabase
            await supabase.auth.signOut();
            
            console.log('[Auth] Supabase sign out complete. Redirecting...');
        } catch (error) {
            console.error('[Auth] Sign out error (swallowed for safety):', error);
        } finally {
            // 3. Always force a hard redirect to clear potential SPA hangs
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
    }, [supabase.auth]);

    // Inactivity Auto-Logout (120 Seconds)
    useEffect(() => {
        if (!user || !session) {
            console.log('[Auth Inactivity] No active session. Timer suspended.');
            return;
        }

        let timeoutId: NodeJS.Timeout;
        const INACTIVITY_LIMIT = 120000; // 120 seconds

        const triggerLogout = () => {
            console.log(`[Auth Inactivity] User inactive for ${INACTIVITY_LIMIT/1000}s. Triggering logout protocol...`);
            signOut();
        };

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(triggerLogout, INACTIVITY_LIMIT);
        };

        // Events that indicate activity - optimized set
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        const handler = () => {
            resetTimer();
        };

        console.log(`[Auth Inactivity] Timer initialized. Limit: ${INACTIVITY_LIMIT/1000}s.`);
        
        events.forEach(event => {
            window.addEventListener(event, handler, { passive: true });
        });

        // Initialize the first timer
        resetTimer();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(event => {
                window.removeEventListener(event, handler);
            });
            console.log('[Auth Inactivity] Timer dismantled.');
        };
    }, [user, session, signOut]);

    return (
        <AuthContext.Provider value={{ user, session, employee, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
