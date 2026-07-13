'use client';
import { logger } from '@/lib/logger';

import { useEffect, useState, createContext, useContext, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface EmployeeProfile {
    id: string;
    email: string;
    roleId: string;
    designation?: string;
    department?: string;
    firstName: string;
    lastName: string;
    profilePhoto?: string;
    joinedAt?: string;
    status?: string;
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

    // Refs to track stable values across async operations
    const mountedRef = useRef(true);
    const employeeRef = useRef<EmployeeProfile | null>(null);
    // Track the last userId we fetched a profile for — prevents redundant DB hits
    // on TOKEN_REFRESHED events (which fire every ~60s)
    const profileFetchedForRef = useRef<string | null>(null);

        const fetchProfile = async (userId: string, email?: string): Promise<EmployeeProfile | null> => {
        try {
            // Ensure the Supabase client session is initialized before RLS-gated queries
            await supabase.auth.getSession();

            let data = null, error = null;
            
            // Retry twice to handle Supabase token injection race on hard refresh
            for (let attempt = 1; attempt <= 2; attempt++) {
                const res = await supabase
                    .from('employees')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle();
                
                data = res.data;
                error = res.error;

                if (data && !error) break;
                
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            if (error) {
                logger.error('[Auth] Profile DB error:', error.message);
                profileFetchedForRef.current = null;
                return null;
            }

            if (!data) {
                logger.warn('[Auth] No employee record found for UID:', userId);
                profileFetchedForRef.current = null;
                return null;
            }

            const profile: EmployeeProfile = {
                id: data.id,
                email: data.email || email || '',
                roleId: data.roleId || data.role_id || 'EMPLOYEE',
                designation: data.designation,
                department: data.department,
                firstName: data.firstName || data.first_name || email?.split('@')[0] || 'User',
                lastName: data.lastName || data.last_name || 'Member',
                profilePhoto: data.profilePhoto || data.profile_photo,
                joinedAt: data.joinedAt || data.joined_at,
                status: data.status || 'ACTIVE',
            };

            return profile;
        } catch (err) {
            logger.error('[Auth] Unexpected profile fetch error:', err);
            return null;
        }
    };


    useEffect(() => {
        mountedRef.current = true;

        // Safety net: if nothing resolves in 8s, unblock the UI
        const safetyTimer = setTimeout(() => {
            if (mountedRef.current) {
                setLoading(false);
            }
        }, 8000);

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
                if (!mountedRef.current) return;

                logger.log(`[Auth] Event: ${event}`);

                // ─── No session ─────────────────────────────────────────────
                if (!currentSession) {
                    if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
                        setUser(null);
                        setSession(null);
                        setEmployee(null);
                        employeeRef.current = null;
                        profileFetchedForRef.current = null;
                        setLoading(false);
                    }
                    // TOKEN_REFRESHED/SIGNED_IN without a session: not a blocking case.
                    // Ensure loading is cleared so we don't stay stuck.
                    setLoading(false);
                    return;
                }

                const currentUser = currentSession.user;

                // ─── Session exists ──────────────────────────────────────────
                // Always update user/session state for accurate token data
                setUser(currentUser);
                setSession(currentSession);

                // Only fetch the employee profile once per user ID.
                // TOKEN_REFRESHED fires every ~60s — we must NOT re-fetch on it.
                if (profileFetchedForRef.current === currentUser.id) {
                    if (employeeRef.current) {
                        // Profile already loaded — ensure loading is cleared and bail.
                        setLoading(false);
                        return;
                    }
                    // Fetch is still in flight — don't return, don't re-trigger.
                    // The in-flight fetch will call setLoading(false) when done.
                    return;
                }


                // First time we see this user — fetch their profile
                profileFetchedForRef.current = currentUser.id; // Mark immediately to block concurrent fetches
                
                setLoading(true);

                const profile = await fetchProfile(currentUser.id, currentUser.email ?? undefined);

                if (!mountedRef.current) return; // Component unmounted during async fetch

                if (profile && profile.status !== 'ACTIVE') {
                    logger.warn('[Auth] Employee status is inactive/suspended. Signing out.');
                    setUser(null);
                    setSession(null);
                    setEmployee(null);
                    employeeRef.current = null;
                    profileFetchedForRef.current = null;
                    setLoading(false);
                    supabase.auth.signOut().then(() => {
                        if (typeof window !== 'undefined') {
                            window.location.href = '/login?error=suspended';
                        }
                    });
                    return;
                }

                employeeRef.current = profile;
                setEmployee(profile);
                setLoading(false);
            }
        );

        return () => {
            mountedRef.current = false;
            clearTimeout(safetyTimer);
            subscription.unsubscribe();
        };
    }, []);

    const signOut = useCallback(async () => {
        logger.log('[Auth] Sign out initiated...');
        try {
            // Clear only Supabase auth keys to preserve local settings like read announcements
            if (typeof window !== 'undefined') {
                Object.keys(localStorage).forEach((key) => {
                    if (key.startsWith('sb-')) {
                        localStorage.removeItem(key);
                    }
                });
                sessionStorage.clear();

                // Clear all cookies manually
                document.cookie.split(";").forEach((c) => {
                    const cookieName = c.trim().split("=")[0];
                    if (cookieName) {
                        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
                    }
                });
            }

            // Fire and forget server-side sign out so it doesn't block local redirection
            supabase.auth.signOut().catch((err) => {
                logger.error('[Auth] Supabase signOut error:', err);
            });
            logger.log('[Auth] Sign out cleanup triggered.');
        } catch (error) {
            logger.error('[Auth] Sign out error:', error);
        } finally {
            // Clear React state at the end to trigger redirect only after cleanup is done
            setUser(null);
            setSession(null);
            setEmployee(null);
            employeeRef.current = null;
            profileFetchedForRef.current = null;
            setLoading(false);

            // Hard redirect to ensure server-side session cookie is cleared
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
    }, []);

    // Inactivity Auto-Logout (5 Minutes) - Only on Website
    useEffect(() => {
        if (!user || !session) return;

        // Skip auto-logout if running as an installed App (PWA, Mobile, Desktop)
        const isApp = window.matchMedia('(display-mode: standalone)').matches || 
                      (window.navigator as any).standalone || 
                      document.referrer.includes('android-app://') ||
                      (window as any).__TAURI__;
        
        if (isApp) return;

        let timeoutId: NodeJS.Timeout;
        let lastActivityTime = Date.now();
        const INACTIVITY_LIMIT = 300000; // 5 minutes

        const triggerLogout = () => {
            logger.log('[Auth] Inactivity timeout — logging out...');
            signOut();
        };

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(triggerLogout, INACTIVITY_LIMIT);
        };

        const handler = () => {
            const now = Date.now();
            if (now - lastActivityTime > 1000) {
                lastActivityTime = now;
                resetTimer();
            }
        };

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        events.forEach(e => window.addEventListener(e, handler, { passive: true }));
        resetTimer();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(e => window.removeEventListener(e, handler));
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
