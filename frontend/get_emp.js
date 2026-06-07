const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
let url, key;
envFile.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function run() {
    const { data: users, error } = await supabase.from('employees').select('*');
    if (error) {
        console.error("Error:", error);
        return;
    }
    console.log("All Users:");
    console.log(users.map(u => ({ id: u.id, first_name: u.first_name, last_name: u.last_name, firstName: u.firstName, email: u.email })));
}

run();
