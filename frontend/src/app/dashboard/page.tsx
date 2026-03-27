'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GlassCard from '@/components/GlassCard';
import DeadlineIndicator from '@/components/DeadlineIndicator';
import { api } from '@/lib/api';
import { EmployeeDTO, TaskDTO, WorkHourLogDTO, KPIMetricDTO } from '@/types/dto';
import { getUserFromToken } from '@/lib/auth';
import { Play, Activity, CalendarDays, MousePointerClick, ChevronLeft, ChevronRight, Briefcase, Plus, Headphones, Video, MessageCircle, Search, Bell, Download, Users, FileText, CheckSquare, UserX, AlertTriangle } from 'lucide-react';
import KanbanBoard from '@/components/tasks/KanbanBoard';
import AdminAssignTaskModal from '@/components/tasks/AdminAssignTaskModal';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import AnnouncementsWidget from '@/components/dashboard/AnnouncementsWidget';
import RulesWidget from '@/components/dashboard/RulesWidget';
import RecentMessagesWidget from '@/components/dashboard/RecentMessagesWidget';

import './Dashboard.css';
// ADMIN DASHBOARD (V2 - High Fidelity Dribbble Layout)
// ---------------------------------------------------------------------------
function AdminDashboard({
    employee,
    tasks,
    kpis,
    totalEmployees,
    onAssignTaskTrigger,
    kanbanRefresh,
    recentEods
}: {
    employee: any,
    tasks: TaskDTO[],
    kpis: KPIMetricDTO[],
    totalEmployees: number,
    onAssignTaskTrigger: () => void,
    kanbanRefresh: number,
    recentEods: any[]
}) {
    // Mock data for the static visual elements from the design
    const activeTasksCount = tasks.filter(t => t.status !== 'DONE').length;

    return (
        <div className="admin-dash-v2 fade-in">
            {/* Custom Admin Header to match Mockup */}
            <header className="ad2-header">
                <div className="ad2-header-left">
                    <div className="ad2-date">Wednesday, 18 Sep</div>
                    <div className="ad2-weather">🌤 27°C</div>
                </div>
                <div className="ad2-header-center">
                    <div className="ad2-search-bar">
                        <Search size={16} />
                        <input type="text" placeholder="Search" />
                    </div>
                </div>
                <div className="ad2-header-right">
                    <div className="ad2-icon-btn"><Bell size={18} /></div>
                    <div className="ad2-user-profile">
                        <img src={employee?.profilePhoto || "https://i.pravatar.cc/150?img=11"} alt="Admin" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div className="ad2-user-info">
                            <span className="ad2-user-name">{employee?.firstName || 'Noah Brooks'}</span>
                            <span className="ad2-user-role">{employee?.roleId?.replace(/_/g, ' ') || 'HR Lead'}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Quick Stats (Restored from V1) */}
            <div className="quick-stats" style={{ marginTop: '16px' }}>
                <GlassCard className="stat-card">
                    <div className="stat-label">Total Enterprise Headcount</div>
                    <div className="stat-value">{totalEmployees}</div>
                </GlassCard>
                <GlassCard className="stat-card">
                    <div className="stat-label">System Active Tasks</div>
                    <div className="stat-value">{activeTasksCount}</div>
                </GlassCard>
                <Link href="/kpis" style={{ textDecoration: 'none' }}>
                    <GlassCard className="stat-card gradient-card hoverable">
                        <div className="stat-label">Average Fleet KPI Score</div>
                        <div className="stat-value purple-glow">
                            {kpis.length > 0 ? (kpis.reduce((acc, curr) => acc + curr.currentValue, 0) / kpis.length).toFixed(1) : 'N/A'}
                        </div>
                    </GlassCard>
                </Link>
            </div>

            {/* Sub Header */}
            <div style={{ marginTop: '32px' }}>
                {recentEods && recentEods.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {recentEods.slice(0, 10).map((eod: any) => (
                            <div key={eod.id} style={{ position: 'relative' }} title={`${eod.employee?.firstName} - EOD Submitted`}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #10B981', overflow: 'hidden', padding: '2px', background: 'rgba(16,185,129,0.1)' }}>
                                    {eod.employee?.profilePhoto ? (
                                        <img src={eod.employee.profilePhoto} alt="EOD" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--purple-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                                            {eod.employee?.firstName?.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', background: '#10B981', borderRadius: '50%', border: '2px solid var(--bg-dark)' }}></div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="ad2-subheader">
                    <div>
                        <h2 className="ad2-dept-title">Capture IT • Developers</h2>
                        <span className="ad2-member-count">15 members</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="ad2-btn-add" onClick={onAssignTaskTrigger} style={{ background: 'rgba(124, 58, 237, 0.2)', borderColor: 'rgba(124, 58, 237, 0.4)' }}>
                            <CheckSquare size={16} /> Assign Task
                        </button>
                        <button className="ad2-btn-add" onClick={() => window.location.href = '/employees'}>
                            <Plus size={16} /> Add employee
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="ad2-bento-grid">

                {/* Column 1: Profile & Stats */}
                <div className="ad2-col ad2-col-1">
                    <div className="ad2-card ad2-profile-card">
                        <div className="ad2-profile-img-wrap">
                            <img src="https://i.pravatar.cc/300?img=5" alt="Milena" />
                        </div>
                        <div className="ad2-profile-info">
                            <div>
                                <h3 className="ad2-profile-name">Milena Page</h3>
                                <p className="ad2-profile-role">Frontend Developer</p>
                            </div>
                            <div className="ad2-profile-actions">
                                <button className="ad2-circle-btn"><Briefcase size={16} /></button>
                                <button className="ad2-circle-btn"><MessageCircle size={16} /></button>
                            </div>
                        </div>
                    </div>

                    <div className="ad2-stats-row">
                        <div className="ad2-card ad2-stat-box">
                            <h4 className="ad2-stat-value">362</h4>
                            <p className="ad2-stat-label">Days in company</p>
                        </div>
                        <div className="ad2-card ad2-stat-box">
                            <h4 className="ad2-stat-value">12</h4>
                            <p className="ad2-stat-label">Done Projects</p>
                        </div>
                    </div>

                    <div className="ad2-card ad2-salary-card">
                        <h4 className="ad2-stat-value">$4,850</h4>
                        <p className="ad2-stat-label">Salary</p>
                    </div>

                    <div className="ad2-card ad2-promo-card">
                        <div className="ad2-promo-header">
                            <div className="ad2-promo-icon"><Headphones size={20} /></div>
                            <div className="ad2-promo-price">$12.99/mo &rarr;</div>
                        </div>
                        <h4 className="ad2-promo-title">HRadar Premium</h4>
                        <p className="ad2-promo-subtitle">Automation, AI help & more for pros</p>
                    </div>
                </div>

                {/* Column 2: Time Tracking & Task Overview (Left side) */}
                <div className="ad2-col ad2-col-2">
                    <div className="ad2-card ad2-time-card">
                        <div className="ad2-card-header">
                            <h3>Time tracking</h3>
                            <span>...</span>
                        </div>
                        <div className="ad2-active-task-ticker">
                            <div>
                                <div className="ad2-ticker-label">Banking app</div>
                                <div className="ad2-ticker-time">03:37:52</div>
                            </div>
                            <button className="ad2-play-btn"><Play size={24} fill="currentColor" /></button>
                        </div>
                        <div className="ad2-task-list">
                            <div className="ad2-task-list-item">
                                <div className="ad2-tli-icon"><Activity size={16} /></div>
                                <div>
                                    <div className="ad2-tli-title">Build responsive layout</div>
                                    <div className="ad2-tli-time">2:00:07</div>
                                </div>
                            </div>
                            <div className="ad2-task-list-item">
                                <div className="ad2-tli-icon"><MousePointerClick size={16} /></div>
                                <div>
                                    <div className="ad2-tli-title">Debug API integration</div>
                                    <div className="ad2-tli-time">1:12:57</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Task Overview spans across cols 2 & 3, positioned below */}
                    <div className="ad2-card ad2-calendar-card">
                        <div className="ad2-card-header">
                            <h3>Tasks overview</h3>
                            <div className="ad2-calendar-actions">
                                <Search size={16} />
                                <Download size={16} />
                            </div>
                        </div>
                        <div className="ad2-calendar-grid">
                            <div className="ad2-cal-header-row">
                                <div className="ad2-cal-time-col"></div>
                                <div className="ad2-cal-day">Sun 15</div>
                                <div className="ad2-cal-day">Mon 16</div>
                                <div className="ad2-cal-day">Tue 17</div>
                                <div className="ad2-cal-day active">Wed 18</div>
                                <div className="ad2-cal-day">Thu 19</div>
                                <div className="ad2-cal-day">Fri 20</div>
                                <div className="ad2-cal-day">Sat 21</div>
                            </div>
                            <div className="ad2-cal-body">
                                {[12, 13, 14, 15, 16, 17, 18].map(hour => (
                                    <div className="ad2-cal-row" key={hour}>
                                        <div className="ad2-cal-time">{hour}:00</div>
                                        <div className="ad2-cal-cell-row"></div>
                                    </div>
                                ))}
                                {/* Mock Blocks */}
                                <div className="ad2-cal-block" style={{ top: '60px', left: '14%', width: '40%' }}>
                                    <div className="ad2-cal-block-inner">
                                        <div>
                                            <strong>Team Sync</strong><br />Check-in with team.
                                        </div>
                                        <div className="ad2-cal-block-faces">
                                            <img src="https://i.pravatar.cc/150?img=1" alt="1" />
                                            <img src="https://i.pravatar.cc/150?img=2" alt="2" />
                                            <img src="https://i.pravatar.cc/150?img=3" alt="3" />
                                        </div>
                                    </div>
                                </div>
                                <div className="ad2-cal-block highlight" style={{ top: '180px', left: '42.8%', width: '25%' }}>
                                    <div className="ad2-cal-block-inner">
                                        <div>
                                            <strong>Component Review</strong><br />Refactor shared components.
                                        </div>
                                        <div className="ad2-cal-block-faces">
                                            <img src="https://i.pravatar.cc/150?img=4" alt="4" />
                                            <img src="https://i.pravatar.cc/150?img=5" alt="5" />
                                        </div>
                                    </div>
                                </div>
                                <div className="ad2-cal-block dark" style={{ top: '240px', left: '57%', width: '20%' }}>
                                    <div className="ad2-cal-block-inner">
                                        <div>
                                            <strong>Bug Reproduction</strong><br />Find and log UI bugs.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 3: Working Format (Task Overview spans under this) */}
                <div className="ad2-col ad2-col-3">
                    <div className="ad2-card ad2-donut-card">
                        <div className="ad2-card-header">
                            <h3>Working format</h3>
                            <span>...</span>
                        </div>
                        <div className="ad2-donut-wrapper">
                            <div className="ad2-donut-chart">
                                <div className="ad2-donut-center">
                                    <span className="ad2-donut-num">418</span>
                                    <span className="ad2-donut-sub">Days</span>
                                </div>
                                {/* pure CSS representation of arcs using conic-gradient in CSS */}
                            </div>
                        </div>
                        <div className="ad2-donut-legend">
                            <div><span className="dot dot-cyan"></span> 55%<br />Office</div>
                            <div><span className="dot dot-white"></span> 35%<br />Hybrid</div>
                            <div><span className="dot dot-blue"></span> 10%<br />Remote</div>
                        </div>
                    </div>
                </div>

                {/* Column 4: Activity & Apps */}
                <div className="ad2-col ad2-col-4">
                    <div className="ad2-card ad2-activity-card">
                        <div className="ad2-card-header">
                            <h3>Work activity</h3>
                            <div className="ad2-activity-badges">
                                <span className="ad2-badge">~120h</span>
                                <span className="ad2-badge">79% Avg</span>
                                <CalendarDays size={16} />
                            </div>
                        </div>
                        <div className="ad2-activity-legend">
                            <span className="dot dot-empty"></span> 0h
                            <span className="dot dot-low"></span> {'>'}2h
                            <span className="dot dot-med"></span> {'>'}4h
                            <span className="dot dot-high"></span> {'>'}8h
                        </div>
                        <div className="ad2-activity-grid">
                            <div className="ad2-ag-y-axis">
                                <span>2pm</span><span>1pm</span><span>12am</span><span>11am</span><span>10am</span><span>9am</span><span>8am</span>
                            </div>
                            <div className="ad2-ag-matrix">
                                {/* Auto-generated CSS grid blocks */}
                                {Array.from({ length: 49 }).map((_, i) => (
                                    <div key={i} className={`ad2-ag-block ${Math.random() > 0.5 ? 'active' : Math.random() > 0.8 ? 'high' : ''}`}></div>
                                ))}
                            </div>
                        </div>
                        <div className="ad2-ag-x-axis">
                            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                        </div>
                    </div>

                    <div className="ad2-card ad2-apps-card">
                        <div className="ad2-card-header">
                            <h3>Apps & URLs <span className="ad2-badge">15</span></h3>
                            <span>...</span>
                        </div>
                        <div className="ad2-apps-list">
                            <div className="ad2-app-item">
                                <div className="ad2-app-icon vscode">VS</div>
                                <div className="ad2-app-info">
                                    <div className="ad2-app-name">VS Code</div>
                                    <div className="ad2-app-time">42:00:07</div>
                                </div>
                                <div className="ad2-app-pct">35%</div>
                            </div>
                            <div className="ad2-app-item">
                                <div className="ad2-app-icon figma">F</div>
                                <div className="ad2-app-info">
                                    <div className="ad2-app-name">Figma</div>
                                    <div className="ad2-app-time">30:00:00</div>
                                </div>
                                <div className="ad2-app-pct">25%</div>
                            </div>
                            <div className="ad2-app-item">
                                <div className="ad2-app-icon chrome">C</div>
                                <div className="ad2-app-info">
                                    <div className="ad2-app-name">Chrome DevTools</div>
                                    <div className="ad2-app-time">21:36:07</div>
                                </div>
                                <div className="ad2-app-pct">18%</div>
                            </div>
                            <div className="ad2-app-item">
                                <div className="ad2-app-icon github">G</div>
                                <div className="ad2-app-info">
                                    <div className="ad2-app-name">GitHub</div>
                                    <div className="ad2-app-time">14:24:05</div>
                                </div>
                                <div className="ad2-app-pct">12%</div>
                            </div>
                            <div className="ad2-app-item">
                                <div className="ad2-app-icon chatgpt">AI</div>
                                <div className="ad2-app-info">
                                    <div className="ad2-app-name">ChatGPT</div>
                                    <div className="ad2-app-time">12:04:01</div>
                                </div>
                                <div className="ad2-app-pct">10%</div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Anti-Gravity Global Kanban Board (Restored from V1) */}
            <div className="kanban-injection-zone" style={{ marginTop: '32px' }}>
                <GlassCard className="kanban-panel-override">
                    <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={18} /> Global Task Command
                    </h2>
                    <KanbanBoard refreshFlag={kanbanRefresh} />
                </GlassCard>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// MANAGER DASHBOARD
// ---------------------------------------------------------------------------
function ManagerDashboard({ employee, tasks, kpis }: { employee: any, tasks: TaskDTO[], kpis: KPIMetricDTO[] }) {
    const teamSize = 6;
    const pendingCount = tasks.filter(t => t.status !== 'DONE' && t.status !== 'APPROVED').length;
    const completedCount = tasks.filter(t => t.status === 'DONE' || t.status === 'APPROVED').length;

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
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>Assignee: {task.assigneeId.slice(0, 8)}...</span>
                                                </div>
                                            </div>
                                            {task.dueDate && (
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Due</div>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: isOverdue ? '#EF4444' : 'rgba(255,255,255,0.55)' }}>{new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
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
function EmployeeDashboard({ employee, tasks, kpis, recentLogs }: { employee: any, tasks: TaskDTO[], kpis: KPIMetricDTO[], recentLogs: WorkHourLogDTO[] }) {
    const pendingTasks = tasks.filter(t => t.status !== 'DONE' && t.status !== 'APPROVED');
    const kpiScore = kpis.length > 0 ? kpis[0].currentValue : 0;

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
                    { href: '/kpis', icon: '🎯', label: 'KPI Score', val: `${kpiScore}/100`, accent: '#8B5CF6', chip: 'View' },
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
                            <span className="emp-stat-chip" style={{ background: `${s.accent}25`, color: s.accent }}>{s.chip} →</span>
                        </div>
                    </Link>
                ))}
            </div>

            {/* ── MAIN GRID */}
            <div className="emp-dash-grid">

                {/* Left: Tasks */}
                <GlassCard style={{ padding: '28px' }}>
                    {(() => {
                        const now = new Date();
                        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const twoDaysAgoStart = new Date(todayStart);
                        twoDaysAgoStart.setDate(todayStart.getDate() - 2);

                        const filteredTasks = tasks.filter(task => {
                            if (!task.dueDate) return false;
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
                                                                <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>{new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
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

                {/* Right: Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <GlassCard style={{ padding: '22px 24px' }}>
                        <h2 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: 'white' }}>📅 Daily Work Log</h2>
                        {recentLogs.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>No recent logs recorded.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {recentLogs.map(log => (
                                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.82rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>{new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                        <span style={{ color: 'white', fontWeight: 600 }}>{log.hoursLogged}h</span>
                                    </div>
                                ))}
                            </div>
                        )}
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
import { useAuth } from '@/hooks/useAuth';

// ... existing code ...

export default function DashboardPage() {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const [employee, setEmployee] = useState<EmployeeDTO | null>(null);
    const [tasks, setTasks] = useState<TaskDTO[]>([]);
    const [recentLogs, setRecentLogs] = useState<WorkHourLogDTO[]>([]);
    const [kpis, setKpis] = useState<KPIMetricDTO[]>([]);
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
            // ONLY run when employee profile is strictly available
            if (!authEmployee) return;

            setLoading(true);
            try {
                let activeRole = authEmployee.roleId || 'EMPLOYEE';
                activeRole = activeRole.toUpperCase();
                if (activeRole.includes('ADMIN')) activeRole = 'ADMIN';
                else if (activeRole.includes('MANAGER')) activeRole = 'MANAGER';
                
                const activeEmpId = authEmployee.id;
                setUserRole(activeRole);
                setEmployee(authEmployee as any);

                const [taskData, kpiData, statsData, eodData] = await Promise.all([
                    api.getTasks(activeRole === 'EMPLOYEE' ? activeEmpId : undefined).catch(() => []),
                    api.getEmployeeKPIs(activeEmpId).catch(() => []),
                    activeRole === 'ADMIN' ? api.getEmployeeStats().catch(() => ({ total: 0, active: 0 })) : Promise.resolve({ total: 0, active: 0 }),
                    activeRole === 'ADMIN' ? api.getAllEODs().catch(() => []) : Promise.resolve([])
                ]);

                // For ADMIN, we show first 5 system-wide, for EMPLOYEE we show up to 15 assigned
                setTasks(activeRole === 'ADMIN' ? taskData.slice(0, 5) : taskData.slice(0, 15));
                setKpis(kpiData || []);
                setTotalEmployees(statsData.total || 0);
                setRecentEods(eodData || []);
                setRecentLogs([]);
            } catch (err) {
                console.error('[Dashboard] Error fetching data:', err);
            } finally {
                setLoading(false);
            }
        }

        // Only attempt to fetch data once the auth handshake is complete and the profile is present
        if (!authLoading && authEmployee) {
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
                />
            )}
            {userRole === 'MANAGER' && <ManagerDashboard employee={employee} tasks={tasks} kpis={kpis} />}
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
