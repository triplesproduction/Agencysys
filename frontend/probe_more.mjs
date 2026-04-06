import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeRemainingColumns() {
    const testData = {
        inProgressText: '[]',
        tasksInProgress: ['test'],
        report_date: new Date().toISOString(), // maybe snake_case?
        submitted_at: new Date().toISOString(), // maybe snake_case?
        employee_id: '00000000-0000-0000-0000-000000000000', // maybe snake_case?
    };
    
    for (const key of Object.keys(testData)) {
        const { error } = await supabase.from('eod_reports').insert([{ [key]: testData[key] }]);
        if (error) {
            if (error.message.includes('Could not find the')) {
                console.log(`Column '${key}' check: MISSING`);
            } else {
                console.log(`Column '${key}' check: EXISTS (Failed on: ${error.message})`);
            }
        } else {
            console.log(`Column '${key}' check: PASS`);
        }
    }
}

probeRemainingColumns();
