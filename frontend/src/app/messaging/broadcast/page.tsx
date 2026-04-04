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
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <History size={20} style={{ color: 'var(--text-secondary)' }} /> Published Announcements
                    </h2>

                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }} className="skeleton-pulse">
                            Loading announcements...
                        </div>
                    ) : announcements.length === 0 ? (
                        <GlassCard style={{ padding: '48px', textAlign: 'center' }}>
                            <MessageSquare size={40} style={{ color: 'rgba(255,255,255,0.2)', marginBottom: '12px' }} />
                            <p style={{ color: 'var(--text-secondary)' }}>No announcements published yet.</p>
                        </GlassCard>
                    ) : (
                        announcements.map(ann => (
                            <GlassCard key={ann.id} style={{ padding: '20px', border: ann.status === 'active' ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.06)', opacity: ann.status === 'inactive' ? 0.6 : 1, transition: 'all 0.25s ease' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: '12px', background: `${typeColors[ann.type] || '#3B82F6'}20`, border: `1px solid ${typeColors[ann.type] || '#3B82F6'}50`, color: typeColors[ann.type] || '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                {ann.type}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: '12px', background: ann.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: ann.status === 'active' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(239,68,68,0.4)', color: ann.status === 'active' ? '#10B981' : '#EF4444', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                {ann.status}
                                            </span>
                                        </div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'white', margin: '0 0 6px 0' }}>{ann.title}</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5', margin: 0 }}>{ann.message}</p>
                                        <div style={{ marginTop: '10px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>
                                            By {ann.author ? `${ann.author.firstName} ${ann.author.lastName}` : ann.createdBy} · {new Date(ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                                            <button
                                                onClick={() => handleToggleStatus(ann)}
                                                title={ann.status === 'active' ? 'Disable announcement' : 'Enable announcement'}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: ann.status === 'active' ? '#10B981' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, padding: '6px 10px', borderRadius: '8px', transition: 'all 0.2s ease' }}
                                            >
                                                {ann.status === 'active' ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                                                {ann.status === 'active' ? 'Active' : 'Inactive'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(ann.id, ann.title)}
                                                title="Delete"
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.6)', padding: '6px 10px', borderRadius: '8px', transition: 'all 0.2s ease' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </GlassCard>
                        ))
                    )}
                </div>

                {/* Right Column - Compose or Info */}
                <div style={{ flex: 1, position: 'sticky', top: '32px' }}>
                    {isAdmin ? (
                        <GlassCard style={{ padding: '28px' }}>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '20px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Plus size={18} style={{ color: 'var(--purple-main)' }} /> Create Announcement
                            </h2>

                            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Title *</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="e.g. Office Closed on Monday"
                                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none', boxSizing: 'border-box' }}
                                        disabled={isSubmitting}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Type</label>
                                    <select
                                        value={type}
                                        onChange={e => setType(e.target.value)}
                                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none' }}
                                        disabled={isSubmitting}
                                    >
                                        <option value="ANNOUNCEMENT" style={{ background: 'var(--bg-dark)' }}>Announcement</option>
                                        <option value="URGENT" style={{ background: 'var(--bg-dark)' }}>Urgent Alert</option>
                                        <option value="SYSTEM" style={{ background: 'var(--bg-dark)' }}>System Update</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Message *</label>
                                    <textarea
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        placeholder="Announcement content..."
                                        style={{ width: '100%', height: '120px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                                        disabled={isSubmitting}
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !title || !message}
                                    style={{ background: 'var(--purple-main)', border: 'none', color: 'white', padding: '12px', borderRadius: 'var(--radius-sm)', cursor: isSubmitting || !title || !message ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: isSubmitting || !title || !message ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease' }}
                                >
                                    {isSubmitting ? <><Loader2 size={16} className="spin-icon" /> Publishing...</> : <><Send size={16} /> Publish Announcement</>}
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
