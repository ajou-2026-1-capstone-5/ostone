import { Switch } from "@/shared/ui/switch";
import { useUpdateSlotStatus } from "../api/useUpdateSlotStatus";

interface SlotStatusToggleProps {
  workspaceId: number;
  packId: number;
  versionId: number;
  slotId: number;
  currentStatus: "ACTIVE" | "INACTIVE";
  disabled?: boolean;
}

export function SlotStatusToggle({
  workspaceId,
  packId,
  versionId,
  slotId,
  currentStatus,
  disabled,
}: SlotStatusToggleProps) {
  const { mutate, isPending } = useUpdateSlotStatus();

  const handleCheckedChange = (checked: boolean) => {
    mutate({
      workspaceId,
      packId,
      versionId,
      slotId,
      status: checked ? "ACTIVE" : "INACTIVE",
    });
  };

  return (
    <Switch
      aria-label="슬롯 상태"
      checked={currentStatus === "ACTIVE"}
      onCheckedChange={handleCheckedChange}
      disabled={disabled || isPending}
    />
  );
}
