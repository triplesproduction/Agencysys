'use client';

import { useEffect, useState } from 'react';
import GlassCard from '@/components/GlassCard';
import { Megaphone, Loader2, BellOff, ExternalLink, Eye, X, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useAnnouncements } from '@/hooks/queries/domains/dashboard/useDashboard';

interface Announcement {
    id: string;
    title: string;
    message: string;
    type: string;
    status: string;
    createdAt: string;
    author?: { firstName: string; lastName: string } | null;
}

const typeColors: Record<string, { text: string; bg: string; border: string }> = {
    URGENT: { text: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
    ANNOUNCEMENT: { text: '#3B82F6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)' },
    SYSTEM: { text: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.35)' },
};

export default function AnnouncementsWidget({ maxItems = 4 }: { maxItems?: number }) {
    const { data, isLoading } = useAnnouncements();
    const [items, setItems] = useState<Announcement[]>([]);
    
    // Popup states
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
    const [unreadPopups, setUnreadPopups] = useState<Announcement[]>([]);
    const [currentUnreadIndex, setCurrentUnreadIndex] = useState(0);

    useEffect(() => {
        if (data) {
            const active = data.filter((a: Announcement) => a.status === 'active');
            setItems(active.slice(0, maxItems));

            // Check for unread announcements
            try {
                const readIds = JSON.parse(localStorage.getItem('read_announcements') || '[]');
                const unread = active.filter((a: Announcement) => !readIds.includes(a.id));
                if (unread.length > 0) {
                    setUnreadPopups(unread);
                }
            } catch (e) {
                console.error('Error parsing read_announcements from localStorage');
            }
        }
    }, [data, maxItems]);

    const handleMarkAsRead = (id: string) => {
        try {
            const readIds = JSON.parse(localStorage.getItem('read_announcements') || '[]');
            if (!readIds.includes(id)) {
                readIds.push(id);
                localStorage.setItem('read_announcements', JSON.stringify(readIds));
            }
        } catch (e) {
            console.error('Error saving to localStorage');
        }

        if (currentUnreadIndex < unreadPopups.length - 1) {
            setCurrentUnreadIndex(prev => prev + 1);
        } else {
            setUnreadPopups([]);
        }
    };

    const currentUnread = unreadPopups[currentUnreadIndex];

    const renderModal = (ann: Announcement, isAutoPopup: boolean) => {
        const c = typeColors[ann.type] || typeColors.ANNOUNCEMENT;
        return (
            <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div className="slide-up" style={{ 
                    width: '100%', 
                    maxWidth: '560px', 
                    padding: '36px', 
                    background: 'var(--bg-dark)',
                    border: `1px solid ${c.border}`, 
                    boxShadow: `0 30px 60px -12px rgba(0, 0, 0, 0.7), 0 0 40px ${c.bg}`, 
                    borderRadius: '24px',
                    position: 'relative',
                    fontFamily: 'Outfit, sans-serif'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <div style={{ background: c.bg, padding: '12px', borderRadius: '16px', border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Megaphone size={28} color={c.text} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '3px 8px', borderRadius: '6px', background: c.bg, color: c.text, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        {ann.type}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                                        {new Date(ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'white', lineHeight: 1.2 }}>
                                    {ann.title}
                                </h2>
                            </div>
                        </div>
                        {!isAutoPopup && (
                            <button 
                                onClick={() => setSelectedAnnouncement(null)} 
                                style={{ 
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease'
                                }} 
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px', marginBottom: '24px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1rem', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>
                            {ann.message}
                        </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                            Published by: <span style={{ color: 'white', fontWeight: 600 }}>{ann.author ? `${ann.author.firstName} ${ann.author.lastName}` : 'Admin'}</span>
                        </div>
                        {isAutoPopup && (
                            <button 
                                onClick={() => handleMarkAsRead(ann.id)}
                                style={{ 
                                    background: c.bg, border: `1px solid ${c.border}`, color: c.text, padding: '10px 20px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                                }}
                            >
                                <CheckCircle size={16} /> Mark as Read
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="ad2-card" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Section header */}
                <div className="ad2-card-header" style={{ marginBottom: '8px', paddingBottom: '4px', border: 'none' }}>
                    <h3><Megaphone size={16} color="#3B82F6" /> Announcements</h3>
                    <Link href="/broadcast" className="ad2-badge" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', fontSize: '0.65rem' }}>
                        View all <ExternalLink size={10} style={{ marginLeft: '4px' }} />
                    </Link>
                </div>

                {isLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '12px 0' }}>
                        <Loader2 size={14} className="spin-icon" /> Loading…
                    </div>
                ) : items.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', color: 'var(--text-secondary)', gap: '6px' }}>
                        <BellOff size={22} style={{ opacity: 0.35 }} />
                        <span style={{ fontSize: '0.8rem' }}>No active announcements</span>
                    </div>
                ) : (
                    <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                        {items.map(ann => {
                            const c = typeColors[ann.type] || typeColors.ANNOUNCEMENT;
                            return (
                                <div key={ann.id} className="ad2-task-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '10px 12px', borderLeft: `3px solid ${c.text}`, gap: '4px', marginBottom: '0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'white' }}>{ann.title}</span>
                                            <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontSize: '0.6rem', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 800 }}>
                                                {ann.type}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => setSelectedAnnouncement(ann)}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 600, transition: 'all 0.2s' }}
                                        >
                                            <Eye size={12} /> View
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {ann.message}
                                    </p>
                                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                                        {new Date(ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modals */}
            {currentUnread && renderModal(currentUnread, true)}
            {selectedAnnouncement && !currentUnread && renderModal(selectedAnnouncement, false)}
        </>
    );
}
