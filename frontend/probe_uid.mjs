import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeUid() {
    console.log('--- Probing for uid column ---');
    const { error } = await supabase.from('eod_reports').insert([{ uid: '00000000-0000-0000-0000-000000000000' }]);
    if (error && error.message.includes('Could not find the')) {
        console.log("Column 'uid' check: MISSING");
    } else {
        console.log(`Column 'uid' check: EXISTS or RLS (Failed on: ${error ? error.message : 'PASS'})`);
    }
}

probeUid();
