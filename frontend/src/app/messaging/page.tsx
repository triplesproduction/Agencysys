'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Send, Image as ImageIcon, X, Check, CheckCheck, MessageSquare, AtSign, Smile, ChevronDown } from 'lucide-react';
import './Messaging.css';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/components/notifications/NotificationProvider';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Conversation {
    conversationId: string;
    otherUser: any;
    lastMessage: any;
    unreadCount: number;
}

interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    content?: string;
    type: 'text' | 'image';
    mediaUrl?: string;
    taskRef?: any;
    status: 'sent' | 'delivered' | 'seen';
    createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatLastSeen = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MessagingPage() {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const { addNotification } = useNotifications();
    const myId = authEmployee?.id ? String(authEmployee.id) : null;
    const isAdmin = ['ADMIN', 'MANAGER'].includes(String(authEmployee?.roleId || '').toUpperCase());

    // ── State ──────────────────────────────────────────────────────────────────
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [allContacts, setAllContacts] = useState<any[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [activeOtherUser, setActiveOtherUser] = useState<any>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const [isTyping, setIsTyping] = useState(false); // other user typing
    const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showTaskDropdown, setShowTaskDropdown] = useState(false);
    const [myTasks, setMyTasks] = useState<any[]>([]);
    const [showContactPicker, setShowContactPicker] = useState(false);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [dbReady, setDbReady] = useState(true); // false = tables not yet created

    // ── Refs ───────────────────────────────────────────────────────────────────
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const realtimeRef = useRef<any>(null);

    // ── Load conversations & contacts ──────────────────────────────────────────
    const loadConversations = useCallback(async () => {
        if (!myId) return;
        try {
            const convs = await api.getConversations(myId);
            setConversations(convs as Conversation[]);
            setDbReady(true);
        } catch (e: any) {
            console.error('loadConversations error:', e);
            if (e?.message?.includes('schema cache') || e?.message?.includes('does not exist')) {
                setDbReady(false);
            }
        }
    }, [myId]);

    useEffect(() => {
        if (authLoading || !myId) return;
        const init = async () => {
            setLoading(true);
            try {
                // ── Direct probe: does the conversations table exist? ──────────
                const { error: probe } = await supabase
                    .from('conversations')
                    .select('id')
                    .limit(1);

                if (probe) {
                    // Table doesn't exist or access is blocked
                    console.warn('[Chat] conversations table not ready:', probe.message);
                    setDbReady(false);
                    // Still load contacts so the UI shows people
                    const empRes = await api.getEmployees({ limit: 100 });
                    const empArr = Array.isArray(empRes) ? empRes : (empRes as any)?.data || [];
                    setAllContacts(empArr.filter((e: any) => String(e.id) !== myId));
                    return;
                }

                setDbReady(true);
                const [empRes, tasks] = await Promise.all([
                    api.getEmployees({ limit: 100 }),
                    api.getTasks(myId, undefined, 30),
                ]);
                const empArr = Array.isArray(empRes) ? empRes : (empRes as any)?.data || [];
                setAllContacts(empArr.filter((e: any) => String(e.id) !== myId));
                setMyTasks(tasks || []);
                await loadConversations();
            } catch (e) {
                console.error('init error:', e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [authLoading, myId]);

    // ── Load messages when conversation changes ────────────────────────────────
    useEffect(() => {
        if (!activeConvId || !myId) {
            setMessages([]);
            return;
        }
        const load = async () => {
            const msgs = await api.getMessages(activeConvId);
            setMessages(msgs as Message[]);
            await api.markMessagesRead(activeConvId, myId);
            // Refresh unread counts
            await loadConversations();
        };
        load();
    }, [activeConvId, myId]);

    // ── Supabase Realtime subscription ─────────────────────────────────────────
    useEffect(() => {
        if (!activeConvId || !myId) return;

        // Cleanup previous subscription
        if (realtimeRef.current) {
            supabase.removeChannel(realtimeRef.current);
        }

        const channel = supabase
            .channel(`conv-${activeConvId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversationId=eq.${activeConvId}`,
                },
                async (payload: any) => {
                    const newMsg = payload.new as Message;
                    setMessages((prev) => {
                        if (prev.find((m) => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                    // Mark as read if from other user
                    if (String(newMsg.senderId) !== myId) {
                        await api.markMessagesRead(activeConvId, myId);
                        addNotification({
                            title: activeOtherUser ? `${activeOtherUser.firstName} ${activeOtherUser.lastName}` : 'New Message',
                            message: newMsg.content || '📷 Image',
                            type: 'REMINDER',
                        });
                    }
                    await loadConversations();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'typing_status',
                    filter: `conversationId=eq.${activeConvId}`,
                },
                (payload: any) => {
                    const row = payload.new;
                    // Show indicator if other user is typing
                    if (row && String(row.userId) !== myId) {
                        setIsTyping(row.isTyping);
                        // Auto-clear after 4s just in case
                        if (row.isTyping) {
                            setTimeout(() => setIsTyping(false), 4000);
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversationId=eq.${activeConvId}`,
                },
                (payload: any) => {
                    const updated = payload.new as Message;
                    setMessages((prev) =>
                        prev.map((m) => (m.id === updated.id ? { ...m, status: updated.status } : m))
                    );
                }
            )
            .subscribe();

        realtimeRef.current = channel;
        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeConvId, myId]);

    // ── Auto-scroll ────────────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // ── Typing indicator logic ─────────────────────────────────────────────────
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setMessageInput(val);

        // @ trigger
        if (val.endsWith('@')) {
            setShowTaskDropdown(true);
        } else if (!val.includes('@')) {
            setShowTaskDropdown(false);
        }

        // Typing status
        if (!activeConvId || !myId) return;
        api.setTypingStatus(myId, activeConvId, true).catch(() => {});
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (myId && activeConvId) api.setTypingStatus(myId, activeConvId, false).catch(() => {});
        }, 2500);
    };

    // ── Start / open a conversation ────────────────────────────────────────────
    const openConversation = async (contact: any) => {
        if (!myId) return;
        if (!dbReady) return; // banner already explains the issue
        setShowContactPicker(false);
        try {
            const convId = await api.getOrCreateConversation(myId, String(contact.id));
            setActiveConvId(convId);
            setActiveOtherUser(contact);
            await loadConversations();
        } catch (err: any) {
            console.error('[Chat] openConversation failed:', err.message);
            if (err.message?.includes('schema cache') || err.message?.includes('does not exist')) {
                setDbReady(false);
            }
        }
    };

    const selectConversation = (conv: Conversation) => {
        setActiveConvId(conv.conversationId);
        setActiveOtherUser(conv.otherUser);
    };

    // ── Send message ───────────────────────────────────────────────────────────
    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!activeConvId || !myId || isSending) return;

        // Image send
        if (imagePreview) {
            try {
                setIsSending(true);
                setIsUploading(true);
                const { url } = await api.uploadChatMedia(imagePreview.file);
                await api.sendMessage({
                    conversationId: activeConvId,
                    senderId: myId,
                    type: 'image',
                    mediaUrl: url,
                    content: messageInput.trim() || undefined,
                });
                setImagePreview(null);
                setMessageInput('');
            } catch (err: any) {
                alert('Image upload failed: ' + err.message);
            } finally {
                setIsSending(false);
                setIsUploading(false);
            }
            return;
        }

        const text = messageInput.trim();
        if (!text) return;

        try {
            setIsSending(true);
            setMessageInput('');
            await api.sendMessage({ conversationId: activeConvId, senderId: myId, content: text, type: 'text' });
            if (myId && activeConvId) api.setTypingStatus(myId, activeConvId, false).catch(() => {});
        } catch (err: any) {
            setMessageInput(text);
            alert('Failed to send: ' + err.message);
        } finally {
            setIsSending(false);
        }
    };

    // ── Image picker ───────────────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
            alert('Only JPG and PNG images are allowed.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Maximum image size is 5MB.');
            return;
        }
        const url = URL.createObjectURL(file);
        setImagePreview({ file, url });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Task tagging ───────────────────────────────────────────────────────────
    const insertTaskTag = (task: any) => {
        const beforeAt = messageInput.slice(0, messageInput.lastIndexOf('@'));
        setMessageInput(`${beforeAt}[Task: ${task.title}] `);
        setShowTaskDropdown(false);
        inputRef.current?.focus();
    };

    // ── Unified contact list: all members, with conv data merged in ─────────────
    const unifiedList = allContacts
        .map((contact) => {
            const conv = conversations.find((cv) => String(cv.otherUser?.id) === String(contact.id));
            return {
                contact,
                conversationId: conv?.conversationId || null,
                lastMessage: conv?.lastMessage || null,
                unreadCount: conv?.unreadCount || 0,
            };
        })
        .filter((item) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const c = item.contact;
            return (
                c.firstName?.toLowerCase().includes(q) ||
                c.lastName?.toLowerCase().includes(q) ||
                c.roleId?.toLowerCase().includes(q) ||
                c.department?.toLowerCase().includes(q) ||
                item.lastMessage?.content?.toLowerCase().includes(q)
            );
        })
        .sort((a, b) => {
            // Admin first
            const aAdmin = String(a.contact.roleId || '').toUpperCase() === 'ADMIN';
            const bAdmin = String(b.contact.roleId || '').toUpperCase() === 'ADMIN';
            if (aAdmin && !bAdmin) return -1;
            if (!aAdmin && bAdmin) return 1;
            // Then by last message time
            const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bTime - aTime;
        });

    // ── Render message content ─────────────────────────────────────────────────
    const renderContent = (msg: Message) => {
        if (msg.type === 'image' && msg.mediaUrl) {
            return (
                <div className="msg-img-wrapper" onClick={() => setExpandedImage(msg.mediaUrl!)}>
                    <img src={msg.mediaUrl} alt="Shared image" className="msg-img" />
                    {msg.content && <p className="msg-caption">{msg.content}</p>}
                </div>
            );
        }
        // Task tag rendering
        const taskTagRegex = /\[Task: ([^\]]+)\]/g;
        const parts = msg.content?.split(taskTagRegex) || [];
        if (parts.length <= 1) return <span>{msg.content}</span>;

        return (
            <>
                {parts.map((part, i) =>
                    i % 2 === 1 ? (
                        <span key={i} className="task-tag">
                            <AtSign size={10} /> {part}
                        </span>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                )}
            </>
        );
    };

    // ── Status tick ────────────────────────────────────────────────────────────
    const StatusTick = ({ status }: { status: string }) => {
        if (status === 'seen') return <CheckCheck size={13} className="tick-seen" />;
        if (status === 'delivered') return <CheckCheck size={13} className="tick-delivered" />;
        return <Check size={13} className="tick-sent" />;
    };

    // ── Loading screen ──────────────────────────────────────────────────────────
    if (authLoading) {
        return (
            <div className="msg-loading">
                <div className="msg-spinner" />
            </div>
        );
    }

    // ── JSX ────────────────────────────────────────────────────────────────────
    return (
        <div className="msg-page">
            {/* Header */}
            <header className="page-header">
                <div>
                    <h1 className="greeting">Messages</h1>
                    <p className="subtitle">Real-time collaboration with your team.</p>
                </div>
            </header>

            {/* DB setup banner */}
            {!dbReady && (
                <div style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: '12px',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.82rem',
                    color: '#fca5a5',
                    flexShrink: 0,
                }}>
                    <span style={{ fontSize: '1rem' }}>⚠️</span>
                    <span>
                        <strong>Database tables not found.</strong>&nbsp;
                        Run the messaging SQL schema in your Supabase SQL Editor to enable real-time chat.
                    </span>
                </div>
            )}

            <div className="msg-layout">
                {/* ── LEFT PANEL ── */}
                <aside className="msg-sidebar">
                    {/* Search */}
                    <div className="msg-sidebar-search">
                        <Search size={16} className="msg-search-icon" />
                        <input
                            className="msg-search-input"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Unified contact + conversation list */}
                    <div className="msg-conv-list">
                        {loading && (
                            <div className="msg-list-loading">
                                {[1,2,3,4].map(i => <div key={i} className="msg-skeleton" />)}
                            </div>
                        )}

                        {!loading && unifiedList.length === 0 && (
                            <div className="msg-empty-note">No team members found.</div>
                        )}

                        {!loading && unifiedList.map(({ contact, conversationId, lastMessage, unreadCount }) => {
                            const isActive = conversationId === activeConvId;
                            const isAdminUser = String(contact.roleId || '').toUpperCase() === 'ADMIN';

                            return (
                                <div
                                    key={contact.id}
                                    className={`msg-conv-item ${
                                        isActive ? 'active' : ''
                                    } ${isAdminUser ? 'admin-pinned' : ''}`}
                                    onClick={async () => {
                                        if (conversationId) {
                                            setActiveConvId(conversationId);
                                            setActiveOtherUser(contact);
                                        } else {
                                            await openConversation(contact);
                                        }
                                    }}
                                >
                                    <div className="msg-avatar-container">
                                        <div className="msg-avatar">
                                            {contact.profilePhoto ? (
                                                <img src={contact.profilePhoto} alt={contact.firstName} />
                                            ) : (
                                                contact.firstName?.charAt(0).toUpperCase() || '?'
                                            )}
                                        </div>
                                        <div className="msg-online-dot" />
                                    </div>

                                    <div className="msg-conv-info">
                                        <div className="msg-conv-top">
                                            <span className="msg-conv-name">
                                                {contact.firstName} {contact.lastName}
                                                {isAdminUser && (
                                                    <span className="msg-admin-badge">ADMIN</span>
                                                )}
                                            </span>
                                            {lastMessage && (
                                                <span className="msg-conv-time">
                                                    {formatTime(lastMessage.createdAt)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="msg-conv-bottom">
                                            <span className="msg-conv-snippet">
                                                {lastMessage
                                                    ? lastMessage.type === 'image'
                                                        ? '📷 Image'
                                                        : lastMessage.content
                                                    : <span className="msg-no-conv-hint">{contact.designation || contact.roleId || 'Team Member'}</span>}
                                            </span>
                                            {unreadCount > 0 && (
                                                <span className="msg-unread-badge">{unreadCount}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* ── RIGHT PANEL ── */}
                <main className="msg-main">
                    {!activeConvId ? (
                        <div className="msg-empty-state">
                            <div className="msg-empty-icon">
                                <MessageSquare size={48} />
                            </div>
                            <h3>TripleS Messaging</h3>
                            <p>Select a conversation or start a new one.</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="msg-chat-header">
                                <div className="msg-avatar-container">
                                    <div className="msg-avatar">
                                        {activeOtherUser?.profilePhoto ? (
                                            <img src={activeOtherUser.profilePhoto} alt={activeOtherUser?.firstName} />
                                        ) : (
                                            activeOtherUser?.firstName?.charAt(0).toUpperCase() || '?'
                                        )}
                                    </div>
                                    <div className="msg-online-dot" />
                                </div>
                                <div className="msg-chat-header-info">
                                    <div className="msg-chat-header-name">
                                        {activeOtherUser?.firstName} {activeOtherUser?.lastName}
                                    </div>
                                    <div className="msg-chat-header-sub">
                                        {String(activeOtherUser?.roleId || '').toUpperCase() === 'ADMIN' ? (
                                            <span style={{ color: '#a78bfa' }}>Admin · Online</span>
                                        ) : isAdmin ? (
                                            <span style={{ color: '#10B981' }}>Online</span>
                                        ) : (
                                            <span style={{ color: '#10B981' }}>Online</span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    className="msg-close-btn"
                                    onClick={() => { setActiveConvId(null); setActiveOtherUser(null); }}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Messages Area */}
                            <div className="msg-messages-area">
                                {messages.length === 0 && (
                                    <div className="msg-no-msgs">
                                        <p>Say hello to {activeOtherUser?.firstName} 👋</p>
                                    </div>
                                )}

                                {messages.map((msg, idx) => {
                                    const isMine = String(msg.senderId) === String(myId);
                                    const showAvatar = idx === 0 || messages[idx - 1]?.senderId !== msg.senderId;

                                    return (
                                        <div key={msg.id} className={`msg-row ${isMine ? 'sent' : 'received'}`}>
                                            {!isMine && (
                                                <div className={`msg-mini-avatar ${showAvatar ? '' : 'invisible'}`}>
                                                    {activeOtherUser?.profilePhoto ? (
                                                        <img src={activeOtherUser.profilePhoto} alt="" />
                                                    ) : (
                                                        activeOtherUser?.firstName?.charAt(0) || '?'
                                                    )}
                                                </div>
                                            )}

                                            <div className="msg-bubble-wrap">
                                                <div className={`msg-bubble ${isMine ? 'msg-bubble-sent' : 'msg-bubble-recv'}`}>
                                                    {renderContent(msg)}
                                                </div>
                                                <div className={`msg-meta ${isMine ? 'msg-meta-sent' : ''}`}>
                                                    <span>{formatTime(msg.createdAt)}</span>
                                                    {isMine && <StatusTick status={msg.status} />}
                                                </div>
                                            </div>

                                            {isMine && (
                                                <div className={`msg-mini-avatar ${showAvatar ? '' : 'invisible'}`}>
                                                    {(authEmployee as any)?.profilePhoto ? (
                                                        <img src={String((authEmployee as any).profilePhoto)} alt="" />
                                                    ) : (
                                                        authEmployee?.firstName?.charAt(0) || 'M'
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Typing indicator */}
                                {isTyping && (
                                    <div className="msg-row received">
                                        <div className="msg-mini-avatar">
                                            {activeOtherUser?.firstName?.charAt(0) || '?'}
                                        </div>
                                        <div className="msg-typing-indicator">
                                            <span /><span /><span />
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            {/* Image Preview before send */}
                            {imagePreview && (
                                <div className="msg-img-preview-bar">
                                    <div className="msg-img-preview-thumb">
                                        <img src={imagePreview.url} alt="Preview" />
                                        <button
                                            className="msg-img-preview-remove"
                                            onClick={() => { URL.revokeObjectURL(imagePreview.url); setImagePreview(null); }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                    <span className="msg-img-preview-label">{imagePreview.file.name}</span>
                                </div>
                            )}

                            {/* Task dropdown */}
                            {showTaskDropdown && (
                                <div className="msg-task-dropdown">
                                    <div className="msg-task-dropdown-header">📌 Your Tasks</div>
                                    {myTasks.length === 0 && (
                                        <div className="msg-empty-note">No tasks found.</div>
                                    )}
                                    {myTasks.map((task) => (
                                        <div
                                            key={task.id}
                                            className="msg-task-item"
                                            onClick={() => insertTaskTag(task)}
                                        >
                                            <span className={`task-priority-dot priority-${task.priority?.toLowerCase()}`} />
                                            <span className="msg-task-title">{task.title}</span>
                                            <span className="msg-task-status">{task.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Compose bar */}
                            <form className="msg-compose" onSubmit={handleSend}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/jpeg,image/jpg,image/png"
                                    onChange={handleFileChange}
                                />
                                <button
                                    type="button"
                                    className="msg-attach-btn"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Send image"
                                >
                                    <ImageIcon size={18} />
                                </button>

                                <div className="msg-input-wrap">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className="msg-input"
                                        placeholder={imagePreview ? 'Add a caption...' : 'Type a message...'}
                                        value={messageInput}
                                        onChange={handleInputChange}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                            if (e.key === 'Escape') {
                                                setShowTaskDropdown(false);
                                                setImagePreview(null);
                                            }
                                        }}
                                        autoComplete="off"
                                    />
                                    <button
                                        type="button"
                                        className="msg-at-btn"
                                        title="Tag a task"
                                        onClick={() => {
                                            setMessageInput((prev) => prev + '@');
                                            setShowTaskDropdown(true);
                                            inputRef.current?.focus();
                                        }}
                                    >
                                        <AtSign size={15} />
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    className="msg-send-btn"
                                    disabled={(!messageInput.trim() && !imagePreview) || isSending || isUploading}
                                >
                                    {isSending || isUploading ? (
                                        <div className="msg-send-spinner" />
                                    ) : (
                                        <Send size={17} />
                                    )}
                                </button>
                            </form>
                        </>
                    )}
                </main>
            </div>

            {/* Expanded image lightbox */}
            {expandedImage && (
                <div className="msg-lightbox" onClick={() => setExpandedImage(null)}>
                    <button className="msg-lightbox-close" onClick={() => setExpandedImage(null)}>
                        <X size={20} />
                    </button>
                    <img src={expandedImage} alt="Full size" className="msg-lightbox-img" />
                </div>
            )}
        </div>
    );
}
