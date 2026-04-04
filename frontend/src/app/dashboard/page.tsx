'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GlassCard from '@/components/GlassCard';
import DeadlineIndicator from '@/components/DeadlineIndicator';
import { api } from '@/lib/api';
import { EmployeeDTO, TaskDTO, WorkHourLogDTO } from '@/types/dto';
import { Activity, ChevronRight, Plus, MessageCircle, Bell, Users, CheckSquare, AlertTriangle, Search, Zap } from 'lucide-react';
import AdminAssignTaskModal from '@/components/tasks/AdminAssignTaskModal';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import AnnouncementsWidget from '@/components/dashboard/AnnouncementsWidget';
import RulesWidget from '@/components/dashboard/RulesWidget';
import { useAuth } from '@/context/AuthContext';
import KpiAuditLedger from '@/components/kpi/KpiAuditLedger';
import RecentMessagesWidget from '@/components/dashboard/RecentMessagesWidget';
import WorkClock from '@/components/dashboard/WorkClock';

import './Dashboard.css';

// ADMIN DASHBOARD (V2 - High Fidelity Dribbble Layout)
// ---------------------------------------------------------------------------
function AdminDashboard({
    employee,
    tasks = [],
    totalEmployees,
    onAssignTaskTrigger,
    recentEods = [],
    teamKpis = [],
    recentKpiLogs = []
}: {
    employee: any,
    tasks?: TaskDTO[],
    kpis: any,
    totalEmployees: number,
    onAssignTaskTrigger: () => void,
    kanbanRefresh: number,
    recentEods?: any[],
    teamKpis?: any[],
    recentKpiLogs?: any[]
}) {
    const taskList = tasks || [];
    const eodList = recentEods || [];
    const kpiList = teamKpis || [];
    const kpiLogList = recentKpiLogs || [];

    const activeTasksCount = taskList.filter((t: any) => t && t.status !== 'DONE').length;
    
    // Improved role/name fallback for instant display
    const adminName = employee?.firstName || 'Admin';
    const adminRole = employee?.roleId || 'Administrator';

    const avgTeamScore = kpiList.length > 0
        ? (kpiList.reduce((acc: number, curr: any) => acc + (curr.current_score || 0), 0) / kpiList.length).toFixed(1)
        : '0.0';

    return (
        <div className="admin-dash-v2 fade-in">
            {/* Custom Admin Header */}
            <header className="ad2-header">
                <div className="ad2-header-left">
                    <div className="ad2-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                </div>
                <div className="ad2-header-center">
                    <div className="ad2-search-bar">
                        <Search size={16} />
                        <input type="text" placeholder="Search tasks, employees..." />
                    </div>
                </div>
                <div className="ad2-header-right">
                    <div className="ad2-icon-btn" onClick={() => window.location.href = '/messaging'}><MessageCircle size={18} /></div>
                    <div className="ad2-icon-btn"><Bell size={18} /></div>
                    <div className="ad2-user-profile">
                        <img 
                            src={employee?.profilePhoto || "https://i.pravatar.cc/150?img=11"} 
                            alt="Admin" 
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', background: 'var(--glass-bg)' }} 
                        />
                        <div className="ad2-user-info">
                            <span className="ad2-user-name">{adminName}</span>
                            <span className="ad2-user-role">{adminRole}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Quick Stats - Enhanced fallback logic */}
            <div className="quick-stats" style={{ marginTop: '16px' }}>
                <GlassCard className="stat-card">
                    <div className="stat-label">Total Headcount</div>
                    <div className="stat-value">{totalEmployees || '...'}</div>
                </GlassCard>
                <GlassCard className="stat-card">
                    <div className="stat-label">Active Tasks</div>
                    <div className="stat-value">{activeTasksCount || '0'}</div>
                </GlassCard>
                <GlassCard className="stat-card">
                    <div className="stat-label">Tasks Pending Approval</div>
                    <div className="stat-value">{(tasks || []).filter(t => t && t.status === 'SUBMITTED').length}</div>
                </GlassCard>
                <Link href="/kpis" style={{ textDecoration: 'none' }}>
                    <GlassCard className="stat-card gradient-card hoverable">
                        <div className="stat-label">Avg Team Score</div>
                        <div className="stat-value purple-glow">
                            {avgTeamScore}/100
                        </div>
                    </GlassCard>
                </Link>
            </div>

            {/* Main Bento Grid */}
            <div className="ad2-bento-grid" style={{ marginTop: '32px' }}>

                {/* Column 1: System Quick Actions & EOD Summary */}
                <div className="ad2-col ad2-col-1">
                    <div className="ad2-card" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), transparent)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={18} color="var(--purple-main)" /> Command Center
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button className="ad2-btn-add" onClick={onAssignTaskTrigger} style={{ width: '100%', justifyContent: 'center', background: 'var(--purple-main)', border: 'none' }}>
                                <Plus size={16} /> New Task Assignment
                            </button>
                            <button className="ad2-btn-add" onClick={() => window.location.href = '/employees'} style={{ width: '100%', justifyContent: 'center' }}>
                                <Users size={16} /> Manage Employees
                            </button>
                            <button className="ad2-btn-add" onClick={() => window.location.href = '/messaging/broadcast'} style={{ width: '100%', justifyContent: 'center' }}>
                                <Bell size={16} /> Send Broadcast
                            </button>
                        </div>
                    </div>

                    <div className="ad2-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="ad2-card-header">
                            <h3>Pending EODs</h3>
                            <span className="ad2-badge">{eodList.length}</span>
                        </div>
                        <div className="ad2-task-list custom-scrollbar" style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                            {eodList.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No reports today yet.</p>
                            ) : (
                                eodList.map((eod: any) => {
                                    if (!eod) return null;
                                    return (
                                        <div key={eod.id} className="ad2-task-list-item">
                                            <img src={eod.employee?.profilePhoto || "https://i.pravatar.cc/150"} alt="E" style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                                <div className="ad2-tli-title" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>
                                                    {eod.employee?.firstName ? `${eod.employee.firstName} ${eod.employee.lastName || ''}` : 'Unknown Developer'}
                                                </div>
                                                <div className="ad2-tli-time">
                                                    {eod.submittedAt ? new Date(eod.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                                                </div>
                                            </div>
                                            <Link href={`/eod/${eod.id}`} className="ad2-circle-btn" style={{ flexShrink: 0 }}>
                                                <ChevronRight size={14} />
                                            </Link>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Performance Feed - REAL TIME TEAM KPI AUDIT */}
                    <div className="ad2-card custom-scrollbar" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'rgba(5, 5, 5, 0.4)', minHeight: '350px' }}>
                        <div className="ad2-card-header" style={{ marginBottom: '16px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Activity size={16} color="#10B981" /> Performance Feed
                            </h3>
                            <span className="ad2-badge">{kpiLogList.length}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {kpiLogList.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No recent KPI activity.</div>
                            ) : (
                                kpiLogList.map((log: any) => {
                                    if (!log) return null;
                                    return (
                                        <div key={log.id} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.03)', position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'white' }}>{log.employee?.firstName || 'User'} {log.employee?.lastName || ''}</span>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: log.points_change >= 0 ? '#10B981' : '#EF4444' }}>
                                                    {log.points_change >= 0 ? `+${log.points_change}` : log.points_change} PTS
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '4px' }}>{log.reason}</div>
                                            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} • {log.category}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 2: Tasks Requiring Action */}
                <div className="ad2-col ad2-col-2" style={{ gridColumn: 'span 2' }}>
                    <div className="ad2-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div className="ad2-card-header" style={{ marginBottom: '16px' }}>
                            <h3>Action Required: Submitted Tasks</h3>
                            <Link href="/tasks" style={{ fontSize: '0.8rem', color: '#A78BFA', textDecoration: 'none' }}>View All</Link>
                        </div>
                        <div className="ad2-calendar-grid custom-scrollbar" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {taskList.filter((t: any) => t && (t.status === 'SUBMITTED' || t.status === 'IN_PROGRESS')).length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                                    <CheckSquare size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                                    <p>All clear! No tasks await your review right now.</p>
                                </div>
                            ) : (
                                taskList.filter((t: any) => t && (t.status === 'SUBMITTED' || t.status === 'IN_PROGRESS')).map((task: any) => {
                                    if (!task) return null;
                                    const isSub = task.status === 'SUBMITTED';
                                    return (
                                        <div key={task.id} style={{
                                            background: isSub ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                                            border: `1px solid ${isSub ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
                                            borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</h4>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.75rem', background: isSub ? '#3B82F622' : '#A78BFA22', color: isSub ? '#60A5FA' : '#A78BFA', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{task.status}</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Assignee: {(task.assigneeId || 'System').slice(0, 6)}</span>
                                                </div>
                                            </div>
                                            <Link href={`/tasks/${task.id}`} style={{ textDecoration: 'none' }}>
                                                <button style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'white', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--glass-bg)'}
                                                >
                                                    {isSub ? 'Review & Grade' : 'View Task'}
                                                </button>
                                            </Link>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 4: Announcements & Leaderboard */}
                <div className="ad2-col ad2-col-4" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="ad2-card" style={{ padding: '20px' }}>
                        <AnnouncementsWidget maxItems={2} />
                    </div>

                    {/* Team Insights */}
                    <div className="ad2-card" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Zap size={16} color="#A78BFA" /> Top Performer
                        </h3>
                        {kpiList.length > 0 ? (
                            <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '20px' }}>
                                <img src={kpiList[0].employee?.profilePhoto || "https://i.pravatar.cc/150"} alt="Top" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #A78BFA', marginBottom: '10px' }} />
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>{kpiList[0].employee?.firstName} {kpiList[0].employee?.lastName}</div>
                                <div style={{ fontSize: '0.8rem', color: '#A78BFA' }}>Score: {kpiList[0].current_score} / 100</div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No performance data found for this month.</div>
                        )}

                        <div className="leaderboard-mini custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                            <h4 style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leaderboard</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {kpiList.slice(0, 3).map((profile: any, idx: number) => (
                                    <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                                        <span style={{ width: '18px', color: idx === 0 ? '#F59E0B' : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>#{idx + 1}</span>
                                        <div style={{ flex: 1, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.employee?.firstName} {profile.employee?.lastName}</div>
                                        <div style={{ color: '#A78BFA', fontWeight: 600 }}>{profile.current_score}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Danger Alerts for Admin - Safety First pass */}
                        {kpiList.filter((p: any) => p && p.grade === 'Danger Zone').length > 0 && (
                            <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                                <div style={{ color: '#EF4444', fontSize: '0.75rem', fontWeight: 800, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={12} /> CRITICAL ATTENTION
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'white' }}>
                                    {kpiList.filter((p: any) => p && p.grade === 'Danger Zone').length} members in Danger Zone
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

        </div>
    );
}

// ---------------------------------------------------------------------------
// MANAGER DASHBOARD
// ---------------------------------------------------------------------------
function ManagerDashboard({
    employee,
    tasks,
    teamKpis,
    recentKpiLogs
}: {
    employee: any,
    tasks: TaskDTO[],
    kpis: any,
    teamKpis: any[],
    recentKpiLogs: any[]
}) {
    const taskList = tasks || [];
    const teamSize = 6;
    const pendingCount = taskList.filter((t: any) => t && t.status !== 'DONE' && t.status !== 'APPROVED').length;
    const completedCount = taskList.filter((t: any) => t && (t.status === 'DONE' || t.status === 'APPROVED')).length;

    const priorityColor: Record<string, string> = { HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#10B981', CRITICAL: '#8B5CF6' };
    const statusStyle: Record<string, { bg: string; color: string }> = {
        APPROVED: { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
        DONE: { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
        IN_PROGRESS: { bg: 'rgba(139,92,246,0.15)', color: '#A78BFA' },
        SUBMITTED: { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA' },
        REJECTED: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
        TODO: { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' },
    };

    return (
        <div className="role-dashboard">
            <div className="quick-stats">
                <GlassCard className="stat-card">
                    <div className="stat-label">Team Members</div>
                    <div className="stat-value">{teamSize}</div>
                </GlassCard>
                <GlassCard className="stat-card">
                    <div className="stat-label">Tasks Pending</div>
                    <div className="stat-value">{pendingCount}</div>
                </GlassCard>
                <GlassCard className="stat-card">
                    <div className="stat-label">Tasks Completed</div>
                    <div className="stat-value">{completedCount}</div>
                </GlassCard>
                <Link href="/kpis" style={{ textDecoration: 'none' }}>
                    <GlassCard className="stat-card gradient-card hoverable">
                        <div className="stat-label">Team Perf. Snapshot</div>
                        <div className="stat-value">92.0</div>
                    </GlassCard>
                </Link>
            </div>

            <section className="dashboard-grid">
                <GlassCard className="main-panel" style={{ padding: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            Team Tasks
                            <span style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', color: '#A78BFA', fontWeight: 600 }}>{tasks.length}</span>
                        </h2>
                        <Link href="/tasks" style={{ fontSize: '0.8rem', color: '#A78BFA', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
                    </div>

                    {tasks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>✅</div>
                            <p style={{ margin: 0 }}>All clear — no pending tasks for now!</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {tasks.map(task => {
                                const sc = statusStyle[task.status] || statusStyle.TODO;
                                const pc = priorityColor[task.priority] || '#6B7280';
                                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE' && task.status !== 'APPROVED';
                                return (
                                    <div key={task.id} style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '12px', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)'}`, borderLeft: `3px solid ${isOverdue ? '#EF4444' : pc}`, padding: '14px 18px', transition: 'all 0.2s ease' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white', marginBottom: '8px', lineHeight: 1.4 }}>{task.title}</div>
                                                {task.description && (
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{task.description}</div>
                                                )}
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <span style={{ background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{task.status.replace('_', ' ')}</span>
                                                    <span style={{ background: `${pc}1A`, color: pc, padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 600 }}>{task.priority}</span>
                                                    {isOverdue && <span style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700 }}>⚠ Overdue</span>}
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>Assignee: {(task.assigneeId || 'System').slice(0, 8)}...</span>
                                                </div>
                                            </div>
                                            {task.dueDate && (
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Due</div>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: isOverdue ? '#EF4444' : 'rgba(255,255,255,0.55)' }}>
                                                        {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </GlassCard>

                <GlassCard className="side-panel">
                    <h2 className="panel-title">Project Blockers</h2>
                    <div className="log-list">
                        <div className="log-item" style={{ gridTemplateColumns: 'auto 1fr' }}>
                            <AlertTriangle size={16} color="#ef4444" />
                            <div className="log-desc" style={{ color: '#ef4444' }}>API Integration stalled waiting on client keys.</div>
                        </div>
                        <div className="log-item" style={{ gridTemplateColumns: 'auto 1fr' }}>
                            <AlertTriangle size={16} color="#f59e0b" />
                            <div className="log-desc">2 team members on leave today; capacity reduced.</div>
                        </div>
                    </div>

                    <h2 className="panel-title" style={{ marginTop: '2rem' }}>Latest Communication</h2>
                    <RecentMessagesWidget maxItems={3} />

                    <h2 className="panel-title" style={{ marginTop: '2.5rem' }}>Team EOD Status</h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        5/6 submitted yesterday.
                    </p>

                    {/* Live Feed: Announcements & Rules from DB */}
                    <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '28px', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                        <AnnouncementsWidget maxItems={3} />
                        <RulesWidget maxItems={3} />
                    </div>
                </GlassCard>
            </section>
        </div>
    );
}

// ---------------------------------------------------------------------------
// EMPLOYEE DASHBOARD (Redesigned)
// ---------------------------------------------------------------------------
function EmployeeDashboard({ employee, tasks, kpis, recentLogs }: { employee: any, tasks: TaskDTO[], kpis: any, recentLogs: WorkHourLogDTO[] }) {
    const taskList = tasks || [];
    const logsList = recentLogs || [];
    const pendingTasks = taskList.filter(t => t && t.status !== 'DONE' && t.status !== 'APPROVED');
    const kpiScore = kpis?.current_score ?? 50;
    const extraPoints = kpis?.extra_points ?? 0;
    const kpiGrade = kpis?.grade ?? '-';

    const priorityColor: Record<string, string> = { HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#10B981', CRITICAL: '#8B5CF6' };
    const statusStyle: Record<string, { bg: string; color: string }> = {
        APPROVED: { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
        DONE: { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
        IN_PROGRESS: { bg: 'rgba(139,92,246,0.15)', color: '#A78BFA' },
        SUBMITTED: { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA' },
        REJECTED: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
        TODO: { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' },
    };

    return (
        <div className="emp-dash">

            {/* ── STAT CARDS */}
            <div className="emp-dash-stats">
                {([
                    { href: '/kpis', icon: '🎯', label: 'KPI Score', val: `${kpiScore}/100${extraPoints > 0 ? ` (+${extraPoints} extra)` : ''}`, accent: '#8B5CF6', chip: kpiGrade },
                    { href: '/tasks', icon: '📋', label: 'Active Tasks', val: String(pendingTasks.length), accent: '#3B82F6', chip: 'Manage' },
                    { href: '/eod', icon: '📝', label: 'EOD Report', val: 'Pending', accent: '#F59E0B', chip: 'Submit' },
                    { href: '/leaves', icon: '🌴', label: 'Leave Balance', val: '0 left', accent: '#10B981', chip: 'Apply' },
                ] as const).map(s => (
                    <Link key={s.href} href={s.href} style={{ textDecoration: 'none', flex: 1 }}>
                        <div className="emp-stat-card" style={{ background: `linear-gradient(135deg,${s.accent}22,${s.accent}08)`, borderColor: `${s.accent}44` }}>
                            <span className="emp-stat-icon">{s.icon}</span>
                            <div style={{ flex: 1 }}>
                                <div className="emp-stat-label">{s.label}</div>
                                <div className="emp-stat-value">{s.val}</div>
                            </div>
                            <span className="emp-stat-chip" style={{ background: `${s.accent}25`, color: s.accent }}>{s.chip}</span>
                        </div>
                    </Link>
                ))}
            </div>

            {
                kpiGrade === 'Danger Zone' && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '12px', padding: '16px', marginBottom: '24px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                        <div>
                            <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '4px', color: '#fef2f2' }}>Performance Alert: Danger Zone</strong>
                            <p style={{ margin: 0, fontSize: '0.9rem' }}>Your KPI score has dropped critically low. Please focus on completing tasks on time to rebuild your score.</p>
                        </div>
                    </div>
                )
            }

            {/* ── MAIN GRID */}
            <div className="emp-dash-grid">

                {/* Left: Tasks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <GlassCard style={{ padding: '28px' }}>
                        {(() => {
                            const now = new Date();
                            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            const twoDaysAgoStart = new Date(todayStart);
                            twoDaysAgoStart.setDate(todayStart.getDate() - 2);

                            const filteredTasks = tasks.filter(task => {
                                if (!task || !task.dueDate) return false;
                                const dueDate = new Date(task.dueDate);
                                const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                                return dueDay >= twoDaysAgoStart && dueDay <= todayStart;
                            });

                            return (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            My Tasks &amp; Deadlines
                                            <span style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', color: '#A78BFA', fontWeight: 600 }}>{filteredTasks.length}</span>
                                        </h2>
                                        <Link href="/tasks" style={{ fontSize: '0.8rem', color: '#A78BFA', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
                                    </div>

                                    {filteredTasks.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-secondary)' }}>
                                            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>✅</div>
                                            <p style={{ margin: 0 }}>All clear — no pending tasks for the current period!</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {filteredTasks.map(task => {
                                                const sc = statusStyle[task.status] || statusStyle.TODO;
                                                const pc = priorityColor[task.priority] || '#6B7280';
                                                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE' && task.status !== 'APPROVED';
                                                return (
                                                    <div key={task.id} style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)'}`, borderLeft: `3px solid ${isOverdue ? '#EF4444' : pc}`, padding: '13px 16px', transition: 'background 0.18s' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'white', marginBottom: '7px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
                                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                    <span style={{ background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{task.status.replace('_', ' ')}</span>
                                                                    <span style={{ background: `${pc}1A`, color: pc, padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 600 }}>{task.priority}</span>
                                                                    {isOverdue && <span style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700 }}>⚠ Overdue</span>}
                                                                </div>
                                                            </div>
                                                            {task.dueDate && (
                                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                                    <DeadlineIndicator deadline={task.dueDate} status={task.status} />
                                                                    <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>
                                                                        {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </GlassCard>

                    {/* KPI Ledger takes up remaining space on the left side below tasks */}
                    {employee && <KpiAuditLedger employeeId={employee.id} />}
                </div>

                {/* Right: Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <GlassCard style={{ padding: '22px 24px' }}>
                        <h2 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: 'white' }}>📅 Daily Work Log</h2>
                        {recentLogs.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>No recent logs recorded.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {recentLogs.map((log: any) => (
                                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.82rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>{new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                        <span style={{ color: 'white', fontWeight: 600 }}>{log.hoursLogged}h</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </GlassCard>

                    <GlassCard style={{ padding: '0', border: 'none', background: 'transparent' }}>
                        {employee && <WorkClock employeeId={employee.id} />}
                    </GlassCard>

                    {/* Hours Progress Bar */}
                    <GlassCard style={{ padding: '22px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h2 style={{ margin: '0', fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>Monthly Pace</h2>
                            <span style={{ fontSize: '0.8rem', color: '#A78BFA', fontWeight: 700 }}>{kpis?.total_hours_worked || 0} / 160h</span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{ 
                                height: '100%', 
                                width: `${Math.min(100, ((kpis?.total_hours_worked || 0) / 160) * 100)}%`, 
                                background: 'linear-gradient(90deg, #8B5CF6, #D946EF)',
                                boxShadow: '0 0 10px rgba(139, 92, 246, 0.5)',
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}></div>
                        </div>
                        <p style={{ margin: '10px 0 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                            Target: 160 hours for full bonus eligibility.
                        </p>
                    </GlassCard>

                    <GlassCard style={{ padding: '22px 24px' }}>
                        <h2 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: 'white' }}>⚡ Quick Actions</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {([
                                { label: 'Submit EOD', href: '/eod', color: '#8B5CF6' },
                                { label: 'My Tasks', href: '/tasks', color: '#3B82F6' },
                                { label: 'Apply Leave', href: '/leaves', color: '#10B981' },
                                { label: 'Rulebook', href: '/rulebook', color: '#F59E0B' },
                            ] as const).map(a => (
                                <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
                                    <div style={{ background: `${a.color}14`, border: `1px solid ${a.color}30`, borderRadius: '10px', padding: '10px', color: a.color, fontSize: '0.8rem', fontWeight: 600, textAlign: 'center', transition: 'background 0.18s' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = `${a.color}28`)}
                                        onMouseLeave={e => (e.currentTarget.style.background = `${a.color}14`)}
                                    >{a.label}</div>
                                </Link>
                            ))}
                        </div>
                    </GlassCard>

                    <RecentMessagesWidget maxItems={2} />
                    <AnnouncementsWidget maxItems={2} />
                    <RulesWidget maxItems={2} />
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// MAIN LAYOUT WRAPPER
// ---------------------------------------------------------------------------

export default function DashboardPage() {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const [employee, setEmployee] = useState<EmployeeDTO | null>(null);
    const [tasks, setTasks] = useState<TaskDTO[]>([]);
    const [recentLogs, setRecentLogs] = useState<WorkHourLogDTO[]>([]);
    const [kpis, setKpis] = useState<any | null>(null);
    const [allKpis, setAllKpis] = useState<any[]>([]);
    const [recentKpiLogs, setRecentKpiLogs] = useState<any[]>([]);
    const [totalEmployees, setTotalEmployees] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState('EMPLOYEE');
    const [recentEods, setRecentEods] = useState<any[]>([]);

    const { addNotification } = useNotifications();

    // Modal State
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [kanbanRefresh, setKanbanRefresh] = useState(0);

    useEffect(() => {
        async function fetchData() {
            if (!authEmployee) {
                if (!authLoading) setLoading(false);
                return;
            }

            setLoading(true);
            
            let activeRole = authEmployee.roleId || 'EMPLOYEE';
            activeRole = activeRole.toUpperCase();
            if (activeRole.includes('ADMIN')) activeRole = 'ADMIN';
            else if (activeRole.includes('MANAGER')) activeRole = 'MANAGER';

            const activeEmpId = authEmployee.id;
            setUserRole(activeRole);
            setEmployee(authEmployee as any);

            // SAFE DATA LOADING PATTERN FOR ALL ADMIN DASHBOARD MODULES
            const fetchDataAsync = async () => {
                try {
                    setLoading(true);
                    console.log("STARTING PARALLEL DATA FETCHING FOR ADMIN MODULES...");

                    // 1. Task Fetching with log
                    const tasksPromise = api.getTasks(activeRole === 'EMPLOYEE' ? activeEmpId : undefined, undefined, activeRole === 'ADMIN' ? 5 : 15);
                    // 2. KPI Fetching with log 
                    const kpiPromise = api.getKpiProfile(activeEmpId);

                    const baseFetches: Promise<any>[] = [tasksPromise, kpiPromise];

                    if (activeRole === 'ADMIN') {
                        baseFetches.push(api.getEmployeeStats());
                        baseFetches.push(api.getAllEODs(10));
                        baseFetches.push(api.getAllKpiProfiles(undefined, 5));
                        baseFetches.push(api.getAllKpiAuditLogs(8));
                    } else if (activeRole === 'MANAGER') {
                        baseFetches.push(api.getAllKpiProfiles(undefined, 5));
                        baseFetches.push(api.getAllKpiAuditLogs(8));
                    } else {
                        baseFetches.push(api.getRecentWorkHours(activeEmpId, 5));
                    }

                    const results = await Promise.allSettled(baseFetches);
                    
                    results.forEach((res, i) => {
                        if (res.status === 'fulfilled') {
                            console.log(`FETCH COMPLETE [${i}]:`, res.value);
                            const val = res.value;
                            if (i === 0) setTasks(val || []);
                            if (i === 1) setKpis(val);
                            if (activeRole === 'ADMIN') {
                                if (i === 2) setTotalEmployees(val?.total || 0);
                                if (i === 3) setRecentEods(val || []);
                                if (i === 4) setAllKpis(val || []);
                                if (i === 5) setRecentKpiLogs(val || []);
                            }
                        } else {
                            console.error(`FETCH ERROR [${i}]:`, res.reason);
                        }
                    });

                } catch (err) {
                    console.error("CRITICAL DASHBOARD LOAD FAILURE:", err);
                    setTasks([]);
                } finally {
                    console.log("DASHBOARD DATA FETCHING FINISHED. STOPPING SPINNER.");
                    setLoading(false); // ALWAYS STOP LOADING
                }
            };

            fetchDataAsync();
        }

        if (!authLoading) {
            fetchData();
        }

        // Listen for Real-Time Notification dispatches
        const handleLiveUpdate = (e: any) => {
            const detail = e.detail;
            if (detail?.type === 'TASK_ASSIGNED' || detail?.type === 'TASK_UPDATED') {
                fetchData(); // Live refresh!
            }
        };

        window.addEventListener('app:live-notification', handleLiveUpdate);
        return () => window.removeEventListener('app:live-notification', handleLiveUpdate);
    }, [authEmployee, authLoading]);

    // Only block if we strictly have no user found yet
    if (authLoading && !authEmployee) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    return (
        <div className={userRole === 'ADMIN' ? '' : "dashboard-page fade-in"}>

            {userRole !== 'ADMIN' && (
                <header className="page-header">
                    <div>
                        <h1 className="greeting">Welcome back, {employee?.firstName || 'User'}</h1>
                        <p className="subtitle">Here's your {userRole.toLowerCase()} overview for today.</p>
                    </div>
                </header>
            )}

            {/* Conditionally Render Role Dashboard */}
            {userRole === 'ADMIN' && (
                <AdminDashboard
                    employee={employee}
                    tasks={tasks}
                    kpis={kpis}
                    totalEmployees={totalEmployees}
                    onAssignTaskTrigger={() => setIsAssignModalOpen(true)}
                    kanbanRefresh={kanbanRefresh}
                    recentEods={recentEods}
                    teamKpis={allKpis}
                    recentKpiLogs={recentKpiLogs}
                />
            )}
            {userRole === 'MANAGER' && (
                <ManagerDashboard 
                    employee={employee} 
                    tasks={tasks} 
                    kpis={kpis} 
                    teamKpis={allKpis} 
                    recentKpiLogs={recentKpiLogs} 
                />
            )}
            {userRole !== 'ADMIN' && userRole !== 'MANAGER' && (
                <EmployeeDashboard employee={employee} tasks={tasks} kpis={kpis} recentLogs={recentLogs} />
            )}

            <AdminAssignTaskModal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                onAssign={async (data) => {
                    await api.createTask(data);

                    addNotification({
                        title: 'Task Assignment Created',
                        message: `Successfully delegated '${data.title}' tracking cards to Kanban board.`,
                        type: 'SYSTEM',
                        metadata: null
                    });

                    setKanbanRefresh(prev => prev + 1);

                    // Dispatch local live update to force the dashboard stats and task lists to refresh immediately
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('app:live-notification', { detail: { type: 'TASK_ASSIGNED' } }));
                    }
                }}
            />
        </div>
    );
}
