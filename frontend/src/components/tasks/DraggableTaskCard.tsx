'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Clock, User } from 'lucide-react';
import GlassCard from '../GlassCard';
import './DraggableTaskCard.css';

export interface TaskCardProps {
    id: string;
    title: string;
    assigneeName: string;
    priority: string;
    status: string;
    dueDate: string;
}

export function TaskCardDisplay({ task, className = '' }: { task: TaskCardProps, className?: string }) {
    const calculateTimeLeft = (deadline: string) => {
        const diff = new Date(deadline).getTime() - new Date().getTime();
        if (diff <= 0) return 'Expired';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        return hours > 24 ? `${Math.floor(hours / 24)}d left` : `${hours}h left`;
    };

    return (
        <div className={`draggable-card-wrapper ${className}`}>
            <GlassCard className={`task-card-ag priority-${task.priority.toLowerCase()} status-${task.status.toLowerCase()}`}>
                <div className="task-card-header">
                    <span className="task-priority-badge">{task.priority}</span>
                    <span className="task-status-dot" title={task.status} />
                </div>

                <h4 className="task-card-title">{task.title}</h4>

                <div className="task-card-footer">
                    <div className="task-assignee">
                        <User size={14} />
                        <span>{task.assigneeName}</span>
                    </div>
                    <div className={`task-deadline ${calculateTimeLeft(task.dueDate) === 'Expired' ? 'expired' : ''}`}>
                        <Clock size={14} />
                        <span>{calculateTimeLeft(task.dueDate)}</span>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}

export default function DraggableTaskCard({ task }: { task: TaskCardProps }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: task.id,
        data: {
            type: 'Task',
            task,
        },
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={{ opacity: isDragging ? 0.3 : 1 }}
        >
            <TaskCardDisplay task={task} />
        </div>
    );
}
