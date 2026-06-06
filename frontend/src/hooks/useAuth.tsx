'use client';
import { logger } from '@/lib/logger';

import { useEffect, useState, createContext, useContext, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface EmployeeProfile {
    id: string;
    email: string;
    roleId: string;
    designation?: string;
    firstName: string;
    lastName: string;
    profilePhoto?: string;
    joinedAt?: string;
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
    const employeeRef = useRef<EmployeeProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const loadingRef = useRef(true); // mirrors loading state for closures that can't read the latest state
    const router = useRouter();

    /** Keeps state and ref in sync on every loading change */
    const setLoadingSync = (val: boolean) => {
        loadingRef.current = val;
        setLoading(val);
    };

    const fetchProfile = async (userId: string, email?: string): Promise<EmployeeProfile | null> => {
        logger.log(`[Auth TRACE] Fetching profile for ${userId} (${email})...`);
        try {
            // Using select('*') is safer to avoid crashes on missing columns during transitions
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                logger.error('[Auth DEBUG] Profile fetch database error:', error.message);
                // Fail Closed: If there's a DB error, we don't want to risk granting incorrect permissions.
                return null;
            }
            
            if (!data) {
                logger.warn('[Auth DEBUG] No profile record found in database for UID:', userId);
                // Fail Closed: If the user doesn't have a profile in the employees table, they shouldn't be in the OS.
                return null;
            }
            
            // Normalize keys from all possible formats (camelCase or snake_case)
            const profile: EmployeeProfile = {
                id: data.id,
                email: data.email || email || '',
                roleId: data.roleId || data.role_id || 'EMPLOYEE',
                designation: data.designation,
                firstName: data.firstName || data.first_name || email?.split('@')[0] || 'User',
                lastName: data.lastName || data.last_name || 'Member',
                profilePhoto: data.profilePhoto || data.profile_photo,
                joinedAt: data.joinedAt || data.joined_at
            };

            logger.log('[Auth DEBUG] Profile successfully resolved. Role:', profile.roleId);
            return profile;
        } catch (err) {
            logger.error('[Auth DEBUG] Unexpected profile fetch exception:', err);
            return null;
        }
    };

    // Auth resolution is now strictly driven by onAuthStateChange and checkUser callbacks


    useEffect(() => {
        let mounted = true;
        let isResolving = false;
        
        // Safety fallback: ensure loading never hangs forever.
        // Uses loadingRef so the closure reads the *live* value, not the stale mount-time `true`.
        const safetyTimeout = setTimeout(() => {
            if (mounted && loadingRef.current) {
                logger.warn('[AUTH] Safety timeout reached — forcing loading false.');
                setLoadingSync(false);
            }
        }, 8000);

        logger.log('[AUTH DEBUG] AuthProvider mounted. Initializing session listener...');

        const resolveAuth = async (currentUser: User | null, currentSession: Session | null, source: string) => {
            if (!mounted) return;
            if (isResolving) {
                logger.log(`[AUTH DEBUG] Resolution already in progress, skipping (${source})`);
                return;
            }
            isResolving = true;
            
            try {
                if (currentUser) {
                    logger.log(`[AUTH DEBUG] Active session detected (${source}):`, currentUser.id);
                    setUser(currentUser);
                    setSession(currentSession);
                    
                    // Optimization: Only fetch profile if it's not already in state
                    // This prevents re-fetching the same profile during SPA navigation
                    if (!employeeRef.current) {
                        const profileData = await fetchProfile(currentUser.id, currentUser.email || undefined);
                        if (mounted) {
                            employeeRef.current = profileData;
                            setEmployee(profileData);
                            setLoadingSync(false); // Always set loading false after attempt
                        }
                    } else {
                        setLoadingSync(false);
                    }
                } else {
                    logger.log(`[AUTH DEBUG] No active session (${source})`);
                    setUser(null);
                    setSession(null);
                    employeeRef.current = null;
                    setEmployee(null);
                    setLoadingSync(false);
                }
            } finally {
                isResolving = false;
            }
        };

        // 1. Single source of truth for session resolution
        // We do an explicit getSession() to avoid race conditions with INITIAL_SESSION
        // which can sometimes fire with null before localStorage is parsed.
        const initializeSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                await resolveAuth(session?.user || null, session, 'INITIAL_GET_SESSION');
            } catch (err) {
                logger.error('[AUTH DEBUG] Error getting initial session:', err);
                setLoadingSync(false);
            }
        };
        
        initializeSession();

        // 2. Persistent listener for all auth events
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
                if (!mounted) return;
                
                // IGNORE neutral events or events that shouldn't trigger local state changes yet
                logger.log(`[AUTH DEBUG] Supabase Auth Event: ${event}`);

                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                    // Force resolve for initializing or active sessions
                    await resolveAuth(currentSession?.user || null, currentSession, event);
                } else if (event === 'INITIAL_SESSION') {
                    // We handle INITIAL_SESSION via the explicit getSession() above to prevent
                    // premature null resolutions. We only resolve if there is a session here.
                    if (currentSession) {
                        await resolveAuth(currentSession.user, currentSession, event);
                    }
                } else if (event === 'SIGNED_OUT') {
                    logger.log('[AUTH DEBUG] Signed out event detected. Clearing local state...');
                    setUser(null);
                    setSession(null);
                    employeeRef.current = null;
                    setEmployee(null);
                    setLoadingSync(false);
                    if (typeof window !== 'undefined') {
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
    }, []);

    const signOut = useCallback(async () => {
        logger.log('[Auth] Nuclear Sign Out initiated...');
        try {
            // 1. Clear local state immediately for instant UI feedback
            setUser(null);
            setSession(null);
            employeeRef.current = null;
            setEmployee(null);
            setLoadingSync(false);

            if (typeof window !== 'undefined') {
                // Clear all possible session artifacts
                localStorage.removeItem('triples_auth_session'); // Target actual Supabase storage key
                // Remove Supabase auth keys instead of nuclear option
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.includes('supabase.auth.token')) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
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
            
            logger.log('[Auth] Supabase sign out complete. Redirecting...');
        } catch (error) {
            logger.error('[Auth] Sign out error (swallowed for safety):', error);
        } finally {
            // 3. Always force a hard redirect to clear potential SPA hangs
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
    }, []);

    // Inactivity Auto-Logout (5 Minutes)
    useEffect(() => {
        if (!user || !session) {
            logger.log('[Auth Inactivity] No active session. Timer suspended.');
            return;
        }

        let timeoutId: NodeJS.Timeout;
        let lastActivityTime = Date.now();
        const INACTIVITY_LIMIT = 300000; // 5 minutes (300,000 ms)

        const triggerLogout = () => {
            logger.log(`[Auth Inactivity] User inactive for ${INACTIVITY_LIMIT/1000}s. Triggering logout protocol...`);
            signOut();
        };

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(triggerLogout, INACTIVITY_LIMIT);
        };

        // Events that indicate activity - optimized set
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        const handler = () => {
            const now = Date.now();
            // Throttle to 1 second to prevent CPU churn
            if (now - lastActivityTime > 1000) {
                lastActivityTime = now;
                resetTimer();
            }
        };

        logger.log(`[Auth Inactivity] Timer initialized. Limit: ${INACTIVITY_LIMIT/1000}s.`);
        
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
            logger.log('[Auth Inactivity] Timer dismantled.');
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
