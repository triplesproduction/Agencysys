'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Send, Image as ImageIcon, X, Check, CheckCheck, MessageSquare, AtSign, ChevronDown } from 'lucide-react';
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
    senderName?: string;
    senderPhoto?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MessagingPage() {
    const router = useRouter();
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const { addNotification } = useNotifications();
    const myId = authEmployee?.id ? String(authEmployee.id) : null;
    const myRole = String(authEmployee?.roleId || '');
    const isAdmin = ['ADMIN', 'MANAGER'].includes(myRole.toUpperCase());

    // ── State ──────────────────────────────────────────────────────────────────
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [allContacts, setAllContacts] = useState<any[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [activeOtherUser, setActiveOtherUser] = useState<any>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showTaskDropdown, setShowTaskDropdown] = useState(false);
    const [myTasks, setMyTasks] = useState<any[]>([]);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [dbReady, setDbReady] = useState(true);
    const [dbProbeError, setDbProbeError] = useState<string | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});

    // ── Refs ───────────────────────────────────────────────────────────────────
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const realtimeRef = useRef<any>(null);
    const activeConvIdRef = useRef<string | null>(null);   // for global listener
    const initDoneRef = useRef(false);                     // ✅ duplicate-fetch guard
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // retry guard

    // ── Load conversations ──────────────────────────────────────────────────────
    const loadConversations = useCallback(async () => {
        if (!myId) return;
        try {
            console.log('[Chat] loadConversations myId:', myId, 'role:', myRole);
            const convs = await api.getConversations(myId, myRole);
            console.log('[Chat] conversations loaded:', convs.length);
            setConversations(convs as Conversation[]);
            setDbReady(true);
        } catch (e: any) {
            console.error('[Chat] loadConversations error:', e);
            if (e?.message?.includes('schema cache') || e?.message?.includes('does not exist')) {
                setDbReady(false);
            }
        }
    }, [myId, myRole]);

    // ── Init: runs ONLY after auth settles, with duplicate-fetch guard ──────────
    useEffect(() => {
        // ✅ Fix 1, 2, 3: Gate on authLoading AND authEmployee object, not just myId
        if (authLoading || !authEmployee || !myId) return;

        // ✅ Fix 8: Prevent duplicate fetches caused by rapid re-renders
        if (initDoneRef.current) return;
        initDoneRef.current = true;

        const init = async () => {
            // ✅ Fix 4: Show loading immediately — never show empty UI
            setLoading(true);
            try {
                const { error: probe } = await supabase
                    .from('conversations')
                    .select('id')
                    .limit(1);

                if (probe) {
                    console.warn('[Chat] conversations table not ready:', probe.message);
                    setDbProbeError(probe.message);
                    setDbReady(false);
                    const empRes = await api.getEmployees({ limit: 100 });
                    const empArr = Array.isArray(empRes) ? empRes : (empRes as any)?.data || [];
                    setAllContacts(empArr.filter((e: any) => String(e.id) !== myId));
                    return;
                }

                setDbReady(true);
                setDbProbeError(null);

                // ✅ Fix 2: All data fetches in parallel for speed
                const [empRes, tasks] = await Promise.all([
                    api.getEmployees({ limit: 100 }),
                    api.getTasks(myId, undefined, 30),
                ]);
                const empArr = Array.isArray(empRes) ? empRes : (empRes as any)?.data || [];
                setAllContacts(empArr.filter((e: any) => String(e.id) !== myId));
                setMyTasks(tasks || []);

                // ✅ Fix 5: Load conversations first; realtime subscription starts after
                await loadConversations();
            } catch (e) {
                console.error('[Chat] init error:', e);
                // Reset guard so navigating back can retry
                initDoneRef.current = false;
            } finally {
                setLoading(false);
            }
        };
        init();
    // ✅ Fix 2: Include authEmployee so re-auth triggers a fresh load
    }, [authLoading, authEmployee, myId]);

    // ── Presence tracking ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!myId) return;
        const channel = supabase.channel('online-users', {
            config: { presence: { key: myId } },
        });
        channel
            .on('presence', { event: 'sync' }, () => {
                setOnlineUsers(channel.presenceState());
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ online_at: new Date().toISOString() });
                }
            });
        return () => { supabase.removeChannel(channel); };
    }, [myId]);

    // ── GLOBAL realtime listener: notifications for messages in other convs ─────
    useEffect(() => {
        if (!myId) return;
        const globalChannel = supabase
            .channel('global-messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                async (payload: any) => {
                    const newMsg = payload.new;
                    console.log('[Chat] Global realtime INSERT:', newMsg);
                    if (String(newMsg.sender_id) === myId) return;
                    // If user is already viewing this conversation, skip (handled locally)
                    if (newMsg.conversation_id === activeConvIdRef.current) return;
                    await loadConversations();
                    addNotification({
                        title: 'New Message',
                        message: newMsg.content || '📷 Image',
                        type: 'REMINDER',
                    });
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(globalChannel); };
    }, [myId]);

    // ── Load messages when active conversation changes ─────────────────────────
    useEffect(() => {
        activeConvIdRef.current = activeConvId;
        // Fix 6: clear any pending retry from a previous conversation
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }

        if (!activeConvId || !myId) {
            setMessages([]);
            return;
        }
        const load = async () => {
            console.log('[Chat] Loading messages for conv:', activeConvId);
            const msgs = await api.getMessages(activeConvId);
            setMessages(msgs as Message[]);
            await api.markMessagesRead(activeConvId, myId);
            await loadConversations();

            // Fix 6: retry once after 2s if messages came back empty (race on new conv)
            if (msgs.length === 0) {
                retryTimerRef.current = setTimeout(async () => {
                    if (activeConvIdRef.current !== activeConvId) return; // user moved away
                    console.log('[Chat] Retry: empty on first load, retrying...');
                    const retried = await api.getMessages(activeConvId);
                    if (retried.length > 0) setMessages(retried as Message[]);
                }, 2000);
            }
        };
        load();

        return () => {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        };
    }, [activeConvId, myId]);

    // ── Per-conversation Realtime subscription ─────────────────────────────────
    useEffect(() => {
        if (!activeConvId || !myId) return;
        if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);

        const channel = supabase
            .channel(`conv-${activeConvId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvId}` },
                async (payload: any) => {
                    const newMsg = payload.new;
                    console.log('[Chat] Realtime INSERT in active conv:', newMsg);
                    const mappedMsg: Message = {
                        ...newMsg,
                        senderId: newMsg.sender_id,
                        conversationId: newMsg.conversation_id,
                        createdAt: newMsg.created_at,
                        mediaUrl: newMsg.media_url,
                        taskRef: newMsg.task_ref,
                    };
                    setMessages((prev) => {
                        if (prev.find((m) => m.id === mappedMsg.id)) return prev;
                        return [...prev, mappedMsg];
                    });
                    if (String(mappedMsg.senderId) !== myId) {
                        await api.markMessagesRead(activeConvId, myId);
                        addNotification({
                            title: activeOtherUser
                                ? `${activeOtherUser.firstName} ${activeOtherUser.lastName}`
                                : 'New Message',
                            message: newMsg.content || '📷 Image',
                            type: 'REMINDER',
                        });
                    }
                    await loadConversations();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'typing_status', filter: `conversation_id=eq.${activeConvId}` },
                (payload: any) => {
                    const row = payload.new;
                    if (row && String(row.user_id) !== myId) {
                        setIsTyping(row.is_typing);
                        if (row.is_typing) setTimeout(() => setIsTyping(false), 4000);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvId}` },
                (payload: any) => {
                    const updated = payload.new as Message;
                    setMessages((prev) =>
                        prev.map((m) => (m.id === updated.id ? { ...m, status: updated.status } : m))
                    );
                }
            )
            .subscribe();

        realtimeRef.current = channel;
        return () => { supabase.removeChannel(channel); };
    }, [activeConvId, myId]);

    // ── Auto-scroll ────────────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // ── Typing indicator ───────────────────────────────────────────────────────
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setMessageInput(val);
        if (val.endsWith('@')) setShowTaskDropdown(true);
        else if (!val.includes('@')) setShowTaskDropdown(false);
        if (!activeConvId || !myId) return;
        api.setTypingStatus(myId, activeConvId, true).catch(() => {});
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (myId && activeConvId) api.setTypingStatus(myId, activeConvId, false).catch(() => {});
        }, 2500);
    };

    // ── Open / create conversation ─────────────────────────────────────────────
    const openConversation = async (contact: any) => {
        if (!myId || !dbReady) return;
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

    // ── Send message ───────────────────────────────────────────────────────────
    /** Extract taskId from @[Task:id|title] syntax */
    const extractTaggedTaskId = (text: string): string | null => {
        const match = text.match(/@\[Task:([^|]+)\|/);
        return match ? match[1] : null;
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!activeConvId || !myId || isSending) return;

        // Image send
        if (imagePreview) {
            try {
                setIsSending(true);
                setIsUploading(true);
                console.log('[Chat] Uploading image...');
                const { url } = await api.uploadChatMedia(imagePreview.file);
                console.log('[Chat] Image uploaded:', url);
                const taggedTaskId = extractTaggedTaskId(messageInput);
                await api.sendMessage({
                    conversationId: activeConvId,
                    senderId: myId,
                    type: 'image',
                    mediaUrl: url,
                    content: messageInput.trim() || undefined,
                    taskRef: taggedTaskId ? { taskId: taggedTaskId } : undefined,
                });
                setImagePreview(null);
                setMessageInput('');
            } catch (err: any) {
                console.error('[Chat] Image send failed:', err.message);
            } finally {
                setIsSending(false);
                setIsUploading(false);
            }
            return;
        }

        const text = messageInput.trim();
        if (!text) return;

        const taggedTaskId = extractTaggedTaskId(text);
        try {
            setIsSending(true);
            setMessageInput('');
            console.log('[Chat] Sending message, taskRef:', taggedTaskId);
            await api.sendMessage({
                conversationId: activeConvId,
                senderId: myId,
                content: text,
                type: 'text',
                taskRef: taggedTaskId ? { taskId: taggedTaskId } : undefined,
            });
            if (myId && activeConvId) api.setTypingStatus(myId, activeConvId, false).catch(() => {});
        } catch (err: any) {
            setMessageInput(text);
            console.error('[Chat] Send failed:', err.message);
        } finally {
            setIsSending(false);
        }
    };

    // ── Image file picker ──────────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
            console.warn('[Chat] File type rejected:', file.type);
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            console.warn('[Chat] File too large:', file.size);
            return;
        }
        const url = URL.createObjectURL(file);
        setImagePreview({ file, url });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Task tagging ───────────────────────────────────────────────────────────
    const insertTaskTag = (task: any) => {
        const beforeAt = messageInput.slice(0, messageInput.lastIndexOf('@'));
        setMessageInput(`${beforeAt}@[Task:${task.id}|${task.title}] `);
        setShowTaskDropdown(false);
        inputRef.current?.focus();
    };

    // ── Unified contact list ───────────────────────────────────────────────────
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
            const aAdmin = String(a.contact.roleId || '').toUpperCase() === 'ADMIN';
            const bAdmin = String(b.contact.roleId || '').toUpperCase() === 'ADMIN';
            if (aAdmin && !bAdmin) return -1;
            if (!aAdmin && bAdmin) return 1;
            const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bTime - aTime;
        });

    // ── Render message content (task tags are clickable) ───────────────────────
    const renderContent = (msg: Message) => {
        if (msg.type === 'image' && msg.mediaUrl) {
            return (
                <div className="msg-img-wrapper" onClick={() => setExpandedImage(msg.mediaUrl!)}>
                    <img src={msg.mediaUrl} alt="Shared image" className="msg-img" />
                    {msg.content && <p className="msg-caption">{msg.content}</p>}
                </div>
            );
        }
        // Parse @[Task:id|title] tags into clickable chips
        const taskTagRegex = /@\[Task:([^|]+)\|([^\]]+)\]/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;
        const content = msg.content || '';
        while ((match = taskTagRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                parts.push(<span key={`txt-${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>);
            }
            const taskId = match[1];
            const taskTitle = match[2];
            parts.push(
                <span
                    key={`task-${match.index}`}
                    className="task-tag"
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/tasks/${taskId}`)}
                    title={`Open task: ${taskTitle}`}
                >
                    <AtSign size={10} /> {taskTitle}
                </span>
            );
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < content.length) {
            parts.push(<span key={`end-${lastIndex}`}>{content.slice(lastIndex)}</span>);
        }
        if (parts.length === 0) return <span>{content}</span>;
        return <>{parts}</>;
    };

    // ── Status tick ────────────────────────────────────────────────────────────
    const StatusTick = ({ status }: { status: string }) => {
        if (status === 'seen') return <CheckCheck size={13} className="tick-seen" />;
        if (status === 'delivered') return <CheckCheck size={13} className="tick-delivered" />;
        return <Check size={13} className="tick-sent" />;
    };

    // ── Loading state ──────────────────────────────────────────────────────────
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>
                            <strong>Database issue detected:</strong>&nbsp;
                            The messaging tables cannot be accessed.
                        </span>
                        {dbProbeError && (
                            <code style={{ background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                Details: {dbProbeError}
                            </code>
                        )}
                        <span style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>
                            Run the SQL migration script and ensure Row Level Security is disabled.
                        </span>
                    </div>
                </div>
            )}

            <div className="msg-layout">
                {/* ── LEFT PANEL ── */}
                <aside className="msg-sidebar">
                    <div className="msg-sidebar-search">
                        <Search size={16} className="msg-search-icon" />
                        <input
                            className="msg-search-input"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="msg-conv-list">
                        {loading && (
                            <div className="msg-list-loading">
                                {[1, 2, 3, 4].map(i => <div key={i} className="msg-skeleton" />)}
                            </div>
                        )}

                        {!loading && unifiedList.length === 0 && (
                            <div className="msg-empty-note">No team members found.</div>
                        )}

                        {!loading && unifiedList.map(({ contact, conversationId, lastMessage, unreadCount }) => {
                            const isActive = conversationId === activeConvId;
                            const isAdminUser = String(contact.roleId || '').toUpperCase() === 'ADMIN';
                            const isOnline = !!onlineUsers[String(contact.id)];

                            return (
                                <div
                                    key={contact.id}
                                    className={`msg-conv-item ${isActive ? 'active' : ''} ${isAdminUser ? 'admin-pinned' : ''}`}
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
                                        {isOnline && <div className="msg-online-dot" />}
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
                                    {onlineUsers[String(activeOtherUser?.id)] && (
                                        <div className="msg-online-dot" />
                                    )}
                                </div>
                                <div className="msg-chat-header-info">
                                    <div className="msg-chat-header-name">
                                        {activeOtherUser?.firstName} {activeOtherUser?.lastName}
                                    </div>
                                    <div className="msg-chat-header-sub">
                                        {onlineUsers[String(activeOtherUser?.id)] ? (
                                            <span style={{ color: '#10B981' }}>Online</span>
                                        ) : (
                                            <span style={{ color: 'var(--text-secondary)' }}>Offline</span>
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
                                                    {(msg.senderPhoto || activeOtherUser?.profilePhoto) ? (
                                                        <img src={msg.senderPhoto || activeOtherUser.profilePhoto} alt="" />
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

                            {/* Task @ dropdown */}
                            {showTaskDropdown && (
                                <div className="msg-task-dropdown">
                                    <div className="msg-task-dropdown-header">📌 Tag a Task</div>
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
                                        placeholder={imagePreview ? 'Add a caption...' : 'Type a message... (@task)'}
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

            {/* Lightbox */}
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
