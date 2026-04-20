import React, { useState, useEffect } from 'react';
import { X, Users, Check, Search, PlusCircle, Trash2, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { ProjectDTO, EmployeeDTO } from '@/types/dto';
import Button from '@/components/Button';
import { useNotifications } from '@/components/notifications/NotificationProvider';

interface ManageProjectMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: ProjectDTO;
    onRefresh: () => void;
}

export default function ManageProjectMembersModal({ isOpen, onClose, project, onRefresh }: ManageProjectMembersModalProps) {
    const { addNotification } = useNotifications();
    const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [syncing, setSyncing] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
        }
    }, [isOpen]);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await api.getEmployees({ limit: 1000 });
            setEmployees(res.data);
        } catch (err) {
            console.error('Failed to fetch employees:', err);
        } finally {
            setLoading(false);
        }
    };

    const isMember = (employeeId: string) => {
        return project.members?.some(m => m.userId === employeeId);
    };

    const handleAddMember = async (employeeId: string) => {
        setSyncing(employeeId);
        try {
            await api.addProjectMember(project.id, employeeId, 'MEMBER');
            addNotification({ title: 'Force Deployed', message: 'Specialist successfully assigned to active operations.', type: 'success' });
            onRefresh();
        } catch (err) {
            addNotification({ title: 'Sync Failure', message: 'Could not authorize deployment.', type: 'error' });
        } finally {
            setSyncing(null);
        }
    };

    const handleRemoveMember = async (employeeId: string) => {
        const membership = project.members?.find(m => m.userId === employeeId);
        if (!membership) return;

        setSyncing(employeeId);
        try {
            await api.removeProjectMember(membership.id);
            addNotification({ title: 'Force Recalled', message: 'Specialist withdrawn from tactical assignment.', type: 'info' });
            onRefresh();
        } catch (err) {
            addNotification({ title: 'Sync Failure', message: 'Could not process withdrawal.', type: 'error' });
        } finally {
            setSyncing(null);
        }
    };

    const filteredEmployees = employees.filter(e => 
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.designation?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
        const aMem = isMember(a.id);
        const bMem = isMember(b.id);
        if (aMem && !bMem) return -1;
        if (!aMem && bMem) return 1;
        return 0;
    });

    if (!isOpen) return null;

    return (
        <div className="wizard-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
            <div className="wizard-card fade-in" style={{ width: '500px', maxHeight: '80vh' }}>
                <div className="wizard-header">
                    <div className="wizard-title">
                        <h2>Force Management</h2>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontWeight: 600 }}>Modify Tactical Deployments</span>
                    </div>
                    <button className="wizard-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="wizard-body">
                    <div className="emp-search" style={{ width: '100%', marginBottom: '16px' }}>
                        <Search size={16} />
                        <input 
                            placeholder="Identify specific personnel..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                        {loading ? (
                            <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>Accessing Personnel Records...</p>
                        ) : filteredEmployees.length === 0 ? (
                            <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>No matching personnel found.</p>
                        ) : (
                            filteredEmployees.map(emp => {
                                const active = isMember(emp.id);
                                const isSyncing = syncing === emp.id;

                                return (
                                    <div key={emp.id} className="member-item" style={{ margin: 0, background: active ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255,255,255,0.02)', borderColor: active ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)' }}>
                                        <div className="member-avatar">
                                            {emp.profilePhoto ? <img src={emp.profilePhoto} /> : <span>{emp.firstName.charAt(0)}</span>}
                                        </div>
                                        <div className="member-info">
                                            <div className="member-name">{emp.firstName} {emp.lastName}</div>
                                            <div className="member-role">{emp.designation}</div>
                                        </div>
                                        
                                        {isSyncing ? (
                                            <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                                        ) : active ? (
                                            <button 
                                                className="tag-remove" 
                                                onClick={() => handleRemoveMember(emp.id)}
                                                style={{ padding: '8px' }}
                                                title="Recall Personnel"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        ) : (
                                            <button 
                                                className="add-member-trigger" 
                                                onClick={() => handleAddMember(emp.id)}
                                                style={{ borderStyle: 'solid', background: 'rgba(255,255,255,0.03)' }}
                                                title="Deploy Personnel"
                                            >
                                                <PlusCircle size={16} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="wizard-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>
                        <Shield size={12} />
                        Authorized Access Only
                    </div>
                    <Button variant="primary" onClick={onClose}>Complete Sync</Button>
                </div>
            </div>
        </div>
    );
}
