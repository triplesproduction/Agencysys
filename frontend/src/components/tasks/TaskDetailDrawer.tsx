'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, User, Calendar, Tag, FileText, CheckSquare, 
    MoreVertical, Paperclip, MessageSquare, 
    Clock, Trash2, ChevronRight, Activity, Star, Plus, Filter
} from 'lucide-react';

import { api } from '@/lib/api';
import { TaskDTO, EmployeeDTO } from '@/types/dto';
import Button from '../Button';
import TaskQualityRater from './TaskQualityRater';
import { useNotifications } from '../notifications/NotificationProvider';
import MarkdownEditor from '../common/MarkdownEditor';
import MultiMemberPicker from '../common/MultiMemberPicker';
import { useAuth } from '@/context/AuthContext';





interface TaskDetailDrawerProps {
    taskId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: () => void;
    currentUserRole: string;
}

export default function TaskDetailDrawer({ taskId, isOpen, onClose, onUpdate, currentUserRole }: TaskDetailDrawerProps) {
    const { employee: authEmployee } = useAuth();
    const [task, setTask] = useState<TaskDTO | null>(null);

    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'DETAILS' | 'CHECKLIST' | 'COMMENTS' | 'ACTIVITY'>('DETAILS');
    
    const { addNotification } = useNotifications();
    const [employees, setEmployees] = useState<EmployeeDTO[]>([]);


    const fetchTask = async () => {
        if (!taskId) return;
        setLoading(true);
        try {
            // Parallel load for efficiency
            const [tasksList, employeesData] = await Promise.all([
                api.getTasks(undefined, undefined, 500),
                api.getEmployees({ limit: 100 })
            ]);
            
            const found = (tasksList || []).find(t => t.id === taskId);
            setTask(found || null);
            if (employeesData && 'data' in employeesData) {
                setEmployees((employeesData as any).data);
            }
        } catch (err) {

            console.error('Failed to fetch task details:', err);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        if (isOpen && taskId) {
            fetchTask();
            setActiveTab('DETAILS');
        }
    }, [isOpen, taskId]);

    if (!isOpen) return null;

    const handleUpdateField = async (field: keyof TaskDTO, value: any) => {
        if (!task || !taskId) return;
        
        // Optimistic UI
        const prevTask = { ...task };
        setTask({ ...task, [field]: value });
        
        try {
            const updated = await api.updateTask(task.id, { [field]: value });
            setTask(updated);
            if (onUpdate) onUpdate();
        } catch (err: any) {
            setTask(prevTask); // Rollback
            addNotification({ title: 'Update Failed', message: err.message, type: 'error' });
        }
    };

    const isManagerOrAdmin = currentUserRole === 'MANAGER' || currentUserRole === 'ADMIN';

    return (
        <div className={`kanban-drawer-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
            <div className="kanban-drawer" onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <header className="drawer-header">
                    <div className="header-top">
                        <div className="task-identifier">
                            <CheckSquare size={16} color="var(--purple-main)" />
                            <span>T-ITEM-{task?.id.slice(0, 5).toUpperCase()}</span>
                        </div>
                        <div className="header-actions">
                            <button className="icon-btn-ghost"><MoreVertical size={18} /></button>
                            <button className="icon-btn-ghost close-btn" onClick={onClose}><X size={20} /></button>
                        </div>
                    </div>
                    
                    <div className="task-title-area">
                        {loading ? (
                            <div className="skeleton title-skeleton"></div>
                        ) : (
                            <h2 
                                className="drawer-title" 
                                contentEditable={isManagerOrAdmin}
                                suppressContentEditableWarning
                                onBlur={(e) => handleUpdateField('title', e.currentTarget.innerText)}
                            >
                                {task?.title}
                            </h2>
                        )}
                        <div className="drawer-subtitle">in list <strong>{task?.status?.replace('_', ' ')}</strong></div>
                    </div>
                </header>

                <div className="drawer-body custom-scrollbar">
                    {/* Main Content Area */}
                    <div className="drawer-main">
                        
                        {/* Tab Headers */}
                        <div className="drawer-tabs">
                            <button className={`tab-link ${activeTab === 'DETAILS' ? 'active' : ''}`} onClick={() => setActiveTab('DETAILS')}>Task Details</button>
                            <button className={`tab-link ${activeTab === 'CHECKLIST' ? 'active' : ''}`} onClick={() => setActiveTab('CHECKLIST')}>Checklist</button>
                            <button className={`tab-link ${activeTab === 'COMMENTS' ? 'active' : ''}`} onClick={() => setActiveTab('COMMENTS')}>Comments</button>
                            <button className={`tab-link ${activeTab === 'ACTIVITY' ? 'active' : ''}`} onClick={() => setActiveTab('ACTIVITY')}>History</button>
                        </div>

                        {activeTab === 'DETAILS' && (
                            <div className="tab-pane active fade-in">
                                {/* Status & Priority Row */}
                                <div className="meta-row">
                                    <div className="meta-group">
                                        <label className="meta-label">STATUS</label>
                                        <select 
                                            className={`status-select-btn ${task?.status?.toLowerCase() || 'todo'}`}
                                            value={task?.status || 'TODO'}
                                            onChange={(e) => handleUpdateField('status', e.target.value)}
                                        >
                                            <option value="TODO">To Do</option>
                                            <option value="IN_PROGRESS">In Progress</option>
                                            <option value="IN_REVIEW">In Review</option>
                                            <option value="DONE">Done</option>
                                            <option value="BLOCKED">Blocked</option>
                                        </select>
                                    </div>

                                    
                                    <div className="meta-group">
                                        <label className="meta-label">PRIORITY</label>
                                        <select 
                                            className={`priority-select-btn ${task?.priority.toLowerCase()}`}
                                            value={task?.priority}
                                            onChange={(e) => handleUpdateField('priority', e.target.value)}
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HIGH">High</option>
                                            <option value="CRITICAL">Critical</option>
                                        </select>
                                    </div>

                                    <div className="meta-group" style={{ flex: '1 1 100%', marginTop: '8px' }}>
                                        <MultiMemberPicker 
                                            label="ASSIGNEES"
                                            selectedIds={task?.assigneeIds || (task?.assigneeId ? [task.assigneeId] : [])}
                                            members={employees}
                                            onChange={(ids) => handleUpdateField('assigneeIds', ids)}
                                            readOnly={!isManagerOrAdmin}
                                        />
                                    </div>


                                </div>


                                {/* Description */}
                                <section className="drawer-section">
                                    <div className="section-header">
                                        <FileText size={18} color="rgba(255,255,255,0.4)" />
                                        <h3>Description</h3>
                                    </div>
                                    <MarkdownEditor 
                                        value={task?.description || ''}
                                        onChange={(val) => setTask(task ? { ...task, description: val } : null)}
                                        onBlur={() => handleUpdateField('description', task?.description || '')}
                                        readOnly={!isManagerOrAdmin}
                                    />
                                </section>


                                {/* Manager Assessment */}
                                {isManagerOrAdmin && task && (
                                     <section className="drawer-section premium-outline">
                                        <div className="section-header">
                                            <Star size={18} color="#f59e0b" />
                                            <h3>Performance Assessment</h3>
                                        </div>
                                        <TaskQualityRater 
                                            taskId={task.id}
                                            initialRating={task.quality_rating}
                                            onRate={(val) => setTask({ ...task, quality_rating: val })}
                                        />
                                        <div className="helper-text">Ratings affect employee KPI scores and monthly reports.</div>
                                     </section>
                                )}
                            </div>
                        )}

                        {activeTab === 'CHECKLIST' && (
                            <div className="tab-pane active fade-in">
                                <section className="drawer-section">
                                    <div className="section-header">
                                        <CheckSquare size={18} color="var(--purple-main)" />
                                        <h3>Execution Checklist</h3>
                                        <div className="progress-bar-container">
                                            <div className="progress-bar-fill" style={{ width: '40%' }}></div>
                                        </div>
                                    </div>
                                    <div className="checklist-items">
                                        <div className="check-item"><input type="checkbox" defaultChecked /> Initial Research</div>
                                        <div className="check-item"><input type="checkbox" defaultChecked /> Draft Prototype</div>
                                        <div className="check-item"><input type="checkbox" /> Final Implementation</div>
                                        <button className="btn-add-item"><Plus size={14} /> Add an item</button>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'COMMENTS' && (
                            <div className="tab-pane active fade-in">
                                <section className="drawer-section">
                                    <div className="section-header">
                                        <MessageSquare size={18} color="rgba(255,255,255,0.4)" />
                                        <h3>Comments</h3>
                                    </div>
                                    <div className="comment-feed custom-scrollbar">
                                        <div className="comment-item">
                                            <div className="avatar-small">S</div>
                                            <div className="comment-content">
                                                <div className="comment-user">Saurav Gupta <span>Yesterday at 4:12 PM</span></div>
                                                <p>I've pushed the initial design specs. Please review.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="comment-input-area">
                                        <div className="avatar-small">
                                            {authEmployee?.firstName?.charAt(0) || 'U'}
                                        </div>
                                        <input 
                                            className="comment-field" 
                                            placeholder="Write a comment..." 
                                        />
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'ACTIVITY' && (
                            <div className="tab-pane active fade-in">
                                <section className="drawer-section">
                                    <div className="section-header">
                                        <Activity size={18} color="rgba(255,255,255,0.4)" />
                                        <h3>Task History</h3>
                                    </div>
                                    <div className="activity-feed">
                                        <div className="activity-item">
                                            <Clock size={14} opacity={0.3} />
                                            <span>Task moved from <strong>TODO</strong> to <strong>IN PROGRESS</strong></span>
                                            <span className="activity-time">2 hours ago</span>
                                        </div>
                                        <div className="activity-item">
                                            <Clock size={14} opacity={0.3} />
                                            <span>Deadline updated to <strong>April 15, 2026</strong></span>
                                            <span className="activity-time">5 hours ago</span>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                    </div>


                    {/* Sidebar Area */}
                    <aside className="drawer-sidebar">
                        <div className="sidebar-group">
                            <label className="sidebar-label">SUGGESTED</label>
                            <button className="sidebar-btn" onClick={() => {
                                if (!authEmployee?.id) return;
                                const currentIds = task?.assigneeIds || [];
                                if (!currentIds.includes(authEmployee.id)) {
                                    handleUpdateField('assigneeIds', [...currentIds, authEmployee.id]);
                                }
                            }}>
                                <User size={14} /> Join
                            </button>
                        </div>
                        
                        <div className="sidebar-group">
                            <label className="sidebar-label">ADD TO CARD</label>
                            <button className="sidebar-btn" onClick={() => {
                                // Scroll to or focus assignees picker if needed, but here we just scroll
                                document.querySelector('.multi-picker-container')?.scrollIntoView({ behavior: 'smooth' });
                            }}>
                                <User size={14} /> Members
                            </button>
                            <button className="sidebar-btn"><Filter size={14} /> Labels</button>
                            <button className="sidebar-btn" onClick={() => setActiveTab('CHECKLIST')}>
                                <CheckSquare size={14} /> Checklist
                            </button>
                            <button className="sidebar-btn"><Clock size={14} /> Dates</button>
                            <button className="sidebar-btn"><Plus size={14} /> Attachment</button>
                        </div>
                        
                        <div className="sidebar-group">
                            <label className="sidebar-label">ACTIONS</label>
                            <button className="sidebar-btn" onClick={() => handleUpdateField('status', 'DONE')}>
                                <ChevronRight size={14} /> Complete
                            </button>
                            <button className="sidebar-btn" onClick={() => handleUpdateField('status', 'BLOCKED')}>
                                <Clock size={14} /> Hold
                            </button>
                            <button className="sidebar-btn danger" onClick={async () => {
                                if (!taskId) return;
                                if (confirm('Are you sure you want to delete this task?')) {
                                    try {
                                        await api.deleteTask(taskId); 
                                        addNotification({ title: 'Task Deleted', message: 'Task has been permanently removed.', type: 'success' });
                                        if (onUpdate) onUpdate();
                                        onClose();
                                    } catch (err: any) {
                                        addNotification({ title: 'Delete Failed', message: err.message, type: 'error' });
                                    }
                                }
                            }}>
                                <Trash2 size={14} /> Delete
                            </button>

                        </div>

                    </aside>
                </div>
            </div>
        </div>
    );
}

