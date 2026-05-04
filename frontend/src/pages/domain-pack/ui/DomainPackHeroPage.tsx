import { useState } from "react";
import { AppShell } from "@/widgets/app-shell";

const WORKFLOWS = [
  { name: "환불 요청 접수", type: "intent", nodes: 12, risks: 3, trained: 1400, status: "PUBLISHED" as const },
  { name: "환불 진행", type: "intent", nodes: 26, risks: 7, trained: 2340, status: "PUBLISHED" as const },
  { name: "환불 확인", type: "intent", nodes: 8, risks: 1, trained: 813, status: "DRAFT" as const },
  { name: "재환불 처리", type: "intent", nodes: 15, risks: 4, trained: 657, status: "ARCHIVED" as const },
];

const statusTone: Record<string, string> = {
  PUBLISHED: "var(--signal)",
  DRAFT: "var(--info)",
  ARCHIVED: "var(--ink-3)",
};

export function DomainPackHeroPage() {
  const [selectedWf, setSelectedWf] = useState(WORKFLOWS[1]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  return (
    <AppShell>
      <div className="flex flex-1 min-h-0">
        <div className="w-[224px] border-r border-[var(--line)] flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--line)]">
            <div className="text-[11px] font-medium text-[var(--ink)]">Workflows</div>
            <div className="text-[10px] text-[var(--ink-3)]" style={{fontFamily:'var(--mono)'}}>4 workflows</div>
          </div>
          <div className="flex-1 overflow-auto">
            {WORKFLOWS.map((wf) => (
              <button
                key={wf.name}
                onClick={() => { setSelectedWf(wf); setSelectedNode(null); }}
                className="w-full text-left px-4 py-3 border-b border-[var(--line)] hover:bg-[var(--paper-2)] transition-colors"
                style={{ background: selectedWf.name === wf.name ? "var(--paper-2)" : "transparent" }}
              >
                <div className="text-[12px] text-[var(--ink)]" style={{fontFamily:'var(--mono)'}}>{wf.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border text-[var(--ink-3)]" style={{
                    borderColor: statusTone[wf.status],
                    color: statusTone[wf.status],
                  }}>{wf.status}</span>
                  <span className="text-[10px] text-[var(--ink-3)]">{wf.nodes} nodes</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-6 py-4 border-b border-[var(--line)]">
            <h1 className="text-[18px] font-medium text-[var(--ink)]" style={{letterSpacing:'-0.02em'}}>
              Card payment refund flow
              <span className="ml-3 text-[var(--signal-ink)]" style={{fontFamily:'var(--serif)', fontStyle:'italic'}}>
                — 환불 정책 v2 적용
              </span>
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--signal)]/10 text-[var(--signal)]">검토 중 · v0.4</span>
              <span className="text-[10px] text-[var(--ink-3)]" style={{fontFamily:'var(--mono)'}}>
                wf-3 · {selectedWf.nodes} nodes · {selectedWf.risks} risk gates · trained on {selectedWf.trained} conversations
              </span>
            </div>
          </div>

          <div className="flex-1 bg-[var(--paper-2)] relative overflow-auto" style={{
            backgroundImage: "radial-gradient(var(--ink-3) 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
            opacity: 0.7,
          }}>
            <div className="absolute inset-0 flex items-center justify-center gap-16">
              <div className="flex flex-col gap-8">
                {[
                  { id: "n1", label: "환불 요청 확인", type: "decision" },
                  { id: "n2", label: "환불 금액 계산", type: "task" },
                  { id: "n3", label: "리스크 평가", type: "risk_gate" },
                ].map((node) => (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNode(node.id)}
                    className="px-4 py-3 rounded-lg border text-left transition-all"
                    style={{
                      borderColor: selectedNode === node.id ? "var(--signal)" : "var(--line)",
                      background: selectedNode === node.id ? "var(--paper)" : "var(--paper)",
                      boxShadow: selectedNode === node.id ? "0 0 0 2px var(--signal)" : "none",
                    }}
                  >
                    <div className="text-[10px] text-[var(--ink-3)]" style={{fontFamily:'var(--mono)'}}>{node.id} · {node.type}</div>
                    <div className="text-[11px] text-[var(--ink)] mt-0.5">{node.label}</div>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-8 mt-12">
                {[
                  { id: "n4", label: "상담사 확인", type: "human" },
                  { id: "n5", label: "환불 처리", type: "task" },
                  { id: "n6", label: "고객 통보", type: "task" },
                ].map((node) => (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNode(node.id)}
                    className="px-4 py-3 rounded-lg border text-left transition-all"
                    style={{
                      borderColor: selectedNode === node.id ? "var(--signal)" : "var(--line)",
                      background: selectedNode === node.id ? "var(--paper)" : "var(--paper)",
                      boxShadow: selectedNode === node.id ? "0 0 0 2px var(--signal)" : "none",
                    }}
                  >
                    <div className="text-[10px] text-[var(--ink-3)]" style={{fontFamily:'var(--mono)'}}>{node.id} · {node.type}</div>
                    <div className="text-[11px] text-[var(--ink)] mt-0.5">{node.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-3 border-t border-[var(--line)] flex items-center gap-8">
            {[
              { label: "Avg duration", value: "43s" },
              { label: "Completion", value: "92%" },
              { label: "Handoff", value: "8%" },
              { label: "Risk-blocked", value: "3%" },
              { label: "Coverage", value: "87%" },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--ink-3)]">{m.label}</span>
                <span className="text-[12px] font-medium" style={{fontFamily:'var(--mono)'}}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-[320px] border-l border-[var(--line)] flex flex-col">
          {selectedNode ? (
            <>
              <div className="px-4 py-3 border-b border-[var(--line)]">
                <div className="text-[11px] font-medium text-[var(--ink)]">{selectedNode}</div>
                <div className="text-[10px] text-[var(--ink-3)]" style={{fontFamily:'var(--mono)'}}>decision · risk_gate</div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <div className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] mb-3">Properties</div>
                <div className="space-y-2 text-[11px] text-[var(--ink-2)]">
                  <div>Type: <span className="text-[var(--ink)]">decision</span></div>
                  <div>Slots: <span className="px-1.5 py-0.5 text-[10px] rounded border border-[var(--line)] text-[var(--ink)]">amount</span>{" "}
                    <span className="px-1.5 py-0.5 text-[10px] rounded border border-[var(--line)] text-[var(--ink)]">reason</span></div>
                  <div>Policy refs: <span className="text-[var(--signal)]">환불 정책 v2 §3.1</span></div>
                </div>
                <div className="mt-4 pt-4 border-t border-[var(--line)]">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] mb-2">Review</div>
                  {[
                    { who: "강희원", text: "이 노드는 risk gate로 변경 검토 필요", when: "2d ago" },
                    { who: "배성연", text: "동의합니다. 반영 완료했습니다.", when: "1d ago" },
                  ].map((c, i) => (
                    <div key={i} className="mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[var(--ink)]">{c.who}</span>
                        <span className="text-[9px] text-[var(--ink-3)]">{c.when}</span>
                        <span className="text-[9px] text-[var(--signal)]">✓ resolved</span>
                      </div>
                      <div className="text-[10px] text-[var(--ink-2)] mt-0.5">{c.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-[11px] text-[var(--ink-3)]">
              노드를 선택하세요
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
