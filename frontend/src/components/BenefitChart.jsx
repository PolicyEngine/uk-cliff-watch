'use client';

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

// ── palette ──────────────────────────────────────────────────────────────────
const BLUE    = '#2C6496';
const RED     = '#d9534f';
const BG      = '#F7F9FB';
const TEXT    = '#1A1A1A';
const MUTED   = '#5A6B7B';
const GRID    = '#E3E8EE';

// ── local currency formatter ──────────────────────────────────────────────────
const gbp = (v) => (v < 0 ? '−£' : '£') + Math.round(Math.abs(v || 0)).toLocaleString('en-GB');

// ── Segmented toggle ──────────────────────────────────────────────────────────
function ViewToggle({ view, onViewChange }) {
  const options = [
    { value: 'net_income',        label: 'Net income' },
    { value: 'net_after_housing', label: 'After housing costs' },
  ];

  return (
    <div
      style={{
        display: 'inline-flex',
        border: `1px solid ${GRID}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {options.map((opt) => {
        const active = view === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onViewChange && onViewChange(opt.value)}
            style={{
              padding: '5px 14px',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              background: active ? BLUE : '#fff',
              color: active ? '#fff' : MUTED,
              border: 'none',
              cursor: onViewChange ? 'pointer' : 'default',
              outline: 'none',
              transition: 'background 0.15s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, view }) {
  if (!active || !payload || payload.length === 0) return null;

  // Find the data point from payload entries
  const dataPoint = payload[0]?.payload || {};
  const earned    = dataPoint.earned_income ?? label;
  const netVal    = dataPoint[view];
  const mtr       = dataPoint.marginal_rate_pct;
  const isCliff   = dataPoint.is_cliff;
  const cliffDrop = dataPoint.cliff_drop_annual;
  const drivers   = dataPoint.cliff_drivers;

  const boxStyle = {
    background: '#fff',
    border: `1px solid ${GRID}`,
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: TEXT,
    minWidth: 220,
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
  };
  const rowStyle = { display: 'flex', justifyContent: 'space-between', gap: 24, margin: '3px 0' };
  const labelStyle = { color: MUTED };
  const valueStyle = { fontWeight: 600 };

  return (
    <div style={boxStyle}>
      <div style={{ ...rowStyle, borderBottom: `1px solid ${GRID}`, paddingBottom: 6, marginBottom: 6 }}>
        <span style={labelStyle}>Gross earnings</span>
        <span style={valueStyle}>{gbp(earned)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>{view === 'net_income' ? 'Net income' : 'After housing costs'}</span>
        <span style={{ ...valueStyle, color: BLUE }}>{gbp(netVal)}</span>
      </div>
      {mtr != null && (
        <div style={rowStyle}>
          <span style={labelStyle}>Marginal rate</span>
          <span style={{ ...valueStyle, color: mtr > 80 ? RED : TEXT }}>{Math.round(mtr)}%</span>
        </div>
      )}
      {isCliff && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${GRID}`,
          }}
        >
          <div style={{ color: RED, fontWeight: 700, marginBottom: 4, fontSize: 12 }}>
            BENEFIT CLIFF — drop of {gbp(Math.abs(cliffDrop ?? 0))}/yr
          </div>
          {Array.isArray(drivers) && drivers.map((d, i) => (
            <div key={i} style={{ ...rowStyle, fontSize: 12 }}>
              <span style={labelStyle}>{d.label}</span>
              <span style={{ color: RED, fontWeight: 600 }}>{gbp(d.resource_effect_annual)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BenefitChart({ series, payload, view = 'net_income', onViewChange }) {
  // Guard: missing or empty data
  const data = series?.data;
  const isEmpty = !data || data.length === 0;

  if (isEmpty) {
    return (
      <div
        style={{
          height: 420,
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

  // Cliff reference lines: cap at 6 most severe
  const cliffPoints = data
    .filter((d) => d.is_cliff)
    .sort((a, b) => Math.abs(b.cliff_drop_annual ?? 0) - Math.abs(a.cliff_drop_annual ?? 0))
    .slice(0, 6);

  const maxMTR = series?.max_marginal_rate_pct ?? 100;
  const mtrDomain = [0, Math.max(100, maxMTR)];

  return (
    <div
      style={{
        background: BG,
        borderRadius: 12,
        padding: '20px 24px 16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: TEXT,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Net income as earnings rise</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
          Every £1 earned, and what the household keeps after tax and withdrawn benefits.
        </div>
      </div>

      {/* Toggle */}
      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <ViewToggle view={view} onViewChange={onViewChange} />
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={420}>
        <ComposedChart data={data} margin={{ top: 8, right: 60, left: 16, bottom: 32 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />

          <XAxis
            dataKey="earned_income"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={gbp}
            tick={{ fontSize: 12, fill: MUTED }}
            label={{
              value: 'Gross earnings (£/yr)',
              position: 'insideBottom',
              offset: -20,
              fontSize: 12,
              fill: MUTED,
            }}
          />

          {/* Left Y axis — money */}
          <YAxis
            yAxisId="money"
            tickFormatter={gbp}
            tick={{ fontSize: 12, fill: MUTED }}
            width={80}
          />

          {/* Right Y axis — marginal rate % */}
          <YAxis
            yAxisId="mtr"
            orientation="right"
            domain={mtrDomain}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12, fill: MUTED }}
            width={44}
          />

          <Tooltip
            content={(props) => <ChartTooltip {...props} view={view} />}
            isAnimationActive={false}
          />

          {/* Net income area */}
          <Area
            yAxisId="money"
            type="monotone"
            dataKey={view}
            name={view === 'net_income' ? 'Net income' : 'After housing costs'}
            stroke={BLUE}
            strokeWidth={2}
            fill={BLUE}
            fillOpacity={0.10}
            dot={false}
            isAnimationActive={false}
          />

          {/* Marginal rate line */}
          <Line
            yAxisId="mtr"
            type="monotone"
            dataKey="marginal_rate_pct"
            name="Marginal rate %"
            stroke={RED}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />

          {/* Cliff reference lines */}
          {cliffPoints.map((cp, i) => (
            <ReferenceLine
              key={i}
              yAxisId="money"
              x={cp.earned_income}
              stroke={RED}
              strokeDasharray="3 3"
              strokeWidth={1.5}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Footer legend */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
          marginTop: 8,
          fontSize: 12,
          color: MUTED,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 28,
              height: 3,
              background: BLUE,
              borderRadius: 2,
            }}
          />
          Net income (left axis)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 28,
              height: 2,
              background: RED,
              borderRadius: 2,
            }}
          />
          Marginal rate % (right axis)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 28,
              height: 0,
              borderTop: `2px dashed ${RED}`,
            }}
          />
          Benefit cliff
        </span>
      </div>
    </div>
  );
}
