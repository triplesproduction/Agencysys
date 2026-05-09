'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Plus, Search, Filter, ChevronDown,
    Briefcase, Calendar, Clock, AlertCircle,
    CheckCircle2, Users, ArrowUpRight, FolderKanban, CheckCircle
} from 'lucide-react';
import Button from '@/components/Button';
import GlassCard from '@/components/GlassCard';
import CreateProjectModal from '@/components/projects/CreateProjectModal';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { api } from '@/lib/api';
import { ProjectDTO } from '@/types/dto';
import { useAuth } from '@/context/AuthContext';
import { getResolvedRole } from '@/lib/permissions';

import './Projects.css';

export default function ProjectsPage() {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const router = useRouter();
    const { addNotification } = useNotifications();
    
    const [projects, setProjects] = useState<ProjectDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const userRole = authEmployee ? getResolvedRole(authEmployee.roleId) : 'EMPLOYEE';

    const loadProjects = async () => {
        if (!authEmployee) return;
        setLoading(true);
        try {
            const data = await api.getProjects(userRole === 'EMPLOYEE' ? authEmployee.id : undefined);
            setProjects(data);
        } catch (err) {
            console.error('Failed to load projects:', err);
            addNotification({ title: 'Error', message: 'Could not load projects.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading) loadProjects();
    }, [authEmployee, authLoading]);

    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [projects, searchQuery, statusFilter]);

    const calculateProgress = (project: ProjectDTO) => {
        if (!project.tasks || project.tasks.length === 0) return 0;
        const completed = project.tasks.filter(t => t.status === 'DONE' || t.status === 'APPROVED').length;
        return Math.round((completed / project.tasks.length) * 100);
    };

    const isOverdue = (deadline?: string) => {
        if (!deadline) return false;
        return new Date(deadline) < new Date() && new Date(deadline).toDateString() !== new Date().toDateString();
    };

    if (authLoading || loading) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    const activeCount = projects.filter(p => p.status === 'ACTIVE').length;

    return (
        <div className="projects-page fade-in">
            <header className="emp-header">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h1 className="emp-title">Project Hub</h1>
                    <div className="emp-stats-inline">
                        <span><FolderKanban size={14} style={{ color: 'var(--purple-light)' }} /> {projects.length} Initiatives</span>
                        <span className="active"><CheckCircle2 size={14} /> {activeCount} Operational</span>
                    </div>
                </div>
                <div className="emp-header-actions">
                    <div className="emp-search">
                        <Search size={16} />
                        <input 
                            placeholder="Search projects..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="emp-filter-group">
                        <Filter size={16} className="filter-icon" />
                        <select 
                            className="emp-glass-select" 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PLANNING">Planning Phase</option>
                            <option value="ACTIVE">Active Engagement</option>
                            <option value="ON_HOLD">On Hold</option>
                            <option value="COMPLETED">Successfully Closed</option>
                        </select>
                        <ChevronDown size={16} className="chevron-icon" />
                    </div>

                    {userRole !== 'EMPLOYEE' && (
                        <button className="emp-action-btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                            <Plus size={18} /> New project
                        </button>
                    )}
                </div>
            </header>

            {/* Projects Grid */}
            <div className="projects-grid">
                {loading ? (
                    Array(6).fill(0).map((_, i) => (
                        <div key={i} className="project-card skeleton" style={{ height: '240px' }} />
                    ))
                ) : filteredProjects.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '8rem 2rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '32px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                            <Briefcase size={40} style={{ opacity: 0.1 }} />
                        </div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white', marginBottom: '8px' }}>No Strategic Objectives Found</h3>
                        <p style={{ color: 'rgba(255,255,255,0.3)', maxWidth: '400px', margin: '0 auto' }}>Your current filters haven't yielded any results. Try adjusting your search or category selection.</p>
                    </div>
                ) : (
                    filteredProjects.map((project) => {
                        const progress = calculateProgress(project);
                        const overdue = isOverdue(project.deadline) && project.status !== 'COMPLETED';
                        
                        return (
                            <div 
                                key={project.id} 
                                className="project-card" 
                                onClick={() => router.push(`/projects/${project.id}`)}
                            >
                                <div className="card-top">
                                    <span className={`status-pill status-${project.status.toLowerCase()}`}>
                                        {project.status.replace('_', ' ')}
                                    </span>
                                    <div className="card-team-stack">
                                        {project.members?.slice(0, 4).map((m, idx) => (
                                            <div key={idx} className="team-av" title={`${m.user?.firstName} ${m.user?.lastName}`}>
                                                {m.user?.profilePhoto ? (
                                                    <img src={m.user.profilePhoto} alt="" />
                                                ) : (
                                                    <span>{m.user?.firstName?.[0]}</span>
                                                )}
                                            </div>
                                        ))}
                                        {project.members && project.members.length > 4 && (
                                            <div className="team-av" style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--purple-light)', fontSize: '9px' }}>
                                                +{project.members.length - 4}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ flex: 1 }}>
                                    <h3 className="card-title">{project.name}</h3>
                                    <p className="card-desc">{project.description || 'No strategic breakdown provided for this initiative.'}</p>
                                </div>
                                
                                <div className="card-progress-section">
                                    <div className="progress-meta">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div className="progress-label">{progress}% Sync</div>
                                            {progress === 100 && <CheckCircle2 size={12} style={{ color: '#10B981' }} />}
                                        </div>
                                        <div className={`progress-deadline ${overdue ? 'overdue' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Calendar size={12} />
                                            {project.deadline ? new Date(project.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'No Est.'}
                                        </div>
                                    </div>
                                    <div className="progress-bar-outer">
                                        <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
                                
                                <div style={{ position: 'absolute', right: '1.5rem', bottom: '1.5rem', opacity: 0, transform: 'translateX(-10px)', transition: 'all 0.4s ease' }} className="card-arrow">
                                    <ArrowUpRight size={20} style={{ color: 'var(--purple-light)' }} />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <CreateProjectModal 
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={(id) => {
                    loadProjects();
                    addNotification({ title: 'Success', message: 'Project synchronization complete.', type: 'success' });
                    router.push(`/projects/${id}`);
                }}
            />
        </div>
    );
}
