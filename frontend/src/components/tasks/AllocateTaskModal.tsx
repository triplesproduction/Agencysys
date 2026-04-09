'use client';

import React, { useState, useEffect, useRef } from 'react';
import GlassCard from '../GlassCard';
import Button from '../Button';
import Input from '../Input';
import { X, ChevronDown, User, Calendar, Tag, FileText, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import DatePicker from '../common/DatePicker';
import './TasksModal.css';

interface AllocateTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AllocateTaskModal({ isOpen, onClose, onSuccess }: AllocateTaskModalProps) {
    const [tasks, setTasks] = useState<{ id: string, title: string, description?: string }[]>([]);
    const [employees, setEmployees] = useState<{ id: string, name: string, role: string, profilePhoto?: string, firstName?: string }[]>([]);

    // Form State
    const [title, setTitle] = useState('');
    const [selectedTaskId, setSelectedTaskId] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [priority, setPriority] = useState('MEDIUM');
    const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
    const [instructions, setInstructions] = useState('');
    const [attachments, setAttachments] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isTaskListOpen, setIsTaskListOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            api.getTasks().then(setTasks).catch(console.error);
            api.getEmployees({ limit: 1000 }).then(data => {
                let empArray = Array.isArray(data) ? data : (data as any).data || [];
                setEmployees(empArray.map((e: any) => ({
                    id: e.id,
                    name: `${e.firstName} ${e.lastName}`,
                    role: e.roleId,
                    profilePhoto: e.profilePhoto,
                    firstName: e.firstName
                })));
            }).catch(err => console.error('Failed to fetch employees', err));

            // Reset Form
            setTitle(''); setSelectedTaskId(''); setSelectedEmployeeIds([]);
            setPriority('MEDIUM'); setDueDate(new Date().toISOString().split('T')[0]); setInstructions('');
            setAttachments(''); setUploadedFiles([]); setErrorMsg('');
        }
    }, [isOpen]);

    const taskListRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (taskListRef.current && !taskListRef.current.contains(e.target as Node)) setIsTaskListOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!isOpen) return null;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const res = await api.uploadFile(file);
            setUploadedFiles(prev => [...prev, res.url]);
        } catch (err: any) {
            setErrorMsg(`Upload failed: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsSubmitting(true);

        try {
            if (!title) throw new Error("Please enter a task title.");
            if (selectedEmployeeIds.length === 0) throw new Error("Select at least one employee.");
            if (!dueDate) throw new Error("Set a deadline.");

            const selectedTask = tasks.find(t => t.id === selectedTaskId);
            
            const manualLinks = attachments ? attachments.split(',').map(url => url.trim()).filter(Boolean) : [];
            const allAttachments = [...manualLinks, ...uploadedFiles];

            const formData = {
                title: title,
                description: selectedTask?.description || 'Allocated Task',
                instructions,
                assigneeIds: selectedEmployeeIds,
                priority,
                dueDate: new Date(dueDate).toISOString(),
                attachments: allAttachments.length > 0 ? allAttachments : undefined
            };

            await api.createTask(formData as any);
            onSuccess();
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Validation failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleEmployee = (id: string) => setSelectedEmployeeIds(prev => prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]);

    return (
        <div className="trello-modal-overlay fade-in">
            <div className="trello-modal slide-up">
                <div className="trello-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        <div style={{ background: 'var(--purple-main)', padding: '10px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)' }}><Plus size={22} color="white" /></div>
                        <div style={{ flex: 1 }}>
                            <input 
                                className="trello-title-input" 
                                placeholder="Task Title..." 
                                autoFocus
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.05em' }}>IN WORKSPACE: CORPORATE OPERATIONS</div>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className="trello-modal-body custom-scrollbar">
                        {/* Main Content */}
                        <div className="trello-main-content">
                            <div className="form-row" ref={taskListRef} style={{ position: 'relative' }}>
                                <div className="trello-section-label"><FileText size={14} /> Optional: Apply Template</div>
                                <div className="trello-select-trigger" onClick={() => setIsTaskListOpen(!isTaskListOpen)}>
                                    <span>{selectedTaskId ? tasks.find(t => t.id === selectedTaskId)?.title : '-- Choose an existing task --'}</span>
                                    <ChevronDown size={18} />
                                </div>
                                {isTaskListOpen && (tasks.length > 0) && (
                                    <div className="dropdown-options-container" style={{ top: '100%', left: 0, width: '100%', zIndex: 50 }}>
                                        <div className="options-list custom-scrollbar">
                                            {tasks.map(t => (
                                                <div key={t.id} className="option-item" onClick={() => { 
                                                    setSelectedTaskId(t.id); 
                                                    setTitle(t.title);
                                                    setIsTaskListOpen(false); 
                                                }}>{t.title}</div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="form-row">
                                <div className="trello-section-label">Task Context / Scope</div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                                    {selectedTaskId ? tasks.find(t => t.id === selectedTaskId)?.description : 'Selecting a task template will auto-populate additional context and scope definitions here.'}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="trello-section-label">Execution Instructions</div>
                                <textarea 
                                    className="trello-textarea" 
                                    rows={5} 
                                    placeholder="Add specific instructions for this allocation..." 
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                />
                            </div>

                            <div className="form-row">
                                <div className="trello-section-label">External Attachments (Links & Files)</div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                    <Input 
                                        placeholder="Paste Link URL" 
                                        value={attachments}
                                        onChange={(e) => setAttachments(e.target.value)}
                                        style={{ background: 'rgba(0,0,0,0.2)', flex: 1 }}
                                    />
                                    <button 
                                        type="button" 
                                        className="trello-upload-btn"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                    >
                                        <Plus size={16} /> {isUploading ? '...' : 'Photo/File'}
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        style={{ display: 'none' }} 
                                        onChange={handleFileSelect}
                                        accept="image/*,.pdf,.docx"
                                    />
                                </div>
                                {uploadedFiles.length > 0 && (
                                    <div className="uploaded-files-list">
                                        {uploadedFiles.map((url, idx) => (
                                            <div key={idx} className="file-chip">
                                                <span className="file-name">{url.split('/').pop()}</span>
                                                <X size={12} className="remove-file" onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="trello-sidebar">
                            <div>
                                <div className="trello-section-label"><User size={14} /> Assign Members</div>
                                <div className="mobile-assignee-list">
                                    {employees.filter(e => e.role !== 'ADMIN' && e.role !== 'MANAGER').map(emp => (
                                        <div 
                                            key={emp.id} 
                                            className={`trello-avatar-btn ${selectedEmployeeIds.includes(emp.id) ? 'selected' : ''}`}
                                            onClick={() => toggleEmployee(emp.id)}
                                            title={emp.name}
                                        >
                                            {emp.profilePhoto ? <img src={emp.profilePhoto} alt="av" /> : (emp.firstName?.charAt(0) || 'U')}
                                        </div>
                                    ))}
                                    <div className="trello-avatar-btn" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}><Plus size={16} color="rgba(255,255,255,0.2)" /></div>
                                </div>
                            </div>

                            <div>
                                <div className="trello-section-label"><Tag size={14} /> Priority Label</div>
                                <div className="trello-priority-pills" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                    {['LOW', 'MEDIUM', 'HIGH'].map(p => (
                                        <button 
                                            key={p} type="button" 
                                            className={`trello-priority-btn ${p.toLowerCase()} ${priority === p ? 'active' : ''}`}
                                            style={{ padding: '10px 0', borderRadius: '10px' }}
                                            onClick={() => setPriority(p)}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <DatePicker 
                                    label="Due Date"
                                    value={dueDate}
                                    onChange={(dt) => setDueDate(dt)}
                                    placeholder="Set a deadline"
                                />
                            </div>

                            {errorMsg && <div style={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 600, padding: '14px', background: 'rgba(239,68,68,0.08)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.15)' }}>{errorMsg}</div>}
                        </div>
                    </div>

                    <div className="trello-modal-footer">
                        <Button type="button" variant="glass" onClick={onClose} disabled={isSubmitting}>Discard</Button>
                        <Button type="submit" variant="primary" className="magnetic-btn" disabled={isSubmitting} style={{ background: 'var(--purple-main)', minWidth: '160px' }}>
                            {isSubmitting ? 'Processing...' : 'Allocate Task'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
