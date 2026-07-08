'use client';

import React, { useState, useEffect } from 'react';
import './Preloader.css';

interface PreloaderProps {
    statusText?: string;
}

export default function Preloader({ statusText }: PreloaderProps) {
    const [hintIndex, setHintIndex] = useState(0);
    const hints = [
        "Synchronizing encrypted data stream...",
        "Resolving secure personnel directories...",
        "Loading system orchestration metrics...",
        "Optimizing workspace layout...",
        "Preparing agency dashboard components..."
    ];

    useEffect(() => {
        if (statusText) return; // Don't cycle hints if custom status text is provided
        const interval = setInterval(() => {
            setHintIndex((prev) => (prev + 1) % hints.length);
        }, 1800);
        return () => clearInterval(interval);
    }, [hints.length, statusText]);

    return (
        <div className="fullscreen-preloader">
            <div className="preloader-bg-glow" />
            <div className="preloader-content">
                <div className="preloader-logo-wrap">
                    <img src="/logo.png" className="preloader-logo-img" alt="TripleS Logo" />
                    <div className="preloader-spinner-ring" />
                    <div className="preloader-pulse-ring" />
                </div>
                <div className="preloader-brand-title">
                    TripleS <span className="highlight">OS</span>
                </div>
                <div className="preloader-brand-subtitle">
                    INTERNAL ORCHESTRATION SYSTEM
                </div>
                <div className="preloader-status-bar">
                    <div className="preloader-status-progress" />
                </div>
                <div className="preloader-status-text">
                    {statusText || hints[hintIndex]}
                </div>
            </div>
        </div>
    );
}

