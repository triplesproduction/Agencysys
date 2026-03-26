import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3001/api/v1';
        const res = await fetch(`${backendUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        let data;
        const text = await res.text();
        try { data = JSON.parse(text); } catch { data = { message: text }; }

        if (!res.ok) {
            return NextResponse.json({ error: data.message || 'Login failed' }, { status: res.status });
        }

        // Handle both standard JSON formats just in case
        const token = data.data?.access_token || data.access_token || data.token;
        const employee = data.data?.employee || data.employee;

        const response = NextResponse.json({ success: true, access_token: token, employee });

        if (token) {
            response.cookies.set('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 86400, // 1 day
            });
        }
        
        if (employee) {
            response.cookies.set('user_session', JSON.stringify({
                id: employee.id,
                roleId: employee.roleId,
                role: employee.roleId, // Fallback alias
                firstName: employee.firstName,
                lastName: employee.lastName,
                sub: employee.id // Fallback alias for older jwt decode
            }), {
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 86400,
            });
        }

        return response;
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
