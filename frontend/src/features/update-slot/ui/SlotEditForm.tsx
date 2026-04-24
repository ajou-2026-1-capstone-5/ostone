import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { slotEditSchema, type SlotEditFormValues } from "../model/schema";
import { useUpdateSlot } from "../api/useUpdateSlot";
import { SlotStatusToggle } from "./SlotStatusToggle";
import { SlotJsonFields } from "./SlotJsonFields";
import type { SlotDefinition } from "@/entities/slot";

interface SlotEditFormProps {
  slot: SlotDefinition;
  workspaceId: number;
  packId: number;
  versionId: number;
  onClose: () => void;
}

export function SlotEditForm({ slot, workspaceId, packId, versionId, onClose }: SlotEditFormProps) {
  const { mutate, isPending } = useUpdateSlot();

  const form = useForm<SlotEditFormValues>({
    resolver: zodResolver(slotEditSchema),
    defaultValues: {
      name: slot.name,
      description: slot.description,
      isSensitive: slot.isSensitive,
      validationRuleJson: slot.validationRuleJson,
      defaultValueJson: slot.defaultValueJson,
      metaJson: slot.metaJson,
    },
  });

  const onSubmit = (values: SlotEditFormValues) => {
    mutate(
      { workspaceId, packId, versionId, slotId: slot.id, body: values },
      { onSuccess: onClose },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4 pb-4">
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
            </FormItem>
          )}
        />

        <div className="grid gap-2">
          <span className="text-sm font-medium leading-none">데이터 타입</span>
          <Input value={slot.dataType} readOnly disabled />
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium leading-none">슬롯 코드</span>
          <Input value={slot.slotCode} readOnly disabled />
        </div>

        <FormField
          control={form.control}
          name="isSensitive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between">
              <FormLabel>민감 정보</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <SlotJsonFields />

        <div className="flex flex-row items-center justify-between border-t pt-4">
          <span className="text-sm font-medium leading-none">상태</span>
          <SlotStatusToggle
            workspaceId={workspaceId}
            packId={packId}
            versionId={versionId}
            slotId={slot.id}
            currentStatus={slot.status}
          />
        </div>

        <div className="flex gap-2 justify-end border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button type="submit" disabled={isPending}>
            저장
          </Button>
        </div>
      </form>
    </Form>
  );
}
