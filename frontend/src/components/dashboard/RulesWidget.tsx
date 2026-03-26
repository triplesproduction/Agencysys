'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Loader2, FileX, ExternalLink, Tag } from 'lucide-react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Rule {
    id: string;
    title: string;
    description: string;
    category: string;
    priority: string;
    effectiveDate?: string | null;
    createdAt: string;
    author?: { firstName: string; lastName: string } | null;
}

const priorityColors: Record<string, string> = {
    Critical: '#EF4444',
    Important: '#F59E0B',
    Normal: '#3B82F6',
    Low: '#6B7280',
};

export default function RulesWidget({ maxItems = 4 }: { maxItems?: number }) {
    const [rules, setRules] = useState<Rule[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        api.getRules()
            .then(data => setRules((data || []).slice(0, maxItems)))
            .catch(() => setRules([]))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Section header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
                    <BookOpen size={16} style={{ color: 'var(--purple-main)' }} /> Latest Rules
                </h2>
                <Link href="/rulebook" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                    Full rulebook <ExternalLink size={10} />
                </Link>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '12px 0' }}>
                    <Loader2 size={14} className="spin-icon" /> Loading…
                </div>
            ) : rules.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', color: 'var(--text-secondary)', gap: '6px' }}>
                    <FileX size={22} style={{ opacity: 0.35 }} />
                    <span style={{ fontSize: '0.8rem' }}>No rules published yet</span>
                </div>
            ) : (
                rules.map(rule => {
                    const pColor = priorityColors[rule.priority] || '#6B7280';
                    return (
                        <div key={rule.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', borderLeft: `3px solid ${pColor}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px', gap: '8px' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'white', lineHeight: 1.3 }}>{rule.title}</span>
                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: pColor, background: `${pColor}18`, border: `1px solid ${pColor}40`, borderRadius: '8px', padding: '1px 7px' }}>
                                        {rule.priority}
                                    </span>
                                </div>
                            </div>
                            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', margin: '0 0 6px 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {rule.description}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Tag size={10} /> {rule.category}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>
                                    {new Date(rule.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
