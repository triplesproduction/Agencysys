import { NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { EODSubmissionDTO } from '@/types/dto';

export async function GET() {
    try {
        const payload = {
            employeeId: 'dcac6bfe-9f0f-4c94-9ff3-a4fd599ce5c6',
            reportDate: new Date().toISOString(),
            tasksCompleted: ['Task 1'],
            tasksInProgress: [],
            blockers: 'None',
            sentiment: 'GOOD',
            workHours: 8,
            status: 'SUBMITTED'
        };
        const res = await api.submitEOD(payload as Partial<EODSubmissionDTO>);
        return NextResponse.json({ success: true, data: res });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
