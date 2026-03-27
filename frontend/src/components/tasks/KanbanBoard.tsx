'use client';

import React, { useState, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import KanbanColumn from './KanbanColumn';
import DraggableTaskCard, { TaskCardProps, TaskCardDisplay } from './DraggableTaskCard';
import { api } from '@/lib/api';
import './KanbanBoard.css';

const COLUMNS = [
    { id: 'TODO', title: 'Pending' },
    { id: 'IN_PROGRESS', title: 'In Progress' },
    { id: 'SUBMITTED', title: 'Submitted' },
    { id: 'APPROVED', title: 'Approved' },
    { id: 'REJECTED', title: 'Rejected' },
    { id: 'MISSED_DEADLINE', title: 'Missed Deadline' },
];

export default function KanbanBoard({ refreshFlag = 0 }: { refreshFlag?: number }) {
    const [tasks, setTasks] = useState<TaskCardProps[]>([]);
    const [activeTask, setActiveTask] = useState<TaskCardProps | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), // Strict 8px threshold mapped
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Mock initial fetch (Will wire to actual API)
    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const data = await api.getTasks();
                const mapped = data.map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    assigneeName: t.assignee?.firstName ? `${t.assignee.firstName} ${t.assignee.lastName}` : t.assigneeId, 
                    priority: t.priority,
                    status: t.status,
                    dueDate: t.dueDate,
                }));
                setTasks(mapped);
            } catch (err) {
                console.error("Failed to load tasks:", err);
            }
        };
        fetchTasks();
    }, [refreshFlag]);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const task = tasks.find(t => t.id === active.id);
        if (task) setActiveTask(task);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTask(null);

        if (!over) return; // Dropped outside a valid zone

        const taskId = active.id as string;
        const newStatus = over.id as string;

        const taskToUpdate = tasks.find(t => t.id === taskId);
        if (!taskToUpdate || taskToUpdate.status === newStatus) return; // No change

        // Optimistic UI Update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

        // Network Sync to Backend -> Triggers Notification WebSocket & KPIs natively
        try {
            await api.updateTaskStatus(taskId, newStatus);
        } catch (err) {
            console.error('Failed to sync Kanban drop event', err);
            // On failure, we'd ideally revert the optimistic UI
        }
    };

    return (
        <div className="kanban-board-container fade-in slide-up">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="kanban-columns-wrapper scroll-smooth">
                    {COLUMNS.map(col => (
                        <KanbanColumn
                            key={col.id}
                            id={col.id}
                            title={col.title}
                            tasks={tasks.filter(t => t.status === col.id)}
                        />
                    ))}
                </div>

                {/* The Floating Element while Dragging */}
                {typeof document !== 'undefined' && (
                    <DragOverlay
                        dropAnimation={null}
                        modifiers={[]}
                        zIndex={9999}
                        className="fixed-drag-overlay"
                    >
                        {activeTask ? <TaskCardDisplay task={activeTask} /> : null}
                    </DragOverlay>
                )}
            </DndContext>
        </div>
    );
}
