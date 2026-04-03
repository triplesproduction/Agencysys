import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('/Users/suansh/Agency Software/TripleS OS/frontend/.env.local', 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function run() {
    console.log("Fetching employees...");
    try {
        const { data, error, count } = await supabase.from('employees').select('*', { count: 'exact' }).range(0, 50);
        console.log("Employees Data length:", data?.length, "Error:", error);
    } catch (e) {
        console.error("Employees exception:", e);
    }

    console.log("Fetching leaves...");
    try {
        const { data, error } = await supabase.from('leaves').select('*, employee:employees!employeeId(*)').order('createdAt', { ascending: false });
        console.log("Leaves Error:", error);
    } catch (e) {
        console.error("Leaves exception:", e);
    }
}
run();
