'use client';

import React, { useState, useEffect, useRef } from 'react';
import GlassCard from '../GlassCard';
import Button from '../Button';
import Input from '../Input';
import { EmployeeDTO } from '@/types/dto';
import { X, Calendar, Clock, Link as LinkIcon, ChevronDown, User, Info } from 'lucide-react';

import { api } from '@/lib/api';
import DatePicker from '../common/DatePicker';
import MarkdownEditor from '../common/MarkdownEditor';
import MultiMemberPicker from '../common/MultiMemberPicker';
import './AdminAssignTaskModal.css';


interface AdminAssignTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (data: any) => Promise<void>;
}

export default function AdminAssignTaskModal({ isOpen, onClose, onAssign }: AdminAssignTaskModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [managerId, setManagerId] = useState(''); 
    const [priority, setPriority] = useState('MEDIUM');
    const [dueDate, setDueDate] = useState('');
    const [attachments, setAttachments] = useState('');
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);


    // Real data from API
    const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isManagerListOpen, setIsManagerListOpen] = useState(false);


    useEffect(() => {
        if (isOpen) {
            // Fetch real employees to prevent Foreign Key constraint crashes on the fake IDs
            api.getEmployees({ limit: 1000 }).then(data => {
                let empArray = Array.isArray(data) ? data : (data as any).data || [];
                setEmployees(empArray);
            }).catch(err => console.error('Failed to fetch employees', err));

            // Reset state
            setTitle('');
            setDescription('');
            setSelectedEmployeeIds([]);
            setManagerId('');
            setPriority('MEDIUM');
            setDueDate('');
            setAttachments('');
            setSaveAsTemplate(false);
            setErrorMsg('');
            setIsManagerListOpen(false);


        }
    }, [isOpen]);

    const toggleEmployeeSelection = (id: string) => {
        setSelectedEmployeeIds(prev =>
            prev.includes(id) ? prev.filter(empId => empId !== id) : [...prev, id]
        );
    };

    const empListRef = useRef<HTMLDivElement>(null);
    const managerListRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (managerListRef.current && !managerListRef.current.contains(event.target as Node)) {
                setIsManagerListOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsSubmitting(true);

        try {
            // Requirement 4: Ensure deadline is sent as ISOString
            let formattedDueDate = '';
            if (dueDate) {
                formattedDueDate = new Date(dueDate).toISOString();
            }

            let finalManagerId = managerId;
            if (managerId === 'ADMIN') {
                const adminEmp = employees.find(e => e.roleId === 'ADMIN');
                if (!adminEmp) throw new Error("No Admin account exists in the system to assign.");
                finalManagerId = adminEmp.id;
            } else if (managerId === 'MANAGER') {
                const mgrEmp = employees.find(e => e.roleId === 'MANAGER');
                if (!mgrEmp) throw new Error("No Manager account exists in the system to assign.");
                finalManagerId = mgrEmp.id;
            }


            const formData = {
                title: title + (saveAsTemplate ? ' [TEMPLATE]' : ''),
                description: description || 'No description provided.',
                assigneeIds: selectedEmployeeIds,
                managerId: finalManagerId === "" ? undefined : finalManagerId,
                priority,
                dueDate: formattedDueDate,
                attachments: attachments ? attachments.split(',').map(url => url.trim()).filter(url => url !== "") : undefined,
                // isTemplate: saveAsTemplate
            };

            await onAssign(formData);
            onClose();

        } catch (err: any) {
            console.error('Assignment failed:', err);
            setErrorMsg(err.message || 'Validation failed. Please check required fields.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedManagerLabel = managerId === 'ADMIN' ? 'Admin' : managerId === 'MANAGER' ? 'Manager' : 'None';

    return (
        <div className="anti-gravity-modal-overlay fade-in">
            <GlassCard className="anti-gravity-modal slide-up">

                {/* Neon Glow Orchestration */}
                <div className="modal-glow-top" />
                <div className="modal-glow-bottom" />

                <div className="modal-header">
                    <h2>Assign New Task</h2>
                    <button type="button" className="close-btn" onClick={onClose}><X size={20} /></button>
                </div>


                <form onSubmit={handleSubmit} className="modal-content-container custom-scrollbar">
                    <div className="modal-main-column">
                        <div className="form-group-minimal">
                            <input
                                className="giant-title-input"
                                placeholder="Task Title..."
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                            <div className="workspace-label">WORKSPACE: CORPORATE OPERATIONS</div>
                        </div>

                        <div className="form-section">
                            <label className="section-title"><Info size={14} /> Description & Context</label>
                            <MarkdownEditor 
                                value={description}
                                onChange={setDescription}
                                placeholder="Write task details, requirements, or steps here..."
                            />
                        </div>

                        <div className="form-section">
                            <label className="template-save-option">
                                <input 
                                    type="checkbox" 
                                    checked={saveAsTemplate}
                                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                                />
                                <span>Save as Task Template for future use</span>
                            </label>
                        </div>
                    </div>

                    <div className="modal-side-column">
                        <div className="side-section">
                            <label className="side-label"><User size={14} /> Members</label>
                            <MultiMemberPicker 
                                members={employees}
                                selectedIds={selectedEmployeeIds}
                                onChange={setSelectedEmployeeIds}
                            />
                        </div>

                        <div className="side-section">
                            <label className="side-label"><Clock size={14} /> Schedule</label>
                            <DatePicker 
                                label="Deadline"
                                value={dueDate}
                                onChange={setDueDate}
                                required
                            />
                        </div>

                        <div className="side-section">
                            <label className="side-label"><ChevronDown size={14} /> High-Level Details</label>
                            <div className="side-grid">
                                <div className="input-field">
                                    <label>Priority</label>
                                    <select value={priority} onChange={(e) => setPriority(e.target.value)} className="glass-native-select">
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="side-section">
                            <label className="side-label"><LinkIcon size={14} /> Attachments</label>
                            <textarea 
                                className="side-textarea"
                                placeholder="URLs (comma separated)"
                                value={attachments}
                                onChange={(e) => setAttachments(e.target.value)}
                            />
                        </div>

                        {errorMsg && <div className="error-banner">{errorMsg}</div>}
                    </div>
                </form>

            </GlassCard>
        </div>
    );
}
