import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side only — NEVER use NEXT_PUBLIC_ prefix for the service operations here.
// The anon key is fine for auth.signInWithPassword since it only grants user-level access.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * POST /api/auth/agent-login
 * 
 * Desktop agent login endpoint. The Rust binary calls this instead of Supabase directly,
 * so no Supabase URLs or API keys are embedded in the distributed binary.
 * 
 * Body: { email: string, password: string }
 * Returns: { access_token, user: { id }, profile: { ...employeeData } }
 */
export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        // 1. Authenticate with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError || !authData?.user) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const { user, session } = authData;

        // 2. Fetch employee profile + monitoring policy
        const { data: profiles, error: profileError } = await supabase
            .from('employees')
            .select('*, monitoring_policies(*)')
            .eq('id', user.id)
            .single();

        if (profileError || !profiles) {
            return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
        }

        // 3. Block suspended/offboarded employees
        if (profiles.status !== 'ACTIVE') {
            // Sign out the just-created session immediately
            await supabase.auth.signOut();
            return NextResponse.json(
                { error: 'Your account is suspended. Login access is disabled.' },
                { status: 403 }
            );
        }

        // 4. Return token + profile to the desktop agent
        return NextResponse.json({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            user: { id: user.id },
            profile: profiles,
        });

    } catch (error: any) {
        console.error('[agent-login] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
