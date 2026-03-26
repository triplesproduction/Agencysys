'use client';

import { useState } from 'react';
import GlassCard from '@/components/GlassCard';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { api } from '@/lib/api';
import { setAuthToken, getAuthToken } from '@/lib/auth';
import './TestSuite.css';

export default function TestSuitePage() {
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const runTest = async (testName: string, action: () => Promise<any>) => {
        setLoading(true);
        try {
            const res = await action();
            setResult({ name: testName, status: 'SUCCESS', data: res });
        } catch (err: any) {
            setResult({ name: testName, status: 'FAILED', error: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="test-suite-page fade-in">
            <header className="page-header">
                <div>
                    <h1 className="greeting">Functional Test Harness</h1>
                    <p className="subtitle">Execute backend tests directly from the UI to validate mapping and RBAC.</p>
                </div>
            </header>

            <div className="test-grid">
                <GlassCard className="test-card">
                    <h3 className="section-title">Auth Lifecycle</h3>
                    <div className="test-actions">
                        <Button
                            onClick={() => runTest('Test Login (Auth)', async () => {
                                const res = await fetch('http://localhost:3001/api/v1/auth/test-login', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ employeeId: 'admin-uuid-001', roleId: 'ADMIN' })
                                }).then(r => r.json());
                                if (res.access_token) {
                                    setAuthToken(res.access_token);
                                }
                                return res;
                            })}
                        >
                            Execute Test Login
                        </Button>
                        <div className="text-sm mt-2 opacity-70">
                            Current Token state: {getAuthToken() ? "Active" : "None"}
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="test-card">
                    <h3 className="section-title">Employee Flow</h3>
                    <div className="test-actions">
                        <Button
                            onClick={() => runTest('Create Employee', () => api.createEmployee({
                                firstName: 'Test',
                                lastName: 'User',
                                email: 'test@triples.os',
                                roleId: 'EMPLOYEE',
                                status: 'ACTIVE'
                            }))}
                        >
                            Test Create Employee
                        </Button>
                        <Button variant="secondary" onClick={() => runTest('Fetch Employees', () => api.getEmployees())}>
                            Fetch All Employees
                        </Button>
                    </div>
                </GlassCard>

                <GlassCard className="test-card">
                    <h3 className="section-title">Task Lifecycle</h3>
                    <div className="test-actions">
                        <Button
                            onClick={() => runTest('Create Task', () => api.createTask({
                                title: 'Automated CI Task',
                                description: 'Test creating a task from UI',
                                assigneeId: 'admin-uuid-001',
                                creatorId: 'admin-uuid-001',
                                status: 'TODO',
                                priority: 'HIGH',
                                dueDate: new Date().toISOString()
                            }))}
                        >
                            Test Create Task
                        </Button>
                    </div>
                </GlassCard>
            </div>

            <GlassCard className="console-card">
                <h3 className="section-title">Test Results Output</h3>
                {loading && <div className="spinner-small"></div>}
                {!loading && result && (
                    <div className={`result-box ${result.status.toLowerCase()}`}>
                        <strong>[{result.status}] {result.name}</strong>
                        <pre>{JSON.stringify(result.data || result.error, null, 2)}</pre>
                    </div>
                )}
                {!loading && !result && <p className="empty-state">No tests executed yet.</p>}
            </GlassCard>
        </div>
    );
}
