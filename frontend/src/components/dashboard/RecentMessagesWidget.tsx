'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
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
    const [threads, setThreads] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchChats() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const myId = user?.id; // Using UUID from auth for the check
                setCurrentUserId(myId ? String(myId) : null);

                const response: any = await api.getMyChats();
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
    }, [maxItems]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
                    <MessageSquare size={16} style={{ color: 'var(--purple-main)' }} /> Recent Chats
                </h2>
                <Link href="/messaging" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                    Open Inbox <ArrowRight size={10} />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {threads.map(msg => {
                        const isMine = String(msg.senderId) === currentUserId;
                        const partner = isMine ? msg.receiver : msg.sender;
                        const name = partner ? `${partner.firstName} ${partner.lastName}` : 'Unknown';
                        const photo = partner?.profilePhoto;

                        return (
                            <Link key={msg.id} href="/messaging" style={{ textDecoration: 'none' }}>
                                <div style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '12px',
                                    padding: '10px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    transition: 'all 0.2s',
                                    cursor: 'pointer'
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                >
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        background: 'var(--panel-bg)',
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
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{name}</span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--text-secondary)',
                                            margin: 0,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            opacity: 0.8
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
