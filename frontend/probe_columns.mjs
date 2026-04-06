import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getColumnNames() {
    // We can't query information_schema directly via anon key usually
    // But we can try to "peek" by inserting an empty object and seeing the error message,
    // OR we can try to query it if the user has a "read-only-columns" view.
    // Actually, one way to see columns of an empty table is to use RPC or if the client allows it.
    
    // Instead of querying columns, let's try a test insert with NO fields and see what the database complains about.
    // Or just try common names.
    
    console.log('--- Probing eod_reports columns by trial insert ---');
    // Try to insert mandatory fields and see what it says
    const { error } = await supabase.from('eod_reports').insert([{ reportDate: new Date().toISOString() }]);
    if (error) {
        console.log('Trial insert error:', error.message);
        // Sometimes the error message contains required columns
    }

    // Try a broad insert and see if it fails on data types
    const testData = {
        employeeId: '00000000-0000-0000-0000-000000000000',
        reportDate: new Date().toISOString(),
        tasksCompleted: ['test'],
        completedText: '["test"]',
        sentiment: 'GOOD'
    };
    
    for (const key of Object.keys(testData)) {
        const { error } = await supabase.from('eod_reports').insert([{ [key]: testData[key] }]);
        if (error) {
            console.log(`Column '${key}' check: FAIL - ${error.message}`);
        } else {
            console.log(`Column '${key}' check: PASS (or exists)`);
        }
    }
}

getColumnNames();
