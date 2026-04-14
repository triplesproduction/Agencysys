'use client';

import { useEffect, useState } from 'react';
import GlassCard from '@/components/GlassCard';
import { Megaphone, Loader2, BellOff, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import Link from 'next/link';

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
    const [items, setItems] = useState<Announcement[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        api.getAnnouncements()
            .then(data => {
                // Only show active announcements, newest first, limited to maxItems
                const active = (data || []).filter((a: Announcement) => a.status === 'active');
                setItems(active.slice(0, maxItems));
            })
            .catch(() => setItems([]))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="ad2-card" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Section header */}
            <div className="ad2-card-header" style={{ marginBottom: '8px', paddingBottom: '4px', border: 'none' }}>
                <h3><Megaphone size={16} color="#3B82F6" /> Announcements</h3>
                <Link href="/messaging/broadcast" className="ad2-badge" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', fontSize: '0.65rem' }}>
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
                                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'white' }}>{ann.title}</span>
                                    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontSize: '0.6rem', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 800 }}>
                                        {ann.type}
                                    </span>
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
    );
}
