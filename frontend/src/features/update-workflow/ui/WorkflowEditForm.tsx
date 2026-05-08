import { useCallback, useEffect, useRef } from "react";
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
import type { WorkflowDetail, WorkflowGraph } from "@/entities/workflow";
import { toFlow } from "@/entities/workflow";

const EMPTY_GRAPH: WorkflowGraph = { direction: "LR", nodes: [], edges: [] };

function parseGraphJson(graphJson: WorkflowDetail["graphJson"]): WorkflowGraph {
  if (!graphJson) return EMPTY_GRAPH;
  if (typeof graphJson === "string") {
    try {
      return JSON.parse(graphJson);
    } catch {
      return EMPTY_GRAPH;
    }
  }
  return graphJson;
}

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

  const parsedGraph = useRef(parseGraphJson(workflow.graphJson));
  const initialFlow = useRef(toFlow(parsedGraph.current));

  // single source of truth for graph state; ref avoids re-renders on every node change
  const graphStateRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ ...initialFlow.current });

  const handleGraphStateChange = useCallback((nodes: Node[], edges: Edge[]) => {
    graphStateRef.current = { nodes, edges };
  }, []);

  const form = useForm<WorkflowEditFormValues>({
    resolver: zodResolver(workflowEditSchema),
    defaultValues: {
      name: workflow.name ?? "",
      description: workflow.description ?? undefined,
    },
  });

  // Intentionally depend only on workflow.id: form.reset, initialGraphRef, and
  // graphStateRef must not reinitialize on name/description/graphJson updates for
  // the same workflow, so in-progress edits are preserved across prop refreshes.
  useEffect(() => {
    const graph = parseGraphJson(workflow.graphJson);
    const flow = toFlow(graph);
    form.reset({ name: workflow.name ?? "", description: workflow.description ?? undefined });
    graphStateRef.current = flow;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.id]);

  const direction = parsedGraph.current.direction;
  const workflowId = workflow.id!;

  const onSubmit = useCallback(
    (values: WorkflowEditFormValues) => {
      const { nodes, edges } = graphStateRef.current;
      const graph = toWorkflowGraph(nodes, edges, direction);
      const body = {
        ...values,
        graphJson: graph,
        description: values.description ?? undefined,
      } as Parameters<typeof mutate>[0]["body"];
      mutate(
        { wsId, packId, versionId, workflowId, body },
        { onSuccess: onClose },
      );
    },
    [direction, mutate, wsId, packId, versionId, workflowId, onClose],
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
                  onChange={(e) => field.onChange(e.target.value || undefined)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-2">
          <span className="text-sm font-medium leading-none">워크플로우 코드</span>
          <Input value={workflow.workflowCode} readOnly disabled />
        </div>

        <div className="h-[min(70vh,500px)]">
          <InteractiveGraphEditor
            key={workflow.id}
            initialNodes={initialFlow.current.nodes}
            initialEdges={initialFlow.current.edges}
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
