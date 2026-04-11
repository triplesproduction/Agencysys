'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GlassCard from '@/components/GlassCard';
import DeadlineIndicator from '@/components/DeadlineIndicator';
import { api } from '@/lib/api';
import { EmployeeDTO, TaskDTO, WorkHourLogDTO } from '@/types/dto';
import { Activity, ChevronRight, Plus, MessageCircle, Bell, Users, CheckSquare, AlertTriangle, Search, Zap, CalendarDays, BookOpen, Clock } from 'lucide-react';
import AllocateTaskModal from '@/components/tasks/AllocateTaskModal';

import { useNotifications } from '@/components/notifications/NotificationProvider';
import AnnouncementsWidget from '@/components/dashboard/AnnouncementsWidget';
import RulesWidget from '@/components/dashboard/RulesWidget';
import { useAuth } from '@/context/AuthContext';
import KpiAuditLedger from '@/components/kpi/KpiAuditLedger';
import RecentMessagesWidget from '@/components/dashboard/RecentMessagesWidget';
import WorkClock from '@/components/dashboard/WorkClock';
import CreateAnnouncementModal from '@/components/dashboard/CreateAnnouncementModal';
import CreateEmployeeModal from '@/components/employees/CreateEmployeeModal';

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
    recentKpiLogs = [],
    allEmployees = [],
    onCreateEmployeeTrigger,
    onBroadcastTrigger
}: {
    employee: any,
    tasks?: TaskDTO[],
    kpis: any,
    totalEmployees: number,
    onAssignTaskTrigger: () => void,
    onCreateEmployeeTrigger: () => void,
    onBroadcastTrigger: () => void,
    kanbanRefresh: number,
    recentEods?: any[],
    teamKpis?: any[],
    recentKpiLogs?: any[],
    allEmployees?: EmployeeDTO[]
}) {
    const taskList = tasks || [];
    const eodList = recentEods || [];
    const kpiList = teamKpis || [];
    const kpiLogList = recentKpiLogs || [];

    const activeTasksCount = taskList.filter((t: any) => t && t.status !== 'DONE').length;
    const adminName = employee?.firstName || 'Admin';
    const adminRole = employee?.designation || employee?.roleId || 'Administrator';
    const avgTeamScore = kpiList.length > 0
        ? (kpiList.reduce((acc: number, curr: any) => acc + (curr.current_score || 0), 0) / kpiList.length).toFixed(1)
        : '0.0';

    return (
        <div className="admin-dash-v2 fade-in">

            {/* Quick Stats */}
            <div className="quick-stats">
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
            <div className="ad2-bento-grid" style={{ marginTop: '16px' }}>

                {/* Column 1: Command Center */}
                <div className="ad2-col ad2-col-1">
                    <div className="ad2-card primary-gradient">
                        <div className="ad2-card-header" style={{ border: 'none', marginBottom: '12px' }}>
                            <h3><Activity size={18} color="var(--purple-main)" /> Command Center</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button className="ad2-btn-add primary" onClick={onAssignTaskTrigger}>
                                <Plus size={16} /> New Task Assignment
                            </button>
                            <button className="ad2-btn-add" onClick={onCreateEmployeeTrigger}>
                                <Users size={16} /> Manage Employees
                            </button>
                            <button className="ad2-btn-add" onClick={onBroadcastTrigger}>
                                <Bell size={16} /> Send Broadcast
                            </button>
                        </div>
                    </div>

                    <div className="ad2-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="ad2-card-header">
                            <h3>Pending EODs</h3>
                            <span className="ad2-badge">{eodList.length}</span>
                        </div>
                        <div className="ad2-task-list custom-scrollbar" style={{ flex: 1, overflowY: 'auto', maxHeight: '200px', paddingRight: '4px' }}>
                            {eodList.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No EODs submitted yet today.</p>
                            ) : (
                                eodList.map((eod: any) => {
                                    if (!eod) return null;
                                    return (
                                        <div key={eod.id} className="ad2-task-list-item">
                                            <img src={eod.employee?.profilePhoto || "https://i.pravatar.cc/150"} alt="E" style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                                <div className="ad2-tli-title" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>
                                                    {eod.employee?.firstName ? `${eod.employee.firstName} ${eod.employee.lastName || ''}` : 'Unknown'}
                                                </div>
                                                <div className="ad2-tli-time">
                                                    {eod.submittedAt ? new Date(eod.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Submitted'}
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

                    {/* Performance Feed */}
                    <div className="ad2-card custom-scrollbar" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'rgba(5, 5, 5, 0.4)', minHeight: '180px' }}>
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
                                        <div key={log.id} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
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

                {/* Column 2: Tasks Requiring Action (spans 2 cols) */}
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

                {/* Column 4: Announcements, Chats & Leaderboard */}
                <div className="ad2-col ad2-col-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <AnnouncementsWidget maxItems={2} />
                    <RecentMessagesWidget maxItems={2} />

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
    tasks = [],
    teamKpis = [],
    recentKpiLogs = [],
    recentEods = []
}: {
    employee: any,
    tasks: TaskDTO[],
    kpis: any,
    teamKpis: any[],
    recentKpiLogs: any[],
    recentEods?: any[]
}) {
    const taskList = tasks || [];
    const eodList = recentEods || [];
    const kpiLogList = recentKpiLogs || [];

    const activeTasksCount = taskList.filter((t: any) => t && t.status !== 'DONE' && t.status !== 'APPROVED').length;
    const completedTasksCount = taskList.filter((t: any) => t && (t.status === 'DONE' || t.status === 'APPROVED')).length;
    
    const managerName = employee?.firstName || 'Manager';
    const managerRole = employee?.roleId || 'Team Manager';

    return (
        <div className="admin-dash-v2 fade-in">
            {/* Custom Manager Header */}
            <header className="ad2-header">
                <div className="ad2-header-left">
                    <div className="ad2-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                </div>
                <div className="ad2-header-center">
                    <div className="ad2-search-bar">
                        <Search size={16} />
                        <input type="text" placeholder="Search team tasks..." />
                    </div>
                </div>
                <div className="ad2-header-right">
                    <div className="ad2-icon-btn" onClick={() => window.location.href = '/messaging'}><MessageCircle size={18} /></div>
                    <div className="ad2-icon-btn"><Bell size={18} /></div>
                    <div className="ad2-user-profile">
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--purple-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white' }}>
                            {managerName.charAt(0)}
                        </div>
                        <div className="ad2-user-info">
                            <span className="ad2-user-name">{managerName}</span>
                            <span className="ad2-user-role">{managerRole}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="quick-stats" style={{ marginTop: '16px' }}>
                <GlassCard className="stat-card">
                    <div className="stat-label">Team Tasks</div>
                    <div className="stat-value">{taskList.length}</div>
                </GlassCard>
                <GlassCard className="stat-card">
                    <div className="stat-label">Pending Action</div>
                    <div className="stat-value">{activeTasksCount}</div>
                </GlassCard>
                <GlassCard className="stat-card">
                    <div className="stat-label">Completed</div>
                    <div className="stat-value">{completedTasksCount}</div>
                </GlassCard>
                <Link href="/kpis" style={{ textDecoration: 'none' }}>
                    <GlassCard className="stat-card gradient-card hoverable">
                        <div className="stat-label">Team Performance</div>
                        <div className="stat-value purple-glow">94.2</div>
                    </GlassCard>
                </Link>
            </div>

            {/* Main Bento Grid */}
            <div className="ad2-bento-grid" style={{ marginTop: '32px' }}>

                {/* Column 1: Manager Quick Actions & Team EOD Updates */}
                <div className="ad2-col ad2-col-1" style={{ gridArea: 'col1' }}>
                    <div className="ad2-card" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), transparent)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Zap size={18} color="var(--purple-main)" /> Manager Toolkit
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button className="ad2-btn-add" onClick={() => window.location.href = '/tasks'} style={{ width: '100%', justifyContent: 'center', background: 'var(--purple-main)', border: 'none' }}>
                                <CheckSquare size={16} /> Oversee Tasks
                            </button>
                            <button className="ad2-btn-add" onClick={() => window.location.href = '/leaves'} style={{ width: '100%', justifyContent: 'center' }}>
                                <CalendarDays size={16} /> Apply for Leave
                            </button>
                            <button className="ad2-btn-add" onClick={() => window.location.href = '/rulebook'} style={{ width: '100%', justifyContent: 'center' }}>
                                <BookOpen size={16} /> View Rulebook
                            </button>
                        </div>
                    </div>

                    <div className="ad2-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="ad2-card-header">
                            <h3>Team EOD Reports</h3>
                            <span className="ad2-badge">{eodList.length}</span>
                        </div>
                        <div className="ad2-task-list custom-scrollbar" style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                            {tasks.length === 0 ? (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.2, padding: '40px 0' }}>No reports to show.</div>
                            ) : (
                                eodList.map((eod: any) => (
                                    <div key={eod.id} className="ad2-task-list-item">
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', flexShrink: 0 }}>
                                            {eod.employee?.firstName?.charAt(0) || 'E'}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="ad2-tli-title">{eod.employee?.firstName} {eod.employee?.lastName}</div>
                                            <div className="ad2-tli-time">{eod.submittedAt ? new Date(eod.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}</div>
                                        </div>
                                        <Link href={`/eod/reviews`} className="ad2-circle-btn">
                                            <ChevronRight size={14} />
                                        </Link>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 2 & 3: Team Management & Activity */}
                <div className="ad2-col ad2-col-23" style={{ gridColumn: 'span 2' }}>
                    {/* Team Tasks Oversight */}
                    <div className="ad2-card" style={{ flex: 1 }}>
                        <div className="ad2-card-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckSquare size={18} color="#A78BFA" /> Team Tasks Overview
                            </h3>
                            <Link href="/tasks" style={{ fontSize: '0.8rem', color: '#A78BFA', textDecoration: 'none' }}>View All</Link>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {taskList.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>No active team tasks.</div>
                            ) : (
                                taskList.slice(0, 4).map((task: any) => (
                                    <div key={task.id} style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{task.assignee?.firstName || 'Unassigned'} • Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</div>
                                        </div>
                                        <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', color: '#A78BFA', border: '1px solid rgba(139, 92, 246, 0.2)', fontWeight: 700 }}>{task.status}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Team Performance Feed */}
                    <div className="ad2-card" style={{ flex: 1 }}>
                        <div className="ad2-card-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Activity size={18} color="#10B981" /> Team Performance Feed
                            </h3>
                            <span className="ad2-badge">{kpiLogList.length} updates</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {kpiLogList.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No recent performance logs.</div>
                            ) : (
                                kpiLogList.slice(0, 4).map((log: any) => (
                                    <div key={log.id} style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.employee?.firstName} {log.employee?.lastName}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.reason}</div>
                                        </div>
                                        <div style={{ fontWeight: 800, color: log.points_change >= 0 ? '#10B981' : '#EF4444', fontSize: '0.85rem' }}>
                                            {log.points_change > 0 ? '+' : ''}{log.points_change}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 3: Communication & Rules */}
                <div className="ad2-col ad2-col-4" style={{ gridArea: 'col4' }}>
                    <RecentMessagesWidget maxItems={3} />
                    <div style={{ marginTop: '12px' }}>
                        <AnnouncementsWidget maxItems={2} />
                    </div>
                </div>
            </div>
        </div>
    );
}


// ---------------------------------------------------------------------------
// EMPLOYEE DASHBOARD (Clean & High Density)
// ---------------------------------------------------------------------------
function EmployeeDashboard({ employee, tasks, kpis, recentLogs }: { employee: any, tasks: TaskDTO[], kpis: any, recentLogs: WorkHourLogDTO[] }) {
    const taskList = tasks || [];
    const pendingTasks = taskList.filter(t => t && t.status !== 'DONE' && t.status !== 'APPROVED');
    const kpiScore = kpis?.current_score ?? 0;
    const extraPoints = kpis?.extra_points ?? 0;
    const kpiGrade = kpis?.grade ?? 'Stable';

    const priorityColor: Record<string, string> = { HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#10B981', CRITICAL: '#8B5CF6' };
    const statusStyle: Record<string, { bg: string; color: string }> = {
        APPROVED: { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
        DONE: { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
        IN_PROGRESS: { bg: 'rgba(139,92,246,0.15)', color: '#A78BFA' },
        SUBMITTED: { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA' },
        REJECTED: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
        TODO: { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' },
    };

    const empName = employee?.firstName || 'Team Member';
    const empRole = employee?.roleId || 'Creative Strategist';

    return (
        <div className="admin-dash-v2 fade-in">


            {/* KPI & Quick Stats */}
            <div className="quick-stats" style={{ marginTop: '0px' }}>
                <Link href="/kpis" style={{ textDecoration: 'none', flex: 1 }}>
                    <div className="stat-card gradient-card" style={{ border: '1px solid rgba(139,92,246,0.3)', background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.1), rgba(139, 92, 246, 0.05))' }}>
                        <div className="stat-label">Performance Score</div>
                        <div className="stat-value purple-glow">{kpiScore}/100</div>
                        <div style={{ fontSize: '0.7rem', color: '#A78BFA', marginTop: '4px', fontWeight: 600 }}>Grade: {kpiGrade}</div>
                    </div>
                </Link>
                <Link href="/tasks" style={{ textDecoration: 'none', flex: 1 }}>
                    <GlassCard className="stat-card">
                        <div className="stat-label">Pending Tasks</div>
                        <div className="stat-value">{pendingTasks.length}</div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>Active Sprint</div>
                    </GlassCard>
                </Link>
                <Link href="/eod" style={{ textDecoration: 'none', flex: 1 }}>
                    <GlassCard className="stat-card">
                        <div className="stat-label">EOD Status</div>
                        <div className="stat-value" style={{ fontSize: '1.25rem' }}>{new Date().getHours() >= 17 ? 'Ready to Submit' : 'In Progress'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>Daily Check-in</div>
                    </GlassCard>
                </Link>
                <Link href="/leaves" style={{ textDecoration: 'none', flex: 1 }}>
                    <GlassCard className="stat-card">
                        <div className="stat-label">Monthly Hours</div>
                        <div className="stat-value">{kpis?.total_hours_worked || 0}h</div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>Target: 160h</div>
                    </GlassCard>
                </Link>
            </div>

            {/* Performance Alert */}
            {kpiGrade === 'Danger Zone' && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '16px', padding: '16px', marginTop: '16px' }}>
                    <div style={{ color: '#EF4444', fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> PERFORMANCE ALERT
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'white' }}>Your KPI score is below 60. Efficiency improvements recommended.</div>
                </div>
            )}

            {/* Main Layout Grid */}
            <div className="ad2-bento-grid" style={{ marginTop: '10px' }}>
                
                {/* Column 1 + 2: Task Runway & Performance Audit */}
                <div className="ad2-col" style={{ gridColumn: 'span 2' }}>
                    <div className="ad2-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '400px', overflow: 'hidden' }}>
                        <div className="ad2-card-header">
                            <h3><Zap size={16} color="var(--purple-main)" /> My Task Runway</h3>
                            <Link href="/tasks" className="ad2-badge-btn">View All</Link>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                            {pendingTasks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                                    <CheckSquare size={40} style={{ opacity: 0.1, marginBottom: '12px' }} />
                                    <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>No pending tasks.</p>
                                </div>
                            ) : (
                                pendingTasks.slice(0, 10).map(task => {
                                    const sc = statusStyle[task.status] || statusStyle.TODO;
                                    const pc = priorityColor[task.priority] || '#6B7280';
                                    return (
                                        <div key={task.id} className="ad2-task-list-item" style={{ padding: '12px 16px', marginBottom: '8px' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.88rem', color: 'white' }}>{task.title}</h4>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span className="ad2-badge ad2-tag" style={{ background: sc.bg, color: sc.color, borderColor: 'transparent', padding: '2px 8px' }}>{task.status.replace('_', ' ')}</span>
                                                    <span style={{ fontSize: '0.68rem', color: pc, fontWeight: 800 }}>{task.priority}</span>
                                                </div>
                                            </div>
                                            <Link href={`/tasks/${task.id}`} className="ad2-circle-btn"><ChevronRight size={14} /></Link>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    {employee && <KpiAuditLedger employeeId={employee.id} />}
                </div>

                {/* Column 3: Quick Actions, Messages & Monthly Pace */}
                <div className="ad2-col">
                    <div className="ad2-card" style={{ marginBottom: '8px' }}>
                         <div className="ad2-card-header" style={{ marginBottom: '8px' }}>
                            <h3><Zap size={16} color="#F59E0B" /> Actions</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <button className="ad2-btn-add primary" style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px' }} onClick={() => window.location.href = '/eod'}>Submit EOD</button>
                            <button className="ad2-btn-add" style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px' }} onClick={() => window.location.href = '/tasks'}>Kanban Board</button>
                            <button className="ad2-btn-add" style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px' }} onClick={() => window.location.href = '/leaves'}>Request Leave</button>
                            <button className="ad2-btn-add" style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px' }} onClick={() => window.location.href = '/rulebook'}>Agency Rules</button>
                        </div>
                    </div>

                    <RecentMessagesWidget maxItems={3} />
                </div>

                {/* Column 4: Communication & Rules (Right Side) */}
                <div className="ad2-col">
                    <AnnouncementsWidget maxItems={2} />
                    
                    <div className="ad2-card" style={{ padding: '22px 20px', marginTop: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '140px' }}>
                         <div className="ad2-card-header" style={{ marginBottom: '10px' }}>
                            <h3 style={{ fontSize: '1.05rem' }}><Activity size={18} color="#10B981" /> Month Pace</h3>
                            <span style={{ fontSize: '1rem', color: '#10B981', fontWeight: 900 }}>{kpis?.total_hours_worked || 0}h</span>
                        </div>
                        <div style={{ height: '10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px' }}>
                            <div style={{ 
                                height: '100%', 
                                width: `${Math.min(100, ((kpis?.total_hours_worked || 0) / 160) * 100)}%`, 
                                background: 'linear-gradient(90deg, #10B981, #3B82F6)',
                                transition: 'width 1s ease'
                            }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>Target: 160h</p>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress: {Math.round(((kpis?.total_hours_worked || 0) / 160) * 100)}%</span>
                        </div>
                    </div>
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
    const [allEmployees, setAllEmployees] = useState<EmployeeDTO[]>([]);

    const { addNotification } = useNotifications();

    // Modal State
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isCreateEmployeeModalOpen, setIsCreateEmployeeModalOpen] = useState(false);
    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
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
                    
                    // 1. Task Fetching
                    const tasksPromise = api.getTasks(activeRole === 'EMPLOYEE' ? activeEmpId : undefined, undefined, activeRole === 'ADMIN' ? 5 : 15);
                    // 2. KPI Fetching
                    const kpiPromise = api.getKpiProfile(activeEmpId);

                    const baseFetches: Promise<any>[] = [tasksPromise, kpiPromise];

                    if (activeRole === 'ADMIN') {
                        baseFetches.push(api.getEmployeeStats());
                        baseFetches.push(api.getAllEODs(12));
                        baseFetches.push(api.getEmployees({ limit: 100, excludeAdmin: true }));
                        baseFetches.push(api.getAllKpiProfiles(undefined, 6));
                        baseFetches.push(api.getAllKpiAuditLogs(10));
                    } else if (activeRole === 'MANAGER') {
                        baseFetches.push(api.getAllEODs(10));
                        baseFetches.push(api.getAllKpiProfiles(undefined, 5));
                        baseFetches.push(api.getAllKpiAuditLogs(8));
                    } else {
                        baseFetches.push(api.getRecentWorkHours(activeEmpId, 5));
                    }

                    const results = await Promise.allSettled(baseFetches);
                    
                    results.forEach((res, i) => {
                        if (res.status === 'fulfilled') {
                            const val = res.value;
                            if (i === 0) setTasks(val || []);
                            if (i === 1) setKpis(val);
                            if (activeRole === 'ADMIN') {
                                if (i === 2) setTotalEmployees(val?.total || 0);
                                if (i === 3) setRecentEods(val || []);
                                if (i === 4) setAllEmployees(val?.data || []);
                                if (i === 5) setAllKpis(val || []);
                                if (i === 6) setRecentKpiLogs(val || []);
                            } else if (activeRole === 'MANAGER') {
                                if (i === 2) setRecentEods(val || []);
                                if (i === 3) setAllKpis(val || []);
                                if (i === 4) setRecentKpiLogs(val || []);
                            }
                        }
                    });

                } catch (err) {
                    console.error("CRITICAL DASHBOARD LOAD FAILURE:", err);
                    setTasks([]);
                } finally {
                    setLoading(false);
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

    // SEEDING LOGIC: Populate 22 Dummy Tasks

    // Only block if we strictly have no user found yet
    if (authLoading && !authEmployee) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    return (
        <main className={userRole === 'ADMIN' ? '' : "dashboard-page fade-in"}>

            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0px', padding: '4px 0' }}>
                <div>
                    <h1 className="greeting" style={{ margin: 0, fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Welcome back, {employee?.firstName || 'User'}</h1>
                    <p className="subtitle" style={{ margin: '4px 0 0 0', opacity: 0.6, fontSize: '0.95rem', fontWeight: 500 }}>
                        {employee?.designation && employee.designation.toUpperCase() !== 'EMPLOYEE' ? employee.designation : 'Creative Strategist'} | Overview for today
                    </p>
                </div>
                
                <div className="ad2-header-nav-pill" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '18px', 
                    background: 'rgba(255, 255, 255, 0.04)', 
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '8px 20px',
                    borderRadius: '50px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                    transition: 'all 0.3s ease'
                }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontWeight: 800, paddingRight: '12px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                        {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase()}
                    </div>
                    
                    <div className="ad2-header-actions" style={{ display: 'flex', gap: '8px' }}>
                        <div className="ad2-icon-btn" style={{ background: 'rgba(255,255,255,0.06)', width: '36px', height: '36px', position: 'relative' }} onClick={() => window.location.href = '/messaging'}>
                            <MessageCircle size={18} />
                            {/* Chat Notification Badge */}
                            <span style={{ position: 'absolute', top: '2px', right: '2px', width: '8px', height: '8px', background: '#EF4444', borderRadius: '50%', border: '1.5px solid #000', boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)' }}></span>
                        </div>
                        <div className="ad2-icon-btn" style={{ background: 'rgba(255,255,255,0.06)', width: '36px', height: '36px', position: 'relative' }} onClick={() => window.location.href = '/rulebook'}>
                            <BookOpen size={18} />
                            {/* System Update Badge */}
                            <span style={{ position: 'absolute', top: '2px', right: '2px', width: '8px', height: '8px', background: '#F59E0B', borderRadius: '50%', border: '1.5px solid #000', boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)' }}></span>
                        </div>
                    </div>

                    <div className="ad2-user-pill" style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{employee?.firstName} {employee?.lastName}</div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '3px' }}>
                                {employee?.designation && employee.designation.toUpperCase() !== 'EMPLOYEE' ? employee.designation : (userRole === 'ADMIN' ? 'Agency Administrator' : userRole === 'MANAGER' ? 'Team Manager' : 'Creative Strategist')}
                            </div>
                        </div>
                        <img 
                            src={employee?.profilePhoto && employee.profilePhoto.length > 5 ? employee.profilePhoto : `https://ui-avatars.com/api/?name=${employee?.firstName || 'User'}&background=6366f1&color=fff`} 
                            alt="Pro" 
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)' }} 
                        />
                    </div>
                </div>
            </header>

            {userRole === 'ADMIN' && (
                <AdminDashboard 
                    employee={employee} 
                    tasks={tasks} 
                    kpis={kpis} 
                    totalEmployees={totalEmployees}
                    onAssignTaskTrigger={() => setIsAssignModalOpen(true)}
                    onCreateEmployeeTrigger={() => setIsCreateEmployeeModalOpen(true)}
                    onBroadcastTrigger={() => setIsBroadcastModalOpen(true)}
                    kanbanRefresh={kanbanRefresh}
                    recentEods={recentEods}
                    teamKpis={allKpis}
                    recentKpiLogs={recentKpiLogs}
                    allEmployees={allEmployees}
                />
            )}
            {userRole === 'MANAGER' && (
                <ManagerDashboard 
                    employee={employee} 
                    tasks={tasks} 
                    kpis={kpis} 
                    teamKpis={allKpis} 
                    recentKpiLogs={recentKpiLogs} 
                    recentEods={recentEods}
                />
            )}
            {userRole !== 'ADMIN' && userRole !== 'MANAGER' && (
                <EmployeeDashboard employee={employee} tasks={tasks} kpis={kpis} recentLogs={recentLogs} />
            )}

            <AllocateTaskModal 
                isOpen={isAssignModalOpen} 
                onClose={() => setIsAssignModalOpen(false)} 
                onSuccess={() => { setIsAssignModalOpen(false); setKanbanRefresh(k => k + 1); }} 
            />

            <CreateEmployeeModal
                isOpen={isCreateEmployeeModalOpen}
                addNotification={addNotification}
                onClose={() => { setIsCreateEmployeeModalOpen(false); setKanbanRefresh(k => k + 1); }}
            />

            <CreateAnnouncementModal
                isOpen={isBroadcastModalOpen}
                onClose={() => setIsBroadcastModalOpen(false)}
                onCreated={() => {
                    addNotification({
                        title: 'Announcement Sent',
                        message: 'The new task tracking cards have been pushed to the Kanban board.',
                        type: 'SYSTEM',
                        metadata: null
                    });
                }}
            />
        </main>
    );
}
