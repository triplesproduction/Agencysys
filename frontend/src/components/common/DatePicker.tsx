'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface DatePickerProps {
    value: string; // "YYYY-MM-DD"
    onChange: (date: string) => void;
    placeholder?: string;
    label?: string;
    required?: boolean;
    className?: string;
    disabled?: boolean;
}

export default function DatePicker({ value, onChange, placeholder = "Select Date", label, required, className, disabled }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
    const [showYearPicker, setShowYearPicker] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync viewDate when value changes from outside
    useEffect(() => {
        if (value) {
            setViewDate(new Date(value));
        }
    }, [value]);

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setShowYearPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
    const startDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

    const handleMonthChange = (offset: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setViewDate(newDate);
    };

    const handleYearSelect = (year: number) => {
        const newDate = new Date(viewDate);
        newDate.setFullYear(year);
        setViewDate(newDate);
        setShowYearPicker(false);
    };

    const handleDateSelect = (day: number) => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        // Format as YYYY-MM-DD using local time to avoid timezone shifts
        const formatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(formatted);
        setIsOpen(false);
        setShowYearPicker(false);
    };

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const totalDays = daysInMonth(month, year);
        const startDay = startDayOfMonth(month, year);
        const monthName = viewDate.toLocaleString('default', { month: 'long' });

        const days = [];
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} style={{ width: '100%', aspectRatio: '1/1' }} />);
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const currentSelectedStr = value;

        for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === currentSelectedStr;

            days.push(
                <button
                    key={d}
                    onClick={() => handleDateSelect(d)}
                    type="button"
                    className="calendar-day-btn"
                    style={{
                        width: '100%', aspectRatio: '1/1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '10px', fontSize: '0.85rem',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: isSelected ? 'var(--purple-main)' : isToday ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                        color: isSelected ? 'white' : isToday ? '#A78BFA' : 'rgba(255,255,255,0.8)',
                        border: isToday && !isSelected ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid transparent',
                        cursor: 'pointer',
                        fontWeight: isSelected || isToday ? 600 : 400,
                        position: 'relative',
                        padding: 0
                    }}
                >
                    {d}
                    {isToday && !isSelected && <div style={{ position: 'absolute', bottom: '15%', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--purple-main)' }} />}
                </button>
            );
        }

        const years = [];
        const currentYear = new Date().getFullYear();
        for (let y = currentYear + 10; y >= currentYear - 60; y--) {
            years.push(y);
        }

        return (
            <div className="fade-in date-picker-popup" style={{ 
                background: 'rgba(15, 15, 20, 0.98)', 
                backdropFilter: 'blur(28px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '18px',
                padding: '16px',
                boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(139, 92, 246, 0.1)',
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 'auto',
                right: 0,
                zIndex: 9999,
                width: '300px',
                animation: 'slideUpFade 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <button 
                        type="button"
                        onClick={() => setShowYearPicker(!showYearPicker)}
                        style={{ 
                            background: 'transparent', border: 'none', color: 'white', 
                            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                            fontSize: '0.95rem', fontWeight: 700, padding: '4px 8px', borderRadius: '8px'
                        }}
                    >
                        {monthName} {year}
                        <ChevronDown size={14} style={{ transform: showYearPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" onClick={() => handleMonthChange(-1)} className="nav-btn">
                            <ChevronLeft size={16} />
                        </button>
                        <button type="button" onClick={() => handleMonthChange(1)} className="nav-btn">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {showYearPicker ? (
                    <div style={{ 
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', 
                        maxHeight: '220px', overflowY: 'auto', paddingRight: '4px'
                    }} className="custom-scrollbar">
                        {years.map(y => (
                            <button
                                key={y}
                                onClick={() => handleYearSelect(y)}
                                style={{
                                    padding: '8px', borderRadius: '8px', border: '1px solid transparent',
                                    background: year === y ? 'var(--purple-main)' : 'rgba(255,255,255,0.03)',
                                    color: year === y ? 'white' : 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem'
                                }}
                            >
                                {y}
                            </button>
                        ))}
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '8px' }}>
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                                <div key={idx} style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                            {days}
                        </div>

                        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center' }}>
                            <button 
                                type="button" 
                                onClick={() => {
                                    const now = new Date();
                                    setViewDate(now);
                                    handleDateSelect(now.getDate());
                                }}
                                style={{ background: 'transparent', border: 'none', color: 'var(--purple-light)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: '4px 12px' }}
                            >
                                Today
                            </button>
                        </div>
                    </>
                )}

                <style jsx>{`
                    .nav-btn {
                        padding: 6px;
                        border-radius: 8px;
                        background: rgba(255,255,255,0.03);
                        border: 1px solid rgba(255,255,255,0.06);
                        color: rgba(255,255,255,0.8);
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        alignItems: center;
                        justifyContent: center;
                    }
                    .nav-btn:hover {
                        background: rgba(255,255,255,0.08);
                        border-color: var(--purple-main);
                        color: white;
                    }
                    .calendar-day-btn:hover:not(:disabled) {
                        background: rgba(139, 92, 246, 0.2) !important;
                        color: white !important;
                        transform: scale(1.1);
                        z-index: 1;
                    }
                    @keyframes slideUpFade {
                        from { opacity: 0; transform: translateY(8px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </div>
        );
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }} className={className}>
            {label && <label className="input-label" style={{ display: 'block', marginBottom: '8px' }}>{label} {required && '*'}</label>}
            
            <div 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    border: isOpen ? '1px solid var(--purple-main)' : '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    color: value ? 'white' : 'rgba(255,255,255,0.3)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isOpen ? '0 0 20px rgba(139, 92, 246, 0.15)' : 'none',
                    opacity: disabled ? 0.6 : 1,
                    backdropFilter: 'blur(10px)',
                    fontSize: '0.9rem',
                    height: '46px',
                    userSelect: 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <CalendarIcon size={18} style={{ color: isOpen ? 'var(--purple-main)' : 'rgba(255,255,255,0.2)', transition: 'color 0.3s' }} />
                    <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : placeholder}
                    </span>
                </div>
                <ChevronDown size={16} style={{ opacity: 0.3, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
            </div>

            {isOpen && renderCalendar()}
        </div>
    );
}
