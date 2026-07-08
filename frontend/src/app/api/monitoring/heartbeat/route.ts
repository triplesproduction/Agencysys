import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const body = await req.json();
        const {
            employeeId,
            sessionId,
            deviceId,
            timestamp,
            status,
            activityPercentage,
            runningVersion,
            batteryStatus,
            networkStatus
        } = body;

        if (!employeeId || !timestamp) {
            return NextResponse.json({ error: 'Missing employeeId or timestamp' }, { status: 400 });
        }

        // 1. Log heartbeat in database
        const { data, error } = await supabase
            .from('employee_heartbeats')
            .insert({
                employeeId,
                sessionId,
                timestamp,
                status,
                activityPercentage,
                runningVersion,
                batteryStatus,
                networkStatus
            })
            .select()
            .single();

        if (error) throw error;

        // 2. Update device registration last seen timestamp
        if (deviceId) {
            await supabase
                .from('device_registrations')
                .update({ lastSeen: new Date().toISOString() })
                .eq('deviceId', deviceId);
        }

        return NextResponse.json({ success: true, data });

    } catch (error: any) {
        console.error('API monitoring heartbeat error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
