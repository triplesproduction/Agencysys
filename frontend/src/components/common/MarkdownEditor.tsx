'use client';

import React, { useRef, useState } from 'react';
import { 
    Type, Bold, Italic, List, ListOrdered, 
    Link as LinkIcon, Image as ImageIcon, Plus, 
    ChevronDown
} from 'lucide-react';


import './MarkdownEditor.css';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    readOnly?: boolean;
}

export default function MarkdownEditor({ value, onChange, onBlur, placeholder, readOnly }: MarkdownEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    // Simple markdown highlighting function for the overlay
    const highlightMarkdown = (text: string) => {
        if (!text) return '<span class="placeholder">' + (placeholder || 'Type description...') + '</span>';
        
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Order matters: multi-line blocks first, then inline
        
        // Headers (H1, H2) - must match from start of line
        html = html.replace(/^# (.*?)$/gm, '<span class="md-h1"><span class="md-tag"># </span>$1</span>');
        html = html.replace(/^## (.*?)$/gm, '<span class="md-h2"><span class="md-tag">## </span>$1</span>');
        
        // Lists
        html = html.replace(/^- (.*?)$/gm, '<span class="md-list"><span class="md-tag">- </span>$1</span>');

        // Inline Bold / Italic
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="md-bold"><span class="md-tag">**</span>$1<span class="md-tag">**</span></strong>');
        html = html.replace(/\*(.*?)\*/g, '<em class="md-italic"><span class="md-tag">*</span>$1<span class="md-tag">*</span></em>');
        html = html.replace(/__(.*?)__/g, '<strong class="md-bold"><span class="md-tag">__</span>$1<span class="md-tag">__</span></strong>');
        html = html.replace(/_(.*?)_/g, '<em class="md-italic"><span class="md-tag">_</span>$1<span class="md-tag">_</span></em>');
        
        // Strikethrough
        html = html.replace(/~~(.*?)~~/g, '<del class="md-strike"><span class="md-tag">~~</span>$1<span class="md-tag">~~</span></del>');
        
        // Links
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<span class="md-link"><span class="md-tag">[</span>$1<span class="md-tag">](</span>$2<span class="md-tag">)</span></span>');
        
        // Preserving line breaks for the HTML overlay
        html = html.replace(/\n/g, '<br/>');
            
        return html;
    };

    // Keep scroll in sync
    const handleScroll = () => {
        if (textareaRef.current && previewRef.current) {
            previewRef.current.scrollTop = textareaRef.current.scrollTop;
            previewRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    const insertText = (e: React.MouseEvent | React.FocusEvent, before: string, after: string = '') => {
        if (e && 'preventDefault' in e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        if (readOnly) return;
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selected = text.substring(start, end);
        
        const beforeText = text.substring(0, start);
        const afterText = text.substring(end);
        
        const newValue = beforeText + before + selected + after + afterText;
        
        onChange(newValue);
        
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + (selected ? before.length + selected.length + after.length : before.length);
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 10);
    };





    return (
        <div className={`premium-editor-container ${readOnly ? 'readonly' : ''}`}>
            {!readOnly && (
                <div className="editor-toolbar">
                    <div className="toolbar-group">
                        <div 
                            role="button" 
                            className="toolbar-btn" 
                            onMouseDown={(e) => insertText(e, '**', '**')} 
                            title="Bold"
                        >
                            <Bold size={16} />
                        </div>
                        <div 
                            role="button" 
                            className="toolbar-btn" 
                            onMouseDown={(e) => insertText(e, '_', '_')} 
                            title="Italic"
                        >
                            <Italic size={16} />
                        </div>
                        <div 
                            role="button" 
                            className="toolbar-btn" 
                            onMouseDown={(e) => insertText(e, '~~', '~~')} 
                            title="Strikethrough"
                        >
                            <span style={{ textDecoration: 'line-through', fontWeight: 'bold' }}>S</span>
                        </div>
                    </div>
                    
                    <div className="toolbar-divider"></div>

                    <div className="toolbar-group">
                        <div 
                            role="button" 
                            className="toolbar-btn" 
                            onMouseDown={(e) => insertText(e, '# ', '')} 
                            title="Heading 1"
                        >
                            H1
                        </div>
                        <div 
                            role="button" 
                            className="toolbar-btn" 
                            onMouseDown={(e) => insertText(e, '## ', '')} 
                            title="Heading 2"
                        >
                            H2
                        </div>
                        
                        <div className="toolbar-divider"></div>

                        <div 
                            role="button" 
                            className="toolbar-btn" 
                            onMouseDown={(e) => insertText(e, '- ', '')} 
                            title="Bullet list"
                        >
                            <List size={16} />
                        </div>

                        <div className="toolbar-divider"></div>

                        <div 
                            role="button" 
                            className="toolbar-btn" 
                            onMouseDown={(e) => insertText(e, '[', '](url)')} 
                            title="Link"
                        >
                            <LinkIcon size={16} />
                        </div>
                    </div>
                </div>
            )}

            <div className="editor-content-area unified-editor">
                <div 
                    ref={previewRef}
                    className="editor-hl-overlay custom-scrollbar"
                    dangerouslySetInnerHTML={{ __html: highlightMarkdown(value) }}
                />
                <textarea
                    ref={textareaRef}
                    className="editor-textarea-base custom-scrollbar"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onScroll={handleScroll}
                    onBlur={onBlur}
                    placeholder={placeholder || 'Type here...'}
                    readOnly={readOnly}
                    spellCheck={false}
                />
            </div>
        </div>
    );
}
