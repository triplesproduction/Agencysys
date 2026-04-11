'use client';

import React, { useState } from 'react';
import { User, X, Check, Plus } from 'lucide-react';
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

    const toggleMember = (id: string) => {
        if (readOnly) return;
        const newIds = selectedIds.includes(id)
            ? selectedIds.filter(sid => sid !== id)
            : [...selectedIds, id];
        onChange(newIds);
    };

    const selectedMembers = members.filter(m => selectedIds.includes(m.id));

    return (
        <div className="multi-picker-container">
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
                            <button className="tag-remove" onClick={() => toggleMember(member.id)}>
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ))}

                {!readOnly && (
                    <button 
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
                        <input placeholder="Search members..." className="picker-search-input" />
                    </div>
                    <div className="members-list">
                        {members.map(member => {
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
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
