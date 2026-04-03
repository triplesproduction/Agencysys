import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';

const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false }});

async function run() {
    try {
        const { data, error } = await supabase.from('employees').select('firstName,lastName').limit(1);
        console.log("Employees Data:", data);
        console.log("Employees Error:", error);
    } catch (e) {
        console.error("Employees exception:", e);
    }
}
run();
