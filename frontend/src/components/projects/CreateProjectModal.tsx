'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Button from '../Button';
import { 
    X, Briefcase, Plus, Trash2, Zap, Target, Users, Calendar, ShieldCheck, Flag
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import MultiMemberPicker from '../common/MultiMemberPicker';
import DatePicker from '../common/DatePicker';
import { EmployeeDTO } from '@/types/dto';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (projectId: string) => void;
}

type TaskEntry = {
    title: string;
    description: string;
    assigneeId?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
};

export default function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
    const { employee: authEmployee } = useAuth();
    const [step, setStep] = useState(1);
    
    // Step 1: Project Identity
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [deadline, setDeadline] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    
    // Step 2: Tactical Breakdown
    const [tasks, setTasks] = useState<TaskEntry[]>([]);
    
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
            setTasks([{ title: '', description: '', assigneeId: authEmployee?.id, priority: 'MEDIUM' }]);
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

    const handleAddTaskRow = () => setTasks([...tasks, { title: '', description: '', assigneeId: authEmployee?.id, priority: 'MEDIUM' }]);
    const handleRemoveTaskRow = (idx: number) => {
        const newTasks = [...tasks];
        newTasks.splice(idx, 1);
        setTasks(newTasks);
    };
    const updateTaskRow = (idx: number, field: keyof TaskEntry, val: string) => {
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
                priority: 'MEDIUM',
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
                    description: t.description,
                    projectId: project.id,
                    assigneeId: t.assigneeId,
                    status: 'TODO',
                    priority: t.priority,
                    dueDate: new Date(deadline || Date.now()).toISOString(),
                    creatorId: authEmployee?.id
                })));
            }

            onSuccess(project.id);
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'System failed to launch project initiative.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const validTasksCount = tasks.filter(t => t.title.trim() !== '').length;

    return (
        <div className="wizard-overlay fade-in">
            <div className="wizard-card slide-up">
                
                {/* Header */}
                <div className="wizard-header">
                    <div>
                        <div className="wizard-title">
                            <h2>
                                {step === 1 ? 'Project Identity' : step === 2 ? 'Tactical Breakdown' : 'Activation Overview'}
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
                    
                    {step === 1 && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div className="wizard-field-group">
                                <label className="wizard-label">Initiative Details</label>
                                <input 
                                    className="wizard-input" 
                                    placeholder="Initiative Title (e.g. Q4 Market Expansion)" 
                                    value={name}
                                    autoFocus
                                    onChange={(e) => setName(e.target.value)}
                                    style={{ fontSize: '1.1rem', fontWeight: 700, padding: '16px 20px' }}
                                />
                                <textarea 
                                    className="wizard-input"
                                    placeholder="High-level strategic roadmap and objectives..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    style={{ minHeight: '100px', resize: 'none', lineHeight: 1.5, padding: '16px 20px', fontSize: '0.95rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="wizard-field-group">
                                    <label className="wizard-label"><Calendar size={12} style={{ marginRight: 6 }} /> Kickoff Date</label>
                                    <DatePicker value={startDate} onChange={setStartDate} />
                                </div>
                                <div className="wizard-field-group">
                                    <label className="wizard-label"><Target size={12} style={{ marginRight: 6 }} /> Deadline</label>
                                    <DatePicker value={deadline} onChange={setDeadline} />
                                </div>
                            </div>

                            <div className="wizard-field-group">
                                <label className="wizard-label"><Users size={12} style={{ marginRight: 6 }} /> Core Specialist Team</label>
                                <MultiMemberPicker 
                                    selectedIds={selectedMemberIds}
                                    members={employees as any}
                                    onChange={setSelectedMemberIds}
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="wizard-field-group">
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Mission Backlog</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)', margin: 0 }}>Identify and configure initial deployment units.</p>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {tasks.map((t, idx) => (
                                    <div key={idx} className="tactical-task-card slide-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                                        <button className="card-remove-btn" onClick={() => handleRemoveTaskRow(idx)}><Trash2 size={18} /></button>
                                        
                                        <div className="task-card-header">
                                            <div className="task-card-icon-box">
                                                <Target size={24} />
                                            </div>
                                            <div className="task-card-info">
                                                <input 
                                                    className="wizard-input" 
                                                    placeholder="Tactical Unit Objective (e.g. Design System Specs)" 
                                                    value={t.title}
                                                    onChange={(e) => updateTaskRow(idx, 'title', e.target.value)}
                                                    style={{ border: 'none', background: 'transparent', padding: '0', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}
                                                />
                                                <textarea 
                                                    className="wizard-input"
                                                    placeholder="Operational instructions and scope definition..."
                                                    value={t.description}
                                                    onChange={(e) => updateTaskRow(idx, 'description', e.target.value)}
                                                    style={{ border: 'none', background: 'transparent', padding: '0', fontSize: '0.95rem', color: 'rgba(255,255,255,0.4)', minHeight: '44px', resize: 'none', lineHeight: 1.5 }}
                                                />
                                            </div>
                                        </div>

                                        <div className="task-card-body">
                                            <div className="priority-tab-group">
                                                {['LOW', 'MEDIUM', 'HIGH'].map(p => (
                                                    <button 
                                                        key={p}
                                                        className={`p-tab ${p.toLowerCase()} ${t.priority === p ? 'active' : ''}`}
                                                        onClick={() => updateTaskRow(idx, 'priority', p)}
                                                        type="button"
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                            <select 
                                                className="wizard-select"
                                                value={t.assigneeId}
                                                onChange={(e) => updateTaskRow(idx, 'assigneeId', e.target.value)}
                                            >
                                                <option value="">Select Specialist...</option>
                                                {employees.filter(e => selectedMemberIds.includes(e.id)).map(e => (
                                                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}

                                <button className="wizard-add-task-btn" onClick={handleAddTaskRow}>
                                    <Plus size={20} /> Add Tactical Unit
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                            <div className="summary-grid">
                                <div className="summary-card">
                                    <h5>Mission Length</h5>
                                    <div className="val">{duration}d</div>
                                </div>
                                <div className="summary-card">
                                    <h5>Tactical Units</h5>
                                    <div className="val">{validTasksCount}</div>
                                </div>
                                <div className="summary-card">
                                    <h5>Specialist Force</h5>
                                    <div className="val">{selectedMemberIds.length}</div>
                                </div>
                            </div>

                            <div className="deployment-overview-box">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                    <ShieldCheck size={28} color="var(--purple-main)" />
                                    <span style={{ fontWeight: 800, textTransform: 'uppercase', color: 'var(--purple-main)', fontSize: '0.85rem', letterSpacing: '0.2em' }}>Strategic Deployment Audit</span>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <h4 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.04em', color: 'white' }}>{name}</h4>
                                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.1rem', lineHeight: 1.7, margin: 0, maxWidth: '600px' }}>{description || 'No strategic overview provided for this initiative.'}</p>
                                </div>

                                <div style={{ marginTop: '40px', paddingTop: '40px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.1em' }}>Operational Saturation</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{validTasksCount > 2 ? 'High Precision' : 'Tactical Baseline'}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.1em' }}>Deployment Readiness</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                            <Zap size={18} /> OPTIMIZED
                                        </div>
                                    </div>
                                </div>
                            </div>
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
                            Return to Previous
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
                                Continue Selection
                            </Button>
                        ) : (
                            <Button 
                                variant="primary" 
                                size="lg"
                                style={{ borderRadius: '14px', fontWeight: 800 }}
                                onClick={handleFinalLaunch}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Syncing...' : 'Confirm Deployment'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
