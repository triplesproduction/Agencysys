'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import DraggableTaskCard, { TaskCardProps } from './DraggableTaskCard';
import './KanbanColumn.css';

interface KanbanColumnProps {
    id: string; // The status string (e.g. 'TODO', 'IN_PROGRESS')
    title: string;
    tasks: TaskCardProps[];
}

export default function KanbanColumn({ id, title, tasks }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id,
        data: {
            type: 'Column',
            title,
        }
    });

    return (
        <div className={`kanban-column-ag ${isOver ? 'is-over-column' : ''}`}>
            <div className="column-header-ag">
                <h3>{title}</h3>
                <span className="column-count">{tasks.length}</span>
            </div>

            <div ref={setNodeRef} className="column-dropzone scroll-smooth">
                {tasks.map(task => (
                    <DraggableTaskCard key={task.id} task={task} />
                ))}

                {tasks.length === 0 && (
                    <div className="empty-zone-phantom">Drop tasks here</div>
                )}
            </div>
        </div>
    );
}
