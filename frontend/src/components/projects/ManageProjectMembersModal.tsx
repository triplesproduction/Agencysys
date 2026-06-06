import React, { useState, useEffect } from 'react';
import { X, Users, Check, Search, PlusCircle, Trash2, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { ProjectDTO, EmployeeDTO } from '@/types/dto';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { useAddProjectMember, useRemoveProjectMember } from '@/hooks/queries/domains/projects/useProjects';
import { useEmployees } from '@/hooks/queries/domains/employees/useEmployees';
import Button from '@/components/Button';

interface ManageProjectMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: ProjectDTO;
    onRefresh: () => void;
}

export default function ManageProjectMembersModal({ isOpen, onClose, project, onRefresh }: ManageProjectMembersModalProps) {
    const { addNotification } = useNotifications();
    const [searchQuery, setSearchQuery] = useState('');
    const [syncing, setSyncing] = useState<string | null>(null);

    const { data: employees = [], isLoading: loading } = useEmployees({ limit: 1000 });
    const { mutateAsync: addProjectMember } = useAddProjectMember();
    const { mutateAsync: removeProjectMember } = useRemoveProjectMember();

    const isMember = (employeeId: string) => {
        return project.members?.some(m => m.userId === employeeId);
    };

    const handleAddMember = async (employeeId: string) => {
        setSyncing(employeeId);
        try {
            await addProjectMember({ projectId: project.id, userId: employeeId, role: 'MEMBER' });
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
            await removeProjectMember({ id: membership.id, projectId: project.id });
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
        <div className="trello-modal-overlay fade-in">
            <div className="trello-modal slide-up" style={{ width: '500px', maxWidth: '90vw' }}>
                <div className="trello-modal-header" style={{ padding: '24px 32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        <div style={{ background: 'var(--purple-main)', padding: '10px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)' }}>
                            <Shield size={22} color="white" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Manage Members</h2>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.05em', marginTop: '4px' }}>PROJECT ACCESS CONTROL</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={20} />
                    </button>
                </div>

                <div className="trello-modal-body custom-scrollbar" style={{ padding: '0 32px' }}>
                    <div className="emp-search" style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0 16px', marginBottom: '16px' }}>
                        <Search size={16} color="rgba(255,255,255,0.4)" />
                        <input 
                            placeholder="Identify specific personnel..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', padding: '16px 12px', width: '100%', fontSize: '0.9rem' }}
                        />
                    </div>

                    <div className="custom-scrollbar" style={{ maxHeight: '40vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '24px' }}>
                        {loading ? (
                            <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>Loading Members...</p>
                        ) : filteredEmployees.length === 0 ? (
                            <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>No matching personnel found.</p>
                        ) : (
                            filteredEmployees.map(emp => {
                                const active = isMember(emp.id);
                                const isSyncing = syncing === emp.id;

                                return (
                                    <div key={emp.id} className="member-item" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', borderRadius: '12px', background: active ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${active ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                                        <div className="member-avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                            {emp.profilePhoto ? <img src={emp.profilePhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{emp.firstName.charAt(0)}</span>}
                                        </div>
                                        <div className="member-info" style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{emp.firstName} {emp.lastName}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{emp.designation}</div>
                                        </div>
                                        
                                        {isSyncing ? (
                                            <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                                        ) : active ? (
                                            <button 
                                                onClick={() => handleRemoveMember(emp.id)}
                                                style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}
                                                title="Remove Member"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleAddMember(emp.id)}
                                                style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: 'pointer' }}
                                                title="Add Member"
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

                <div className="trello-modal-footer" style={{ padding: '24px 32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>
                        <Shield size={12} />
                        Authorized Access Only
                    </div>
                    <Button variant="primary" onClick={onClose} style={{ background: 'var(--purple-main)', padding: '0 24px', height: '40px', borderRadius: '12px', fontWeight: 600 }}>Done</Button>
                </div>
            </div>
        </div>
    );
}
