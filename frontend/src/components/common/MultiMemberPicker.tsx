'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { User, X, Check, Plus, Search } from 'lucide-react';
import { EmployeeDTO } from '@/types/dto';
import './MultiMemberPicker.css';

interface MultiMemberPickerProps {
    selectedIds: string[];
    members: EmployeeDTO[];
    onChange: (ids: string[]) => void;
    label?: string;
    readOnly?: boolean;
}

export default function MultiMemberPicker({ selectedIds = [], members = [], onChange, label, readOnly }: MultiMemberPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const portalContentRef = useRef<HTMLDivElement>(null);
    const [openUpward, setOpenUpward] = useState(false);
    const [popupCoords, setPopupCoords] = useState<{ top?: number, bottom?: number, left: number, width: number }>({ left: 0, width: 280 });
    const instanceId = useId().replace(/:/g, '');

    // Use useLayoutEffect to position the dropdown before it's painted to avoid flashes
    React.useLayoutEffect(() => {
        const updatePosition = () => {
            if (isOpen && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const dropdownHeight = 320; // Estimated max height
                
                const spaceBelow = viewportHeight - rect.bottom;
                const spaceAbove = rect.top;
                
                // Prioritize opening where there is more space
                const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
                
                if (shouldOpenUpward !== openUpward) {
                    setOpenUpward(shouldOpenUpward);
                }

                setPopupCoords({
                    top: shouldOpenUpward ? undefined : rect.bottom + 12,
                    bottom: shouldOpenUpward ? viewportHeight - rect.top + 12 : undefined,
                    left: rect.left,
                    width: Math.max(rect.width, 300)
                });
            }
        };

        const handleInteraction = (event: MouseEvent) => {
            if (!isOpen) return;
            
            // Check if the click is within the trigger area
            const isInsideContainer = containerRef.current && containerRef.current.contains(event.target as Node);
            // Check if the click is within the portal dropdown
            const isInsidePortal = portalContentRef.current && portalContentRef.current.contains(event.target as Node);
            
            if (!isInsideContainer && !isInsidePortal) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            updatePosition();
            // Use both mousedown and click to catch all interaction types
            document.addEventListener('mousedown', handleInteraction, true);
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
        }

        return () => {
            document.removeEventListener('mousedown', handleInteraction, true);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, openUpward, members.length]);

    const toggleMember = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (readOnly) return;
        
        const currentIds = selectedIds || [];
        const newIds = currentIds.includes(id)
            ? currentIds.filter(sid => sid !== id)
            : [...currentIds, id];
        
        onChange(newIds);
    };

    const safeSelectedIds = selectedIds || [];
    const selectedMembers = (members || []).filter(m => safeSelectedIds.includes(m.id));
    const filteredMembers = (members || []).filter(m => 
        m.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        m.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.designation?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderDropdown = () => {
        return createPortal(
            <div 
                ref={portalContentRef}
                className={`picker-dropdown custom-scrollbar ${openUpward ? 'upward' : ''}`}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                    position: 'fixed',
                    top: popupCoords.top,
                    bottom: popupCoords.bottom,
                    left: popupCoords.left,
                    width: popupCoords.width,
                    zIndex: 100000,
                    opacity: 1, // FORCE VISIBILITY
                    visibility: 'visible',
                    pointerEvents: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: openUpward ? 'slideUpPortal 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'slideDownPortal 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                <div className="picker-search-container">
                    <Search size={14} className="search-icon-inline" />
                    <input 
                        placeholder="Search members..." 
                        className="picker-search-input" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        autoFocus
                    />
                </div>
                <div className="members-list">
                    {filteredMembers.length === 0 ? (
                        <div className="no-members-found">No members found</div>
                    ) : (
                        filteredMembers.map(member => {
                            const isSelected = safeSelectedIds.includes(member.id);
                            return (
                                <div 
                                    key={member.id} 
                                    className={`member-option ${isSelected ? 'selected' : ''}`}
                                    onClick={(e) => toggleMember(e, member.id)}
                                >
                                    {member.profilePhoto ? (
                                        <img src={member.profilePhoto} className="option-avatar" alt="" />
                                    ) : (
                                        <div className="option-avatar">{member.firstName.charAt(0)}</div>
                                    )}
                                    <div className="option-info">
                                        <span className="option-name">{member.firstName} {member.lastName}</span>
                                        <span className="option-role">{member.designation}</span>
                                    </div>
                                    {isSelected && <Check size={14} className="check-icon" />}
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="picker-footer">
                    <button 
                        type="button" 
                        className="picker-done-btn" 
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                    >
                        Done
                    </button>
                </div>
            </div>,
            document.body
        );
    };

    return (
        <div className="multi-picker-container" ref={containerRef}>
            {label && <label className="multi-picker-label">{label}</label>}
            
            <div className="selected-members-bar">
                {selectedMembers.map((member, idx) => {
                    const isLast = idx === selectedMembers.length - 1;
                    const showName = isLast || selectedMembers.length === 1;
                    
                    return (
                        <div 
                            key={member.id} 
                            className={`member-tag ${!showName ? 'is-collapsed' : ''}`}
                            title={!showName ? `${member.firstName} ${member.lastName}` : ''}
                        >
                            {member.profilePhoto ? (
                                <img src={member.profilePhoto} className="tag-avatar" alt="" />
                            ) : (
                                <div className="tag-avatar">{member.firstName.charAt(0)}</div>
                            )}
                            
                            {showName && <span className="tag-name">{member.firstName}</span>}
                            
                            {!readOnly && (
                                <button 
                                    type="button" 
                                    className="tag-remove" 
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleMember(e, member.id); }}
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    );
                })}

                {!readOnly && (
                    <button 
                        type="button"
                        className="add-member-trigger" 
                        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                    >
                        <Plus size={14} />
                    </button>
                )}
            </div>

            {isOpen && !readOnly && renderDropdown()}
        </div>
    );
}
