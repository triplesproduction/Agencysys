'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Send, BellRing, Users, History, ShieldAlert, Trash2, ToggleLeft, ToggleRight, Loader2, Plus, X, ShieldCheck } from 'lucide-react';
import GlassCard from '@/components/GlassCard';

import { api } from '@/lib/api';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/Button';
import Input from '@/components/Input';

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
    
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState('ANNOUNCEMENT');

    // Derive admin flag from the global auth context (no cookie dependency)
    const isAdmin = authLoading
        ? null
        : authEmployee
            ? String(authEmployee.roleId || '').toUpperCase().includes('ADMIN')
            : false;

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

    const [filter, setFilter] = useState('ALL');

    const filteredAnnouncements = announcements.filter(ann => {
        // If not an admin, hide inactive announcements
        if (!isAdmin && ann.status === 'inactive') return false;
        
        if (filter === 'ALL') return true;
        return ann.type === filter;
    });

    return (
        <div className="main-content fade-in" style={{ padding: '16px 16px 32px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <MessageSquare size={28} style={{ color: 'var(--purple-main)' }} /> System Announcements
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '650px', fontSize: '0.95rem', lineHeight: '1.6' }}>
                        Stay informed with the latest agency updates, urgent alerts, and system news. Use the filters below to browse through different categories.
                    </p>
                </div>

                {isAdmin && (
                    <button 
                        onClick={() => setIsCreateModalOpen(true)} 
                        className="hoverable"
                        style={{ 
                            background: 'var(--purple-main)', 
                            color: 'white',
                            padding: '12px 28px', 
                            borderRadius: '14px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '10px',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            boxShadow: '0 8px 20px rgba(139, 92, 246, 0.3)',
                            fontFamily: 'Outfit, sans-serif'
                        }}
                    >
                        <Plus size={18} strokeWidth={2.5} /> Launch Announcement
                    </button>
                )}
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }}>
                {['ALL', 'ANNOUNCEMENT', 'URGENT', 'SYSTEM'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: '8px 20px',
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            background: filter === f ? 'rgba(139,92,246,0.1)' : 'transparent',
                            border: filter === f ? '1px solid var(--purple-main)' : '1px solid rgba(255,255,255,0.1)',
                            color: filter === f ? 'white' : 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}
                    >
                        {f === 'ALL' ? 'All Updates' : f.replace('_', ' ')}
                    </button>
                ))}
            </div>

            <div style={{ width: '100%' }}>
                {isLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="skeleton-pulse" style={{ height: '240px', borderRadius: '24px', background: 'rgba(255,255,255,0.04)' }} />
                        ))}
                    </div>
                ) : filteredAnnouncements.length === 0 ? (
                    <GlassCard style={{ padding: '80px', textAlign: 'center' }}>
                        <MessageSquare size={48} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: '16px' }} />
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No announcements found in this category.</p>
                    </GlassCard>
                ) : (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '24px' 
                    }}>
                        {filteredAnnouncements.map(ann => (
                            <GlassCard 
                                key={ann.id} 
                                style={{ 
                                    padding: '28px', 
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    border: ann.status === 'active' ? '1px solid rgba(139,92,246,0.2)' : '1px solid rgba(255,255,255,0.06)', 
                                    opacity: ann.status === 'inactive' ? 0.7 : 1, 
                                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                <div style={{ position: 'relative', zIndex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 900, padding: '4px 10px', borderRadius: '6px', background: `${typeColors[ann.type] || '#3B82F6'}15`, border: `1px solid ${typeColors[ann.type] || '#3B82F6'}30`, color: typeColors[ann.type] || '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                {ann.type}
                                            </span>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 900, padding: '4px 10px', borderRadius: '6px', background: ann.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: ann.status === 'active' ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(239,68,68,0.25)', color: ann.status === 'active' ? '#34D399' : '#F87171', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                {ann.status}
                                            </span>
                                        </div>

                                        {isAdmin && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleToggleStatus(ann)}
                                                    title={ann.status === 'active' ? 'Deactivate' : 'Activate'}
                                                    style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: ann.status === 'active' ? '#34D399' : 'rgba(255,255,255,0.3)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    {ann.status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(ann.id, ann.title)}
                                                    className="action-btn danger-hover"
                                                    style={{ padding: '6px', borderRadius: '8px', color: 'rgba(239,68,68,0.6)' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', margin: '0 0 12px 0', lineHeight: '1.4' }}>{ann.title}</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.6', margin: 0, opacity: 0.8 }}>{ann.message}</p>
                                </div>

                                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(139,92,246,0.2)', color: 'var(--purple-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
                                            {ann.author ? (ann.author.firstName?.[0] || 'A') : <ShieldCheck size={12} />}
                                        </div>
                                        {ann.author ? `${ann.author.firstName} ${ann.author.lastName}` : 'Admin'}
                                    </div>
                                    <span>{new Date(ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                )}
            </div>

            {/* Creation Modal */}
            {isCreateModalOpen && (
                <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="slide-up" style={{ 
                        width: '100%', 
                        maxWidth: '560px', 
                        padding: '40px', 
                        background: 'var(--bg-dark)',
                        border: '1px solid rgba(139,92,246,0.3)', 
                        boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.7)', 
                        borderRadius: '32px',
                        position: 'relative',
                        fontFamily: 'Outfit, sans-serif'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '36px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                <div style={{ background: 'var(--purple-main)', padding: '14px', borderRadius: '16px', boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Megaphone size={26} color="white" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'white', letterSpacing: '-0.03em' }}>
                                        Broadcast Update
                                    </h2>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '4px 0 0', opacity: 0.8 }}>Relay critical information to the team</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsCreateModalOpen(false)} 
                                style={{ 
                                    background: 'rgba(255,255,255,0.04)', 
                                    border: '1px solid rgba(255,255,255,0.1)', 
                                    color: 'white', 
                                    cursor: 'pointer', 
                                    width: '40px', 
                                    height: '40px', 
                                    borderRadius: '50%', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    transition: 'all 0.3s ease' 
                                }} 
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label className="input-label" style={{ marginBottom: '8px' }}>Announcement Title</label>
                                <Input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. Critical System Maintenance"
                                    required
                                    style={{ background: 'rgba(0,0,0,0.3)' }}
                                />
                            </div>
                            <div>
                                <label className="input-label" style={{ marginBottom: '8px' }}>Category Type</label>
                                <select
                                    value={type}
                                    onChange={e => setType(e.target.value)}
                                    className="filter-select"
                                    style={{ width: '100%', height: '48px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)' }}
                                >
                                    <option value="ANNOUNCEMENT">Standard Announcement</option>
                                    <option value="URGENT">Urgent Alert</option>
                                    <option value="SYSTEM">System Update</option>
                                </select>
                            </div>
                            <div>
                                <label className="input-label" style={{ marginBottom: '8px' }}>Message Content</label>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Type your announcement contents here..."
                                    style={{ width: '100%', height: '140px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '14px 18px', borderRadius: '12px', color: 'white', outline: 'none', resize: 'none', fontSize: '0.9rem', lineHeight: '1.6' }}
                                    required
                                />
                            </div>
                            <div style={{ marginTop: '10px', display: 'flex', gap: '12px' }}>
                                <Button
                                    type="button"
                                    variant="glass"
                                    style={{ flex: 1 }}
                                    onClick={() => setIsCreateModalOpen(false)}
                                >
                                    Discard
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !title || !message}
                                    style={{ flex: 2 }}
                                >
                                    {isSubmitting ? 'Publishing...' : 'Launch Broadcast'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
