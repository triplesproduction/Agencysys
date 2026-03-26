'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, User, Shield, ShieldAlert } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import DeadlineIndicator from '@/components/DeadlineIndicator';
import Button from '@/components/Button';
import AllocateTaskModal from '@/components/tasks/AllocateTaskModal';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { api } from '@/lib/api';
import { TaskDTO } from '@/types/dto';
import './Tasks.css';

export default function TasksPage() {
    const [tasks, setTasks] = useState<TaskDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
    const [userRole, setUserRole] = useState('EMPLOYEE');

    const router = useRouter();
    const { addNotification } = useNotifications();

    const loadTasks = async () => {
        setLoading(true);
        try {
            const { getUserFromToken } = await import('@/lib/auth');
            const tokenData = getUserFromToken();
            let activeRole = tokenData?.role || tokenData?.roleId || 'EMPLOYEE';
            activeRole = activeRole.toUpperCase();
            if (activeRole.includes('ADMIN')) activeRole = 'ADMIN';
            else if (activeRole.includes('MANAGER')) activeRole = 'MANAGER';

            setUserRole(activeRole);
            const activeEmpId = tokenData?.sub || tokenData?.employeeId;

            // Employees only fetch their own tasks
            const data = await api.getTasks(activeRole === 'EMPLOYEE' ? activeEmpId : undefined);
            setTasks(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('Failed to load tasks:', err);
            addNotification({
                title: 'Load Error',
                message: err.message || 'Could not fetch tasks. Please check server connection.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();

        const handleLiveUpdate = (e: any) => {
            const detail = e.detail;
            if (detail?.type === 'TASK_ASSIGNED' || detail?.type === 'TASK_UPDATED') {
                loadTasks(); // Live refresh!
            }
        };

        window.addEventListener('app:live-notification', handleLiveUpdate);
        return () => window.removeEventListener('app:live-notification', handleLiveUpdate);
    }, []);

    const handleAllocationSuccess = () => {
        addNotification({
            title: 'Task Allocated',
            message: 'Task allocated successfully!',
            type: 'TASK_ASSIGNED'
        });
        loadTasks(); // Refresh board gracefully
    };

    if (loading) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    return (
        <div className="tasks-page fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0' }}>
                <div>
                    <h1 className="greeting" style={{ margin: 0 }}>{userRole === 'EMPLOYEE' ? 'My Tasks' : 'Task Allocation'}</h1>
                    <p className="subtitle" style={{ margin: '4px 0 0 0', opacity: 0.6 }}>{userRole === 'EMPLOYEE' ? 'Track and update your assigned work.' : 'Manage and assign tasks across your team.'}</p>
                </div>
                {userRole !== 'EMPLOYEE' && (
                    <Button
                        variant="primary"
                        className="magnetic-btn"
                        onClick={() => setIsAllocateModalOpen(true)}
                        style={{ gap: '0.5rem', display: 'flex', alignItems: 'center', background: 'var(--purple-main)', border: 'none' }}
                    >
                        <Plus size={18} /> Allocate Task
                    </Button>
                )}
            </header>

            <section className="kanban-board">
                {['TODO', 'IN_PROGRESS', 'DONE'].map(status => (
                    <div key={status} className="kanban-column">
                        <header className="kanban-column-header">
                            <div className="column-info">
                                <div className={`status-dot ${status.toLowerCase()}`}></div>
                                <h2>{status === 'IN_PROGRESS' ? 'Planned/In Progress' : status.replace('_', ' ')}</h2>
                                <span className="column-count">{tasks.filter(t => t.status === status).length}</span>
                            </div>
                            {userRole !== 'EMPLOYEE' && (
                                <button className="add-task-inline" onClick={() => setIsAllocateModalOpen(true)}>
                                    <Plus size={16} />
                                </button>
                            )}
                        </header>

                        <div className="kanban-cards-container custom-scrollbar">
                            {tasks.filter(t => t.status === status).map(task => (
                                <GlassCard
                                    key={task.id}
                                    className="kanban-card"
                                    hoverable
                                    onClick={() => router.push(`/tasks/${task.id}`)}
                                >
                                    <div className="card-top">
                                        <div className={`priority-tag ${task.priority.toLowerCase()}`}>
                                            {task.priority}
                                        </div>
                                        <button className="card-more"><Plus size={14} style={{ transform: 'rotate(45deg)', opacity: 0.5 }} /></button>
                                    </div>
                                    
                                    <h3 className="card-title">{task.title}</h3>
                                    
                                    {task.description && (
                                        <p className="card-description">{task.description.length > 60 ? task.description.slice(0, 60) + '...' : task.description}</p>
                                    )}

                                    <div className="card-footer">
                                        <div className="card-assignees">
                                            <div className="avatar-stack">
                                                {task.assignee?.profilePhoto ? (
                                                    <img src={task.assignee.profilePhoto} alt="av" className="stack-avatar" />
                                                ) : (
                                                    <div className="stack-avatar placeholder">
                                                        {task.assignee?.firstName?.charAt(0) || <User size={10} />}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="assignee-name">{task.assignee?.firstName || 'User'}</span>
                                        </div>
                                        
                                        <div className="card-meta">
                                            <DeadlineIndicator deadline={task.dueDate} status={task.status} />
                                        </div>
                                    </div>
                                </GlassCard>
                            ))}
                            {userRole !== 'EMPLOYEE' && (
                                <button className="column-add-footer" onClick={() => setIsAllocateModalOpen(true)}>
                                    <Plus size={14} /> Add Task
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </section>

            <AllocateTaskModal
                isOpen={isAllocateModalOpen}
                onClose={() => setIsAllocateModalOpen(false)}
                onSuccess={handleAllocationSuccess}
            />
        </div>
    );
}
