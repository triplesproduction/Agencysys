import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';

const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false }});

async function run() {
    console.log("Fetching employees...");
    try {
        let query = supabase.from('employees').select('*', { count: 'exact' });
        query = query.range(0, 49);
        const { data, error, count } = await query;
        console.log("Employees Error:", error);
        console.log("Employees Data length:", data?.length);
    } catch (e) {
        console.error("Employees exception:", e);
    }
}
run();
