import { useEffect, useMemo, useState } from "react";
import { Navigate, useOutletContext, useParams } from "react-router-dom";
import { SearchIcon } from "lucide-react";

import {
  mapWorkspaceActionError,
  useWorkspaceMembers,
  WORKSPACE_MEMBER_ROLES,
  type WorkspaceMemberResponse,
  type WorkspaceMemberRole,
} from "@/entities/workspace";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import { WorkspaceSettingsNav } from "@/widgets/workspace-settings-nav";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { accessDeniedMessage } from "@/shared/api";
import { Input } from "@/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";

import styles from "./workspace-members-page.module.css";

const ROLE_LABELS: Record<WorkspaceMemberRole, string> = {
  OWNER: "소유자",
  ADMIN: "관리자",
  REVIEWER: "검토자",
  OPERATOR: "상담원",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "활성",
  INACTIVE: "비활성",
  PENDING: "대기",
};

function formatJoinedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getRoleLabel(role: WorkspaceMemberResponse["workspaceRole"]): string {
  return ROLE_LABELS[role] ?? role;
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function WorkspaceMembersPage() {
  const { workspaceId } = useParams();
  const { setCrumbs } = useOutletContext<ShellContext>();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<WorkspaceMemberRole | "">("");

  useEffect(() => {
    setCrumbs(["워크스페이스 설정", "멤버"]);
    return () => setCrumbs([]);
  }, [setCrumbs]);

  const { data, isLoading, isError, error, refetch } = useWorkspaceMembers({
    workspaceId: parsedWorkspaceId,
    search,
    role,
  });
  const members = data ?? [];
  const accessDenied = useMemo(
    () => (isError ? accessDeniedMessage(error) : null),
    [error, isError],
  );
  const errorMessage = useMemo(
    () => (isError ? mapWorkspaceActionError(error) : ""),
    [error, isError],
  );

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <div className={styles.pageWrapper}>
      <WorkspaceSettingsNav workspaceId={parsedWorkspaceId} />
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>멤버</h1>
          <p className={styles.pageSubtitle}>워크스페이스 접근 권한과 계정 상태를 확인합니다.</p>
        </div>
      </div>

      <div className={styles.toolbar} aria-label="멤버 필터">
        <label className={styles.searchField}>
          <SearchIcon className={styles.searchIcon} aria-hidden="true" />
          <span className={styles.srOnly}>이름 또는 이메일 검색</span>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="이름 또는 이메일 검색"
            className={styles.searchInput}
          />
        </label>
        <label className={styles.roleField}>
          <span className={styles.srOnly}>역할 필터</span>
          <NativeSelect
            value={role}
            onChange={(event) => setRole(event.target.value as WorkspaceMemberRole | "")}
            aria-label="역할 필터"
          >
            <NativeSelectOption value="">전체 역할</NativeSelectOption>
            {WORKSPACE_MEMBER_ROLES.map((candidate) => (
              <NativeSelectOption key={candidate} value={candidate}>
                {getRoleLabel(candidate)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>

      {isLoading && (
        <div className={styles.statePanel} data-testid="workspace-members-loading">
          <LoadingSpinner />
          <p className={styles.stateText}>멤버 목록을 불러오는 중입니다.</p>
        </div>
      )}

      {!isLoading && isError && accessDenied && (
        <div className={styles.statePanel} data-testid="workspace-members-access-denied">
          <EmptyState message={accessDenied} />
        </div>
      )}

      {!isLoading && isError && !accessDenied && (
        <div className={styles.statePanel} data-testid="workspace-members-error">
          <ErrorState message={errorMessage} onRetry={() => void refetch()} />
        </div>
      )}

      {!isLoading && !isError && members.length === 0 && (
        <div className={styles.statePanel} data-testid="workspace-members-empty">
          <EmptyState message="조건에 맞는 멤버가 없습니다." />
        </div>
      )}

      {!isLoading && !isError && members.length > 0 && (
        <div className={styles.tableSurface}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>가입일</TableHead>
                <TableHead>계정 상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.memberId}>
                  <TableCell className={styles.memberName}>{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={styles.badge}>
                      {getRoleLabel(member.workspaceRole)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatJoinedAt(member.joinedAt)}</TableCell>
                  <TableCell>{getStatusLabel(member.accountStatus)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
