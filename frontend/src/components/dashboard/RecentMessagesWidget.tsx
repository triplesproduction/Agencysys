'use client';

import React, { useEffect } from 'react';
import { MessageSquare, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useConversations } from '@/hooks/useMessaging';
import { useQueryClient } from '@tanstack/react-query';
import { messagingKeys } from '@/hooks/messagingKeys';
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

export default function RecentMessagesWidget({ maxItems = 10, style = {} }: { maxItems?: number, style?: React.CSSProperties }) {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    const { data: convsData, isLoading } = useConversations(authEmployee?.id, authEmployee?.roleId);

    const threads = React.useMemo(() => {
        if (!convsData) return [];
        const convs = Array.isArray(convsData) ? convsData : [];
        return convs
            .filter(c => c.lastMessage) // Only conversations with messages
            .sort((a, b) => {
                if (!a.lastMessage || !b.lastMessage) return 0;
                return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
            })
            .slice(0, maxItems)
            .map(c => {
                if (!c.lastMessage) return null;
                return {
                    id: c.lastMessage.id,
                    content: c.lastMessage.content,
                    senderId: (c.lastMessage as any).sender_id || c.lastMessage.senderId,
                    sentAt: c.lastMessage.createdAt,
                    partner: c.otherUser,
                    unread: c.unreadCount
                };
            })
            .filter(Boolean) as any[];
    }, [convsData, maxItems]);

    const myId = authEmployee?.id;

    useEffect(() => {
        if (!myId) return;
        const channel = supabase.channel('dashboard-recent-messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const newMsg = payload.new;
                    if (String(newMsg.sender_id) === String(myId) || String(newMsg.receiver_id) === String(myId) || newMsg.conversation_id) {
                        queryClient.setQueryData(messagingKeys.conversations(String(myId)), (oldData: any) => {
                            if (!oldData) return oldData;
                            const idx = oldData.findIndex((c: any) => String(c.conversationId) === String(newMsg.conversation_id));
                            if (idx === -1) {
                                queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(String(myId)) });
                                return oldData;
                            }
                            const updated = [...oldData];
                            updated[idx] = {
                                ...updated[idx],
                                lastMessage: {
                                    id: newMsg.id,
                                    content: newMsg.content,
                                    sender_id: newMsg.sender_id,
                                    created_at: newMsg.created_at,
                                },
                                unreadCount: String(newMsg.sender_id) === String(myId) ? updated[idx].unreadCount : updated[idx].unreadCount + 1
                            };
                            return updated;
                        });
                    }
                }
            ).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [myId, queryClient]);

    return (
        <div className="ad2-card" style={{ display: 'flex', flexDirection: 'column', ...style }}>
            <div className="ad2-card-header" style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}><MessageSquare size={16} color="var(--purple-main)" /> Recent Chats</h3>
                <Link href="/messaging" className="ad2-badge" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', fontSize: '0.65rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
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
                <div className="custom-scrollbar" style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '10px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    paddingRight: '6px'
                }}>
                    {threads.map(msg => {
                        const name = msg.partner ? `${msg.partner.firstName} ${msg.partner.lastName}` : 'Unknown';
                        const photo = msg.partner?.profilePhoto;
                        const isMine = String(msg.senderId) === authEmployee?.id;

                        return (
                            <Link key={msg.id} href="/messaging" style={{ textDecoration: 'none' }}>
                                <div className="ad2-task-list-item" style={{ padding: '12px' }}>
                                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                                        {String(msg.partner?.roleId || '').toUpperCase() === 'ADMIN' ? (
                                            <img src="/white-logo.png" alt="Admin" style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'black', padding: '6px' }} />
                                        ) : photo ? (
                                            <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--purple-accent)' }}>{name.charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                                                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                                                {msg.unread > 0 && (
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--purple-main)', flexShrink: 0 }}></span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', flexShrink: 0, paddingTop: '2px' }}>
                                                {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
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
