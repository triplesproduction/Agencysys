'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PenTool, Plus, Trash2, Check, X } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useBoards, useCreateBoard, useDeleteBoard, useMyPendingBoardInvites, useRespondToBoardInvite } from '@/hooks/queries/domains/boards/useBoards';
import './Boards.css';

export default function BoardsPage() {
    const { employee } = useAuth();
    const router = useRouter();
    const isAdmin = employee?.roleId === 'ADMIN';
    const { data: boards, isLoading } = useBoards(employee?.id ? String(employee.id) : undefined, isAdmin);
    const { data: pendingInvites } = useMyPendingBoardInvites(employee?.id ? String(employee.id) : undefined);
    const respondToInvite = useRespondToBoardInvite();
    
    const createBoard = useCreateBoard();
    const deleteBoard = useDeleteBoard();
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateBoard = async () => {
        if (!employee) return;
        setIsCreating(true);
        try {
            const newBoard = await createBoard.mutateAsync({
                name: 'Untitled Board',
                employeeId: employee.id,
                visibility: 'private',
                document: { document: { store: {} }, session: {} }
            });
            router.push(`/boards/${newBoard.id}`);
        } catch (error) {
            console.error('Failed to create board:', error);
            setIsCreating(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this board?')) {
            await deleteBoard.mutateAsync(id);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="page-root fade-in">
            <PageHeader
                title="Whiteboards"
                subtitle="Infinite collaborative canvas for team brainstorming and planning"
                actions={
                    <button className="page-action-btn-primary" onClick={handleCreateBoard} disabled={isCreating}>
                        <Plus size={16} />
                        {isCreating ? 'Creating...' : 'New Board'}
                    </button>
                }
            />

            <div className="page-content" style={{ padding: '0 8px 40px' }}>
                {isLoading ? (
                    <div style={{ padding: '40px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Loading boards...</div>
                ) : (
                    <>
                        {pendingInvites && pendingInvites.length > 0 && (
                            <div style={{ marginBottom: '32px' }}>
                                <h3 style={{ color: 'white', marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Pending Invites</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                                    {pendingInvites.map((inv: any) => (
                                        <div key={inv.id} style={{ 
                                            background: 'var(--bg-elevated)', 
                                            border: '1px solid var(--purple-main)', 
                                            borderRadius: '12px', 
                                            padding: '16px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px'
                                        }}>
                                            <div style={{ color: 'white', fontWeight: 600 }}>{inv.board?.name || 'Untitled Board'}</div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                Invited by: {inv.inviter?.firstName} {inv.inviter?.lastName}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                                                <button 
                                                    onClick={() => respondToInvite.mutate({ inviteId: inv.id, status: 'accepted' })}
                                                    style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'var(--purple-main)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                >
                                                    <Check size={16} /> Accept
                                                </button>
                                                <button 
                                                    onClick={() => respondToInvite.mutate({ inviteId: inv.id, status: 'declined' })}
                                                    style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                >
                                                    <X size={16} /> Decline
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="boards-grid">
                        <div className="create-board-card" onClick={handleCreateBoard}>
                            <Plus size={32} color="var(--purple-main)" />
                            <span>{isCreating ? 'Creating...' : 'Create New Board'}</span>
                        </div>

                        {boards?.map(board => (
                            <div key={board.id} className="board-card" onClick={() => router.push(`/boards/${board.id}`)}>
                                <div className="board-card-header">
                                    <h3 className="board-card-title">{board.name}</h3>
                                    {(board.employeeId === employee?.id || employee?.roleId === 'ADMIN') && (
                                        <button 
                                            className="icon-btn-ghost" 
                                            style={{ color: '#F87171', padding: '4px' }}
                                            onClick={(e) => handleDelete(e, board.id)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                                
                                <div className="board-card-meta">
                                    <span>Updated {formatDate(board.updatedAt)}</span>
                                    <span style={{ 
                                        display: 'inline-block', 
                                        padding: '2px 8px', 
                                        borderRadius: '12px', 
                                        fontSize: '0.7rem', 
                                        fontWeight: '600',
                                        background: board.visibility === 'private' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                                        color: board.visibility === 'private' ? '#EF4444' : '#8B5CF6',
                                        marginLeft: '8px'
                                    }}>
                                        {board.visibility === 'private' ? 'Private' : 'Team'}
                                    </span>
                                </div>

                                <div className="board-card-owner">
                                    {board.employee?.profilePhoto ? (
                                        <img src={board.employee.profilePhoto} alt={board.employee.firstName} />
                                    ) : (
                                        <div style={{
                                            width: 24, height: 24, borderRadius: '50%', 
                                            background: 'rgba(255,255,255,0.1)', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '10px', fontWeight: 'bold'
                                        }}>
                                            {board.employee?.firstName?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                    <span>{board.employee?.firstName} {board.employee?.lastName}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    </>
                )}
            </div>
        </div>
    );
}
