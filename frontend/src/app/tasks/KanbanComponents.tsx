'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { User, Paperclip, CheckSquare, MoreHorizontal, Clock } from 'lucide-react';
import { TaskDTO } from '@/types/dto';

interface SortableCardProps {
    task: TaskDTO;
    onClick: () => void;
}

export function SortableCard({ task, onClick }: SortableCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: task.id,
        data: {
            type: 'Task',
            task
        }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 1000 : 1,
    };

    const priorityColor = 
        task.priority === 'CRITICAL' || task.priority === 'HIGH' ? '#b91c1c' : 
        task.priority === 'MEDIUM' ? '#9a3412' : 
        task.priority === 'LOW' ? '#14532d' : null;

    const formattedDate = new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isPastDue = new Date(task.dueDate) < new Date() && task.status !== 'DONE';

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            {...attributes} 
            {...listeners}
            onClick={(e) => {
                // Prevent drag click interference
                const isDrag = transform !== null;
                if (!isDrag) onClick();
            }}
            className="kanban-card-wrapper"
        >
            <div className={`trello-card ${isDragging ? 'dragging' : ''}`}>
                <div className="trello-card-body">
                    <h3 className="trello-card-title">{task.title}</h3>
                    
                    <div className="trello-card-meta">
                        {task.status === 'DONE' ? (
                            <div className="trello-status-icon done">
                                <CheckSquare size={14} />
                            </div>
                        ) : (
                            <div className={`trello-date-badge ${isPastDue ? 'overdue' : ''}`}>
                                <Clock size={12} />
                                <span>{formattedDate}</span>
                            </div>
                        )}

                        <div className="card-avatar-stack">
                            {task.assignees && task.assignees.length > 0 ? (
                                task.assignees.slice(0, 3).map((assignee, idx) => (
                                    assignee.profilePhoto ? (
                                        <img key={assignee.id} src={assignee.profilePhoto} className="card-avatar" alt="avatar" style={{ zIndex: 10 - idx }} />
                                    ) : (
                                        <div key={assignee.id} className="card-avatar" style={{ zIndex: 10 - idx }}>
                                            {assignee.firstName?.charAt(0) || 'U'}
                                        </div>
                                    )
                                ))
                            ) : (
                                <div className="card-avatar" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }}>
                                    <User size={12} />
                                </div>
                            )}
                            {task.assignees && task.assignees.length > 3 && (
                                <div className="card-avatar avatar-more" style={{ zIndex: 0 }}>
                                    +{task.assignees.length - 3}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>

    );
}

interface KanbanColumnProps {
    id: string;
    title: string;
    count: number;
    onAddCard?: () => void;
    children: React.ReactNode;
}

export function KanbanColumn({ id, title, count, onAddCard, children }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
        data: {
            type: 'Column',
            status: id
        }
    });

    return (
        <div 
            ref={setNodeRef} 
            className={`kanban-column ${isOver ? 'column-over' : ''}`}
        >
            <header className="kanban-column-header">
                <div className="column-info">
                    <h2>{title}</h2>
                    <span className="column-count">{count}</span>
                </div>
                <MoreHorizontal size={18} className="column-more" />
            </header>
            
            <div className="kanban-cards-container custom-scrollbar">
                {children}
            </div>

            <footer className="column-footer">
                <button className="add-card-btn" onClick={onAddCard}>
                    <span>+ Add a card</span>
                </button>
            </footer>
        </div>
    );
}

export function AddColumnButton() {
    return (
        <div className="add-column-wrapper">
            <button className="add-list-btn">
                <span>+ Add another list</span>
            </button>
        </div>
    );
}

