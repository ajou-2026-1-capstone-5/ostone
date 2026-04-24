import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/shared/ui/sheet";
import { Spinner } from "@/shared/ui/spinner";
import { Button } from "@/shared/ui/button";
import { useGetWorkflow } from "../api/useGetWorkflow";
import { WorkflowEditForm } from "./WorkflowEditForm";

interface WorkflowEditSheetProps {
  wsId: number;
  packId: number;
  versionId: number;
  workflowId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function WorkflowEditSheet({
  wsId,
  packId,
  versionId,
  workflowId,
  isOpen,
  onClose,
}: WorkflowEditSheetProps) {
  const {
    data: workflow,
    isLoading,
    isError,
    refetch,
  } = useGetWorkflow(wsId, packId, versionId, workflowId, isOpen);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto flex flex-col">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>
            {workflow ? `${workflow.workflowCode} · ${workflow.name}` : "워크플로우 수정"}
          </SheetTitle>
          <SheetDescription>워크플로우 이름, 설명, 그래프를 수정합니다.</SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-sm text-muted-foreground">
            <span>워크플로우 정보를 불러오지 못했습니다.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              다시 시도
            </Button>
          </div>
        )}

        {workflow && !isLoading && !isError && (
          <WorkflowEditForm
            workflow={workflow}
            wsId={wsId}
            packId={packId}
            versionId={versionId}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
