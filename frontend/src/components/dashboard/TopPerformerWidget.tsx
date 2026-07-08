'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Trophy, Crown, Award, Loader2 } from 'lucide-react';

interface Performer {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    profile_photo: string;
    designation: string;
    work_hours: number;
}

export default function TopPerformerWidget() {
    // Fetch top 2 performers sorted by work hours using RPC (bypasses employee RLS limits safely)
    const { data: performers = [], isLoading, error } = useQuery<Performer[]>({
        queryKey: ['topPerformersLimit2'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_top_performers', { limit_num: 2 });
            if (error) {
                console.error('[TopPerformerWidget] RPC error:', error);
                throw error;
            }
            return data || [];
        },
        staleTime: 600000 // 10 minutes cache
    });

    return (
        <div className="ad2-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="ad2-card-header" style={{ marginBottom: '16px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                    <Trophy size={16} color="#F59E0B" /> Top Performers
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>This Month</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}>
                {isLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 10px', gap: '8px', color: 'rgba(255,255,255,0.4)' }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span style={{ fontSize: '0.85rem' }}>Evaluating performers...</span>
                    </div>
                ) : error || performers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                        No performers active this month.
                    </div>
                ) : (
                    performers.map((perf, idx) => {
                        const isFirst = idx === 0;
                        const isSecond = idx === 1;
                        const fullName = `${perf.first_name} ${perf.last_name}`;

                        return (
                            <div 
                                key={perf.id} 
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    padding: '12px 16px',
                                    background: isFirst 
                                        ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.08) 0%, transparent 100%)' 
                                        : 'rgba(255, 255, 255, 0.02)',
                                    border: isFirst 
                                        ? '1px solid rgba(245, 158, 11, 0.15)' 
                                        : '1px solid rgba(255, 255, 255, 0.04)',
                                    borderRadius: '14px',
                                    transition: 'transform 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    {/* Rank Badge / Icon */}
                                    <div style={{ 
                                        width: '28px', 
                                        height: '28px', 
                                        borderRadius: '50%', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        background: isFirst ? 'rgba(245, 158, 11, 0.2)' : 'rgba(209, 213, 219, 0.15)',
                                        color: isFirst ? '#F59E0B' : '#E5E7EB',
                                        border: '1px solid currentColor'
                                    }}>
                                        {isFirst ? <Crown size={14} /> : <Award size={14} />}
                                    </div>

                                    {/* Profile Avatar */}
                                    <img 
                                        src={perf.profile_photo && perf.profile_photo.length > 5 ? perf.profile_photo : `https://ui-avatars.com/api/?name=${fullName}&background=6366f1&color=fff`} 
                                        alt="" 
                                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(255,255,255,0.1)' }}
                                    />

                                    {/* Details */}
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFF' }}>{fullName}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '3px' }}>{perf.designation}</div>
                                    </div>
                                </div>

                                {/* Rank Status */}
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isFirst ? '#F59E0B' : 'rgba(255,255,255,0.6)' }}>
                                        {isFirst ? 'Gold' : 'Silver'}
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>Trophy</div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
