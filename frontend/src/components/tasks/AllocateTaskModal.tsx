'use client';

import React, { useState, useEffect, useRef } from 'react';
import GlassCard from '../GlassCard';
import Button from '../Button';
import Input from '../Input';
import { X, ChevronDown, User, Calendar, Tag, FileText, Plus, CheckSquare } from 'lucide-react';
import { api } from '@/lib/api';
import DatePicker from '../common/DatePicker';
import MarkdownEditor from '../common/MarkdownEditor';
import MultiMemberPicker from '../common/MultiMemberPicker';
import { EmployeeDTO } from '@/types/dto';
import { useAuth } from '@/context/AuthContext';
import './TasksModal.css';


interface AllocateTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AllocateTaskModal({ isOpen, onClose, onSuccess }: AllocateTaskModalProps) {
    const { employee: authEmployee } = useAuth();
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
    
    // Checklist State
    const [checklistItems, setChecklistItems] = useState<string[]>([]);
    const [newChecklistItem, setNewChecklistItem] = useState('');

    const [managerId, setManagerId] = useState('');
    const [isManagerListOpen, setIsManagerListOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isTaskListOpen, setIsTaskListOpen] = useState(false);
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);



    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            api.getTasks().then(setTasks).catch(console.error);
            api.getEmployees({ limit: 1000 }).then(data => {
                let empArray = Array.isArray(data) ? data : (data as any).data || [];
                setEmployees(empArray);
            }).catch(err => console.error('Failed to fetch employees', err));

            // Reset Form
            setTitle(''); setSelectedTaskId(''); setSelectedEmployeeIds([]);
            setPriority('MEDIUM'); setDueDate(new Date().toISOString().split('T')[0]); setInstructions('');
            setAttachments(''); setUploadedFiles([]); setErrorMsg('');
            setManagerId(''); setIsManagerListOpen(false);
            setChecklistItems([]); setNewChecklistItem('');

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

            let finalDescription = instructions || selectedTask?.description || 'Allocated Task';
            if (checklistItems.length > 0) {
                const checklistMarkdown = `\n\n## Execution Checklist\n` + checklistItems.map(item => `- [ ] ${item}`).join('\n');
                finalDescription += checklistMarkdown;
            }

            const formData = {
                title: title + (saveAsTemplate ? ' [TEMPLATE]' : ''),
                description: finalDescription,
                instructions,
                assigneeIds: selectedEmployeeIds,
                managerId: managerId || undefined,
                priority,
                creatorId: authEmployee?.id, // Crucial: Set the creator
                dueDate: new Date(dueDate).toISOString(),
                attachments: allAttachments.length > 0 ? allAttachments : undefined,
                status: 'TODO'
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
                                    {(() => {
                                        const desc = selectedTaskId ? tasks.find(t => t.id === selectedTaskId)?.description || '' : 'Selecting a task template will auto-populate additional context and scope definitions here.';
                                        return desc.split('## Execution Checklist')[0].trim();
                                    })()}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="trello-section-label">Execution Instructions</div>
                                <MarkdownEditor 
                                    value={instructions}
                                    onChange={setInstructions}
                                    placeholder="Add specific instructions for this allocation..."
                                />
                            </div>

                            <div className="form-row">
                                <div className="trello-section-label"><CheckSquare size={14} /> Execution Checklist (Optional)</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {checklistItems.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px' }}>
                                            <div style={{ width: '14px', height: '14px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '3px' }}></div>
                                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)', flex: 1 }}>{item}</span>
                                            <button type="button" onClick={() => setChecklistItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={14}/></button>
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <Input 
                                            placeholder="Add a checklist item + Enter..." 
                                            value={newChecklistItem}
                                            onChange={(e) => setNewChecklistItem(e.target.value)}
                                            onKeyDown={(e) => {
                                                if(e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if(newChecklistItem.trim()) {
                                                        setChecklistItems(prev => [...prev, newChecklistItem.trim()]);
                                                        setNewChecklistItem('');
                                                    }
                                                }
                                            }}
                                            style={{ background: 'rgba(0,0,0,0.2)', flex: 1 }}
                                        />
                                        <Button type="button" variant="glass" onClick={() => {
                                            if(newChecklistItem.trim()) {
                                                setChecklistItems(prev => [...prev, newChecklistItem.trim()]);
                                                setNewChecklistItem('');
                                            }
                                        }}>Add</Button>
                                    </div>
                                </div>
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
                                <MultiMemberPicker 
                                    selectedIds={selectedEmployeeIds}
                                    members={employees as any}
                                    onChange={setSelectedEmployeeIds}
                                />
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

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                                <div>
                                    <DatePicker 
                                        label="Due Date"
                                        value={dueDate}
                                        onChange={(dt) => setDueDate(dt)}
                                        placeholder="Set a deadline"
                                    />
                                </div>
                            </div>


                            <div>
                                <label className="template-checkbox-label" style={{ marginTop: '12px', width: '100%', borderStyle: 'solid', borderColor: saveAsTemplate ? 'var(--purple-main)' : 'rgba(255,255,255,0.1)' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={saveAsTemplate}
                                        onChange={(e) => setSaveAsTemplate(e.target.checked)}
                                    />
                                    <span style={{ fontWeight: 600 }}>Save as reusable template</span>
                                </label>
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
