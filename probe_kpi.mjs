import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probe() {
    console.log('--- KPI Profiler Probe ---');
    
    // Check tables
    const { data: tables, error: tableError } = await supabase.from('kpi_profiles').select('*').limit(5);
    if (tableError) {
        console.error('kpi_profiles access FAILED:', tableError.message);
    } else {
        console.log('kpi_profiles access SUCCESS. Found rows:', tables.length);
        tables.forEach(row => console.log('Row:', row));
    }

    const { data: logs, error: logError } = await supabase.from('kpi_audit_logs').select('*').limit(5);
    if (logError) {
        console.error('kpi_audit_logs access FAILED:', logError.message);
    } else {
        console.log('kpi_audit_logs access SUCCESS. Found rows:', logs.length);
    }
}

probe();
