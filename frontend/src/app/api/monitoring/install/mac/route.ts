import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
        return new NextResponse('Error: Missing server configuration', { status: 500 });
    }

    const downloadUrl = `${supabaseUrl}/storage/v1/object/public/installers/TripleS-Agent-1.0.0.dmg`;

    const script = `#!/bin/bash
# TripleS OS - Mac Automated Installer
# This script bypasses the Gatekeeper "damaged app" error by downloading and installing directly without quarantine.

echo "==============================================="
echo "   TripleS OS Automated Installer for macOS"
echo "==============================================="
echo ""
echo "Step 1: Downloading the latest DMG..."
curl -L -q --progress-bar -o /tmp/TripleS-Agent.dmg "${downloadUrl}"

echo "Step 2: Mounting the disk image..."
hdiutil attach /tmp/TripleS-Agent.dmg -nobrowse -mountpoint /Volumes/TripleS-Agent -quiet

echo "Step 3: Installing TripleS OS to Applications..."
# Remove old version if it exists
if [ -d "/Applications/TripleS OS.app" ]; then
    rm -rf "/Applications/TripleS OS.app"
fi
cp -R "/Volumes/TripleS-Agent/TripleS OS.app" /Applications/

echo "Step 4: Fixing macOS security permissions (removing quarantine)..."
xattr -cr "/Applications/TripleS OS.app" 2>/dev/null

echo "Step 5: Cleaning up..."
hdiutil detach /Volumes/TripleS-Agent -quiet
rm -f /tmp/TripleS-Agent.dmg

echo ""
echo "✅ Installation Complete!"
echo "You can now open 'TripleS OS' from your Applications folder or Launchpad."
echo "No 'damaged' errors will appear."
echo "==============================================="
`;

    return new NextResponse(script, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        }
    });
}

export const dynamic = 'force-dynamic';
