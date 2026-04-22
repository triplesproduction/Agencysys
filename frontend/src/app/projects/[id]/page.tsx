'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    Plus, ChevronLeft, Calendar, Clock, 
    CheckCircle2, Users, Target, Activity,
    Flame, Briefcase, Zap, MoreVertical, LayoutGrid, CheckCircle, BarChart3, ShieldCheck
} from 'lucide-react';
import Button from '@/components/Button';
import GlassCard from '@/components/GlassCard';
import AllocateTaskModal from '@/components/tasks/AllocateTaskModal';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import ManageProjectMembersModal from '@/components/projects/ManageProjectMembersModal';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { api } from '@/lib/api';
import { ProjectDTO, TaskDTO, EmployeeDTO } from '@/types/dto';
import { useAuth } from '@/context/AuthContext';
import { getResolvedRole } from '@/lib/permissions';

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

const COLUMNS = [
    { id: 'TODO', title: 'To Do' },
    { id: 'IN_PROGRESS', title: 'In Progress' },
    { id: 'IN_REVIEW', title: 'Review' },
    { id: 'DONE', title: 'Done' }
];

type TabType = 'BOARD' | 'METRICS' | 'FORCE';

export default function ProjectDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { addNotification } = useNotifications();
    const { employee: authEmployee } = useAuth();
    
    const [project, setProject] = useState<ProjectDTO | null>(null);
    const [tasks, setTasks] = useState<TaskDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('BOARD');
    
    const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    const userRole = authEmployee ? getResolvedRole(authEmployee.roleId) : 'EMPLOYEE';
    const isAdmin = userRole === 'ADMIN' || userRole === 'MANAGER';

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [projData, tasksData, empsData] = await Promise.all([
                api.getProjectById(String(id)),
                api.getTasks(undefined, undefined, 500, String(id)),
                api.getEmployees({ limit: 1000 })
            ]);

            const employeeMap = new Map<string, EmployeeDTO>();
            (empsData.data || []).forEach((e: EmployeeDTO) => employeeMap.set(e.id, e));

            const hydratedTasks = (tasksData || []).map((t: TaskDTO) => ({
                ...t,
                assignees: (t.assigneeIds || [])
                    .map((aid: string) => employeeMap.get(aid))
                    .filter((e): e is EmployeeDTO => !!e)
                    .map(e => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, profilePhoto: e.profilePhoto }))
            }));

            setProject(projData);
            setTasks(hydratedTasks as TaskDTO[]);
        } catch (err) {
            console.error('Failed to load project details:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const stats = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'DONE' || t.status === 'APPROVED').length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, progress };
    }, [tasks]);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const activeTask = tasks.find(t => t.id === active.id);
        if (!activeTask) return;

        let newStatus = over.data.current?.type === 'Column' ? over.data.current.status : over.data.current?.task.status;
        if (newStatus && newStatus !== activeTask.status) {
            setTasks(prev => prev.map(t => t.id === active.id ? { ...t, status: newStatus as any } : t));
            try {
                await api.updateTaskStatus(active.id as string, newStatus);
                loadData();
            } catch (err: any) {
                loadData();
                addNotification({ title: 'Sync Error', message: err.message, type: 'error' });
            }
        }
    };

    if (loading || !project) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    return (
        <div className="project-detail-page fade-in">
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
                    <button className={`tab-btn ${activeTab === 'FORCE' ? 'active' : ''}`} onClick={() => setActiveTab('FORCE')}>
                        <Users size={14} /> Force Detail
                    </button>
                </div>

                <div className="nav-right">
                    {isAdmin && activeTab === 'BOARD' && (
                        <Button variant="primary" size="sm" onClick={() => setIsAllocateModalOpen(true)}>
                            <Plus size={16} /> New Unit
                        </Button>
                    )}
                    {isAdmin && activeTab === 'FORCE' && (
                        <Button variant="secondary" size="sm" onClick={() => setIsManageMembersOpen(true)}>
                            <ShieldCheck size={16} /> Manage Force
                        </Button>
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
                                        <KanbanColumn key={col.id} id={col.id} title={col.title} count={tasks.filter(t => t.status === col.id).length}>
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
                                <div className="stat-value" style={{ color: '#10b981' }}>Optimized</div>
                                <p style={{ fontSize: '0.8rem', opacity: 0.4, marginTop: '8px' }}>Real-time synchronization with tactical units is active.</p>
                            </GlassCard>
                            <GlassCard className="detail-stat-card">
                                <div className="stat-label">Final Milestone</div>
                                <div className="stat-value">{project.deadline ? new Date(project.deadline).toLocaleDateString() : 'Continuous'}</div>
                                <p style={{ fontSize: '0.8rem', opacity: 0.4, marginTop: '8px' }}>Target date for mission parameters completion.</p>
                            </GlassCard>
                            <GlassCard className="detail-stat-card">
                                <div className="stat-label">Current Momentum</div>
                                <div className="stat-value">{stats.completed} Done</div>
                                <p style={{ fontSize: '0.8rem', opacity: 0.4, marginTop: '8px' }}>Units successfully pushed through the operational pipeline.</p>
                            </GlassCard>
                        </div>
                    </div>
                )}

                {activeTab === 'FORCE' && (
                    <div className="force-wrapper slide-up">
                        <div className="force-grid">
                            {project.members && project.members.length > 0 ? project.members.map(m => (
                                <div key={m.id} className="member-item">
                                    <div className="member-avatar">
                                        {m.user?.profilePhoto ? <img src={m.user.profilePhoto} alt="" /> : <span style={{ fontWeight: 800 }}>{m.user?.firstName?.[0]}</span>}
                                    </div>
                                    <div className="member-info">
                                        <h4>{m.user?.firstName} {m.user?.lastName}</h4>
                                        <p>{m.role || 'Specialist'}</p>
                                    </div>
                                </div>
                            )) : (
                                <p style={{ opacity: 0.3, padding: '40px', gridColumn: '1/-1', textAlign: 'center' }}>No specialist units assigned to this initiative.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <AllocateTaskModal isOpen={isAllocateModalOpen} onClose={() => setIsAllocateModalOpen(false)} onSuccess={loadData} projectId={String(id)} />
            <TaskDetailDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} taskId={selectedTaskId || ''} onUpdate={loadData} currentUserRole={userRole} />
            {project && (
                <ManageProjectMembersModal 
                    isOpen={isManageMembersOpen} 
                    onClose={() => setIsManageMembersOpen(false)} 
                    project={project}
                    onRefresh={loadData}
                />
            )}
        </div>
    );
}
