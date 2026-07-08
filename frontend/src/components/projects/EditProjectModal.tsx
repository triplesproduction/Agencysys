'use client';

import React, { useState, useEffect } from 'react';
import Button from '../Button';
import { X, Calendar, Edit3, Type, Clock, Target } from 'lucide-react';
import { ProjectDTO } from '@/types/dto';
import { useUpdateProject } from '@/hooks/queries/domains/projects/useProjects';
import DatePicker from '../common/DatePicker';

interface EditProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: ProjectDTO | null;
}

export default function EditProjectModal({ isOpen, onClose, project }: EditProjectModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<ProjectDTO['status']>('ACTIVE');
    const [deadline, setDeadline] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const { mutateAsync: updateProject } = useUpdateProject();

    useEffect(() => {
        if (isOpen && project) {
            setName(project.name);
            setDescription(project.description || '');
            setStatus(project.status);
            setDeadline(project.deadline || '');
            setErrorMsg('');
        }
    }, [isOpen, project]);

    if (!isOpen || !project) return null;

    const handleSave = async () => {
        if (!name) return;
        setIsSubmitting(true);
        setErrorMsg('');

        try {
            await updateProject({
                id: project.id,
                payload: {
                    name,
                    description,
                    status,
                    deadline: deadline || null,
                } as any
            });
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to update project.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="wizard-overlay fade-in">
            <div className="wizard-card slide-up" style={{ maxWidth: '500px' }}>
                <div className="wizard-glow"></div>

                <div className="wizard-header">
                    <div>
                        <div className="wizard-title">
                            <h2>Edit Project</h2>
                        </div>
                    </div>
                    <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="wizard-body custom-scrollbar" style={{ overflowY: 'auto', maxHeight: '70vh', padding: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        <div className="wizard-field-group">
                            <label className="wizard-label"><Type size={14} /> Project Designation</label>
                            <input
                                className="wizard-input"
                                placeholder="e.g. Q4 Website Redesign"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="wizard-field-group">
                            <label className="wizard-label"><Target size={14} /> Strategic Objective</label>
                            <textarea
                                className="wizard-input"
                                placeholder="Provide a brief overview of the project's goals..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="wizard-field-group">
                                <label className="wizard-label"><Clock size={14} /> Operational Status</label>
                                <select 
                                    className="wizard-select" 
                                    value={status} 
                                    onChange={(e) => setStatus(e.target.value as any)}
                                    style={{ width: '100%', height: '48px', fontSize: '0.95rem' }}
                                >
                                    <option value="PLANNING">Planning Phase</option>
                                    <option value="ACTIVE">Active Engagement</option>
                                    <option value="ON_HOLD">On Hold</option>
                                    <option value="COMPLETED">Successfully Closed</option>
                                </select>
                            </div>

                            <div className="wizard-field-group">
                                <label className="wizard-label"><Calendar size={14} /> Target Deadline</label>
                                <DatePicker value={deadline} onChange={setDeadline} />
                            </div>
                        </div>

                        {errorMsg && <div className="error-box">{errorMsg}</div>}
                    </div>
                </div>

                <div className="wizard-footer">
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button variant="primary" onClick={handleSave} disabled={isSubmitting || !name}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
