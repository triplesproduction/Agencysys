import { createClient } from '@supabase/supabase-js';

console.log("Script start");

const url = 'https://tslixoanxxkrzkjesxds.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';

const supabase = createClient(url, key);

async function run() {
    console.log("Inside run");
    const { data, error } = await supabase.from('employees').select('id').limit(1);
    console.log("Result:", data, error);
}

await run();
console.log("Script end");
