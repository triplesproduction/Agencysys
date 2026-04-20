'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    Plus, ChevronLeft, Calendar, Clock, 
    CheckCircle2, Users, Target, Activity,
    Flame, Briefcase, Zap, MoreVertical, LayoutGrid, CheckCircle
} from 'lucide-react';
import Button from '@/components/Button';
import GlassCard from '@/components/GlassCard';
import AllocateTaskModal from '@/components/tasks/AllocateTaskModal';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
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

export default function ProjectDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { addNotification } = useNotifications();
    const { employee: authEmployee } = useAuth();
    
    const [project, setProject] = useState<ProjectDTO | null>(null);
    const [tasks, setTasks] = useState<TaskDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    const userRole = authEmployee ? getResolvedRole(authEmployee.roleId) : 'EMPLOYEE';
    const canEdit = userRole === 'ADMIN' || userRole === 'MANAGER';

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

            const employeeMap = new Map();
            (empsData.data || []).forEach(e => employeeMap.set(e.id, e));

            const hydratedTasks = (tasksData || []).map(t => ({
                ...t,
                assignees: (t.assigneeIds || []).map(aid => employeeMap.get(aid)).filter(Boolean)
            }));

            setProject(projData);
            setTasks(hydratedTasks);
            
            if (projData) {
                let statusUpdated = false;
                let newStatus = projData.status;
                if (hydratedTasks.length === 0) newStatus = 'PLANNING';
                else if (hydratedTasks.every(t => t.status === 'DONE' || t.status === 'APPROVED')) newStatus = 'COMPLETED';
                else newStatus = 'ACTIVE';

                if (newStatus !== projData.status) {
                    await api.updateProject(projData.id, { status: newStatus as any });
                    statusUpdated = true;
                }
                if (statusUpdated) {
                    const freshProj = await api.getProjectById(projData.id);
                    setProject(freshProj);
                }
            }
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
            <div className="emp-header">
                <div>
                    <div className="project-breadcrumb" style={{ marginBottom: '8px', textTransform: 'none', letterSpacing: '0', fontSize: '0.8rem' }}>
                        <span className="breadcrumb-link" onClick={() => router.push('/projects')}>Projects</span>
                        <ChevronLeft size={12} style={{ opacity: 0.3 }} />
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>{project.name}</span>
                    </div>
                    <h1 className="emp-title">{project.name}</h1>
                    <div className="emp-stats-inline">
                        <span><Target size={13} /> {stats.progress}% Completion</span>
                        <span className="active"><CheckCircle size={13} /> {stats.completed}/{stats.total} Tactical Units</span>
                    </div>
                </div>
                <div className="emp-header-actions">
                    {canEdit && (
                        <button className="emp-action-btn-primary" onClick={() => setIsAllocateModalOpen(true)}>
                            <Plus size={16} /> New Unit
                        </button>
                    )}
                </div>
            </div>

            <div className="project-stats-grid" style={{ marginTop: '32px' }}>
                <GlassCard className="detail-stat-card">
                    <div className="stat-label">System Progress</div>
                    <div className="stat-value">{stats.progress}%</div>
                    <div className="stat-progress">
                        <div className="stat-progress-fill" style={{ width: `${stats.progress}%` }}></div>
                    </div>
                </GlassCard>
                <GlassCard className="detail-stat-card">
                    <div className="stat-label">Operational Health</div>
                    <div className="stat-value" style={{ color: '#10b981' }}>Optimized</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: '0.75rem' }}>No active bottlenecks</div>
                </GlassCard>
                <GlassCard className="detail-stat-card">
                    <div className="stat-label">Initiative Timeline</div>
                    <div className="stat-value" style={{ fontSize: '1.4rem' }}>{project.deadline ? new Date(project.deadline).toLocaleDateString() : 'Continuous'}</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: '0.75rem' }}>Final Milestone</div>
                </GlassCard>
                <GlassCard className="detail-stat-card">
                    <div className="stat-label">Force Strength</div>
                    <div className="stat-value">{project.members?.length || 0} Members</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: '0.75rem' }}>Active Personnel</div>
                </GlassCard>
            </div>

            <div className="detail-content-grid" style={{ marginTop: '32px' }}>
                <div className="backlog-section">
                    {tasks.length > 0 ? (
                        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                            <div className="kanban-board" style={{ marginTop: 0, gap: '16px' }}>
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
                        </DndContext>
                    ) : (
                        <div className="empty-backlog-container slide-up">
                            <Target size={64} style={{ opacity: 0.1 }} />
                            <h2>Backlog Dormant</h2>
                            <p>No tactical units have been initialized for the current project lifecycle.</p>
                            {canEdit && (
                                <Button variant="primary" style={{ borderRadius: '12px', height: '48px' }} onClick={() => setIsAllocateModalOpen(true)} icon={<Plus size={18} />}>
                                    Initialize First Unit
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <aside className="detail-sidebar">
                    <GlassCard className="team-card">
                        <div className="team-header">
                            <Users size={18} color="var(--purple-main)" />
                            <h3>Deployed Force</h3>
                        </div>
                        <div className="member-list">
                            {project.members && project.members.length > 0 ? project.members.map(m => (
                                <div key={m.id} className="member-item">
                                    <div className="member-avatar">
                                        {m.user?.profilePhoto ? <img src={m.user.profilePhoto} /> : <span>{m.user?.firstName?.[0]}</span>}
                                    </div>
                                    <div className="member-info">
                                        <div className="member-name">{m.user?.firstName} {m.user?.lastName}</div>
                                        <div className="member-role">{m.role}</div>
                                    </div>
                                </div>
                            )) : (
                                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>No specialists assigned.</p>
                            )}
                        </div>
                    </GlassCard>
                </aside>
            </div>

            <AllocateTaskModal isOpen={isAllocateModalOpen} onClose={() => setIsAllocateModalOpen(false)} onSuccess={loadData} projectId={String(id)} />
            <TaskDetailDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} taskId={selectedTaskId || ''} onUpdate={loadData} currentUserRole={userRole} />
        </div>
    );
}
