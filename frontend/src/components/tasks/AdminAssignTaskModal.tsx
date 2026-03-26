'use client';

import React, { useState, useEffect, useRef } from 'react';
import GlassCard from '../GlassCard';
import Button from '../Button';
import Input from '../Input';
import { X, Calendar, Clock, Link as LinkIcon, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import './AdminAssignTaskModal.css';

interface AdminAssignTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (data: any) => Promise<void>;
}

export default function AdminAssignTaskModal({ isOpen, onClose, onAssign }: AdminAssignTaskModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [managerId, setManagerId] = useState(''); // Optional Reporting Manager
    const [priority, setPriority] = useState('MEDIUM');
    const [expectedHours, setExpectedHours] = useState('');
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [attachments, setAttachments] = useState(''); // Simple comma separated string for now

    // Mock Data fetching (In a real app, wire to `/api/v1/employees`)
    const [employees, setEmployees] = useState<{ id: string, name: string, role: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isEmpListOpen, setIsEmpListOpen] = useState(false);
    const [isManagerListOpen, setIsManagerListOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Fetch real employees to prevent Foreign Key constraint crashes on the fake IDs
            api.getEmployees({ limit: 1000 }).then(data => {
                // Determine if it returned PaginatedResponse or Array (api.ts returns json.data if present)
                let empArray = Array.isArray(data) ? data : (data as any).data || [];

                setEmployees(empArray.map((e: any) => ({
                    id: e.id,
                    name: `${e.firstName} ${e.lastName}`,
                    role: e.roleId
                })));
            }).catch(err => console.error('Failed to fetch employees', err));
            // Reset state
            setTitle('');
            setDescription('');
            setInstructions('');
            setSelectedEmployeeIds([]);
            setManagerId('');
            setPriority('MEDIUM');
            setExpectedHours('');
            setStartDate('');
            setDueDate('');
            setAttachments('');
            setErrorMsg('');
            setIsEmpListOpen(false);
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
            if (empListRef.current && !empListRef.current.contains(event.target as Node)) {
                setIsEmpListOpen(false);
            }
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
                const adminEmp = employees.find(e => e.role === 'ADMIN');
                if (!adminEmp) throw new Error("No Admin account exists in the system to assign.");
                finalManagerId = adminEmp.id;
            } else if (managerId === 'MANAGER') {
                const mgrEmp = employees.find(e => e.role === 'MANAGER');
                if (!mgrEmp) throw new Error("No Manager account exists in the system to assign.");
                finalManagerId = mgrEmp.id;
            }

            const formData = {
                title,
                description,
                instructions,
                assigneeIds: selectedEmployeeIds,
                managerId: finalManagerId === "" ? undefined : finalManagerId,
                priority,
                expectedHours: expectedHours ? parseFloat(expectedHours) : undefined,
                startDate: startDate ? new Date(startDate).toISOString() : undefined,
                dueDate: formattedDueDate,
                attachments: attachments ? attachments.split(',').map(url => url.trim()).filter(url => url !== "") : undefined
            };

            // Requirement 3: Payload Debug

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
                    <button className="close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form scroll-smooth">

                    <div className="form-row">
                        <Input
                            label="Task Title"
                            placeholder="e.g. Implement WebSocket Provider"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-row split-row">
                        <div className="input-group" style={{ position: 'relative' }} ref={empListRef}>
                            <label className="input-label">Assign To (Multiple Allowed)</label>
                            <div 
                                className={`glass-select dropdown-trigger ${isEmpListOpen ? 'active' : ''}`} 
                                onClick={() => setIsEmpListOpen(!isEmpListOpen)}
                            >
                                <span style={{ color: selectedEmployeeIds.length > 0 ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                                    {selectedEmployeeIds.length > 0 ? `${selectedEmployeeIds.length} Employee(s) Selected` : '-- Select Employees --'}
                                </span>
                                <ChevronDown size={18} className={`transition-transform ${isEmpListOpen ? 'rotate-180' : ''}`} />
                            </div>
                            
                            {isEmpListOpen && (
                                <div className="dropdown-options-container">
                                    <div className="options-list custom-scrollbar">
                                        {employees.filter(e => e.role !== 'MANAGER' && e.role !== 'ADMIN').map(emp => (
                                            <label key={emp.id} className="option-item">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEmployeeIds.includes(emp.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        toggleEmployeeSelection(emp.id);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span>{emp.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="input-group" style={{ position: 'relative' }} ref={managerListRef}>
                            <label className="input-label">Reporting Manager</label>
                            <div 
                                className={`glass-select dropdown-trigger ${isManagerListOpen ? 'active' : ''}`}
                                onClick={() => setIsManagerListOpen(!isManagerListOpen)}
                            >
                                <span>{selectedManagerLabel}</span>
                                <ChevronDown size={18} className={`transition-transform ${isManagerListOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {isManagerListOpen && (
                                <div className="dropdown-options-container">
                                    <div className="options-list">
                                        {['None', 'Admin', 'Manager'].map(opt => (
                                            <div 
                                                key={opt} 
                                                className={`option-item ${selectedManagerLabel === opt ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setManagerId(opt === 'None' ? '' : opt.toUpperCase());
                                                    setIsManagerListOpen(false);
                                                }}
                                            >
                                                {opt}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-row split-row">
                        <div className="input-group">
                            <label className="input-label">Priority</label>
                            <div className="priority-pills">
                                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => (
                                    <button
                                        key={p} type="button"
                                        className={`priority-pill ${priority === p ? 'active' : ''} ${p.toLowerCase()}`}
                                        onClick={() => setPriority(p)}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="form-row split-row">
                        <Input
                            type="date"
                            label="Start Date (Optional)"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <Input
                            type="date"
                            label="Deadline"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-row split-row">
                        <Input
                            type="number"
                            step="0.5"
                            label="Est. Hours"
                            placeholder="Hours"
                            value={expectedHours}
                            onChange={(e) => setExpectedHours(e.target.value)}
                        />
                        <Input
                            label="Attachments (URLs, comma separated)"
                            placeholder="https://link1.com, https://link2.com"
                            value={attachments}
                            onChange={(e) => setAttachments(e.target.value)}
                        />
                    </div>

                    <div className="form-row">
                        <label className="input-label">Description & Instructions</label>
                        <textarea
                            className="glass-textarea"
                            rows={3}
                            placeholder="Elaborate on the task details..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                        />
                        <textarea
                            className="glass-textarea mt-2"
                            rows={2}
                            placeholder="Checklist or step-by-step instructions..."
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                        />
                    </div>

                    {errorMsg && (
                        <div className="form-row" style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                            {errorMsg}
                        </div>
                    )}

                    <div className="modal-footer">
                        <Button type="button" variant="glass" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" variant="primary" className="magnetic-btn" disabled={isSubmitting}>
                            {isSubmitting ? 'Assigning...' : 'Assign Task'}
                        </Button>
                    </div>

                </form>
            </GlassCard>
        </div>
    );
}
