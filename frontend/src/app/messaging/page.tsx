'use client';

import { PageHeader } from '@/components/common/PageHeader';
import Button from '@/components/Button';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Send, Image as ImageIcon, X, Check, CheckCheck, MessageSquare, MessageCircle, FileText, Users, AtSign, ChevronDown, Pin, Plus, Settings, Folder } from 'lucide-react';
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
    const [showDetailsArea, setShowDetailsArea] = useState(false);
    const [pinnedIds, setPinnedIds] = useState<string[]>([]);
    
    // Group states
    const [drawerMembers, setDrawerMembers] = useState<any[]>([]);
    const [isEditingGroupName, setIsEditingGroupName] = useState(false);
    const [editGroupName, setEditGroupName] = useState('');
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [addMemberQuery, setAddMemberQuery] = useState('');
    const [drawerLoading, setDrawerLoading] = useState(false);

    // Create Group Modal states
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [createGroupStep, setCreateGroupStep] = useState(1);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDepts, setNewGroupDepts] = useState<string[]>([]);
    const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
    const [createGroupLoading, setCreateGroupLoading] = useState(false);

    const [showNewDmModal, setShowNewDmModal] = useState(false);
    
    const uniqueDepartments = Array.from(new Set(allContacts.map(e => e.department).filter(Boolean)));
    
    useEffect(() => {
        const saved = localStorage.getItem('msg-pinned');
        if (saved) {
            try { setPinnedIds(JSON.parse(saved)); } catch (e) {}
        }
    }, []);

    const togglePin = (convId: string) => {
        setPinnedIds(prev => {
            const next = prev.includes(convId) ? prev.filter(id => id !== convId) : [...prev, convId];
            localStorage.setItem('msg-pinned', JSON.stringify(next));
            return next;
        });
    };
    
    // React Query hooks for conversations and messages
    const { data: conversationsData } = useConversations(myId || undefined, myRole);
    const conversations = conversationsData || [];

    const { data: messagesData, isLoading: isMessagesQueryLoading } = useMessages(activeConvId || undefined);
    const messages = messagesData || [];
    
    const activeConversation = conversations.find(c => c.conversationId === activeConvId);

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


    // ── Fetch Group Members ───────────────────────────────────────────────────
    useEffect(() => {
        if (!showDetailsArea || !activeConvId) return;
        const conv = conversations.find(c => c.conversationId === activeConvId);
        if (conv?.type === 'DIRECT') return;

        let isMounted = true;
        setDrawerLoading(true);

        const fetchMembers = async () => {
            try {
                const { data: parts, error: partsErr } = await supabase
                    .from('conversation_participants')
                    .select('user_id, role')
                    .eq('conversation_id', activeConvId);
                
                if (partsErr) throw partsErr;
                
                if (!parts) {
                    if (isMounted) { setDrawerMembers([]); setDrawerLoading(false); }
                    return;
                }
                
                const uids = parts.map(p => p.user_id);
                const membersWithRoles = uids.map(uid => {
                    let user = allContacts.find(c => String(c.id) === String(uid));
                    if (!user && String(uid) === String(myId)) {
                        user = authEmployee;
                    }
                    if (!user) return null;
                    return {
                        ...user,
                        convRole: parts.find(p => String(p.user_id) === String(uid))?.role || 'MEMBER'
                    };
                }).filter(Boolean);
                
                if (isMounted) {
                    setDrawerMembers(membersWithRoles);
                }
            } catch (err) {
                logger.error('Error', 'Failed to load group members');
            } finally {
                if (isMounted) setDrawerLoading(false);
            }
        };
        fetchMembers();
        
        return () => { isMounted = false; };
    }, [showDetailsArea, activeConvId, conversations, allContacts, authEmployee, myId]);

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
                    const empRes = await api.getEmployees({ limit: 100, status: 'ACTIVE' });
                    const empArr = Array.isArray(empRes) ? empRes : (empRes as any)?.data || [];
                    const filteredContacts = empArr.filter((e: any) => {
                        if (String(e.id) === myId) return false;
                        if (isAdmin) return true;
                        const isSameDept = e.department === (authEmployee as any).department;
                        const isTargetAdmin = ['ADMIN', 'MANAGER'].includes(String(e.roleId).toUpperCase());
                        return isSameDept || isTargetAdmin;
                    });
                    setAllContacts(filteredContacts);
                    return;
                }

                setDbReady(true);
                setDbProbeError(null);

                // ✅ Fix 2: All data fetches in parallel for speed
                const [empRes, tasks] = await Promise.all([
                    api.getEmployees({ limit: 100, status: 'ACTIVE' }),
                    api.getTasks(undefined, undefined, 50),
                ]);
                const empArr = Array.isArray(empRes) ? empRes : (empRes as any)?.data || [];
                const filteredContacts = empArr.filter((e: any) => {
                    if (String(e.id) === myId) return false;
                    if (isAdmin) return true;
                    // Non-admins can only see their own department OR admins/managers
                    const isSameDept = e.department === (authEmployee as any).department;
                    const isTargetAdmin = ['ADMIN', 'MANAGER'].includes(String(e.roleId).toUpperCase());
                    return isSameDept || isTargetAdmin;
                });
                setAllContacts(filteredContacts);
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
    // SECURITY: This listener receives INSERT events from the 'messages' table.
    // Full server-side filtering requires Supabase Realtime RLS to be enabled in the
    // Supabase dashboard (Database → Replication → RLS for realtime). Without it,
    // all connected clients receive every INSERT payload. Client-side filtering below
    // is an additional defence-in-depth layer but not a substitute for Realtime RLS.
    useEffect(() => {
        if (!myId) return;
        const globalChannel = supabase
            .channel('global-messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                async (payload: any) => {
                    const newMsg = payload.new;
                    // Client-side filter: ignore messages sent by the current user
                    if (String(newMsg.sender_id) === myId) return;
                    // Client-side filter: ignore events for conversations this user is not in
                    // (Supabase Realtime RLS is the server-side equivalent — must be enabled in dashboard)
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
            const finalContent = messageInput.trim() || imgFile.name;
            
            const optimisticId = `optimistic-${Date.now()}`;
            const optimisticMsg: Message = {
                id: optimisticId,
                conversationId: activeConvId,
                senderId: myId,
                type: mediaType,
                mediaUrl: imagePreview.url, // Local Object URL (blob:)
                content: finalContent,
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
                    content: finalContent,
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
                addNotification({
                    title: 'Send Error',
                    message: err.message,
                    type: 'SYSTEM'
                });
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

    // ── Unified list ───────────────────────────────────────────────────
    const filteredConvs = (() => {
        let list = conversations.filter(c => {
            if (c.status !== 'ACTIVE') return false;
            // Remove Company Announcements and Operations Group
            if (c.type === 'COMPANY') return false;
            if (c.name === 'Operations Group' || c.department === 'Operations') return false;
            
            if (c.type === 'DIRECT') {
                if (!c.otherUser || !c.otherUser.firstName) return false;
            } else {
                if (!c.name?.trim()) return false;
            }
            return true;
        });
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(c => {
                if (c.type === 'DIRECT') {
                    const name = `${c.otherUser?.firstName} ${c.otherUser?.lastName}`.toLowerCase();
                    return name.includes(q) || c.lastMessage?.content?.toLowerCase().includes(q);
                }
                const name = c.name?.toLowerCase() || '';
                const dept = c.department?.toLowerCase() || '';
                return name.includes(q) || dept.includes(q) || c.lastMessage?.content?.toLowerCase().includes(q);
            });
        }
        
        return list.sort((a, b) => {
            
            const aPinned = pinnedIds.includes(a.conversationId);
            const bPinned = pinnedIds.includes(b.conversationId);
            if (aPinned && !bPinned) return -1;
            if (bPinned && !aPinned) return 1;
            
            const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bTime - aTime;
        });
    })();

    const renderConversationItem = (conv: any) => {
        const isSelected = activeConvId === conv.conversationId;
        const isPinned = pinnedIds.includes(conv.conversationId);
        
        let title = '';
        let subtitle = '';
        let avatar = null;
        let showOnline = false;
        
        if (conv.type === 'COMPANY') {
            title = 'Company Announcements';
            subtitle = conv.lastMessage?.content || 'No messages yet';
            avatar = <div className="msg-avatar msg-avatar-company">📢</div>;
        } else if (conv.type === 'DEPARTMENT') {
            title = conv.name || `${conv.department} Group`;
            subtitle = conv.lastMessage?.content || 'No messages yet';
            avatar = <div className="msg-avatar msg-avatar-dept">🏢</div>;
        } else if (conv.type === 'PROJECT') {
            title = conv.name || 'Project Group';
            subtitle = conv.lastMessage?.content || 'No messages yet';
            avatar = <div className="msg-avatar msg-avatar-project">📁</div>;
        } else {
            const contact = conv.otherUser;
            title = contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown';
            subtitle = conv.lastMessage?.content || 'No messages yet';
            showOnline = !!onlineUsers[String(contact?.id)];
            avatar = (
                <div className="msg-avatar">
                    {String(contact?.roleId || '').toUpperCase() === 'ADMIN' ? (
                        <img src="/white-logo.png" alt="Admin" style={{ padding: '4px', objectFit: 'contain', background: 'black' }} />
                    ) : contact?.profilePhoto ? (
                        <img src={contact.profilePhoto} alt={contact.firstName} />
                    ) : (
                        contact?.firstName?.charAt(0) || '?'
                    )}
                </div>
            );
        }

        const hasUnread = conv.unreadCount > 0;

        return (
            <div 
                key={conv.conversationId}
                className={`msg-conv-item ${isSelected ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}`}
                onClick={() => {
                    setActiveConvId(conv.conversationId);
                    if (conv.type === 'DIRECT') setActiveOtherUser(conv.otherUser);
                    else setActiveOtherUser(null);
                    setShowDetailsArea(false);
                }}
            >
                <div style={{ position: 'relative' }}>
                    {avatar}
                    {isPinned && <div className="msg-pinned-badge" style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--bg-main)', borderRadius: '50%', padding: '2px', color: 'var(--primary-color)' }}><Pin size={10} fill="currentColor" /></div>}
                    {showOnline && <div className="msg-online-dot" style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', background: 'var(--success-color)', borderRadius: '50%', border: '2px solid var(--bg-main)' }} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                    <div className="msg-conv-name-row">
                        <span className="msg-conv-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: hasUnread ? 800 : 700, color: hasUnread ? '#ffffff' : 'var(--text-primary)' }}>{title}</span>
                    </div>
                    <div className="msg-conv-snippet" style={{ color: hasUnread ? '#ffffff' : 'var(--text-secondary)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: hasUnread ? 600 : 400, opacity: hasUnread ? 1 : 0.85 }}>
                        {subtitle}
                    </div>
                </div>
                <div className="msg-conv-meta">
                    {conv.lastMessage && (
                        <span className="msg-conv-time" style={{ fontSize: '0.75rem', color: hasUnread ? 'var(--purple-accent)' : 'var(--text-secondary)', fontWeight: hasUnread ? 600 : 400 }}>{formatTime(conv.lastMessage.createdAt)}</span>
                    )}
                    {hasUnread && (
                        <div className="msg-unread-badge">
                            {conv.unreadCount}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ── Image file picker ──────────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // ── MIME type allowlist ────────────────────────────────────────────────
        const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            logger.warn('System', '[Chat] File type rejected (MIME):', file.type);
            return;
        }

        // ── File extension allowlist ───────────────────────────────────────────
        // Cross-check the extension against the MIME type — MIME is client-declared
        // and spoofable, while the filename extension provides an independent signal.
        const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
        const fileName = file.name.toLowerCase();
        const hasAllowedExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
        if (!hasAllowedExtension) {
            logger.warn('System', '[Chat] File type rejected (extension):', file.name);
            return;
        }

        // ── File size limit (5 MB) ─────────────────────────────────────────────
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

    // Helper to render message text, parsing both Task tags and URL links into clickable anchors
    const renderMessageTextWithLinks = (text: string) => {
        if (!text) return '';
        const taskTagRegex = /@\[Task:([^|]+)\|([^\]]+)\]/g;
        const urlRegex = /(https?:\/\/[^\s]+)/gi;

        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        // Parse URLs inside a plain text block
        const parsePlainUrls = (plainText: string, baseKey: string) => {
            const subParts: React.ReactNode[] = [];
            let subLastIndex = 0;
            let urlMatch;
            
            while ((urlMatch = urlRegex.exec(plainText)) !== null) {
                if (urlMatch.index > subLastIndex) {
                    subParts.push(<span key={`${baseKey}-txt-${subLastIndex}`}>{plainText.slice(subLastIndex, urlMatch.index)}</span>);
                }
                const url = urlMatch[0];
                subParts.push(
                    <a
                        key={`${baseKey}-url-${urlMatch.index}`}
                        href={url.startsWith('http') ? url : `https://${url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#38bdf8', textDecoration: 'underline', cursor: 'pointer', wordBreak: 'break-all' }}
                    >
                        {url}
                    </a>
                );
                subLastIndex = urlMatch.index + url.length;
            }
            if (subLastIndex < plainText.length) {
                subParts.push(<span key={`${baseKey}-txt-end`}>{plainText.slice(subLastIndex)}</span>);
            }
            return subParts.length > 0 ? subParts : plainText;
        };

        while ((match = taskTagRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                const plainTextChunk = text.slice(lastIndex, match.index);
                const parsed = parsePlainUrls(plainTextChunk, `chunk-${lastIndex}`);
                if (Array.isArray(parsed)) {
                    parts.push(...parsed);
                } else {
                    parts.push(<span key={`txt-${lastIndex}`}>{parsed}</span>);
                }
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

        if (lastIndex < text.length) {
            const plainTextChunk = text.slice(lastIndex);
            const parsed = parsePlainUrls(plainTextChunk, `end-${lastIndex}`);
            if (Array.isArray(parsed)) {
                parts.push(...parsed);
            } else {
                parts.push(<span key={`end-${lastIndex}`}>{parsed}</span>);
            }
        }

        if (parts.length === 0) return <span>{text}</span>;
        return <>{parts}</>;
    };

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
                    {msg.content && <p className="msg-caption">{renderMessageTextWithLinks(msg.content)}</p>}
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
                    {msg.content && <p className="msg-caption" style={{ marginTop: '8px' }}>{renderMessageTextWithLinks(msg.content)}</p>}
                </div>
            );
        }
        return renderMessageTextWithLinks(msg.content || '');
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
                    <div className="msg-sidebar-header">
                        <h2 className="msg-sidebar-title">Chats</h2>
                        <div className="msg-sidebar-actions">
                            <button className="msg-action-icon" onClick={() => setShowNewDmModal(true)} title="New Chat">
                                <MessageSquare size={16} />
                            </button>
                            {isAdmin && (
                                <button className="msg-action-icon" onClick={() => { setShowCreateGroupModal(true); setCreateGroupStep(1); }} title="Create Group">
                                    <Users size={16} />
                                </button>
                            )}
                        </div>
                    </div>
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

                        {!loading && filteredConvs.length === 0 && (
                            <div className="msg-empty-note">No active conversations found.</div>
                        )}

                        {!loading && (
                            <>
                                {filteredConvs.map(conv => renderConversationItem(conv))}
                            </>
                        )}
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
                                <div className="msg-chat-header-profile" onClick={() => setShowDetailsArea(prev => !prev)} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}>
                                    <div className="msg-header-avatar">
                                        {activeConversation?.type === 'DIRECT' ? (
                                            String(activeOtherUser?.roleId || '').toUpperCase() === 'ADMIN' ? (
                                                <img src="/white-logo.png" alt="Admin" style={{ padding: '6px', objectFit: 'contain', background: 'black' }} />
                                            ) : activeOtherUser?.profilePhoto ? (
                                                <img src={activeOtherUser.profilePhoto} alt={activeOtherUser?.firstName} />
                                            ) : (
                                                activeOtherUser?.firstName?.charAt(0).toUpperCase() || '?'
                                            )
                                        ) : (
                                            <div className="msg-group-avatar" style={{ width: '100%', height: '100%', border: 'none', borderRadius: 0 }}>
                                                {activeConversation?.type === 'COMPANY' ? '📢' : activeConversation?.type === 'DEPARTMENT' ? '🏢' : '📁'}
                                            </div>
                                        )}
                                        {activeConversation?.type === 'DIRECT' && (
                                            <div className={onlineUsers[String(activeOtherUser?.id)] ? "msg-header-online-dot" : "msg-header-offline-dot"} />
                                        )}
                                    </div>
                                    <div className="msg-chat-header-info">
                                        <div className="msg-chat-header-name">
                                            {activeConversation?.type === 'DIRECT' 
                                                ? `${activeOtherUser?.firstName} ${activeOtherUser?.lastName}` 
                                                : (activeConversation?.name || (activeConversation?.type === 'COMPANY' ? 'Company Announcements' : `${activeConversation?.department} Group`))}
                                        </div>
                                        {activeConversation?.type === 'DIRECT' && (
                                            <>
                                                <div className="msg-chat-header-role">
                                                    {activeOtherUser?.designation || activeOtherUser?.roleId || 'Team Member'}
                                                </div>
                                                <div className="msg-chat-header-sub">
                                                    {onlineUsers[String(activeOtherUser?.id)] ? 'Online' : 'Offline'}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                


                                <button 
                                    className="msg-settings-btn"
                                    title={pinnedIds.includes(activeConvId!) ? "Unpin chat" : "Pin chat"}
                                    onClick={() => togglePin(activeConvId!)}
                                >
                                    <Pin size={18} fill={pinnedIds.includes(activeConvId!) ? "currentColor" : "none"} />
                                </button>

                                <button
                                    className="msg-close-btn"
                                    onClick={() => { setActiveConvId(null); setActiveOtherUser(null); setShowDetailsArea(false); }}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {showDetailsArea ? (
                                <div className="msg-details-area-inline" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', background: 'var(--bg-main)' }}>
                                    <div style={{ maxWidth: '500px', width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div className="msg-group-avatar" style={{ width: 120, height: 120, margin: '0 auto 16px', fontSize: '3rem', borderRadius: activeConversation?.type === 'DIRECT' ? '50%' : '20px' }}>
                                                {activeConversation?.type === 'DIRECT' ? (
                                                    String(activeOtherUser?.roleId || '').toUpperCase() === 'ADMIN' ? (
                                                        <img src="/white-logo.png" alt="Admin" style={{ width: '100%', height: '100%', padding: '16px', objectFit: 'contain', background: 'black', borderRadius: '50%' }} />
                                                    ) : activeOtherUser?.profilePhoto ? (
                                                        <img src={activeOtherUser.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                                    ) : (
                                                        activeOtherUser?.firstName?.charAt(0).toUpperCase() || '?'
                                                    )
                                                ) : (
                                                    activeConversation?.type === 'COMPANY' ? '📢' : activeConversation?.type === 'DEPARTMENT' ? '🏢' : '📁'
                                                )}
                                            </div>
                                            <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem', color: 'var(--text-primary)' }}>
                                                {activeConversation?.type === 'DIRECT' 
                                                    ? `${activeOtherUser?.firstName} ${activeOtherUser?.lastName}` 
                                                    : (activeConversation?.name || (activeConversation?.type === 'COMPANY' ? 'Company Announcements' : `${activeConversation?.department} Group`))}
                                            </h2>
                                            <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                                                {activeConversation?.type === 'DIRECT' 
                                                    ? (activeOtherUser?.designation || activeOtherUser?.roleId || 'Team Member') 
                                                    : null}
                                            </div>
                                        </div>

                                        {activeConversation?.type === 'DIRECT' && (
                                            <div style={{ background: 'var(--bg-dark)', borderRadius: '12px', padding: '20px' }}>
                                                <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Details</h3>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--text-secondary)' }}>Email</span>
                                                        <span style={{ color: 'var(--text-primary)' }}>{activeOtherUser?.email || 'N/A'}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--text-secondary)' }}>Department</span>
                                                        <span style={{ color: 'var(--text-primary)' }}>{activeOtherUser?.department || 'General'}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                                                        <span style={{ color: onlineUsers[String(activeOtherUser?.id)] ? 'var(--success-color)' : 'var(--text-secondary)' }}>
                                                            {onlineUsers[String(activeOtherUser?.id)] ? 'Online' : 'Offline'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeConversation?.type !== 'DIRECT' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
                                                {/* Edit Group Name */}
                                                <div style={{ background: 'var(--bg-dark)', borderRadius: '12px', padding: '20px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isEditingGroupName ? '16px' : '0' }}>
                                                        <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Group Settings</h3>
                                                        {!isEditingGroupName && (
                                                            <button 
                                                                onClick={() => { setEditGroupName(activeConversation?.name || ''); setIsEditingGroupName(true); }}
                                                                style={{ background: 'none', border: 'none', color: '#A78BFA', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}
                                                            >
                                                                Edit Name
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    {isEditingGroupName && (
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <input 
                                                                type="text" 
                                                                value={editGroupName}
                                                                onChange={e => setEditGroupName(e.target.value)}
                                                                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px', color: '#fff', outline: 'none' }}
                                                            />
                                                            <button 
                                                                onClick={async () => {
                                                                    if (!editGroupName.trim()) return;
                                                                    try {
                                                                        await api.updateGroupConversation(activeConvId!, { name: editGroupName });
                                                                        setIsEditingGroupName(false);
                                                                        queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(myId!) });
                                                                    } catch (err) {
                                                                        logger.error('Error', 'Failed to update group name');
                                                                    }
                                                                }}
                                                                style={{ background: '#A78BFA', color: '#111', border: 'none', padding: '0 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                                                            >
                                                                Save
                                                            </button>
                                                            <button 
                                                                onClick={() => setIsEditingGroupName(false)}
                                                                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '0 16px', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Group Members */}
                                                <div style={{ background: 'var(--bg-dark)', borderRadius: '12px', padding: '20px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                        <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                            Members ({drawerMembers.length})
                                                        </h3>
                                                        {(() => {
                                                            const amIGroupAdmin = String(myRole || '').toUpperCase() === 'ADMIN' || (activeConversation as any)?.created_by === myId || drawerMembers.some((m: any) => String(m.id) === String(myId) && m.convRole === 'ADMIN');
                                                            if (amIGroupAdmin && !isAddingMember) {
                                                                return (
                                                                    <button 
                                                                        onClick={() => setIsAddingMember(true)}
                                                                        style={{ background: 'none', border: 'none', color: '#A78BFA', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}
                                                                    >
                                                                        Add Member
                                                                    </button>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>

                                                    {/* Add Member UI */}
                                                    {isAddingMember && (
                                                        <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Search employees to add..."
                                                                    value={addMemberQuery}
                                                                    onChange={e => setAddMemberQuery(e.target.value)}
                                                                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px', color: '#fff', outline: 'none' }}
                                                                />
                                                                <button 
                                                                    onClick={() => { setIsAddingMember(false); setAddMemberQuery(''); }}
                                                                    style={{ background: 'transparent', color: '#fff', border: 'none', padding: '0 12px', cursor: 'pointer' }}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                            <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                {allContacts
                                                                    .filter(c => !drawerMembers.some(dm => dm.id === c.id))
                                                                    .filter(c => !addMemberQuery || `${c.firstName} ${c.lastName}`.toLowerCase().includes(addMemberQuery.toLowerCase()))
                                                                    .slice(0, 10)
                                                                    .map(emp => (
                                                                        <div key={emp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)' }}>
                                                                            <span style={{ fontSize: '0.85rem', color: '#fff' }}>{emp.firstName} {emp.lastName}</span>
                                                                            <button 
                                                                                onClick={async () => {
                                                                                    try {
                                                                                        await api.addGroupMembers(activeConvId!, [emp.id]);
                                                                                        setDrawerMembers(prev => [...prev, { ...emp, convRole: 'MEMBER' }]);
                                                                                        setAddMemberQuery('');
                                                                                    } catch (err) {
                                                                                        logger.error('Error', 'Failed to add member');
                                                                                    }
                                                                                }}
                                                                                style={{ background: '#A78BFA', color: '#111', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                                                            >
                                                                                Add
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                {allContacts.filter(c => !drawerMembers.some(dm => dm.id === c.id)).length === 0 && (
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '4px' }}>All employees are in this group!</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {drawerLoading ? (
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>Loading members...</div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                            {drawerMembers.map((member: any) => (
                                                                <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                        <div className="msg-header-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                                                                            {member.profilePhoto ? (
                                                                                <img src={member.profilePhoto} alt={member.firstName} />
                                                                            ) : (
                                                                                member.firstName?.charAt(0) || '?'
                                                                            )}
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                            <span style={{ color: '#fff', fontWeight: 500, fontSize: '0.95rem' }}>
                                                                                {member.firstName} {member.lastName}
                                                                                {String(member.id) === String(myId) && ' (You)'}
                                                                            </span>
                                                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                                                {member.convRole === 'ADMIN' ? 'Group Admin' : (member.designation || member.roleId)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Remove option if you're admin and it's not yourself */}
                                                                    {(() => {
                                                                        const amIGroupAdmin = String(myRole || '').toUpperCase() === 'ADMIN' || (activeConversation as any)?.created_by === myId || drawerMembers.some((m: any) => String(m.id) === String(myId) && m.convRole === 'ADMIN');
                                                                        return amIGroupAdmin && String(member.id) !== String(myId);
                                                                    })() && (
                                                                        <button 
                                                                            onClick={async () => {
                                                                                if (!confirm(`Remove ${member.firstName} from group?`)) return;
                                                                                try {
                                                                                    await api.removeGroupMember(activeConvId!, member.id);
                                                                                    setDrawerMembers(prev => prev.filter(m => m.id !== member.id));
                                                                                } catch (err) {
                                                                                    logger.error('Error', 'Failed to remove member');
                                                                                }
                                                                            }}
                                                                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer' }}
                                                                        >
                                                                            Remove
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
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

            {/* New Chat Modal */}
            {showNewDmModal && (
                <div className="msg-modal-overlay" onClick={() => setShowNewDmModal(false)}>
                    <div className="msg-modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <div className="msg-modal-header">
                            <h3 style={{ margin: 0 }}>New Chat</h3>
                            <button className="msg-modal-close" onClick={() => setShowNewDmModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="msg-modal-body" style={{ padding: 0 }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="msg-sidebar-search" style={{ margin: 0 }}>
                                    <Search size={16} className="msg-search-icon" />
                                    <input 
                                        className="msg-search-input" 
                                        placeholder="Search by name or department..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {unifiedList.map(({ contact }) => (
                                    <div 
                                        key={contact.id}
                                        className="msg-member-select-item"
                                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                                        onClick={async () => {
                                            if (!myId) return;
                                            try {
                                                const convId = await api.getOrCreateConversation(myId, String(contact.id));
                                                setActiveConvId(convId);
                                                setActiveOtherUser(contact);
                                                setShowNewDmModal(false);
                                                setSearchQuery('');
                                                queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(myId) });
                                            } catch (err) {
                                                logger.error('Error starting chat', err);
                                            }
                                        }}
                                    >
                                        <div className="msg-header-avatar" style={{ width: '40px', height: '40px' }}>
                                            {contact.profilePhoto ? (
                                                <img src={contact.profilePhoto} alt={contact.firstName} />
                                            ) : (
                                                contact.firstName?.charAt(0) || '?'
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{contact.firstName} {contact.lastName}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{contact.department || 'General'}</div>
                                        </div>
                                    </div>
                                ))}
                                {unifiedList.length === 0 && (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No contacts found</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Group Modal */}
            {showCreateGroupModal && (
                <div className="msg-modal-overlay" onClick={() => setShowCreateGroupModal(false)}>
                    <div className="msg-modal" style={{ maxWidth: '500px', width: '100%', padding: 0, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 48px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <h2 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 600, letterSpacing: '-0.02em', color: '#fff' }}>
                                {createGroupStep === 1 ? 'Create Group' : 'Add Members'}
                            </h2>
                            <button onClick={() => setShowCreateGroupModal(false)} className="msg-modal-close" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '50%', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
                            {/* Step 1: Details */}
                            {createGroupStep === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Group Logo</label>
                                        <div style={{ width: '88px', height: '88px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
                                            <Folder size={36} color="#A78BFA" />
                                            <div style={{ position: 'absolute', bottom: -4, right: -4, background: '#18181b', borderRadius: '50%', padding: '5px', border: '2px solid rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <ImageIcon size={12} color="#A78BFA" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Group Name</label>
                                        <input 
                                            type="text" 
                                            value={newGroupName}
                                            onChange={e => setNewGroupName(e.target.value)}
                                            placeholder="e.g. Website Revamp"
                                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '14px 16px', borderRadius: '10px', color: '#fff', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', width: '100%' }}
                                            onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)'}
                                            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</label>
                                        <div style={{ position: 'relative' }}>
                                            <select 
                                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '14px 16px', borderRadius: '10px', color: '#fff', fontSize: '0.95rem', outline: 'none', appearance: 'none', width: '100%', cursor: 'pointer', transition: 'border-color 0.2s' }}
                                                onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)'}
                                                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                                                onChange={(e) => {
                                                    const dept = e.target.value;
                                                    if (dept && !newGroupDepts.includes(dept)) {
                                                        setNewGroupDepts(prev => [...prev, dept]);
                                                        const matchingMembers = allContacts.filter(emp => emp.department === dept).map(emp => String(emp.id));
                                                        setNewGroupMembers(prev => Array.from(new Set([...prev, ...matchingMembers])));
                                                    }
                                                    e.target.value = "";
                                                }}
                                            >
                                                <option value="" style={{ color: 'rgba(255,255,255,0.4)' }}>-- Select Department --</option>
                                                {uniqueDepartments.map((dept: any) => (
                                                    <option key={dept} value={dept} style={{ background: '#18181b', color: '#fff' }}>{dept}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={16} color="var(--text-secondary)" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                        </div>
                                        
                                        {newGroupDepts.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                                                {newGroupDepts.map(dept => (
                                                    <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.2)', color: '#A78BFA', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 500 }}>
                                                        {dept}
                                                        <X size={14} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => setNewGroupDepts(prev => prev.filter(d => d !== dept))} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Members */}
                            {createGroupStep === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Selected: {newGroupMembers.length}</label>
                                    </div>
                                    <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '8px' }}>
                                        {allContacts.map(emp => {
                                            const isSelected = newGroupMembers.includes(String(emp.id));
                                            return (
                                                <div 
                                                    key={emp.id} 
                                                    style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', padding: '10px 12px', borderRadius: '10px', background: isSelected ? 'rgba(139, 92, 246, 0.08)' : 'transparent', border: '1px solid transparent', borderColor: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'transparent', transition: 'all 0.2s' }}
                                                    onClick={() => {
                                                        if (isSelected) setNewGroupMembers(prev => prev.filter(id => id !== String(emp.id)));
                                                        else setNewGroupMembers(prev => [...prev, String(emp.id)]);
                                                    }}
                                                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                                                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                                                >
                                                    <div style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${isSelected ? '#A78BFA' : 'rgba(255,255,255,0.2)'}`, background: isSelected ? '#A78BFA' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                                        {isSelected && <Check size={14} color="#111" strokeWidth={3} />}
                                                    </div>
                                                    <div className="msg-header-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                                                        {emp.profilePhoto ? (
                                                            <img src={emp.profilePhoto} alt={emp.firstName} />
                                                        ) : (
                                                            emp.firstName?.charAt(0) || '?'
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ color: isSelected ? '#fff' : 'var(--text-primary)', fontWeight: isSelected ? 600 : 500, fontSize: '0.95rem' }}>
                                                            {emp.firstName} {emp.lastName}
                                                        </span>
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                            {emp.designation || emp.roleId}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                            <button onClick={() => {
                                if (createGroupStep === 2) {
                                    setCreateGroupStep(1);
                                } else {
                                    setShowCreateGroupModal(false);
                                }
                            }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500, padding: '10px 16px', borderRadius: '8px', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                                {createGroupStep === 2 ? 'Back' : 'Cancel'}
                            </button>
                            
                            {createGroupStep === 1 ? (
                                <Button 
                                    onClick={() => setCreateGroupStep(2)}
                                    disabled={!newGroupName.trim() || newGroupDepts.length === 0}
                                    style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: 600 }}
                                >
                                    Next Step
                                </Button>
                            ) : (
                                <Button 
                                    onClick={async () => {
                                        if (!newGroupName.trim() || newGroupMembers.length === 0) return;
                                        if (!isAdmin) return; // Only Admin/Manager can create groups
                                        setCreateGroupLoading(true);
                                        try {
                                            // Always include the creator themselves
                                            const allMembers = Array.from(new Set([...newGroupMembers, myId!]));
                                            const convId = await api.createGroupConversation({
                                                name: newGroupName,
                                                type: 'DEPARTMENT',
                                                memberIds: allMembers,
                                                department: newGroupDepts.length === 1 ? newGroupDepts[0] : (newGroupDepts.length > 1 ? newGroupDepts.join(', ') : 'General'),
                                                myId: myId!
                                            });
                                            setShowCreateGroupModal(false);
                                            setNewGroupName('');
                                            setNewGroupDepts([]);
                                            setNewGroupMembers([]);
                                            setCreateGroupStep(1);
                                            await queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(myId!) });
                                            // Navigate to the new group conversation
                                            setActiveConvId(convId);
                                        } catch (err: any) {
                                            logger.error('Error', 'Failed to create group:', err?.message);
                                            alert(`Failed to create group: ${err?.message || 'Unknown error'}`);
                                        } finally {
                                            setCreateGroupLoading(false);
                                        }
                                    }}
                                    disabled={createGroupLoading || newGroupMembers.length === 0}
                                    style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: 600 }}
                                >
                                    {createGroupLoading ? 'Creating...' : 'Create Group'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
