import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probe() {
     const { data } = await supabase.from('tasks').select('*').limit(1);
     if (data?.[0]) console.log('tasks keys:', Object.keys(data[0]));
     
     const { data: q2 } = await supabase.from('kpi_profiles').select('*').limit(1);
     if (q2?.[0]) console.log('kpi_profiles keys:', Object.keys(q2[0]));

     const { data: q3 } = await supabase.from('kpi_audit_logs').select('*').limit(1);
     if (q3?.[0]) console.log('kpi_audit_logs keys:', Object.keys(q3[0]));
}

probe();
