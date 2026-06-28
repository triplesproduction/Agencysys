import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://tslixoanxxkrzkjesxds.supabase.co';
const supabaseKey = 'sb_publishable_3xqOuMALUPne-NmLo7r8Fw_u13qp5fb';

const supabase = createClient(supabaseUrl, supabaseKey);

async function upload() {
    const filePath = '/Users/suansh/Agency Software/TripleS OS/desktop-agent/src-tauri/target/release/bundle/dmg/TripleS OS_1.1.1_aarch64.dmg';
    
    if (!fs.existsSync(filePath)) {
        console.error('Error: DMG file does not exist at ' + filePath);
        process.exit(1);
    }

    console.log('Reading file...');
    const fileBuffer = fs.readFileSync(filePath);

    console.log('Uploading DMG to Supabase Storage bucket "installers" inside "TripleS-Agent-1.0.0.dmg"...');
    
    const { data, error } = await supabase.storage
        .from('installers')
        .upload('TripleS-Agent-1.0.0.dmg', fileBuffer, {
            contentType: 'application/octet-stream',
            upsert: true
        });

    if (error) {
        console.error('Upload failed:', error.message);
        process.exit(1);
    }

    console.log('Upload successful! Path:', data.path);
}

upload();
