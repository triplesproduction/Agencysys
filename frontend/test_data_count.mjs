import { createClient } from '@supabase/supabase-js';

const url = 'https://tslixoanxxkrzkjesxds.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';

const supabase = createClient(url, key);

async function run() {
    console.log("Fetching counts...");
    const [emp, tasks, leaves, eods] = await Promise.all([
        supabase.from('employees').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true }),
        supabase.from('leaves').select('*', { count: 'exact', head: true }),
        supabase.from('eods').select('*', { count: 'exact', head: true })
    ]);
    console.log("Employees:", emp.count);
    console.log("Tasks:", tasks.count);
    console.log("Leaves:", leaves.count);
    console.log("EODs:", eods.count);
}

run().catch(console.error);
