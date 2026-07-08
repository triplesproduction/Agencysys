'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, CheckCircle2, Monitor, ArrowRight, BookOpen, Layers, Users } from 'lucide-react';

interface Particle {
    x: number;
    y: number;
    size: number;
    color: string;
    speedX: number;
    speedY: number;
    rotation: number;
    rotationSpeed: number;
}

export default function Phase2CelebrationModal() {
    const [isOpen, setIsOpen] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const requestRef = useRef<number | null>(null);

    useEffect(() => {
        // Only show if not seen before
        if (typeof window !== 'undefined') {
            const seen = localStorage.getItem('triples_phase2_seen_v1');
            if (!seen) {
                setIsOpen(true);
            }
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationActive = true;
        
        // Handle resizing
        const resizeCanvas = () => {
            if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Particle configuration
        const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
        const particles: Particle[] = [];

        // Spawn initial burst
        const particleCount = 120;
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -100 - 20, // Start just above screen
                size: Math.random() * 8 + 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                speedX: (Math.random() - 0.5) * 6,
                speedY: Math.random() * 5 + 3,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10
            });
        }

        // Add side-burst launchers
        const addSideBurst = (side: 'left' | 'right') => {
            const startX = side === 'left' ? 0 : canvas.width;
            const startY = canvas.height * 0.7;
            const dirMultiplier = side === 'left' ? 1 : -1;

            for (let i = 0; i < 40; i++) {
                particles.push({
                    x: startX,
                    y: startY,
                    size: Math.random() * 7 + 5,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    speedX: (Math.random() * 8 + 4) * dirMultiplier,
                    speedY: (Math.random() * -12 - 4),
                    rotation: Math.random() * 360,
                    rotationSpeed: (Math.random() - 0.5) * 15
                });
            }
        };

        // Launch side bursts immediately
        addSideBurst('left');
        addSideBurst('right');

        // Loop
        const update = () => {
            if (!animationActive || !ctx || !canvas) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            let activeParticles = 0;

            particles.forEach((p) => {
                p.x += p.speedX;
                p.y += p.speedY;
                p.rotation += p.rotationSpeed;
                p.speedY += 0.08; // Gravity

                // Drifting wind
                p.speedX += Math.sin(p.y / 30) * 0.02;

                if (p.y < canvas.height && p.x > -20 && p.x < canvas.width + 20) {
                    activeParticles++;

                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.fillStyle = p.color;
                    
                    // Draw paper strip
                    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                    ctx.restore();
                }
            });

            // Keep loop alive if we have active particles
            if (activeParticles > 0) {
                requestRef.current = requestAnimationFrame(update);
            }
        };

        requestRef.current = requestAnimationFrame(update);

        // Periodic secondary bursts for excitement
        const intervalId = setInterval(() => {
            addSideBurst(Math.random() > 0.5 ? 'left' : 'right');
        }, 1500);

        // Auto-stop after 7 seconds
        const timeoutId = setTimeout(() => {
            animationActive = false;
            clearInterval(intervalId);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (canvas) {
                const context = canvas.getContext('2d');
                context?.clearRect(0, 0, canvas.width, canvas.height);
            }
        }, 7000);

        return () => {
            animationActive = false;
            clearInterval(intervalId);
            clearTimeout(timeoutId);
            window.removeEventListener('resize', resizeCanvas);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isOpen]);

    const handleDismiss = () => {
        localStorage.setItem('triples_phase2_seen_v1', 'true');
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Confetti Overlay */}
            <canvas
                ref={canvasRef}
                style={{
                    position: 'fixed',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 999999
                }}
            />

            {/* Modal Overlay */}
            <div style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(5, 5, 5, 0.85)',
                backdropFilter: 'blur(16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999998
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #121216 0%, #1c1c24 100%)',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                    borderRadius: '24px',
                    width: '90%',
                    maxWidth: '580px',
                    padding: '32px',
                    boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.15)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px'
                }}>
                    {/* Background glows */}
                    <div style={{
                        position: 'absolute',
                        top: '-20%',
                        left: '-20%',
                        width: '60%',
                        height: '60%',
                        background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
                        pointerEvents: 'none'
                    }} />

                    {/* Header */}
                    <div style={{ textAlign: 'center', position: 'relative' }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '56px',
                            height: '56px',
                            borderRadius: '16px',
                            background: 'rgba(139, 92, 246, 0.15)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            color: '#A78BFA',
                            marginBottom: '16px'
                        }}>
                            <Sparkles size={28} />
                        </div>
                        <h2 style={{
                            fontSize: '1.75rem',
                            fontWeight: 800,
                            color: '#FFF',
                            margin: '0 0 6px 0',
                            letterSpacing: '-0.02em'
                        }}>
                            TripleS OS <span style={{ color: '#A78BFA' }}>Phase 2</span> is Live!
                        </h2>
                        <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255,255,255,0.5)',
                            margin: 0,
                            fontWeight: 500
                        }}>
                            Welcome to the next generation of your workspace. Here is what's new:
                        </p>
                    </div>

                    {/* Features Bento */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        maxHeight: '320px',
                        overflowY: 'auto',
                        paddingRight: '4px'
                    }}>
                        {/* Feature 1 */}
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '16px',
                            padding: '16px',
                            alignItems: 'flex-start'
                        }}>
                            <div style={{ color: '#A78BFA', marginTop: '2px' }}><Monitor size={20} /></div>
                            <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700, color: '#FFF' }}>Multi-Platform Desktop Tracker</h4>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                                    Fully optimized, native desktop tracking agents for both <b>Windows (.exe)</b> and <b>macOS (.dmg)</b>. Download yours directly from the header!
                                </p>
                            </div>
                        </div>

                        {/* Feature 2 */}
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '16px',
                            padding: '16px',
                            alignItems: 'flex-start'
                        }}>
                            <div style={{ color: '#3B82F6', marginTop: '2px' }}><Layers size={20} /></div>
                            <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700, color: '#FFF' }}>Interactive Whiteboards & Documents</h4>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                                    Brainstorm visually on canvas whiteboards and write collaborative team documentation directly within your project board.
                                </p>
                            </div>
                        </div>

                        {/* Feature 3 */}
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '16px',
                            padding: '16px',
                            alignItems: 'flex-start'
                        }}>
                            <div style={{ color: '#10B981', marginTop: '2px' }}><BookOpen size={20} /></div>
                            <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700, color: '#FFF' }}>Interactive Rulebook & KPI Auditing</h4>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                                    Full visibility on company rules, protocols, and real-time calculation breakdown for your daily score metrics.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleDismiss}
                        style={{
                            background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                            border: 'none',
                            borderRadius: '14px',
                            color: '#FFF',
                            padding: '14px 24px',
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 20px rgba(139, 92, 246, 0.35)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            marginTop: '8px'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 6px 24px rgba(139, 92, 246, 0.45)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 20px rgba(139, 92, 246, 0.35)';
                        }}
                    >
                        Launch My Workspace <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </>
    );
}
