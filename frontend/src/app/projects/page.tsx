'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Plus, Search, Filter, 
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
            <div className="emp-header">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h1 className="emp-title">Project Hub</h1>
                    <div className="emp-stats-inline">
                        <span><FolderKanban size={13} /> {projects.length} Total</span>
                        <span className="active"><CheckCircle size={13} /> {activeCount} Active</span>
                    </div>
                </div>
                <div className="emp-header-actions">
                    <div className="emp-search" style={{ minWidth: '280px' }}>
                        <Search size={16} />
                        <input 
                            placeholder="Explore initiatives..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="emp-filter-group">
                        <select 
                            className="emp-glass-select" 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">Global Visibility</option>
                            <option value="PLANNING">Planning</option>
                            <option value="ACTIVE">Active</option>
                            <option value="ON_HOLD">Stalled</option>
                            <option value="COMPLETED">Archived</option>
                        </select>
                    </div>

                    {userRole !== 'EMPLOYEE' && (
                        <button className="emp-action-btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                            <Plus size={16} /> Launch Project
                        </button>
                    )}
                </div>
            </div>

            {/* 3. PROJECTS GRID */}
            <div className="projects-grid">
                {loading ? (
                    Array(6).fill(0).map((_, i) => (
                        <div key={i} className="project-card skeleton" style={{ height: '160px' }} />
                    ))
                ) : filteredProjects.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '100px', textAlign: 'center', pointerEvents: 'none' }}>
                        <Briefcase size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                        <h3 style={{ fontSize: '1.25rem', opacity: 0.5 }}>No projects match your current filter.</h3>
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
                                        {project.members?.slice(0, 3).map((m, idx) => (
                                            <div key={idx} className="team-av" title={`${m.user?.firstName} ${m.user?.lastName}`}>
                                                {m.user?.profilePhoto ? (
                                                    <img src={m.user.profilePhoto} alt="" />
                                                ) : (
                                                    <span>{m.user?.firstName?.[0]}</span>
                                                )}
                                            </div>
                                        ))}
                                        {project.members && project.members.length > 3 && (
                                            <div className="team-av" style={{ background: 'rgba(255,255,255,0.05)', fontSize: '8px' }}>
                                                +{project.members.length - 3}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <h3 className="card-title">{project.name}</h3>
                                <p className="card-desc">{project.description || 'No strategic breakdown provided.'}</p>
                                
                                <div className="card-progress-section">
                                    <div className="progress-meta">
                                        <span className="progress-label">{progress}% Sync</span>
                                        <span className={`progress-deadline ${overdue ? 'overdue' : ''}`}>
                                            {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'No Est.'}
                                        </span>
                                    </div>
                                    <div className="progress-bar-outer">
                                        <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
                                    </div>
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
