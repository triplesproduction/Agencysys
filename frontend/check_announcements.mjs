
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTable() {
    const { data, error } = await supabase.from('announcements').select('*').limit(1);
    if (error) {
        console.error('Error fetching announcements:', error);
    } else {
        console.log('Sample announcement:', data[0]);
    }
}

checkTable();
