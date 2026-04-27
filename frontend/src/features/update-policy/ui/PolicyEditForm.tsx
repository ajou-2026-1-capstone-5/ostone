import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIsMutating } from "@tanstack/react-query";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { policyEditSchema, type PolicyEditFormValues } from "../model/schema";
import { useUpdatePolicy } from "../api/useUpdatePolicy";
import { UPDATE_POLICY_STATUS_MUTATION_KEY } from "../api/useUpdatePolicyStatus";
import { PolicyJsonFields } from "./PolicyJsonFields";
import { PolicyStatusToggle } from "./PolicyStatusToggle";
import type { PolicyDefinition, UpdatePolicyRequest } from "@/entities/policy";

const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

type TextInputName = "name" | "description";

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
}: Readonly<PolicyEditFormProps>) {
  const { mutate, isPending } = useUpdatePolicy();
  const isStatusPending = useIsMutating({ mutationKey: UPDATE_POLICY_STATUS_MUTATION_KEY }) > 0;
  const isAnyPending = isPending || isStatusPending;

  const customSeverity = useMemo(() => {
    const normalizedSeverity = normalizeSeverity(policy.severity);
    if (!normalizedSeverity) return null;
    return SEVERITY_OPTIONS.includes(normalizedSeverity as (typeof SEVERITY_OPTIONS)[number])
      ? null
      : normalizedSeverity;
  }, [policy.severity]);

  const form = useForm<PolicyEditFormValues>({
    resolver: zodResolver(policyEditSchema),
    defaultValues: getPolicyDefaultValues(policy),
  });

  useEffect(() => {
    form.reset(getPolicyDefaultValues(policy));
  }, [form, policy]);

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

    mutate({ workspaceId, packId, versionId, policyId: policy.id, body }, { onSuccess: onClose });
  };

  const textFields: ReadonlyArray<
    Readonly<{ name: TextInputName; label: string; required?: boolean }>
  > = [
    { name: "name", label: "이름 *", required: true },
    { name: "description", label: "설명" },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col gap-4">
        {textFields.map((textField) => (
          <FormField
            key={textField.name}
            control={form.control}
            name={textField.name}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{textField.label}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(
                        textField.required ? event.target.value : event.target.value || null,
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

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
                  {customSeverity && (
                    <SelectItem value={customSeverity}>{customSeverity}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <ReadonlyPolicyValue label="정책 코드" value={policy.policyCode} />
        <ReadonlyPolicyValue label="버전 ID" value={policy.domainPackVersionId} />

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

function ReadonlyPolicyValue({
  label,
  value,
}: Readonly<{ label: string; value: string | number }>) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium leading-none">{label}</span>
      <Input value={value} readOnly disabled />
    </div>
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

function normalizeSeverity(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function getPolicyDefaultValues(policy: PolicyDefinition): PolicyEditFormValues {
  return {
    name: policy.name,
    description: policy.description,
    severity: normalizeSeverity(policy.severity),
    conditionJson: formatJsonInput(policy.conditionJson),
    actionJson: formatJsonInput(policy.actionJson),
    evidenceJson: formatJsonInput(policy.evidenceJson),
    metaJson: formatJsonInput(policy.metaJson),
  };
}
