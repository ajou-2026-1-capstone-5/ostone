import {
  Eyebrow,
  Icon,
  Pill,
  Mono,
  Bar,
  Avatar,
  Dot,
} from '@/shared/ui/ostone/atoms';

function InspectorHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: '1px solid var(--line-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Eyebrow>Selected node</Eyebrow>
        <div
          style={{
            width: '26px',
            height: '26px',
            background: 'var(--signal-bg)',
            borderRadius: 'var(--r-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              background: 'var(--signal-ink)',
              transform: 'rotate(45deg)',
            }}
          />
        </div>
        <span
          style={{
            fontFamily: 'var(--sans)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--ink)',
          }}
        >
          eligible_check
        </span>
        <Mono style={{ fontSize: '11px', color: 'var(--ink-3)' }}>
          n3 · decision · risk_gate
        </Mono>
      </div>
      <button
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '26px',
          height: '26px',
          borderRadius: 'var(--r-2)',
          border: '1px solid var(--line)',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--ink-3)',
        }}
      >
        <Icon name="dot3" size={16} />
      </button>
    </div>
  );
}

function InspectorMetrics() {
  const stats = [
    { label: 'Pass rate', value: '0.86', meta: '+2.3%', metaColor: 'var(--signal)' },
    { label: 'Samples', value: '1,334', meta: '1389 total' },
    { label: 'Latency', value: '0.34s', meta: 'p50' },
    { label: 'Confidence', value: '0.79', meta: null, bar: 0.79 },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        padding: '14px 18px',
        borderBottom: '1px solid var(--line-2)',
      }}
    >
      {stats.map((s) => (
        <div key={s.label}>
          <Eyebrow>{s.label}</Eyebrow>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '4px',
            }}
          >
            <span
              className="t-num"
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--ink)',
              }}
            >
              {s.value}
            </span>
            {s.meta && (
              <Mono
                style={{
                  fontSize: '9px',
                  color: s.metaColor ?? 'var(--ink-3)',
                }}
              >
                {s.meta}
              </Mono>
            )}
          </div>
          {s.bar !== undefined && (
            <div style={{ marginTop: '4px' }}>
              <Bar value={s.bar} tone="signal" w={80} h={4} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface InspFieldProps {
  label: string;
  type: string;
  required: boolean;
  matchRate: number;
}

function InspField({ label, type, required, matchRate }: InspFieldProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 0',
      }}
    >
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: 'var(--r-1)',
          background: 'var(--paper-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="db" size={12} className="db-icon" />
      </div>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--ink)',
        }}
      >
        {label}
      </span>
      <Mono style={{ fontSize: '9px', color: 'var(--ink-3)' }}>{type}</Mono>
      <Pill tone={required ? 'signal' : 'mute'}>
        {required ? 'required' : 'optional'}
      </Pill>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Bar value={matchRate} tone="signal" w={48} h={3} />
        <Mono style={{ fontSize: '9px', color: 'var(--ink-3)' }}>
          {Math.round(matchRate * 100)}%
        </Mono>
      </div>
    </div>
  );
}

function InspectorFields() {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Eyebrow>Fields extracted</Eyebrow>
        <Mono style={{ fontSize: '10px', color: 'var(--ink-3)' }}>3 of 7 slots</Mono>
      </div>
      <InspField label="amount" type="number" required matchRate={0.94} />
      <InspField label="card_last4" type="string" required matchRate={0.88} />
      <InspField label="merchant_id" type="string" required={false} matchRate={0.76} />
    </div>
  );
}

interface PolicyRowProps {
  id: string;
  kind: string;
  description: string;
  passRate: string;
  dotTone: 'signal' | 'warn' | 'danger' | 'info' | 'mute';
  barValue: number;
}

function PolicyRow({ id, kind, description, passRate, dotTone, barValue }: PolicyRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '70px' }}>
        <Mono style={{ fontSize: '10px', color: 'var(--ink-2)' }}>{id}</Mono>
        <Pill tone="mute">{kind}</Pill>
      </div>
      <span
        style={{
          fontFamily: 'var(--sans)',
          fontSize: '12px',
          color: 'var(--ink)',
          flex: 1,
        }}
      >
        {description}
      </span>
      <Mono style={{ fontSize: '10px', color: 'var(--ink-3)' }}>{passRate}</Mono>
      <Dot tone={dotTone} size={6} />
      <Bar value={barValue} tone="signal" w={48} h={3} />
    </div>
  );
}

function InspectorPolicies() {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Eyebrow>Applied policies</Eyebrow>
        <Mono style={{ fontSize: '10px', color: 'var(--ink-3)' }}>2</Mono>
      </div>
      <PolicyRow
        id="POL-001"
        kind="eligibility"
        description="Minimum amount > 10,000 KRW"
        passRate="passes 96.2%"
        dotTone="signal"
        barValue={0.962}
      />
      <PolicyRow
        id="POL-014"
        kind="limit"
        description="Daily refund limit 3/5"
        passRate="passes 88.7%"
        dotTone="warn"
        barValue={0.887}
      />
    </div>
  );
}

interface BranchRowProps {
  label: string;
  percent: string;
  fraction: number;
  fillColor: string;
  isHot?: boolean;
}

function BranchRow({ label, percent, fraction, fillColor, isHot }: BranchRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '5px 0',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--sans)',
          fontSize: '12px',
          color: 'var(--ink)',
          flex: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: '12px',
          fontVariantNumeric: 'tabular-nums',
          color: isHot ? 'var(--signal)' : 'var(--ink-2)',
          fontWeight: isHot ? 600 : 400,
        }}
      >
        {percent}
      </span>
      <div
        style={{
          width: '80px',
          height: '4px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--line-2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${fraction * 100}%`,
            height: '100%',
            borderRadius: 'var(--r-pill)',
            background: fillColor,
          }}
        />
      </div>
    </div>
  );
}

function InspectorBranch() {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)' }}>
      <div style={{ marginBottom: '8px' }}>
        <Eyebrow>Branch analysis</Eyebrow>
      </div>
      <BranchRow
        label="pass · risk ≤ 0.4"
        percent="82.0%"
        fraction={0.82}
        fillColor="var(--signal)"
        isHot
      />
      <BranchRow
        label="risk > 0.4"
        percent="14.0%"
        fraction={0.14}
        fillColor="var(--warn)"
      />
      <BranchRow
        label="× ineligible"
        percent="4.0%"
        fraction={0.04}
        fillColor="var(--danger)"
      />
    </div>
  );
}

function InspectorSample() {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)' }}>
      <div style={{ marginBottom: '8px' }}>
        <Eyebrow>Sample conversation turn</Eyebrow>
      </div>
      <div
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-2)',
          padding: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}
        >
          <Avatar initial="CS" tone="mute" size={24} />
          <Mono style={{ fontSize: '11px', color: 'var(--ink-2)' }}>CS-7</Mono>
          <Mono style={{ fontSize: '11px', color: 'var(--ink-3)' }}>14:22:34</Mono>
          <div style={{ marginLeft: 'auto' }}>
            <Pill tone="mute">turn 47/89</Pill>
          </div>
        </div>
        <p
          style={{
            fontFamily: 'var(--sans)',
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--ink)',
            margin: 0,
            marginBottom: '8px',
          }}
        >
          고객님, 카드 결제 내역 확인 결과 부분 환불이 가능하십니다. 현재까지 3회 환불
          중 2회 사용하셨고, 남은 횟수 내에서 처리 가능합니다.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Eyebrow>matched intent: refund.partial</Eyebrow>
          <Pill tone="signal">confidence 0.91</Pill>
        </div>
      </div>
    </div>
  );
}

interface ReviewCommentProps {
  initial: string;
  name: string;
  tone: 'signal' | 'warn' | 'info' | 'mute';
  timeAgo: string;
  body: string;
  status: string;
  statusTone: 'signal' | 'warn' | 'danger' | 'info' | 'mute' | 'ink';
}

function ReviewComment({
  initial,
  name,
  tone,
  timeAgo,
  body,
  status,
  statusTone,
}: ReviewCommentProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '8px 0',
      }}
    >
      <Avatar initial={initial} tone={tone} size={28} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '2px',
          }}
        >
          <Mono style={{ fontSize: '11px', color: 'var(--ink-2)' }}>{name}</Mono>
          <Mono style={{ fontSize: '10px', color: 'var(--ink-4)' }}>{timeAgo}</Mono>
        </div>
        <p
          style={{
            fontFamily: 'var(--sans)',
            fontSize: '12px',
            lineHeight: 1.4,
            color: 'var(--ink)',
            margin: 0,
            marginBottom: '4px',
          }}
        >
          {body}
        </p>
        <Pill tone={statusTone}>{status}</Pill>
      </div>
    </div>
  );
}

function InspectorReview() {
  return (
    <div style={{ padding: '14px 18px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Eyebrow>Review thread</Eyebrow>
          <Mono style={{ fontSize: '10px', color: 'var(--ink-3)' }}>3 comments</Mono>
        </div>
        <button
          type="button"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            color: 'var(--signal)',
            cursor: 'pointer',
          }}
        >
          + Add
        </button>
      </div>
      <ReviewComment
        initial="KH"
        name="김희원"
        tone="signal"
        timeAgo="2d ago"
        body="이 조건문에서 예외 케이스를 더 추가해야 합니다"
        status="resolved"
        statusTone="signal"
      />
      <ReviewComment
        initial="HJ"
        name="홍준혁"
        tone="warn"
        timeAgo="1d ago"
        body="POL-014 limit 체크 로직이 오탐지율이 높습니다. 확인 필요"
        status="open"
        statusTone="warn"
      />
      <ReviewComment
        initial="SY"
        name="송예린"
        tone="mute"
        timeAgo="4h ago"
        body="risk_review 노드 임계값 0.4 → 0.35 조정 제안"
        status="open"
        statusTone="warn"
      />
    </div>
  );
}

export function Inspector() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'auto',
      }}
    >
      <InspectorHeader />
      <InspectorMetrics />
      <InspectorFields />
      <InspectorPolicies />
      <InspectorBranch />
      <InspectorSample />
      <InspectorReview />
    </div>
  );
}
