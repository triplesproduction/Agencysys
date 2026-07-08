'use client';

import { NoteDTO } from '@/types/dto';
import { Pin, Briefcase, Lock, Users } from 'lucide-react';

interface NoteCardProps {
    note: NoteDTO;
    isActive: boolean;
    onClick: () => void;
}

const NOTE_COLORS: Record<string, string> = {
    purple: 'rgba(139, 92, 246, 0.12)',
    blue: 'rgba(59, 130, 246, 0.12)',
    green: 'rgba(16, 185, 129, 0.12)',
    orange: 'rgba(249, 115, 22, 0.12)',
    pink: 'rgba(236, 72, 153, 0.12)',
    red: 'rgba(239, 68, 68, 0.12)',
};

const NOTE_BORDER_COLORS: Record<string, string> = {
    purple: 'rgba(139, 92, 246, 0.25)',
    blue: 'rgba(59, 130, 246, 0.25)',
    green: 'rgba(16, 185, 129, 0.25)',
    orange: 'rgba(249, 115, 22, 0.25)',
    pink: 'rgba(236, 72, 153, 0.25)',
    red: 'rgba(239, 68, 68, 0.25)',
};

const NOTE_ACTIVE_COLORS: Record<string, string> = {
    purple: 'rgba(139, 92, 246, 0.22)',
    blue: 'rgba(59, 130, 246, 0.22)',
    green: 'rgba(16, 185, 129, 0.22)',
    orange: 'rgba(249, 115, 22, 0.22)',
    pink: 'rgba(236, 72, 153, 0.22)',
    red: 'rgba(239, 68, 68, 0.22)',
};

const NOTE_ACTIVE_BORDER_COLORS: Record<string, string> = {
    purple: 'rgba(139, 92, 246, 0.65)',
    blue: 'rgba(59, 130, 246, 0.65)',
    green: 'rgba(16, 185, 129, 0.65)',
    orange: 'rgba(249, 115, 22, 0.65)',
    pink: 'rgba(236, 72, 153, 0.65)',
    red: 'rgba(239, 68, 68, 0.65)',
};

function getContentPreview(content: any): string {
    if (!content) return 'Empty note';
    try {
        const extractText = (node: any): string => {
            if (node.text) return node.text;
            if (node.content) return node.content.map(extractText).join(' ');
            return '';
        };
        const text = extractText(content).trim();
        return text.length > 0 ? text.substring(0, 120) : 'Empty note';
    } catch {
        return 'Empty note';
    }
}

function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function NoteCard({ note, isActive, onClick }: NoteCardProps) {
    const colorKey = note.color || 'none';
    
    // Background
    let background = 'rgba(255, 255, 255, 0.02)';
    if (isActive) {
        background = colorKey !== 'none' ? NOTE_ACTIVE_COLORS[colorKey] : 'rgba(139, 92, 246, 0.18)';
    } else if (colorKey !== 'none') {
        background = NOTE_COLORS[colorKey];
    }
    
    // Border
    let borderColor = 'rgba(255, 255, 255, 0.06)';
    if (isActive) {
        borderColor = colorKey !== 'none' ? NOTE_ACTIVE_BORDER_COLORS[colorKey] : 'rgba(139, 92, 246, 0.5)';
    } else if (colorKey !== 'none') {
        borderColor = NOTE_BORDER_COLORS[colorKey];
    }

    return (
        <div
            className={`note-card ${isActive ? 'active' : ''}`}
            onClick={onClick}
            style={{
                background,
                borderColor,
            }}
        >
            <div className="note-card-header">
                <h4 className="note-card-title">{note.title || 'Untitled Note'}</h4>
                <div className="note-card-badges">
                    {note.pinned && (
                        <Pin size={12} className="note-pin-icon" />
                    )}
                    {note.visibility === 'team' ? (
                        <Users size={12} className="note-visibility-icon team" />
                    ) : (
                        <Lock size={11} className="note-visibility-icon private" />
                    )}
                </div>
            </div>

            <p className="note-card-preview">{getContentPreview(note.content)}</p>

            <div className="note-card-footer">
                <span className="note-card-time">{formatTimeAgo(note.updatedAt)}</span>
                {note.project && (
                    <span className="note-card-project">
                        <Briefcase size={10} />
                        {note.project.name}
                    </span>
                )}
            </div>
        </div>
    );
}
