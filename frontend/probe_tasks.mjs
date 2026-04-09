import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    const { data, error } = await supabase.from('tasks').select('*').limit(1);
    if (error) {
        console.error('Error fetching tasks:', error);
    } else if (data && data.length > 0) {
        console.log('Columns in tasks table:', Object.keys(data[0]));
    } else {
        const { data: cols, error: err2 } = await supabase.from('tasks').select('assigneeId').limit(1);
        if (err2) {
             console.log('tasks table might use assignee_id or be empty');
             const { data: cols2, error: err3 } = await supabase.from('tasks').select('assignee_id').limit(1);
             if (err3) {
                 console.log('Both assigneeId and assignee_id failed.');
             } else {
                 console.log('tasks table uses assignee_id');
             }
        } else {
            console.log('tasks table uses assigneeId');
        }
    }
}

probe();
