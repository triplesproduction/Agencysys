import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const logLine = `[${new Date().toISOString()}] ${body.type}\n`;
        fs.appendFileSync(path.join(process.cwd(), '.debug-log.txt'), logLine);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ success: false });
    }
}
