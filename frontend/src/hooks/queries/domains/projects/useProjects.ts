import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectKeys, taskKeys } from './keys';
import { api } from '@/lib/api';
import { ProjectDTO, TaskDTO } from '@/types/dto';

// --- Projects ---

export function useProjects(userId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: projectKeys.list(userId),
        queryFn: async () => {
            return await api.getProjects(userId);
        },
        staleTime: 5 * 60 * 1000,
        enabled: options?.enabled ?? true,
    });
}

export function useProjectDetail(id: string) {
    return useQuery({
        queryKey: projectKeys.detail(id),
        queryFn: async () => {
            return await api.getProjectById(id);
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: Partial<ProjectDTO>) => {
            return await api.createProject(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

export function useUpdateProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: Partial<ProjectDTO> }) => {
            return await api.updateProject(id, payload);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

export function useDeleteProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            return await api.deleteProject(id);
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
            queryClient.removeQueries({ queryKey: projectKeys.detail(id) });
        },
    });
}

export function useAddProjectMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ projectId, userId, role = 'MEMBER' }: { projectId: string; userId: string; role?: string }) => {
            return await api.addProjectMember(projectId, userId, role);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

export function useRemoveProjectMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, projectId }: { id: string, projectId: string }) => {
            return await api.removeProjectMember(id);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

// --- Tasks ---

export function useTasks(assigneeId?: string, status?: string, limit: number = 20, projectId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: taskKeys.list(assigneeId, status, projectId, limit),
        queryFn: async () => {
            return await api.getTasks(assigneeId, status, limit, projectId);
        },
        staleTime: 5 * 60 * 1000,
        ...options,
    });
}

export function useCreateTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: Partial<TaskDTO>) => {
            return await api.createTask(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}

export function useUpdateTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: Partial<TaskDTO> }) => {
            return await api.updateTask(id, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}

export function useUpdateTaskStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            return await api.updateTaskStatus(id, status);
        },
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: taskKeys.all });

            const previousTasksLists = queryClient.getQueriesData<TaskDTO[]>({ queryKey: taskKeys.all });

            // Optimistically update all matching tasks across all task lists
            queryClient.setQueriesData<TaskDTO[]>({ queryKey: taskKeys.all }, (old) => {
                if (!old) return old;
                return old.map(task => 
                    task.id === id ? { ...task, status: status as any } : task
                );
            });

            return { previousTasksLists };
        },
        onError: (err, newTodo, context) => {
            if (context?.previousTasksLists) {
                context.previousTasksLists.forEach(([queryKey, previousTasks]) => {
                    queryClient.setQueryData(queryKey, previousTasks);
                });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}

export function useDeleteTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            return await api.deleteTask(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}
