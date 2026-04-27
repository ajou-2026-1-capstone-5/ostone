import { Switch } from "@/shared/ui/switch";
import { useUpdatePolicyStatus } from "../api/useUpdatePolicyStatus";
import type { PolicyStatus } from "@/entities/policy";

interface PolicyStatusToggleProps {
  workspaceId: number;
  packId: number;
  versionId: number;
  policyId: number;
  currentStatus: PolicyStatus;
  disabled?: boolean;
}

export function PolicyStatusToggle({
  workspaceId,
  packId,
  versionId,
  policyId,
  currentStatus,
  disabled,
}: PolicyStatusToggleProps) {
  const { mutate, isPending } = useUpdatePolicyStatus();

  const handleCheckedChange = (checked: boolean) => {
    mutate({
      workspaceId,
      packId,
      versionId,
      policyId,
      status: checked ? "ACTIVE" : "INACTIVE",
    });
  };

  return (
    <Switch
      aria-label="정책 상태"
      checked={currentStatus === "ACTIVE"}
      onCheckedChange={handleCheckedChange}
      disabled={disabled || isPending}
    />
  );
}
