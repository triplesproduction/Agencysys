const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function listFiles() {
  const { data, error } = await supabase.storage.from('installers').list();
  if (error) console.error("Error:", error);
  else console.log("Files:", data.map(f => f.name));
}
listFiles();
