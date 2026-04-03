import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseKey);
async function run() {
    console.log("Fetching rules...");
    try {
        const { data, error } = await supabase.from('rules').select('*, author:employees!createdBy(id, firstName, lastName)').order('createdAt', { ascending: false });
        if (error) console.error("Error:", error);
        else console.log("Data:", data);
    } catch (e) {
        console.error("Exception:", e);
    }
}
run();
