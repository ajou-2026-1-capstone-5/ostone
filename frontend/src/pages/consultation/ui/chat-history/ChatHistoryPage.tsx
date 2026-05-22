import { useState } from "react";
import { useParams } from "react-router-dom";
import { MessageHistory } from "../../../../features/consultation/ui/chat-history/MessageHistory";
import { SessionList } from "../../../../features/consultation/ui/chat-history/SessionList";
import styles from "./ChatHistoryPage.module.css";

interface ChatHistoryPageProps {
  workspaceId?: string;
}

export function ChatHistoryPage({ workspaceId: workspaceIdProp }: ChatHistoryPageProps) {
  const { workspaceId: workspaceIdParam } = useParams<{ workspaceId: string }>();
  const workspaceId = workspaceIdProp ?? workspaceIdParam ?? "";
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  return (
    <main className={styles.page}>
      <SessionList
        workspaceId={workspaceId}
        selectedSessionId={selectedSessionId}
        onSelectSession={setSelectedSessionId}
      />
      <div className={styles.contentPane}>
        <MessageHistory sessionId={selectedSessionId} />
      </div>
    </main>
  );
}
