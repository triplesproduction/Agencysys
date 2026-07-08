'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    Plus, ChevronLeft, Calendar, Clock, 
    CheckCircle2, Users, Target, Activity,
    Flame, Briefcase, Zap, MoreVertical, LayoutGrid, CheckCircle, BarChart3, ShieldCheck, Trash2, Search, PlusCircle, Edit3
} from 'lucide-react';
import Button from '@/components/Button';
import GlassCard from '@/components/GlassCard';
import AllocateTaskModal from '@/components/tasks/AllocateTaskModal';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import EditProjectModal from '@/components/projects/EditProjectModal';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { api } from '@/lib/api';
import { ProjectDTO, TaskDTO, EmployeeDTO } from '@/types/dto';
import { useAuth } from '@/context/AuthContext';
import { getResolvedRole } from '@/lib/permissions';
import { useProjectDetail, useTasks, useUpdateTaskStatus, useDeleteProject, useAddProjectMember, useRemoveProjectMember } from '@/hooks/queries/domains/projects/useProjects';
import { useEmployees } from '@/hooks/queries/domains/employees/useEmployees';

// Kanban Components
import { KanbanColumn, SortableCard } from '../../tasks/KanbanComponents';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import '../ProjectDetail.css';
import '../../tasks/Tasks.css';
import '../../tasks/KanbanDrawer.css';

const COLUMNS = [
    { id: 'TODO', title: 'To Do' },
    { id: 'IN_PROGRESS', title: 'In Progress' },
    { id: 'IN_REVIEW', title: 'Review' },
    { id: 'DONE', title: 'Done' }
];

type TabType = 'BOARD' | 'METRICS' | 'MEMBERS';

export default function ProjectDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { addNotification } = useNotifications();
    const { employee: authEmployee } = useAuth();
    
    const [activeTab, setActiveTab] = useState<TabType>('BOARD');
    
    const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [syncing, setSyncing] = useState<string | null>(null);

    const userRole = authEmployee ? getResolvedRole(authEmployee.roleId) : 'EMPLOYEE';
    const isAdmin = userRole === 'ADMIN' || userRole === 'MANAGER';

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const { data: project, isLoading: isProjectLoading, refetch: refetchProject } = useProjectDetail(String(id));
    const { data: rawTasks = [], isLoading: isTasksLoading, refetch: refetchTasks } = useTasks(undefined, undefined, 500, String(id));
    const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();
    const { mutateAsync: deleteProject } = useDeleteProject();
    const { data: employees = [], isLoading: isEmployeesLoading } = useEmployees({ limit: 1000 });
    const { mutateAsync: addProjectMember } = useAddProjectMember();
    const { mutateAsync: removeProjectMember } = useRemoveProjectMember();

    const isMember = (employeeId: string) => {
        return project?.members?.some((m: any) => m.userId === employeeId);
    };

    const handleAddMember = async (employeeId: string) => {
        if (!project) return;
        setSyncing(employeeId);
        try {
            await addProjectMember({ projectId: project.id, userId: employeeId, role: 'MEMBER' });
            addNotification({ title: 'Access Granted', message: 'Member successfully assigned.', type: 'success' });
            refetchProject();
        } catch (err) {
            addNotification({ title: 'Error', message: 'Could not assign member.', type: 'error' });
        } finally {
            setSyncing(null);
        }
    };

    const handleRemoveMember = async (employeeId: string) => {
        if (!project) return;
        const membership = project?.members?.find((m: any) => m.userId === employeeId);
        if (!membership) return;

        setSyncing(employeeId);
        try {
            await removeProjectMember({ id: membership.id, projectId: project.id });
            addNotification({ title: 'Access Revoked', message: 'Member successfully removed.', type: 'info' });
            refetchProject();
        } catch (err) {
            addNotification({ title: 'Error', message: 'Could not remove member.', type: 'error' });
        } finally {
            setSyncing(null);
        }
    };

    const loading = isProjectLoading || isTasksLoading || isEmployeesLoading;

    const tasks = useMemo(() => {
        const employeeMap = new Map<string, EmployeeDTO>();
        employees.forEach((e: EmployeeDTO) => employeeMap.set(e.id, e));

        return rawTasks.map((t: TaskDTO) => ({
            ...t,
            assignees: (t.assigneeIds || [])
                .map((aid: string) => employeeMap.get(aid))
                .filter((e): e is EmployeeDTO => !!e)
                .map(e => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, profilePhoto: e.profilePhoto }))
        }));
    }, [rawTasks, employees]);

    const stats = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter((t: any) => t.status === 'DONE' || t.status === 'APPROVED').length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const byStatus = {
            todo: tasks.filter((t: any) => t.status === 'TODO').length,
            inProgress: tasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
            review: tasks.filter((t: any) => t.status === 'IN_REVIEW' || t.status === 'SUBMITTED').length,
        };

        const byPriority = {
            critical: tasks.filter((t: any) => t.priority === 'CRITICAL').length,
            high: tasks.filter((t: any) => t.priority === 'HIGH').length,
            medium: tasks.filter((t: any) => t.priority === 'MEDIUM').length,
            low: tasks.filter((t: any) => t.priority === 'LOW').length,
        };

        const overdue = tasks.filter((t: any) => {
            if (t.status === 'DONE' || t.status === 'APPROVED') return false;
            if (!t.dueDate) return false;
            return new Date(t.dueDate) < new Date();
        }).length;

        return { total, completed, progress, byStatus, byPriority, overdue };
    }, [tasks]);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const activeTask = tasks.find(t => t.id === active.id);
        if (!activeTask) return;

        let newStatus = over.data.current?.type === 'Column' ? over.data.current.status : over.data.current?.task.status;
        if (newStatus && newStatus !== activeTask.status) {
            try {
                await updateTaskStatus({ id: active.id as string, status: newStatus as string });
            } catch (err: any) {
                refetchTasks();
                addNotification({ title: 'Sync Error', message: err.message, type: 'error' });
            }
        }
    };

    const handleDeleteProject = async () => {
        if (!confirm('Are you absolutely sure you want to delete this project? This action cannot be undone and will delete all associated tasks.')) return;
        try {
            await deleteProject(String(id));
            addNotification({ title: 'Success', message: 'Project deleted successfully.', type: 'success' });
            router.push('/projects');
        } catch (err: any) {
            addNotification({ title: 'Error', message: err.message || 'Failed to delete project.', type: 'error' });
        }
    };

    if (loading || !project) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    return (
        <div className="project-detail-page page-root fade-in">
            {/* CONDENSED HEADER */}
            <div className="detail-top-nav">
                <div className="nav-left">
                    <div className="back-circle" onClick={() => router.push('/projects')}>
                        <ChevronLeft size={18} />
                    </div>
                    <div className="title-wrap">
                        <h1>{project.name}</h1>
                        <p>Objective: {project.status || 'Active Operations'}</p>
                    </div>
                </div>

                <div className="detail-tabs">
                    <button className={`tab-btn ${activeTab === 'BOARD' ? 'active' : ''}`} onClick={() => setActiveTab('BOARD')}>
                        <LayoutGrid size={14} /> Tactical Board
                    </button>
                    <button className={`tab-btn ${activeTab === 'METRICS' ? 'active' : ''}`} onClick={() => setActiveTab('METRICS')}>
                        <BarChart3 size={14} /> Analytics
                    </button>
                    <button className={`tab-btn ${activeTab === 'MEMBERS' ? 'active' : ''}`} onClick={() => setActiveTab('MEMBERS')}>
                        <Users size={14} /> Members
                    </button>
                </div>

                <div className="nav-right">
                    {isAdmin && (
                        <Button variant="primary" size="sm" onClick={() => setIsAllocateModalOpen(true)}>
                            <Plus size={16} /> New Task
                        </Button>
                    )}
                    {isAdmin && (
                        <button className="icon-btn-ghost" onClick={() => setIsEditModalOpen(true)} title="Edit Project">
                            <Edit3 size={16} />
                        </button>
                    )}
                    {isAdmin && (
                        <button className="icon-btn-danger" onClick={handleDeleteProject} title="Delete Project">
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* TAB CONTENT AREA */}
            <div className="tab-content-area">
                {activeTab === 'BOARD' && (
                    <div className="board-wrapper slide-up">
                        {tasks.length > 0 ? (
                            <DndContext 
                                sensors={sensors} 
                                collisionDetection={closestCorners} 
                                onDragStart={(e) => setActiveId(e.active.id as string)}
                                onDragEnd={handleDragEnd}
                            >
                                <div className="kanban-board">
                                    {COLUMNS.map(col => (
                                        <KanbanColumn 
                                            key={col.id} 
                                            id={col.id} 
                                            title={col.title} 
                                            count={tasks.filter(t => t.status === col.id).length}
                                            onAddCard={() => {
                                                setNewTaskStatus(col.id);
                                                setIsAllocateModalOpen(true);
                                            }}
                                        >
                                            <SortableContext items={tasks.filter(t => t.status === col.id).map(t => t.id)} strategy={verticalListSortingStrategy}>
                                                {tasks.filter(t => t.status === col.id).map(task => (
                                                    <SortableCard key={task.id} task={task} onClick={() => { setSelectedTaskId(task.id); setIsDrawerOpen(true); }} />
                                                ))}
                                            </SortableContext>
                                        </KanbanColumn>
                                    ))}
                                </div>

                                <DragOverlay>
                                    {activeId ? (
                                        <div style={{ transform: 'rotate(2deg)', cursor: 'grabbing' }}>
                                            <SortableCard 
                                                task={tasks.find(t => t.id === activeId)!} 
                                                onClick={() => {}} 
                                            />
                                        </div>
                                    ) : null}
                                </DragOverlay>
                            </DndContext>
                        ) : (
                            <div className="empty-backlog-container">
                                <Target size={64} style={{ opacity: 0.1 }} />
                                <h2>No units identified</h2>
                                <p>Initialize tactical units to begin operations on this initiative.</p>
                                {isAdmin && (
                                    <Button variant="primary" onClick={() => setIsAllocateModalOpen(true)}>
                                        <Plus size={18} /> Identify First Unit
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'METRICS' && (
                    <div className="metrics-wrapper slide-up">
                        <div className="project-stats-grid">
                            <GlassCard className="detail-stat-card">
                                <div className="stat-label">System Progress</div>
                                <div className="stat-value">{stats.progress}%</div>
                                <div className="stat-progress" style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginTop: '12px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: 'var(--purple-main)', width: `${stats.progress}%` }}></div>
                                </div>
                            </GlassCard>
                            <GlassCard className="detail-stat-card">
                                <div className="stat-label">Operational Health</div>
                                <div className="stat-value" style={{ color: stats.overdue > 0 ? '#ef4444' : '#10b981' }}>
                                    {stats.overdue > 0 ? `${stats.overdue} Overdue Tasks` : 'Optimized'}
                                </div>
                                <p style={{ fontSize: '0.8rem', opacity: 0.4, marginTop: '8px' }}>Real-time synchronization with tactical units is active.</p>
                            </GlassCard>
                            <GlassCard className="detail-stat-card">
                                <div className="stat-label">Final Milestone</div>
                                <div className="stat-value">{project.deadline ? new Date(project.deadline).toLocaleDateString() : 'Continuous'}</div>
                                <p style={{ fontSize: '0.8rem', opacity: 0.4, marginTop: '8px' }}>Target date for mission parameters completion.</p>
                            </GlassCard>
                            <GlassCard className="detail-stat-card">
                                <div className="stat-label">Task Status Breakdown</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.85rem' }}>
                                    <span>To Do: <strong>{stats.byStatus.todo}</strong></span>
                                    <span>In Progress: <strong>{stats.byStatus.inProgress}</strong></span>
                                    <span>Review: <strong>{stats.byStatus.review}</strong></span>
                                    <span>Done: <strong>{stats.completed}</strong></span>
                                </div>
                            </GlassCard>
                            <GlassCard className="detail-stat-card" style={{ gridColumn: 'span 2' }}>
                                <div className="stat-label">Priority Distribution</div>
                                <div style={{ display: 'flex', gap: '24px', marginTop: '12px' }}>
                                    <div style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>CRITICAL</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ef4444' }}>{stats.byPriority.critical}</div>
                                    </div>
                                    <div style={{ flex: 1, background: 'rgba(249, 115, 22, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #f97316' }}>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>HIGH</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f97316' }}>{stats.byPriority.high}</div>
                                    </div>
                                    <div style={{ flex: 1, background: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>MEDIUM</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#3b82f6' }}>{stats.byPriority.medium}</div>
                                    </div>
                                    <div style={{ flex: 1, background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #22c55e' }}>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>LOW</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#22c55e' }}>{stats.byPriority.low}</div>
                                    </div>
                                </div>
                            </GlassCard>
                        </div>
                    </div>
                )}

                {activeTab === 'MEMBERS' && (
                    <div className="force-wrapper slide-up">
                        {isAdmin && (
                            <div className="emp-search" style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0 16px', marginBottom: '24px' }}>
                                <Search size={16} color="rgba(255,255,255,0.4)" />
                                <input 
                                    placeholder="Search personnel to add or manage..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', padding: '16px 12px', width: '100%', fontSize: '0.9rem' }}
                                />
                            </div>
                        )}
                        <div className="force-grid">
                            {(() => {
                                let displayList = isAdmin ? employees : (project.members?.map((m: any) => m.user || m) || []);
                                
                                if (searchQuery) {
                                    displayList = displayList.filter((e: any) => 
                                        `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        (e.designation || e.role)?.toLowerCase().includes(searchQuery.toLowerCase())
                                    );
                                }

                                if (isAdmin) {
                                    displayList = [...displayList].sort((a: any, b: any) => {
                                        const aMem = isMember(a.id);
                                        const bMem = isMember(b.id);
                                        if (aMem && !bMem) return -1;
                                        if (!aMem && bMem) return 1;
                                        return 0;
                                    });
                                }

                                return displayList.length > 0 ? displayList.map((emp: any) => {
                                    const active = isMember(emp.id);
                                    const isSyncing = syncing === emp.id;
                                    
                                    return (
                                        <div key={emp.id} className="member-item" style={{ border: active ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(255,255,255,0.05)', background: active ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255,255,255,0.02)' }}>
                                            <div className="member-avatar">
                                                {emp.profilePhoto ? <img src={emp.profilePhoto} /> : <span>{emp.firstName?.charAt(0) || '?'}</span>}
                                            </div>
                                            <div className="member-info">
                                                <h4>{emp.firstName} {emp.lastName}</h4>
                                                <p>{emp.designation || emp.role}</p>
                                            </div>
                                            {isAdmin && (
                                                <div style={{ marginLeft: 'auto' }}>
                                                    {isSyncing ? (
                                                        <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                                                    ) : active ? (
                                                        <button 
                                                            onClick={() => handleRemoveMember(emp.id)}
                                                            style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}
                                                            title="Remove Member"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleAddMember(emp.id)}
                                                            style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: 'pointer' }}
                                                            title="Add Member"
                                                        >
                                                            <PlusCircle size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }) : (
                                    <p style={{ opacity: 0.3, padding: '40px', gridColumn: '1/-1', textAlign: 'center' }}>No personnel found.</p>
                                )
                            })()}
                        </div>
                    </div>
                )}
            </div>

            <AllocateTaskModal 
                isOpen={isAllocateModalOpen} 
                onClose={() => {
                    setIsAllocateModalOpen(false);
                    setNewTaskStatus(null);
                }} 
                onSuccess={() => refetchTasks()} 
                projectId={String(id)} 
                initialStatus={newTaskStatus || undefined}
            />
            <EditProjectModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    refetchProject();
                }}
                project={project}
            />
            <TaskDetailDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} taskId={selectedTaskId || ''} onUpdate={() => refetchTasks()} currentUserRole={userRole} />
        </div>
    );
}
