'use client';

import { useEffect, useState, createContext, useContext } from 'react';
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

    const fetchProfile = async (userId: string): Promise<EmployeeProfile | null> => {
        console.log('[Auth] fetchProfile called for userId:', userId);
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('id, email, roleId, firstName, lastName')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('[Auth] Profile fetch error:', error.message);
                return null;
            }
            console.log('[Auth] Profile returned:', data);
            return data as EmployeeProfile | null;
        } catch (err) {
            console.error('[Auth] Unexpected profile fetch error:', err);
            return null;
        }
    };

    useEffect(() => {
        let mounted = true;

        // One source of truth for all auth states
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
                if (!mounted) return;
                console.log('[Auth] Event:', event, '| User:', currentSession?.user?.email ?? 'none');

                if (currentSession?.user) {
                    // 🚨 CRITICAL: Set user and session immediately so AuthGuard can bypass the spinner.
                    // Do not wait for fetchProfile.
                    setUser(currentSession.user);
                    setSession(currentSession);
                    
                    // Also resolve loading state immediately if we have a user
                    setLoading(false);

                    // Fetch profile in parallel without blocking the UI
                    fetchProfile(currentSession.user.id).then((profile) => {
                        if (mounted) {
                            setEmployee(profile);
                            // Ensure loading is false even if fetchProfile was slow
                            setLoading(false);
                        }
                    });
                } else {
                    // Handle logged out state
                    setUser(null);
                    setSession(null);
                    setEmployee(null);
                    setLoading(false);

                    if (event === 'SIGNED_OUT') {
                        router.push('/login');
                    }
                }
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [router]);

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
            if (typeof window !== 'undefined') {
                document.cookie = 'token=; Max-Age=0; path=/;';
                document.cookie = 'user_session=; Max-Age=0; path=/;';
            }
        } catch (error) {
            console.error('[Auth] Sign out error:', error);
            window.location.href = '/login';
        }
    };

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
