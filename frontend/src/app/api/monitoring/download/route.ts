import { NextRequest, NextResponse } from 'next/server';

// Platform-specific download paths — served via a signed URL via this API endpoint.
// NEVER expose raw Supabase storage URLs directly in client HTML.
const DOWNLOAD_PATHS: Record<string, string> = {
    mac: 'installers/TripleS-Agent-1.1.3.dmg',
    windows: 'installers/TripleS-Agent-1.1.3.exe',
};

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform') as 'mac' | 'windows' | null;

    if (!platform || !DOWNLOAD_PATHS[platform]) {
        return NextResponse.json({ error: 'Invalid platform. Use ?platform=mac or ?platform=windows' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Build the storage URL server-side and issue a 302 redirect.
    // The client HTML/JS never sees the raw storage URL — only the API path.
    const storagePath = DOWNLOAD_PATHS[platform];
    const storageUrl = `${supabaseUrl}/storage/v1/object/public/${storagePath}`;

    return NextResponse.redirect(storageUrl, { status: 302 });
}

export const dynamic = 'force-dynamic';
