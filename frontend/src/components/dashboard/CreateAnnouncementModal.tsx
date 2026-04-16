import React, { useState } from 'react';
import { X, Send, Megaphone, Target, Image as ImageIcon, Smile, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { useAuth } from '@/context/AuthContext';

interface CreateAnnouncementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({ isOpen, onClose, onCreated }) => {
    const { addNotification } = useNotifications();
    const { employee } = useAuth();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [priority, setPriority] = useState<'Normal' | 'Important' | 'Critical'>('Normal');
    const [channel, setChannel] = useState<'All' | 'Product' | 'Engineering' | 'Design'>('All');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        setIsSubmitting(true);
        try {
            await api.createAnnouncement({
                title: title.trim(),
                message: content.trim(),
                priority,
                channel,
                authorId: employee?.id
            });
            addNotification({
                title: 'Broadcast Sent',
                message: 'Your announcement has been delivered to all team members.',
                type: 'SUCCESS'
            });
            onCreated();
            onClose();
        } catch (err: any) {
            addNotification({
                title: 'Broadcast Failed',
                message: err.message || 'Could not deliver announcement.',
                type: 'ERROR'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="ad2-card fade-in" style={{ width: '100%', maxWidth: '600px', padding: '0', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Megaphone size={18} color="var(--purple-main)" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', margin: 0 }}>Send Broadcast</h2>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Notify the entire team instantly</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Announcement Title</label>
                        <input 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Weekly Sync Canceled"
                            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '0.9rem' }}
                            autoFocus
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Priority Level</label>
                            <select 
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as any)}
                                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '10px 16px', color: 'white', fontSize: '0.9rem' }}
                            >
                                <option value="Normal">Normal</option>
                                <option value="Important">Important</option>
                                <option value="Critical">Critical</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Target Channel</label>
                            <select 
                                value={channel}
                                onChange={(e) => setChannel(e.target.value as any)}
                                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '10px 16px', color: 'white', fontSize: '0.9rem' }}
                            >
                                <option value="All">Everyone</option>
                                <option value="Product">Product Team</option>
                                <option value="Engineering">Engineering</option>
                                <option value="Design">Designers</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Message Content</label>
                        <textarea 
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Type your message here..."
                            rows={5}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '0.9rem', resize: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button 
                            type="button" 
                            onClick={onClose}
                            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.9rem', padding: '8px 20px', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting || !title.trim() || !content.trim()}
                            className="ad2-action-btn primary"
                            style={{ background: 'var(--purple-main)', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 24px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: isSubmitting ? 0.6 : 1 }}
                        >
                            {isSubmitting ? 'Sending...' : <><Send size={16} /> Broadcast Now</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateAnnouncementModal;
