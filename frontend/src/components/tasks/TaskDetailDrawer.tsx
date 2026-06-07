'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    X, User, Calendar, Tag, FileText, CheckSquare, 
    MoreVertical, Paperclip, MessageSquare, 
    Clock, Trash2, ChevronRight, Activity, Star, Plus, Filter
} from 'lucide-react';

import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { TaskDTO, EmployeeDTO } from '@/types/dto';
import Button from '../Button';
import TaskQualityRater from './TaskQualityRater';
import { useNotifications } from '../notifications/NotificationProvider';
import MarkdownEditor from '../common/MarkdownEditor';
import MultiMemberPicker from '../common/MultiMemberPicker';
import DatePicker from '../common/DatePicker';
import { useAuth } from '@/context/AuthContext';
import { useUpdateTask, useDeleteTask } from '@/hooks/queries/domains/projects/useProjects';
import { useEmployees } from '@/hooks/queries/domains/employees/useEmployees';





interface TaskDetailDrawerProps {
    taskId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: () => void;
    currentUserRole: string;
}

export default function TaskDetailDrawer({ taskId, isOpen, onClose, onUpdate, currentUserRole }: TaskDetailDrawerProps) {
    const { employee: authEmployee } = useAuth();
    const router = useRouter();
    const [task, setTask] = useState<TaskDTO | null>(null);

    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'DETAILS' | 'CHECKLIST'>('DETAILS');
    const [localDescription, setLocalDescription] = useState('');
    const [editingChecklistIdx, setEditingChecklistIdx] = useState<number | null>(null);
    const [editingChecklistText, setEditingChecklistText] = useState('');
    
    const { addNotification } = useNotifications();
    
    const { data: employees = [] } = useEmployees({ limit: 1000 });

    const { mutateAsync: updateTask } = useUpdateTask();
    const { mutateAsync: deleteTask } = useDeleteTask();


    const fetchTask = async () => {
        if (!taskId) return;
        setLoading(true);
        try {
            // Parallel load for efficiency
            const [tasksList] = await Promise.all([
                api.getTasks(undefined, undefined, 500)
            ]);
            
            const found = (tasksList || []).find(t => t.id === taskId);
            
            // Hydrate project name if exists (simple way)
            if (found?.projectId) {
                const proj = await api.getProjectById(found.projectId);
                (found as any).projectName = proj?.name;
            }

            setTask(found || null);
        } catch (err) {

            logger.error('Error', 'Failed to fetch task details:', err);
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

    useEffect(() => {
        if (task) {
            let desc = task.description || '';
            desc = desc.replace(/<!-- TEAM:\[.*?\] -->/, '').trim();
            const parts = desc.split('## Execution Checklist');
            // Check if localDescription hasn't been modified significantly by user yet to avoid overriding during typing
            if (!localDescription || parts[0].trim() !== localDescription.trim()) {
                setLocalDescription(parts[0]);
            }
        }
    }, [task?.id, task?.description]);

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
            const updated = await updateTask({ id: task.id, payload: { [field]: value } });
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
                            {task?.projectId && (
                                <div 
                                    className="project-tag" 
                                    onClick={() => router.push(`/projects/${task.projectId}`)}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--purple-main)', background: 'rgba(139, 92, 246, 0.1)', padding: '4px 10px', borderRadius: '20px', fontWeight: 700 }}
                                >
                                    <Activity size={12} />
                                    {(task as any)?.projectName ? `PROJECT: ${(task as any).projectName}` : `PROJECT: ${task?.projectId?.slice(0, 8).toUpperCase()}`}
                                </div>
                            )}
                            {(isManagerOrAdmin || task?.creatorId === authEmployee?.id) && (
                                <button 
                                    type="button" 
                                    className="icon-btn-ghost danger-hover" 
                                    title="Delete Task"
                                    onClick={async () => {
                                        if (!taskId) return;
                                        if (confirm('Are you sure you want to delete this task?')) {
                                            try {
                                                await deleteTask(taskId); 
                                                addNotification({ title: 'Task Deleted', message: 'Task has been permanently removed.', type: 'success' });
                                                if (onUpdate) onUpdate();
                                                onClose();
                                            } catch (err: any) {
                                                addNotification({ title: 'Delete Failed', message: err.message, type: 'error' });
                                            }
                                        }
                                    }}
                                    style={{ color: 'rgba(255,255,255,0.4)' }}
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
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
                        </div>

                        {activeTab === 'DETAILS' && (
                            <div className="tab-pane active fade-in">
                                {/* Status & Priority Row */}
                                <div className="meta-row" style={{ flexWrap: 'wrap', gap: '16px' }}>
                                    <div className="meta-group" style={{ flex: '1 1 120px' }}>
                                        <label className="meta-label">STATUS</label>
                                        <select 
                                            className={`status-select-btn ${task?.status?.toLowerCase() || 'todo'}`}
                                            value={task?.status || 'TODO'}
                                            onChange={(e) => handleUpdateField('status', e.target.value)}
                                            style={{ width: '100%' }}
                                        >
                                            <option value="TODO">To Do</option>
                                            <option value="IN_PROGRESS">In Progress</option>
                                            <option value="IN_REVIEW">In Review</option>
                                            <option value="DONE">Done</option>
                                            <option value="BLOCKED">Blocked</option>
                                        </select>
                                    </div>

                                    <div className="meta-group" style={{ flex: '1 1 120px' }}>
                                        <label className="meta-label">PRIORITY</label>
                                        <select 
                                            className={`priority-select-btn ${task?.priority.toLowerCase()}`}
                                            value={task?.priority}
                                            onChange={(e) => handleUpdateField('priority', e.target.value)}
                                            style={{ width: '100%' }}
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HIGH">High</option>
                                            <option value="CRITICAL">Critical</option>
                                        </select>
                                    </div>
                                    
                                    <div className="meta-group" style={{ flex: '1 1 140px' }}>
                                        <label className="meta-label">DUE DATE</label>
                                        <DatePicker 
                                            value={task?.dueDate ? task.dueDate.split('T')[0] : ''}
                                            onChange={(val) => {
                                                if(val) {
                                                    handleUpdateField('dueDate', new Date(val).toISOString());
                                                }
                                            }}
                                            placeholder="Set Date"
                                        />
                                    </div>

                                    <div className="meta-group" style={{ flex: '1 1 100%' }}>
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
                                        value={localDescription}
                                        onChange={(val) => setLocalDescription(val)}
                                        onBlur={() => {
                                            if (!task) return;
                                            let desc = task.description || '';
                                            const teamMarkerMatch = desc.match(/<!-- TEAM:\[.*?\] -->/);
                                            const teamMarker = teamMarkerMatch ? teamMarkerMatch[0] : '';
                                            
                                            const parts = desc.split('## Execution Checklist');
                                            const checklistPart = parts.length > 1 ? '## Execution Checklist' + parts[1] : '';
                                            
                                            let newDesc = localDescription.trim();
                                            if (checklistPart) newDesc += '\n\n' + checklistPart.trim();
                                            if (teamMarker) newDesc += '\n\n' + teamMarker;
                                            
                                            handleUpdateField('description', newDesc);
                                        }}
                                        readOnly={!isManagerOrAdmin}
                                    />
                                </section>

                                {/* Attachments Display */}
                                <section className="drawer-section">
                                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Paperclip size={18} color="white" />
                                            <h3>Attachments</h3>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => document.getElementById('drawer-file-upload')?.click()}
                                            style={{ 
                                                background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '6px', 
                                                padding: '4px 10px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', 
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' 
                                            }}
                                        >
                                            <Plus size={12} /> Add
                                        </button>
                                        <input 
                                            type="file" 
                                            id="drawer-file-upload" 
                                            style={{ display: 'none' }} 
                                            onChange={handleFileUpload}
                                        />
                                    </div>
                                    
                                    {task?.attachments && task.attachments.length > 0 ? (
                                        <div className="attachments-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                                            {task.attachments.map((url, idx) => {
                                                const filename = url.split('/').pop() || `Attachment ${idx + 1}`;
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        className="attachment-item"
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}
                                                    >
                                                        <a 
                                                            href="#" 
                                                            onClick={async (e) => {
                                                                e.preventDefault();
                                                                let finalUrl = url;
                                                                if (!finalUrl.startsWith('http')) {
                                                                    const { data } = await supabase.storage.from('private-docs').createSignedUrl(url, 3600);
                                                                    if (data) finalUrl = data.signedUrl;
                                                                    else { alert('Could not securely access this document.'); return; }
                                                                }
                                                                window.open(finalUrl, '_blank', 'noopener,noreferrer');
                                                            }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.9)', textDecoration: 'none', flex: 1 }}
                                                        >
                                                            <FileText size={18} color="var(--purple-main)" />
                                                            <span style={{ fontSize: '0.9rem', wordBreak: 'break-all' }}>{filename}</span>
                                                        </a>
                                                        <button 
                                                            type="button" 
                                                            onClick={async () => {
                                                                if(confirm('Delete this attachment permanently?')) {
                                                                    try {
                                                                        addNotification({ title: 'Deleting...', message: 'Removing file from storage.', type: 'info' });
                                                                        await api.deleteFile(url);
                                                                        const newAttachments = task.attachments!.filter(u => u !== url);
                                                                        await handleUpdateField('attachments', newAttachments);
                                                                        addNotification({ title: 'Deleted', message: 'Attachment removed.', type: 'success' });
                                                                    } catch (err: any) {
                                                                        addNotification({ title: 'Delete Failed', message: err.message, type: 'error' });
                                                                    }
                                                                }
                                                            }}
                                                            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                                            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                                                            title="Delete attachment"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', padding: '12px 0' }}>
                                            No attachments yet.
                                        </div>
                                    )}
                                </section>

                                {/* Manager Assessment */}
                                {(isManagerOrAdmin || task?.status === 'DONE') && task && (
                                    <section style={{
                                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.07) 0%, rgba(139, 92, 246, 0.05) 100%)',
                                        border: '1px solid rgba(245, 158, 11, 0.2)',
                                        borderRadius: '20px',
                                        padding: '24px',
                                        marginBottom: '32px',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                                            <div style={{ 
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245,158,11,0.25)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <Star size={18} color="#f59e0b" fill="rgba(245,158,11,0.4)" />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'white' }}>Performance Assessment</h3>
                                                <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                                                    {isManagerOrAdmin ? 'Ratings directly affect KPI scores & monthly reports.' : 'Final rating from management.'}
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ height: '1px', background: 'rgba(245,158,11,0.12)', margin: '16px 0' }} />

                                        <TaskQualityRater 
                                            taskId={task.id}
                                            initialRating={task.quality_rating}
                                            onRate={(val) => setTask({ ...task, quality_rating: val })}
                                            disabled={!isManagerOrAdmin}
                                        />

                                        {task.quality_rating ? (
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                                                {['Execution', 'Communication', 'Timeliness'].map((badge, i) => (
                                                    <span key={i} style={{
                                                        fontSize: '0.7rem', fontWeight: 600,
                                                        padding: '3px 10px', borderRadius: '20px',
                                                        background: 'rgba(245,158,11,0.1)',
                                                        border: '1px solid rgba(245,158,11,0.2)',
                                                        color: 'rgba(255,255,255,0.6)'
                                                    }}>{badge}</span>
                                                ))}
                                            </div>
                                        ) : null}
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
                                                <div key={idx} className="check-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', width: '100%' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={item.checked} 
                                                        onChange={(e) => {
                                                            const newChecked = e.target.checked;
                                                            lines[item.lineIndex] = `- [${newChecked ? 'x' : ' '}] ${item.text}`;
                                                            handleUpdateField('description', lines.join('\n'));
                                                        }}
                                                    /> 
                                                    <input 
                                                        type="text"
                                                        value={editingChecklistIdx === idx ? editingChecklistText : item.text}
                                                        onChange={(e) => {
                                                            if (editingChecklistIdx !== idx) {
                                                                setEditingChecklistIdx(idx);
                                                                setEditingChecklistText(e.target.value);
                                                            } else {
                                                                setEditingChecklistText(e.target.value);
                                                            }
                                                        }}
                                                        onFocus={() => {
                                                            setEditingChecklistIdx(idx);
                                                            setEditingChecklistText(item.text);
                                                        }}
                                                        onBlur={() => {
                                                            if (editingChecklistIdx === idx && editingChecklistText !== item.text) {
                                                                lines[item.lineIndex] = `- [${item.checked ? 'x' : ' '}] ${editingChecklistText}`;
                                                                handleUpdateField('description', lines.join('\n'));
                                                            }
                                                            setEditingChecklistIdx(null);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                lines[item.lineIndex] = `- [${item.checked ? 'x' : ' '}] ${editingChecklistText}`;
                                                                handleUpdateField('description', lines.join('\n'));
                                                                setEditingChecklistIdx(null);
                                                                e.currentTarget.blur();
                                                            } else if (e.key === 'Escape') {
                                                                setEditingChecklistIdx(null);
                                                                e.currentTarget.blur();
                                                            }
                                                        }}
                                                        style={{ 
                                                            background: 'transparent', border: '1px solid transparent', 
                                                            color: item.checked ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)', 
                                                            textDecoration: item.checked ? 'line-through' : 'none', 
                                                            flex: 1, outline: 'none', fontSize: '0.95rem', padding: '2px 4px', borderRadius: '4px' 
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.border = '1px solid transparent'}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            lines.splice(item.lineIndex, 1);
                                                            handleUpdateField('description', lines.join('\n'));
                                                        }}
                                                        style={{ 
                                                            background: 'transparent', 
                                                            border: 'none', 
                                                            color: 'rgba(255,255,255,0.3)', 
                                                            cursor: 'pointer', 
                                                            padding: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                                                        title="Delete item"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
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



                    </div>
                </div>
            </div>
        </div>
    );
}

