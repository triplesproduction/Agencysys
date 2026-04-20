'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Button from '../Button';
import { 
    X, Briefcase, Plus, Trash2, Zap
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import MultiMemberPicker from '../common/MultiMemberPicker';
import { EmployeeDTO } from '@/types/dto';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (projectId: string) => void;
}

export default function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
    const { employee: authEmployee } = useAuth();
    const [step, setStep] = useState(1);
    
    // Step 1: Project Data
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('MEDIUM');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [deadline, setDeadline] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    
    // Step 2: Task Backlog
    const [tasks, setTasks] = useState<{title: string, assigneeId?: string}[]>([]);
    
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
            setPriority('MEDIUM');
            setStartDate(new Date().toISOString().split('T')[0]);
            setDeadline('');
            setSelectedMemberIds(authEmployee ? [authEmployee.id] : []);
            setTasks([{ title: '', assigneeId: authEmployee?.id }]);
            setErrorMsg('');
        }
    }, [isOpen, authEmployee]);

    const duration = useMemo(() => {
        if (!startDate || !deadline) return 0;
        const start = new Date(startDate);
        const end = new Date(deadline);
        return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }, [startDate, deadline]);

    if (!isOpen) return null;

    const handleAddTaskRow = () => setTasks([...tasks, { title: '', assigneeId: authEmployee?.id }]);
    const handleRemoveTaskRow = (idx: number) => {
        const newTasks = [...tasks];
        newTasks.splice(idx, 1);
        setTasks(newTasks);
    };
    const updateTaskRow = (idx: number, field: string, val: string) => {
        const newTasks = [...tasks];
        (newTasks[idx] as any)[field] = val;
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
                priority,
                startDate,
                deadline,
                status: tasks.length > 0 ? 'ACTIVE' : 'PLANNING',
                createdBy: authEmployee?.id
            } as any);

            if (selectedMemberIds.length > 0) {
                await Promise.all(selectedMemberIds.map(uid => api.addProjectMember(project.id, uid)));
            }

            const validTasks = tasks.filter(t => t.title.trim() !== '');
            if (validTasks.length > 0) {
                await Promise.all(validTasks.map(t => api.createTask({
                    title: t.title,
                    projectId: project.id,
                    assigneeId: t.assigneeId,
                    status: 'TODO',
                    dueDate: new Date(deadline || Date.now()).toISOString(),
                    creatorId: authEmployee?.id
                })));
            }

            onSuccess(project.id);
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'System failed to launch project.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="wizard-overlay fade-in">
            <div className="wizard-card slide-up">
                
                {/* Header */}
                <div className="wizard-header">
                    <div className="wizard-title">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: 'var(--purple-main)', padding: '8px', borderRadius: '8px' }}>
                                <Briefcase size={18} color="white" />
                            </div>
                            <h2>
                                {step === 1 ? 'Initiation' : step === 2 ? 'Backlog' : 'Activation'}
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
                <div className="wizard-body custom-scrollbar" style={{ overflowY: 'auto', maxHeight: '60vh' }}>
                    
                    {step === 1 && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div className="wizard-field-group">
                                <label className="wizard-label">Project Identity</label>
                                <input 
                                    className="wizard-input" 
                                    placeholder="Title (e.g. Q4 Growth Cycle)" 
                                    value={name}
                                    autoFocus
                                    onChange={(e) => setName(e.target.value)}
                                    style={{ fontSize: '1.1rem', fontWeight: 700 }}
                                />
                                <textarea 
                                    className="wizard-input"
                                    placeholder="Strategic roadmap..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    style={{ minHeight: '80px', resize: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="wizard-field-group">
                                    <label className="wizard-label">Kickoff</label>
                                    <input type="date" className="wizard-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </div>
                                <div className="wizard-field-group">
                                    <label className="wizard-label">Deadline</label>
                                    <input type="date" className="wizard-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                                </div>
                            </div>

                            <div className="wizard-field-group">
                                <label className="wizard-label">Priority Level</label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {['LOW', 'MEDIUM', 'HIGH'].map(p => (
                                        <button 
                                            key={p} 
                                            className={`trello-priority-btn ${p.toLowerCase()} ${priority === p ? 'active' : ''}`}
                                            onClick={() => setPriority(p)}
                                            style={{ flex: 1, height: '44px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="wizard-field-group">
                                <label className="wizard-label">Portfolio Team</label>
                                <MultiMemberPicker 
                                    selectedIds={selectedMemberIds}
                                    members={employees as any}
                                    onChange={setSelectedMemberIds}
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Tactical Units</h3>
                                <Button variant="glass" onClick={handleAddTaskRow} icon={<Plus size={16} />}>Add Unit</Button>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {tasks.map((t, idx) => (
                                    <div key={idx} className="premium-task-item" style={{ gridTemplateColumns: '1fr 160px 40px', gap: '12px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                                        <input 
                                            className="wizard-input" 
                                            placeholder="Unit Objective..." 
                                            value={t.title}
                                            onChange={(e) => updateTaskRow(idx, 'title', e.target.value)}
                                            style={{ border: 'none', background: 'transparent' }}
                                        />
                                        <select 
                                            className="wizard-input"
                                            value={t.assigneeId}
                                            onChange={(e) => updateTaskRow(idx, 'assigneeId', e.target.value)}
                                            style={{ border: 'none', background: 'rgba(255,255,255,0.03)', fontSize: '0.8rem' }}
                                        >
                                            <option value="">Lead...</option>
                                            {employees.filter(e => selectedMemberIds.includes(e.id)).map(e => (
                                                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                                            ))}
                                        </select>
                                        <button className="icon-btn-ghost danger" onClick={() => handleRemoveTaskRow(idx)}><Trash2 size={16} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                <div className="project-card" style={{ gap: '4px' }}>
                                    <span className="wizard-label">Timeline</span>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{duration}d</div>
                                </div>
                                <div className="project-card" style={{ gap: '4px' }}>
                                    <span className="wizard-label">Units</span>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{tasks.filter(t => t.title).length}</div>
                                </div>
                                <div className="project-card" style={{ gap: '4px' }}>
                                    <span className="wizard-label">Force</span>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{selectedMemberIds.length}</div>
                                </div>
                            </div>

                            <div className="project-card" style={{ padding: '20px !important', background: 'rgba(139, 92, 246, 0.03) !important', borderColor: 'rgba(139, 92, 246, 0.1) !important' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <Zap size={14} color="var(--purple-main)" />
                                    <span style={{ fontWeight: 800, textTransform: 'uppercase', color: 'var(--purple-main)', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Deployment Summary</span>
                                </div>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '4px' }}>{name}</h4>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', lineHeight: 1.5 }}>{description || 'No strategic overview provided.'}</p>
                            </div>
                        </div>
                    )}

                    {errorMsg && <div className="error-box" style={{ fontSize: '0.8rem' }}>{errorMsg}</div>}
                </div>

                {/* Footer */}
                <div className="wizard-footer">
                    {step > 1 ? (
                        <Button variant="glass" onClick={() => setStep(step - 1)} disabled={isSubmitting}>
                            Prev
                        </Button>
                    ) : (
                        <Button variant="glass" onClick={onClose} disabled={isSubmitting}>Discard</Button>
                    )}

                    <div style={{ display: 'flex', gap: '12px' }}>
                        {step < 3 ? (
                            <Button 
                                variant="primary" 
                                style={{ height: '44px', borderRadius: '10px', padding: '0 24px' }}
                                onClick={() => setStep(step + 1)}
                                disabled={step === 1 && !name}
                            >
                                Continue
                            </Button>
                        ) : (
                            <Button 
                                variant="primary" 
                                style={{ height: '44px', borderRadius: '10px', padding: '0 24px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
                                onClick={handleFinalLaunch}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Syncing...' : 'Deploy Project'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
