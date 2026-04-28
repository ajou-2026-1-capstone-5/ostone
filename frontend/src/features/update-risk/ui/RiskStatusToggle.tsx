import { Switch } from "@/shared/ui/switch";
import { useUpdateRiskStatus } from "../api/useUpdateRiskStatus";
import type { RiskStatus } from "@/entities/risk";

interface RiskStatusToggleProps {
  workspaceId: number;
  packId: number;
  versionId: number;
  riskId: number;
  currentStatus: RiskStatus;
  disabled?: boolean;
}

export function RiskStatusToggle({
  workspaceId,
  packId,
  versionId,
  riskId,
  currentStatus,
  disabled,
}: Readonly<RiskStatusToggleProps>) {
  const { mutate, isPending } = useUpdateRiskStatus();

  const handleCheckedChange = (checked: boolean) => {
    mutate({
      workspaceId,
      packId,
      versionId,
      riskId,
      status: checked ? "ACTIVE" : "INACTIVE",
    });
  };

  return (
    <Switch
      aria-label="위험요소 상태"
      checked={currentStatus === "ACTIVE"}
      onCheckedChange={handleCheckedChange}
      disabled={disabled || isPending}
    />
  );
}
