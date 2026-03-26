'use client';

import { useState, useEffect } from 'react';
import GlassCard from '@/components/GlassCard';
import { Shield, Clock, CalendarHeart, HardDrive, Download, Settings, ChevronDown, BookOpen, Tag, Loader2, FileX, ShieldAlert, AlertTriangle, AlertCircle, Lock, Users, Monitor, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import './Rulebook.css';

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Priority colours ──────────────────────────────────────────────────────────
const priorityColors: Record<string, { text: string; border: string; bg: string }> = {
    Critical: { text: '#EF4444', border: 'rgba(239,68,68,0.4)', bg: 'rgba(239,68,68,0.08)' },
    Important: { text: '#F59E0B', border: 'rgba(245,158,11,0.4)', bg: 'rgba(245,158,11,0.08)' },
    Normal: { text: '#3B82F6', border: 'rgba(59,130,246,0.4)', bg: 'rgba(59,130,246,0.08)' },
    Low: { text: '#6B7280', border: 'rgba(107,114,128,0.4)', bg: 'rgba(107,114,128,0.08)' },
};

// ── Static company policy sections ───────────────────────────────────────────
const STATIC_SECTIONS = [
    { id: 'policies', title: 'Company Policies', icon: Shield, content: (<><h4>Office Conduct</h4><p>Maintain professionalism in all digital communications. Treat peers with respect and uphold the TripleS OS core values during every sprint.</p><h4>Work Ethics</h4><p>Extreme ownership is expected. If a module breaks, own the fix. Plagiarism or copying untrusted third-party code without architectural review is a strict violation.</p><h4>Reporting Hierarchy</h4><p>Developers report to their direct Shift Manager. Shift Managers report logic escalations to the Admin council. Do not bypass the reporting chain for non-emergencies.</p></>) },
    { id: 'hours', title: 'Work Hour Guidelines', icon: Clock, content: (<><h4>Login Time</h4><p>The standard system login window opens at <span className="highlight">09:00 AM Local Time</span>. Core availability must be maintained until 05:00 PM.</p><h4>Daily Working Hours</h4><p>Employees must track and log exactly 8 net working hours per daily shift into the Work Hours terminal.</p><h4>EOD Submission Rules</h4><p>An End of Day (EOD) report is <span className="highlight">mandatory</span>. It must be submitted before your final logout, explicitly detailing completed tasks and active blockers.</p></>) },
    { id: 'leave', title: 'Leave Policy', icon: CalendarHeart, content: (<><h4>Leave Types</h4><p>Options currently supported: <strong>SICK</strong>, <strong>CASUAL</strong>, and <strong>EARNED</strong>.</p><h4>Approval Workflow</h4><ol style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}><li>Employee submits request via the Dashboard.</li><li>Manager reviews impact against Active Tasks queue.</li><li>Admin provides final sign-off confirming PTO validity.</li></ol><h4>Application Timeline</h4><p>Non-emergency leaves must be requested a minimum of <span className="highlight">7 days in advance</span>.</p></>) },
    { id: 'laptop', title: 'Laptop Setup Guide', icon: HardDrive, content: (<><h4>Folder Structure Setup</h4><p>Clone the primary repository into a designated workspace directory. Never clone work projects directly onto the Desktop.</p><h4>Naming Conventions</h4><ul><li>Use <strong>camelCase</strong> for typescript variables.</li><li>Use <strong>PascalCase</strong> for React Components.</li><li>Use <strong>kebab-case</strong> for CSS class nomenclature.</li></ul></>) },
    { id: 'software', title: 'Required Software Installation', icon: Download, content: (<><h4>VS Code</h4><p>Install the latest stable build. Required extensions: ESLint, Prettier, and Thunder Client for API testing.</p><h4>GitHub Desktop</h4><p>Required for visual commit tracking and PR reviews unless command-line is preferred.</p><h4>Slack / Teams</h4><p>Keep desktop notifications ON during core hours for emergency pings alerting to server downtime.</p></>) },
    { id: 'apps', title: 'Important Apps Setup', icon: Settings, content: (<><h4>TripleS OS Login</h4><p>Authenticate daily using your assigned <span className="highlight">employeeId</span> and role-mapped passcode. Tokens automatically expire after 24 hours.</p><h4>Task Management Rules</h4><p>Tasks must be transitioned from <strong>TODO</strong> → <strong>IN_PROGRESS</strong> → <strong>DONE</strong> in real-time. Do not complete work before updating its status.</p></>) },
];

// ── Admin-published rule card ─────────────────────────────────────────────────


// ── Main page ─────────────────────────────────────────────────────────────────
export default function RulebookPage() {
    const [expandedId, setExpandedId] = useState<string | null>('policies');
    const [expandedLiveId, setExpandedLiveId] = useState<string | null>(null);
    const [liveRules, setLiveRules] = useState<Rule[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case 'Critical': return <ShieldAlert size={14} />;
            case 'Important': return <AlertTriangle size={14} />;
            case 'Normal': return <AlertCircle size={14} />;
            default: return null;
        }
    };

    const getCategoryIcon = (category: string, title: string) => {
        const lowerTitle = title.toLowerCase();
        const lowerCat = category.toLowerCase();

        if (lowerCat.includes('security') || lowerTitle.includes('setup') || lowerTitle.includes('security')) return <Lock size={20} />;
        if (lowerCat.includes('hr') || lowerCat.includes('employee')) return <Users size={20} />;
        if (lowerCat.includes('attendance') || lowerCat.includes('hour') || lowerTitle.includes('hour')) return <Clock size={20} />;
        if (lowerCat.includes('leave') || lowerCat.includes('holiday') || lowerTitle.includes('leave')) return <Calendar size={20} />;
        if (lowerTitle.includes('laptop') || lowerTitle.includes('setup') || lowerTitle.includes('monitor')) return <Monitor size={20} />;
        if (lowerTitle.includes('software') || lowerTitle.includes('install') || lowerTitle.includes('download')) return <Download size={20} />;
        if (lowerTitle.includes('app') || lowerCat.includes('tool')) return <Settings size={20} />;
        return <Shield size={20} />;
    };

    useEffect(() => {
        api.getRules()
            .then(data => setLiveRules(data || []))
            .catch(() => setLiveRules([]))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="rulebook-page fade-in">
            <div className="rulebook-intro">
                <h1 className="rulebook-title">Company Rulebook</h1>
                <p className="rulebook-description">
                    The single source of truth for TripleS OS operational protocols, technical guidelines, and team expectations.
                </p>
            </div>

            {/* ── Live Admin-Published Rules Section ─────────────────────── */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <BookOpen size={18} style={{ color: 'var(--purple-main)' }} />
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'white' }}>Admin-Published Rules</h2>
                    <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                    {!isLoading && liveRules.length > 0 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '2px 10px' }}>
                            {liveRules.length} rule{liveRules.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {isLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '24px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        <Loader2 size={16} className="spin-icon" /> Fetching published rules…
                    </div>
                ) : liveRules.length === 0 ? (
                    <GlassCard style={{ padding: '32px', textAlign: 'center' }}>
                        <FileX size={36} style={{ color: 'rgba(255,255,255,0.2)', marginBottom: '10px' }} />
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No admin rules published yet. Check back later.</p>
                    </GlassCard>
                ) : (
                    <GlassCard className="rulebook-card">
                        <div className="rulebook-sections-wrapper">
                            {liveRules.map(rule => {
                                const isExpanded = expandedLiveId === rule.id;
                                const c = priorityColors[rule.priority] || priorityColors.Normal;
                                return (
                                    <div key={rule.id} className={`rule-section ${isExpanded ? 'expanded' : ''}`} style={isExpanded ? { borderLeft: `4px solid ${c.text}` } : {}}>
                                        <div className="rule-header" onClick={() => setExpandedLiveId(prev => prev === rule.id ? null : rule.id)}>
                                            <div className="rule-header-content">
                                                <div className="rule-icon" style={{ background: isExpanded ? `${c.text}20` : 'rgba(255,255,255,0.04)', color: isExpanded ? c.text : 'rgba(255,255,255,0.7)' }}>
                                                    {getCategoryIcon(rule.category, rule.title)}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontSize: '1.125rem', fontWeight: 600 }}>{rule.title}</span>
                                                    {!isExpanded && (
                                                        <span style={{ fontSize: '0.72rem', color: c.text, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>
                                                            {rule.priority} Priority
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronDown className="chevron-icon" size={20} />
                                        </div>
                                        <div className="rule-content">
                                            <div className="rule-content-inner" style={{ paddingTop: '0' }}>
                                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {rule.category}
                                                    </span>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', background: `${c.text}15`, border: `1px solid ${c.border}`, borderRadius: '12px', color: c.text, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {getPriorityIcon(rule.priority)} {rule.priority}
                                                    </span>
                                                </div>
                                                <div style={{ whiteSpace: 'pre-wrap' }}>{rule.description}</div>
                                                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                                                    <span>Published by {rule.author ? `${rule.author.firstName} ${rule.author.lastName}` : 'System Admin'}</span>
                                                    <span>{rule.effectiveDate ? `Effective From: ${new Date(rule.effectiveDate).toLocaleDateString('en-IN')}` : `Created: ${new Date(rule.createdAt).toLocaleDateString('en-IN')}`}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </GlassCard>
                )}
            </div>

            {/* ── Static Company Policy Accordion ───────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Shield size={18} style={{ color: '#3B82F6' }} />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'white' }}>Company Policy Standards</h2>
                <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
            </div>
            <GlassCard className="rulebook-card">
                <div className="rulebook-sections-wrapper">
                    {STATIC_SECTIONS.map((section) => {
                        const Icon = section.icon;
                        const isExpanded = expandedId === section.id;
                        return (
                            <div key={section.id} className={`rule-section ${isExpanded ? 'expanded' : ''}`}>
                                <div className="rule-header" onClick={() => setExpandedId(prev => prev === section.id ? null : section.id)}>
                                    <div className="rule-header-content">
                                        <div className="rule-icon"><Icon size={20} /></div>
                                        {section.title}
                                    </div>
                                    <ChevronDown className="chevron-icon" size={20} />
                                </div>
                                <div className="rule-content">
                                    <div className="rule-content-inner">{section.content}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </GlassCard>
        </div>
    );
}

