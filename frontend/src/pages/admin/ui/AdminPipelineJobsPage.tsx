import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ExternalLink, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  adminPipelineJobKeys,
  listAdminPipelineJobs,
  retryAdminPipelineJob,
  type AdminPipelineJobItem,
  type AdminPipelineJobListFilters,
} from "@/features/admin";
import { ApiRequestError } from "@/shared/api";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import styles from "./admin-page.module.css";
import pageStyles from "./admin-pipeline-jobs-page.module.css";

const STATUS_OPTIONS = [
  "",
  "QUEUED",
  "RUNNING",
  "WAITING_DOMAIN_CONFIRMATION",
  "WAITING_HUMAN_FEEDBACK",
  "WAITING_INTENT_CALLBACK",
  "WAITING_WORKFLOW_CALLBACK",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
];

const REVIEW_WAITING_STATUSES = new Set(["WAITING_DOMAIN_CONFIRMATION", "WAITING_HUMAN_FEEDBACK"]);

const DEFAULT_FILTERS: AdminPipelineJobListFilters = {
  page: 0,
  size: 20,
  lagThresholdSeconds: 300,
};

export function AdminPipelineJobsPage() {
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<AdminPipelineJobListFilters>(DEFAULT_FILTERS);
  const [filters, setFilters] = useState<AdminPipelineJobListFilters>(DEFAULT_FILTERS);

  const query = useQuery({
    queryKey: adminPipelineJobKeys.list(filters),
    queryFn: () => listAdminPipelineJobs(filters),
  });

  const retryMutation = useMutation({
    mutationFn: retryAdminPipelineJob,
    onSuccess: (result) => {
      toast.success(`새 pipeline job #${result.retryPipelineJobId}을 생성했습니다.`);
      queryClient.invalidateQueries({ queryKey: adminPipelineJobKeys.all });
    },
    onError: (error) => {
      const message =
        error instanceof ApiRequestError ? error.message : "Pipeline job 재시도에 실패했습니다.";
      toast.error(message);
    },
  });

  const rows = query.data?.items ?? [];
  const totalLabel = useMemo(() => formatTotal(query.data?.totalElements ?? 0), [query.data]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters(normalizeFilters({ ...draftFilters, page: 0 }));
  };

  const handleReset = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Operations</p>
        <h1>Airflow 운영</h1>
      </div>

      <form className={pageStyles.filters} onSubmit={handleSubmit}>
        <label className={pageStyles.field}>
          <span>Status</span>
          <NativeSelect
            value={draftFilters.status ?? ""}
            onChange={(event) =>
              setDraftFilters((current) => ({ ...current, status: event.target.value }))
            }
          >
            {STATUS_OPTIONS.map((status) => (
              <NativeSelectOption key={status || "ALL"} value={status}>
                {status || "전체"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <Input
          label="Workspace"
          inputMode="numeric"
          placeholder="1"
          value={draftFilters.workspaceId ?? ""}
          onChange={(event) =>
            setDraftFilters((current) => ({ ...current, workspaceId: event.target.value }))
          }
        />
        <Input
          label="DAG"
          placeholder="domain_pack_generation"
          value={draftFilters.dagId ?? ""}
          onChange={(event) =>
            setDraftFilters((current) => ({ ...current, dagId: event.target.value }))
          }
        />
        <Input
          label="Run"
          placeholder="pipeline_job_"
          value={draftFilters.runId ?? ""}
          onChange={(event) =>
            setDraftFilters((current) => ({ ...current, runId: event.target.value }))
          }
        />
        <Input
          label="Lag threshold"
          inputMode="numeric"
          value={String(draftFilters.lagThresholdSeconds ?? 300)}
          onChange={(event) =>
            setDraftFilters((current) => ({
              ...current,
              lagThresholdSeconds: Number(event.target.value) || 300,
            }))
          }
        />
        <div className={pageStyles.filterActions}>
          <Button type="submit" variant="primary">
            <Search size={16} />
            조회
          </Button>
          <Button type="button" variant="secondary" onClick={handleReset}>
            <X size={16} />
            초기화
          </Button>
        </div>
      </form>

      <div className={pageStyles.toolbar}>
        <span>{totalLabel}</span>
        <Button
          type="button"
          variant="ghost"
          onClick={() => query.refetch()}
          isLoading={query.isFetching}
        >
          <RefreshCw size={16} />
          새로고침
        </Button>
      </div>

      {query.isLoading && <PipelineJobSkeleton />}
      {query.isError && (
        <div className={pageStyles.state} role="alert">
          <AlertCircle size={18} />
          <span>{resolveErrorMessage(query.error)}</span>
          <Button type="button" variant="secondary" onClick={() => query.refetch()}>
            다시 시도
          </Button>
        </div>
      )}
      {!query.isLoading && !query.isError && rows.length === 0 && (
        <div className={pageStyles.state}>
          <span>조건에 맞는 pipeline job이 없습니다.</span>
        </div>
      )}
      {!query.isLoading && !query.isError && rows.length > 0 && (
        <PipelineJobTable
          rows={rows}
          retryingJobId={retryMutation.variables ?? null}
          onRetry={(pipelineJobId) => retryMutation.mutate(pipelineJobId)}
        />
      )}
    </section>
  );
}

function PipelineJobTable({
  rows,
  retryingJobId,
  onRetry,
}: {
  rows: AdminPipelineJobItem[];
  retryingJobId: number | null;
  onRetry: (pipelineJobId: number) => void;
}) {
  return (
    <div className={pageStyles.tableShell}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Workspace</TableHead>
            <TableHead>DAG / Run</TableHead>
            <TableHead>Queue lag</TableHead>
            <TableHead>Running</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Retry</TableHead>
            <TableHead>Error</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((job) => (
            <TableRow
              key={job.pipelineJobId}
              className={job.lagExceeded ? pageStyles.lagExceededRow : undefined}
            >
              <TableCell className={pageStyles.monoCell}>#{job.pipelineJobId}</TableCell>
              <TableCell>
                <Badge variant={job.status === "FAILED" ? "outline" : "secondary"}>
                  {job.status}
                </Badge>
              </TableCell>
              <TableCell>
                <span className={pageStyles.monoCell}>W{job.workspaceId}</span>
                <span className={pageStyles.subtle}>D{job.datasetId ?? "-"}</span>
              </TableCell>
              <TableCell className={pageStyles.runCell}>
                <span>{job.airflowDagId ?? "-"}</span>
                <small>{job.airflowRunId ?? "-"}</small>
              </TableCell>
              <TableCell>{formatDuration(job.queueLagSeconds)}</TableCell>
              <TableCell>{formatDuration(job.runningDurationSeconds)}</TableCell>
              <TableCell>{formatDuration(job.totalDurationSeconds)}</TableCell>
              <TableCell className={pageStyles.relationCell}>
                {job.retriedFromPipelineJobId && <span>from #{job.retriedFromPipelineJobId}</span>}
                {job.retryPipelineJobId && <span>retry #{job.retryPipelineJobId}</span>}
                {!job.retriedFromPipelineJobId && !job.retryPipelineJobId && <span>-</span>}
              </TableCell>
              <TableCell className={pageStyles.errorCell}>{job.lastErrorMessage ?? "-"}</TableCell>
              <TableCell>
                {REVIEW_WAITING_STATUSES.has(job.status) ? (
                  <Link
                    className={pageStyles.actionLink}
                    to={`/workspaces/${job.workspaceId}/pipeline-jobs/${job.pipelineJobId}/review`}
                    aria-label={`pipeline job ${job.pipelineJobId} 검토 화면`}
                  >
                    <ExternalLink size={16} />
                    검토
                  </Link>
                ) : job.status === "FAILED" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    isLoading={retryingJobId === job.pipelineJobId}
                    onClick={() => onRetry(job.pipelineJobId)}
                    aria-label={`pipeline job ${job.pipelineJobId} 재시도`}
                  >
                    <RotateCcw size={16} />
                    재시도
                  </Button>
                ) : (
                  <span className={pageStyles.subtle}>-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PipelineJobSkeleton() {
  return (
    <div className={pageStyles.skeletonList} aria-label="pipeline job loading">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className={pageStyles.skeletonRow} />
      ))}
    </div>
  );
}

function normalizeFilters(filters: AdminPipelineJobListFilters): AdminPipelineJobListFilters {
  return {
    page: filters.page ?? 0,
    size: filters.size ?? 20,
    lagThresholdSeconds: filters.lagThresholdSeconds ?? 300,
    status: blankToUndefined(filters.status),
    workspaceId: blankToUndefined(filters.workspaceId),
    dagId: blankToUndefined(filters.dagId),
    runId: blankToUndefined(filters.runId),
  };
}

function blankToUndefined(value: string | undefined): string | undefined {
  return value && value.trim() ? value.trim() : undefined;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return "-";
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) {
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const minuteRest = minutes % 60;
  return minuteRest > 0 ? `${hours}h ${minuteRest}m` : `${hours}h`;
}

function formatTotal(totalElements: number): string {
  return `총 ${totalElements.toLocaleString("ko-KR")}개 job`;
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  return "Pipeline job 목록을 불러오지 못했습니다.";
}
