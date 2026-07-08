import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// TripleS OS — Tauri Auto-Update Manifest Endpoint
// ============================================================
// This endpoint returns the update manifest consumed by
// tauri-plugin-updater. Tauri calls this URL on startup and
// compares the advertised version against the running version.
//
// HOW TO RELEASE A NEW VERSION:
// 1. Bump `version` in tauri.conf.json AND the CURRENT_VERSION
//    constant below to the same new value (e.g. "1.1.0").
// 2. Build the release: cargo tauri build
//    (set env TAURI_SIGNING_PRIVATE_KEY before building)
// 3. Upload the .dmg and .exe to Supabase Storage under
//    the `installers/` bucket.
// 4. Sign each binary:
//    npx @tauri-apps/cli signer sign <file.dmg> -k /path/to/private.key
//    Copy the output .sig contents into MAC_SIGNATURE below.
//    Do the same for the .exe into WINDOWS_SIGNATURE below.
// 5. Deploy the updated frontend — the app will auto-update on
//    next launch.
// ============================================================

// ---- RELEASE CONFIGURATION (edit these on each release) ----

const CURRENT_VERSION = '1.1.1';

// Publication date in RFC 3339 format
const PUB_DATE = '2026-06-27T00:00:00Z';

// Release notes (supports markdown)
const RELEASE_NOTES = `## TripleS OS v${CURRENT_VERSION}

- Tracking system improvements: accurate time recording
- Fixed timer restoration after app restart
- Fixed app/website tracking to record continuously
- Fixed sync pipeline: individual event failures no longer block the batch
- Performance and stability improvements`;

// Supabase Storage base URL (server-side only)
const STORAGE_BASE = process.env.SUPABASE_STORAGE_BASE_URL
    || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/installers`;

// macOS binary path in Supabase Storage
const MAC_BINARY_PATH = `TripleS-Agent-${CURRENT_VERSION}.app.tar.gz`;

// Windows binary path in Supabase Storage
const WINDOWS_BINARY_PATH = `TripleS-Agent-${CURRENT_VERSION}-x64-setup.nsis.zip`;

// !! IMPORTANT: Replace these with the actual .sig file contents after each build !!
// To generate: npx @tauri-apps/cli signer sign <binary> -k $TAURI_SIGNING_PRIVATE_KEY_PATH
// The signature is the full base64 string output by the signer command.
const MAC_SIGNATURE = process.env.TAURI_MAC_SIGNATURE || '';
const WINDOWS_SIGNATURE = process.env.TAURI_WINDOWS_SIGNATURE || '';

// ---- END RELEASE CONFIGURATION ----

export async function GET(req: NextRequest) {
    // Tauri's updater plugin passes the current version and platform in the request.
    // We can use these to serve platform-specific responses if needed.
    const userAgent = req.headers.get('user-agent') || '';
    
    // Determine if either signature is ready
    const macReady = MAC_SIGNATURE.length > 0;
    const windowsReady = WINDOWS_SIGNATURE.length > 0;

    // Build the platforms map — only include platforms with valid signatures.
    // Tauri will ignore platforms not in the response.
    const platforms: Record<string, { signature: string; url: string }> = {};

    if (macReady) {
        // darwin-aarch64: Apple Silicon Macs
        platforms['darwin-aarch64'] = {
            signature: MAC_SIGNATURE,
            url: `${STORAGE_BASE}/${MAC_BINARY_PATH}`
        };
        // darwin-x86_64: Intel Macs
        platforms['darwin-x86_64'] = {
            signature: MAC_SIGNATURE,
            url: `${STORAGE_BASE}/${MAC_BINARY_PATH}`
        };
    }

    if (windowsReady) {
        platforms['windows-x86_64'] = {
            signature: WINDOWS_SIGNATURE,
            url: `${STORAGE_BASE}/${WINDOWS_BINARY_PATH}`
        };
    }

    // If no platforms are configured yet, return 204 No Content so Tauri
    // treats this as "no update available" without throwing an error.
    if (Object.keys(platforms).length === 0) {
        return new NextResponse(null, { status: 204 });
    }

    // The Tauri v2 updater manifest format
    const manifest = {
        version: CURRENT_VERSION,
        pub_date: PUB_DATE,
        notes: RELEASE_NOTES,
        platforms
    };

    return NextResponse.json(manifest, {
        headers: {
            // Allow Tauri desktop client to fetch this
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
    });
}

export const dynamic = 'force-dynamic';
