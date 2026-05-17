import { useParams } from 'react-router-dom';
import { useGetChatWorkflow } from '@/shared/api/generated/endpoints/demo-runtime-controller/demo-runtime-controller';
import { parseRouteId } from '@/shared/lib/parseRouteId';
import { unwrapApiResponse } from '@/shared/api/unwrapApiResponse';
import { ChatWorkflowDemoPage } from './ChatWorkflowDemoPage';
import type { ChatWorkflowDemoState, DemoChatWorkflowResponse } from '@/features/chat-workflow';

export function ChatWorkflowDemoPageWrapper() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const workspaceIdNum = parseRouteId(workspaceId);

  if (workspaceIdNum === null) {
    const state: ChatWorkflowDemoState = {
      loading: false,
      error: '유효하지 않은 workspaceId입니다.',
      response: null,
      selectedMessageId: null,
    };
    return <ChatWorkflowDemoPage state={state} />;
  }

  const query = useGetChatWorkflow(workspaceIdNum, {
    query: { enabled: true },
  });

  const state: ChatWorkflowDemoState = {
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
    response: query.data ? unwrapApiResponse(query.data) as unknown as DemoChatWorkflowResponse : null,
    selectedMessageId: null,
  };

  return <ChatWorkflowDemoPage state={state} />;
}
