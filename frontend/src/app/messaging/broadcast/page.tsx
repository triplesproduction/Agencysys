'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Send, BellRing, Users, History, ShieldAlert, Trash2, ToggleLeft, ToggleRight, Loader2, Plus } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { api } from '@/lib/api';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { useAuth } from '@/context/AuthContext';

interface Announcement {
    id: string;
    title: string;
    message: string;
    type: string;
    status: 'active' | 'inactive';
    createdAt: string;
    author?: { firstName: string; lastName: string } | null;
    createdBy: string;
}

export default function BroadcastPage() {
    const { addNotification } = useNotifications();
    const { employee: authEmployee, loading: authLoading } = useAuth();

    // Derive admin flag from the global auth context (no cookie dependency)
    const isAdmin = authLoading
        ? null
        : authEmployee
            ? String(authEmployee.roleId || '').toUpperCase().includes('ADMIN')
            : false;

    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState('ANNOUNCEMENT');

    const fetchAnnouncements = async () => {
        try {
            setIsLoading(true);
            const data = await api.getAnnouncements();
            setAnnouncements(data);
        } catch (err: any) {
            console.error('Failed to load announcements:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) return;
        setIsSubmitting(true);
        try {
            await api.createAnnouncement({ title: title.trim(), message: message.trim(), type });
            addNotification({ type: 'SYSTEM', title: 'Announcement Published', message: `"${title}" is now live and active.` });
            setTitle('');
            setMessage('');
            setType('ANNOUNCEMENT');
            fetchAnnouncements();
        } catch (err: any) {
            addNotification({ type: 'ERROR', title: 'Failed', message: err.message || 'Could not create announcement.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatus = async (announcement: Announcement) => {
        const newStatus = announcement.status === 'active' ? 'inactive' : 'active';
        try {
            // Optimistic UI update
            setAnnouncements(prev =>
                prev.map(a => a.id === announcement.id ? { ...a, status: newStatus } : a)
            );
            await api.updateAnnouncementStatus(announcement.id, newStatus);
            addNotification({ type: 'SYSTEM', title: 'Status Updated', message: `"${announcement.title}" is now ${newStatus}.` });
        } catch (err: any) {
            // Revert on failure
            setAnnouncements(prev =>
                prev.map(a => a.id === announcement.id ? { ...a, status: announcement.status } : a)
            );
            addNotification({ type: 'ERROR', title: 'Update Failed', message: err.message || 'Status update failed.' });
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Delete announcement "${title}"?`)) return;
        try {
            await api.deleteAnnouncement(id);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
            addNotification({ type: 'SYSTEM', title: 'Deleted', message: `"${title}" has been removed.` });
        } catch (err: any) {
            addNotification({ type: 'ERROR', title: 'Delete Failed', message: err.message || 'Could not delete announcement.' });
        }
    };

    const typeColors: Record<string, string> = {
        ANNOUNCEMENT: '#3B82F6',
        URGENT: '#EF4444',
        SYSTEM: '#8B5CF6',
    };

    if (isAdmin === null) {
        return <div className="main-content fade-in" style={{ padding: '16px', color: 'var(--text-secondary)' }}>Verifying access...</div>;
    }

    return (
        <div className="main-content fade-in" style={{ padding: '16px 16px 32px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <MessageSquare size={28} style={{ color: 'var(--purple-main)' }} /> System Announcements
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                        Create and manage persistent agency-wide announcements. Status is saved to the database and preserved across refreshes.
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>

                {/* Left - Announcements List */}
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <History size={22} style={{ color: 'var(--purple-main)' }} /> Published Announcements
                    </h2>

                    {isLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} className="skeleton-pulse" style={{ height: '140px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)' }} />
                            ))}
                        </div>
                    ) : announcements.length === 0 ? (
                        <GlassCard style={{ padding: '64px', textAlign: 'center' }}>
                            <MessageSquare size={48} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: '16px' }} />
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>No announcements published yet.</p>
                        </GlassCard>
                    ) : (
                        announcements.map(ann => (
                            <GlassCard key={ann.id} style={{ padding: '24px', border: ann.status === 'active' ? '1px solid rgba(139,92,246,0.2)' : '1px solid rgba(255,255,255,0.06)', opacity: ann.status === 'inactive' ? 0.7 : 1, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '4px 12px', borderRadius: '8px', background: `${typeColors[ann.type] || '#3B82F6'}15`, border: `1px solid ${typeColors[ann.type] || '#3B82F6'}30`, color: typeColors[ann.type] || '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                {ann.type}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '4px 12px', borderRadius: '8px', background: ann.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: ann.status === 'active' ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(239,68,68,0.25)', color: ann.status === 'active' ? '#34D399' : '#F87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                {ann.status}
                                            </span>
                                        </div>
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'white', margin: '0 0 8px 0' }}>{ann.title}</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>{ann.message}</p>
                                        <div style={{ marginTop: '16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor' }} />
                                            By {ann.author ? `${ann.author.firstName} ${ann.author.lastName}` : ann.createdBy} · {new Date(ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
                                            <button
                                                onClick={() => handleToggleStatus(ann)}
                                                style={{ background: ann.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: ann.status === 'active' ? '#34D399' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 700, padding: '8px 12px', borderRadius: '10px', transition: 'all 0.3s ease' }}
                                            >
                                                {ann.status === 'active' ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                {ann.status === 'active' ? 'Active' : 'Inactive'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(ann.id, ann.title)}
                                                className="action-btn danger-hover"
                                                style={{ padding: '8px', borderRadius: '10px' }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </GlassCard>
                        ))
                    )}
                </div>

                {/* Right Column - Compose Announcement */}
                <div style={{ flex: 1, position: 'sticky', top: '32px' }}>
                    {isAdmin ? (
                        <GlassCard style={{ padding: '32px', border: '1px solid var(--purple-main)', boxShadow: '0 0 40px rgba(139,92,246,0.1)' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '24px', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Plus size={20} strokeWidth={3} style={{ color: 'var(--purple-main)' }} /> Create New
                            </h2>

                            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label className="input-label" style={{ marginBottom: '10px' }}>Title *</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="e.g. Office Closed on Monday"
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: 'white', outline: 'none', transition: 'all 0.3s ease' }}
                                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--purple-main)'; e.currentTarget.style.boxShadow = '0 0 16px var(--purple-glow)'; }}
                                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                                        disabled={isSubmitting}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="input-label" style={{ marginBottom: '10px' }}>Type</label>
                                    <select
                                        value={type}
                                        onChange={e => setType(e.target.value)}
                                        className="filter-select"
                                        style={{ width: '100%', height: '46px', borderRadius: '12px' }}
                                        disabled={isSubmitting}
                                    >
                                        <option value="ANNOUNCEMENT">Announcement</option>
                                        <option value="URGENT">Urgent Alert</option>
                                        <option value="SYSTEM">System Update</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label" style={{ marginBottom: '10px' }}>Message *</label>
                                    <textarea
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        placeholder="Type your announcement contents..."
                                        style={{ width: '100%', height: '140px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: 'white', outline: 'none', resize: 'vertical', transition: 'all 0.3s ease' }}
                                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--purple-main)'; e.currentTarget.style.boxShadow = '0 0 16px var(--purple-glow)'; }}
                                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                                        disabled={isSubmitting}
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !title || !message}
                                    style={{ 
                                        background: 'var(--purple-main)', 
                                        border: 'none', 
                                        color: 'white', 
                                        padding: '14px', 
                                        borderRadius: '12px', 
                                        cursor: isSubmitting || !title || !message ? 'not-allowed' : 'pointer', 
                                        fontWeight: 700, 
                                        opacity: isSubmitting || !title || !message ? 0.6 : 1, 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        gap: '10px', 
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        marginTop: '10px',
                                        boxShadow: '0 10px 20px rgba(139, 92, 246, 0.2)'
                                    }}
                                    onMouseEnter={e => { if(!isSubmitting && title && message) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    {isSubmitting ? <><Loader2 size={18} className="spin-icon" /> Publishing...</> : <><Send size={18} /> Publish Announcement</>}
                                </button>
                            </form>
                        </GlassCard>
                    ) : (
                        <GlassCard style={{ padding: '28px', textAlign: 'center' }}>
                            <ShieldAlert size={40} style={{ color: '#EF4444', marginBottom: '12px' }} />
                            <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>View Only</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Only administrators can create or manage announcements.</p>
                        </GlassCard>
                    )}
                </div>
            </div>
        </div>
    );
}
