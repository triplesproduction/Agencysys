import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkEodTable() {
    const { data, error } = await supabase.from('eod_reports').select('*').limit(1);
    if (error) {
        console.error('Error fetching EOD report sample:', error);
        return;
    }
    if (data && data.length > 0) {
        console.log('Sample EOD Report Columns:', Object.keys(data[0]));
    } else {
        console.log('No EOD reports found to sample columns.');
    }
    
    // Also check work_hours
    const { data: whData, error: whError } = await supabase.from('work_hours').select('*').limit(1);
    if (!whError && whData && whData.length > 0) {
        console.log('Sample Work Hours Columns:', Object.keys(whData[0]));
    }
}

checkEodTable();
