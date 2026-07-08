import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Initialize Supabase admin/client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        // Validate the JWT with Supabase Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const { eventType, payload } = await req.json();

        if (!eventType || !payload) {
            return NextResponse.json({ error: 'Missing eventType or payload' }, { status: 400 });
        }

        let dbResult;

        switch (eventType) {
            case 'clock_in': {
                const { employeeId, startTime } = payload;
                const { data, error } = await supabase
                    .from('work_sessions')
                    .insert({
                        employeeId,
                        startTime,
                        status: 'ACTIVE'
                    })
                    .select()
                    .single();

                if (error) throw error;
                dbResult = data;
                break;
            }

            case 'clock_out': {
                const { sessionId, endTime } = payload;
                const { data, error } = await supabase
                    .from('work_sessions')
                    .update({
                        endTime,
                        status: 'COMPLETED'
                    })
                    .eq('id', sessionId)
                    .select()
                    .single();

                if (error) throw error;
                dbResult = data;
                break;
            }

            case 'app_usage': {
                const { employeeId, sessionId, appName, startTime, endTime, durationSeconds } = payload;
                const { data, error } = await supabase
                    .from('application_usage')
                    .insert({
                        employeeId,
                        sessionId,
                        appName,
                        startTime,
                        endTime,
                        durationSeconds
                    })
                    .select();

                if (error) throw error;
                dbResult = data;
                break;
            }

            case 'device_reg': {
                const { employeeId, deviceId, deviceName, operatingSystem, version } = payload;
                
                // Upsert device registration
                const { data, error } = await supabase
                    .from('device_registrations')
                    .upsert({
                        employeeId,
                        deviceId,
                        deviceName,
                        operatingSystem,
                        version,
                        lastSeen: new Date().toISOString()
                    }, { onConflict: 'deviceId' })
                    .select();

                if (error) throw error;
                dbResult = data;
                break;
            }

            default:
                return NextResponse.json({ error: `Unsupported event type: ${eventType}` }, { status: 400 });
        }

        return NextResponse.json({ success: true, data: dbResult });

    } catch (error: any) {
        console.error('API monitoring sync error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
