import { useCallback, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Node, Edge } from "@xyflow/react";
import { Button } from "@/shared/ui/button";
import { workflowEditSchema, type WorkflowEditFormValues } from "../model/schema";
import { useUpdateWorkflow } from "../api/useUpdateWorkflow";
import { InteractiveGraphEditor } from "./InteractiveGraphEditor";
import { toWorkflowGraph } from "../lib/graphToWorkflow";
import type { WorkflowDetail, WorkflowGraph } from "@/entities/workflow";
import { toFlow } from "@/entities/workflow";
import styles from "./workflowEditForm.module.css";

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

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkflowEditFormValues>({
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
    reset({ name: workflow.name ?? "", description: workflow.description ?? undefined });
    parsedGraph.current = graph;
    initialFlow.current = flow;
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
      mutate({ wsId, packId, versionId, workflowId, body }, { onSuccess: onClose });
    },
    [direction, mutate, wsId, packId, versionId, workflowId, onClose],
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={styles.form}
      data-testid="workflow-edit-form"
    >
      <div className={styles.metaStrip}>
        <div className={styles.field}>
          <label
            className={`${styles.fieldLabel} ${styles["fieldLabel--required"]}`}
            htmlFor="wf-name"
          >
            이름
            <span className={styles.fieldLabelAsterisk} aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (필수)</span>
          </label>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <input
                id="wf-name"
                {...field}
                className={styles.fieldInput}
                placeholder="워크플로우 이름"
                aria-invalid={errors.name ? "true" : "false"}
                data-testid="workflow-edit-name"
              />
            )}
          />
          {errors.name && (
            <span className={styles.fieldError} role="alert">
              {errors.name.message}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="wf-code">
            워크플로우 코드
          </label>
          <input
            id="wf-code"
            value={workflow.workflowCode ?? ""}
            readOnly
            disabled
            className={styles.fieldInput}
            data-testid="workflow-edit-code"
          />
        </div>

        <div className={`${styles.field} ${styles["field--description"]}`}>
          <label className={styles.fieldLabel} htmlFor="wf-description">
            설명
          </label>
          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <input
                id="wf-description"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || undefined)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                className={styles.fieldInput}
                placeholder="이 워크플로우의 목적을 한 줄로 설명"
                data-testid="workflow-edit-description"
              />
            )}
          />
          {errors.description && (
            <span className={styles.fieldError} role="alert">
              {errors.description.message}
            </span>
          )}
        </div>
      </div>

      <div className={styles.editorSlot}>
        <InteractiveGraphEditor
          key={workflow.id}
          initialNodes={initialFlow.current.nodes}
          initialEdges={initialFlow.current.edges}
          onStateChange={handleGraphStateChange}
        />
      </div>

      <div className={styles.footer}>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
          className={styles.footerBtn}
          data-testid="workflow-edit-cancel"
        >
          취소
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className={styles.footerBtn}
          data-testid="workflow-edit-save"
        >
          저장
        </Button>
      </div>
    </form>
  );
}
