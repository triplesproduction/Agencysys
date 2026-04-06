import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listTables() {
    // We can't list tables directly via anon key usually unless we query pg_catalog which might be blocked
    // But we can try to guess or use a RPC if exists.
    // Instead, let's try to query 'eod_reports' and 'eod_submissions' to see which one works.
    
    console.log('--- Testing eod_reports ---');
    const { data: d1, error: e1 } = await supabase.from('eod_reports').select('*').limit(1);
    if (e1) console.log('eod_reports error:', e1.message);
    else console.log('eod_reports columns:', d1.length > 0 ? Object.keys(d1[0]) : 'Exists but empty');

    console.log('--- Testing eod_submissions ---');
    const { data: d2, error: e2 } = await supabase.from('eod_submissions').select('*').limit(1);
    if (e2) console.log('eod_submissions error:', e2.message);
    else console.log('eod_submissions columns:', d2.length > 0 ? Object.keys(d2[0]) : 'Exists but empty');
    
    console.log('--- Testing work_hours vs work_hour_logs ---');
    const { data: d3, error: e3 } = await supabase.from('work_hours').select('*').limit(1);
    if (e3) console.log('work_hours error:', e3.message);
    else console.log('work_hours columns:', d3.length > 0 ? Object.keys(d3[0]) : 'Exists but empty');

    const { data: d4, error: e4 } = await supabase.from('work_hour_logs').select('*').limit(1);
    if (e4) console.log('work_hour_logs error:', e4.message);
    else console.log('work_hour_logs columns:', d4.length > 0 ? Object.keys(d4[0]) : 'Exists but empty');
}

listTables();
