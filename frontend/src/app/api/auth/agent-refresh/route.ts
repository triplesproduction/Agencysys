import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
    try {
        const { refresh_token } = await req.json();

        if (!refresh_token) {
            return NextResponse.json({ error: 'refresh_token is required' }, { status: 400 });
        }

        const { data, error } = await supabase.auth.refreshSession({ refresh_token });

        if (error || !data.session) {
            return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 });
        }

        return NextResponse.json({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
        });

    } catch (error: any) {
        console.error('[agent-refresh] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
