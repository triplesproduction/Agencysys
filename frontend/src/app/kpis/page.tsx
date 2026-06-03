'use client';

import { PageHeader } from '@/components/common/PageHeader';

import { useEffect, useState } from 'react';
import GlassCard from '@/components/GlassCard';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { TrendingUp, Target, Award, Calendar, AlertCircle, ArrowLeft, Clock, CheckSquare, Coffee } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function KPIsPage() {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

    useEffect(() => {
        async function fetchKPIProfile() {
            if (!authEmployee) {
                if (!authLoading) {
                    setError('Unable to identify current user. Please ensure you are logged in.');
                    setLoading(false);
                }
                return;
            }

            try {
                setLoading(true);
                const data = await api.getKpiProfile(authEmployee.id, selectedMonth);
                setProfile(data);
                setError(null);
            } catch (err: any) {
                logger.error('Error', 'Failed to fetch KPI profile:', err);
                setError(err.message || 'Failed to load performance metrics.');
            } finally {
                setLoading(false);
            }
        }

        if (!authLoading) {
            fetchKPIProfile();
        }
    }, [authEmployee, authLoading, selectedMonth]);

    const getGradeColor = (grade: string) => {
        if (grade?.includes('A')) return '#10B981';
        if (grade?.includes('B')) return '#8B5CF6';
        if (grade?.includes('C')) return '#F59E0B';
        return '#EF4444';
    };

    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

    return (
        <div className="kpi-page page-root fade-in">
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500, marginBottom: '8px', opacity: 0.8 }}>
                <ArrowLeft size={14} /> Back to Dashboard
            </Link>
            <PageHeader
                title="Performance Scorecard"
                subtitle={<p className="subtitle">Monthly performance vectors and mission efficiency.</p>}
                actions={
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <input 
                            type="month" 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="input-field"
                            style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                        />
                    </div>
                }
            />

            {!profile ? (
                <GlassCard style={{ padding: '4rem', textAlign: 'center' }}>
                    <Target size={64} color="rgba(255, 255, 255, 0.1)" style={{ marginBottom: '1.5rem' }} />
                    <h3 style={{ color: 'white', marginBottom: '8px' }}>No Data for {selectedMonth}</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                        Performance records for this month are not yet initialized. Continue your excellence!
                    </p>
                </GlassCard>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Main Score Card */}
                        <GlassCard style={{ padding: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(0,0,0,0) 100%)' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--purple-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Monthly Performance Index</div>
                                <div style={{ fontSize: '5rem', fontWeight: 900, color: 'white', margin: '1rem 0', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                                    {profile.current_score?.toFixed(1)}
                                    <span style={{ fontSize: '1.5rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/ 100</span>
                                </div>
                                <div style={{ 
                                    padding: '8px 20px', 
                                    background: `${getGradeColor(profile.grade)}20`, 
                                    color: getGradeColor(profile.grade),
                                    borderRadius: '30px',
                                    border: `1px solid ${getGradeColor(profile.grade)}40`,
                                    display: 'inline-block',
                                    fontWeight: 700,
                                    fontSize: '0.9rem'
                                }}>
                                    Current Grade: {profile.grade}
                                </div>
                            </div>
                            <div style={{ position: 'relative', width: '180px', height: '180px' }}>
                                <svg width="180" height="180" viewBox="0 0 180 180">
                                    <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                                    <circle cx="90" cy="90" r="80" fill="none" stroke="var(--purple-main)" strokeWidth="12" 
                                        strokeDasharray={`${(profile.current_score / 100) * 502.6} 502.6`} 
                                        strokeLinecap="round" transform="rotate(-90 90 90)" 
                                        style={{ filter: 'drop-shadow(0 0 8px var(--purple-main))' }}
                                    />
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <TrendingUp size={48} color="var(--purple-main)" />
                                </div>
                            </div>
                        </GlassCard>

                        {/* Metrics Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                            <GlassCard style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                                    <CheckSquare size={20} color="#10B981" />
                                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Task Velocity</span>
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>{profile.tasks_completed} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Done</span></div>
                                <div style={{ fontSize: '0.85rem', color: '#EF4444', marginTop: '8px' }}>{profile.tasks_late} Late submissions</div>
                            </GlassCard>

                            <GlassCard style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                                    <Clock size={20} color="var(--purple-main)" />
                                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Resource Hours</span>
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>{profile.total_hours_worked?.toFixed(1)} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Hrs</span></div>
                                <div style={{ fontSize: '0.85rem', color: '#F59E0B', marginTop: '8px' }}>{profile.late_login_count} Late check-ins</div>
                            </GlassCard>

                            <GlassCard style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                                    <Coffee size={20} color="#3B82F6" />
                                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Attendance</span>
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>{profile.leaves_taken} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Leaves</span></div>
                                <div style={{ fontSize: '0.85rem', color: '#3B82F6', marginTop: '8px' }}>{profile.unpaid_leaves} Unpaid periods</div>
                            </GlassCard>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <GlassCard style={{ padding: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Award size={18} color="var(--purple-main)" /> Efficiency Breakdown
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Baseline Score</span>
                                    <span style={{ fontWeight: 600 }}>50.0</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Efficiency Bonus</span>
                                    <span style={{ color: '#10B981', fontWeight: 600 }}>+{profile.extra_points?.toFixed(1)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Direct Awards</span>
                                    <span style={{ color: '#10B981', fontWeight: 600 }}>+{profile.bonus_points?.toFixed(1)}</span>
                                </div>
                                <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                    <span>Calculated Total</span>
                                    <span>{profile.current_score?.toFixed(1)}</span>
                                </div>
                            </div>
                        </GlassCard>

                        <GlassCard style={{ padding: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Target size={18} color="var(--purple-main)" /> Quality Standard
                            </h4>
                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white' }}>{profile.average_quality_rating || '0.0'}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Average Task Rating</div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '12px' }}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <div key={star} style={{ width: '8px', height: '8px', borderRadius: '50%', background: star <= (profile.average_quality_rating || 0) ? 'var(--purple-main)' : 'rgba(255,255,255,0.1)' }}></div>
                                    ))}
                                </div>
                            </div>
                        </GlassCard>
                    </div>
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
