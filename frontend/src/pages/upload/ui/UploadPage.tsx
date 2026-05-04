import React, { useState } from "react";
import { AppShell } from "@/widgets/app-shell";

const DATASETS = [
  { name: "card-cs-logs-2026-04.jsonl", size: "48 MB", convs: 1389, stage: "publish_candidate", score: 0.92, ago: "14:22" },
  { name: "card-cs-logs-2026-03.jsonl", size: "52 MB", convs: 1520, stage: "evaluation", score: 0.87, ago: "어제" },
  { name: "shop-logs-0425.csv", size: "12 MB", convs: 421, stage: "draft_generation", score: null, ago: "2일 전" },
  { name: "telco-april.jsonl", size: "96 MB", convs: 2104, stage: "intent_discovery", score: null, ago: "4일 전" },
  { name: "dlv-refund-mar.csv", size: "4.2 MB", convs: 187, stage: "preprocessing", score: null, ago: "1주 전" },
];

const STAGES = ["ingestion", "preprocessing", "intent_discovery", "draft_generation", "evaluation", "publish_candidate"];

export const UploadPage: React.FC = () => {
  const [dragOver, setDragOver] = useState(false);

  return (
    <AppShell>
      <div className="flex flex-col flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <div className="text-[10px] text-[var(--ink-3)] mb-1">Pipeline · 6 stages · last run 14:22</div>
          <h1 className="text-[20px] font-medium text-[var(--ink)]" style={{letterSpacing:'-0.02em'}}>
            상담 로그 → <span className="text-[var(--signal-ink)]" style={{fontFamily:'var(--serif)', fontStyle:'italic'}}>도메인 팩 초안</span>
          </h1>
          <p className="text-xs text-[var(--ink-3)] max-w-[620px] mt-1">
            CSV / JSONL / Parquet 형식의 상담 로그를 업로드하면 6단계 파이프라인이 자동 실행됩니다.
          </p>
        </div>

        <div className="grid grid-cols-[1.05fr,1fr] gap-[18px] mb-7">
          <div
            className="border-2 border-dashed rounded-lg p-7 text-center transition-colors cursor-pointer"
            style={{
              borderColor: dragOver ? "var(--signal)" : "var(--line)",
              background: dragOver ? "var(--paper-2)" : "var(--paper)",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input id="file-input" type="file" accept=".csv,.jsonl,.parquet" className="hidden" />
            <div className="text-2xl mb-2">📤</div>
            <div className="text-sm font-medium text-[var(--ink)]">파일을 드래그하거나 클릭하세요</div>
            <div className="text-[10px] text-[var(--ink-3)] mt-1" style={{fontFamily:'var(--mono)'}}>.csv · .jsonl · .parquet</div>
          </div>

          <div className="border rounded-lg p-5" style={{borderColor:'var(--line)'}}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[var(--signal)]" />
              <span className="text-[10px] font-medium text-[var(--signal)]">RUNNING</span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-[var(--ink-3)]">Run ID</span><span className="text-[var(--ink)]" style={{fontFamily:'var(--mono)'}}>pipeline_run_20260428_1422</span></div>
              <div className="flex justify-between"><span className="text-[var(--ink-3)]">Started</span><span className="text-[var(--ink)]">14:22</span></div>
              <div className="flex justify-between"><span className="text-[var(--ink-3)]">File</span><span className="text-[var(--ink)]">card-cs-logs-2026-04.jsonl</span></div>
              <div className="flex justify-between"><span className="text-[var(--ink-3)]">Size</span><span className="text-[var(--ink)]">48 MB</span></div>
              <div className="flex justify-between"><span className="text-[var(--ink-3)]">Conversations</span><span className="text-[var(--ink)]">1,389</span></div>
              <div className="flex justify-between"><span className="text-[var(--ink-3)]">Turns</span><span className="text-[var(--ink)]">4,218</span></div>
              <div className="flex justify-between"><span className="text-[var(--ink-3)]">ETA</span><span className="text-[var(--ink)]">~6m</span></div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="px-3 py-1 text-[10px] rounded border border-[var(--line)] text-[var(--ink-2)]">Pause</button>
              <button className="px-3 py-1 text-[10px] rounded border border-[var(--line)] text-[var(--ink-2)]">Cancel</button>
            </div>
          </div>
        </div>

        <h2 className="text-sm font-medium text-[var(--ink)] mb-3">데이터셋</h2>
        <table className="w-full text-xs mb-7">
          <thead>
            <tr className="border-b border-[var(--line)] text-[var(--ink-3)]">
              <th className="text-left py-2 font-normal">Name</th>
              <th className="text-left py-2 font-normal">Size</th>
              <th className="text-left py-2 font-normal">Conversations</th>
              <th className="text-left py-2 font-normal">Stage</th>
              <th className="text-left py-2 font-normal">Quality</th>
              <th className="text-left py-2 font-normal">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {DATASETS.map((ds) => {
              const stageIdx = STAGES.indexOf(ds.stage);
              return (
                <tr key={ds.name} className="border-b border-[var(--line)] hover:bg-[var(--paper-2)]">
                  <td className="py-2 text-[var(--ink)]">{ds.name}</td>
                  <td className="py-2 text-[var(--ink-2)]">{ds.size}</td>
                  <td className="py-2 text-[var(--ink-2)]">{ds.convs}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      {STAGES.map((s, i) => (
                        <span key={s} className="w-1.5 h-1.5 rounded-full" style={{
                          background: i <= stageIdx ? "var(--signal)" : "var(--line)"
                        }} />
                      ))}
                      <span className="text-[10px] text-[var(--ink-2)] ml-1">{ds.stage}</span>
                    </div>
                  </td>
                  <td className="py-2 text-[var(--ink-2)]">{ds.score?.toFixed(2) ?? "-"}</td>
                  <td className="py-2 text-[var(--ink-3)]">{ds.ago}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="grid grid-cols-[1.4fr,1fr] gap-[18px]">
          <div className="border rounded-lg p-5" style={{borderColor:'var(--line)'}}>
            <div className="text-[11px] font-medium text-[var(--ink)] mb-3">Evaluation Trend</div>
            <div className="h-[140px] flex items-end gap-1">
              {[0.82, 0.84, 0.81, 0.86, 0.85, 0.88, 0.87, 0.90, 0.89, 0.92].map((v, i) => (
                <div key={i} className="flex-1 rounded-t" style={{
                  height: `${v * 100}%`,
                  background: "var(--signal)",
                  opacity: 0.7,
                }} />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-[var(--ink-3)] mt-1">
              <span>Apr 19</span><span>Apr 28</span>
            </div>
          </div>

          <div className="border rounded-lg p-5" style={{borderColor:'var(--line)'}}>
            <div className="text-[11px] font-medium text-[var(--ink)] mb-3">Quality Issues</div>
            {[
              { key: "QI-0421", msg: "Outlier intent misclassification", count: 12, sev: "warn" as const },
              { key: "QI-0418", msg: "Missing slot in 환불 요청", count: 8, sev: "warn" as const },
              { key: "QI-0415", msg: "Low coverage on 재환불 flow", count: 5, sev: "mute" as const },
            ].map((issue) => (
              <div key={issue.key} className="flex items-center gap-2 mb-2">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{background: issue.sev === "warn" ? "var(--warn)/20" : "var(--ink-3)/10", color: issue.sev === "warn" ? "var(--warn)" : "var(--ink-3)"}}>{issue.sev}</span>
                <span className="text-[10px] text-[var(--ink)]" style={{fontFamily:'var(--mono)'}}>{issue.key}</span>
                <span className="text-[10px] text-[var(--ink-2)]">{issue.msg}</span>
                <span className="text-[10px] text-[var(--ink-3)] ml-auto">{issue.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
};
