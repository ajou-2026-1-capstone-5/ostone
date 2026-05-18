import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Eyebrow, Mono, Icon } from "@/shared/ui/ostone/atoms";
import { useUploadRawFile } from "@/shared/api/generated/endpoints/dataset-controller/dataset-controller";

interface DropzoneProps {
  workspaceId?: number;
}

type UploadStatus =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string }
  | { kind: "success"; fileName: string; datasetId: number }
  | { kind: "error"; message: string };

export const Dropzone: React.FC<DropzoneProps> = ({ workspaceId }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>({ kind: "idle" });
  const isUploading = status.kind === "uploading";

  const uploadMutation = useUploadRawFile({
    mutation: {
      onSuccess: (response, variables) => {
        // customFetch 는 backend ResponseEntity body 를 그대로 반환하므로
        // generated wrapper 의 { data, status } 와 실제 응답 (RawFileUploadResponse) 둘 다 대응.
        const r = response as unknown as
          | { data?: { datasetId?: number } }
          | { datasetId?: number };
        const datasetId =
          ("data" in r && r.data?.datasetId) ||
          ("datasetId" in r && r.datasetId) ||
          undefined;
        setStatus({
          kind: "success",
          fileName: variables.data?.file?.name ?? "",
          datasetId: datasetId ?? -1,
        });
        toast.success("업로드 완료");
      },
      onError: (error) => {
        const message =
          error instanceof Error ? error.message : "업로드에 실패했습니다.";
        setStatus({ kind: "error", message });
        toast.error(message);
      },
    },
  });

  const handleClick = () => {
    if (isUploading) return;
    if (workspaceId == null) {
      toast.warning("워크스페이스를 먼저 선택하세요.");
      return;
    }
    inputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || workspaceId == null) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith(".json")) {
      toast.error("JSON 파일만 업로드할 수 있습니다.");
      return;
    }

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("파일 크기는 50MB 이하여야 합니다.");
      return;
    }

    setStatus({ kind: "uploading", fileName: file.name });
    uploadMutation.mutate({
      workspaceId,
      params: {
        datasetKey: crypto.randomUUID(),
        name: file.name,
        sourceType: "RAW",
      },
      data: { file },
    });
  };

  const cursor = isUploading ? "progress" : workspaceId == null ? "not-allowed" : "pointer";

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        border: "1.5px dashed var(--line)",
        background: "var(--paper-2)",
        padding: "28px",
        borderRadius: "var(--r-3)",
        position: "relative",
        overflow: "hidden",
        cursor,
        opacity: isUploading ? 0.6 : 1,
        transition: "opacity 0.15s ease",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={handleFileChange}
        disabled={isUploading}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle 12px, var(--line) 0.5px, transparent 0.5px) 0 0",
          backgroundSize: "24px 24px",
          opacity: 0.15,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--paper-3)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-2)",
          }}
        >
          <Icon name="upload" size={24} />
        </div>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color:
              status.kind === "success"
                ? "var(--success, #16a34a)"
                : status.kind === "error"
                  ? "var(--danger, #dc2626)"
                  : "var(--ink)",
            textAlign: "center",
          }}
        >
          {status.kind === "uploading" && `업로드 중... ${status.fileName}`}
          {status.kind === "success" &&
            `업로드 완료 — ${status.fileName} (dataset ${status.datasetId})`}
          {status.kind === "error" && `업로드 실패: ${status.message}`}
          {status.kind === "idle" && "파일을 드래그하거나 클릭하세요"}
        </span>
        <Mono style={{ color: "var(--ink-3)" }}>
          .json (consulting conversation array) &middot; max 50MB
        </Mono>
      </div>

      <div
        style={{
          marginTop: "24px",
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-2)",
          padding: "16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <Eyebrow>schema preview</Eyebrow>
          <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>6 fields</Mono>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          {[
            "source_id",
            "source",
            "consulting_category",
            "client_gender",
            "client_age",
            "consulting_content",
          ].map((col) => (
            <Mono
              key={col}
              style={{
                fontSize: 9,
                color: "var(--ink-3)",
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {col}
            </Mono>
          ))}
        </div>

        {[
          ["s1", "chat", "refund", "F", "30", "환불 가능한가요?"],
          ["s2", "chat", "refund", "M", "25", "주문번호 확인 부탁드립니다."],
        ].map((row, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "8px",
              padding: "6px 0",
              borderTop: i === 0 ? "1px solid var(--line-2)" : "none",
            }}
          >
            {row.map((cell, j) => (
              <Mono
                key={j}
                style={{
                  fontSize: 9,
                  color: "var(--ink-2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {cell}
              </Mono>
            ))}
          </div>
        ))}

        <div
          style={{
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: "1px solid var(--line-2)",
          }}
        >
          <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>
            PII 자동 마스킹: email, phone, card_number 필드는 업로드 시 자동으로
            마스킹됩니다.
          </Mono>
        </div>
      </div>
    </div>
  );
};
