import React, { useState, useRef, useEffect } from 'react';
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

export default function MultiMemberPicker({ selectedIds, members, onChange, label, readOnly }: MultiMemberPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleMember = (id: string) => {
        if (readOnly) return;
        const newIds = selectedIds.includes(id)
            ? selectedIds.filter(sid => sid !== id)
            : [...selectedIds, id];
        onChange(newIds);
    };

    const selectedMembers = members.filter(m => selectedIds.includes(m.id));
    const filteredMembers = members.filter(m => 
        m.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        m.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.designation?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="multi-picker-container" ref={containerRef}>
            {label && <label className="multi-picker-label">{label}</label>}
            
            <div className="selected-members-bar">
                {selectedMembers.map(member => (
                    <div key={member.id} className="member-tag">
                        {member.profilePhoto ? (
                            <img src={member.profilePhoto} className="tag-avatar" alt="" />
                        ) : (
                            <div className="tag-avatar">{member.firstName.charAt(0)}</div>
                        )}
                        <span className="tag-name">{member.firstName}</span>
                        {!readOnly && (
                            <button className="tag-remove" onClick={(e) => { e.stopPropagation(); toggleMember(member.id); }}>
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ))}

                {!readOnly && (
                    <button 
                        type="button"
                        className="add-member-trigger" 
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        <Plus size={14} />
                    </button>
                )}
            </div>

            {isOpen && !readOnly && (
                <div className="picker-dropdown custom-scrollbar">
                    <div className="picker-search-container">
                        <Search size={14} className="search-icon-inline" />
                        <input 
                            placeholder="Search members..." 
                            className="picker-search-input" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="members-list">
                        {filteredMembers.length === 0 ? (
                            <div className="no-members-found">No members found</div>
                        ) : (
                            filteredMembers.map(member => {
                                const isSelected = selectedIds.includes(member.id);
                                return (
                                    <div 
                                        key={member.id} 
                                        className={`member-option ${isSelected ? 'selected' : ''}`}
                                        onClick={() => toggleMember(member.id)}
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
                        <button type="button" className="picker-done-btn" onClick={() => setIsOpen(false)}>Done</button>
                    </div>
                </div>
            )}
        </div>
    );
}
