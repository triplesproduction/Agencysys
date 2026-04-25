'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Button from '../Button';
import Input from '../Input';
import { 
    X, Plus, Trash2, Target, Users, Calendar, Flag,
    ChevronDown, ChevronUp, CheckSquare, BarChart3, Clock, FileText, CheckCircle2
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import MultiMemberPicker from '../common/MultiMemberPicker';
import DatePicker from '../common/DatePicker';
import MarkdownEditor from '../common/MarkdownEditor';
import { EmployeeDTO } from '@/types/dto';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (projectId: string) => void;
}

type TaskEntry = {
    title: string;
    description: string;
    assigneeIds: string[];
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    dueDate: string;
    checklist: string[];
};

export default function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
    const { employee: authEmployee } = useAuth();
    const [step, setStep] = useState(1);
    
    // Step 1: Project Details
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [deadline, setDeadline] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    
    // Step 2: Tasks
    const [tasks, setTasks] = useState<TaskEntry[]>([]);
    const [expandedTask, setExpandedTask] = useState<number | null>(0);
    const [newChecklistItem, setNewChecklistItem] = useState('');
    
    // Helpers
    const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            api.getEmployees({ limit: 1000 }).then(data => {
                setEmployees(data.data || []);
            }).catch(console.error);

            setStep(1);
            setName('');
            setDescription('');
            setStartDate(new Date().toISOString().split('T')[0]);
            setDeadline('');
            setSelectedMemberIds(authEmployee ? [authEmployee.id] : []);
            setTasks([createEmptyTask()]);
            setExpandedTask(0);
            setNewChecklistItem('');
            setErrorMsg('');
        }
    }, [isOpen, authEmployee]);

    const createEmptyTask = (): TaskEntry => ({
        title: '',
        description: '',
        assigneeIds: [],
        priority: 'MEDIUM',
        dueDate: deadline || '',
        checklist: []
    });

    const duration = useMemo(() => {
        if (!startDate || !deadline) return 0;
        const start = new Date(startDate);
        const end = new Date(deadline);
        return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }, [startDate, deadline]);

    const validTasks = useMemo(() => tasks.filter(t => t.title.trim() !== ''), [tasks]);

    if (!isOpen) return null;

    const handleAddTask = () => {
        const newTask = createEmptyTask();
        newTask.dueDate = deadline || '';
        setTasks([...tasks, newTask]);
        setExpandedTask(tasks.length);
    };

    const handleRemoveTask = (idx: number) => {
        const newTasks = [...tasks];
        newTasks.splice(idx, 1);
        setTasks(newTasks);
        if (expandedTask === idx) setExpandedTask(null);
        else if (expandedTask !== null && expandedTask > idx) setExpandedTask(expandedTask - 1);
    };

    const updateTask = (idx: number, updates: Partial<TaskEntry>) => {
        const newTasks = [...tasks];
        newTasks[idx] = { ...newTasks[idx], ...updates };
        setTasks(newTasks);
    };

    const addChecklistItem = (idx: number, item: string) => {
        if (!item.trim()) return;
        const newTasks = [...tasks];
        newTasks[idx] = { ...newTasks[idx], checklist: [...newTasks[idx].checklist, item.trim()] };
        setTasks(newTasks);
        setNewChecklistItem('');
    };

    const removeChecklistItem = (taskIdx: number, itemIdx: number) => {
        const newTasks = [...tasks];
        newTasks[taskIdx] = { ...newTasks[taskIdx], checklist: newTasks[taskIdx].checklist.filter((_, i) => i !== itemIdx) };
        setTasks(newTasks);
    };

    const handleFinalLaunch = async () => {
        if (!name) return setStep(1);
        setIsSubmitting(true);
        setErrorMsg('');

        try {
            const project = await api.createProject({
                name,
                description,
                priority: 'MEDIUM',
                startDate,
                deadline,
                status: validTasks.length > 0 ? 'ACTIVE' : 'PLANNING',
                createdBy: authEmployee?.id
            } as any);

            if (selectedMemberIds.length > 0) {
                await Promise.all(selectedMemberIds.map(uid => api.addProjectMember(project.id, uid)));
            }

            if (validTasks.length > 0) {
                await Promise.all(validTasks.map(t => {
                    let finalDescription = t.description || '';
                    if (t.checklist.length > 0) {
                        const checklistMd = `\n\n## Checklist\n` + t.checklist.map(item => `- [ ] ${item}`).join('\n');
                        finalDescription += checklistMd;
                    }

                    return api.createTask({
                        title: t.title,
                        description: finalDescription,
                        projectId: project.id,
                        assigneeIds: t.assigneeIds.length > 0 ? t.assigneeIds : undefined,
                        status: 'TODO',
                        priority: t.priority,
                        dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : new Date(deadline || Date.now()).toISOString(),
                        creatorId: authEmployee?.id
                    } as any);
                }));
            }

            onSuccess(project.id);
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to create project.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getPriorityColor = (p: string) => {
        if (p === 'HIGH') return '#ef4444';
        if (p === 'MEDIUM') return '#f59e0b';
        return '#10b981';
    };

    const teamMembers = employees.filter(e => selectedMemberIds.includes(e.id));

    // Timeline helpers for Step 3
    const getTimelinePosition = (dateStr: string) => {
        if (!startDate || !deadline || !dateStr) return 50;
        const start = new Date(startDate).getTime();
        const end = new Date(deadline).getTime();
        const current = new Date(dateStr).getTime();
        if (end === start) return 50;
        return Math.max(2, Math.min(98, ((current - start) / (end - start)) * 100));
    };

    return (
        <div className="wizard-overlay fade-in">
            <div className="wizard-card slide-up">
                
                {/* Header */}
                <div className="wizard-header">
                    <div>
                        <div className="wizard-title">
                            <h2>
                                {step === 1 ? 'Project Details' : step === 2 ? 'Add Tasks' : 'Summary'}
                            </h2>
                        </div>
                        <div className="step-nav">
                            <div className={`step-indicator ${step >= 1 ? 'active' : ''} ${step > 1 ? 'complete' : ''}`}></div>
                            <div className={`step-indicator ${step >= 2 ? 'active' : ''} ${step > 2 ? 'complete' : ''}`}></div>
                            <div className={`step-indicator ${step >= 3 ? 'active' : ''}`}></div>
                        </div>
                    </div>
                    <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
                </div>

                {/* Body */}
                <div className="wizard-body custom-scrollbar" style={{ overflowY: 'auto', maxHeight: '65vh' }}>
                    
                    {/* ───── STEP 1: PROJECT DETAILS ───── */}
                    {step === 1 && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div className="wizard-field-group">
                                <label className="wizard-label">Project Details</label>
                                <input 
                                    className="wizard-input" 
                                    placeholder="Project name" 
                                    value={name}
                                    autoFocus
                                    onChange={(e) => setName(e.target.value)}
                                    style={{ fontSize: '1.1rem', fontWeight: 700, padding: '16px 20px' }}
                                />
                                <textarea 
                                    className="wizard-input"
                                    placeholder="Brief description of this project..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    style={{ minHeight: '100px', resize: 'none', lineHeight: 1.5, padding: '16px 20px', fontSize: '0.95rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="wizard-field-group">
                                    <label className="wizard-label"><Calendar size={12} style={{ marginRight: 6 }} /> Start Date</label>
                                    <DatePicker value={startDate} onChange={setStartDate} />
                                </div>
                                <div className="wizard-field-group">
                                    <label className="wizard-label"><Target size={12} style={{ marginRight: 6 }} /> Deadline</label>
                                    <DatePicker value={deadline} onChange={setDeadline} />
                                </div>
                            </div>

                            <div className="wizard-field-group">
                                <label className="wizard-label"><Users size={12} style={{ marginRight: 6 }} /> Team Members</label>
                                <MultiMemberPicker 
                                    selectedIds={selectedMemberIds}
                                    members={employees as any}
                                    onChange={setSelectedMemberIds}
                                />
                            </div>
                        </div>
                    )}

                    {/* ───── STEP 2: TASK CREATION ───── */}
                    {step === 2 && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'white' }}>Tasks</h3>
                                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', margin: '4px 0 0' }}>
                                        Create tasks for this project. Click to expand and add details.
                                    </p>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--purple-main)', fontWeight: 700 }}>
                                    {validTasks.length} task{validTasks.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {tasks.map((t, idx) => {
                                    const isExpanded = expandedTask === idx;
                                    const assignedNames = t.assigneeIds
                                        .map(id => teamMembers.find(m => m.id === id))
                                        .filter(Boolean)
                                        .map(m => m!.firstName)
                                        .join(', ');

                                    return (
                                        <div key={idx} className={`wiz-task-card ${isExpanded ? 'expanded' : ''}`}>
                                            {/* Collapsed Header */}
                                            <div 
                                                className="wiz-task-header"
                                                onClick={() => setExpandedTask(isExpanded ? null : idx)}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                                    <div className={`wiz-task-num ${t.title.trim() ? 'filled' : ''}`}>{idx + 1}</div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: t.title.trim() ? 'white' : 'rgba(255,255,255,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {t.title.trim() || 'Untitled task'}
                                                        </div>
                                                        {!isExpanded && t.title.trim() && (
                                                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                                {assignedNames && <span>{assignedNames}</span>}
                                                                {t.dueDate && <span>{new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                                                <span style={{ color: getPriorityColor(t.priority), fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6rem' }}>{t.priority}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {tasks.length > 1 && (
                                                        <button 
                                                            className="wiz-task-remove"
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveTask(idx); }}
                                                            type="button"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                    {isExpanded ? <ChevronUp size={16} color="rgba(255,255,255,0.3)" /> : <ChevronDown size={16} color="rgba(255,255,255,0.3)" />}
                                                </div>
                                            </div>

                                            {/* Expanded Body */}
                                            {isExpanded && (
                                                <div className="wiz-task-body fade-in">
                                                    {/* Title */}
                                                    <div className="wiz-task-field">
                                                        <label className="wiz-task-label">Task Title</label>
                                                        <input 
                                                            className="wizard-input"
                                                            placeholder="What needs to be done?"
                                                            value={t.title}
                                                            autoFocus
                                                            onChange={(e) => updateTask(idx, { title: e.target.value })}
                                                            style={{ padding: '12px 16px', fontSize: '0.9rem' }}
                                                        />
                                                    </div>

                                                    {/* Description */}
                                                    <div className="wiz-task-field">
                                                        <label className="wiz-task-label"><FileText size={11} /> Description</label>
                                                        <MarkdownEditor 
                                                            value={t.description}
                                                            onChange={(val) => updateTask(idx, { description: val })}
                                                            placeholder="Add task details, instructions, or scope..."
                                                        />
                                                    </div>

                                                    {/* Assign + Priority + Due Date row */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                        <div className="wiz-task-field">
                                                            <label className="wiz-task-label"><Users size={11} /> Assign To</label>
                                                            <MultiMemberPicker 
                                                                selectedIds={t.assigneeIds}
                                                                members={teamMembers as any}
                                                                onChange={(ids) => updateTask(idx, { assigneeIds: ids })}
                                                            />
                                                        </div>
                                                        <div className="wiz-task-field">
                                                            <label className="wiz-task-label"><Calendar size={11} /> Due Date</label>
                                                            <DatePicker 
                                                                value={t.dueDate}
                                                                onChange={(dt) => updateTask(idx, { dueDate: dt })}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Priority */}
                                                    <div className="wiz-task-field">
                                                        <label className="wiz-task-label"><Flag size={11} /> Priority</label>
                                                        <div className="wiz-priority-group">
                                                            {(['LOW', 'MEDIUM', 'HIGH'] as const).map(p => (
                                                                <button 
                                                                    key={p}
                                                                    type="button"
                                                                    className={`wiz-priority-btn ${p.toLowerCase()} ${t.priority === p ? 'active' : ''}`}
                                                                    onClick={() => updateTask(idx, { priority: p })}
                                                                >
                                                                    {p}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Checklist */}
                                                    <div className="wiz-task-field">
                                                        <label className="wiz-task-label"><CheckSquare size={11} /> Checklist</label>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            {t.checklist.map((item, cIdx) => (
                                                                <div key={cIdx} className="wiz-checklist-item">
                                                                    <div className="wiz-check-box"></div>
                                                                    <span>{item}</span>
                                                                    <button type="button" className="wiz-checklist-remove" onClick={() => removeChecklistItem(idx, cIdx)}>
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <Input 
                                                                    placeholder="Add checklist item + Enter..."
                                                                    value={newChecklistItem}
                                                                    onChange={(e) => setNewChecklistItem(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            addChecklistItem(idx, newChecklistItem);
                                                                        }
                                                                    }}
                                                                    style={{ background: 'rgba(0,0,0,0.2)', flex: 1 }}
                                                                />
                                                                <Button type="button" variant="glass" onClick={() => addChecklistItem(idx, newChecklistItem)}>Add</Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <button className="wiz-add-task-btn" onClick={handleAddTask} type="button">
                                    <Plus size={18} /> Add Task
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ───── STEP 3: SUMMARY ───── */}
                    {step === 3 && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* Stats */}
                            <div className="summary-grid">
                                <div className="summary-card">
                                    <h5><Clock size={14} style={{ marginBottom: 4 }} /> Duration</h5>
                                    <div className="val">{duration > 0 ? `${duration}d` : '—'}</div>
                                </div>
                                <div className="summary-card">
                                    <h5><CheckSquare size={14} style={{ marginBottom: 4 }} /> Tasks</h5>
                                    <div className="val">{validTasks.length}</div>
                                </div>
                                <div className="summary-card">
                                    <h5><Users size={14} style={{ marginBottom: 4 }} /> Team</h5>
                                    <div className="val">{selectedMemberIds.length}</div>
                                </div>
                            </div>

                            {/* Project Info */}
                            <div style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px', color: 'white' }}>{name}</h3>
                                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                                    {description || 'No description provided.'}
                                </p>
                                {startDate && deadline && (
                                    <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', display: 'flex', gap: '16px' }}>
                                        <span><Calendar size={11} style={{ marginRight: 4 }} />{new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                        <span>→</span>
                                        <span>{new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    </div>
                                )}
                            </div>

                            {/* Progress Bar */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)' }}>Progress</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>0 of {validTasks.length} completed</span>
                                </div>
                                <div className="wiz-progress-bar">
                                    <div className="wiz-progress-fill" style={{ width: '0%' }}></div>
                                </div>
                            </div>

                            {/* Task List */}
                            {validTasks.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
                                        Task Breakdown
                                    </div>
                                    <div className="wiz-summary-tasks">
                                        {validTasks.map((t, idx) => {
                                            const assignedAvatars = t.assigneeIds
                                                .map(id => teamMembers.find(m => m.id === id))
                                                .filter(Boolean);

                                            return (
                                                <div key={idx} className="wiz-summary-task-row">
                                                    <div className="wiz-summary-check">
                                                        <div className="wiz-check-circle"></div>
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {t.title}
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                            {t.dueDate && (
                                                                <span><Calendar size={10} style={{ marginRight: 3 }} />{new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                            )}
                                                            {t.checklist.length > 0 && (
                                                                <span><CheckSquare size={10} style={{ marginRight: 3 }} />{t.checklist.length} items</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {assignedAvatars.length > 0 && (
                                                            <div style={{ display: 'flex' }}>
                                                                {assignedAvatars.slice(0, 3).map((m, i) => (
                                                                    <img 
                                                                        key={m!.id}
                                                                        src={m!.profilePhoto || `https://ui-avatars.com/api/?name=${m!.firstName}&background=6366f1&color=fff&size=24`}
                                                                        alt={m!.firstName}
                                                                        style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid #0D0D12', marginLeft: i > 0 ? '-6px' : 0 }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                        <span className={`wiz-priority-pill ${t.priority.toLowerCase()}`}>{t.priority}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Timeline */}
                            {validTasks.length > 0 && startDate && deadline && (
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
                                        Timeline
                                    </div>
                                    <div className="wiz-timeline">
                                        <div className="wiz-timeline-bar">
                                            {validTasks.map((t, idx) => (
                                                t.dueDate && (
                                                    <div 
                                                        key={idx}
                                                        className={`wiz-timeline-dot ${t.priority.toLowerCase()}`}
                                                        style={{ left: `${getTimelinePosition(t.dueDate)}%` }}
                                                        title={`${t.title} — ${new Date(t.dueDate).toLocaleDateString()}`}
                                                    ></div>
                                                )
                                            ))}
                                        </div>
                                        <div className="wiz-timeline-labels">
                                            <span>{new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                            <span>{new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {errorMsg && <div className="error-box" style={{ marginTop: '20px' }}>{errorMsg}</div>}
                </div>

                {/* Footer */}
                <div className="wizard-footer">
                    {step > 1 ? (
                        <Button 
                            variant="secondary" 
                            size="lg"
                            style={{ borderRadius: '14px', fontWeight: 700 }}
                            onClick={() => setStep(step - 1)} 
                            disabled={isSubmitting}
                        >
                            Back
                        </Button>
                    ) : (
                        <div />
                    )}

                    <div style={{ display: 'flex', gap: '12px' }}>
                        {step < 3 ? (
                            <Button 
                                variant="primary" 
                                size="lg"
                                style={{ borderRadius: '14px', fontWeight: 800 }}
                                onClick={() => setStep(step + 1)}
                                disabled={step === 1 && !name}
                            >
                                Next
                            </Button>
                        ) : (
                            <Button 
                                variant="primary" 
                                size="lg"
                                style={{ borderRadius: '14px', fontWeight: 800 }}
                                onClick={handleFinalLaunch}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Creating...' : 'Create Project'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
