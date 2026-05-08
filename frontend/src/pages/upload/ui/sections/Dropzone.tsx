import React from "react";
import { Eyebrow, Mono, Icon } from "@/shared/ui/ostone/atoms";

export const Dropzone: React.FC = () => {
  return (
    <div
      style={{
        border: "1.5px dashed var(--line)",
        background: "var(--paper-2)",
        padding: "28px",
        borderRadius: "var(--r-3)",
        position: "relative",
        overflow: "hidden",
      }}
    >
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
            color: "var(--ink)",
          }}
        >
          파일을 드래그하거나 클릭하세요
        </span>
        <Mono style={{ color: "var(--ink-3)" }}>
          .csv &middot; .jsonl &middot; .parquet &middot; max 2GB
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
          <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>7 columns</Mono>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          {[
            "conversation_id",
            "turn_index",
            "role",
            "text",
            "created_at",
            "channel",
            "meta(optional)",
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
          ["conv_001", "0", "user", "환불 가능한가요?", "2026-04-28", "chat", "{}"],
          ["conv_001", "1", "agent", "네, 주문번호를 알려주세요.", "2026-04-28", "chat", "{}"],
        ].map((row, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
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
