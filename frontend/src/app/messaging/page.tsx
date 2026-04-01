'use client';

import { useState, useRef, useEffect } from 'react';
import GlassCard from '@/components/GlassCard';
import { Search, Send, Phone, Video, Image as ImageIcon, X, Paperclip, Check, CheckCheck, MessageSquare, MessageCircle } from 'lucide-react';
import './Messaging.css';
import { api } from '@/lib/api';
import { getUserFromToken } from '@/lib/auth';

export default function MessagingPage() {
    const [activeTab, setActiveTab] = useState<'personal' | 'admin'>('personal');
    const [isAdminState, setIsAdminState] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [selfInfo, setSelfInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Data State
    const [contacts, setContacts] = useState<any[]>([]); // Employees list
    const [myChats, setMyChats] = useState<any[]>([]);
    const [adminChats, setAdminChats] = useState<any[]>([]);
    const [activeContactId, setActiveContactId] = useState<string | null>(null);

    // Chat UI State
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Drag, Drop, & Image State
    const [isDragging, setIsDragging] = useState(false);
    const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const selfFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const _user = getUserFromToken();
        if (_user) {
            setCurrentUser(_user);
            const role = String(_user.role || _user.roleId || '').toUpperCase();
            if (role === 'ADMIN' || role === 'MANAGER') setIsAdminState(true);
        }
    }, []);

    const currentUserId = currentUser?.id || currentUser?.sub || currentUser?.employeeId;

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const user: any = getUserFromToken();
            if (!user) return;

            // Fetch list of employees (Contacts)
            const employeesRes: any = await api.getEmployees({ limit: 100 });
            const employeeArray = Array.isArray(employeesRes) ? employeesRes : (employeesRes?.data || []);
            
            const filteredContacts = employeeArray
                .filter((emp: any) => {
                    const myId = user.id || user.sub || user.employeeId;
                    return emp.id !== myId;
                })
                .sort((a: any, b: any) => {
                    const weight = (role: string) => role === 'ADMIN' ? 3 : role === 'MANAGER' ? 2 : 1;
                    return weight(b.roleId) - weight(a.roleId);
                });
            setContacts(filteredContacts);

            const myId = user.id || user.sub || user.employeeId;
            const selfRes: any = await api.getEmployeeById(myId);
            setSelfInfo(selfRes);

            const personalRes: any = await api.getMyChats();
            const chats = Array.isArray(personalRes) ? personalRes : (personalRes?.data || []);
            setMyChats(chats);
        } catch (err) {
            console.error('Failed to load messaging data:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAdminChats = async () => {
        try {
            const res: any = await api.getAdminChats();
            setAdminChats(Array.isArray(res) ? res : (res?.data || []));
        } catch (err) {
            console.error('Failed to fetch admin restricted chats:', err);
        }
    };

    useEffect(() => {
        fetchInitialData();

        const handleLiveNotification = (event: any) => {
            const notif = event.detail;
            if (notif?.type === 'CHAT_MESSAGE') {
                api.getMyChats().then((res: any) => setMyChats(Array.isArray(res) ? res : (res?.data || []))).catch(() => { });
                if (activeTab === 'admin') fetchAdminChats();
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('app:live-notification', handleLiveNotification);
        }

        const interval = setInterval(() => {
            if (activeTab === 'personal') {
                api.getMyChats().then((res: any) => setMyChats(Array.isArray(res) ? res : (res?.data || []))).catch(() => { });
            } else if (activeTab === 'admin') {
                fetchAdminChats();
            }
        }, 5000);

        return () => {
            clearInterval(interval);
            if (typeof window !== 'undefined') {
                window.removeEventListener('app:live-notification', handleLiveNotification);
            }
        };
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'admin') {
            fetchAdminChats();
        }
    }, [activeTab]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [myChats, adminChats, activeContactId]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
             // Handle drop upload logic would go here if needed
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedMessage = messageInput.trim();

        if (!trimmedMessage) return;
        if (!activeContactId || !currentUserId) {
            window.alert('Please select a contact to start chatting.');
            return;
        }

        const previousMessage = messageInput;
        setMessageInput(''); 

        try {
            await api.sendChatMessage({
                receiverId: String(activeContactId),
                content: trimmedMessage
            });

            const personalRes: any = await api.getMyChats();
            const chats = Array.isArray(personalRes) ? personalRes : (personalRes?.data || []);
            setMyChats(chats);

            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (err: any) {
            console.error('Failed to send message:', err);
            setMessageInput(previousMessage);
            window.alert(`Failed to send message: ${err.message || 'Unknown error'}`);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeContactId || !currentUserId) return;

        try {
            setIsUploading(true);
            const { url } = await api.uploadFile(file);

            await api.sendChatMessage({
                receiverId: String(activeContactId),
                content: `Sent an attachment: ${url}`
            });

            const personalRes: any = await api.getMyChats();
            const chats = Array.isArray(personalRes) ? personalRes : (personalRes?.data || []);
            setMyChats(chats);

            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err: any) {
            console.error('Upload failed:', err);
            setIsUploading(false);
            alert(`File upload failed: ${err.message || 'Unknown error'}`);
        }
    };

    const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentUserId) return;

        try {
            setIsUploading(true);
            const { url } = await api.uploadFile(file);

            await api.updateEmployee(String(currentUserId), { profilePhoto: url });

            // Refresh self data
            const updated = await api.getEmployeeById(String(currentUserId));
            setSelfInfo(updated);
            setIsUploading(false);
        } catch (err: any) {
            console.error('Profile photo upload error:', err);
            alert(`Failed to save photo: ${err.message || 'Unknown error'}`);
            setIsUploading(false);
        }
    };

    const filteredSearchContacts = contacts.filter(c => {
        const q = searchQuery.toLowerCase();
        return c.firstName.toLowerCase().includes(q) ||
            c.lastName.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q);
    });

    const activeContactInfo = contacts.find(c => c.id === activeContactId);

    const currentThreadModeMessages = myChats.filter(msg => {
        if (!currentUserId || !activeContactId) return false;
        const mSender = String(msg.senderId);
        const mReceiver = String(msg.receiverId);
        const myId = String(currentUserId);
        const partnerId = String(activeContactId);
        return (mSender === myId && mReceiver === partnerId) || (mSender === partnerId && mReceiver === myId);
    });

    const renderMessageContent = (content: string | null | undefined) => {
        if (!content) return null;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = content.split(urlRegex);

        return parts.map((part, i) => {
            if (part && part.match(urlRegex)) {
                return (
                    <a
                        key={i}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--purple-accent)', textDecoration: 'underline', wordBreak: 'break-all' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    return (
        <div className="messaging-page fade-in">
            <header className="page-header">
                <div>
                    <h1 className="greeting">Messages</h1>
                    <p className="subtitle">Collaborate with your team instantly.</p>
                </div>
            </header>

            <div className="messages-container">
                <GlassCard className="chat-list-panel fade-in slide-up" style={{ animationDelay: '0.1s' }}>
                    {selfInfo && (
                        <div className="self-profile-mini" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div
                                className="chat-avatar self-photo-wrapper"
                                style={{ position: 'relative', cursor: 'pointer', borderColor: 'var(--purple-main)', padding: 0, overflow: 'hidden' }}
                                onClick={() => selfFileInputRef.current?.click()}
                            >
                                {selfInfo.profilePhoto ? (
                                    <img src={selfInfo.profilePhoto} alt="Me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    selfInfo.firstName?.charAt(0) || '?'
                                )}
                                <div className="avatar-overlay-camera">
                                    <ImageIcon size={14} />
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={selfFileInputRef}
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={handleProfilePhotoUpload}
                            />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{selfInfo.firstName} {selfInfo.lastName}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--purple-accent)' }}>My Account • {selfInfo.roleId}</div>
                            </div>
                        </div>
                    )}

                    <div className="chat-search-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {isAdminState && (
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <button
                                    onClick={() => setActiveTab('personal')}
                                    style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-sm)', border: 'none', background: activeTab === 'personal' ? 'var(--purple-main)' : 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'var(--transition-smooth)' }}
                                >
                                    My Chats
                                </button>
                                <button
                                    onClick={() => setActiveTab('admin')}
                                    style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.5)', background: activeTab === 'admin' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', color: activeTab === 'admin' ? '#FCA5A5' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'var(--transition-smooth)' }}
                                >
                                    All Conversations
                                </button>
                            </div>
                        )}

                        <div style={{ position: 'relative' }}>
                            <Search size={18} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                className="chat-search-input hover-focus-glow"
                                placeholder={activeTab === 'admin' ? "Filter globally..." : "Search employees..."}
                                style={{ paddingLeft: '2.5rem' }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="chat-directory scroll-smooth">
                        {loading && activeTab === 'personal' ? (
                            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Loading contacts...</div>
                        ) : activeTab === 'personal' ? (
                            filteredSearchContacts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>No matches found.</div>
                            ) : (
                                filteredSearchContacts.map((contact, i) => {
                                    const thread = myChats.filter(m => {
                                        const mSender = String(m.senderId);
                                        const mReceiver = String(m.receiverId);
                                        const myId = String(currentUserId);
                                        const partnerId = String(contact.id);
                                        return (mSender === myId && mReceiver === partnerId) || (mSender === partnerId && mReceiver === myId);
                                    });
                                    const lastMessage = thread.length > 0 ? thread[thread.length - 1] : null;

                                    return (
                                        <div key={contact.id}
                                            className={`chat-item ${contact.id === activeContactId ? 'active' : ''} fade-in slide-up`}
                                            style={{ animationDelay: `${0.15 + (i * 0.05)}s` }}
                                            onClick={() => setActiveContactId(contact.id)}
                                        >
                                            <div className="chat-avatar" style={{ borderColor: contact.id === activeContactId ? 'var(--purple-accent)' : 'var(--panel-border)', padding: 0, overflow: 'hidden', background: '#111' }}>
                                                {contact.profilePhoto ? (
                                                    <img src={contact.profilePhoto} alt={contact.firstName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    contact.firstName?.charAt(0).toUpperCase() || '?'
                                                )}
                                            </div>
                                            <div className="chat-preview">
                                                <div className="chat-user-name">
                                                    {contact.firstName} {contact.lastName}
                                                </div>
                                                <div className="chat-snippet">
                                                    {lastMessage ? lastMessage.content : 'Start a conversation'}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )
                        ) : (
                            adminChats.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No system messages found.</div>
                            ) : (
                                adminChats.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase())).map((msg, i) => (
                                    <div key={msg.id} className="chat-item fade-in slide-up" style={{ borderLeft: '3px solid #EF4444' }}>
                                        <div className="chat-preview" style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#FCA5A5', marginBottom: '4px' }}>
                                                <span>{msg.sender?.firstName || 'System'} → {msg.receiver?.firstName || 'Global'}</span>
                                                <span>{new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="chat-snippet" style={{ color: 'white' }}>{msg.content}</div>
                                        </div>
                                    </div>
                                ))
                            )
                        )}
                    </div>
                </GlassCard>

                <div
                    className={`conversation-wrapper fade-in slide-up ${isDragging ? 'drag-active' : ''}`}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {isDragging && (
                        <div className="drag-overlay fade-in">
                            <ImageIcon size={48} style={{ color: 'var(--purple-main)', marginBottom: '16px' }} />
                            <h3>Drop to Upload</h3>
                        </div>
                    )}

                    <GlassCard className="conversation-panel">
                        {activeTab === 'personal' ? (
                            activeContactInfo ? (
                                <>
                                    <div className="conversation-header">
                                        <div className="chat-avatar" style={{ padding: 0, overflow: 'hidden', background: '#111' }}>
                                            {activeContactInfo.profilePhoto ? (
                                                <img src={activeContactInfo.profilePhoto} alt={activeContactInfo.firstName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                activeContactInfo.firstName.charAt(0)
                                            )}
                                        </div>
                                        <div className="conversation-meta" style={{ flex: 1 }}>
                                            <h2>{activeContactInfo.firstName} {activeContactInfo.lastName}</h2>
                                            <p>{activeContactInfo.roleId}</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)' }}>
                                            <span className="hoverable-icon" onClick={() => setActiveContactId(null)}>
                                                <X size={20} />
                                            </span>
                                        </div>
                                    </div>

                                    <div className="chat-history scroll-smooth">
                                        {currentThreadModeMessages.length === 0 ? (
                                            <div style={{ textAlign: 'center', margin: 'auto' }}>No message history.</div>
                                        ) : (
                                            currentThreadModeMessages.map((msg) => {
                                                const isMine = String(msg.senderId) === String(currentUserId);
                                                return (
                                                    <div key={msg.id} className={`message-bubble-row ${isMine ? 'sent' : 'received'}`}>
                                                        <div className="chat-avatar mini-avatar">
                                                            {isMine ? (
                                                                selfInfo?.profilePhoto ? <img src={selfInfo.profilePhoto} alt="Me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'M'
                                                            ) : (
                                                                activeContactInfo.profilePhoto ? <img src={activeContactInfo.profilePhoto} alt="Partner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'P'
                                                            )}
                                                        </div>
                                                        <div className="message-content-wrapper">
                                                            <div className="message-text">{renderMessageContent(msg.content)}</div>
                                                            <div className="message-meta">
                                                                <span>{new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    <form className="conversation-compose" onSubmit={handleSend}>
                                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                                        <button type="button" className="attach-button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                            <Paperclip size={20} />
                                        </button>
                                        <input
                                            type="text"
                                            className="compose-input"
                                            placeholder="Write a message..."
                                            value={messageInput}
                                            onChange={(e) => setMessageInput(e.target.value)}
                                        />
                                        <button type="submit" className="send-button" disabled={!messageInput.trim()}>
                                            <Send size={18} />
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div className="no-chat-selected fade-in">
                                    <MessageSquare size={64} />
                                    <h3>TripleS Messaging</h3>
                                    <p>Select a contact to start chatting.</p>
                                </div>
                            )
                        ) : (
                            <div className="chat-history scroll-smooth" style={{ padding: '20px' }}>
                                <h2 style={{ color: '#FCA5A5', textAlign: 'center' }}>Global Audit Trail</h2>
                                {adminChats.map((msg: any) => (
                                    <div key={msg.id} style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {msg.sender?.firstName || 'System'} → {msg.receiver?.firstName || 'Global'}
                                        </div>
                                        <div>{msg.content}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}
