import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIsMutating } from "@tanstack/react-query";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { policyEditSchema, type PolicyEditFormValues } from "../model/schema";
import { useUpdatePolicy } from "../api/useUpdatePolicy";
import { UPDATE_POLICY_STATUS_MUTATION_KEY } from "../api/useUpdatePolicyStatus";
import { PolicyJsonFields } from "./PolicyJsonFields";
import { PolicyStatusToggle } from "./PolicyStatusToggle";
import type { PolicyDefinition, UpdatePolicyRequest } from "@/entities/policy";

const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

interface PolicyEditFormProps {
  policy: PolicyDefinition;
  workspaceId: number;
  packId: number;
  versionId: number;
  onClose: () => void;
}

export function PolicyEditForm({
  policy,
  workspaceId,
  packId,
  versionId,
  onClose,
}: PolicyEditFormProps) {
  const { mutate, isPending } = useUpdatePolicy();
  const isStatusPending =
    useIsMutating({ mutationKey: UPDATE_POLICY_STATUS_MUTATION_KEY }) > 0;
  const isAnyPending = isPending || isStatusPending;

  const customSeverity = useMemo(() => {
    if (!policy.severity) return null;
    return SEVERITY_OPTIONS.includes(policy.severity as (typeof SEVERITY_OPTIONS)[number])
      ? null
      : policy.severity;
  }, [policy.severity]);

  const form = useForm<PolicyEditFormValues>({
    resolver: zodResolver(policyEditSchema),
    defaultValues: {
      name: policy.name,
      description: policy.description,
      severity: policy.severity,
      conditionJson: formatJsonInput(policy.conditionJson),
      actionJson: formatJsonInput(policy.actionJson),
      evidenceJson: formatJsonInput(policy.evidenceJson),
      metaJson: formatJsonInput(policy.metaJson),
    },
  });

  const onSubmit = (values: PolicyEditFormValues) => {
    const body: UpdatePolicyRequest = {
      name: values.name,
      description: normalizeNullableString(values.description),
      severity: normalizeNullableString(values.severity),
      conditionJson: values.conditionJson,
      actionJson: values.actionJson,
      evidenceJson: values.evidenceJson,
      metaJson: values.metaJson,
    };

    mutate(
      { workspaceId, packId, versionId, policyId: policy.id, body },
      { onSuccess: onClose },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>이름 *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>설명</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="severity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>심각도</FormLabel>
              <Select
                value={field.value ?? "NONE"}
                onValueChange={(value) => field.onChange(value === "NONE" ? null : value)}
              >
                <FormControl>
                  <SelectTrigger className="w-full" aria-label="정책 심각도">
                    <SelectValue placeholder="선택 안 함" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent
                  position="popper"
                  align="start"
                  className="z-[80] w-[var(--radix-select-trigger-width)]"
                >
                  <SelectItem value="NONE">선택 안 함</SelectItem>
                  {SEVERITY_OPTIONS.map((severity) => (
                    <SelectItem key={severity} value={severity}>
                      {severity}
                    </SelectItem>
                  ))}
                  {customSeverity && <SelectItem value={customSeverity}>{customSeverity}</SelectItem>}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-2">
          <span className="text-sm font-medium leading-none">정책 코드</span>
          <Input value={policy.policyCode} readOnly disabled />
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium leading-none">버전 ID</span>
          <Input value={policy.domainPackVersionId} readOnly disabled />
        </div>

        <PolicyJsonFields />

        <div className="flex flex-row items-center justify-between border-t pt-4">
          <span className="text-sm font-medium leading-none">상태</span>
          <PolicyStatusToggle
            workspaceId={workspaceId}
            packId={packId}
            versionId={versionId}
            policyId={policy.id}
            currentStatus={policy.status}
            disabled={isAnyPending}
          />
        </div>

        <div className="flex gap-2 justify-end border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isAnyPending}>
            취소
          </Button>
          <Button type="submit" disabled={isAnyPending}>
            저장
          </Button>
        </div>
      </form>
    </Form>
  );
}

function normalizeNullableString(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function formatJsonInput(raw: string): string {
  if (!raw) return raw;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
