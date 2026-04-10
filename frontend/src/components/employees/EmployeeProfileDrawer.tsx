'use client';

import { useState, useRef, useEffect } from 'react';
import { X, User, CheckSquare, Clock, Calendar, TrendingUp, MessageSquare, Download, ShieldAlert, Mail, MapPin, Phone, QrCode, Image as ImageIcon, FileText, Eye, Plus, ShieldCheck, RefreshCw, Printer, ArrowUpRight } from 'lucide-react';
import { EmployeeDTO } from '@/types/dto';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import Link from 'next/link';
import DigitalEmployeeCard from './DigitalEmployeeCard';
import DatePicker from '../common/DatePicker';

const DEPARTMENT_ROLES: Record<string, string[]> = {
    'Admin': ['Admin'],
    'Operations': ['Manager', 'Project Manager', 'Sales Executive'],
    'Marketing': ['Digital Marketer', 'SEO Specialist', 'Social Media Manager'],
    'Development': ['Website Developer', 'AI Journalist', 'UI Designer', 'App Developer', 'Software Developer', 'QA Tester'],
    'Content Creation': ['Model', 'Influencer', 'Cameraman', 'Cinematographer'],
    'Creative': ['Graphics Designer', 'Video Editor', 'Content Writer']
};

export default function EmployeeProfileDrawer({ employee, onClose, onRefresh }: { employee: EmployeeDTO, onClose: () => void, onRefresh?: () => void }) {
    const { user: currentUser, employee: authProfile } = useAuth();
    const { addNotification } = useNotifications();
    
    // Auth & Permissions (Rename to avoid shadow prop)
    const isAdminUser = authProfile?.roleId?.toUpperCase() === 'ADMIN';
    const isEditingOwnProfile = String(authProfile?.id) === String(employee.id);
    
    const [activeTab, setActiveTab] = useState('OVERVIEW');
    const [isIdCardOpen, setIsIdCardOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isResetingPassword, setIsResetingPassword] = useState(false);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [isHikeModalOpen, setIsHikeModalOpen] = useState(false);
    const [hikeData, setHikeData] = useState({ amount: 0, reason: '', effectiveDate: new Date().toISOString().split('T')[0] });
    const [isApplyingHike, setIsApplyingHike] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    
    const [profilePhoto, setProfilePhoto] = useState(employee.profilePhoto);
    const [editData, setEditData] = useState({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone || '',
        roleId: employee.roleId || 'EMPLOYEE',
        designation: employee.designation || '',
        address: employee.address || '',
        status: (employee.status || 'ACTIVE') as "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED" | "SUSPENDED",
        department: employee.department || '',
        employmentType: employee.employmentType || 'FULL_TIME',
        internshipStatus: employee.internshipStatus || '',
        internshipStipend: employee.internshipStipend || 0,
        baseSalary: employee.baseSalary || 0,
        experience: employee.experience || 0,
        dob: employee.dob || '',
        joinedAt: employee.joinedAt || '',
        gender: employee.gender || '' as 'MALE' | 'FEMALE' | 'OTHER' | '',
        emergencyContact: employee.emergencyContact || '',
        workLocation: employee.workLocation || 'OFFICE' as 'OFFICE' | 'REMOTE' | 'HYBRID',
    });
    
    // Dynamic Data State
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [isLoadingTabData, setIsLoadingTabData] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setProfilePhoto(employee.profilePhoto);
    }, [employee.profilePhoto]);

    useEffect(() => {
        if (activeTab === 'ATTENDANCE') {
            loadActivityLogs();
        } else if (activeTab === 'LEAVES') {
            loadLeaves();
        }
    }, [activeTab, employee.id]);

    const loadActivityLogs = async () => {
        setIsLoadingTabData(true);
        try {
            const logs = await api.getKpiAuditLogs(employee.id);
            setActivityLogs(logs || []);
        } catch (err) {
            console.error('Failed to load activity logs:', err);
        } finally {
            setIsLoadingTabData(false);
        }
    };

    const loadLeaves = async () => {
        setIsLoadingTabData(true);
        try {
            const data = await api.getEmployeeLeaves(employee.id);
            setLeaves(data || []);
        } catch (err) {
            console.error('Failed to load leaves:', err);
        } finally {
            setIsLoadingTabData(false);
        }
    };

    const handlePhotoClick = () => {
        if (isEditingOwnProfile || isAdminUser) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation: Format
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            alert('Invalid file format. Please upload JPG, JPEG, or PNG.');
            return;
        }

        // Validation: Size (4MB)
        if (file.size > 4 * 1024 * 1024) {
            alert('File size too large. Maximum limit is 4MB.');
            return;
        }

        setIsUploading(true);
        try {
            const { url } = await api.uploadPhoto(file, profilePhoto || undefined);
            await api.updateEmployee(employee.id, { profilePhoto: url });
            setProfilePhoto(url);
            addNotification({
                title: 'Photo Updated',
                message: 'Your profile photo has been synchronized.',
                type: 'SYSTEM'
            });
            // Proactive notification for UI refresh if needed
            window.dispatchEvent(new CustomEvent('app:profile-updated', { detail: { employeeId: employee.id, profilePhoto: url } }));
        } catch (err: any) {
            alert(`Failed to save photo: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleExportDossier = () => {
        const dossier = {
            metadata: {
                exportedAt: new Date().toISOString(),
                system: "TripleS OS",
                version: "1.0-Phase1"
            },
            employee: {
                id: employee.id,
                name: `${employee.firstName} ${employee.lastName}`,
                email: employee.email,
                role: employee.roleId,
                status: employee.status,
                joinedAt: employee.joinedAt,
                phone: employee.phone,
                address: employee.address
            },
            kpis: employee.kpis || [],
            tasksCount: employee.tasksAssigned?.length || 0,
            recentTasks: employee.tasksAssigned?.slice(0, 5) || []
        };

        const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Dossier_${employee.firstName}_${employee.lastName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleResetPassword = async () => {
        if (!isAdminUser) {
            alert('Only administrators can trigger password resets for other employees.');
            return;
        }

        if (!window.confirm(`Are you sure you want to trigger a password reset for ${employee.email}?`)) return;
        
        setIsResetingPassword(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(employee.email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            addNotification({
                title: 'Security Sync',
                message: `Password reset link has been dispatched to ${employee.email}.`,
                type: 'SYSTEM'
            });
        } catch (err: any) {
            alert('Failed to send reset link: ' + err.message);
        } finally {
            setIsResetingPassword(false);
        }
    };

    const handleSetPassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            alert('Password must be at least 6 characters.');
            return;
        }

        if (!window.confirm(`Are you sure you want to manually OVERRIDE the password for ${employee.firstName}?`)) return;

        setIsUpdatingPassword(true);
        try {
            await api.manageEmployeeAccount('UPDATE_PASSWORD', employee.id, { password: newPassword });
            
            addNotification({
                title: 'Security Override',
                message: `Password has been manually updated for ${employee.firstName}.`,
                type: 'SYSTEM'
            });
            
            setNewPassword('');
            setShowPasswordInput(false);
        } catch (err: any) {
            console.error('Password update failed:', err);
            alert(`Failed to update password: ${err.message}`);
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation: Size (4MB)
        if (file.size > 4 * 1024 * 1024) {
            addNotification({
                title: 'Security Alert',
                message: 'Document exceeds the 4MB transmission limit. Please optimize the file.',
                type: 'SYSTEM'
            });
            return;
        }

        setIsUploadingDoc(true);
        try {
            const { url } = await api.uploadFile(file);
            const { error } = await supabase.from('employee_documents').insert({
                employeeId: employee.id,
                name: file.name,
                fileType: file.type,
                content: url,
                uploadedAt: new Date().toISOString()
            });

            if (error) throw error;
            addNotification({
                title: 'Document Vault',
                message: `${file.name} successfully encrypted and stored.`,
                type: 'SYSTEM'
            });
            
            // Trigger refresh to update the UI
            onRefresh?.();
        } catch (err: any) {
            alert('Upload failed: ' + err.message);
        } finally {
            setIsUploadingDoc(false);
        }
    };

    const [isSaving, setIsSaving] = useState(false);

    const handleSaveChanges = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const updatePayload = {
                firstName: editData.firstName,
                lastName: editData.lastName,
                email: editData.email,
                phone: editData.phone,
                roleId: editData.roleId,
                address: editData.address,
                status: editData.status as any,
                department: editData.department,
                employmentType: editData.employmentType,
                internshipStatus: editData.internshipStatus || null,
                internshipStipend: editData.internshipStipend || null,
                baseSalary: editData.baseSalary || null,
                experience: editData.experience || null,
                designation: editData.designation || null,
                dob: editData.dob || null,
                joinedAt: editData.joinedAt || null,
            };

            console.log('[Save] Sending update payload:', updatePayload);
            await api.updateEmployee(employee.id, updatePayload);
            setIsEditing(false);
            
            addNotification({
                title: 'Profile Saved',
                message: 'All changes have been saved successfully.',
                type: 'SYSTEM'
            });
            
            window.dispatchEvent(new CustomEvent('app:employee-updated', { detail: { id: employee.id } }));
            onRefresh?.();
        } catch (err: any) {
            console.error('[Save] Update failed — full error:', err);
            addNotification({
                title: 'Save Failed',
                message: err?.message || 'Could not save changes. Check console for details.',
                type: 'SYSTEM'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: 'OVERVIEW', icon: User, label: 'Overview' },
        { id: 'TASKS', icon: CheckSquare, label: 'Tasks' },
        { id: 'DOCUMENTS', icon: FileText, label: 'Documents' },
        { id: 'ATTENDANCE', icon: Clock, label: 'Activity' },
        { id: 'LEAVES', icon: Calendar, label: 'Leaves' },
        { id: 'PERFORMANCE', icon: TrendingUp, label: 'Performance' },
        { id: 'CHAT', icon: MessageSquare, label: 'Chat Logs' }
    ];

    // Accurate calculations using real data from the employee object
    const kpiScore = employee.kpis?.[0]?.currentValue || 0;
    const activeTasksCount = employee.tasksAssigned?.filter(t => t.status !== 'DONE' && t.status !== 'APPROVED').length || 0;
    const leaveRecords = employee.leaves || [];
    const leaveBal = 12 - leaveRecords.filter(l => l.status === 'APPROVED' && l.leaveType !== 'UNPAID').length;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'OVERVIEW':
                return (
                    <div className="fade-in">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10B981' }}>{kpiScore}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '6px', letterSpacing: '0.05em' }}>Current KPI</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--purple-main)' }}>{activeTasksCount}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '6px', letterSpacing: '0.05em' }}>Active Tasks</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#F59E0B' }}>{leaveBal}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '6px', letterSpacing: '0.05em' }}>Leave Balance</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Personal Identity</h3>
                            {isEditing && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="secondary-button"
                                    style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <ImageIcon size={16} /> {isUploading ? 'Syncing...' : 'Update Photo'}
                                </button>
                            )}
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Full Name</div>
                                    {isEditing ? (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input 
                                                value={editData.firstName} 
                                                placeholder="First Name"
                                                onChange={e => setEditData({ ...editData, firstName: e.target.value })}
                                                style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                                            />
                                            <input 
                                                value={editData.lastName} 
                                                placeholder="Last Name"
                                                onChange={e => setEditData({ ...editData, lastName: e.target.value })}
                                                style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                                            />
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '1.05rem', fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>{employee.firstName} {employee.lastName}</div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8 }}><Mail size={12} /> Work Email</div>
                                    {isEditing ? (
                                        <input 
                                            value={editData.email} 
                                            onChange={e => setEditData({ ...editData, email: e.target.value })}
                                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                                        />
                                    ) : (
                                        <div style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>{employee.email}</div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8 }}><Phone size={12} /> Phone Number</div>
                                    {isEditing ? (
                                        <input 
                                            value={editData.phone} 
                                            onChange={e => setEditData({ ...editData, phone: e.target.value })}
                                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                                        />
                                    ) : (
                                        <div style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>{employee.phone || 'N/A'}</div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Designation</div>
                                    {isEditing ? (
                                        <select 
                                            value={editData.designation} 
                                            onChange={e => setEditData({ ...editData, designation: e.target.value })}
                                            className="filter-select"
                                            disabled={!isAdminUser}
                                            style={{ width: '100%', minWidth: 'unset', opacity: !isAdminUser ? 0.6 : 1, cursor: !isAdminUser ? 'not-allowed' : 'pointer' }}
                                        >
                                            {editData.department && DEPARTMENT_ROLES[editData.department]?.map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))}
                                            {!editData.department && <option value={editData.designation}>{editData.designation}</option>}
                                        </select>
                                    ) : (
                                        <div style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>{employee.designation || employee.roleId || 'General Staff'}</div>
                                    )}
                                </div>
                                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8 }}><MapPin size={12} /> Address</div>
                                    {isEditing ? (
                                        <input 
                                            value={editData.address} 
                                            onChange={e => setEditData({ ...editData, address: e.target.value })}
                                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                                        />
                                    ) : (
                                        <div style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>{employee.address || 'N/A'}</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Professional Metadata Section */}
                        <div style={{ marginTop: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Professional Profile</h3>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Department</div>
                                        {isEditing ? (
                                            <select 
                                                className="filter-select" 
                                                value={editData.department} 
                                                disabled={!isAdminUser}
                                                onChange={e => { const dept = e.target.value; setEditData({ ...editData, department: dept, designation: DEPARTMENT_ROLES[dept]?.[0] || editData.designation }); }} 
                                                style={{ width: '100%', minWidth: 'unset', opacity: !isAdminUser ? 0.6 : 1, cursor: !isAdminUser ? 'not-allowed' : 'pointer' }}
                                            >
                                                <option value="">Select Department</option>
                                                {Object.keys(DEPARTMENT_ROLES).map(dept => (<option key={dept} value={dept}>{dept}</option>))}
                                            </select>
                                        ) : (
                                            <div style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>{employee.department || 'Unassigned'}</div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Joined Date</div>
                                        {isEditing ? (
                                            <div style={{ opacity: !isAdminUser ? 0.6 : 1, pointerEvents: !isAdminUser ? 'none' : 'auto' }}>
                                                <DatePicker label="" value={editData.joinedAt} onChange={dt => setEditData({ ...editData, joinedAt: dt })} />
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>{employee.joinedAt ? new Date(employee.joinedAt).toLocaleDateString() : 'N/A'}</div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Employment</div>
                                        {isEditing ? (
                                            <select 
                                                className="filter-select" 
                                                value={editData.employmentType} 
                                                disabled={!isAdminUser}
                                                onChange={e => { const type = e.target.value; setEditData({ ...editData, employmentType: type as any, internshipStatus: type === 'INTERNSHIP' ? 'PAID' : '' }); }} 
                                                style={{ width: '100%', minWidth: 'unset', opacity: !isAdminUser ? 0.6 : 1, cursor: !isAdminUser ? 'not-allowed' : 'pointer' }}
                                            >
                                                <option value="FULL_TIME">Full Time</option>
                                                <option value="PART_TIME">Part Time</option>
                                                <option value="INTERNSHIP">Internship</option>
                                            </select>
                                        ) : (
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', background: 'var(--purple-main)', padding: '4px 8px', borderRadius: '4px', width: 'fit-content', textTransform: 'uppercase' }}>
                                                {employee.employmentType?.replace('_', ' ') || 'FULL TIME'}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Monthly Financial</div>
                                        {isEditing ? (
                                            <input 
                                                type="number" 
                                                className="input-field" 
                                                disabled={!isAdminUser}
                                                value={editData.employmentType === 'INTERNSHIP' ? editData.internshipStipend : editData.baseSalary} 
                                                onChange={e => editData.employmentType === 'INTERNSHIP' ? setEditData({ ...editData, internshipStipend: Number(e.target.value) }) : setEditData({ ...editData, baseSalary: Number(e.target.value) })} 
                                                style={{ padding: '8px 12px', opacity: !isAdminUser ? 0.6 : 1, cursor: !isAdminUser ? 'not-allowed' : 'text' }} 
                                            />
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10B981' }}>
                                                    ₹{(employee.employmentType === 'INTERNSHIP' && employee.internshipStatus === 'PAID' ? employee.internshipStipend : employee.baseSalary)?.toLocaleString() || '0'}
                                                </div>
                                                {isAdminUser && (
                                                    <button 
                                                        onClick={() => {
                                                            setHikeData({ ...hikeData, amount: (employee.employmentType === 'INTERNSHIP' ? employee.internshipStipend : employee.baseSalary) || 0 });
                                                            setIsHikeModalOpen(true);
                                                        }}
                                                        style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}
                                                    >
                                                        Give Hike
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Total Experience</div>
                                        {isEditing ? (
                                            <input type="number" step="0.1" className="input-field" value={editData.experience} onChange={e => setEditData({ ...editData, experience: Number(e.target.value) })} style={{ padding: '8px 12px' }} />
                                        ) : (
                                            <div style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>{employee.experience || 0} Years</div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Office Pulse</div>
                                        {isEditing ? (
                                            <select className="filter-select" value={editData.workLocation} onChange={e => setEditData({ ...editData, workLocation: e.target.value as any })} style={{ width: '100%', minWidth: 'unset' }}>
                                                <option value="OFFICE">Office</option>
                                                <option value="REMOTE">Remote</option>
                                                <option value="HYBRID">Hybrid</option>
                                            </select>
                                        ) : (
                                            <div style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>{employee.workLocation || 'OFFICE'}</div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Birthday</div>
                                        {isEditing ? (
                                            <DatePicker label="" value={editData.dob} onChange={dt => setEditData({ ...editData, dob: dt })} />
                                        ) : (
                                            <div style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>{employee.dob ? new Date(employee.dob).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'N/A'}</div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Gender</div>
                                        {isEditing ? (
                                            <select className="filter-select" value={editData.gender} onChange={e => setEditData({ ...editData, gender: e.target.value as any })} style={{ width: '100%', minWidth: 'unset' }}>
                                                <option value="">Select Gender</option>
                                                <option value="MALE">Male</option>
                                                <option value="FEMALE">Female</option>
                                                <option value="OTHER">Other</option>
                                            </select>
                                        ) : (
                                            <div style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>{employee.gender ? employee.gender.charAt(0) + employee.gender.slice(1).toLowerCase() : 'N/A'}</div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Emergency Contact</div>
                                        {isEditing ? (
                                            <input value={editData.emergencyContact} placeholder="+91 9876543210" onChange={e => setEditData({ ...editData, emergencyContact: e.target.value })} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }} />
                                        ) : (
                                            <div style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>{employee.emergencyContact || 'N/A'}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {isEditing && (
                            <div style={{ marginTop: '24px' }}>
                                <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <ShieldCheck size={20} color="var(--purple-main)" /> HR & Administration
                                </h3>
                                <div style={{ background: 'rgba(139, 92, 246, 0.05)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>System Access Permissions</div>
                                            <select
                                                className="filter-select"
                                                value={editData.roleId}
                                                disabled={!isAdminUser}
                                                onChange={e => setEditData({ ...editData, roleId: e.target.value })}
                                                style={{ width: '100%', minWidth: 'unset', opacity: !isAdminUser ? 0.6 : 1, cursor: !isAdminUser ? 'not-allowed' : 'pointer' }}
                                            >
                                                <option value="EMPLOYEE">Employee Access</option>
                                                <option value="MANAGER">Manager Access</option>
                                                <option value="ADMIN">Administrator Access</option>
                                            </select>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>System Status</div>
                                            <select
                                                className="filter-select"
                                                value={editData.status}
                                                onBlur={() => {}} // No-op for lint
                                                disabled={!isAdminUser}
                                                onChange={e => setEditData({ ...editData, status: e.target.value as any })}
                                                style={{ width: '100%', minWidth: 'unset', opacity: !isAdminUser ? 0.6 : 1, cursor: !isAdminUser ? 'not-allowed' : 'pointer' }}
                                            >
                                                <option value="ACTIVE">Active (Online)</option>
                                                <option value="INACTIVE">Inactive (Offline)</option>
                                                <option value="ON_LEAVE">On Leave</option>
                                                <option value="SUSPENDED">Suspended</option>
                                                <option value="TERMINATED">Terminated</option>
                                            </select>
                                        </div>

                                        {/* Internship-specific controls — only shown when employment type is INTERNSHIP */}
                                        {editData.employmentType === 'INTERNSHIP' && (
                                            <>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Stipend Type</div>
                                                    <select
                                                        className="filter-select"
                                                        value={editData.internshipStatus}
                                                        onChange={e => setEditData({ ...editData, internshipStatus: e.target.value })}
                                                        style={{ width: '100%', minWidth: 'unset' }}
                                                    >
                                                        <option value="PAID">Paid</option>
                                                        <option value="UNPAID">Unpaid</option>
                                                    </select>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Monthly Stipend (₹)</div>
                                                    <input
                                                        type="number"
                                                        className="input-field"
                                                        value={editData.internshipStipend}
                                                        onChange={e => setEditData({ ...editData, internshipStipend: Number(e.target.value) })}
                                                        disabled={editData.internshipStatus === 'UNPAID'}
                                                        style={{ padding: '8px 12px' }}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div style={{ gridColumn: '1 / -1', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>Credential Access</div>
                                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Manually override or reset employee security credentials.</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    {isAdminUser && !showPasswordInput && (
                                                        <button
                                                            onClick={() => setShowPasswordInput(true)}
                                                            className="secondary-button"
                                                            style={{ background: 'rgba(139,92,246,0.1)', color: 'var(--purple-light)', borderColor: 'rgba(139,92,246,0.2)' }}
                                                        >
                                                            Set New Password
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={handleResetPassword}
                                                        disabled={isResetingPassword}
                                                        className="secondary-button"
                                                        style={{ background: 'rgba(255,255,255,0.05)', color: 'white', borderColor: 'rgba(255,255,255,0.1)' }}
                                                    >
                                                        {isResetingPassword ? 'Sending Link...' : 'Send Reset Link'}
                                                    </button>
                                                </div>
                                            </div>

                                            {showPasswordInput && (
                                                <div className="fade-in" style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>New Password Override</div>
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <input
                                                            type="text"
                                                            className="input-field"
                                                            placeholder="Enter new secure password"
                                                            value={newPassword}
                                                            onChange={e => setNewPassword(e.target.value)}
                                                            style={{ flex: 1 }}
                                                        />
                                                        <button 
                                                            onClick={handleSetPassword}
                                                            disabled={isUpdatingPassword}
                                                            className="primary-button"
                                                            style={{ padding: '0 20px', fontSize: '0.85rem' }}
                                                        >
                                                            {isUpdatingPassword ? 'Updating...' : 'Set Password'}
                                                        </button>
                                                        <button 
                                                            onClick={() => { setShowPasswordInput(false); setNewPassword(''); }}
                                                            className="secondary-button"
                                                            style={{ padding: '0 12px' }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#F59E0B', marginTop: '8px' }}>
                                                        ⚠ This will immediately revoke the old password and set the new one.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                );
            case 'TASKS':
                return (
                    <div className="fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0 }}>Task Monitoring Hub</h3>
                            <button className="secondary-button" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>Download Report</button>
                        </div>
                        {employee.tasksAssigned && employee.tasksAssigned.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {employee.tasksAssigned.map((task: any) => (
                                    <div key={task.id} style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{task.title}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Due: {new Date(task.dueDate).toLocaleDateString()}</div>
                                        </div>
                                        <div style={{ padding: '4px 12px', background: task.status === 'DONE' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: task.status === 'DONE' ? '#10B981' : '#F59E0B', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                            {task.status.replace('_', ' ')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }}>
                                No active task assignments found.
                            </div>
                        )}
                    </div>
                );
            case 'DOCUMENTS':
                return (
                    <div className="fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0 }}>Employee Documents</h3>
                            {isAdminUser && (
                                <>
                                    <button 
                                        onClick={() => docInputRef.current?.click()} 
                                        disabled={isUploadingDoc}
                                        className="primary-button" 
                                        style={{ padding: '8px 16px', fontSize: '0.95rem' }}
                                    >
                                        <Plus size={18} /> {isUploadingDoc ? 'Uploading...' : 'Add Document'}
                                    </button>
                                    <input type="file" ref={docInputRef} style={{ display: 'none' }} onChange={handleDocUpload} />
                                </>
                            )}
                        </div>
                        {employee.documents && employee.documents.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {employee.documents.map((doc: any) => (
                                    <div key={doc.id} style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <FileText size={20} color="var(--purple-main)" />
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{doc.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                    {doc.fileType?.split('/')[1]?.toUpperCase() || 'FILE'} • Uploaded on {new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => {
                                                const win = window.open();
                                                win?.document.write(`
                                                    <html>
                                                        <body style="margin:0; background: #1a1a1a; display: flex; justify-content: center; align-items: center;">
                                                            <iframe src="${doc.content}" frameborder="0" style="width:100%; height:100%;" allowfullscreen></iframe>
                                                        </body>
                                                    </html>
                                                `);
                                            }} className="secondary-button" style={{ padding: '6px' }} title="View"><Eye size={16} /></button>
                                            <a href={doc.content} download={doc.name} className="secondary-button" style={{ padding: '6px', display: 'flex' }} title="Download"><Download size={16} /></a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--glass-border)' }}>
                                <FileText size={32} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                <div>No documents associated with this profile.</div>
                                {isAdminUser && <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Click "Add Document" to upload ID proofs or contracts.</p>}
                            </div>
                        )}
                    </div>
                );
            case 'ATTENDANCE':
                return (
                    <div className="fade-in">
                        <div>
                            {isLoadingTabData ? (
                                <div style={{ padding: '64px', textAlign: 'center' }}>
                                    <div className="spinner-mini" style={{ margin: '0 auto 16px' }}></div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Synchronizing audit trails...</div>
                                </div>
                            ) : activityLogs.length > 0 ? (
                                <div className="activity-timeline" style={{ padding: '8px' }}>
                                    {activityLogs.map((log, index) => (
                                        <div key={log.id} className="timeline-item" style={{ display: 'flex', gap: '20px', marginBottom: '0', position: 'relative', paddingBottom: '32px' }}>
                                            {/* Timeline Line */}
                                            {index !== activityLogs.length - 1 && (
                                                <div style={{
                                                    position: 'absolute', left: '11px', top: '24px', bottom: '0',
                                                    width: '2px', background: 'linear-gradient(to bottom, rgba(139,92,246,0.3) 0%, rgba(139,92,246,0) 100%)',
                                                    zIndex: 0
                                                }}></div>
                                            )}

                                            <div style={{
                                                width: '24px', height: '24px', borderRadius: '50%',
                                                background: log.points_change >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                border: `2px solid ${log.points_change >= 0 ? '#10B981' : '#EF4444'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0, zIndex: 1, position: 'relative',
                                                boxShadow: log.points_change >= 0 ? '0 0 10px rgba(16,185,129,0.3)' : '0 0 10px rgba(239,68,68,0.3)'
                                            }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: log.points_change >= 0 ? '#10B981' : '#EF4444' }}></div>
                                            </div>

                                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)', fontSize: '0.95rem' }}>{log.description}</div>
                                                    <div style={{
                                                        fontSize: '0.7rem', color: log.points_change >= 0 ? '#10B981' : '#EF4444',
                                                        fontWeight: 800, padding: '4px 10px', background: log.points_change >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                        borderRadius: '6px', border: `1px solid ${log.points_change >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                                        fontFamily: 'monospace'
                                                    }}>
                                                        {log.points_change >= 0 ? '+' : ''}{log.points_change} PTS
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ color: 'var(--purple-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{log.event_source}</span>
                                                    <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }}></span>
                                                    <span>{new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.7rem' }}>
                                                    <div style={{ color: 'rgba(255,255,255,0.3)' }}>Performance Shift:</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{log.visible_score_before.toFixed(1)}</span>
                                                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>→</span>
                                                        <span style={{ color: 'white', fontWeight: 600 }}>{log.visible_score_after.toFixed(1)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: '64px 32px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                    <Clock size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                    <h4 style={{ margin: '0 0 8px 0', color: 'rgba(255,255,255,0.7)' }}>No Activity Recorded</h4>
                                    <p style={{ fontSize: '0.85rem', maxWidth: '300px', margin: '0 auto' }}>This employee has no registered system events or KPI adjustments yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'LEAVES':
                return (
                    <div className="fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0 }}>Leave Management Records</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={loadLeaves} className="secondary-button" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>Refresh List</button>
                            </div>
                        </div>

                        {isLoadingTabData ? (
                            <div style={{ padding: '64px', textAlign: 'center' }}>
                                <div className="spinner-mini" style={{ margin: '0 auto 16px' }}></div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Accessing HR records...</div>
                            </div>
                        ) : leaves.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                {leaves.map((leave) => (
                                    <div key={leave.id} style={{
                                        padding: '24px', background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                                        border: '1px solid var(--glass-border)', borderRadius: '16px',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                                    }}>
                                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                            <div style={{
                                                width: '56px', height: '56px', borderRadius: '14px',
                                                background: 'rgba(139, 92, 246, 0.1)', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center', color: 'var(--purple-main)',
                                                border: '1px solid rgba(139,92,246,0.2)'
                                            }}>
                                                <Calendar size={28} />
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>{leave.leaveType}</span>
                                                    <span style={{
                                                        fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px',
                                                        background: 'rgba(255,255,255,0.05)', borderRadius: '4px',
                                                        textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
                                                        border: '1px solid rgba(255,255,255,0.1)'
                                                    }}>LEAVE APPLICATION</span>
                                                </div>
                                                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', marginTop: '6px', fontWeight: 500 }}>
                                                    {new Date(leave.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.2)' }}>→</span>
                                                    {new Date(leave.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px', lineHeight: '1.4' }}>
                                                    &ldquo;{leave.reason}&rdquo;
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                                            <div style={{
                                                padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800,
                                                background: leave.status === 'APPROVED' ? 'rgba(16,185,129,0.1)' : leave.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                color: leave.status === 'APPROVED' ? '#10B981' : leave.status === 'REJECTED' ? '#EF4444' : '#F59E0B',
                                                border: `1px solid ${leave.status === 'APPROVED' ? 'rgba(16,185,129,0.3)' : leave.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                                letterSpacing: '0.05em'
                                            }}>
                                                {leave.status}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                                                Applied {new Date(leave.appliedAt || leave.createdAt || Date.now()).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '64px 32px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                <Calendar size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                <h4 style={{ margin: '0 0 8px 0', color: 'rgba(255,255,255,0.7)' }}>No Leaves Recorded</h4>
                                <p style={{ fontSize: '0.85rem', maxWidth: '300px', margin: '0 auto' }}>There are no historical or pending leave applications for this employee.</p>
                            </div>
                        )}
                    </div>
                );
            case 'PERFORMANCE':
                return (
                    <div className="fade-in">
                        <h3 style={{ marginBottom: '24px' }}>Performance Trajectory</h3>
                        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--glass-border)' }}>
                            <TrendingUp size={32} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                            Enterprise Charting module hook pending.
                        </div>
                    </div>
                );
            case 'CHAT':
                return (
                    <div className="fade-in">
                        <h3 style={{ marginBottom: '24px' }}>Communication Oversite (Admin Read-Only)</h3>
                        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--glass-border)' }}>
                            <ShieldAlert size={32} style={{ margin: '0 auto 16px', opacity: 0.5, color: '#EF4444' }} />
                            Secure chat interception layer pending Phase 5 rollout.
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }} className="fade-in">

            <div className="modal-content scale-in" style={{ 
                background: 'var(--bg-darker)', 
                width: '100%', 
                maxWidth: '1020px', 
                maxHeight: '88vh', 
                display: 'flex', 
                flexDirection: 'column', 
                borderRadius: 'var(--radius-lg)', 
                border: '1px solid var(--glass-border)', 
                boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)', 
                overflow: 'hidden', 
                position: 'relative' 
            }}>

                {/* Header Profile Section */}
                <div style={{ padding: '32px', borderBottom: '1px solid var(--glass-border)', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(0,0,0,0) 100%)', position: 'relative' }}>
                    <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '32px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--glass-border)', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '50%' }} className="hoverable">
                        <X size={20} />
                    </button>

                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div
                            onClick={handlePhotoClick}
                            className="profile-avatar-wrapper"
                            style={{
                                width: '96px', height: '96px', borderRadius: '50%',
                                background: 'var(--purple-main)', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: '2.5rem', fontWeight: 700,
                                overflow: 'hidden', border: '4px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
                                cursor: (isEditingOwnProfile || isAdminUser) ? 'pointer' : 'default',
                                position: 'relative'
                            }}
                        >
                            {profilePhoto ? <img src={profilePhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Profile" /> : employee.firstName.charAt(0)}

                            {(isEditingOwnProfile || isAdminUser) && (

                                <div className="avatar-hover-overlay" style={{
                                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    justifyContent: 'center', opacity: 0, transition: 'all 0.2s ease',
                                    fontSize: '0.7rem', color: 'white', textAlign: 'center',
                                    padding: '8px', pointerEvents: 'none'
                                }}>
                                    <ImageIcon size={16} style={{ marginBottom: '4px' }} />
                                    <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Change</span>
                                    <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Photo</span>
                                </div>
                            )}

                            {isUploading && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div className="spinner-mini"></div>
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".jpg,.jpeg,.png"
                            onChange={handleFileChange}
                        />

                        <div>
                            <h2 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {employee.firstName} {employee.lastName}
                                                                <span className={`status-badge ${
                                    employee.status === 'ACTIVE' ? 'approved' : 
                                    employee.status === 'ON_LEAVE' ? 'pending' : 
                                    employee.status === 'SUSPENDED' ? 'rejected' : 
                                    employee.status === 'TERMINATED' ? 'rejected' : 'todo'
                                }`} style={{ fontSize: '0.7rem', padding: '4px 14px' }}>
                                    {employee.status.replace(/_/g, ' ')}
                                </span>
                            </h2>

                            <div style={{ color: 'var(--purple-light)', fontSize: '0.9rem', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{employee.roleId.replace(/_/g, ' ')} • {employee.department || 'General'}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>{employee.id}</span>
                                <span style={{ opacity: 0.6 }}>Joined {new Date(employee.joinedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Modal Body (Sidebar + Content) */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    
                    {/* Sidebar Navigation */}
                    <div style={{ 
                        width: '280px', 
                        borderRight: '1px solid var(--glass-border)', 
                        background: 'rgba(0,0,0,0.2)',
                        display: 'flex', 
                        flexDirection: 'column', 
                        padding: '24px 16px',
                        gap: '6px',
                        overflowY: 'auto'
                    }}>
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '14px', 
                                        padding: '12px 18px',
                                        background: isActive ? 'var(--purple-glow)' : 'transparent', 
                                        border: '1px solid',
                                        borderColor: isActive ? 'var(--glass-border-purple)' : 'transparent',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        color: isActive ? 'white' : 'var(--text-secondary)',
                                        fontWeight: isActive ? 700 : 500,
                                        fontSize: '0.9rem',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                        textAlign: 'left',
                                        width: '100%'
                                    }}
                                    className="hoverable"
                                >
                                    <Icon size={18} color={isActive ? 'var(--purple-main)' : 'currentColor'} /> 
                                    <span style={{ opacity: isActive ? 1 : 0.8 }}>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content Area */}
                    <div style={{ flex: 1, padding: '40px', overflowY: 'auto', background: 'rgba(255,255,255,0.01)' }}>
                        {renderTabContent()}
                    </div>
                </div>

                {/* Action Footer */}
                <div style={{ padding: '24px 32px', borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="secondary-button hoverable" onClick={() => setIsIdCardOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
                        <QrCode size={16} /> View Digital ID Card
                    </button>
                    <button 
                        className="secondary-button hoverable" 
                        onClick={handleExportDossier}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Download size={16} /> Export Dossier
                    </button>
                    
                    {(isAdminUser || isEditingOwnProfile) && (
                        <>
                            <button 
                                className="primary-button hoverable" 
                                onClick={isEditing ? handleSaveChanges : () => {
                                    setIsEditing(true);
                                    setActiveTab('OVERVIEW');
                                }}
                                disabled={isSaving}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isSaving ? 0.7 : 1 }}
                            >
                                {isEditing ? (
                                    isSaving ? <>Saving...</> : <>Save Profile</>
                                ) : (
                                    <><User size={16} /> {isEditingOwnProfile && !isAdminUser ? 'Update My Profile' : 'Edit Capabilities'}</>
                                )}
                            </button>
                            {isEditing && (
                                <button 
                                    className="secondary-button hoverable" 
                                    onClick={() => setIsEditing(false)}
                                    style={{ opacity: 0.7 }}
                                >
                                    Cancel
                                </button>
                            )}
                        </>
                    )}
                </div>

            </div>

            {isIdCardOpen && <DigitalEmployeeCard employee={employee} onClose={() => setIsIdCardOpen(false)} />}

            {/* Salary Hike Modal */}
            {isHikeModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: '#0d0d1a', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '20px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(to right, rgba(139,92,246,0.1), transparent)' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <ArrowUpRight size={20} color="var(--purple-main)" /> Salary Appreciation
                            </h3>
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Update employee compensation with historical tracking.</p>
                        </div>
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label className="input-label">New Monthly CTC (INR)</label>
                                <input 
                                    type="number" 
                                    className="input-field" 
                                    value={hikeData.amount} 
                                    onChange={e => setHikeData({ ...hikeData, amount: Number(e.target.value) })}
                                    style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10B981' }}
                                />
                            </div>
                            <div>
                                <label className="input-label">Effective From</label>
                                <input 
                                    type="date" 
                                    className="input-field" 
                                    value={hikeData.effectiveDate} 
                                    onChange={e => setHikeData({ ...hikeData, effectiveDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Appreciation Reason / Note</label>
                                <textarea 
                                    className="input-field" 
                                    rows={3} 
                                    placeholder="e.g., Performance Bonus, Annual Review, Promotion..."
                                    value={hikeData.reason}
                                    onChange={e => setHikeData({ ...hikeData, reason: e.target.value })}
                                />
                            </div>
                        </div>
                        <div style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.02)', display: 'flex', gap: '12px' }}>
                            <button 
                                onClick={() => setIsHikeModalOpen(false)}
                                className="secondary-button"
                                style={{ flex: 1 }}
                            >Cancel</button>
                            <button 
                                disabled={isApplyingHike}
                                onClick={async () => {
                                    setIsApplyingHike(true);
                                    try {
                                        await api.addSalaryHike(employee.id, hikeData.amount, hikeData.effectiveDate, hikeData.reason);
                                        addNotification({
                                            title: 'Salary Updated',
                                            message: `Success! New salary effective from ${hikeData.effectiveDate}.`,
                                            type: 'PERFORMANCE'
                                        });
                                        setIsHikeModalOpen(false);
                                        onRefresh?.();
                                    } catch (err: any) {
                                        alert('Failed to apply hike: ' + err.message);
                                    } finally {
                                        setIsApplyingHike(false);
                                    }
                                }}
                                className="primary-button"
                                style={{ flex: 1, boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}
                            >
                                {isApplyingHike ? 'Processing...' : 'Confirm Hike'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
