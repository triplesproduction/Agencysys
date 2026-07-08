import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { noteKeys } from './keys';
import { api } from '@/lib/api';
import { NoteDTO } from '@/types/dto';

// --- Notes Queries ---

export function useNotes(employeeId?: string, projectId?: string) {
    return useQuery({
        queryKey: noteKeys.list(employeeId, projectId),
        queryFn: async () => {
            return await api.getNotes(employeeId, projectId);
        },
        staleTime: 2 * 60 * 1000,
        enabled: !!employeeId,
    });
}

export function useNoteDetail(id: string) {
    return useQuery({
        queryKey: noteKeys.detail(id),
        queryFn: async () => {
            return await api.getNoteById(id);
        },
        enabled: !!id,
        staleTime: 2 * 60 * 1000,
    });
}

export function useProjectNotes(projectId: string) {
    return useQuery({
        queryKey: noteKeys.projectNotes(projectId),
        queryFn: async () => {
            return await api.getProjectNotes(projectId);
        },
        enabled: !!projectId,
        staleTime: 2 * 60 * 1000,
    });
}

// --- Notes Mutations ---

export function useCreateNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: Partial<NoteDTO>) => {
            return await api.createNote(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: noteKeys.all });
        },
    });
}

export function useUpdateNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: Partial<NoteDTO> }) => {
            return await api.updateNote(id, payload);
        },
        onMutate: async ({ id, payload }) => {
            // Optimistic update for auto-save responsiveness
            await queryClient.cancelQueries({ queryKey: noteKeys.detail(id) });

            const previousNote = queryClient.getQueryData<NoteDTO>(noteKeys.detail(id));

            if (previousNote) {
                queryClient.setQueryData<NoteDTO>(noteKeys.detail(id), {
                    ...previousNote,
                    ...payload,
                    updatedAt: new Date().toISOString(),
                });
            }

            return { previousNote };
        },
        onError: (_err, variables, context) => {
            if (context?.previousNote) {
                queryClient.setQueryData(noteKeys.detail(variables.id), context.previousNote);
            }
        },
        onSettled: (_data, _error, variables) => {
            queryClient.invalidateQueries({ queryKey: noteKeys.all });
            queryClient.invalidateQueries({ queryKey: noteKeys.detail(variables.id) });
        },
    });
}

export function useDeleteNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            return await api.deleteNote(id);
        },
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: noteKeys.all });
            queryClient.removeQueries({ queryKey: noteKeys.detail(id) });
        },
    });
}
