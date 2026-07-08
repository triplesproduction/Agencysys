'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Maximize, Users, X, Lock } from 'lucide-react';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { BoardDTO } from '@/types/dto';
import { useQueryClient } from '@tanstack/react-query';
import { boardKeys } from '@/hooks/queries/domains/boards/keys';
import './BoardDetail.css';

export default function BoardDetailPage({ params }: { params: { id: string } }) {
    const queryClient = useQueryClient();
    const { employee } = useAuth();
    const employeeId = employee?.id;
    const employeeDept = employee?.department;
    const router = useRouter();
    const [board, setBoard] = useState<BoardDTO | null>(null);
    const [boardName, setBoardName] = useState('Untitled Board');
    const [isLoading, setIsLoading] = useState(true);
    const [presenceState, setPresenceState] = useState<any[]>([]);
    
    // Sharing state
    const [showShareModal, setShowShareModal] = useState(false);
    const [boardVisibility, setBoardVisibility] = useState<'team' | 'private'>('team');
    const [departmentMembers, setDepartmentMembers] = useState<any[]>([]);
    const [selectedInvitee, setSelectedInvitee] = useState('');
    const [invites, setInvites] = useState<any[]>([]);
    const [isInviting, setIsInviting] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        if (!employeeId || !params.id) return;

        const presenceChannel = supabase.channel(`presence:board:${params.id}`, {
            config: { presence: { key: employeeId.toString() } }
        });

        presenceChannel.on('presence', { event: 'sync' }, () => {
            setPresenceState(Object.values(presenceChannel.presenceState()).map(u => u[0]).filter(Boolean));
        });

        presenceChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && employee) {
                await presenceChannel.track({
                    id: employee.id,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    profilePhoto: employee.profilePhoto
                });
            }
        });

        return () => {
            supabase.removeChannel(presenceChannel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employeeId, params.id]);

    useEffect(() => {
        const fetchBoardAndShareData = async () => {
            try {
                const data = await api.getBoardById(params.id);
                setBoard(data);
                if (data?.name) {
                    setBoardName(data.name);
                }
                if (data?.visibility) {
                    setBoardVisibility(data.visibility as 'team' | 'private');
                }

                // Fetch eligible employees for the invite dropdown
                if (employee) {
                    let query = supabase
                        .from('employees')
                        .select('id, firstName, lastName, department, roleId, status')
                        .neq('status', 'INACTIVE')
                        .neq('status', 'SUSPENDED');

                    // If not an admin, restrict the fetch
                    if (employee.roleId !== 'ADMIN') {
                        let orCondition = 'roleId.in.(ADMIN,MANAGER)';
                        if (employeeDept) {
                            orCondition += `,department.eq.${employeeDept}`;
                        }
                        query = query.or(orCondition);
                    }
                    
                    const { data: members, error: memError } = await query;
                    
                    if (memError) {
                        console.error('[DEBUG] Error fetching employees:', memError);
                    } else if (members) {
                        setDepartmentMembers(members);
                    }
                }

                // Fetch existing invites
                const boardInvites = await api.getBoardInvites(params.id);
                setInvites(boardInvites);

                // Security Check: Block unauthorized access
                const isAdmin = employee?.roleId === 'ADMIN';
                if (employee && data.employeeId !== employee.id && !isAdmin) {
                    if (data.visibility === 'private') {
                        const myInvite = boardInvites.find(i => i.invitee_id === employee.id);
                        if (!myInvite || myInvite.status !== 'accepted') {
                            console.warn('[Security] Access Denied: Board is private and you have not accepted an invite.');
                            router.replace('/boards');
                            return;
                        }
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchBoardAndShareData();
    }, [params.id, employeeId, employeeDept]);

    const handleMount = (editor: any) => {
        if (!board) return;

        // Load initial state if exists
        try {
            if (board.document && Object.keys(board.document).length > 0) {
                editor.loadSnapshot(board.document);
            }
        } catch (e) {
            console.error('Failed to load board state', e);
        }

        // Setup Supabase Realtime Channel
        const channel = supabase.channel(`board:${params.id}`);

        channel.on('broadcast', { event: 'update' }, ({ payload }) => {
            // Apply incoming updates
            try {
                // Ensure we don't broadcast these incoming changes back
                editor.store.mergeRemoteChanges(() => {
                    editor.store.applyDiff(payload.changes);
                });
            } catch (e) {
                console.error('Failed to apply remote changes', e);
            }
        }).subscribe();

        // Listen for local changes and broadcast them
        editor.store.listen((update: any) => {
            if (update.source === 'user') {
                channel.send({
                    type: 'broadcast',
                    event: 'update',
                    payload: { changes: update.changes }
                });

                // Throttle / Debounce saving to the database
                saveToDB(editor.getSnapshot());
            }
        });
    };

    // Debounced Save
    const saveTimeout = useRef<NodeJS.Timeout>();
    const saveToDB = (snapshot: any) => {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => api.updateBoardDocument(params.id, snapshot).catch(console.error), 3000);
    };

    // Save Board Name
    const handleNameBlur = async () => {
        if (!board || boardName === board.name) return;
        try {
            await supabase.from('boards').update({ name: boardName, updatedAt: new Date().toISOString() }).eq('id', params.id);
            queryClient.invalidateQueries({ queryKey: boardKeys.all });
        } catch (e) {
            console.error('Failed to update board name', e);
        }
    };

    const handleVisibilityChange = async (vis: 'team' | 'private') => {
        setBoardVisibility(vis);
        try {
            await api.updateBoardVisibility(params.id, vis);
        } catch (e) {
            console.error('Failed to update visibility', e);
            // revert on failure
            setBoardVisibility(boardVisibility);
        }
    };

    const handleInvite = async () => {
        if (!selectedInvitee || !employee) return;
        setIsInviting(true);
        try {
            await api.inviteToBoard(params.id, String(employee.id), selectedInvitee);
            const updatedInvites = await api.getBoardInvites(params.id);
            setInvites(updatedInvites);
            setSelectedInvitee('');
        } catch (e) {
            console.error('Failed to invite user', e);
        } finally {
            setIsInviting(false);
        }
    };

    const handleFullscreen = () => {
        if (!document.fullscreenElement && containerRef.current) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    if (isLoading) return <div style={{ padding: 40, color: 'white' }}>Loading board...</div>;
    if (!board) return <div style={{ padding: 40, color: 'white' }}>Board not found</div>;

    return (
        <div className="board-detail-container" ref={containerRef}>
            <div className="board-detail-header" style={{ 
                height: '60px', 
                background: 'var(--bg-main)', 
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 24px',
                gap: '16px',
                zIndex: 1000
            }}>
                <button className="icon-btn-ghost" onClick={() => router.push('/boards')} style={{ color: 'white' }}>
                    <ChevronLeft size={20} />
                </button>
                <input 
                    type="text" 
                    value={boardName} 
                    onChange={(e) => setBoardName(e.target.value)} 
                    onBlur={handleNameBlur}
                    style={{ 
                        fontSize: '1.2rem', margin: 0, color: 'white', fontWeight: 600, 
                        background: 'transparent', border: 'none', outline: 'none', 
                        width: 'auto', minWidth: '150px' 
                    }} 
                />
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    
                    {/* Presence Avatars */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {presenceState.map((user, idx) => (
                            <div key={user.id || idx} style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: 'var(--purple-main)', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: 'bold', border: '2px solid var(--bg-main)',
                                marginLeft: idx === 0 ? 0 : '-10px',
                                zIndex: 100 - idx,
                                overflow: 'hidden'
                            }} title={`${user.firstName} ${user.lastName}`}>
                                {user.profilePhoto ? (
                                    <img src={user.profilePhoto} alt={user.firstName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    user.firstName?.charAt(0) || 'U'
                                )}
                            </div>
                        ))}
                    </div>

                    <span style={{ fontSize: '0.8rem', color: 'var(--purple-main)', padding: '4px 12px', background: 'rgba(124, 58, 237, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--purple-main)', animation: 'pulse 2s infinite' }}></div>
                        Live
                    </span>

                    <button
                        onClick={() => setShowShareModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 14px', borderRadius: '8px',
                            background: boardVisibility === 'private' ? 'rgba(255,255,255,0.07)' : 'rgba(124,58,237,0.2)',
                            border: `1px solid ${boardVisibility === 'private' ? 'rgba(255,255,255,0.12)' : 'rgba(124,58,237,0.5)'}`,
                            color: boardVisibility === 'private' ? 'rgba(255,255,255,0.7)' : 'var(--purple-main)',
                            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                            transition: 'all 0.15s'
                        }}
                    >
                        {boardVisibility === 'private' ? <Lock size={14} /> : <Users size={14} />}
                        {boardVisibility === 'private' ? 'Private' : 'Shared'}
                    </button>

                    <button className="icon-btn-ghost" onClick={handleFullscreen} style={{ color: 'white', padding: '4px' }} title="Toggle Fullscreen">
                        <Maximize size={18} />
                    </button>
                </div>
            </div>

            <div className="board-canvas-wrapper" style={{ flex: 1, position: 'relative' }}>
                <Tldraw onMount={handleMount} />
            </div>

            {/* Share Modal */}
            {showShareModal && (
                <div
                    onClick={() => setShowShareModal(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ width: 440, background: '#141418', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', overflow: 'hidden' }}
                    >
                        {/* Modal Header */}
                        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'white' }}>Board Access</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>Control who can view this whiteboard</p>
                            </div>
                            <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Visibility Toggle */}
                        <div style={{ padding: '20px 24px' }}>
                            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visibility</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {/* Private */}
                                <button
                                    onClick={() => handleVisibilityChange('private')}
                                    style={{
                                        padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                                        border: `1px solid ${boardVisibility === 'private' ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.08)'}`,
                                        background: boardVisibility === 'private' ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <Lock size={14} color={boardVisibility === 'private' ? 'var(--purple-main)' : 'rgba(255,255,255,0.5)'} />
                                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: boardVisibility === 'private' ? 'white' : 'rgba(255,255,255,0.5)' }}>Private</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>Only you can see this</p>
                                </button>
                                {/* Team */}
                                <button
                                    onClick={() => handleVisibilityChange('team')}
                                    style={{
                                        padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                                        border: `1px solid ${boardVisibility === 'team' ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)'}`,
                                        background: boardVisibility === 'team' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <Users size={14} color={boardVisibility === 'team' ? '#10B981' : 'rgba(255,255,255,0.5)'} />
                                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: boardVisibility === 'team' ? 'white' : 'rgba(255,255,255,0.5)' }}>Team</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>Anyone in your department</p>
                                </button>
                            </div>
                        </div>

                        {/* Invite Section — always visible so you can invite to private boards */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px' }}>
                            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invite to collaborate</p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <select
                                        value={selectedInvitee}
                                        onChange={e => setSelectedInvitee(e.target.value)}
                                        style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.875rem', outline: 'none' }}
                                    >
                                        <option value="" style={{ background: '#1a1a1f' }}>Select a member...</option>
                                        {departmentMembers
                                            .filter((m: any) => String(m.id) !== String(employee?.id))
                                            .map((m: any) => (
                                                <option key={m.id} value={m.id} style={{ background: '#1a1a1f' }}>{m.firstName} {m.lastName}</option>
                                            ))
                                        }
                                    </select>
                                    <button
                                        onClick={handleInvite}
                                        disabled={!selectedInvitee || isInviting}
                                        style={{ padding: '9px 16px', borderRadius: '8px', background: 'var(--purple-main)', color: 'white', border: 'none', cursor: selectedInvitee && !isInviting ? 'pointer' : 'not-allowed', opacity: !selectedInvitee || isInviting ? 0.5 : 1, fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap' }}
                                    >
                                        {isInviting ? 'Sending...' : 'Invite'}
                                    </button>
                                </div>

                                {invites.length > 0 && (
                                    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {invites.map((inv: any) => (
                                            <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }}>
                                                <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)' }}>
                                                    {inv.invitee?.firstName} {inv.invitee?.lastName}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.72rem', padding: '3px 8px', borderRadius: '20px', fontWeight: 500,
                                                    background: inv.status === 'accepted' ? 'rgba(16,185,129,0.15)' : inv.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                                    color: inv.status === 'accepted' ? '#10B981' : inv.status === 'pending' ? '#F59E0B' : '#EF4444'
                                                }}>
                                                    {inv.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </div>

                        {/* Footer spacer */}
                        <div style={{ height: 8 }} />
                    </div>
                </div>
            )}
        </div>
    );
}
