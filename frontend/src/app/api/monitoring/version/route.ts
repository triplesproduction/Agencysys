import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        version: '1.0.0',
        // Download URL served via API — never expose raw storage paths
        url: '/api/monitoring/download?platform=mac',
        notes: 'Initial production-grade release.'
    });
}
