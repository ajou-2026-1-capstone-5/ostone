import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIsMutating } from "@tanstack/react-query";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { riskEditSchema, type RiskEditFormValues } from "../model/schema";
import { useUpdateRisk } from "../api/useUpdateRisk";
import { UPDATE_RISK_STATUS_MUTATION_KEY } from "../api/useUpdateRiskStatus";
import { RiskJsonFields } from "./RiskJsonFields";
import { RiskStatusToggle } from "./RiskStatusToggle";
import type { RiskDefinition, RiskLevel, UpdateRiskRequest } from "@/entities/risk";

const RISK_LEVEL_OPTIONS: ReadonlyArray<RiskLevel> = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

interface RiskEditFormProps {
  risk: RiskDefinition;
  workspaceId: number;
  packId: number;
  versionId: number;
  onClose: () => void;
}

export function RiskEditForm({
  risk,
  workspaceId,
  packId,
  versionId,
  onClose,
}: Readonly<RiskEditFormProps>) {
  const { mutate, isPending } = useUpdateRisk();
  const isStatusPending = useIsMutating({ mutationKey: UPDATE_RISK_STATUS_MUTATION_KEY }) > 0;
  const isAnyPending = isPending || isStatusPending;
  const previousRiskIdRef = useRef(risk.id);

  const form = useForm<RiskEditFormValues>({
    resolver: zodResolver(riskEditSchema),
    defaultValues: getRiskDefaultValues(risk),
  });

  useEffect(() => {
    if (previousRiskIdRef.current !== risk.id) {
      form.reset(getRiskDefaultValues(risk));
      previousRiskIdRef.current = risk.id;
    }
  }, [form, risk]);

  const onSubmit = (values: RiskEditFormValues) => {
    const body: UpdateRiskRequest = {
      name: values.name,
      description: normalizeNullableString(values.description),
      riskLevel: values.riskLevel,
      triggerConditionJson: values.triggerConditionJson,
      handlingActionJson: values.handlingActionJson,
      evidenceJson: values.evidenceJson,
      metaJson: values.metaJson,
    };

    mutate({ workspaceId, packId, versionId, riskId: risk.id, body }, { onSuccess: onClose });
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
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(event.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="riskLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>위험도 *</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full" aria-label="위험요소 위험도">
                    <SelectValue placeholder="위험도 선택" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent
                  position="popper"
                  align="start"
                  className="z-[80] w-[var(--radix-select-trigger-width)]"
                >
                  {RISK_LEVEL_OPTIONS.map((riskLevel) => (
                    <SelectItem key={riskLevel} value={riskLevel}>
                      {riskLevel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <ReadonlyRiskValue label="위험요소 코드" value={risk.riskCode} />
        <ReadonlyRiskValue label="버전 ID" value={risk.domainPackVersionId} />

        <RiskJsonFields />

        <div className="flex flex-row items-center justify-between border-t pt-4">
          <span className="text-sm font-medium leading-none">상태</span>
          <RiskStatusToggle
            workspaceId={workspaceId}
            packId={packId}
            versionId={versionId}
            riskId={risk.id}
            currentStatus={risk.status}
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

function ReadonlyRiskValue({ label, value }: Readonly<{ label: string; value: string | number }>) {
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

function getRiskDefaultValues(risk: RiskDefinition): RiskEditFormValues {
  return {
    name: risk.name,
    description: risk.description,
    riskLevel: risk.riskLevel,
    triggerConditionJson: formatJsonInput(risk.triggerConditionJson),
    handlingActionJson: formatJsonInput(risk.handlingActionJson),
    evidenceJson: formatJsonInput(risk.evidenceJson),
    metaJson: formatJsonInput(risk.metaJson),
  };
}
