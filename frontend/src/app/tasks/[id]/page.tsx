'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GlassCard from '@/components/GlassCard';
import DeadlineIndicator from '@/components/DeadlineIndicator';
import Button from '@/components/Button';
import TaskQualityRater from '@/components/tasks/TaskQualityRater';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { TaskDTO } from '@/types/dto';
import '../Tasks.css';

export default function TaskDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { employee } = useAuth();
    const [task, setTask] = useState<TaskDTO | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadTask() {
            if (!id) return;
            try {
                // @ts-ignore Since no backend getTaskById endpoint exists, mapping it manually isn't possible, keeping the mock approach commented or handled gracefully.
                // Assuming it'd exist: const data = await api.getTaskById(id as string);
                const list = await api.getTasks();
                const data = list.find(t => t.id === id) || null;
                setTask(data);
            } finally {
                setLoading(false);
            }
        }
        loadTask();
    }, [id]);

    if (loading) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    if (!task) {
        return (
            <div className="tasks-page fade-in">
                <GlassCard className="error-card">
                    <h2>Task Not Found</h2>
                    <p>The task you are looking for does not exist or has been removed.</p>
                    <Button onClick={() => router.push('/tasks')} style={{ marginTop: '1rem' }}>
                        Back to Tasks
                    </Button>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="task-detail-page fade-in">
            <Button variant="secondary" onClick={() => router.push('/tasks')} className="back-btn">
                ← Back to Tasks
            </Button>

            <GlassCard className="detail-card">
                <div className="detail-header">
                    <h1 className="detail-title">{task.title}</h1>
                    <div className="detail-badges">
                        <span className={`status-badge ${task.status.toLowerCase()}`}>
                            {task.status.replace('_', ' ')}
                        </span>
                        <span className={`status-badge priority-${task.priority.toLowerCase()}`}>
                            {task.priority} Prio
                        </span>
                    </div>
                </div>

                <div className="detail-meta-grid">
                    <div className="meta-item">
                        <span className="meta-label">Deadline</span>
                        <DeadlineIndicator deadline={task.dueDate} status={task.status} />
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">Assignee</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                            {task.assignee?.profilePhoto ? (
                                <img src={task.assignee.profilePhoto} alt="av" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--purple-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600 }}>
                                    {task.assignee?.firstName?.charAt(0) || 'U'}
                                </div>
                            )}
                            <span className="meta-value" style={{ fontSize: '1rem' }}>{task.assignee?.firstName} {task.assignee?.lastName}</span>
                        </div>
                    </div>
                </div>

                <div className="detail-content">
                    <h3 className="section-title">Description</h3>
                    <p className="detail-desc">{task.description}</p>
                    
                    {(employee?.roleId === 'MANAGER' || employee?.roleId === 'ADMIN') && (
                        <div style={{ marginTop: '2rem' }}>
                            <h3 className="section-title">Manager Assessment</h3>
                            <TaskQualityRater 
                                taskId={task.id} 
                                initialRating={task.quality_rating}
                                onRate={(val) => setTask({ ...task, quality_rating: val })}
                            />
                        </div>
                    )}
                </div>

                <div className="detail-actions">
                    <Button variant="primary">Start Work</Button>
                    <Button variant="glass">Log Hours</Button>
                </div>
            </GlassCard>
        </div>
    );
}
