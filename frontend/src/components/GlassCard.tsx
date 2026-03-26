import React from 'react';
import './GlassCard.css';

export interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
    hoverable?: boolean;
}

export default function GlassCard({ children, className = '', style, onClick, hoverable = false }: GlassCardProps) {
    return (
        <div
            className={`glass-card ${hoverable ? 'hoverable' : ''} ${className}`}
            style={style}
            onClick={onClick}
        >
            {children}
        </div>
    );
}
