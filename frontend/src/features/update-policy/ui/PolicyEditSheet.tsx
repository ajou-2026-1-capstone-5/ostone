import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/shared/ui/sheet";
import { Spinner } from "@/shared/ui/spinner";
import { Button } from "@/shared/ui/button";
import { useGetPolicy } from "../api/useGetPolicy";
import { PolicyEditForm } from "./PolicyEditForm";
import { POLICY_ERROR_MESSAGES } from "../api/messages";

interface PolicyEditSheetProps {
  workspaceId: number;
  packId: number;
  versionId: number;
  policyId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function PolicyEditSheet({
  workspaceId,
  packId,
  versionId,
  policyId,
  isOpen,
  onClose,
}: PolicyEditSheetProps) {
  const { data: policy, isLoading, isError, refetch } = useGetPolicy({
    workspaceId,
    packId,
    versionId,
    policyId,
    enabled: isOpen,
  });

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>
            {policy ? `${policy.policyCode} · ${policy.name}` : "정책 수정"}
          </SheetTitle>
          <SheetDescription>정책 필드와 상태를 수정합니다.</SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-sm text-muted-foreground">
            <span>{POLICY_ERROR_MESSAGES.LOAD_FAILED}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              다시 시도
            </Button>
          </div>
        )}

        {policy && !isLoading && !isError && (
          <PolicyEditForm
            policy={policy}
            workspaceId={workspaceId}
            packId={packId}
            versionId={versionId}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
