'use client';

import { PageHeader } from '@/components/common/PageHeader';

import { useState, useEffect, useMemo } from 'react';
import GlassCard from '@/components/GlassCard';
import { 
    Shield, Clock, Calendar, Lock, Users, Plus, Edit2, Trash2, Zap, LayoutGrid, AlertTriangle, AlertCircle, ShieldAlert, FileX
} from 'lucide-react';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import DatePicker from '@/components/common/DatePicker';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { RuleDTO } from '@/types/dto';
import './Rulebook.css';

const priorityColors: Record<string, { text: string; border: string; bg: string }> = {
    Critical: { text: '#EF4444', border: 'rgba(239,68,68,0.4)', bg: 'rgba(239,68,68,0.08)' },
    Important: { text: '#F59E0B', border: 'rgba(245,158,11,0.4)', bg: 'rgba(245,158,11,0.08)' },
    Normal: { text: '#3B82F6', border: 'rgba(59,130,246,0.4)', bg: 'rgba(59,130,246,0.08)' },
    Low: { text: '#6B7280', border: 'rgba(107,114,128,0.4)', bg: 'rgba(107,114,128,0.08)' },
};

const CATEGORIES = [
    { id: 'All', name: 'All Rules', icon: LayoutGrid },
    { id: 'Work Policy', name: 'Work Policy', icon: Shield },
    { id: 'Security', name: 'Security & IT', icon: Lock },
    { id: 'Leave', name: 'Leave & PTO', icon: Calendar },
    { id: 'Attendance', name: 'Attendance', icon: Clock },
    { id: 'HR', name: 'Human Resources', icon: Users }
];

export default function RulebookPage() {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const { addNotification } = useNotifications();
    const [liveRules, setLiveRules] = useState<RuleDTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeCategory, setActiveCategory] = useState('All');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Work Policy' as any,
        priority: 'Normal' as any,
        effectiveDate: ''
    });

    useEffect(() => {
        if (!authLoading) {
            if (authEmployee) {
                const role = String(authEmployee.roleId || '').toUpperCase();
                if (role.includes('ADMIN') || role.includes('MANAGER')) {
                    setIsAdmin(true); // Allow Managers and Admins to edit/create
                }
                fetchRules();
            } else {
                setIsLoading(false);
            }
        }
    }, [authLoading, authEmployee]);

    const fetchRules = async () => {
        try {
            setIsLoading(true);
            const data = await api.getRules();
            setLiveRules(Array.isArray(data) ? data : []);
        } catch (err) {
            logger.error('Error', 'Failed to load rules:', err);
            setLiveRules([]);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredRules = useMemo(() => {
        if (activeCategory === 'All') return liveRules;
        return liveRules.filter(r => r.category === activeCategory || (activeCategory === 'Security' && r.category.includes('Security')));
    }, [liveRules, activeCategory]);

    const handleSubmitRule = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload = {
                title: formData.title,
                description: formData.description,
                category: formData.category,
                priority: formData.priority,
                effectiveDate: formData.effectiveDate ? new Date(formData.effectiveDate).toISOString() : undefined
            };

            if (editingRuleId) {
                await api.updateRule(editingRuleId, payload);
                addNotification({ type: 'SYSTEM', title: 'Success', message: 'Rule updated successfully' });
            } else {
                if (!authEmployee) throw new Error('No auth session');
                await api.createRule(payload, authEmployee.id);
                addNotification({ type: 'SYSTEM', title: 'Success', message: 'Rule created and broadcasted globally.' });
            }

            setIsModalOpen(false);
            setEditingRuleId(null);
            setFormData({ title: '', description: '', category: 'Work Policy', priority: 'Normal', effectiveDate: '' });
            fetchRules();
        } catch (err: any) {
            addNotification({ type: 'ERROR', title: 'Error', message: err.message || `Failed to ${editingRuleId ? 'update' : 'create'} rule` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!confirm('Are you sure you want to permanently delete this rule?')) return;
        try {
            await api.deleteRule(id);
            addNotification({ type: 'SYSTEM', title: 'Success', message: 'Rule deleted successfully' });
            fetchRules();
        } catch (err: any) {
            addNotification({ type: 'ERROR', title: 'Error', message: err.message || 'Failed to delete rule' });
        }
    };

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case 'Critical': return <ShieldAlert size={14} />;
            case 'Important': return <AlertTriangle size={14} />;
            case 'Normal': return <AlertCircle size={14} />;
            default: return null;
        }
    };

    if (authLoading) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    return (
        <div className="rulebook-page page-root fade-in">
            <PageHeader
                title="Company Rulebook"
                subtitle={<p className="subtitle">The single source of truth for TripleS OS operational protocols and guidelines.</p>}
                actions={
                    isAdmin && (
                        <button
                            className="page-action-btn-primary"
                            onClick={() => {
                                setEditingRuleId(null);
                                setFormData({ title: '', description: '', category: 'Work Policy', priority: 'Normal', effectiveDate: '' });
                                setIsModalOpen(true);
                            }}
                        >
                            <Plus size={18} /> New Rule
                        </button>
                    )
                }
            />

            <div className="rulebook-layout">
                {/* Sidebar Navigation */}
                <aside className="rulebook-sidebar">
                    {CATEGORIES.map(cat => (
                        <button 
                            key={cat.id}
                            className={`category-nav-item ${activeCategory === cat.id ? 'active' : ''}`}
                            onClick={() => setActiveCategory(cat.id)}
                        >
                            <cat.icon size={18} className="cat-icon" />
                            {cat.name}
                        </button>
                    ))}
                </aside>

                {/* Main Rules Content */}
                <main className="rulebook-main-content">
                    {isLoading ? (
                        <div className="rules-grid">
                            {[1, 2, 3].map(i => <div key={i} className="skeleton-pulse" style={{ height: '200px', borderRadius: 'var(--radius-lg)' }} />)}
                        </div>
                    ) : filteredRules.length === 0 ? (
                        <div className="empty-state" style={{ padding: '6rem 2rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-lg)', border: '1px dashed rgba(255,255,255,0.05)' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                                <FileX size={32} style={{ opacity: 0.2 }} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>No rules found</h3>
                            <p style={{ color: 'rgba(255,255,255,0.4)', maxWidth: '300px', margin: '0 auto' }}>There are no rules published under this category yet.</p>
                        </div>
                    ) : (
                        <div className="rules-grid">
                            {filteredRules.map(rule => {
                                const c = priorityColors[rule.priority] || priorityColors.Normal;
                                return (
                                    <div key={rule.id} className="rule-card">
                                        <div className="rule-card-header">
                                            <div>
                                                <h3 className="rule-card-title">{rule.title}</h3>
                                                <div className="rule-card-meta">
                                                    <span className="rule-pill category">
                                                        {rule.category}
                                                    </span>
                                                    <span className="rule-pill" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                                                        {getPriorityIcon(rule.priority)} {rule.priority}
                                                    </span>
                                                </div>
                                            </div>
                                            {isAdmin && (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => {
                                                        setFormData({ 
                                                            title: rule.title, 
                                                            description: rule.description, 
                                                            category: rule.category, 
                                                            priority: rule.priority, 
                                                            effectiveDate: rule.effectiveDate ? rule.effectiveDate.split('T')[0] : '' 
                                                        });
                                                        setEditingRuleId(rule.id);
                                                        setIsModalOpen(true);
                                                    }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px', borderRadius: '8px', cursor: 'pointer' }} title="Edit Rule">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDeleteRule(rule.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', padding: '6px', borderRadius: '8px', cursor: 'pointer' }} title="Delete Rule">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="rule-card-desc">
                                            {rule.description}
                                        </div>
                                        
                                        <div className="rule-card-footer">
                                            <span>Author: {rule.author ? `${rule.author.firstName} ${rule.author.lastName}` : 'System Admin'}</span>
                                            <span>
                                                {rule.effectiveDate ? `Effective: ${new Date(rule.effectiveDate).toLocaleDateString('en-US')}` : `Published: ${new Date(rule.createdAt).toLocaleDateString('en-US')}`}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>

            {/* Create Rule Modal (Admin Only) */}
            {isModalOpen && isAdmin && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <form onSubmit={handleSubmitRule}>
                        <GlassCard style={{ width: '100%', minWidth: '500px', maxWidth: '600px', padding: '32px', border: '1px solid rgba(139, 92, 246, 0.3)', boxShadow: '0 0 40px rgba(0,0,0,0.8), 0 0 20px rgba(139, 92, 246, 0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Zap size={24} style={{ color: 'var(--purple-main)' }} /> {editingRuleId ? 'Update Policy' : 'Publish New Policy'}
                                </h2>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Policy Title *</label>
                                    <input required type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none' }} placeholder="e.g. Code Review Standards" />
                                </div>

                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Category *</label>
                                        <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="filter-select" style={{ width: '100%' }}>
                                            <option value="HR" style={{ background: 'var(--bg-dark)' }}>HR</option>
                                            <option value="Attendance" style={{ background: 'var(--bg-dark)' }}>Attendance</option>
                                            <option value="Work Policy" style={{ background: 'var(--bg-dark)' }}>Work Policy</option>
                                            <option value="Leave" style={{ background: 'var(--bg-dark)' }}>Leave</option>
                                            <option value="Security" style={{ background: 'var(--bg-dark)' }}>Security</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Priority Level *</label>
                                        <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} className="filter-select" style={{ width: '100%' }}>
                                            <option value="Normal" style={{ background: 'var(--bg-dark)' }}>Normal</option>
                                            <option value="Important" style={{ background: 'var(--bg-dark)' }}>Important</option>
                                            <option value="Critical" style={{ background: 'var(--bg-dark)' }}>Critical</option>
                                        </select>
                                    </div>
                                </div>

                                <DatePicker 
                                    label="Effective Date"
                                    value={formData.effectiveDate}
                                    onChange={(dt) => setFormData({ ...formData, effectiveDate: dt })}
                                    placement="right"
                                />

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Detailed Policy Document *</label>
                                    <textarea required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} style={{ width: '100%', height: '160px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none', resize: 'vertical' }} placeholder="Clearly explain the policy constraint... (Markdown supported)" />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                    <button type="button" onClick={() => { setIsModalOpen(false); setEditingRuleId(null); }} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'white', padding: '12px 24px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} className="hoverable">Cancel</button>
                                    <button type="submit" disabled={isSubmitting} style={{ background: 'var(--purple-main)', border: 'none', color: 'white', padding: '12px 24px', borderRadius: 'var(--radius-sm)', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600 }} className="hoverable">
                                        {isSubmitting ? (editingRuleId ? 'Updating...' : 'Publishing...') : (editingRuleId ? 'Update Policy' : 'Publish Policy')}
                                    </button>
                                </div>
                            </div>
                        </GlassCard>
                    </form>
                </div>
            )}
        </div>
    );
}
