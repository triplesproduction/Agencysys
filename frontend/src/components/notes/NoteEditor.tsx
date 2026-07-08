'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, CheckSquare, Quote, Code,
    Heading1, Heading2, Heading3, Highlighter, Undo, Redo
} from 'lucide-react';

interface NoteEditorProps {
    content: any;
    onUpdate: (content: any) => void;
    placeholder?: string;
    editable?: boolean;
}

export default function NoteEditor({ content, onUpdate, placeholder = 'Start writing...', editable = true }: NoteEditorProps) {
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [showToolbar, setShowToolbar] = useState(false);
    const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: { HTMLAttributes: { class: 'note-code-block' } },
            }),
            Placeholder.configure({ placeholder }),
            Underline,
            TaskList,
            TaskItem.configure({ nested: true }),
            Highlight.configure({ multicolor: false }),
        ],
        content: content || '',
        editable,
        editorProps: {
            attributes: {
                class: 'note-editor-content',
            },
        },
        onUpdate: ({ editor }) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                onUpdate(editor.getJSON());
            }, 1500);
        },
        onSelectionUpdate: ({ editor }) => {
            const { from, to } = editor.state.selection;
            if (from === to) {
                setShowToolbar(false);
                return;
            }
            // Get selection coordinates relative to viewport
            const coords = editor.view.coordsAtPos(from);
            const maxLeft = typeof window !== 'undefined' ? window.innerWidth - 420 : 1000;
            setToolbarPos({
                top: Math.max(10, coords.top - 48), // Don't go off top of screen
                left: Math.max(10, Math.min(coords.left, maxLeft)),
            });
            setShowToolbar(true);
        },
        onBlur: () => {
            // Small delay so toolbar button clicks register
            setTimeout(() => setShowToolbar(false), 200);
        },
    });

    // Sync content when switching between notes
    useEffect(() => {
        if (editor && content) {
            const currentJSON = JSON.stringify(editor.getJSON());
            const newJSON = JSON.stringify(content);
            if (currentJSON !== newJSON) {
                editor.commands.setContent(content);
            }
        }
    }, [content, editor]);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    if (!editor) return null;

    return (
        <div className="note-editor-wrapper" ref={wrapperRef}>
            {/* Floating Toolbar — appears on text selection */}
            {showToolbar && (
                <div
                    className="bubble-toolbar"
                    style={{ top: `${toolbarPos.top}px`, left: `${toolbarPos.left}px` }}
                    onMouseDown={e => e.preventDefault()}
                >
                    <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`bubble-btn ${editor.isActive('bold') ? 'active' : ''}`}
                        title="Bold"
                    >
                        <Bold size={14} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`bubble-btn ${editor.isActive('italic') ? 'active' : ''}`}
                        title="Italic"
                    >
                        <Italic size={14} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={`bubble-btn ${editor.isActive('underline') ? 'active' : ''}`}
                        title="Underline"
                    >
                        <UnderlineIcon size={14} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        className={`bubble-btn ${editor.isActive('strike') ? 'active' : ''}`}
                        title="Strikethrough"
                    >
                        <Strikethrough size={14} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleHighlight().run()}
                        className={`bubble-btn ${editor.isActive('highlight') ? 'active' : ''}`}
                        title="Highlight"
                    >
                        <Highlighter size={14} />
                    </button>
                    <span className="bubble-divider" />
                    <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={`bubble-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
                        title="Heading 1"
                    >
                        <Heading1 size={14} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`bubble-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
                        title="Heading 2"
                    >
                        <Heading2 size={14} />
                    </button>
                    <span className="bubble-divider" />
                    <button
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`bubble-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
                        title="Bullet List"
                    >
                        <List size={14} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={`bubble-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
                        title="Numbered List"
                    >
                        <ListOrdered size={14} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleTaskList().run()}
                        className={`bubble-btn ${editor.isActive('taskList') ? 'active' : ''}`}
                        title="Checklist"
                    >
                        <CheckSquare size={14} />
                    </button>
                    <span className="bubble-divider" />
                    <button
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        className={`bubble-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
                        title="Quote"
                    >
                        <Quote size={14} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        className={`bubble-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
                        title="Code Block"
                    >
                        <Code size={14} />
                    </button>
                </div>
            )}

            {/* Google Docs style Fixed Toolbar */}
            {editable && (
                <div className="editor-fixed-toolbar" onMouseDown={e => e.preventDefault()}>
                    <button
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        className="toolbar-btn"
                        title="Undo"
                    >
                        <Undo size={15} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        className="toolbar-btn"
                        title="Redo"
                    >
                        <Redo size={15} />
                    </button>
                    <span className="toolbar-divider" />
                    
                    <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
                        title="Heading 1"
                    >
                        <Heading1 size={15} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
                        title="Heading 2"
                    >
                        <Heading2 size={15} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        className={`toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
                        title="Heading 3"
                    >
                        <Heading3 size={15} />
                    </button>
                    <span className="toolbar-divider" />

                    <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
                        title="Bold"
                    >
                        <Bold size={15} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
                        title="Italic"
                    >
                        <Italic size={15} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
                        title="Underline"
                    >
                        <UnderlineIcon size={15} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
                        title="Strikethrough"
                    >
                        <Strikethrough size={15} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleHighlight().run()}
                        className={`toolbar-btn ${editor.isActive('highlight') ? 'active' : ''}`}
                        title="Highlight"
                    >
                        <Highlighter size={15} />
                    </button>
                    <span className="toolbar-divider" />

                    <button
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
                        title="Bullet List"
                    >
                        <List size={15} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
                        title="Numbered List"
                    >
                        <ListOrdered size={15} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleTaskList().run()}
                        className={`toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`}
                        title="Checklist"
                    >
                        <CheckSquare size={15} />
                    </button>
                    <span className="toolbar-divider" />

                    <button
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
                        title="Blockquote"
                    >
                        <Quote size={15} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        className={`toolbar-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
                        title="Code Block"
                    >
                        <Code size={15} />
                    </button>
                </div>
            )}

            {/* Clean editor — just start typing */}
            <EditorContent editor={editor} />
        </div>
    );
}
