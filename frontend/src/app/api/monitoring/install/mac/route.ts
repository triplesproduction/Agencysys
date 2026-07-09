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
# Detach any existing mounts from previous failed attempts
hdiutil detach "/Volumes/TripleS OS" -force -quiet 2>/dev/null || true
hdiutil detach "/Volumes/TripleS-Agent" -force -quiet 2>/dev/null || true

# Mount and capture the mount point dynamically
MOUNT_INFO=$(hdiutil attach /tmp/TripleS-Agent.dmg -nobrowse -quiet)
MOUNT_POINT=$(echo "$MOUNT_INFO" | grep -o '/Volumes/.*$')

if [ -z "\${MOUNT_POINT}" ]; then
    echo "❌ Error: Failed to mount disk image."
    exit 1
fi

echo "Step 3: Installing TripleS OS to Applications..."
if [ -d "/Applications/TripleS OS.app" ]; then
    rm -rf "/Applications/TripleS OS.app"
fi
cp -R "\${MOUNT_POINT}/TripleS OS.app" /Applications/

echo "Step 4: Fixing macOS security permissions (removing quarantine)..."
xattr -cr "/Applications/TripleS OS.app" 2>/dev/null

echo "Step 5: Cleaning up..."
hdiutil detach "\${MOUNT_POINT}" -force -quiet
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
