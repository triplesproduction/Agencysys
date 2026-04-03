import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk';

const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false }});

async function run() {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@triples.os',
      password: 'TripleS@2024'
    });
    
    if (authError) {
      console.error('Auth error:', authError.message);
      return;
    }
    
    console.log('Logged in... Fetching employees...');
    
    // Simulate what the UI does
    let query = supabase.from('employees').select('*', { count: 'exact' });
    query = query.order('firstName', { ascending: true });
    
    // pagination mimicking UI
    query = query.range(0, 49);
    
    const { data, error, count } = await query;
    if (error) {
      console.error('Fetch error:', error);
    } else {
      console.log('Fetched employees:', data?.length, 'Count:', count);
    }
    const { data: leavesData, error: leavesError } = await supabase.from('leaves').select('*, employee:employees!employeeId(*)').order('createdAt', { ascending: false });
    if (leavesError) {
      console.error('Leaves fetch error:', leavesError);
    } else {
      console.log('Fetched leaves:', leavesData?.length);
    }
  } catch (err) {
    console.error('Uncaught', err);
  }
}
run();
