'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { User, Paperclip, CheckSquare, MoreHorizontal, Clock, AlertCircle, ChevronUp, Minus, ChevronDown } from 'lucide-react';
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
        task.priority === 'CRITICAL' || task.priority === 'HIGH' ? '#ef4444' : 
        task.priority === 'MEDIUM' ? '#f59e0b' : 
        task.priority === 'LOW' ? '#10b981' : 'transparent';

    const priorityBg = 
        task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'rgba(239, 68, 68, 0.1)' : 
        task.priority === 'MEDIUM' ? 'rgba(245, 158, 11, 0.1)' : 
        task.priority === 'LOW' ? 'rgba(16, 185, 129, 0.1)' : 'transparent';

    const formattedDate = new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isPastDue = new Date(task.dueDate) < new Date() && task.status !== 'DONE';

    let totalChecklistItems = 0;
    let completedChecklistItems = 0;
    if (task.description) {
        const lines = task.description.split('\n');
        for (const line of lines) {
            const match = line.match(/^- \[([ xX])\] (.*)/);
            if (match) {
                totalChecklistItems++;
                if (match[1] !== ' ') {
                    completedChecklistItems++;
                }
            }
        }
    }

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
                <div className="trello-card-body" style={{ position: 'relative' }}>
                    {task.projectId ? (
                        /* Project tasks: both badges on same row */
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ 
                                fontSize: '0.62rem', fontWeight: 700, color: 'var(--purple-main)', 
                                background: 'rgba(139, 92, 246, 0.1)', padding: '2px 7px', 
                                borderRadius: '4px', border: '1px solid rgba(139,92,246,0.2)',
                                maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {(() => {
                                    const name = (task as any).projectName as string | undefined;
                                    if (!name) return 'Project';
                                    return name.length > 22 ? name.slice(0, 22) + '…' : name;
                                })()}
                            </div>
                            <div style={{ 
                                fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', 
                                borderRadius: '12px', background: priorityBg, color: priorityColor,
                                border: `1px solid ${priorityColor}40`, whiteSpace: 'nowrap', flexShrink: 0
                            }}>
                                {task.priority}
                            </div>
                        </div>
                    ) : (
                        /* Standalone tasks: priority badge floats top-right, no gap */
                        <div style={{ 
                            position: 'absolute', top: '16px', right: '16px',
                            fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', 
                            borderRadius: '12px', background: priorityBg, color: priorityColor,
                            border: `1px solid ${priorityColor}40`
                        }}>
                            {task.priority}
                        </div>
                    )}

                    <h3 className="trello-card-title" style={{ marginTop: 0, paddingRight: task.projectId ? 0 : '52px' }}>{task.title}</h3>
                    
                    <div className="trello-card-meta">
                        {task.status === 'DONE' ? (
                            <div className="trello-status-icon done">
                                <CheckSquare size={14} />
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className={`trello-date-badge ${isPastDue ? 'overdue' : ''}`}>
                                    <Clock size={12} />
                                    <span>{formattedDate}</span>
                                </div>
                                {totalChecklistItems > 0 && (
                                    <div className="trello-checklist-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: completedChecklistItems === totalChecklistItems ? '#10b981' : 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                        <CheckSquare size={12} />
                                        <span>{completedChecklistItems}/{totalChecklistItems}</span>
                                    </div>
                                )}
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

