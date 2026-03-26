'use client';

import { useEffect, useState } from 'react';
import GlassCard from '@/components/GlassCard';
import { api } from '@/lib/api';
import { KPIMetricDTO } from '@/types/dto';
import { getUserFromToken } from '@/lib/auth';
import { TrendingUp, Target, Award, Calendar, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function KPIsPage() {
    const [kpis, setKpis] = useState<KPIMetricDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchKPIs() {
            try {
                const user = getUserFromToken();
                const userId = user?.sub || user?.employeeId;
                if (!userId) {
                    setError('Unable to identify current user.');
                    return;
                }

                const data = await api.getEmployeeKPIs(userId);
                setKpis(data || []);
            } catch (err: any) {
                console.error('Failed to fetch KPIs:', err);
                setError(err.message || 'Failed to load performance metrics.');
            } finally {
                setLoading(false);
            }
        }

        fetchKPIs();
    }, []);

    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

    return (
        <div className="kpi-page fade-in" style={{ padding: '2rem' }}>
            <header className="page-header" style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--purple-main)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, marginBottom: '12px' }}>
                        <ArrowLeft size={16} /> Back to Dashboard
                    </Link>
                    <h1 className="greeting">Performance Metrics</h1>
                    <p className="subtitle">Track your growth and mission objectives.</p>
                </div>
                <GlassCard style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'rgba(124, 58, 237, 0.15)', padding: '10px', borderRadius: '12px' }}>
                        <Award size={24} color="var(--purple-main)" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Performance</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>
                            {kpis.length > 0 ? (kpis.reduce((acc, curr) => acc + curr.currentValue, 0) / kpis.length).toFixed(1) : '0'}/100
                        </div>
                    </div>
                </GlassCard>
            </header>

            {error ? (
                <GlassCard style={{ padding: '3rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <AlertCircle size={48} color="#EF4444" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ color: 'white', marginBottom: '8px' }}>Performance Snapshot Unavailable</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
                </GlassCard>
            ) : kpis.length === 0 ? (
                <GlassCard style={{ padding: '4rem', textAlign: 'center' }}>
                    <Target size={64} color="rgba(255, 255, 255, 0.1)" style={{ marginBottom: '1.5rem' }} />
                    <h3 style={{ color: 'white', marginBottom: '8px' }}>No KPI Metrics Found</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                        Your performance targets haven't been configured by the admin council yet. Continue your excellence in the meantime!
                    </p>
                </GlassCard>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                    {kpis.map(kpi => (
                        <GlassCard key={kpi.id} style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{kpi.metricName}</h3>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--purple-accent)', fontWeight: 600, textTransform: 'uppercase' }}>{kpi.period} Target</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#8B5CF6' }}>{kpi.currentValue}%</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Goal: {kpi.targetValue}%</div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div style={{ background: 'rgba(255, 255, 255, 0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                                <div style={{
                                    width: `${Math.min(100, (kpi.currentValue / kpi.targetValue) * 100)}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #7C3AED, #A78BFA)',
                                    boxShadow: '0 0 10px rgba(124, 58, 237, 0.5)'
                                }}></div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={14} />
                                    Last Updated: {new Date(kpi.lastUpdated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </div>
                                <TrendingUp size={18} color={kpi.currentValue >= kpi.targetValue ? '#10B981' : '#F59E0B'} />
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}

            <style jsx>{`
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(124, 58, 237, 0.1);
                    border-radius: 50%;
                    border-top-color: var(--purple-main);
                    animation: spin 1s ease-in-out infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
