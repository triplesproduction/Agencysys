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
        const updatedTask = { ...task, [field]: value };
        
        // Ensure that if we are updating assigneeIds, we keep the UI in sync
        // If we are updating assignees, keep the UI in sync
        if (field === 'assigneeIds' && Array.isArray(value)) {
            const assigned = employees.filter(e => value.includes(e.id));
            updatedTask.assignees = assigned.map(e => ({
                id: e.id,
                firstName: e.firstName,
                lastName: e.lastName,
                profilePhoto: e.profilePhoto
            }));
            updatedTask.assigneeIds = value;
            // Also update legacy assigneeId for compatibility (first one)
            if (value.length > 0) updatedTask.assigneeId = value[0];
        }

        setTask(updatedTask);
        
        try {
            const updated = await api.updateTask(task.id, { [field]: value });
            // Merge with local state to preserve virtual fields if needed (handled in api.ts now)
            setTask(prev => ({ ...prev, ...updated }));
            if (onUpdate) onUpdate();
        } catch (err: any) {
            setTask(prevTask); // Rollback
            addNotification({ title: 'Update Failed', message: err.message, type: 'error' });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !task) return;

        try {
            addNotification({ title: 'Uploading...', message: 'Sending file to secure storage.', type: 'info' });
            const res = await api.uploadFile(file);
            const currentAttachments = task.attachments || [];
            await handleUpdateField('attachments', [...currentAttachments, res.url]);
            addNotification({ title: 'Success', message: 'Attachment added successfully.', type: 'success' });
        } catch (err: any) {
            addNotification({ title: 'Upload Failed', message: err.message, type: 'error' });
        }
    };

    const normalizedRole = currentUserRole?.toUpperCase() || 'EMPLOYEE';
    const isManagerOrAdmin = normalizedRole.includes('ADMIN') || normalizedRole.includes('MANAGER');

    return (
        <div className={`kanban-drawer-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
            <div className="kanban-drawer" onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <header className="drawer-header">
                    <div className="header-top">
                        <div className="task-identifier">
                            <CheckSquare size={16} color="white" />
                            <span>T-ITEM-{task?.id?.slice?.(0, 5).toUpperCase() || '...'}</span>
                        </div>
                        <div className="header-actions">
                            <button type="button" className="icon-btn-ghost"><MoreVertical size={18} /></button>
                            <button type="button" className="icon-btn-ghost close-btn" onClick={onClose}><X size={20} /></button>
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
                            <button type="button" className={`tab-link ${activeTab === 'DETAILS' ? 'active' : ''}`} onClick={() => setActiveTab('DETAILS')}>Task Details</button>
                            <button type="button" className={`tab-link ${activeTab === 'CHECKLIST' ? 'active' : ''}`} onClick={() => setActiveTab('CHECKLIST')}>Checklist</button>
                            <button type="button" className={`tab-link ${activeTab === 'COMMENTS' ? 'active' : ''}`} onClick={() => setActiveTab('COMMENTS')}>Comments</button>
                            <button type="button" className={`tab-link ${activeTab === 'ACTIVITY' ? 'active' : ''}`} onClick={() => setActiveTab('ACTIVITY')}>History</button>
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
                                        <FileText size={18} color="white" />
                                        <h3>Description</h3>
                                    </div>
                                    <MarkdownEditor 
                                        value={(() => {
                                            let desc = task?.description || '';
                                            // Strip Virtual Team marker
                                            desc = desc.replace(/<!-- TEAM:\[.*?\] -->/, '').trim();
                                            // Only show part before checklist
                                            const parts = desc.split('## Execution Checklist');
                                            return parts[0].trim();
                                        })()}
                                        onChange={(val) => {
                                            if (!task) return;
                                            let desc = task.description || '';
                                            // Preserve Virtual Team marker
                                            const teamMarkerMatch = desc.match(/<!-- TEAM:\[.*?\] -->/);
                                            const teamMarker = teamMarkerMatch ? teamMarkerMatch[0] : '';
                                            
                                            const parts = desc.split('## Execution Checklist');
                                            const checklistPart = parts.length > 1 ? '## Execution Checklist' + parts[1] : '';
                                            
                                            // Construct new description while keeping the hidden parts
                                            let newDesc = val;
                                            if (checklistPart) newDesc += '\n\n' + checklistPart.trim();
                                            if (teamMarker) newDesc += '\n\n' + teamMarker;
                                            
                                            setTask({ ...task, description: newDesc });
                                        }}
                                        onBlur={() => handleUpdateField('description', task?.description || '')}
                                        readOnly={!isManagerOrAdmin}
                                    />
                                </section>

                                {/* Attachments Display */}
                                {task?.attachments && task.attachments.length > 0 && (
                                    <section className="drawer-section">
                                        <div className="section-header">
                                            <Paperclip size={18} color="white" />
                                            <h3>Attachments</h3>
                                        </div>
                                        <div className="attachments-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {task.attachments.map((url, idx) => {
                                                const filename = url.split('/').pop() || `Attachment ${idx + 1}`;
                                                return (
                                                    <a 
                                                        key={idx} 
                                                        href={url} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="attachment-item"
                                                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: 'rgba(255,255,255,0.9)', textDecoration: 'none' }}
                                                    >
                                                        <FileText size={18} color="var(--purple-main)" />
                                                        <span style={{ fontSize: '0.9rem', wordBreak: 'break-all' }}>{filename}</span>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {/* Manager Assessment */}
                                {(isManagerOrAdmin || task?.status === 'DONE') && task && (
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
                                        <div className="helper-text">{isManagerOrAdmin ? "Ratings affect employee KPI scores and monthly reports." : "Final performance rating from management."}</div>
                                     </section>
                                )}
                            </div>
                        )}

                        {activeTab === 'CHECKLIST' && (() => {
                            const desc = task?.description || '';
                            const lines = desc.split('\n');
                            const parsedChecklist = [];
                            for (let i = 0; i < lines.length; i++) {
                                const match = lines[i].match(/^- \[([ xX])\] (.*)/);
                                if (match) {
                                    parsedChecklist.push({ lineIndex: i, text: match[2], checked: match[1] !== ' ' });
                                }
                            }
                            const completedCount = parsedChecklist.filter(i => i.checked).length;
                            const progressPercent = parsedChecklist.length > 0 ? (completedCount / parsedChecklist.length) * 100 : 0;

                            return (
                                <div className="tab-pane active fade-in">
                                    <section className="drawer-section">
                                        <div className="section-header">
                                            <CheckSquare size={18} color="var(--purple-main)" />
                                            <h3>Execution Checklist</h3>
                                            <div className="progress-bar-container">
                                                <div className="progress-bar-fill" style={{ width: `${progressPercent}%`, background: 'var(--purple-main)', height: '100%' }}></div>
                                            </div>
                                        </div>
                                        <div className="checklist-items">
                                            {parsedChecklist.map((item, idx) => (
                                                <div key={idx} className="check-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={item.checked} 
                                                        onChange={(e) => {
                                                            const newChecked = e.target.checked;
                                                            lines[item.lineIndex] = `- [${newChecked ? 'x' : ' '}] ${item.text}`;
                                                            handleUpdateField('description', lines.join('\n'));
                                                        }}
                                                    /> 
                                                    <span style={{ textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)' }}>
                                                        {item.text}
                                                    </span>
                                                </div>
                                            ))}
                                            {parsedChecklist.length === 0 && (
                                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', padding: '10px 0' }}>
                                                    No checklist items found. Switch to the Task Details tab to add markdown checkboxes ( - [ ] Item ).
                                                </div>
                                            )}
                                            <button 
                                                type="button" 
                                                className="btn-add-item" 
                                                onClick={() => {
                                                    const newItem = `- [ ] New Checklist Item`;
                                                    let desc = task?.description || '';
                                                    let newDesc = '';
                                                    
                                                    if (desc.includes('## Execution Checklist')) {
                                                        // Split by checklist marker but preserve everything else
                                                        const parts = desc.split('## Execution Checklist');
                                                        newDesc = parts[0] + '## Execution Checklist' + parts[1] + '\n' + newItem;
                                                    } else {
                                                        // Handle case with TEAM marker
                                                        const teamMatch = desc.match(/<!-- TEAM:\[.*?\] -->/);
                                                        if (teamMatch) {
                                                            const baseDesc = desc.replace(teamMatch[0], '').trim();
                                                            newDesc = baseDesc + '\n\n## Execution Checklist\n' + newItem + '\n\n' + teamMatch[0];
                                                        } else {
                                                            newDesc = desc + '\n\n## Execution Checklist\n' + newItem;
                                                        }
                                                    }
                                                    handleUpdateField('description', newDesc);
                                                }}
                                            >
                                                <Plus size={14} /> Add an item
                                            </button>
                                        </div>
                                    </section>
                                </div>
                            );
                        })()}

                        {activeTab === 'COMMENTS' && (
                            <div className="tab-pane active fade-in">
                                <section className="drawer-section">
                                    <div className="section-header">
                                        <MessageSquare size={18} color="white" />
                                        <h3>Comments</h3>
                                    </div>
                                    <div className="comment-feed custom-scrollbar">
                                        <div className="no-comments" style={{ padding: '20px 0', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', textAlign: 'center' }}>
                                            No comments yet.
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
                                        <Activity size={18} color="white" />
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
                            <button type="button" className="sidebar-btn" onClick={() => {
                                if (!authEmployee?.id) return;
                                const currentIds = task?.assigneeIds || (task?.assigneeId ? [task.assigneeId] : []);
                                if (!currentIds.includes(authEmployee.id)) {
                                    handleUpdateField('assigneeIds', [...currentIds, authEmployee.id]);
                                }
                            }}>
                                <User size={14} /> Join
                            </button>
                            {task?.status === 'IN_PROGRESS' && (
                                <button type="button" className="sidebar-btn primary" onClick={() => handleUpdateField('status', 'IN_REVIEW')}>
                                    <ChevronRight size={14} /> Submit for Review
                                </button>
                            )}
                        </div>
                        
                        <div className="sidebar-group">
                            <label className="sidebar-label">ADD TO CARD</label>
                            <button type="button" className="sidebar-btn" onClick={() => {
                                document.querySelector('.multi-picker-container')?.scrollIntoView({ behavior: 'smooth' });
                            }}>
                                <User size={14} /> Members
                            </button>
                            <button type="button" className="sidebar-btn"><Filter size={14} /> Labels</button>
                            <button type="button" className="sidebar-btn" onClick={() => setActiveTab('CHECKLIST')}>
                                <CheckSquare size={14} /> Checklist
                            </button>
                            <div className="sidebar-btn sidebar-date-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Clock size={14} />
                                <span style={{ marginLeft: '8px' }}>Dates &nbsp;</span>
                                <input 
                                    type="date" 
                                    style={{ position: 'absolute', opacity: 0, top: 0, left: 0, right: 0, bottom: 0, cursor: 'pointer', width: '100%' }}
                                    value={task?.dueDate ? task.dueDate.split('T')[0] : ''}
                                    onChange={(e) => {
                                        if(e.target.value) {
                                            handleUpdateField('dueDate', new Date(e.target.value).toISOString());
                                        }
                                    }}
                                />
                            </div>
                            <button type="button" className="sidebar-btn" onClick={() => {
                                document.getElementById('drawer-file-upload')?.click();
                            }}>
                                <Plus size={14} /> Attachment
                            </button>
                            <input 
                                type="file" 
                                id="drawer-file-upload" 
                                style={{ display: 'none' }} 
                                onChange={handleFileUpload}
                            />
                        </div>
                        
                        <div className="sidebar-group">
                            <label className="sidebar-label">ACTIONS</label>
                            <button type="button" className="sidebar-btn" onClick={() => handleUpdateField('status', 'DONE')}>
                                <ChevronRight size={14} /> Complete
                            </button>
                            <button type="button" className="sidebar-btn" onClick={() => handleUpdateField('status', 'BLOCKED')}>
                                <Clock size={14} /> Hold
                            </button>
                            <button type="button" className="sidebar-btn danger" onClick={async () => {
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

