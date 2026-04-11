'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface Message {
    id: string;
    content: string;
    senderId: string;
    receiverId: string;
    sentAt: string;
    sender: { firstName: string; lastName: string; profilePhoto?: string };
    receiver: { firstName: string; lastName: string; profilePhoto?: string };
}

export default function RecentMessagesWidget({ maxItems = 3 }: { maxItems?: number }) {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const [threads, setThreads] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchChats() {
            if (authLoading || !authEmployee) return;

            try {
                const myId = authEmployee.id;
                const response: any = await api.getMyChats(myId);
                const messages: Message[] = Array.isArray(response) ? response : (response?.data || []);

                const conversationMap = new Map<string, Message>();

                messages.forEach(msg => {
                    const partnerId = String(msg.senderId) === String(myId) ? String(msg.receiverId) : String(msg.senderId);
                    const existing = conversationMap.get(partnerId);
                    if (!existing || new Date(msg.sentAt) > new Date(existing.sentAt)) {
                        conversationMap.set(partnerId, msg);
                    }
                });


                const lastMessages = Array.from(conversationMap.values())
                    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
                    .slice(0, maxItems);

                setThreads(lastMessages);
            } catch (err) {
                console.error('Failed to fetch dashboard chats:', err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchChats();
    }, [authLoading, authEmployee, maxItems]);

    return (
        <div className="ad2-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="ad2-card-header">
                <h3><MessageSquare size={16} color="var(--purple-main)" /> Recent Chats</h3>
                <Link href="/messaging" className="ad2-badge" style={{ textDecoration: 'none' }}>
                    Open Inbox <ArrowRight size={10} style={{ marginLeft: '4px' }} />
                </Link>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '12px 0' }}>
                    <Loader2 size={14} className="spin-icon" /> Updating...
                </div>
            ) : threads.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>No messages yet.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {threads.map(msg => {
                        const isMine = String(msg.senderId) === authEmployee?.id;
                        const partner = isMine ? msg.receiver : msg.sender;
                        const name = partner ? `${partner.firstName} ${partner.lastName}` : 'Unknown';
                        const photo = partner?.profilePhoto;

                        return (
                            <Link key={msg.id} href="/messaging" style={{ textDecoration: 'none' }}>
                                <div className="ad2-task-list-item" style={{ padding: '12px' }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        flexShrink: 0,
                                        overflow: 'hidden'
                                    }}>
                                        {photo ? (
                                            <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            name.charAt(0)
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'white' }}>{name}</span>
                                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
                                                {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p style={{
                                            fontSize: '0.78rem',
                                            color: 'var(--text-secondary)',
                                            margin: 0,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {isMine ? 'You: ' : ''}{msg.content}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
