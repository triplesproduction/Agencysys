'use client';

import { PageHeader } from '@/components/common/PageHeader';
import Button from '@/components/Button';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Send, Image as ImageIcon, X, Check, CheckCheck, MessageSquare, MessageCircle, FileText, Users, AtSign, ChevronDown } from 'lucide-react';
import { getResolvedRole } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations, useMessages } from '@/hooks/useMessaging';
import { messagingKeys } from '@/hooks/messagingKeys';

// --- Secure Image Component for Chat Media ---
const SecureChatImage = ({ path, alt, className, onClick }: { path: string, alt?: string, className?: string, onClick?: (url: string) => void }) => {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let mounted = true;
        if (!path) return;
        if (path.startsWith('http') || path.startsWith('blob:')) {
            setSignedUrl(path);
            return;
        }
        api.getSignedChatMediaUrl(path).then(url => {
            if (mounted) setSignedUrl(url);
        }).catch(() => {
            if (mounted) setError(true);
        });
        return () => { mounted = false; };
    }, [path]);

    if (error) return <div className="msg-img-error">Failed to load secure image</div>;
    if (!signedUrl) return <div className="msg-img-loader spinner"></div>;

    return (
        <img 
            src={signedUrl} 
            alt={alt || "Shared image"} 
            className={className} 
            onClick={() => onClick && onClick(signedUrl)} 
            style={{ cursor: onClick ? 'pointer' : 'default' }}
        />
    );
};
// ------------------------------------------

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
    type: 'text' | 'image' | 'pdf';
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

    const queryClient = useQueryClient();

    // ── State ──────────────────────────────────────────────────────────────────
    const [allContacts, setAllContacts] = useState<any[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [activeOtherUser, setActiveOtherUser] = useState<any>(null);
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
    const [lastSeenMap, setLastSeenMap] = useState<Record<string, string>>({});
    
    // React Query hooks for conversations and messages
    const { data: conversationsData } = useConversations(myId || undefined, myRole);
    const conversations = conversationsData || [];

    const { data: messagesData, isLoading: isMessagesQueryLoading } = useMessages(activeConvId || undefined);
    const messages = messagesData || [];

    // Eliminate full messages block spinner unless we have zero cache data
    const messagesLoading = activeConvId ? (isMessagesQueryLoading && !messagesData) : false;

    // Helper to update the conversation sidebar list in cache optimistically
    const updateConversationInCache = useCallback((newMsg: any, isOutgoing: boolean) => {
        if (!myId) return;
        queryClient.setQueryData(messagingKeys.conversations(myId), (oldConvs: any[] | undefined) => {
            if (!oldConvs) return oldConvs;
            
            const idx = oldConvs.findIndex(c => c.conversationId === newMsg.conversation_id || c.conversationId === newMsg.conversationId);
            
            if (idx === -1) {
                // Not found, invalidate to let React Query fetch the new conversation list
                queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(myId) });
                return oldConvs;
            }
            
            const updated = [...oldConvs];
            const currentConv = updated[idx];
            
            updated[idx] = {
                ...currentConv,
                lastMessage: {
                    id: newMsg.id,
                    content: newMsg.content,
                    type: newMsg.type,
                    createdAt: newMsg.created_at || newMsg.createdAt,
                    senderId: newMsg.sender_id || newMsg.senderId,
                },
                unreadCount: isOutgoing 
                    ? currentConv.unreadCount 
                    : (activeConvIdRef.current === currentConv.conversationId ? currentConv.unreadCount : currentConv.unreadCount + 1)
            };
            
            // Re-sort
            return updated.sort((a, b) => {
                const aIsAdmin = String(a.otherUser?.roleId || '').toUpperCase() === 'ADMIN';
                const bIsAdmin = String(b.otherUser?.roleId || '').toUpperCase() === 'ADMIN';
                if (aIsAdmin && !bIsAdmin) return -1;
                if (!aIsAdmin && bIsAdmin) return 1;
                const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
                const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
                return bTime - aTime;
            });
        });
    }, [myId, queryClient]);

    // DEBUG MODE TRACES
    const [renderError, setRenderError] = useState<string | null>(null);
    useEffect(() => {
        logger.log('[Chat-Trace] activeConvId =', activeConvId);
        logger.log('[Chat-Trace] messages loaded =', messages.length);
        
        // Inspect DOM
        setTimeout(() => {
            const mainEl = document.querySelector('.msg-main');
            if (mainEl) {
                const style = window.getComputedStyle(mainEl);
                logger.log('[Chat-Trace] .msg-main exists:', !!mainEl);
                logger.log('[Chat-Trace] .msg-main display:', style.display);
                logger.log('[Chat-Trace] .msg-main visibility:', style.visibility);
                logger.log('[Chat-Trace] .msg-main width/height:', style.width, style.height);
            } else {
                logger.log('[Chat-Trace] .msg-main missing from DOM');
            }
        }, 500);
    }, [activeConvId, messages.length]);

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
            logger.log('[Chat] Invalidate/refetch conversations...');
            await queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(myId) });
            setDbReady(true);
        } catch (e: any) {
            logger.error('Error', '[Chat] loadConversations error:', e);
            if (e?.message?.includes('schema cache') || e?.message?.includes('does not exist')) {
                setDbReady(false);
            }
        }
    }, [myId, myRole, queryClient]);

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
                    logger.warn('Error', '[Chat] conversations table not ready:', probe.message);
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
                    api.getTasks(undefined, undefined, 50),
                ]);
                const empArr = Array.isArray(empRes) ? empRes : (empRes as any)?.data || [];
                setAllContacts(empArr.filter((e: any) => String(e.id) !== myId));
                setMyTasks(tasks || []);

                // ✅ Fix 5: Load conversations first; realtime subscription starts after
                await loadConversations();
            } catch (e) {
                logger.error('Error', '[Chat] init error:', e);
                // Reset guard so navigating back can retry
                initDoneRef.current = false;
            } finally {
                setLoading(false);
            }
        };
        init();

        // ✅ Cleanup ref for React 18 Strict Mode remounts
        return () => {
            initDoneRef.current = false;
        };
    // ✅ Fix 2: Remove authEmployee from dependencies since myId is sufficient and stable
    }, [authLoading, myId]);

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
                    logger.log('[Chat] Global realtime INSERT:', newMsg);
                    if (String(newMsg.sender_id) === myId) return;
                    // If user is already viewing this conversation, skip (handled locally)
                    if (newMsg.conversation_id === activeConvIdRef.current) return;
                    
                    // In-place cache injection for sidebar list update
                    updateConversationInCache(newMsg, false);
                    
                    addNotification({
                        title: 'New Message',
                        message: newMsg.content || '📷 Image',
                        type: 'REMINDER',
                    });
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(globalChannel); };
    }, [myId, updateConversationInCache]);

    // ── Keep activeConvIdRef in sync and mark messages as read on switch ────────
    useEffect(() => {
        activeConvIdRef.current = activeConvId;
        if (!activeConvId || !myId) return;

        // Reset local unread badge instantly in cache
        queryClient.setQueryData(messagingKeys.conversations(myId), (oldConvs: any[] | undefined) => {
            if (!oldConvs) return oldConvs;
            return oldConvs.map(c => c.conversationId === activeConvId ? { ...c, unreadCount: 0 } : c);
        });

        // Sync read status on server and refresh conversations
        api.markMessagesRead(activeConvId, myId)
            .then(() => {
                queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(myId) });
            })
            .catch(() => {});
    }, [activeConvId, myId, queryClient]);

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
                    logger.log('[Chat] Realtime INSERT in active conv:', newMsg);
                    const mappedMsg: Message = {
                        ...newMsg,
                        senderId: newMsg.sender_id,
                        conversationId: newMsg.conversation_id,
                        createdAt: newMsg.created_at,
                        mediaUrl: newMsg.media_url,
                        taskRef: newMsg.task_ref,
                    };
                    
                    // Direct cache injection for messages
                    queryClient.setQueryData(messagingKeys.messages(activeConvId), (oldMsgs: any[] | undefined) => {
                        const prev = oldMsgs || [];
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

                    // Direct cache update for conversation sidebar (prevents 5 HTTP requests)
                    updateConversationInCache(newMsg, String(mappedMsg.senderId) === myId);
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
                    queryClient.setQueryData(messagingKeys.messages(activeConvId), (oldMsgs: any[] | undefined) => {
                        const prev = oldMsgs || [];
                        return prev.map((m: any) => (m.id === updated.id ? { ...m, status: updated.status } : m));
                    });
                }
            )
            .subscribe();

        realtimeRef.current = channel;
        return () => { supabase.removeChannel(channel); };
    }, [activeConvId, myId, activeOtherUser, updateConversationInCache, queryClient]);

    // ── Auto-scroll ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (messagesEndRef.current && messagesEndRef.current.parentElement) {
            const parent = messagesEndRef.current.parentElement;
            parent.scrollTo({ top: parent.scrollHeight, behavior: 'smooth' });
        }
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
            queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(myId) });
        } catch (err: any) {
            logger.error('Error', '[Chat] openConversation failed:', err.message);
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

        // Image/PDF send (with instant optimistic preview rendering)
        if (imagePreview) {
            const imgFile = imagePreview.file;
            const isPdf = imgFile.type === 'application/pdf';
            const mediaType = isPdf ? 'pdf' : 'image';
            
            const optimisticId = `optimistic-${Date.now()}`;
            const optimisticMsg: Message = {
                id: optimisticId,
                conversationId: activeConvId,
                senderId: myId,
                type: mediaType,
                mediaUrl: imagePreview.url, // Local Object URL (blob:)
                content: messageInput.trim() || undefined,
                status: 'sent',
                createdAt: new Date().toISOString(),
                taskRef: extractTaggedTaskId(messageInput) ? { taskId: extractTaggedTaskId(messageInput) } : undefined,
            };

            // Push optimistic image message
            queryClient.setQueryData(messagingKeys.messages(activeConvId), (oldMsgs: any[] | undefined) => {
                const prev = oldMsgs || [];
                return [...prev, optimisticMsg];
            });

            const textInput = messageInput;
            setImagePreview(null);
            setMessageInput('');

            try {
                setIsSending(true);
                setIsUploading(true);
                logger.log(`[Chat] Uploading ${mediaType}...`);
                const { url } = await api.uploadChatMedia(imgFile, activeConvId);
                logger.log(`[Chat] ${mediaType} uploaded:`, url);
                const taggedTaskId = extractTaggedTaskId(textInput);
                const sent = await api.sendMessage({
                    conversationId: activeConvId,
                    senderId: myId,
                    type: mediaType,
                    mediaUrl: url,
                    content: textInput.trim() || undefined,
                    taskRef: taggedTaskId ? { taskId: taggedTaskId } : undefined,
                });
                
                // Swap placeholder with real DB record
                if (sent) {
                    queryClient.setQueryData(messagingKeys.messages(activeConvId), (oldMsgs: any[] | undefined) => {
                        const prev = oldMsgs || [];
                        return prev.map((m: any) => (m.id === optimisticId ? (sent as Message) : m));
                    });
                    
                    updateConversationInCache(sent, true);
                }
            } catch (err: any) {
                // Rollback optimistic image message
                queryClient.setQueryData(messagingKeys.messages(activeConvId), (oldMsgs: any[] | undefined) => {
                    const prev = oldMsgs || [];
                    return prev.filter((m: any) => m.id !== optimisticId);
                });
                setImagePreview({ file: imgFile, url: optimisticMsg.mediaUrl! });
                setMessageInput(textInput);
                logger.error('Error', `[Chat] ${mediaType} send failed:`, err.message);
            } finally {
                setIsSending(false);
                setIsUploading(false);
            }
            return;
        }

        const text = messageInput.trim();
        if (!text) return;

        const taggedTaskId = extractTaggedTaskId(text);

        // Optimistic update: show own message immediately, no realtime dependency
        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticMsg: Message = {
            id: optimisticId,
            conversationId: activeConvId,
            senderId: myId,
            content: text,
            type: 'text',
            status: 'sent',
            createdAt: new Date().toISOString(),
            taskRef: taggedTaskId ? { taskId: taggedTaskId } : undefined,
        };

        queryClient.setQueryData(messagingKeys.messages(activeConvId), (oldMsgs: any[] | undefined) => {
            const prev = oldMsgs || [];
            return [...prev, optimisticMsg];
        });
        
        setMessageInput('');

        try {
            setIsSending(true);
            logger.log('[Chat] Sending message, taskRef:', taggedTaskId);
            const sent = await api.sendMessage({
                conversationId: activeConvId,
                senderId: myId,
                content: text,
                type: 'text',
                taskRef: taggedTaskId ? { taskId: taggedTaskId } : undefined,
            });
            // Swap placeholder with real DB record (correct id, createdAt, status)
            if (sent) {
                queryClient.setQueryData(messagingKeys.messages(activeConvId), (oldMsgs: any[] | undefined) => {
                    const prev = oldMsgs || [];
                    return prev.map((m: any) => (m.id === optimisticId ? (sent as Message) : m));
                });
                
                updateConversationInCache(sent, true);
            }
            if (myId && activeConvId) api.setTypingStatus(myId, activeConvId, false).catch(() => {});
        } catch (err: any) {
            // Roll back on failure
            queryClient.setQueryData(messagingKeys.messages(activeConvId), (oldMsgs: any[] | undefined) => {
                const prev = oldMsgs || [];
                return prev.filter((m: any) => m.id !== optimisticId);
            });
            setMessageInput(text);
            logger.error('Error', '[Chat] Send failed:', err.message);
        } finally {
            setIsSending(false);
        }
    };

    // ── Image file picker ──────────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.type)) {
            logger.warn('System', '[Chat] File type rejected:', file.type);
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            logger.warn('System', '[Chat] File too large:', file.size);
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
                <div className="msg-img-wrapper">
                    <SecureChatImage 
                        path={msg.mediaUrl} 
                        className="msg-img"
                        onClick={(url) => setExpandedImage(url)}
                    />
                    {msg.content && <p className="msg-caption">{msg.content}</p>}
                </div>
            );
        }
        if (msg.type === 'pdf' && msg.mediaUrl) {
            return (
                <div className="msg-pdf-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={24} color="#ef4444" />
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, wordBreak: 'break-all' }}>PDF Document</span>
                    </div>
                    <Button variant="secondary" size="sm" onClick={async () => {
                        const url = await api.getSignedChatMediaUrl(msg.mediaUrl!);
                        window.open(url, '_blank');
                    }} style={{ alignSelf: 'flex-start' }}>
                        View Document
                    </Button>
                    {msg.content && <p className="msg-caption" style={{ marginTop: '8px' }}>{msg.content}</p>}
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
        <div className="msg-page page-root">
            {/* Header */}
            <PageHeader
                title="Messages"
                subtitle={<p className="subtitle">Real-time collaboration with your team.</p>}
            />

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
                            const isActive = !!activeConvId && conversationId === activeConvId;
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
                                            {isAdminUser ? (
                                                <img src="/white-logo.png" alt="Admin" style={{ padding: '6px', objectFit: 'contain', background: 'black' }} />
                                            ) : contact.profilePhoto ? (
                                                <img src={contact.profilePhoto} alt={contact.firstName} />
                                            ) : (
                                                contact.firstName?.charAt(0).toUpperCase() || '?'
                                            )}
                                        </div>
                                        {isOnline && <div className="msg-online-dot" />}
                                    </div>

                                    <div className="msg-conv-info">
                                        <div className="msg-conv-name-row">
                                            <span className="msg-conv-name">
                                                {contact.firstName} {contact.lastName}
                                            </span>
                                            {isAdminUser && (
                                                <span className="msg-admin-badge">ADMIN</span>
                                            )}
                                        </div>
                                        <div className="msg-conv-role">{contact.designation || contact.roleId || 'Staff'}</div>
                                        <div className="msg-conv-snippet">
                                            {lastMessage
                                                ? lastMessage.type === 'image'
                                                    ? '📷 Image'
                                                    : lastMessage.content
                                                : <span className="msg-no-conv-hint">Tap to start chat</span>}
                                        </div>
                                    </div>
                                    <div className="msg-conv-meta">
                                        {lastMessage && (
                                            <span className="msg-conv-time">
                                                {formatTime(lastMessage.createdAt)}
                                            </span>
                                        )}
                                        {unreadCount > 0 && (
                                            <span className="msg-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                                        )}
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
                                <div className="msg-header-avatar">
                                    {String(activeOtherUser?.roleId || '').toUpperCase() === 'ADMIN' ? (
                                        <img src="/white-logo.png" alt="Admin" style={{ padding: '6px', objectFit: 'contain', background: 'black' }} />
                                    ) : activeOtherUser?.profilePhoto ? (
                                        <img src={activeOtherUser.profilePhoto} alt={activeOtherUser?.firstName} />
                                    ) : (
                                        activeOtherUser?.firstName?.charAt(0).toUpperCase() || '?'
                                    )}
                                    <div className={onlineUsers[String(activeOtherUser?.id)] ? "msg-header-online-dot" : "msg-header-offline-dot"} />
                                </div>
                                <div className="msg-chat-header-info">
                                    <div className="msg-chat-header-name">
                                        {activeOtherUser?.firstName} {activeOtherUser?.lastName}
                                    </div>
                                    <div className="msg-chat-header-role">
                                        {activeOtherUser?.designation || activeOtherUser?.roleId || 'Team Member'}
                                    </div>
                                    <div className="msg-chat-header-sub">
                                        {onlineUsers[String(activeOtherUser?.id)] ? 'Online' : 'Offline'}
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
                                {messagesLoading ? (
                                    <div className="msg-messages-loading">
                                        <div className="msg-spinner" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="msg-no-msgs">
                                        <p>Say hello to {activeOtherUser?.firstName} 👋</p>
                                    </div>
                                ) : null}

                                {(() => {
                                    try {
                                        logger.log('[Chat-Trace] rendering chat panel');
                                        
                                        // Validation pass
                                        messages.forEach(msg => {
                                            if (!msg.createdAt) {
                                                logger.log('[Chat-Trace] Invalid Date - Missing createdAt for msg:', msg.id);
                                            } else {
                                                const d = new Date(msg.createdAt);
                                                if (isNaN(d.getTime())) {
                                                    logger.log('[Chat-Trace] Invalid Date - isNaN for msg:', msg.id, msg.createdAt);
                                                }
                                            }
                                        });

                                        return messages.map((msg, idx) => {
                                            const prevMsg = messages[idx - 1];
                                            const nextMsg = messages[idx + 1];
                                            
                                            const isMine = String(msg.senderId) === String(myId);
                                            const isPrevSame = prevMsg && String(prevMsg.senderId) === String(msg.senderId);
                                            const isNextSame = nextMsg && String(nextMsg.senderId) === String(msg.senderId);
                                            
                                            const isSingle = !isPrevSame && !isNextSame;
                                            const isFirst = !isPrevSame && isNextSame;
                                            const isMiddle = isPrevSame && isNextSame;
                                            const isLast = isPrevSame && !isNextSame;
                                            
                                            const showAvatar = isLast || isSingle;

                                            let bubbleClass = isMine ? 'msg-bubble-sent' : 'msg-bubble-recv';
                                            if (isSingle) bubbleClass += ' msg-bubble-single';
                                            else if (isFirst) bubbleClass += ' msg-bubble-first';
                                            else if (isMiddle) bubbleClass += ' msg-bubble-middle';
                                            else if (isLast) bubbleClass += ' msg-bubble-last';

                                            return (
                                                <div key={msg.id} className={`msg-row ${isMine ? 'sent' : 'received'} ${isLast || isSingle ? 'group-end' : ''}`}>
                                                    {!isMine && (
                                                        <div className={`msg-mini-avatar ${showAvatar ? '' : 'invisible'}`}>
                                                            {String(activeOtherUser?.roleId || '').toUpperCase() === 'ADMIN' ? (
                                                                <img src="/white-logo.png" alt="Admin" style={{ padding: '4px', objectFit: 'contain', background: 'black', borderRadius: '50%' }} />
                                                            ) : (msg.senderPhoto || activeOtherUser?.profilePhoto) ? (
                                                                <img src={msg.senderPhoto || activeOtherUser.profilePhoto} alt="" />
                                                            ) : (
                                                                activeOtherUser?.firstName?.charAt(0) || '?'
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="msg-bubble-wrap">
                                                        <div className={`msg-bubble ${bubbleClass}`}>
                                                            {renderContent(msg)}
                                                        </div>
                                                        <div className={`msg-meta ${isMine ? 'msg-meta-sent' : ''} ${!showAvatar ? 'invisible' : ''}`}>
                                                            <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown'}</span>
                                                            {isMine && <StatusTick status={msg.status} />}
                                                        </div>
                                                    </div>

                                                    {isMine && (
                                                        <div className={`msg-mini-avatar ${showAvatar ? '' : 'invisible'}`}>
                                                            {String((authEmployee as any)?.roleId || '').toUpperCase() === 'ADMIN' ? (
                                                                <img src="/white-logo.png" alt="Admin" style={{ padding: '4px', objectFit: 'contain', background: 'black', borderRadius: '50%' }} />
                                                            ) : (authEmployee as any)?.profilePhoto ? (
                                                                <img src={String((authEmployee as any).profilePhoto)} alt="" />
                                                            ) : (
                                                                authEmployee?.firstName?.charAt(0) || 'M'
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    } catch (err: any) {
                                        logger.log('[Chat-Trace] Render Exception:', err.message);
                                        return <div style={{ color: 'red', padding: '20px' }}>Render Exception: {err.message}</div>;
                                    }
                                })()}

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

                            {/* Image/File Preview before send */}
                            {imagePreview && (
                                <div className="msg-img-preview-bar">
                                    <div className="msg-img-preview-thumb">
                                        {imagePreview.file.type === 'application/pdf' ? (
                                            <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                                <FileText size={20} color="#ef4444" />
                                            </div>
                                        ) : (
                                            <img src={imagePreview.url} alt="Preview" />
                                        )}
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
                                    {(() => {
                                        const filteredTasks = myTasks.filter(task => 
                                            String(task.assigneeId) === String(activeOtherUser?.id) || 
                                            (task.assigneeIds && task.assigneeIds.includes(String(activeOtherUser?.id)))
                                        );
                                        if (filteredTasks.length === 0) {
                                            return <div className="msg-empty-note">No assigned tasks found for this user.</div>;
                                        }
                                        return filteredTasks.map((task) => (
                                            <div
                                                key={task.id}
                                                className="msg-task-item"
                                                onClick={() => insertTaskTag(task)}
                                            >
                                                <span className={`task-priority-dot priority-${task.priority?.toLowerCase()}`} />
                                                <span className="msg-task-title">{task.title}</span>
                                                <span className="msg-task-status">{task.status}</span>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            )}

                            {/* Compose bar */}
                            <form className="msg-compose" onSubmit={handleSend}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/jpeg,image/jpg,image/png,application/pdf"
                                    onChange={handleFileChange}
                                />
                                <div className="msg-input-wrap">
                                    <button
                                        type="button"
                                        className="msg-attach-btn"
                                        onClick={() => fileInputRef.current?.click()}
                                        title="Send image"
                                    >
                                        <ImageIcon size={18} />
                                    </button>

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

                                    <div className="msg-composer-actions">
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

                                        <button
                                            type="submit"
                                            className="msg-send-btn"
                                            disabled={(!messageInput.trim() && !imagePreview) || isSending || isUploading}
                                        >
                                            {isSending || isUploading ? (
                                                <div className="msg-send-spinner" />
                                            ) : (
                                                <Send size={15} />
                                            )}
                                        </button>
                                    </div>
                                </div>
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
