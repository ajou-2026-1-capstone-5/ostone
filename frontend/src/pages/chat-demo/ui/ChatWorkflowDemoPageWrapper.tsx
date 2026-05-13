import { ChatWorkflowDemoPage } from './ChatWorkflowDemoPage';
import { demoChatWorkflowState } from '@/features/chat-workflow';

export function ChatWorkflowDemoPageWrapper() {
  return <ChatWorkflowDemoPage state={demoChatWorkflowState} />;
}
