import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeUserId() {
    console.log('--- Probing for user_id column in eod_reports ---');
    const { error } = await supabase.from('eod_reports').insert([{ user_id: '00000000-0000-0000-0000-000000000000' }]);
    if (error) {
        if (error.message.includes('Could not find the')) {
            console.log("Column 'user_id' check: MISSING");
        } else {
            console.log(`Column 'user_id' check: EXISTS (Failed on: ${error.message})`);
        }
    } else {
        console.log("Column 'user_id' check: PASS");
    }
}

probeUserId();
