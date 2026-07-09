#!/bin/bash
# =============================================================================
# TripleS OS — Auto-Update Release Script
# =============================================================================
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.1.0
#
# This script:
#   1. Bumps the version in tauri.conf.json and the update route
#   2. Builds the Tauri app (macOS + Windows if cross-compiling)
#   3. Signs the binaries
#   4. Uploads the binaries to Supabase Storage
#   5. Updates TAURI_MAC_SIGNATURE and TAURI_WINDOWS_SIGNATURE in .env.local
#
# Prerequisites:
#   - TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH must be set
#   - Supabase CLI authenticated: npx supabase login
#   - cargo tauri installed: cargo install tauri-cli
# =============================================================================

set -e

VERSION="$1"
if [ -z "$VERSION" ]; then
    echo "❌ Usage: ./scripts/release.sh <version>"
    echo "   Example: ./scripts/release.sh 1.1.0"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DESKTOP_DIR="$ROOT_DIR/desktop-agent"
FRONTEND_DIR="$ROOT_DIR/frontend"
TAURI_CONF="$DESKTOP_DIR/src-tauri/tauri.conf.json"
UPDATE_ROUTE="$FRONTEND_DIR/src/app/api/desktop-agent/update/route.ts"
ENV_LOCAL="$FRONTEND_DIR/.env.local"

echo ""
echo "🚀 TripleS OS Release — v$VERSION"
echo "======================================="

# ---- Step 1: Bump version ----
echo ""
echo "📝 Step 1: Bumping version to v$VERSION..."

# Update tauri.conf.json version
sed -i '' "s/\"version\": \"[0-9.]*\"/\"version\": \"$VERSION\"/" "$TAURI_CONF"
echo "   ✅ tauri.conf.json → v$VERSION"

# Update the update route's CURRENT_VERSION
sed -i '' "s/const CURRENT_VERSION = '[0-9.]*'/const CURRENT_VERSION = '$VERSION'/" "$UPDATE_ROUTE"
echo "   ✅ update/route.ts → CURRENT_VERSION = '$VERSION'"

# ---- Step 2: Build the app ----
echo ""
echo "🔨 Step 2: Building Tauri app..."
cd "$DESKTOP_DIR"

# Export signing key for build
if [ -z "$TAURI_SIGNING_PRIVATE_KEY" ] && [ -f "$ENV_LOCAL" ]; then
    export TAURI_SIGNING_PRIVATE_KEY=$(grep "^TAURI_SIGNING_PRIVATE_KEY=" "$ENV_LOCAL" | cut -d'=' -f2-)
    export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=$(grep "^TAURI_SIGNING_PRIVATE_KEY_PASSWORD=" "$ENV_LOCAL" | cut -d'=' -f2-)
fi

export TRIPLES_API_BASE_URL="https://triplesproduction.com"

npm run tauri build 2>&1
echo "   ✅ Build complete"

# ---- Step 3: Sign the binaries and get signatures ----
echo ""
echo "🔏 Step 3: Signing binaries..."

# macOS: Find the .app.tar.gz
MAC_BINARY=$(find "$DESKTOP_DIR/src-tauri/target/release/bundle/macos" -name "*.app.tar.gz" 2>/dev/null | head -1)
if [ -n "$MAC_BINARY" ]; then
    echo "   Found macOS binary: $(basename "$MAC_BINARY")"
    MAC_SIG_OUTPUT=$(npx @tauri-apps/cli signer sign "$MAC_BINARY" --private-key "$TAURI_SIGNING_PRIVATE_KEY" 2>&1)
    # Extract the signature content (the .sig file)
    MAC_SIG_FILE="${MAC_BINARY}.sig"
    if [ -f "$MAC_SIG_FILE" ]; then
        MAC_SIGNATURE=$(cat "$MAC_SIG_FILE")
        echo "   ✅ macOS binary signed"
    else
        echo "   ⚠️  macOS .sig file not found at expected path"
    fi
fi

# Windows: Find the .nsis.zip
WIN_BINARY=$(find "$DESKTOP_DIR/src-tauri/target/release/bundle/nsis" -name "*.nsis.zip" 2>/dev/null | head -1)
if [ -n "$WIN_BINARY" ]; then
    echo "   Found Windows binary: $(basename "$WIN_BINARY")"
    WIN_SIG_OUTPUT=$(npx @tauri-apps/cli signer sign "$WIN_BINARY" --private-key "$TAURI_SIGNING_PRIVATE_KEY" 2>&1)
    WIN_SIG_FILE="${WIN_BINARY}.sig"
    if [ -f "$WIN_SIG_FILE" ]; then
        WIN_SIGNATURE=$(cat "$WIN_SIG_FILE")
        echo "   ✅ Windows binary signed"
    else
        echo "   ⚠️  Windows .sig file not found at expected path"
    fi
fi

# ---- Step 4: Upload to Supabase Storage ----
echo ""
echo "☁️  Step 4: Uploading binaries to Supabase Storage..."

SUPABASE_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$ENV_LOCAL" | cut -d'=' -f2-)
SUPABASE_ANON_KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" "$ENV_LOCAL" | cut -d'=' -f2-)

if [ -n "$MAC_BINARY" ]; then
    MAC_FILENAME="TripleS-Agent-${VERSION}.app.tar.gz"
    curl -s -X PUT \
        "${SUPABASE_URL}/storage/v1/object/installers/${MAC_FILENAME}" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/octet-stream" \
        --data-binary "@$MAC_BINARY" > /dev/null
    echo "   ✅ macOS binary uploaded: $MAC_FILENAME"
fi

if [ -n "$WIN_BINARY" ]; then
    WIN_FILENAME="TripleS-Agent-${VERSION}-x64-setup.nsis.zip"
    curl -s -X PUT \
        "${SUPABASE_URL}/storage/v1/object/installers/${WIN_FILENAME}" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/octet-stream" \
        --data-binary "@$WIN_BINARY" > /dev/null
    echo "   ✅ Windows binary uploaded: $WIN_FILENAME"
fi

# ---- Step 5: Update env signatures ----
echo ""
echo "🔑 Step 5: Updating signature env vars..."

update_env_var() {
    local KEY="$1"
    local VAL="$2"
    local FILE="$3"
    if grep -q "^${KEY}=" "$FILE"; then
        sed -i '' "s|^${KEY}=.*|${KEY}=${VAL}|" "$FILE"
    else
        echo "${KEY}=${VAL}" >> "$FILE"
    fi
}

if [ -n "$MAC_SIGNATURE" ]; then
    update_env_var "TAURI_MAC_SIGNATURE" "$MAC_SIGNATURE" "$ENV_LOCAL"
    echo "   ✅ TAURI_MAC_SIGNATURE updated in .env.local"
fi

if [ -n "$WIN_SIGNATURE" ]; then
    update_env_var "TAURI_WINDOWS_SIGNATURE" "$WIN_SIGNATURE" "$ENV_LOCAL"
    echo "   ✅ TAURI_WINDOWS_SIGNATURE updated in .env.local"
fi

echo ""
echo "======================================="
echo "✅ Release v$VERSION complete!"
echo ""
echo "Next steps:"
echo "  1. Deploy the frontend: npm run build && deploy"
echo "     (The /api/desktop-agent/update endpoint will serve the new manifest)"
echo "  2. Users will be automatically prompted to update on next app launch"
echo "======================================="
