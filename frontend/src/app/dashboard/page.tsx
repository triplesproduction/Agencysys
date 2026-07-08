'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import GlassCard from '@/components/GlassCard';
import DeadlineIndicator from '@/components/DeadlineIndicator';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { EmployeeDTO, TaskDTO, WorkHourLogDTO } from '@/types/dto';
import { Activity, ChevronRight, Plus, MessageCircle, Bell, Users, CheckSquare, AlertTriangle, Search, Zap, CalendarDays, BookOpen, Clock, Briefcase, Download } from 'lucide-react';
import AllocateTaskModal from '@/components/tasks/AllocateTaskModal';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';

import { useQueryClient } from '@tanstack/react-query';
import { dashboardKeys } from '@/hooks/queries/domains/dashboard/keys';
import { useDashboardData } from '@/hooks/queries/domains/dashboard/useDashboardData';

import { useNotifications } from '@/components/notifications/NotificationProvider';
import AnnouncementsWidget from '@/components/dashboard/AnnouncementsWidget';
import RulesWidget from '@/components/dashboard/RulesWidget';
import { useAuth } from '@/context/AuthContext';
import KpiAuditLedger from '@/components/kpi/KpiAuditLedger';
import RecentMessagesWidget from '@/components/dashboard/RecentMessagesWidget';
import TopPerformerWidget from '@/components/dashboard/TopPerformerWidget';
import WorkClock from '@/components/dashboard/WorkClock';
import CreateAnnouncementModal from '@/components/dashboard/CreateAnnouncementModal';
import CreateEmployeeModal from '@/components/employees/CreateEmployeeModal';
import CreateProjectModal from '@/components/projects/CreateProjectModal';


import Preloader from '@/components/common/Preloader';
import Phase2CelebrationModal from '@/components/dashboard/Phase2CelebrationModal';

import './Dashboard.css';

// Reusable component for showing multiple assignees on a task
const TaskAssigneeStack = ({ assignees = [] }: { assignees? : any[] }) => {
    if (!assignees || assignees.length === 0) return <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)' }}>Unassigned</span>;

    return (
        <div className="card-avatar-stack" style={{ margin: 0 }}>
            {assignees.slice(0, 3).map((assignee, idx) => (
                assignee.profilePhoto ? (
                    <img 
                        key={assignee.id} 
                        src={assignee.profilePhoto} 
                        className="card-avatar" 
                        alt="" 
                        style={{ zIndex: 10 - idx, width: '22px', height: '22px' }} 
                    />
                ) : (
                    <div 
                        key={assignee.id} 
                        className="card-avatar" 
                        style={{ zIndex: 10 - idx, width: '22px', height: '22px', fontSize: '0.5rem' }}
                    >
                        {assignee.firstName?.charAt(0) || 'U'}
                    </div>
                )
            ))}
            {assignees.length > 3 && (
                <div className="card-avatar avatar-more" style={{ width: '22px', height: '22px', fontSize: '0.5rem', marginLeft: '4px' }}>
                    +{assignees.length - 3}
                </div>
            )}
        </div>
    );
};
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
    onBroadcastTrigger,
    onCreateProjectTrigger,
    allWorkHours = []
}: {
    employee: any,
    tasks?: TaskDTO[],
    kpis: any,
    totalEmployees: number,
    onAssignTaskTrigger: () => void,
    onCreateEmployeeTrigger: () => void,
    onBroadcastTrigger: () => void,
    onCreateProjectTrigger: () => void,
    kanbanRefresh: number,
    recentEods?: any[],
    teamKpis?: any[],
    recentKpiLogs?: any[],
    allEmployees?: EmployeeDTO[],
    allWorkHours?: any[]
}) {
    const router = useRouter();
    const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
    const openTaskDrawer = (id: string) => setDrawerTaskId(id);
    const closeTaskDrawer = () => setDrawerTaskId(null);

    const taskList = tasks || [];
    const eodList = recentEods || [];
    const kpiList = useMemo(() => allEmployees
        .filter(emp => {
            const role = (emp.roleId || '').toUpperCase();
            return role !== 'ADMIN' && role !== 'ADMINISTRATOR' && !role.includes('ADMIN');
        })
        .map(emp => {
            const profile = (teamKpis || []).find((p: any) => p.employeeId === emp.id || p.employee_id === emp.id);
            return {
                id: profile?.id || `temp-${emp.id}`,
                employee: emp,
                current_score: parseFloat(String(profile?.currentScore || profile?.current_score || 0)),
                grade: profile?.grade || 'New Recruit'
            };
        })
        .sort((a, b) => b.current_score - a.current_score), [allEmployees, teamKpis]);

    const hoursLeaderboard = useMemo(() => {
        const hoursMap: Record<string, number> = {};
        (allWorkHours || []).forEach((log: any) => {
            const empId = log.employeeId || log.employee_id;
            if (empId) {
                const hours = parseFloat(log.hoursLogged || log.hours_logged || 0) || 0;
                hoursMap[empId] = (hoursMap[empId] || 0) + hours;
            }
        });

        return allEmployees
            .filter(emp => {
                const role = (emp.roleId || '').toUpperCase();
                return role !== 'ADMIN' && role !== 'ADMINISTRATOR' && !role.includes('ADMIN');
            })
            .map(emp => {
                const totalHours = hoursMap[emp.id] || 0;
                return {
                    id: emp.id,
                    employee: emp,
                    total_hours_worked: parseFloat(totalHours.toFixed(1))
                };
            })
            .sort((a, b) => b.total_hours_worked - a.total_hours_worked);
    }, [allEmployees, allWorkHours]);

    const kpiLogList = recentKpiLogs || [];

    const activeTasksCount = taskList.filter((t: any) => t && t.status !== 'DONE').length;
    const adminName = employee?.firstName || 'Admin';
    const adminRole = employee?.designation || employee?.roleId || 'Administrator';
    
    // Calculate Today's Status for All Employees
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    const todayEods = useMemo(() => eodList.filter(e => e && e.reportDate === todayStr), [eodList, todayStr]);

    const employeeEodstatus = useMemo(() => allEmployees
        .filter(emp => {
            const role = (emp.roleId || '').toUpperCase();
            return role !== 'ADMIN' && role !== 'ADMINISTRATOR' && !role.includes('ADMIN');
        })
        .map(emp => {
            const eod = todayEods.find((e: any) => e.employeeId === emp.id);
            return {
                ...emp,
                eodStatus: eod ? 'SUBMITTED' : 'PENDING',
                eodId: eod?.id,
                submittedAt: eod?.submittedAt
            };
        })
        .sort((a, b) => {
            // Submitted first
            if (a.eodStatus === 'SUBMITTED' && b.eodStatus !== 'SUBMITTED') return -1;
            if (a.eodStatus !== 'SUBMITTED' && b.eodStatus === 'SUBMITTED') return 1;
            
            // If both submitted, sort by time desc
            if (a.eodStatus === 'SUBMITTED' && b.eodStatus === 'SUBMITTED') {
                return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
            }
            
            // Otherwise alphabetical
            return (a.firstName || '').localeCompare(b.firstName || '');
        }), [allEmployees, todayEods]);

    const pendingCount = employeeEodstatus.filter((e: any) => e.eodStatus === 'PENDING').length;
    const avgTeamScore = kpiList.length > 0
        ? (kpiList.reduce((acc: number, curr: any) => acc + (curr.current_score || 0), 0) / kpiList.length).toFixed(1)
        : '0.0';

    return (
        <>
        <div className="admin-dash-v2 admin-scrollable-layout fade-in">

            {/* Quick Stats */}
            <div className="quick-stats" style={{ marginTop: '24px', marginBottom: '24px' }}>
                <div className="ad2-card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', justifyContent: 'center', minHeight: '100px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Headcount</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>{totalEmployees || '...'}</div>
                </div>
                <div className="ad2-card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', justifyContent: 'center', minHeight: '100px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Tasks</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>{activeTasksCount || '0'}</div>
                </div>
                <div className="ad2-card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', justifyContent: 'center', minHeight: '100px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Approval</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>{(tasks || []).filter(t => t && t.status === 'SUBMITTED').length}</div>
                </div>
                <Link href="/kpis" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                    <div className="ad2-card" style={{ height: '100%', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', justifyContent: 'center', minHeight: '100px', background: 'linear-gradient(135deg, rgba(30, 20, 45, 0.95), rgba(15, 10, 25, 0.95))', border: '1px solid rgba(124, 58, 237, 0.4)', boxShadow: '0 4px 20px rgba(124,58,237,0.15)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Team Score</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'white', lineHeight: 1, textShadow: '0 0 15px rgba(124, 58, 237, 0.4)' }}>{avgTeamScore}/100</div>
                    </div>
                </Link>
            </div>

            {/* Main Bento Grid */}
            <div className="ad2-bento-grid">

                {/* Column 1: Command Center, EODs & Performance */}
                <div className="ad2-col ad2-col-1">
                    <div className="ad2-card primary-gradient" style={{ flexShrink: 0, minHeight: '220px' }}>
                        <div className="ad2-card-header" style={{ border: 'none', marginBottom: '12px' }}>
                            <h3><Activity size={18} color="var(--purple-main)" /> Command Center</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button className="ad2-btn-add primary" onClick={onAssignTaskTrigger}>
                                <Plus size={16} /> New Task
                            </button>
                            <button className="ad2-btn-add" onClick={onCreateEmployeeTrigger}>
                                <Users size={16} /> Manage Employees
                            </button>
                            <button className="ad2-btn-add" onClick={onCreateProjectTrigger}>
                                <Briefcase size={16} /> Create Project
                            </button>
                            <button className="ad2-btn-add" onClick={onBroadcastTrigger}>
                                <Bell size={16} /> Send Broadcast
                            </button>
                        </div>
                    </div>

                    <div className="ad2-card" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Zap size={16} color="#A78BFA" /> Top Contributor
                        </h3>
                        {hoursLeaderboard.length > 0 ? (
                            <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '20px' }}>
                                <img src={hoursLeaderboard[0].employee?.profilePhoto || "https://i.pravatar.cc/150"} alt="Top" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #A78BFA', marginBottom: '10px' }} />
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>{hoursLeaderboard[0].employee?.firstName} {hoursLeaderboard[0].employee?.lastName}</div>
                                <div style={{ fontSize: '0.8rem', color: '#A78BFA' }}>Hours: {hoursLeaderboard[0].total_hours_worked} hrs</div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No performance data found for this month.</div>
                        )}

                        <div className="leaderboard-mini custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                            <h4 style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leaderboard (Hours)</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {hoursLeaderboard.slice(0, 3).map((profile: any, idx: number) => (
                                    <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                                        <span style={{ width: '18px', color: idx === 0 ? '#F59E0B' : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>#{idx + 1}</span>
                                        <div style={{ flex: 1, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.employee?.firstName} {profile.employee?.lastName}</div>
                                        <div style={{ color: '#A78BFA', fontWeight: 600 }}>{profile.total_hours_worked} hrs</div>
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

                {/* Column 2: My Task Runway (Admin's own tasks) + Submitted Tasks */}
                <div className="ad2-col ad2-col-2" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Admin My Task Runway */}
                    <div className="ad2-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div className="ad2-card-header" style={{ marginBottom: '12px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={16} color="var(--purple-main)" /> My Task Runway</h3>
                            <Link href="/tasks" style={{ fontSize: '0.8rem', color: '#A78BFA', textDecoration: 'none' }}>View All</Link>
                        </div>
                        {(() => {
                            const now = new Date();
                            const myTasks = taskList
                                .filter((t: any) => t && t.status !== 'DONE' && t.status !== 'APPROVED'
                                    && (t.assigneeId === employee?.id || (t.assigneeIds && t.assigneeIds.includes(employee?.id)))
                                )
                                .sort((a: any, b: any) => {
                                    const po: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
                                    const pDiff = (po[a.priority] ?? 3) - (po[b.priority] ?? 3);
                                    if (pDiff !== 0) return pDiff;
                                    
                                    const timeA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                                    const timeB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                                    return timeA - timeB;
                                });
                            return (
                                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '215px' }}>
                                    {myTasks.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>No high/medium priority tasks assigned to you.</div>
                                    ) : myTasks.map((task: any) => {
                                        const isOverdue = task.dueDate && new Date(task.dueDate) < now;
                                        const pc: Record<string,string> = { HIGH: '#EF4444', CRITICAL: '#8B5CF6', MEDIUM: '#F59E0B' };
                                        return (
                                            <div key={task.id} style={{ padding: '10px 14px', borderRadius: '10px', background: isOverdue ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                                                        {isOverdue && <span style={{ fontSize: '0.57rem', fontWeight: 800, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: '4px' }}>OVERDUE</span>}
                                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '6px', fontSize: '0.68rem', alignItems: 'center' }}>
                                                        <span style={{ color: pc[task.priority] || '#A78BFA', fontWeight: 800 }}>{task.priority}</span>
                                                        {task.dueDate && <span style={{ color: isOverdue ? '#EF4444' : 'rgba(255,255,255,0.3)' }}>· {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => openTaskDrawer(task.id)}
                                                    className="ad2-circle-btn"
                                                    style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    <ChevronRight size={12} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Submitted Tasks needing action */}
                    <div className="ad2-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div className="ad2-card-header" style={{ marginBottom: '12px' }}>
                            <h3>Tasks for Review</h3>
                            <Link href="/tasks" style={{ fontSize: '0.8rem', color: '#A78BFA', textDecoration: 'none' }}>View All</Link>
                        </div>
                        <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '185px' }}>
                            {taskList.filter((t: any) => t && (t.status === 'SUBMITTED' || t.status === 'IN_REVIEW')).length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                    <CheckSquare size={32} style={{ opacity: 0.1, marginBottom: '8px' }} />
                                    <p>All clear — no tasks pending review.</p>
                                </div>
                            ) : (
                                taskList.filter((t: any) => t && (t.status === 'SUBMITTED' || t.status === 'IN_REVIEW')).map((task: any) => {
                                    if (!task) return null;
                                    return (
                                        <div key={task.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ flexShrink: 0 }}>
                                                    <TaskAssigneeStack assignees={task.assignees} />
                                                </div>
                                                <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</h4>
                                            </div>
                                            <button
                                                onClick={() => openTaskDrawer(task.id)}
                                                style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.25)', color: '#A78BFA', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 700 }}
                                            >Review</button>
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

                    <div className="ad2-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="ad2-card-header" style={{ marginBottom: '12px' }}>
                            <h3>EOD Submission Status</h3>
                            <span className="ad2-badge" style={{ 
                                background: pendingCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                color: pendingCount > 0 ? '#F87171' : '#34D399',
                                border: `1px solid ${pendingCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                                textTransform: 'uppercase',
                                fontSize: '0.62rem',
                                padding: '2px 8px'
                            }}>{pendingCount} Pending</span>
                        </div>
                        <div className="ad2-task-list custom-scrollbar" style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                            {employeeEodstatus.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No employees found.</p>
                            ) : (
                                employeeEodstatus.map((status: any) => {
                                    const isSub = status.eodStatus === 'SUBMITTED';
                                    return (
                                        <div key={status.id} className="ad2-task-list-item" style={{ 
                                            background: isSub ? 'rgba(52, 211, 153, 0.02)' : 'rgba(255, 255, 255, 0.01)',
                                            borderColor: isSub ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                                            padding: '8px 12px',
                                            marginBottom: '2px'
                                        }}>
                                            <div style={{ position: 'relative' }}>
                                                <img src={status.profilePhoto || `https://ui-avatars.com/api/?name=${status.firstName}&background=6366f1&color=fff`} alt="E" style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }} />
                                                {!isSub && <div style={{ position: 'absolute', bottom: 0, right: 0, width: '7px', height: '7px', background: '#F87171', borderRadius: '50%', border: '1.5px solid #0a0a0c' }}></div>}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                                <div className="ad2-tli-title" style={{ color: isSub ? 'white' : 'rgba(255,255,255,0.4)', fontSize: '0.85rem', lineHeight: 1.1 }}>
                                                    {status.firstName} {status.lastName || ''}
                                                </div>
                                                <div style={{ 
                                                    color: isSub ? '#34D399' : '#F87171', 
                                                    fontWeight: 700, 
                                                    fontSize: '0.58rem',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.04em',
                                                    marginTop: '1px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    {isSub ? (
                                                        <>PENDING REVIEW · {status.submittedAt ? new Date(status.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TODAY'}</>
                                                    ) : (
                                                        <>PENDING SUBMISSION</>
                                                    )}
                                                </div>
                                            </div>
                                            {isSub ? (
                                                <Link href={`/eod/reviews?id=${status.eodId}`} className="ad2-circle-btn" style={{ flexShrink: 0, width: '24px', height: '24px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                                                    <ChevronRight size={12} color="#34D399" />
                                                </Link>
                                            ) : (
                                                <div className="ad2-circle-btn" style={{ flexShrink: 0, width: '24px', height: '24px', cursor: 'default', opacity: 0.2, background: 'rgba(255, 255, 255, 0.05)' }}>
                                                    <Clock size={10} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

            </div>

        </div>

        <TaskDetailDrawer
            isOpen={!!drawerTaskId}
            onClose={closeTaskDrawer}
            taskId={drawerTaskId || ''}
            onUpdate={() => {}}
            currentUserRole={employee?.roleId || 'ADMIN'}
        />
        </>
    );
}

// ---------------------------------------------------------------------------
function ManagerDashboard({
    employee,
    tasks = [],
    teamKpis = [],
    recentKpiLogs = [],
    recentEods = [],
    monthlyHours = 0
}: {
    employee: any,
    tasks: TaskDTO[],
    kpis: any,
    teamKpis: any[],
    recentKpiLogs: any[],
    recentEods?: any[],
    monthlyHours?: number
}) {
    const router = useRouter();
    const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
    const openTaskDrawer = (id: string) => setDrawerTaskId(id);
    const closeTaskDrawer = () => setDrawerTaskId(null);

    const taskList = tasks || [];
    const kpiLogList = recentKpiLogs || [];

    const activeTasksCount = taskList.filter((t: any) => t && t.status !== 'DONE' && t.status !== 'APPROVED').length;
    const completedTasksCount = taskList.filter((t: any) => t && (t.status === 'DONE' || t.status === 'APPROVED')).length;

    const managerName = employee?.firstName || 'Manager';
    const managerRole = employee?.roleId || 'Team Manager';

    const todayStr = new Date().toISOString().split('T')[0];
    const hasSubmittedToday = (recentEods || []).some(e => e && e.employeeId === employee.id && e.reportDate && e.reportDate.startsWith(todayStr));

    const avgTeamScore = teamKpis && teamKpis.length > 0
        ? (teamKpis.reduce((acc: number, curr: any) => acc + parseFloat(String(curr.currentScore || curr.current_score || 0)), 0) / teamKpis.length).toFixed(1)
        : '0.0';

    return (
        <>
        <div className="admin-dash-v2 admin-scrollable-layout fade-in">


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
                        <div className="stat-value purple-glow">{avgTeamScore}/100</div>
                    </GlassCard>
                </Link>
            </div>

            {/* Main Bento Grid */}
            <div className="ad2-bento-grid" style={{ marginTop: '32px' }}>

                {/* Column 1: Manager Quick Actions & Team EOD Updates */}
                <div className="ad2-col ad2-col-1">
                    <div className="ad2-card" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), transparent)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Zap size={18} color="var(--purple-main)" /> Manager Toolkit
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button className="ad2-btn-add primary" disabled={hasSubmittedToday} style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 14px', opacity: hasSubmittedToday ? 0.5 : 1, cursor: hasSubmittedToday ? 'not-allowed' : 'pointer' }} onClick={() => !hasSubmittedToday && router.push('/eod')}>{hasSubmittedToday ? 'EOD Submitted' : 'Submit EOD'}</button>
                            <button className="ad2-btn-add" onClick={() => router.push('/tasks')} style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 14px' }}>
                                <CheckSquare size={16} /> Oversee Tasks
                            </button>
                            <button className="ad2-btn-add" onClick={() => router.push('/leaves')} style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 14px' }}>
                                <CalendarDays size={16} /> Apply for Leave
                            </button>
                            <button className="ad2-btn-add" onClick={() => router.push('/rulebook')} style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 14px' }}>
                                <BookOpen size={16} /> View Rulebook
                            </button>
                        </div>
                    </div>

                    <div className="ad2-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                                <Activity size={16} color="#10B981" /> Month Pace
                            </h3>
                            <span style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 800 }}>{Math.round(((monthlyHours || 0) / 200) * 100)}%</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '2px 0' }}>
                            <span style={{ fontSize: '1.4rem', color: 'white', fontWeight: 900 }}>{monthlyHours || 0}h</span>
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>logged this month</span>
                        </div>

                        <div style={{ height: '8px', minHeight: '8px', width: '100%', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
                            <div style={{
                                height: '100%',
                                minHeight: '8px',
                                width: `${Math.min(100, Math.max((Number(monthlyHours || 0) > 0 ? 2 : 0), (Number(monthlyHours || 0) / 200) * 100))}%`,
                                background: 'linear-gradient(90deg, #10B981 0%, #3B82F6 100%)',
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                                borderRadius: '10px',
                                boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)'
                            }}></div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>
                            <span>Target: 200h</span>
                            <span>{Math.max(0, 200 - (monthlyHours || 0))}h left</span>
                        </div>
                    </div>
                </div>

                {/* Column 2: My Task Runway (Manager's own tasks) */}
                <div className="ad2-col ad2-col-2">
                    <div className="ad2-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div className="ad2-card-header" style={{ marginBottom: '16px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={16} color="var(--purple-main)" /> My Task Runway
                            </h3>
                            <Link href="/tasks" style={{ fontSize: '0.8rem', color: '#A78BFA', textDecoration: 'none' }}>View All</Link>
                        </div>
                        {(() => {
                            const now = new Date();
                            const myTasks = taskList
                                .filter((t: any) => t && t.status !== 'DONE' && t.status !== 'APPROVED'
                                    && (t.assigneeId === employee?.id || (t.assigneeIds && t.assigneeIds.includes(employee?.id)))
                                )
                                .sort((a: any, b: any) => {
                                    const po: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
                                    const pDiff = (po[a.priority] ?? 3) - (po[b.priority] ?? 3);
                                    if (pDiff !== 0) return pDiff;
                                    
                                    const timeA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                                    const timeB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                                    return timeA - timeB;
                                });
                            return (
                                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px' }}>
                                    {myTasks.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No tasks assigned to you.</div>
                                    ) : myTasks.map((task: any) => {
                                        const isOverdue = task.dueDate && new Date(task.dueDate) < now;
                                        const pc: Record<string,string> = { HIGH: '#EF4444', CRITICAL: '#8B5CF6', MEDIUM: '#F59E0B' };
                                        return (
                                            <div key={task.id} style={{ padding: '12px 14px', borderRadius: '10px', background: isOverdue ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                        {isOverdue && <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: '4px' }}>OVERDUE</span>}
                                                        <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', alignItems: 'center' }}>
                                                        <span style={{ color: pc[task.priority] || '#A78BFA', fontWeight: 800 }}>{task.priority}</span>
                                                        {task.dueDate && <span style={{ color: isOverdue ? '#EF4444' : 'rgba(255,255,255,0.3)' }}>· {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => openTaskDrawer(task.id)}
                                                    className="ad2-circle-btn"
                                                    style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    <ChevronRight size={12} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Column 3: Communication & Rules */}
                <div className="ad2-col ad2-col-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <RecentMessagesWidget maxItems={10} />
                    <div style={{ marginTop: '12px' }}>
                        <AnnouncementsWidget maxItems={2} />
                    </div>
                </div>
            </div>
        </div>

        <TaskDetailDrawer
            isOpen={!!drawerTaskId}
            onClose={closeTaskDrawer}
            taskId={drawerTaskId || ''}
            onUpdate={() => {}}
            currentUserRole={employee?.roleId || 'MANAGER'}
        />
        </>
    );
}


// ---------------------------------------------------------------------------
// EMPLOYEE DASHBOARD (Clean & High Density)
// ---------------------------------------------------------------------------
function EmployeeDashboard({ 
    employee, 
    tasks, 
    kpis, 
    recentLogs, 
    monthlyHours, 
    eodList = [],
    allEmployees = [],
    allKpiProfiles = []
}: { 
    employee: any, 
    tasks: TaskDTO[], 
    kpis: any, 
    recentLogs: WorkHourLogDTO[], 
    monthlyHours: number, 
    eodList?: any[],
    allEmployees?: any[],
    allKpiProfiles?: any[]
}) {
    const router = useRouter();
    const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
    const openTaskDrawer = (id: string) => setDrawerTaskId(id);
    const closeTaskDrawer = () => setDrawerTaskId(null);

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

    const todayStr = new Date().toISOString().split('T')[0];
    const hasSubmittedToday = eodList.some(e => e && e.reportDate && e.reportDate.startsWith(todayStr));

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const uniqueDays = new Set<string>();

    eodList.forEach(e => {
        if (e && e.reportDate && (!e.status || e.status === 'APPROVED')) {
            const d = new Date(e.reportDate);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                uniqueDays.add(d.toDateString());
            }
        }
    });

    recentLogs.forEach(l => {
        if (l && l.date) {
            const d = new Date(l.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                uniqueDays.add(d.toDateString());
            }
        }
    });

    const daysPresent = uniqueDays.size;

    return (
        <>
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
                        <div className="stat-value" style={{ fontSize: '1.25rem' }}>{hasSubmittedToday ? 'Submitted' : new Date().getHours() >= 17 ? 'Ready to Submit' : 'In Progress'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>Daily Check-in</div>
                    </GlassCard>
                </Link>
                <Link href="/leaves" style={{ textDecoration: 'none', flex: 1 }}>
                    <GlassCard className="stat-card">
                        <div className="stat-label">Monthly Presence</div>
                        <div className="stat-value">{daysPresent} Days</div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>Active Days this Month</div>
                    </GlassCard>
                </Link>
            </div>

            {/* Performance Alert removed from homepage grid as per user request — now triggers as a one-time popup */}

            {/* Main Layout Grid */}
            <div className="ad2-bento-grid" style={{ marginTop: '10px' }}>

                {/* Column 1 + 2: Task Runway & Performance Audit */}
                <div className="ad2-col" style={{ gridColumn: 'span 2' }}>
                    <div className="ad2-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '400px', overflow: 'hidden' }}>
                        <div className="ad2-card-header">
                            <h3><Zap size={16} color="var(--purple-main)" /> My Task Runway</h3>
                            <Link href="/tasks" className="ad2-badge-btn">View All</Link>
                        </div>
                        {(() => {
                            const now = new Date();
                            const runwayTasks = taskList
                                .filter(t => t && t.status !== 'DONE' && t.status !== 'APPROVED' && (t.priority === 'HIGH' || t.priority === 'CRITICAL' || t.priority === 'MEDIUM'))
                                .sort((a, b) => {
                                    const aOverdue = a.dueDate && new Date(a.dueDate) < now;
                                    const bOverdue = b.dueDate && new Date(b.dueDate) < now;
                                    if (aOverdue && !bOverdue) return -1;
                                    if (!aOverdue && bOverdue) return 1;
                                    const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                                    const pDiff = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
                                    if (pDiff !== 0) return pDiff;
                                    return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
                                });
                            return (
                                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                                    {runwayTasks.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                                            <CheckSquare size={40} style={{ opacity: 0.1, marginBottom: '12px' }} />
                                            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>No high/medium priority tasks.</p>
                                        </div>
                                    ) : (
                                        runwayTasks.slice(0, 12).map(task => {
                                            const sc = statusStyle[task.status] || statusStyle.TODO;
                                            const pc = priorityColor[task.priority] || '#6B7280';
                                            const isOverdue = task.dueDate && new Date(task.dueDate) < now && task.status !== 'DONE';
                                            return (
                                                <div key={task.id} className="ad2-task-list-item" style={{ padding: '12px 16px', marginBottom: '8px', borderColor: isOverdue ? 'rgba(239,68,68,0.25)' : undefined, background: isOverdue ? 'rgba(239,68,68,0.04)' : undefined }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                            {isOverdue && <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: '4px', letterSpacing: '0.04em' }}>OVERDUE</span>}
                                                            <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</h4>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            <span className="ad2-badge ad2-tag" style={{ background: sc.bg, color: sc.color, borderColor: 'transparent', padding: '2px 8px' }}>{task.status.replace('_', ' ')}</span>
                                                            <span style={{ fontSize: '0.68rem', color: pc, fontWeight: 800 }}>{task.priority}</span>
                                                            {task.dueDate && <span style={{ fontSize: '0.65rem', color: isOverdue ? '#EF4444' : 'rgba(255,255,255,0.3)' }}>· {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>}
                                                        </div>
                                                    </div>
                                                <button
                                                    onClick={() => openTaskDrawer(task.id)}
                                                    className="ad2-circle-btn"
                                                    style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    <ChevronRight size={14} />
                                                </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                    {employee && <KpiAuditLedger employeeId={employee.id} />}
                </div>

                {/* Column 3: Quick Actions, Top Performers & Monthly Pace */}
                <div className="ad2-col">
                    <AnnouncementsWidget maxItems={10} />
                    <TopPerformerWidget employees={allEmployees} kpiProfiles={allKpiProfiles} />
                </div>

                {/* Column 4: Communication & Rules (Right Side) */}
                <div className="ad2-col">
                    <div className="ad2-card" style={{ flexShrink: 0 }}>
                        <div className="ad2-card-header" style={{ marginBottom: '12px' }}>
                            <h3><Zap size={16} color="#F59E0B" /> Actions</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button className="ad2-btn-add primary" disabled={hasSubmittedToday} style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 14px', opacity: hasSubmittedToday ? 0.5 : 1, cursor: hasSubmittedToday ? 'not-allowed' : 'pointer' }} onClick={() => !hasSubmittedToday && router.push('/eod')}>{hasSubmittedToday ? 'EOD Submitted' : 'Submit EOD'}</button>
                            <button className="ad2-btn-add" style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 14px' }} onClick={() => router.push('/tasks')}>Tasks Board</button>
                            <button className="ad2-btn-add" style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 14px' }} onClick={() => router.push('/notes')}>Notes</button>
                            <button className="ad2-btn-add" style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 14px' }} onClick={() => router.push('/boards')}>Whiteboard</button>
                        </div>
                    </div>

                    <div className="ad2-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                                <Activity size={16} color="#10B981" /> Month Pace
                            </h3>
                            <span style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 800 }}>{Math.round(((monthlyHours || 0) / 200) * 100)}%</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '2px 0' }}>
                            <span style={{ fontSize: '1.4rem', color: 'white', fontWeight: 900 }}>{monthlyHours || 0}h</span>
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>logged this month</span>
                        </div>

                        <div style={{ height: '8px', minHeight: '8px', width: '100%', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
                            <div style={{
                                height: '100%',
                                minHeight: '8px',
                                width: `${Math.min(100, Math.max((Number(monthlyHours || 0) > 0 ? 2 : 0), (Number(monthlyHours || 0) / 200) * 100))}%`,
                                background: 'linear-gradient(90deg, #10B981 0%, #3B82F6 100%)',
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                                borderRadius: '10px',
                                boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)'
                            }}></div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>
                            <span>Target: 200h</span>
                            <span>{Math.max(0, 200 - (monthlyHours || 0))}h left</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <TaskDetailDrawer
            isOpen={!!drawerTaskId}
            onClose={closeTaskDrawer}
            taskId={drawerTaskId || ''}
            onUpdate={() => {}}
            currentUserRole={employee?.roleId || 'EMPLOYEE'}
        />
        </>
    );
}

// ---------------------------------------------------------------------------
// MAIN LAYOUT WRAPPER
// ---------------------------------------------------------------------------

export default function DashboardPage() {
    const { addNotification } = useNotifications();
    const router = useRouter();

    const {
        userRole,
        employee,
        tasks,
        allEmployees,
        totalEmployees,
        kpis,
        allKpis,
        allWorkHours,
        recentKpiLogs,
        recentEods,
        recentLogs,
        monthlyHours,
        unreadCount,
        isLoading,
        _rawKpiScore,
    } = useDashboardData();

    const queryClient = useQueryClient();

    // Modal State
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isCreateEmployeeModalOpen, setIsCreateEmployeeModalOpen] = useState(false);
    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
    const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
    const [kanbanRefresh, setKanbanRefresh] = useState(0);
    const [highlightDownload, setHighlightDownload] = useState(false);
    const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);

    // Check if we should highlight the Windows app download
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hasSeen = localStorage.getItem('download_highlight_seen_v1');
            if (!hasSeen) {
                setHighlightDownload(true);
            }
        }
    }, []);

    // Performance alert
    useEffect(() => {
        if (userRole === 'EMPLOYEE' && _rawKpiScore !== undefined && _rawKpiScore < 50) {
            const sessionKey = `perf_alert_shown_${employee?.id}`;
            if (!sessionStorage.getItem(sessionKey)) {
                addNotification({
                    title: 'Performance Alert',
                    message: `Your current KPI score is ${_rawKpiScore}. Efficiency improvements are recommended.`,
                    type: 'SYSTEM',
                    metadata: { score: _rawKpiScore }
                });
                sessionStorage.setItem(sessionKey, 'true');
            }
        }
    }, [userRole, _rawKpiScore, employee?.id, addNotification]);

    // Listen for Real-Time Notification dispatches
    useEffect(() => {
        const handleLiveUpdate = (e: any) => {
            const detail = e.detail;
            if (detail?.type === 'TASK_ASSIGNED' || detail?.type === 'TASK_UPDATED') {
                queryClient.invalidateQueries({ queryKey: dashboardKeys.tasks(userRole, employee?.id) });
            }
        };

        window.addEventListener('app:live-notification', handleLiveUpdate);
        return () => window.removeEventListener('app:live-notification', handleLiveUpdate);
    }, [queryClient, userRole, employee?.id]);

    if (isLoading) {
        return <Preloader statusText="Preparing your command center..." />;
    }

    return (
        <main className={userRole === 'ADMIN' ? '' : "dashboard-page fade-in"}>

            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0px', padding: '4px 0' }}>
                <div>
                    <h1 className="greeting" style={{ margin: 0, fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Welcome back, {employee?.firstName || 'User'}</h1>
                    <p className="subtitle" style={{ margin: '4px 0 0 0', opacity: 0.6, fontSize: '0.95rem', fontWeight: 500 }}>
                        {employee?.designation && employee.designation.toUpperCase() !== 'EMPLOYEE' 
                            ? employee.designation 
                            : (userRole === 'ADMIN' ? 'Agency Administrator' : userRole === 'MANAGER' ? 'Team Manager' : 'Creative Strategist')} | Overview for today
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
                    transition: 'all 0.3s ease',
                    zIndex: 100
                }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontWeight: 800, paddingRight: '12px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                        {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase()}
                    </div>

                    <div className="ad2-header-actions" style={{ display: 'flex', gap: '8px' }}>
                        <div className="ad2-icon-btn" style={{ background: 'rgba(255,255,255,0.06)', width: '36px', height: '36px', position: 'relative' }} onClick={() => router.push('/messaging')}>
                            <MessageCircle size={18} />
                            {/* Chat Notification Badge */}
                            {unreadCount > 0 && (
                                <span style={{ position: 'absolute', top: '2px', right: '2px', width: '8px', height: '8px', background: '#EF4444', borderRadius: '50%', border: '1.5px solid #000', boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)' }}></span>
                            )}
                        </div>
                        <div className="ad2-icon-btn" style={{ background: 'rgba(255,255,255,0.06)', width: '36px', height: '36px', position: 'relative' }} onClick={() => router.push('/rulebook')}>
                            <BookOpen size={18} />
                        </div>
                        <div style={{ position: 'relative', zIndex: 101 }}>
                            <div 
                                className={`ad2-icon-btn ${highlightDownload ? 'download-highlight-btn' : ''}`} 
                                style={{ background: 'rgba(255,255,255,0.06)', width: '36px', height: '36px', position: 'relative', border: highlightDownload ? '1px solid var(--purple-main)' : 'none', cursor: 'pointer' }} 
                                title="Download Desktop App"
                                onClick={() => {
                                    localStorage.setItem('download_highlight_seen_v1', 'true');
                                    setHighlightDownload(false);
                                    setShowDownloadDropdown(!showDownloadDropdown);
                                }}
                            >
                                <Download size={18} color={highlightDownload ? 'var(--purple-main)' : 'currentColor'} />
                            </div>

                            {showDownloadDropdown && (
                                <>
                                    <div 
                                        onClick={() => setShowDownloadDropdown(false)} 
                                        style={{ position: 'fixed', inset: 0, zIndex: 99998 }} 
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        top: '44px',
                                        right: '0',
                                        background: '#141418',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        padding: '8px',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                        width: '180px',
                                        zIndex: 99999
                                    }}>
                                        <button 
                                            onClick={() => {
                                                setShowDownloadDropdown(false);
                                                window.location.href = '/api/monitoring/download?platform=windows';
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'white',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                textAlign: 'left',
                                                fontSize: '0.85rem',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                transition: 'background 0.2s',
                                                width: '100%'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ fontSize: '1rem' }}>🪟</span> Windows (.exe)
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setShowDownloadDropdown(false);
                                                window.location.href = '/api/monitoring/download?platform=mac';
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'white',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                textAlign: 'left',
                                                fontSize: '0.85rem',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                transition: 'background 0.2s',
                                                width: '100%'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ fontSize: '1rem' }}>🍏</span> macOS (.dmg)
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="ad2-user-pill" style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{employee?.firstName} {employee?.lastName}</div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '3px' }}>
                                {employee?.designation && employee.designation.toUpperCase() !== 'EMPLOYEE' 
                                    ? employee.designation 
                                    : (userRole === 'ADMIN' ? 'Agency Administrator' : userRole === 'MANAGER' ? 'Team Manager' : 'Creative Strategist')}
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
                    onCreateProjectTrigger={() => setIsCreateProjectModalOpen(true)}
                    kanbanRefresh={kanbanRefresh}
                    recentEods={recentEods}
                    teamKpis={allKpis}
                    recentKpiLogs={recentKpiLogs}
                    allEmployees={allEmployees}
                    allWorkHours={allWorkHours}
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
                    monthlyHours={monthlyHours}
                />
            )}
             {userRole !== 'ADMIN' && userRole !== 'MANAGER' && (
                <EmployeeDashboard 
                    employee={employee} 
                    tasks={tasks} 
                    kpis={kpis} 
                    recentLogs={recentLogs} 
                    monthlyHours={monthlyHours} 
                    eodList={recentEods} 
                    allEmployees={allEmployees}
                    allKpiProfiles={allKpis}
                />
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

            <CreateProjectModal
                isOpen={isCreateProjectModalOpen}
                onClose={() => setIsCreateProjectModalOpen(false)}
                onSuccess={() => {
                    setIsCreateProjectModalOpen(false);
                    setKanbanRefresh(k => k + 1);
                    addNotification({
                        title: 'Project Initialized',
                        message: 'The new project and its backlog have been successfully created.',
                        type: 'SYSTEM'
                    });
                }}
            />

            <Phase2CelebrationModal />
        </main>
    );
}
