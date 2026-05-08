'use client';

import React, { useState, useMemo } from 'react';
import { 
    Search, 
    Shield, 
    Key, 
    RefreshCcw, 
    Eye,
    EyeOff,
    AlertTriangle,
    Lock,
    X,
    ShieldAlert
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { EmployeeDTO } from '@/types/dto';
import { api } from '@/lib/api';
import { useNotifications } from '../notifications/NotificationProvider';
import { useAuth } from '@/context/AuthContext';

interface AccountSecurityHubProps {
    employees: EmployeeDTO[];
}

export default function AccountSecurityHub({ employees }: AccountSecurityHubProps) {
    const [newPasswords, setNewPasswords] = useState<Record<string, string>>({});
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, empId: string, email: string } | null>(null);
    const [adminPassword, setAdminPassword] = useState('');
    const [verifying, setVerifying] = useState(false);
    const { addNotification } = useNotifications();
    const { employee: authEmployee } = useAuth();

    const generateRandomPassword = (empId: string) => {
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let retVal = "";
        for (let i = 0, n = charset.length; i < 12; ++i) {
            retVal += charset.charAt(Math.floor(Math.random() * n));
        }
        setNewPasswords(prev => ({ ...prev, [empId]: retVal }));
        setShowPasswords(prev => ({ ...prev, [empId]: true }));
    };

    const handleUpdatePassword = async (empId: string, email: string) => {
        const password = newPasswords[empId];
        if (!password || password.length < 6) {
            addNotification({ title: 'Invalid Password', message: 'Password must be at least 6 characters.', type: 'ERROR' });
            return;
        }

        setConfirmModal({ isOpen: true, empId, email });
    };

    const confirmOverride = async () => {
        if (!confirmModal || !authEmployee?.email) return;
        
        setVerifying(true);
        try {
            // 1. Verify Admin Password first
            await api.verifyAdminPassword(authEmployee.email, adminPassword);
            
            // 2. If verified, perform the override
            setUpdatingIds(prev => new Set(prev).add(confirmModal.empId));
            const targetPassword = newPasswords[confirmModal.empId];
            
            await api.manageEmployeeAccount('UPDATE_PASSWORD', confirmModal.empId, { password: targetPassword });
            
            addNotification({ 
                title: 'Override Successful', 
                message: `Account credentials updated for ${confirmModal.email}.`, 
                type: 'SUCCESS' 
            });
            
            setNewPasswords(prev => {
                const next = { ...prev };
                delete next[confirmModal.empId];
                return next;
            });
            
            setConfirmModal(null);
            setAdminPassword('');
        } catch (err: any) {
            addNotification({ 
                title: 'Security Verification Failed', 
                message: err.message || 'Verification failure during update.', 
                type: 'ERROR' 
            });
        } finally {
            setVerifying(false);
            if (confirmModal) {
                setUpdatingIds(prev => {
                    const next = new Set(prev);
                    next.delete(confirmModal.empId);
                    return next;
                });
            }
        }
    };

    return (
        <div className="security-hub fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0', flex: 1, minHeight: 0 }}>
            {/* Header Stats / Info */}
            {/* Header Info - Ultra Compact */}
            <div style={{ display: 'flex', gap: '12px', flexShrink: 0, padding: '16px 0' }}>
                <GlassCard style={{ padding: '10px 16px', flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        background: 'rgba(124, 58, 237, 0.1)', 
                        borderRadius: '8px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--purple-main)',
                        border: '1px solid rgba(124, 58, 237, 0.2)'
                    }}>
                        <Shield size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Security Protocol</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white' }}>Administrative Override Active</div>
                    </div>
                    <div style={{ height: '24px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', maxWidth: '400px', margin: 0 }}>
                        Direct authority to modify credentials. All changes are logged for auditing and take effect immediately.
                    </p>
                </GlassCard>
            </div>

            {/* List Container */}
            <div style={{ 
                flex: 1, 
                minHeight: 0, 
                display: 'flex', 
                flexDirection: 'column', 
                background: 'var(--glass-surface)', 
                border: '1px solid var(--glass-border)', 
                borderRadius: '24px', 
                overflow: 'hidden', 
                backdropFilter: 'blur(20px)',
                boxShadow: 'var(--glass-shadow)'
            }}>
                {/* Toolbar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--glass-border)',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', letterSpacing: '-0.01em' }}>
                            Personnel Security Override
                        </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                        {employees.length} Personnel Accounts Found
                    </div>
                </div>

                {/* Table */}
                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                    <table className="emp-table" style={{ background: 'transparent', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead>
                            <tr style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <th style={{ 
                                    padding: '16px 24px', 
                                    width: '30%', 
                                    background: 'rgba(13, 13, 18, 0.98)', 
                                    backdropFilter: 'blur(10px)',
                                    textAlign: 'left',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    color: 'rgba(255,255,255,0.4)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    borderBottom: '1px solid var(--glass-border)'
                                }}>Employee Identity</th>
                                <th style={{ 
                                    width: '25%', 
                                    background: 'rgba(13, 13, 18, 0.98)', 
                                    backdropFilter: 'blur(10px)',
                                    textAlign: 'left',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    color: 'rgba(255,255,255,0.4)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    borderBottom: '1px solid var(--glass-border)'
                                }}>Access Level</th>
                                <th style={{ 
                                    width: '30%', 
                                    background: 'rgba(13, 13, 18, 0.98)', 
                                    backdropFilter: 'blur(10px)',
                                    textAlign: 'left',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    color: 'rgba(255,255,255,0.4)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    borderBottom: '1px solid var(--glass-border)'
                                }}>Credential Override</th>
                                <th style={{ 
                                    paddingRight: '24px', 
                                    textAlign: 'right',
                                    background: 'rgba(13, 13, 18, 0.98)', 
                                    backdropFilter: 'blur(10px)',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    color: 'rgba(255,255,255,0.4)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    borderBottom: '1px solid var(--glass-border)'
                                }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
                                        <AlertTriangle size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                        <div>No personnel records found for security override.</div>
                                    </td>
                                </tr>
                            ) : (
                                employees.map((emp) => (
                                    <tr key={emp.id} className="emp-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '10px 24px' }}>
                                            <div className="emp-row-identity">
                                                <div className="emp-row-avatar" style={{ width: '32px', height: '32px', borderRadius: '8px', fontSize: '0.8rem' }}>
                                                    {emp.profilePhoto ? <img src={emp.profilePhoto} alt="" /> : emp.firstName.charAt(0)}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="emp-row-name" style={{ fontSize: '0.85rem' }}>{emp.firstName} {emp.lastName}</div>
                                                    <div className="emp-dept" style={{ fontSize: '0.7rem', opacity: 0.5 }}>{emp.department || 'General'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'white', fontWeight: 500 }}>{emp.email}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                                                <span className="emp-role-chip" style={{ fontSize: '0.55rem', padding: '1px 6px' }}>{emp.roleId}</span>
                                                <span className={`status-badge ${emp.status === 'ACTIVE' ? 'approved' : 'rejected'}`} style={{ fontSize: '0.55rem', padding: '0px 6px' }}>{emp.status}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ position: 'relative', flex: 1 }}>
                                                    <input
                                                        type={showPasswords[emp.id] ? "text" : "password"}
                                                        value={newPasswords[emp.id] || ''}
                                                        onChange={(e) => setNewPasswords(prev => ({ ...prev, [emp.id]: e.target.value }))}
                                                        placeholder="Set new credentials..."
                                                        style={{
                                                            width: '100%',
                                                            background: 'rgba(0,0,0,0.3)',
                                                            border: '1px solid var(--glass-border)',
                                                            borderRadius: '8px',
                                                            padding: '6px 36px 6px 12px',
                                                            color: 'white',
                                                            fontSize: '0.8rem',
                                                            outline: 'none',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => setShowPasswords(prev => ({ ...prev, [emp.id]: !prev[emp.id] }))}
                                                        style={{
                                                            position: 'absolute',
                                                            right: '8px',
                                                            top: '50%',
                                                            transform: 'translateY(-50%)',
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'rgba(255,255,255,0.2)',
                                                            cursor: 'pointer',
                                                            padding: '4px',
                                                            display: 'flex'
                                                        }}
                                                    >
                                                        {showPasswords[emp.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => generateRandomPassword(emp.id)}
                                                    className="emp-menu-btn"
                                                    title="Generate Secure Password"
                                                    style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                                                >
                                                    <RefreshCcw size={14} />
                                                </button>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '24px', padding: '10px 0' }}>
                                            <button
                                                disabled={!newPasswords[emp.id] || updatingIds.has(emp.id)}
                                                onClick={() => handleUpdatePassword(emp.id, emp.email)}
                                                className="emp-action-btn-primary"
                                                style={{ 
                                                    height: '32px', 
                                                    padding: '0 14px', 
                                                    fontSize: '0.7rem',
                                                    opacity: !newPasswords[emp.id] ? 0.4 : 1,
                                                    background: updatingIds.has(emp.id) ? 'rgba(255,255,255,0.05)' : 'var(--purple-main)',
                                                    boxShadow: !newPasswords[emp.id] ? 'none' : '0 6px 12px -4px rgba(139, 92, 246, 0.4)'
                                                }}
                                            >
                                                {updatingIds.has(emp.id) ? (
                                                    <div className="spinner-mini" style={{ width: '12px', height: '12px' }} />
                                                ) : (
                                                    <><Key size={12} style={{ marginRight: '4px' }} /> Update</>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Re-authentication Modal */}
            {confirmModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '20px'
                }}>
                    <GlassCard style={{ maxWidth: '400px', width: '100%', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                            <div style={{ 
                                width: '40px', 
                                height: '40px', 
                                background: 'rgba(239, 68, 68, 0.1)', 
                                borderRadius: '12px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                color: '#EF4444',
                                border: '1px solid rgba(239, 68, 68, 0.2)'
                            }}>
                                <ShieldAlert size={20} />
                            </div>
                            <button 
                                onClick={() => { setConfirmModal(null); setAdminPassword(''); }}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginBottom: '8px' }}>Security Verification</h3>
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5', marginBottom: '24px' }}>
                            You are about to override credentials for <strong style={{ color: 'white' }}>{confirmModal.email}</strong>. 
                            Please enter your administrative password to authorize this sensitive operation.
                        </p>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                Admin Password
                            </label>
                            <input 
                                type="password"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                placeholder="Enter your password..."
                                autoFocus
                                style={{
                                    width: '100%',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '10px',
                                    padding: '12px 16px',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    outline: 'none'
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && adminPassword && !verifying && confirmOverride()}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                                onClick={() => { setConfirmModal(null); setAdminPassword(''); }}
                                className="emp-action-btn"
                                style={{ flex: 1, height: '44px' }}
                            >
                                Cancel
                            </button>
                            <button 
                                disabled={!adminPassword || verifying}
                                onClick={confirmOverride}
                                className="emp-action-btn-primary"
                                style={{ 
                                    flex: 1, 
                                    height: '44px',
                                    background: verifying ? 'rgba(255,255,255,0.05)' : 'var(--purple-main)',
                                    opacity: !adminPassword ? 0.4 : 1
                                }}
                            >
                                {verifying ? <div className="spinner-mini" /> : 'Authorize Override'}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
}
