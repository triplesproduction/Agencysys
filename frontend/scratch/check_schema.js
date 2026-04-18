
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function checkSchema() {
    const env = fs.readFileSync('.env.local', 'utf8');
    const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
    const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];
    
    const supabase = createClient(url, key);
    
    const { data, error } = await supabase.from('tasks').select('*').limit(1);
    
    if (error) {
        console.error('Error fetching tasks:', error);
    } else {
        console.log('Task Columns:', Object.keys(data[0] || {}));
    }
}

checkSchema();
