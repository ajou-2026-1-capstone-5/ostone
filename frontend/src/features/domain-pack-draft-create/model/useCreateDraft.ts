import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { domainPackKeys } from '@/entities/domain-pack';
import { ApiRequestError } from '@/shared/api';
import type { CreateDomainPackDraftRequest } from '@/entities/domain-pack';
import { createDraftApi } from '../api/createDraftApi';

interface CreateDraftParams {
  wsId: number;
  packId: number;
  payload: CreateDomainPackDraftRequest;
}

export function useCreateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ wsId, packId, payload }: CreateDraftParams) =>
      createDraftApi.create(wsId, packId, payload),
    onSuccess: (_data, { wsId, packId }) => {
      queryClient.invalidateQueries({ queryKey: domainPackKeys.detail(wsId, packId) });
      toast.success('새 DRAFT 버전이 생성되었습니다.');
    },
    onError: (error: unknown) => {
      if (error instanceof ApiRequestError) {
        if (error.status === 403) {
          toast.error('접근 권한 없음');
        } else if (error.status === 409) {
          // 409는 caller(모달)의 per-call onError에서 처리. toast 없음.
        } else {
          toast.error('DRAFT 생성에 실패했습니다.');
        }
      } else {
        toast.error('DRAFT 생성에 실패했습니다.');
      }
    },
  });
}
