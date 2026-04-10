import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probe() {
     // Try to insert with camelCase and see what it says
     const { error } = await supabase.from('kpi_audit_logs').insert([{ employeeId: '00000000-0000-0000-0000-000000000000' }]);
     console.log('Error for employeeId:', error?.message);

     const { error: error2 } = await supabase.from('kpi_audit_logs').insert([{ employee_id: '00000000-0000-0000-0000-000000000000' }]);
     console.log('Error for employee_id:', error2?.message);
}

probe();
