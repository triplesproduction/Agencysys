import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data, error } = await supabase.from('employees').select('*').limit(1);
console.log('Error:', error);
console.log('Columns:', data && data.length > 0 ? Object.keys(data[0]) : 'No data');
