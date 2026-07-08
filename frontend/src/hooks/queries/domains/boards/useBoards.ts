import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BoardDTO } from '@/types/dto';
import { boardKeys } from './keys';

export function useBoards(myId?: string, isAdmin?: boolean) {
    return useQuery({
        queryKey: [...boardKeys.list(), myId, isAdmin],
        queryFn: () => api.getBoards(myId, isAdmin),
    });
}

export function useBoardDetail(id: string) {
    return useQuery({
        queryKey: boardKeys.detail(id),
        queryFn: () => api.getBoardById(id),
        enabled: !!id,
    });
}

export function useCreateBoard() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: Partial<BoardDTO>) => api.createBoard(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: boardKeys.list() });
        },
    });
}

export function useUpdateBoardDocument() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, document }: { id: string; document: any }) => api.updateBoardDocument(id, document),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: boardKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: boardKeys.list() });
        },
    });
}

export function useDeleteBoard() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.deleteBoard(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: boardKeys.all });
        },
    });
}

export function useMyPendingBoardInvites(myId?: string) {
    return useQuery({
        queryKey: [...boardKeys.list(), 'invites', myId],
        queryFn: () => myId ? api.getMyPendingBoardInvites(myId) : Promise.resolve([]),
        enabled: !!myId,
    });
}

export function useRespondToBoardInvite() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ inviteId, status }: { inviteId: string; status: 'accepted' | 'declined' }) => api.updateBoardInviteStatus(inviteId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: boardKeys.all });
        },
    });
}
