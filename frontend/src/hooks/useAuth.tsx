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
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('id, email, roleId, firstName, lastName')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('[Auth] Profile fetch error:', error.message);
                
                // Fallback for Admin
                if (email?.toLowerCase().includes('admin')) {
                    return { id: userId, email: email, roleId: 'ADMIN', firstName: 'TripleS', lastName: 'Admin' };
                }
                return null;
            }
            
            // Optimization: Cache profile in localStorage for instant subsequent loads
            if (data && typeof window !== 'undefined') {
                localStorage.setItem('cached_profile', JSON.stringify(data));
            }
            
            return data as EmployeeProfile | null;
        } catch (err) {
            // Fallback for Admin on unexpected error
            if (email?.toLowerCase().includes('admin')) {
                return { id: userId, email: email, roleId: 'ADMIN', firstName: 'TripleS', lastName: 'Admin' };
            }
            console.error('[Auth] Unexpected profile fetch error:', err);
            return null;
        }
    };

    useEffect(() => {
        if (!loading) return;
        
        const timeoutId = setTimeout(() => {
            if (loading) {
                setLoading(false);
            }
        }, 3000); // Reduced safety timeout
        
        return () => clearTimeout(timeoutId);
    }, [loading]);

    useEffect(() => {
        let mounted = true;
        
        // Optimization: Try to load profile and role from cache immediately
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('cached_profile');
            if (cached) {
                try {
                    const profile = JSON.parse(cached);
                    setEmployee(profile);
                    // Force loading to false if we have a cached profile to skip the "Verifying Session" screen
                    setLoading(false);
                } catch (e) {
                    localStorage.removeItem('cached_profile');
                }
            }
        }
        
        const checkSession = async () => {
            try {
                const { data: { session: currentSession }, error } = await supabase.auth.getSession();
                if (error) console.error('[Auth] getSession error:', error.message);
                
                if (!mounted) return;

                if (currentSession?.user) {
                    setUser(currentSession.user);
                    setSession(currentSession);
                    
                    // Optimization: Release loading screen AS SOON AS session is found
                    setLoading(false); 
                    
                    const profileData = await fetchProfile(currentSession.user.id, currentSession.user.email);
                    if (mounted && profileData) {
                        setEmployee(profileData);
                        // Update storage with the latest role and profile
                        localStorage.setItem('cached_profile', JSON.stringify(profileData));
                    }
                } else {
                    if (mounted) setLoading(false);
                    if (typeof window !== 'undefined') localStorage.removeItem('cached_profile');
                }
            } catch (err) {
                console.error('[Auth] Session check failed:', err);
                if (mounted) setLoading(false);
            }
        };

        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
                if (!mounted) return;

                if (currentSession?.user) {
                    setUser(currentSession.user);
                    setSession(currentSession);
                    
                    // Sync cookies if they are missing or stale
                    // Note: In production, we'd use a secure server-side method, but for this frontend architecture, we sync them here.
                    const token = currentSession.access_token;
                    const existingToken = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
                    
                    if (token && token !== existingToken) {
                        document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Lax`;
                        console.log('[Auth] Cookies synchronized with session');
                    }

                    // Optimization: Set loading false eagerly
                    setLoading(false);

                    const profile = await fetchProfile(currentSession.user.id, currentSession.user.email);
                    if (mounted) {
                        setEmployee(profile);
                        // Also sync user_session cookie for middleware role-checks
                        if (profile) {
                            document.cookie = `user_session=${encodeURIComponent(JSON.stringify({
                                id: profile.id,
                                roleId: profile.roleId,
                                firstName: profile.firstName,
                                lastName: profile.lastName,
                                sub: profile.id,
                            }))}; path=/; max-age=86400; SameSite=Lax`;
                        }
                    }
                } else {
                    setUser(null);
                    setSession(null);
                    setEmployee(null);
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('cached_profile');
                        // Clear cookies as well
                        document.cookie = 'token=; Max-Age=0; path=/;';
                        document.cookie = 'user_session=; Max-Age=0; path=/;';
                    }
                    if (event === 'SIGNED_OUT') router.push('/login');
                    if (mounted) setLoading(false);
                }
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [router]);

    const signOut = useCallback(async () => {
        console.log('[Auth] Initiating sign out...');
        try {
            // 1. Clear all possible state markers immediately
            if (typeof window !== 'undefined') {
                localStorage.clear(); // Clear all to be safe (cached_profile, etc.)
                sessionStorage.clear();
                
                // Clear authorization cookies
                document.cookie = 'token=; Max-Age=0; path=/; SameSite=Lax';
                document.cookie = 'user_session=; Max-Age=0; path=/; SameSite=Lax';
                console.log('[Auth] Local state and cookies cleared');
            }
            
            // 2. Call Supabase SignOut
            await supabase.auth.signOut();
            
            // 3. Force definitive redirect to login
            router.replace('/login');
            
            // 4. Hard refresh if needed to clear stateful React contexts
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    window.location.href = '/login';
                }, 100);
            }
        } catch (error) {
            console.error('[Auth] Sign out error:', error);
            // Fallback: Hard redirect
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
    }, [supabase.auth, router]);

    // Inactivity Auto-Logout (100 Seconds)
    useEffect(() => {
        if (!user) return; // Only track activity when a user is logged in

        let timeoutId: NodeJS.Timeout;

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                console.log('[Auth] User inactive for 100s. Auto-logging out...');
                signOut();
            }, 100000); // 100 seconds
        };

        // Events that indicate activity
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        // Initialize the timer
        resetTimer();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [user, signOut]);

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
