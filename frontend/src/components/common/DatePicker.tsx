'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react';

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
        const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        // Ensure we handle timezone offset to get correct YYYY-MM-DD
        const offset = selected.getTimezoneOffset();
        const adjustedDate = new Date(selected.getTime() - offset * 60 * 1000);
        const formatted = adjustedDate.toISOString().split('T')[0];
        onChange(formatted);
        setIsOpen(false);
    };

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const totalDays = daysInMonth(month, year);
        const startDay = startDayOfMonth(month, year);
        const monthName = viewDate.toLocaleString('default', { month: 'long' });

        const days = [];
        // Empty slots for start of month
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} style={{ width: '40px', height: '40px' }} />);
        }

        // Days of month
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const currentSelectedStr = value;

        for (let d = 1; d <= totalDays; d++) {
            const dateObj = new Date(year, month, d);
            const offset = dateObj.getTimezoneOffset();
            const adjustedDate = new Date(dateObj.getTime() - offset * 60 * 1000);
            const dateStr = adjustedDate.toISOString().split('T')[0];
            
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === currentSelectedStr;

            days.push(
                <button
                    key={d}
                    onClick={() => handleDateSelect(d)}
                    type="button"
                    className="calendar-day-btn"
                    style={{
                        width: '38px', height: '38px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '12px', fontSize: '0.9rem',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: isSelected ? 'var(--purple-main)' : isToday ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                        color: isSelected ? 'white' : isToday ? '#A78BFA' : 'rgba(255,255,255,0.8)',
                        border: isToday && !isSelected ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid transparent',
                        cursor: 'pointer',
                        fontWeight: isSelected || isToday ? 600 : 400,
                        position: 'relative'
                    }}
                >
                    {d}
                    {isToday && !isSelected && <div style={{ position: 'absolute', bottom: '6px', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--purple-main)' }} />}
                </button>
            );
        }

        const years = [];
        const currentYear = new Date().getFullYear();
        for (let y = currentYear + 5; y >= currentYear - 60; y--) {
            years.push(y);
        }

        return (
            <div className="fade-in" style={{ 
                background: 'rgba(12, 12, 16, 0.98)', 
                backdropFilter: 'blur(24px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(139, 92, 246, 0.05)',
                position: 'absolute',
                top: 'calc(100% + 12px)',
                left: 0,
                zIndex: 1000,
                minWidth: '340px',
                animation: 'slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Calendar Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                            type="button"
                            onClick={() => setShowYearPicker(!showYearPicker)}
                            style={{ 
                                background: 'transparent', border: 'none', color: 'white', 
                                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                fontSize: '1.1rem', fontWeight: 700, padding: '4px 8px', borderRadius: '8px',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            {monthName} {year}
                            <ChevronDown size={16} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" onClick={() => handleMonthChange(-1)} className="nav-btn">
                            <ChevronLeft size={18} />
                        </button>
                        <button type="button" onClick={() => handleMonthChange(1)} className="nav-btn">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                {showYearPicker ? (
                    <div style={{ 
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', 
                        maxHeight: '240px', overflowY: 'auto', paddingRight: '4px',
                        scrollbarWidth: 'thin'
                    }}>
                        {years.map(y => (
                            <button
                                key={y}
                                onClick={() => handleYearSelect(y)}
                                className="year-btn"
                                style={{
                                    padding: '10px', borderRadius: '12px', border: '1px solid transparent',
                                    background: year === y ? 'var(--purple-main)' : 'rgba(255,255,255,0.03)',
                                    color: year === y ? 'white' : 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.95rem'
                                }}
                            >
                                {y}
                            </button>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Weekday Headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '12px' }}>
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                                <div key={idx} style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                            {days}
                        </div>

                        {/* Today Button */}
                        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center' }}>
                            <button 
                                type="button" 
                                onClick={() => { setViewDate(new Date()); handleDateSelect(new Date().getDate()); }}
                                style={{ background: 'transparent', border: 'none', color: 'var(--purple-light)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Select Today
                            </button>
                        </div>
                    </>
                )}

                <style jsx>{`
                    .nav-btn {
                        padding: 8px;
                        border-radius: 10px;
                        background: rgba(255,255,255,0.04);
                        border: 1px solid rgba(255,255,255,0.08);
                        color: white !important;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .nav-btn:hover {
                        background: rgba(255,255,255,0.1);
                        border-color: var(--purple-main);
                    }
                    .calendar-day-btn:hover {
                        background: rgba(139, 92, 246, 0.15) !important;
                        color: white !important;
                        transform: translateY(-2px);
                    }
                    .year-btn:hover {
                        border-color: var(--purple-main);
                        background: rgba(139, 92, 246, 0.1);
                    }
                    @keyframes slideUpFade {
                        from { opacity: 0; transform: translateY(10px); }
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
                    background: 'rgba(0,0,0,0.22)', 
                    border: isOpen ? '1px solid var(--purple-main)' : '1px solid var(--glass-border)',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    color: value ? 'white' : 'rgba(255,255,255,0.4)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background-color 0.3s, border-color 0.3s, box-shadow 0.3s',
                    boxShadow: isOpen ? '0 0 16px var(--purple-glow)' : 'none',
                    opacity: disabled ? 0.5 : 1,
                    backdropFilter: 'blur(8px)',
                    fontSize: '0.875rem',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <CalendarIcon size={18} style={{ color: isOpen ? 'var(--purple-main)' : 'rgba(255,255,255,0.3)', transition: 'color 0.3s', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : placeholder}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ChevronDown size={16} style={{ opacity: 0.4, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', flexShrink: 0 }} />
                </div>
            </div>

            {isOpen && renderCalendar()}
        </div>
    );
}
