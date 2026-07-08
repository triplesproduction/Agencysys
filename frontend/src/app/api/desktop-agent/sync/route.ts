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

        // Validate the JWT with Supabase Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const reqClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        });

        // Validate that the employee is active
        const { data: employee, error: empError } = await reqClient
            .from('employees')
            .select('status')
            .eq('id', user.id)
            .maybeSingle();

        if (empError || !employee || employee.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Unauthorized: Account is suspended' }, { status: 403 });
        }

        const body = await req.json();
        const { agentVersion, deviceId, sessionId, events } = body;

        if (!deviceId || !sessionId || !Array.isArray(events)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const syncedIds: string[] = [];
        const failedIds: Array<{ id: string; error: string }> = [];

        // Helper to auto-create missing sessions during backlogged event sync
        const ensureSession = async (sessId: string, empId: string, timeStr: string) => {
            const { error } = await reqClient
                .from('work_sessions')
                .upsert({
                    id: sessId,
                    employeeId: empId,
                    startTime: timeStr,
                    status: 'ACTIVE'
                }, { onConflict: 'id', ignoreDuplicates: true });
            if (error) {
                console.error(`[sync] Failed to auto-create session ${sessId}:`, error);
            }
        };

        // Process batch events sequentially to preserve sequence order
        for (const event of events) {
            const { id, eventType, payload, timestamp, sessionId: eventSessionId } = event;
            const currentSessionId = eventSessionId || sessionId;
            try {
                switch (eventType.toUpperCase()) {
                    case 'CLOCK_IN': {
                        const { employeeId, startTime } = payload;
                        // Use upsert so that if the agent retries a CLOCK_IN after a crash,
                        // we update rather than throw a duplicate-key error that blocks all
                        // subsequent heartbeats in the queue.
                        const { error } = await reqClient
                            .from('work_sessions')
                            .upsert({
                                id: currentSessionId,
                                employeeId,
                                startTime,
                                status: 'ACTIVE'
                            }, { onConflict: 'id', ignoreDuplicates: false });
                        if (error) throw error;
                        break;
                    }

                    case 'CLOCK_OUT': {
                        const { endTime } = payload;
                        const { error } = await reqClient
                            .from('work_sessions')
                            .update({
                                endTime,
                                status: 'COMPLETED'
                            })
                            .eq('id', currentSessionId);
                        if (error) throw error;
                        break;
                    }

                    case 'HEARTBEAT': {
                        const { employeeId, status, activityPercentage, batteryStatus, networkStatus } = payload;
                        let { error } = await reqClient
                            .from('employee_heartbeats')
                            .insert({
                                employeeId,
                                sessionId: currentSessionId,
                                timestamp,
                                status,
                                activityPercentage,
                                runningVersion: agentVersion,
                                batteryStatus,
                                networkStatus
                            });
                        if (error) {
                            if (error.code === '23503') {
                                await ensureSession(currentSessionId, employeeId, timestamp);
                                const { error: retryErr } = await reqClient
                                    .from('employee_heartbeats')
                                    .insert({
                                        employeeId,
                                        sessionId: currentSessionId,
                                        timestamp,
                                        status,
                                        activityPercentage,
                                        runningVersion: agentVersion,
                                        batteryStatus,
                                        networkStatus
                                    });
                                if (retryErr) throw retryErr;
                            } else {
                                throw error;
                            }
                        }
                        break;
                    }

                    case 'SCREENSHOT': {
                        const { employeeId, activityPercentage, sha256Hash, imageBase64 } = payload;
                        
                        // Parse year and month from timestamp
                        const dateObj = new Date(timestamp);
                        const year = dateObj.getFullYear().toString();
                        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');

                        // GDrive Path Schema: Employees / {employee_id} / {year} / {month} / {session_id} / {screenshot_files}.jpg
                        const filename = `screenshots/${employeeId}/${year}/${month}/${currentSessionId}/${timestamp.replace(/:/g, '-')}.jpg`;
                        
                        // Upload image buffer to Supabase Storage fallback
                        const imageBuffer = Buffer.from(imageBase64, 'base64');
                        const { error: uploadErr } = await reqClient.storage
                            .from('documents')
                            .upload(filename, imageBuffer, {
                                contentType: 'image/jpeg',
                                upsert: true
                            });

                        if (uploadErr) throw uploadErr;

                        const driveFileId = `gdrive_fallback_${filename}`;

                        let { error: dbErr } = await reqClient
                            .from('employee_screenshots')
                            .insert({
                                employeeId,
                                sessionId: currentSessionId,
                                timestamp,
                                driveFileId,
                                activityPercentage,
                                sha256Hash
                            });

                        if (dbErr) {
                            if (dbErr.code === '23503') {
                                await ensureSession(currentSessionId, employeeId, timestamp);
                                const { error: retryErr } = await reqClient
                                    .from('employee_screenshots')
                                    .insert({
                                        employeeId,
                                        sessionId: currentSessionId,
                                        timestamp,
                                        driveFileId,
                                        activityPercentage,
                                        sha256Hash
                                    });
                                if (retryErr) throw retryErr;
                            } else {
                                throw dbErr;
                            }
                        }
                        break;
                    }

                    case 'APPLICATION_USAGE': {
                        const { employeeId, appName, startTime, endTime, durationSeconds } = payload;
                        let { error } = await reqClient
                            .from('application_usage')
                            .insert({
                                employeeId,
                                sessionId: currentSessionId,
                                appName,
                                startTime,
                                endTime,
                                durationSeconds
                            });
                        if (error) {
                            if (error.code === '23503') {
                                await ensureSession(currentSessionId, employeeId, startTime);
                                const { error: retryErr } = await reqClient
                                    .from('application_usage')
                                    .insert({
                                        employeeId,
                                        sessionId: currentSessionId,
                                        appName,
                                        startTime,
                                        endTime,
                                        durationSeconds
                                    });
                                if (retryErr) throw retryErr;
                            } else {
                                throw error;
                            }
                        }
                        break;
                    }

                    case 'DEVICE_REG':
                    case 'DEVICE_STATUS': {
                        const { employeeId, deviceName, operatingSystem, deviceFingerprint } = payload;
                        const { error } = await reqClient
                            .from('device_registrations')
                            .upsert({
                                employeeId,
                                deviceId,
                                deviceName,
                                operatingSystem,
                                version: agentVersion,
                                deviceFingerprint,
                                lastSeen: new Date().toISOString()
                            }, { onConflict: 'deviceId' });
                        if (error) throw error;
                        break;
                    }

                    default:
                        console.warn(`Skipping unsupported event type: ${eventType}`);
                }

                // Add to success list
                syncedIds.push(id);
            } catch (eventErr: any) {
                console.error(`Failed to process event ${id} of type ${eventType}:`, eventErr);
                failedIds.push({ id, error: eventErr?.message || String(eventErr) });
            }
        }

        // Fetch pending remote commands for this device
        const { data: pendingCmds } = await reqClient
            .from('device_commands')
            .select('*')
            .eq('deviceId', deviceId)
            .eq('status', 'PENDING');

        const commands = (pendingCmds || []).map(cmd => ({
            id: cmd.id,
            command: cmd.command,
            parameters: cmd.parameters
        }));

        // Mark commands as SENT
        if (commands.length > 0) {
            const cmdIds = commands.map(c => c.id);
            await reqClient
                .from('device_commands')
                .update({ status: 'SENT' })
                .in('id', cmdIds);
        }

        return NextResponse.json({
            success: true,
            syncedIds,
            failedIds,
            commands
        });

    } catch (error: any) {
        console.error('Unified sync gateway error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
export const dynamic = 'force-dynamic';
