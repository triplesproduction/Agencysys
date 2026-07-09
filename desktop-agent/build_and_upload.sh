#!/bin/bash
set -e

ENV_LOCAL="/Users/suansh/Agency Software/TripleS OS/frontend/.env.local"
export TAURI_SIGNING_PRIVATE_KEY=$(grep "^TAURI_SIGNING_PRIVATE_KEY=" "$ENV_LOCAL" | cut -d'=' -f2-)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=$(grep "^TAURI_SIGNING_PRIVATE_KEY_PASSWORD=" "$ENV_LOCAL" | cut -d'=' -f2-)
export TRIPLES_API_BASE_URL="https://triplesproduction.com"

cd "/Users/suansh/Agency Software/TripleS OS/desktop-agent"

echo "Building macOS DMG..."
npm run tauri build

echo "Building Windows EXE..."
npm run tauri build -- --target x86_64-pc-windows-gnu

SUPABASE_URL="https://tslixoanxxkrzkjesxds.supabase.co"
JWT_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbGl4b2FueHhrcnpramVzeGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTAxMjEsImV4cCI6MjA5MDE2NjEyMX0.S9z0GbmDfyO_nxoLtkxjhQpXl-CIo8lS_AQWiZyJRQk"

MAC_BUILD="./src-tauri/target/release/bundle/dmg/TripleS OS_1.1.1_aarch64.dmg"
WIN_BUILD="./src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/TripleS OS_1.1.1_x64-setup.exe"

echo "Uploading macOS build..."
curl -i -X PUT \
  "${SUPABASE_URL}/storage/v1/object/installers/TripleS-Agent-1.0.0.dmg" \
  -H "Authorization: Bearer ${JWT_ANON_KEY}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@${MAC_BUILD}"

echo "Uploading Windows build..."
curl -i -X PUT \
  "${SUPABASE_URL}/storage/v1/object/installers/TripleS-Agent-1.0.0.exe" \
  -H "Authorization: Bearer ${JWT_ANON_KEY}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@${WIN_BUILD}"

echo "All builds uploaded successfully!"
