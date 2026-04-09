import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    const { data, error } = await supabase.rpc('get_table_columns_v2', { tname: 'employees' });
    if (error) {
        // Fallback to a direct query on information_schema if RPC fails
        console.log('RPC failed, trying raw query...');
        const { data: cols, error: err2 } = await supabase.from('employees').select('firstName, lastName, profilePhoto').limit(1);
        if (err2) {
            console.error('Direct query failed:', err2.message);
            // Try snake_case
            const { data: cols2, error: err3 } = await supabase.from('employees').select('first_name, last_name, profile_photo').limit(1);
            if (err3) {
                console.error('Snake case also failed:', err3.message);
            } else {
                console.log('Table uses snake_case');
            }
        } else {
            console.log('Table uses camelCase');
        }
    } else {
        console.log('Columns:', data);
    }
}

probe();
