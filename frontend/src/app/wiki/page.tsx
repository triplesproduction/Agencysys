'use client';

import { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, Search, Filter, Trash2, Edit2, ShieldAlert, Zap, AlertTriangle, AlertCircle } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { api } from '@/lib/api';
import { RuleDTO } from '@/types/dto';
import { getUserFromToken } from '@/lib/auth';
import { useNotifications } from '@/components/notifications/NotificationProvider';

export default function RuleBookPage() {
    const { addNotification } = useNotifications();
    const [rules, setRules] = useState<RuleDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');

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
        const user = getUserFromToken();
        const role = String(user?.role || user?.roleId || '').toUpperCase();
        if (role.includes('ADMIN')) {
            setIsAdmin(true);
        }
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            const data = await api.getRules();
            setRules(data);
        } catch (err) {
            console.error('Failed to load rules:', err);
        } finally {
            setLoading(false);
        }
    };

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
                await api.createRule(payload);
                addNotification({ type: 'SYSTEM', title: 'Success', message: 'Rule created successfully and broadcasted!' });
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
        if (!confirm('Are you sure you want to delete this rule?')) return;
        try {
            await api.deleteRule(id);
            addNotification({ type: 'SYSTEM', title: 'Success', message: 'Rule deleted successfully' });
            fetchRules();
        } catch (err: any) {
            addNotification({ type: 'ERROR', title: 'Error', message: err.message || 'Failed to delete rule' });
        }
    };

    // Derived filtering
    const filteredRules = useMemo(() => {
        return rules.filter(r => {
            const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = filterCategory === 'ALL' || r.category === filterCategory;
            return matchesSearch && matchesCategory;
        });
    }, [rules, searchQuery, filterCategory]);

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'Critical': return '#EF4444'; // Red
            case 'Important': return '#F59E0B'; // Orange
            case 'Normal': return '#3B82F6'; // Blue
            default: return 'var(--text-secondary)';
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



    return (
        <div className="main-content fade-in" style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <BookOpen size={28} style={{ color: 'var(--purple-main)' }} /> Rule Book
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                        The definitive directory of TripleS operations, policies, and standards.
                    </p>
                </div>
                {isAdmin && (
                    <button
                        className="primary-button hoverable"
                        onClick={() => {
                            setEditingRuleId(null);
                            setFormData({ title: '', description: '', category: 'Work Policy', priority: 'Normal', effectiveDate: '' });
                            setIsModalOpen(true);
                        }}
                        style={{
                            background: 'var(--purple-main)',
                            color: 'white',
                            border: '1px solid rgba(139, 92, 246, 0.5)',
                            padding: '12px 24px',
                            borderRadius: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                    >
                        <Plus size={20} />
                        Create Rule
                    </button>
                )}
            </div>

            {/* Controls */}
            <GlassCard style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '10px 16px', borderRadius: 'var(--radius-sm)' }}>
                    <Search size={18} style={{ color: 'var(--text-secondary)', marginRight: '12px' }} />
                    <input
                        type="text"
                        placeholder="Search rules by title..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '10px 16px', borderRadius: 'var(--radius-sm)' }}>
                    <Filter size={18} style={{ color: 'var(--text-secondary)', marginRight: '12px' }} />
                    <select
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none' }}
                    >
                        <option value="ALL" style={{ background: 'var(--bg-dark)' }}>All Categories</option>
                        <option value="HR" style={{ background: 'var(--bg-dark)' }}>HR</option>
                        <option value="Attendance" style={{ background: 'var(--bg-dark)' }}>Attendance</option>
                        <option value="Work Policy" style={{ background: 'var(--bg-dark)' }}>Work Policy</option>
                        <option value="Leave" style={{ background: 'var(--bg-dark)' }}>Leave</option>
                        <option value="Security" style={{ background: 'var(--bg-dark)' }}>Security</option>
                    </select>
                </div>
            </GlassCard>

            {/* Rules Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }} className="skeleton-pulse">
                    Synchronizing database policies...
                </div>
            ) : filteredRules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px', background: 'var(--glass-bg)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--glass-border)' }}>
                    No exact rule matches found for this filter.
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
                    {filteredRules.map(rule => (
                        <GlassCard key={rule.id} className="hoverable" style={{ padding: '24px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                            {/* Decorative Top Border Based on Priority */}
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: getPriorityColor(rule.priority), opacity: 0.8 }}></div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                                        {rule.category}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', background: `${getPriorityColor(rule.priority)}20`, border: `1px solid ${getPriorityColor(rule.priority)}50`, borderRadius: '12px', color: getPriorityColor(rule.priority), display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {getPriorityIcon(rule.priority)} {rule.priority}
                                    </span>
                                </div>

                                {isAdmin && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => {
                                            setFormData({ title: rule.title, description: rule.description, category: rule.category, priority: rule.priority, effectiveDate: rule.effectiveDate ? rule.effectiveDate.split('T')[0] : '' });
                                            setEditingRuleId(rule.id);
                                            setIsModalOpen(true);
                                        }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', opacity: 0.8 }} className="hoverable" title="Edit Rule">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDeleteRule(rule.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', opacity: 0.6 }} className="hoverable" title="Delete Rule">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', marginBottom: '12px' }}>{rule.title}</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.6', flex: 1, whiteSpace: 'pre-wrap' }}>
                                {rule.description}
                            </p>

                            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                <div>
                                    Authored by: {rule.author ? `${rule.author.firstName} ${rule.author.lastName}` : rule.createdBy}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    {rule.effectiveDate ? `Effective: ${new Date(rule.effectiveDate).toLocaleDateString()}` : `Published: ${new Date(rule.createdAt).toLocaleDateString()}`}
                                </div>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}

            {/* Create Rule Modal (Admin Only) */}
            {isModalOpen && isAdmin && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <form onSubmit={handleSubmitRule}>
                        <GlassCard style={{ width: '100%', minWidth: '500px', maxWidth: '600px', padding: '32px', border: '1px solid rgba(139, 92, 246, 0.3)', boxShadow: '0 0 40px rgba(0,0,0,0.8), 0 0 20px rgba(139, 92, 246, 0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Zap size={24} style={{ color: 'var(--purple-main)' }} /> {editingRuleId ? 'Update System Rule' : 'Publish System Rule'}
                                </h2>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Rule Title *</label>
                                    <input required type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none' }} placeholder="e.g. Mandatory EOD Time Log" />
                                </div>

                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Category *</label>
                                        <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none' }}>
                                            <option value="HR" style={{ background: 'var(--bg-dark)' }}>HR</option>
                                            <option value="Attendance" style={{ background: 'var(--bg-dark)' }}>Attendance</option>
                                            <option value="Work Policy" style={{ background: 'var(--bg-dark)' }}>Work Policy</option>
                                            <option value="Leave" style={{ background: 'var(--bg-dark)' }}>Leave</option>
                                            <option value="Security" style={{ background: 'var(--bg-dark)' }}>Security</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Priority Level *</label>
                                        <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none' }}>
                                            <option value="Normal" style={{ background: 'var(--bg-dark)' }}>Normal</option>
                                            <option value="Important" style={{ background: 'var(--bg-dark)' }}>Important</option>
                                            <option value="Critical" style={{ background: 'var(--bg-dark)' }}>Critical</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Effective Date (Optional)</label>
                                    <input type="date" value={formData.effectiveDate} onChange={e => setFormData({ ...formData, effectiveDate: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none', colorScheme: 'dark' }} />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Detailed Description *</label>
                                    <textarea required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} style={{ width: '100%', height: '120px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none', resize: 'vertical' }} placeholder="Clearly explain the policy constraint..." />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                    <button type="button" onClick={() => { setIsModalOpen(false); setEditingRuleId(null); }} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'white', padding: '12px 24px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} className="hoverable">Cancel</button>
                                    <button type="submit" disabled={isSubmitting} style={{ background: 'var(--purple-main)', border: 'none', color: 'white', padding: '12px 24px', borderRadius: 'var(--radius-sm)', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600 }} className="hoverable">
                                        {isSubmitting ? (editingRuleId ? 'Updating...' : 'Publishing...') : (editingRuleId ? 'Update Rule Protocol' : 'Publish Rule Protocol')}
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

