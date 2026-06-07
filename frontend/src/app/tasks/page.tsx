'use client';

import { PageHeader } from '@/components/common/PageHeader';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Plus, User, Search, Filter, 
    LayoutGrid, List, SlidersHorizontal, 
    ArrowUpDown, AlertCircle
} from 'lucide-react';
import Button from '@/components/Button';
import AllocateTaskModal from '@/components/tasks/AllocateTaskModal';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { api } from '@/lib/api';
import { TaskDTO, EmployeeDTO } from '@/types/dto';

import './Tasks.css';
import './KanbanDrawer.css';

// DND Kit
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
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { KanbanColumn, SortableCard } from './KanbanComponents';
import { useAuth } from '@/context/AuthContext';
import { hasPermission, getResolvedRole } from '@/lib/permissions';
import { useTasks, useUpdateTaskStatus, useProjects } from '@/hooks/queries/domains/projects/useProjects';
import { taskKeys } from '@/hooks/queries/domains/projects/keys';
import { useEmployees } from '@/hooks/queries/domains/employees/useEmployees';
import { useQueryClient } from '@tanstack/react-query';

const COLUMNS = [
    { id: 'TODO', title: 'To Do' },
    { id: 'IN_PROGRESS', title: 'Planned / In Progress' },
    { id: 'IN_REVIEW', title: 'Under Review' },
    { id: 'SUBMITTED', title: 'Pending Approval' },
    { id: 'DONE', title: 'Completed' },
    { id: 'BLOCKED', title: 'On Hold / Blocked' }
];

export default function TasksPage() {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
    const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('ALL');
    const [assigneeFilter, setAssigneeFilter] = useState('ALL');

    const { addNotification } = useNotifications();
    const queryClient = useQueryClient();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const userRole = authEmployee ? getResolvedRole(authEmployee.roleId) : 'EMPLOYEE';
    const assigneeId = userRole === 'EMPLOYEE' ? authEmployee?.id : undefined;

    // React Query Hooks
    const { data: rawTasks, isLoading: tasksLoading } = useTasks(
        assigneeId, 
        undefined, 
        500, 
        undefined, 
        { enabled: !!authEmployee }
    );
    const { data: employeesList, isLoading: employeesLoading } = useEmployees(undefined, { enabled: !!authEmployee });
    const { data: projectsList } = useProjects(undefined, { enabled: !!authEmployee });
    const updateTaskStatusMutation = useUpdateTaskStatus();

    const loading = authLoading || tasksLoading || employeesLoading;
    const employees = employeesList || [];
    const projects = projectsList || [];

    const tasks = useMemo(() => {
        return (rawTasks || []).map(task => {
            const assignedDocs = employees.filter(e => 
                (task.assigneeIds && task.assigneeIds.includes(e.id)) || task.assigneeId === e.id
            );
            const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;
            return {
                ...task,
                projectName: project?.name || null,
                assignees: assignedDocs.length > 0 ? assignedDocs.map(e => ({
                    id: e.id,
                    firstName: e.firstName,
                    lastName: e.lastName,
                    profilePhoto: e.profilePhoto
                })) : (task.assignee ? [task.assignee] : [])
            };
        });
    }, [rawTasks, employees, projects]);

    // Derived State: Filtered Tasks
    const filteredTasks = useMemo(() => {
        const filteredTasks = tasks.filter(task => {
            const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesPriority = priorityFilter === 'ALL' || task.priority === priorityFilter;
            const matchesMember = assigneeFilter === 'ALL' || 
                                 task.assigneeId === assigneeFilter || 
                                 (task.assigneeIds && task.assigneeIds.includes(assigneeFilter));
            return matchesSearch && matchesPriority && matchesMember;
        }).sort((a, b) => {
            const aOrder = (a as any).order_index || 0;
            const bOrder = (b as any).order_index || 0;
            if (aOrder !== bOrder) return aOrder - bOrder;
            // Fallback to due date if order_index is the same (default)
            return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
        });
        return filteredTasks;
    }, [tasks, searchQuery, priorityFilter, assigneeFilter]);

    // DnD Handlers
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeTask = tasks.find(t => t.id === active.id);
        if (!activeTask) return;

        // Determine destination status
        let newStatus = activeTask.status;
        let overTask = null;
        
        // If dropped over a column
        if (over.data.current?.type === 'Column') {
            newStatus = over.data.current.status;
        } 
        // If dropped over another task
        else if (over.data.current?.type === 'Task') {
            newStatus = over.data.current.task.status;
            overTask = over.data.current.task;
        }

        const tasksInStatus = filteredTasks.filter(t => t.status === newStatus);

        if (newStatus === activeTask.status) {
            // Reorder within same column
            const oldIndex = tasksInStatus.findIndex(t => t.id === active.id);
            const newIndex = tasksInStatus.findIndex(t => t.id === over.id);
            if (oldIndex !== newIndex && newIndex !== -1) {
                const newTasks = arrayMove(tasksInStatus, oldIndex, newIndex);
                // Optimistic cache update
                queryClient.setQueriesData({ queryKey: taskKeys.all }, (old: any) => {
                    if (!old) return old;
                    return old.map((t: any) => {
                        const idx = newTasks.findIndex(nt => nt.id === t.id);
                        if (idx !== -1) return { ...t, order_index: idx * 1000 };
                        return t;
                    });
                });
                // Background update to DB
                Promise.all(newTasks.map((t, index) => {
                    if (((t as any).order_index || 0) !== index * 1000) {
                        return api.updateTask(t.id, { order_index: index * 1000 } as any);
                    }
                    return Promise.resolve();
                })).then(() => {
                    queryClient.invalidateQueries({ queryKey: taskKeys.all });
                }).catch(console.error);
            }
        } else {
            // Move to different column
            let newIndex = overTask ? tasksInStatus.findIndex(t => t.id === overTask.id) : tasksInStatus.length;
            if (newIndex === -1) newIndex = tasksInStatus.length;
            
            const newTasks = [...tasksInStatus];
            newTasks.splice(newIndex, 0, activeTask);

            // Optimistic cache update
            queryClient.setQueriesData({ queryKey: taskKeys.all }, (old: any) => {
                if (!old) return old;
                return old.map((t: any) => {
                    if (t.id === activeTask.id) return { ...t, status: newStatus, order_index: newIndex * 1000 };
                    const idx = newTasks.findIndex(nt => nt.id === t.id);
                    if (idx !== -1) return { ...t, order_index: idx * 1000 };
                    return t;
                });
            });

            // Background update to DB
            Promise.all(newTasks.map((t, index) => {
                if (t.id === activeTask.id) {
                    return api.updateTask(t.id, { status: newStatus, order_index: index * 1000 } as any);
                } else if (((t as any).order_index || 0) !== index * 1000) {
                    return api.updateTask(t.id, { order_index: index * 1000 } as any);
                }
                return Promise.resolve();
            })).then(() => {
                queryClient.invalidateQueries({ queryKey: taskKeys.all });
            }).catch((err: any) => {
                addNotification({ title: 'Move Failed', message: err.message || 'Status update failed.', type: 'error' });
                queryClient.invalidateQueries({ queryKey: taskKeys.all });
            });
        }
    };

    const canCreate = hasPermission(userRole, 'CREATE_TASKS');

    if (authLoading || loading) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

    return (
        <div className="tasks-page page-root fade-in">
            <PageHeader
                title="Taskboard"
                subtitle={<p className="subtitle">Team task orchestration.</p>}
                actions={
                    <div className="toolbar-actions">
                        <div className="search-pill">
                            <Search size={16} color="rgba(255,255,255,0.4)" />
                            <input 
                                placeholder="Search tasks..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        
                        <div className="filter-pill">
                            <SlidersHorizontal size={16} color="rgba(255,255,255,0.6)" />
                            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                                <option value="ALL">All Priorities</option>
                                <option value="CRITICAL">Critical</option>
                                <option value="HIGH">High</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="LOW">Low</option>
                            </select>
                        </div>

                        {userRole !== 'EMPLOYEE' && (
                            <div className="filter-pill">
                                <User size={16} color="rgba(255,255,255,0.6)" />
                                <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
                                    <option value="ALL">All Members</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.firstName} {emp.lastName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {canCreate && (
                            <Button 
                                variant="primary" 
                                onClick={() => setIsAllocateModalOpen(true)}
                                style={{ background: 'var(--purple-main)', border: 'none', borderRadius: '14px', height: '44px', fontWeight: 700, padding: '0 24px' }}
                            >
                                <Plus size={18} /> Allocate
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Kanban Workspace */}
            <DndContext 
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="kanban-board">
                    {COLUMNS.map(col => (
                        <KanbanColumn 
                            key={col.id} 
                            id={col.id} 
                            title={col.title}
                            count={filteredTasks.filter(t => t.status === col.id).length}
                            onAddCard={() => {
                                setNewTaskStatus(col.id);
                                setIsAllocateModalOpen(true);
                            }}
                        >
                            <SortableContext 
                                items={filteredTasks.filter(t => t.status === col.id).map(t => t.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {filteredTasks.filter(t => t.status === col.id).map(task => (
                                    <SortableCard 
                                        key={task.id} 
                                        task={task} 
                                        onClick={() => {
                                            setSelectedTaskId(task.id);
                                            setIsDrawerOpen(true);
                                        }}
                                    />
                                ))}
                            </SortableContext>
                            
                            {filteredTasks.filter(t => t.status === col.id).length === 0 && (
                                <div className="empty-column-state">
                                    <AlertCircle size={20} opacity={0.2} />
                                    <span>Empty List</span>
                                </div>
                            )}
                        </KanbanColumn>
                    ))}
                </div>

                <DragOverlay dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                        styles: {
                            active: {
                                opacity: '0.5',
                            },
                        },
                    }),
                }}>
                    {activeId && activeTask ? (
                        <div style={{ width: '340px' }}>
                            <SortableCard task={activeTask} onClick={() => {}} />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Modals & Drawers */}
            <AllocateTaskModal 
                isOpen={isAllocateModalOpen}
                onClose={() => {
                    setIsAllocateModalOpen(false);
                    setNewTaskStatus(null);
                }}
                onSuccess={() => {
                    addNotification({ title: 'Success', message: 'Task allocated successfully', type: 'success' });
                    queryClient.invalidateQueries({ queryKey: ['tasks'] });
                }}
                initialStatus={newTaskStatus || undefined}
            />

            <TaskDetailDrawer 
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                taskId={selectedTaskId || ''}
                onUpdate={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
                currentUserRole={userRole}
            />
        </div>
    );
}
