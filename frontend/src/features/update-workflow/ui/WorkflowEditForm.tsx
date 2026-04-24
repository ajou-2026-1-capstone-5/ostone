import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Node, Edge } from "@xyflow/react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { workflowEditSchema, type WorkflowEditFormValues } from "../model/schema";
import { useUpdateWorkflow } from "../api/useUpdateWorkflow";
import { InteractiveGraphEditor } from "./InteractiveGraphEditor";
import { toWorkflowGraph } from "../lib/graphToWorkflow";
import type { WorkflowDetail } from "@/entities/workflow";
import { toFlow } from "@/entities/workflow";

interface WorkflowEditFormProps {
  workflow: WorkflowDetail;
  wsId: number;
  packId: number;
  versionId: number;
  onClose: () => void;
}

export function WorkflowEditForm({
  workflow,
  wsId,
  packId,
  versionId,
  onClose,
}: WorkflowEditFormProps) {
  const { mutate, isPending } = useUpdateWorkflow();

  const { nodes: initialNodes, edges: initialEdges } = toFlow(workflow.graphJson);

  const [graphNodes, setGraphNodes] = useState<Node[]>(initialNodes);
  const [graphEdges, setGraphEdges] = useState<Edge[]>(initialEdges);

  const handleGraphStateChange = useCallback((nodes: Node[], edges: Edge[]) => {
    setGraphNodes(nodes);
    setGraphEdges(edges);
  }, []);

  const form = useForm<WorkflowEditFormValues>({
    resolver: zodResolver(workflowEditSchema),
    defaultValues: {
      name: workflow.name,
      description: workflow.description,
    },
  });

  const direction = workflow.graphJson.direction;
  const workflowId = workflow.id;

  const onSubmit = useCallback(
    (values: WorkflowEditFormValues) => {
      const graphJson = toWorkflowGraph(graphNodes, graphEdges, direction);
      mutate(
        { wsId, packId, versionId, workflowId, body: { ...values, graphJson } },
        { onSuccess: onClose },
      );
    },
    [graphNodes, graphEdges, direction, mutate, wsId, packId, versionId, workflowId, onClose],
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4 pb-4 h-full">
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
          <span className="text-sm font-medium leading-none">워크플로우 코드</span>
          <Input value={workflow.workflowCode} readOnly disabled />
        </div>

        <div style={{ height: "500px" }}>
          <InteractiveGraphEditor
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            onStateChange={handleGraphStateChange}
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
