'use client';

// ── palette ──────────────────────────────────────────────────────────────────
const TEAL    = '#39C6C0';
const RED     = '#d9534f';
const BLUE    = '#2C6496';
const BG      = '#F7F9FB';
const TEXT    = '#1A1A1A';
const MUTED   = '#5A6B7B';
const GRID    = '#E3E8EE';

// ── local currency formatter ──────────────────────────────────────────────────
const gbp = (v) => (v < 0 ? '−£' : '£') + Math.round(Math.abs(v || 0)).toLocaleString('en-GB');

// ── Summary chip ──────────────────────────────────────────────────────────────
function Chip({ label, value, color, bold, op }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 16px',
        background: '#fff',
        border: `1px solid ${GRID}`,
        borderRadius: 8,
        minWidth: 110,
      }}
    >
      <span style={{ fontSize: 11, color: MUTED, marginBottom: 2, whiteSpace: 'nowrap' }}>
        {op && <span style={{ fontSize: 13, color: MUTED, marginRight: 4 }}>{op}</span>}
        {label}
      </span>
      <span
        style={{
          fontSize: 15,
          fontWeight: bold ? 700 : 600,
          color: color ?? TEXT,
        }}
      >
        {gbp(value)}
      </span>
    </div>
  );
}

// ── Mini bar ──────────────────────────────────────────────────────────────────
function MiniBar({ frac, color }) {
  return (
    <div
      style={{
        width: '100%',
        height: 6,
        background: GRID,
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, frac * 100)).toFixed(1)}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 0.3s',
        }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProgramBreakdown({ result }) {
  // Guard: missing result
  if (!result) {
    return (
      <div
        style={{
          height: 320,
          background: BG,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: MUTED,
          fontSize: 16,
          fontStyle: 'italic',
        }}
      >
        Calculating…
      </div>
    );
  }

  const { totals = {}, program_breakdown = [], region_name, cliff } = result;

  // Sort: benefits first (positive), taxes after (negative), both sorted by abs(annual) desc
  const benefits = (program_breakdown || [])
    .filter((p) => p.kind === 'benefit')
    .sort((a, b) => Math.abs(b.annual ?? 0) - Math.abs(a.annual ?? 0));

  const taxes = (program_breakdown || [])
    .filter((p) => p.kind === 'tax')
    .sort((a, b) => Math.abs(b.annual ?? 0) - Math.abs(a.annual ?? 0));

  const allItems = [...benefits, ...taxes];

  const maxAbs = allItems.reduce((m, p) => Math.max(m, Math.abs(p.annual ?? 0)), 1);

  const emr = cliff?.effective_marginal_rate;

  return (
    <div
      style={{
        background: BG,
        borderRadius: 12,
        padding: '20px 24px 20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: TEXT,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Where the money comes from</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
          At the current earnings level (annual).
          {region_name && (
            <span style={{ marginLeft: 6 }}>Region: <strong>{region_name}</strong>.</span>
          )}
        </div>
      </div>

      {/* Summary chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          margin: '16px 0 20px',
          alignItems: 'center',
        }}
      >
        <Chip label="Market income" value={totals.market_income} />
        <span style={{ color: MUTED, fontSize: 18, lineHeight: 1 }}>+</span>
        <Chip label="Benefits" value={totals.total_benefits} color={TEAL} />
        <span style={{ color: MUTED, fontSize: 18, lineHeight: 1 }}>−</span>
        <Chip label="Tax &amp; NI" value={totals.total_tax} color={RED} />
        <span style={{ color: MUTED, fontSize: 18, lineHeight: 1 }}>=</span>
        <Chip label="Net income" value={totals.net_income} color={BLUE} bold />
      </div>

      {/* Program table */}
      {allItems.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 13, fontStyle: 'italic' }}>No programme data.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 120px 80px',
              gap: '0 12px',
              padding: '0 8px 6px',
              fontSize: 11,
              fontWeight: 600,
              color: MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderBottom: `1px solid ${GRID}`,
              marginBottom: 4,
            }}
          >
            <span>Programme</span>
            <span style={{ textAlign: 'right' }}>Annual</span>
            <span style={{ paddingLeft: 0 }}>{/* bar */}</span>
            <span style={{ textAlign: 'right' }}>Monthly</span>
          </div>

          {allItems.map((item, i) => {
            const isBenefit = item.kind === 'benefit';
            const barColor  = isBenefit ? TEAL : RED;
            const amtColor  = isBenefit ? TEAL : RED;
            const frac      = Math.abs(item.annual ?? 0) / maxAbs;
            const isLast    = i === allItems.length - 1;
            const isFirstTax = item.kind === 'tax' && (i === 0 || allItems[i - 1].kind === 'benefit');

            return (
              <div key={item.key ?? i}>
                {/* Divider between benefits and taxes */}
                {isFirstTax && benefits.length > 0 && (
                  <div
                    style={{
                      height: 1,
                      background: GRID,
                      margin: '6px 0',
                    }}
                  />
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 120px 80px',
                    gap: '0 12px',
                    alignItems: 'center',
                    padding: '7px 8px',
                    borderRadius: 6,
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.7)' : 'transparent',
                    borderBottom: isLast ? 'none' : `1px solid ${GRID}`,
                  }}
                >
                  {/* Label */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>
                      {item.label ?? item.short_label ?? item.key}
                    </div>
                    {item.short_label && item.label && item.short_label !== item.label && (
                      <div style={{ fontSize: 11, color: MUTED }}>{item.short_label}</div>
                    )}
                  </div>

                  {/* Annual amount */}
                  <div
                    style={{
                      textAlign: 'right',
                      fontSize: 13,
                      fontWeight: 700,
                      color: amtColor,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isBenefit ? '' : '−'}{gbp(Math.abs(item.annual ?? 0))}
                  </div>

                  {/* Mini bar */}
                  <div style={{ paddingRight: 4 }}>
                    <MiniBar frac={frac} color={barColor} />
                  </div>

                  {/* Monthly */}
                  <div
                    style={{
                      textAlign: 'right',
                      fontSize: 12,
                      color: MUTED,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {gbp(Math.abs(item.monthly ?? 0))}/mo
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Effective marginal rate note */}
      {emr != null && (
        <div
          style={{
            marginTop: 16,
            padding: '8px 12px',
            background: '#fff',
            border: `1px solid ${RED}22`,
            borderLeft: `3px solid ${RED}`,
            borderRadius: 6,
            fontSize: 12,
            color: MUTED,
          }}
        >
          Effective marginal rate at this income:{' '}
          <strong style={{ color: RED }}>{Math.round(emr)}%</strong> — for every extra £1 earned,
          the household keeps only <strong>{gbp(1 - emr / 100)}</strong>p.
        </div>
      )}
    </div>
  );
}
