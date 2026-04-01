'use client';

import { useState, useRef } from 'react';
import { X, User, CheckSquare, Clock, Calendar, TrendingUp, MessageSquare, Download, ShieldAlert, Mail, MapPin, Phone, QrCode, Image as ImageIcon, FileText, Eye } from 'lucide-react';
import { EmployeeDTO } from '@/types/dto';
import { api } from '@/lib/api';
import { getUserFromToken } from '@/lib/auth';
import DigitalEmployeeCard from './DigitalEmployeeCard';

export default function EmployeeProfileDrawer({ employee, onClose }: { employee: EmployeeDTO, onClose: () => void }) {
    const [activeTab, setActiveTab] = useState('OVERVIEW');
    const [isIdCardOpen, setIsIdCardOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [profilePhoto, setProfilePhoto] = useState(employee.profilePhoto);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const token = getUserFromToken();
    const currentUserId = token?.sub || token?.employeeId;
    const isOwnProfile = currentUserId === employee.id;

    const handlePhotoClick = () => {
        if (isOwnProfile || getUserFromToken()?.roleId === 'ADMIN') {
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

        // Validation: Size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('File size too large. Maximum limit is 2MB.');
            return;
        }

        try {
            setIsUploading(true);
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const base64String = reader.result as string;
                    await api.updateEmployee(employee.id, { profilePhoto: base64String });
                    setProfilePhoto(base64String);
                    // Proactive notification for UI refresh if needed
                    window.dispatchEvent(new CustomEvent('app:profile-updated', { detail: { employeeId: employee.id, profilePhoto: base64String } }));
                } catch (err: any) {
                    alert(`Failed to save photo: ${err.message}`);
                } finally {
                    setIsUploading(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('Photo upload failed:', err);
            setIsUploading(false);
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

    // Mock calculations due to missing aggregation endpoints
    const kpiScore = employee.kpis?.[0]?.currentValue || 0;
    const activeTasks = employee.tasksAssigned?.filter(t => t.status !== 'DONE').length || 0;
    const leaveBal = employee.leaves ? 12 - employee.leaves.length : 12;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'OVERVIEW':
                return (
                    <div className="fade-in">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10B981' }}>{kpiScore}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '8px' }}>Current KPI</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--purple-main)' }}>{activeTasks}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '8px' }}>Active Tasks</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#F59E0B' }}>{leaveBal}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '8px' }}>Leave Balance</div>
                            </div>
                        </div>

                        <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Personal Identity</h3>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                <div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Full Name</div>
                                    <div>{employee.firstName} {employee.lastName}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={14} /> Work Email</div>
                                    <div>{employee.email}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={14} /> Phone Number</div>
                                    <div>{employee.phone || 'N/A'}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Designation</div>
                                    <div>{employee.designation || 'General Staff'}</div>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={14} /> Address</div>
                                    <div>{employee.address || 'N/A'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'TASKS':
                return (
                    <div className="fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0 }}>Task Monitoring Hub</h3>
                            <button className="secondary-button" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Download Report</button>
                        </div>
                        {employee.tasksAssigned && employee.tasksAssigned.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {employee.tasksAssigned.map((task: any) => (
                                    <div key={task.id} style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{task.title}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Due: {new Date(task.dueDate).toLocaleDateString()}</div>
                                        </div>
                                        <div style={{ padding: '4px 12px', background: task.status === 'DONE' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: task.status === 'DONE' ? '#10B981' : '#F59E0B', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                            {task.status.replace('_', ' ')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)' }}>
                                No active task assignments found.
                            </div>
                        )}
                    </div>
                );
            case 'DOCUMENTS':
                return (
                    <div className="fade-in">
                        <h3 style={{ marginBottom: '24px' }}>Employee Documents</h3>
                        {employee.documents && employee.documents.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {employee.documents.map((doc: any) => (
                                    <div key={doc.id} style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <FileText size={20} color="var(--purple-main)" />
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{doc.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {doc.fileType.split('/')[1].toUpperCase()} • Uploaded on {new Date(doc.uploadedAt).toLocaleDateString()}
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
                            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)' }}>
                                No documents associated with this profile.
                            </div>
                        )}
                    </div>
                );
            case 'ATTENDANCE':
                return (
                    <div className="fade-in">
                        <h3 style={{ marginBottom: '24px' }}>System Activity Audit</h3>
                        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--glass-border)' }}>
                            <Clock size={32} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                            Live Activity Logs integration pending.
                        </div>
                    </div>
                );
            case 'LEAVES':
                return (
                    <div className="fade-in">
                        <h3 style={{ marginBottom: '24px' }}>Leave Management Records</h3>
                        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--glass-border)' }}>
                            <Calendar size={32} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                            Historical Leave Records integration pending.
                        </div>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>

            <div className="drawer slide-left" style={{ background: 'var(--bg-dark)', width: '100%', maxWidth: '800px', height: '100vh', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--glass-border)', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)' }}>

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
                                cursor: (isOwnProfile || getUserFromToken()?.roleId === 'ADMIN') ? 'pointer' : 'default',
                                position: 'relative'
                            }}
                        >
                            {profilePhoto ? <img src={profilePhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Profile" /> : employee.firstName.charAt(0)}

                            {(isOwnProfile || getUserFromToken()?.roleId === 'ADMIN') && (
                                <div className="avatar-hover-overlay" style={{
                                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s',
                                    fontSize: '0.75rem', color: 'white'
                                }}>
                                    <ImageIcon size={20} style={{ marginBottom: '4px' }} />
                                    <span>Change Photo</span>
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
                            <h2 style={{ fontSize: '2rem', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {employee.firstName} {employee.lastName}
                                {employee.status === 'ACTIVE' && <span style={{ padding: '4px 12px', background: 'rgba(16,185,129,0.2)', color: '#10B981', fontSize: '0.75rem', borderRadius: '12px', verticalAlign: 'middle', border: '1px solid rgba(16,185,129,0.5)' }}>Online</span>}
                            </h2>
                            <div style={{ color: 'var(--purple-light)', fontSize: '1rem', marginTop: '4px', fontWeight: 500 }}>{employee.roleId.replace(/_/g, ' ')} • {employee.department || 'General'}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>{employee.id}</span>
                                <span>Joined {new Date(employee.joinedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '0 32px', overflowX: 'auto' }}>
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 24px',
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    color: isActive ? 'white' : 'var(--text-secondary)',
                                    borderBottom: `2px solid ${isActive ? 'var(--purple-main)' : 'transparent'}`,
                                    fontWeight: isActive ? 600 : 500,
                                    whiteSpace: 'nowrap',
                                    transition: 'color 0.2s, border-color 0.2s'
                                }}
                            >
                                <Icon size={16} color={isActive ? 'var(--purple-main)' : 'currentColor'} /> {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content Area */}
                <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
                    {renderTabContent()}
                </div>

                {/* Action Footer */}
                <div style={{ padding: '24px 32px', borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="secondary-button hoverable" onClick={() => setIsIdCardOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
                        <QrCode size={16} /> View Digital ID Card
                    </button>
                    <button className="secondary-button hoverable" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Download size={16} /> Export Dossier
                    </button>
                    <button className="primary-button hoverable" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={16} /> Edit Capabilities
                    </button>
                </div>

            </div>

            {isIdCardOpen && <DigitalEmployeeCard employee={employee} onClose={() => setIsIdCardOpen(false)} />}
        </div>
    );
}
