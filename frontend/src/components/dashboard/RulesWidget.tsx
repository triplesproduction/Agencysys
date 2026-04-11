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
    }, [maxItems]);

    return (
        <div className="ad2-card" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Section header */}
            <div className="ad2-card-header">
                <h3><BookOpen size={16} color="var(--purple-main)" /> Latest Rules</h3>
                <Link href="/rulebook" className="ad2-badge" style={{ textDecoration: 'none' }}>
                    Full rulebook <ExternalLink size={10} style={{ marginLeft: '4px' }} />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {rules.map(rule => {
                        const pColor = priorityColors[rule.priority] || '#6B7280';
                        return (
                            <div key={rule.id} className="ad2-task-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '16px', borderLeft: `3px solid ${pColor}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', width: '100%' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>{rule.title}</span>
                                    <span className="ad2-badge" style={{ color: pColor, borderColor: pColor, background: `${pColor}10` }}>
                                        {rule.priority}
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', margin: '0 0 10px 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {rule.description}
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Tag size={10} /> {rule.category}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                                        {new Date(rule.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
