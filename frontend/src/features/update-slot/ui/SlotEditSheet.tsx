import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/shared/ui/sheet";
import { Spinner } from "@/shared/ui/spinner";
import { Button } from "@/shared/ui/button";
import { useGetSlot } from "../api/useGetSlot";
import { SlotEditForm } from "./SlotEditForm";

interface SlotEditSheetProps {
  workspaceId: number;
  packId: number;
  versionId: number;
  slotId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function SlotEditSheet({
  workspaceId,
  packId,
  versionId,
  slotId,
  isOpen,
  onClose,
}: SlotEditSheetProps) {
  const { data: slot, isLoading, isError, refetch } = useGetSlot({
    workspaceId,
    packId,
    versionId,
    slotId,
    enabled: isOpen,
  });

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>
            {slot ? `${slot.slotCode} · ${slot.name}` : "슬롯 수정"}
          </SheetTitle>
          <SheetDescription>슬롯 필드와 상태를 수정합니다.</SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-sm text-muted-foreground">
            <span>슬롯 정보를 불러오지 못했습니다.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              다시 시도
            </Button>
          </div>
        )}

        {slot && !isLoading && !isError && (
          <SlotEditForm
            slot={slot}
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
