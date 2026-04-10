import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probe(table) {
     const { error } = await supabase.from(table).select('employeeId').limit(1);
     console.log(`${table}.employeeId:`, error ? 'MISSING' : 'EXISTS');
}

async function run() {
    await probe('kpi_profiles');
    await probe('kpi_audit_logs');
    await probe('work_hours');
    await probe('tasks');
    await probe('employees');
}

run();
