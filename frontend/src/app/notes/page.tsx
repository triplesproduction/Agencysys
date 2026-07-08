'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Plus, Search, StickyNote, Pin, PinOff,
    Trash2, Lock, Users, Briefcase, Check,
    FolderKanban, ChevronDown, Palette, X,
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, CheckSquare, Quote, Code,
    Heading1, Heading2, Heading3, Highlighter, Undo, Redo, Minus,
    AlertTriangle, Download
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import NoteEditor from '@/components/notes/NoteEditor';
import NoteCard from '@/components/notes/NoteCard';
import { useAuth } from '@/context/AuthContext';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '@/hooks/queries/domains/notes/useNotes';
import { useProjects } from '@/hooks/queries/domains/projects/useProjects';
import { getResolvedRole } from '@/lib/permissions';
import { NoteDTO, ProjectDTO } from '@/types/dto';
import { useNotifications } from '@/components/notifications/NotificationProvider';

import './Notes.css';

type TabType = 'personal' | 'project';

const NOTE_COLORS = [
    { name: 'none', label: 'Default', color: 'transparent' },
    { name: 'purple', label: 'Purple', color: '#8B5CF6' },
    { name: 'blue', label: 'Blue', color: '#3B82F6' },
    { name: 'green', label: 'Green', color: '#10B981' },
    { name: 'orange', label: 'Orange', color: '#F97316' },
    { name: 'pink', label: 'Pink', color: '#EC4899' },
    { name: 'red', label: 'Red', color: '#EF4444' },
];

export default function NotesPage() {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const { addNotification } = useNotifications();

    const [activeTab, setActiveTab] = useState<TabType>('personal');
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [projectFilter, setProjectFilter] = useState<string>('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Create Note Modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteScope, setNewNoteScope] = useState<'personal' | 'project'>('personal');
    const [newNoteProjectId, setNewNoteProjectId] = useState('');
    const [newNoteVisibility, setNewNoteVisibility] = useState<'private' | 'team'>('private');

    const userRole = authEmployee ? getResolvedRole(authEmployee.roleId) : 'EMPLOYEE';

    // Queries — Employees see only assigned projects, Admin/Manager see all
    const { data: notes = [], isLoading: isNotesLoading, refetch: refetchNotes } = useNotes(authEmployee?.id);
    const { data: projects = [] } = useProjects(
        userRole === 'EMPLOYEE' ? authEmployee?.id : undefined,
        { enabled: !!authEmployee }
    );

    // Mutations
    const { mutateAsync: createNote } = useCreateNote();
    const { mutateAsync: updateNote } = useUpdateNote();
    const { mutateAsync: deleteNote } = useDeleteNote();

    // Filtered notes
    const filteredNotes = useMemo(() => {
        let filtered = notes;

        // Tab filter
        if (activeTab === 'personal') {
            filtered = filtered.filter(n => !n.projectId);
        } else {
            filtered = filtered.filter(n => !!n.projectId);
            if (projectFilter) {
                filtered = filtered.filter(n => n.projectId === projectFilter);
            }
        }

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(n =>
                n.title.toLowerCase().includes(q)
            );
        }

        // Sort: pinned first, then by updatedAt
        return [...filtered].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
    }, [notes, activeTab, searchQuery, projectFilter]);

    // Selected note
    const selectedNote = useMemo(() => {
        if (!selectedNoteId) return null;
        return notes.find(n => n.id === selectedNoteId) || null;
    }, [notes, selectedNoteId]);

    // Auto-select first note when list changes
    useEffect(() => {
        if (!selectedNoteId && filteredNotes.length > 0) {
            setSelectedNoteId(filteredNotes[0].id);
        }
    }, [filteredNotes, selectedNoteId]);

    // Create new note
    const handleCreateNote = async () => {
        if (!authEmployee) return;
        setIsCreateModalOpen(true);
        setNewNoteTitle('');
        setNewNoteScope(activeTab === 'project' ? 'project' : 'personal');
        setNewNoteProjectId(projectFilter || (projects.length > 0 ? projects[0].id : ''));
        setNewNoteVisibility(activeTab === 'project' ? 'team' : 'private');
    };

    const submitCreateNote = async () => {
        if (!authEmployee) return;
        try {
            const title = newNoteTitle.trim() || 'Untitled Note';
            const projectId = newNoteScope === 'project' ? newNoteProjectId : undefined;
            const visibility = newNoteScope === 'project' ? newNoteVisibility : 'private';

            const newNote = await createNote({
                title,
                employeeId: authEmployee.id,
                projectId,
                visibility,
            });

            setIsCreateModalOpen(false);

            // Auto-navigate to show the new note
            if (newNoteScope === 'project') {
                setActiveTab('project');
                if (projectId) {
                    setProjectFilter(projectId);
                }
            } else {
                setActiveTab('personal');
            }

            setSelectedNoteId(newNote.id);
            await refetchNotes();
        } catch (err) {
            addNotification({ title: 'Error', message: 'Could not create note.', type: 'error' });
        }
    };

    // Auto-save content
    const handleContentUpdate = useCallback(async (content: any) => {
        if (!selectedNoteId) return;
        setSaveStatus('saving');
        try {
            await updateNote({ id: selectedNoteId, payload: { content } });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) {
            setSaveStatus('idle');
        }
    }, [selectedNoteId, updateNote]);

    // Update title
    const handleTitleChange = useCallback(async (title: string) => {
        if (!selectedNoteId) return;
        setSaveStatus('saving');
        try {
            await updateNote({ id: selectedNoteId, payload: { title } });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
            setSaveStatus('idle');
        }
    }, [selectedNoteId, updateNote]);

    // Toggle pin
    const handleTogglePin = async () => {
        if (!selectedNote) return;
        try {
            await updateNote({ id: selectedNote.id, payload: { pinned: !selectedNote.pinned } });
            refetchNotes();
        } catch {
            addNotification({ title: 'Error', message: 'Could not update note.', type: 'error' });
        }
    };

    // Toggle visibility
    const handleToggleVisibility = async () => {
        if (!selectedNote) return;
        const newVis = selectedNote.visibility === 'private' ? 'team' : 'private';
        try {
            await updateNote({ id: selectedNote.id, payload: { visibility: newVis } });
            refetchNotes();
        } catch {
            addNotification({ title: 'Error', message: 'Could not update note.', type: 'error' });
        }
    };

    // Set color
    const handleSetColor = async (color: string) => {
        if (!selectedNote) return;
        try {
            await updateNote({ id: selectedNote.id, payload: { color: color === 'none' ? null : color } });
            setShowColorPicker(false);
            refetchNotes();
        } catch {
            addNotification({ title: 'Error', message: 'Could not update note.', type: 'error' });
        }
    };

    // Set project
    const handleSetProject = async (projectId: string | null) => {
        if (!selectedNote) return;
        try {
            await updateNote({
                id: selectedNote.id,
                payload: {
                    projectId,
                    visibility: projectId ? 'team' : 'private'
                }
            });
            setShowProjectPicker(false);
            refetchNotes();
        } catch {
            addNotification({ title: 'Error', message: 'Could not update note.', type: 'error' });
        }
    };

    // Delete note — with custom modal
    const handleDeleteNote = async () => {
        if (!selectedNote) return;
        setIsDeleting(true);
        try {
            const currentIdx = filteredNotes.findIndex(n => n.id === selectedNote.id);
            await deleteNote(selectedNote.id);
            const remaining = filteredNotes.filter(n => n.id !== selectedNote.id);
            if (remaining.length > 0) {
                const nextIdx = Math.min(currentIdx, remaining.length - 1);
                setSelectedNoteId(remaining[nextIdx].id);
            } else {
                setSelectedNoteId(null);
            }
            refetchNotes();
            setShowDeleteModal(false);
            addNotification({ title: 'Deleted', message: 'Note deleted successfully.', type: 'info' });
        } catch {
            addNotification({ title: 'Error', message: 'Could not delete note.', type: 'error' });
        } finally {
            setIsDeleting(false);
        }
    };

    // Download note as PDF
    const handleDownloadPDF = async () => {
        if (!selectedNote) return;
        
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const margin = 20;
            const pageWidth = 210;
            const pageHeight = 297;
            const contentWidth = pageWidth - (margin * 2);
            let y = 25;

            // Brand Header Line
            doc.setFillColor(139, 92, 246); // Purple brand
            doc.rect(margin, y, contentWidth, 2, 'F');
            y += 8;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('TRIPLES OS • DOCUMENT ARCHIVE', margin, y);
            y += 12;

            // Note Title
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(33, 33, 33);
            const titleLines = doc.splitTextToSize(selectedNote.title, contentWidth);
            doc.text(titleLines, margin, y);
            y += (titleLines.length * 8) + 6;

            // Meta Info
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(110, 110, 110);
            const dateStr = new Date(selectedNote.updatedAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            const authorName = authEmployee ? `${authEmployee.firstName} ${authEmployee.lastName}` : 'System User';
            const projName = selectedNote.project?.name ? `Project: ${selectedNote.project.name}` : 'Personal Note';
            doc.text(`Author: ${authorName}   |   Date: ${dateStr}   |   ${projName}`, margin, y);
            y += 8;

            // Separator Line
            doc.setDrawColor(230, 230, 230);
            doc.setLineWidth(0.5);
            doc.line(margin, y, pageWidth - margin, y);
            y += 12;

            // Get editor content DOM
            const editorEl = document.querySelector('.note-editor-content');
            if (editorEl) {
                const children = Array.from(editorEl.childNodes);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(60, 60, 60);

                for (const node of children) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    const el = node as HTMLElement;
                    const tag = el.tagName.toLowerCase();
                    const text = el.innerText || el.textContent || '';
                    if (!text.trim() && tag !== 'br') continue;

                    // Formatting styles based on HTML tags
                    if (tag === 'h1') {
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(16);
                        doc.setTextColor(33, 33, 33);
                        y += 4;
                    } else if (tag === 'h2') {
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(14);
                        doc.setTextColor(44, 44, 44);
                        y += 3;
                    } else if (tag === 'h3') {
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(12);
                        doc.setTextColor(55, 55, 55);
                        y += 2;
                    } else if (tag === 'blockquote') {
                        doc.setFont('helvetica', 'italic');
                        doc.setFontSize(10);
                        doc.setTextColor(100, 100, 100);
                    } else {
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(10);
                        doc.setTextColor(60, 60, 60);
                    }

                    // Render lists (bullets and ordered lists)
                    if (tag === 'ul' || tag === 'ol') {
                        const items = el.querySelectorAll('li');
                        let count = 1;
                        for (const item of Array.from(items)) {
                            const itemText = item.innerText || '';
                            const bullet = tag === 'ul' ? '• ' : `${count}. `;
                            const fullItemText = bullet + itemText;
                            count++;
                            
                            const splitLines = doc.splitTextToSize(fullItemText, contentWidth - 6);
                            for (const line of splitLines) {
                                if (y + 7 > pageHeight - margin) {
                                    doc.addPage();
                                    y = margin;
                                }
                                doc.text(line, margin + 6, y);
                                y += 6;
                            }
                            y += 2;
                        }
                        continue;
                    }

                    // Render standard paragraphs
                    const splitLines = doc.splitTextToSize(text, contentWidth);
                    const lineSpacing = 6;
                    const startY = y;
                    
                    for (const line of splitLines) {
                        if (y + 7 > pageHeight - margin) {
                            doc.addPage();
                            y = margin;
                        }
                        doc.text(line, margin, y);
                        y += lineSpacing;
                    }

                    // Blockquote styling (sidebar border)
                    if (tag === 'blockquote') {
                        doc.setDrawColor(139, 92, 246);
                        doc.setLineWidth(1.5);
                        doc.line(margin - 4, startY - 3, margin - 4, y - 3);
                    }

                    y += 4;
                }
            } else {
                // DOM fallback
                const text = selectedNote.content?.toString() || '';
                const splitLines = doc.splitTextToSize(text, contentWidth);
                for (const line of splitLines) {
                    if (y + 7 > pageHeight - margin) {
                        doc.addPage();
                        y = margin;
                    }
                    doc.text(line, margin, y);
                    y += 6;
                }
            }

            const sanitizedTitle = selectedNote.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            doc.save(`${sanitizedTitle || 'note'}.pdf`);
            addNotification({ title: 'Success', message: 'PDF generated successfully.', type: 'info' });
        } catch (err) {
            addNotification({ title: 'Error', message: 'Failed to generate PDF.', type: 'error' });
        }
    };

    if (authLoading) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    const personalCount = notes.filter(n => !n.projectId).length;
    const projectCount = notes.filter(n => !!n.projectId).length;

    return (
        <div className="notes-page page-root fade-in">
            <PageHeader
                title="Notes"
                subtitle={
                    <div className="page-stats-inline">
                        <span><StickyNote size={14} style={{ color: 'var(--purple-light)' }} /> {notes.length} Notes</span>
                        <span className="active"><Pin size={14} /> {notes.filter(n => n.pinned).length} Pinned</span>
                    </div>
                }
                actions={
                    <button className="page-action-btn-primary" onClick={handleCreateNote}>
                        <Plus size={18} /> New Note
                    </button>
                }
            />

            <div className="notes-layout">
                {/* LEFT PANEL — Note List */}
                <div className="notes-sidebar">
                    {/* Tab Switcher — Pill style */}
                    <div className="notes-tab-bar">
                        <div className="notes-tab-track">
                            <div className={`notes-tab-indicator ${activeTab === 'project' ? 'right' : 'left'}`} />
                            <button
                                className={`notes-tab ${activeTab === 'personal' ? 'active' : ''}`}
                                onClick={() => { setActiveTab('personal'); setSelectedNoteId(null); }}
                            >
                                <Lock size={13} />
                                My Notes
                                <span className="tab-count">{personalCount}</span>
                            </button>
                            <button
                                className={`notes-tab ${activeTab === 'project' ? 'active' : ''}`}
                                onClick={() => { setActiveTab('project'); setSelectedNoteId(null); }}
                            >
                                <Briefcase size={13} />
                                Project Notes
                                <span className="tab-count">{projectCount}</span>
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="notes-search">
                        <Search size={14} />
                        <input
                            placeholder="Search notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Project Filter (only on project tab) */}
                    {activeTab === 'project' && (
                        <div className="notes-project-filter">
                            <FolderKanban size={14} />
                            <select
                                value={projectFilter}
                                onChange={(e) => { setProjectFilter(e.target.value); setSelectedNoteId(null); }}
                            >
                                <option value="">All Projects</option>
                                {projects.map((p: ProjectDTO) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="select-chevron" />
                        </div>
                    )}

                    {/* Note List */}
                    <div className="notes-list custom-scrollbar">
                        {isNotesLoading ? (
                            Array(4).fill(0).map((_, i) => (
                                <div key={i} className="note-card skeleton" style={{ height: '88px' }} />
                            ))
                        ) : filteredNotes.length === 0 ? (
                            <div className="notes-empty">
                                <StickyNote size={36} style={{ opacity: 0.08 }} />
                                <p>{activeTab === 'personal' ? 'No personal notes yet' : 'No project notes found'}</p>
                                <button className="notes-empty-btn" onClick={handleCreateNote}>
                                    <Plus size={14} /> Create one
                                </button>
                            </div>
                        ) : (
                            filteredNotes.map(note => (
                                <NoteCard
                                    key={note.id}
                                    note={note}
                                    isActive={selectedNoteId === note.id}
                                    onClick={() => setSelectedNoteId(note.id)}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL — Editor */}
                <div className="notes-editor-panel">
                    {selectedNote ? (
                        <>
                            {/* Fixed Header Bar — Title + Actions */}
                            <div className="notes-editor-header">
                                <div className="notes-header-top">
                                    <input
                                        className="note-title-input"
                                        value={selectedNote.title}
                                        onChange={(e) => handleTitleChange(e.target.value)}
                                        placeholder="Note title..."
                                    />
                                    <div className="note-meta-actions">
                                        {/* Save Status */}
                                        <span className={`save-status ${saveStatus}`}>
                                            {saveStatus === 'saving' && 'Saving...'}
                                            {saveStatus === 'saved' && <><Check size={12} /> Saved</>}
                                        </span>

                                        {/* Pin */}
                                        <button
                                            className={`meta-btn ${selectedNote.pinned ? 'active' : ''}`}
                                            onClick={handleTogglePin}
                                            title={selectedNote.pinned ? 'Unpin' : 'Pin'}
                                        >
                                            {selectedNote.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                                        </button>

                                        {/* Visibility */}
                                        <button
                                            className={`meta-btn ${selectedNote.visibility === 'team' ? 'team-active' : ''}`}
                                            onClick={handleToggleVisibility}
                                            title={selectedNote.visibility === 'private' ? 'Make visible to team' : 'Make private'}
                                        >
                                            {selectedNote.visibility === 'team' ? <Users size={15} /> : <Lock size={15} />}
                                        </button>

                                        {/* Color Picker */}
                                        <div className="color-picker-wrapper">
                                            <button
                                                className="meta-btn"
                                                onClick={() => { setShowColorPicker(!showColorPicker); setShowProjectPicker(false); }}
                                                title="Change color"
                                            >
                                                <Palette size={15} />
                                            </button>
                                            {showColorPicker && (
                                                <div className="color-picker-dropdown">
                                                    {NOTE_COLORS.map(c => (
                                                        <button
                                                            key={c.name}
                                                            className={`color-dot ${(selectedNote.color || 'none') === c.name ? 'selected' : ''}`}
                                                            style={{ background: c.name === 'none' ? 'rgba(255,255,255,0.1)' : c.color }}
                                                            onClick={() => handleSetColor(c.name)}
                                                            title={c.label}
                                                        >
                                                            {(selectedNote.color || 'none') === c.name && <Check size={10} />}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Project Picker */}
                                        <div className="color-picker-wrapper">
                                            <button
                                                className={`meta-btn ${selectedNote.projectId ? 'team-active' : ''}`}
                                                onClick={() => { setShowProjectPicker(!showProjectPicker); setShowColorPicker(false); }}
                                                title="Link to project"
                                            >
                                                <Briefcase size={15} />
                                            </button>
                                            {showProjectPicker && (
                                                <div className="project-picker-dropdown">
                                                    <button
                                                        className={`project-pick-item ${!selectedNote.projectId ? 'selected' : ''}`}
                                                        onClick={() => handleSetProject(null)}
                                                    >
                                                        <X size={12} /> No project (personal)
                                                    </button>
                                                    {projects.map((p: ProjectDTO) => (
                                                        <button
                                                            key={p.id}
                                                            className={`project-pick-item ${selectedNote.projectId === p.id ? 'selected' : ''}`}
                                                            onClick={() => handleSetProject(p.id)}
                                                        >
                                                            <Briefcase size={12} /> {p.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Download PDF */}
                                        <button className="meta-btn" onClick={handleDownloadPDF} title="Download PDF">
                                            <Download size={15} />
                                        </button>

                                        {/* Delete */}
                                        <button className="meta-btn danger" onClick={() => setShowDeleteModal(true)} title="Delete note">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>

                                {/* Project tag inline */}
                                {selectedNote.project && (
                                    <div className="note-project-tag">
                                        <Briefcase size={11} />
                                        {selectedNote.project.name}
                                        <span className="note-project-vis">
                                            {selectedNote.visibility === 'team' ? 'Team visible' : 'Private'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Editor Body — Clean writing area, no toolbar clutter */}
                            <div className="notes-editor-body custom-scrollbar">
                                <NoteEditor
                                    key={selectedNote.id}
                                    content={selectedNote.content}
                                    onUpdate={handleContentUpdate}
                                    placeholder="Start writing your note..."
                                />
                            </div>
                        </>
                    ) : (
                        <div className="notes-editor-empty">
                            <div className="empty-icon-wrap">
                                <StickyNote size={48} />
                            </div>
                            <h3>Select a note or create a new one</h3>
                            <p>Your notes are auto-saved as you type</p>
                            <button className="page-action-btn-primary" onClick={handleCreateNote}>
                                <Plus size={16} /> Create Note
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ============ DELETE CONFIRMATION MODAL ============ */}
            {showDeleteModal && selectedNote && (
                <div className="delete-modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
                    <div className="delete-modal" onClick={e => e.stopPropagation()}>
                        <div className="delete-modal-icon">
                            <AlertTriangle size={28} />
                        </div>
                        <h3 className="delete-modal-title">Delete Note</h3>
                        <p className="delete-modal-desc">
                            Are you sure you want to delete <strong>"{selectedNote.title}"</strong>? This action cannot be undone.
                        </p>
                        <div className="delete-modal-actions">
                            <button
                                className="delete-modal-cancel"
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="delete-modal-confirm"
                                onClick={handleDeleteNote}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <><span className="btn-spinner" /> Deleting...</>
                                ) : (
                                    <><Trash2 size={14} /> Delete Note</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ CREATE NOTE MODAL ============ */}
            {isCreateModalOpen && (
                <div className="note-modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
                    <div className="note-modal" onClick={e => e.stopPropagation()}>
                        <h3 className="note-modal-title">
                            <StickyNote size={20} style={{ color: 'var(--purple-main)' }} /> Create New Note
                        </h3>

                        <div className="note-modal-field">
                            <label className="note-modal-label">Title</label>
                            <input
                                className="note-modal-input"
                                placeholder="Note title (e.g. Sprint Notes, Ideas...)"
                                value={newNoteTitle}
                                onChange={e => setNewNoteTitle(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="note-modal-field">
                            <label className="note-modal-label">Scope</label>
                            <div className="note-modal-scopes">
                                <div
                                    className={`note-modal-scope-card ${newNoteScope === 'personal' ? 'selected' : ''}`}
                                    onClick={() => setNewNoteScope('personal')}
                                >
                                    <div className="note-modal-scope-icon">
                                        <Lock size={18} />
                                    </div>
                                    <div className="note-modal-scope-name">Personal</div>
                                    <div className="note-modal-scope-desc">Only visible to you. Private notes.</div>
                                </div>
                                <div
                                    className={`note-modal-scope-card ${newNoteScope === 'project' ? 'selected' : ''}`}
                                    onClick={() => setNewNoteScope('project')}
                                >
                                    <div className="note-modal-scope-icon">
                                        <Briefcase size={18} />
                                    </div>
                                    <div className="note-modal-scope-name">Project-scoped</div>
                                    <div className="note-modal-scope-desc">Associated with a project and team.</div>
                                </div>
                            </div>
                        </div>

                        {newNoteScope === 'project' && (
                            <>
                                <div className="note-modal-field">
                                    <label className="note-modal-label">Project</label>
                                    <div className="note-modal-select-wrapper">
                                        <select
                                            className="note-modal-select"
                                            value={newNoteProjectId}
                                            onChange={e => setNewNoteProjectId(e.target.value)}
                                        >
                                            {projects.map((p: ProjectDTO) => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="note-modal-select-chevron" />
                                    </div>
                                </div>

                                <div className="note-modal-field">
                                    <label className="note-modal-label">Team Visibility</label>
                                    <div className="visibility-toggle-group">
                                        <button
                                            type="button"
                                            className={`visibility-toggle-btn ${newNoteVisibility === 'team' ? 'selected' : ''}`}
                                            onClick={() => setNewNoteVisibility('team')}
                                        >
                                            <Users size={14} /> Shared with Team
                                        </button>
                                        <button
                                            type="button"
                                            className={`visibility-toggle-btn ${newNoteVisibility === 'private' ? 'selected' : ''}`}
                                            onClick={() => setNewNoteVisibility('private')}
                                        >
                                            <Lock size={14} /> Keep Private to Me
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="note-modal-actions">
                            <button
                                className="note-modal-btn-cancel"
                                onClick={() => setIsCreateModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="note-modal-btn-create"
                                onClick={submitCreateNote}
                                disabled={newNoteScope === 'project' && !newNoteProjectId}
                            >
                                <Plus size={16} /> Create Note
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
