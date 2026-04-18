import React from 'react';
import './GlassCard.css';

export interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
    hoverable?: boolean;
    id?: string;
}

export default function GlassCard({ children, className = '', style, onClick, hoverable = false, id }: GlassCardProps) {
    return (
        <div
            id={id}
            className={`glass-card ${hoverable ? 'hoverable' : ''} ${className}`}
            style={style}
            onClick={onClick}
        >
            {children}
        </div>
    );
}
