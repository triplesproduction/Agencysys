
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkKpis() {
    console.log('Checking kpi_profiles table...');
    const { data, error } = await supabase.from('kpi_profiles').select('*, employee:employees!employee_id(id, firstName, lastName, roleId, role_id)');
    
    if (error) {
        console.error('Error fetching KPI profiles:', error);
    } else {
        console.log('Total profiles found:', data.length);
        data.forEach(p => {
             const role = (p.employee?.roleId || p.employee?.role_id || '').toUpperCase();
             console.log(`- ${p.employee?.firstName} ${p.employee?.lastName} | Month: ${p.month_year} | Role: ${role} | Score: ${p.current_score}`);
        });
    }
}

checkKpis();
