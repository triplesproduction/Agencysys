const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Delete Company Announcements and Operations Group
    const { error: err1 } = await supabase.from('conversations').delete().eq('type', 'COMPANY');
    if (err1) console.error("Error deleting company group:", err1);
    
    const { error: err2 } = await supabase.from('conversations').delete().eq('name', 'Operations Group');
    if (err2) console.error("Error deleting ops group:", err2);

    // Delete existing Development Group if exists
    await supabase.from('conversations').delete().eq('name', 'Development Group');

    // Create Development Group
    const { data: devConv, error: err3 } = await supabase.from('conversations').insert({
        type: 'DEPARTMENT',
        name: 'Development Group',
        department: 'Development'
    }).select().single();

    if (err3) {
        console.error("Error creating dev group:", err3);
    } else {
        console.log("Dev group created with ID:", devConv.id);
        
        // Add all Development employees to the group
        const { data: devs, error: err4 } = await supabase.from('employees').select('id').eq('department', 'Development');
        if (!err4 && devs) {
            const participants = devs.map(d => ({ conversation_id: devConv.id, user_id: d.id }));
            const { error: err5 } = await supabase.from('conversation_participants').insert(participants);
            if (err5) console.error("Error adding dev participants:", err5);
            else console.log("Added dev participants.");
        }
    }
}
run();
