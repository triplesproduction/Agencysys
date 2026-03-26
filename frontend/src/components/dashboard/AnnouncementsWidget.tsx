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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Section header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
                    <Megaphone size={16} style={{ color: '#3B82F6' }} /> Announcements
                </h2>
                <Link href="/messaging/broadcast" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                    View all <ExternalLink size={10} />
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
                items.map(ann => {
                    const c = typeColors[ann.type] || typeColors.ANNOUNCEMENT;
                    return (
                        <div key={ann.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'white', lineHeight: 1.3 }}>{ann.title}</span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: c.text, background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '1px 7px', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                    {ann.type}
                                </span>
                            </div>
                            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', margin: '0 0 6px 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {ann.message}
                            </p>
                            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)' }}>
                                {ann.author ? `${ann.author.firstName} ${ann.author.lastName} · ` : ''}
                                {new Date(ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
