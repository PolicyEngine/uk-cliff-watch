"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from "recharts";

const gbp = (v) =>
  (v < 0 ? "−£" : "£") + Math.round(Math.abs(v || 0)).toLocaleString("en-GB");

const PALETTE = {
  primaryBlue: "#2C6496",
  teal: "#39C6C0",
  bg: "#F7F9FB",
  text: "#1A1A1A",
  muted: "#5A6B7B",
  gridline: "#E3E8EE",
};

const styles = {
  wrapper: {
    background: PALETTE.bg,
    borderRadius: 16,
    padding: "24px 28px",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: PALETTE.text,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: PALETTE.text,
    lineHeight: 1.3,
  },
  subtitle: {
    margin: "6px 0 20px",
    fontSize: 13,
    color: PALETTE.muted,
    lineHeight: 1.5,
  },
  placeholder: {
    color: PALETTE.muted,
    fontSize: 14,
    padding: "24px 0",
    textAlign: "center",
  },
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${PALETTE.gridline}`,
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 13,
        color: PALETTE.text,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.region_name}</div>
      <div>
        Net income:{" "}
        <span style={{ fontWeight: 700 }}>{gbp(d.net_income_annual)}</span>
        <span style={{ color: PALETTE.muted }}> / yr</span>
      </div>
      <div style={{ color: PALETTE.muted, fontSize: 12 }}>
        {gbp(d.net_income_monthly)} / month
      </div>
    </div>
  );
}

export default function RegionComparison({ regions, selectedRegion }) {
  // Guard: no data yet
  if (!regions || regions.length === 0) {
    return (
      <div style={styles.wrapper}>
        <h2 style={styles.title}>Same household, every UK region</h2>
        <p style={styles.subtitle}>
          Net income at the current earnings level. Regions differ via devolved
          taxes, local housing costs and support.
        </p>
        <div style={styles.placeholder}>Calculating…</div>
      </div>
    );
  }

  // Sort descending by net_income_annual without mutating the prop
  const sorted = [...regions].sort(
    (a, b) => (b.net_income_annual || 0) - (a.net_income_annual || 0)
  );

  const chartHeight = Math.max(360, sorted.length * 30);

  return (
    <div style={styles.wrapper}>
      <h2 style={styles.title}>Same household, every UK region</h2>
      <p style={styles.subtitle}>
        Net income at the current earnings level. Regions differ via devolved
        taxes, local housing costs and support.
      </p>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 4, right: 80, bottom: 4, left: 8 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            horizontal={false}
            strokeDasharray="3 3"
            stroke={PALETTE.gridline}
          />
          <XAxis
            type="number"
            tickFormatter={gbp}
            tick={{ fontSize: 12, fill: PALETTE.muted }}
            axisLine={false}
            tickLine={false}
            tickCount={5}
          />
          <YAxis
            type="category"
            dataKey="region_name"
            width={150}
            tick={{ fontSize: 12, fill: PALETTE.text }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(44,100,150,0.06)" }} />
          <Bar dataKey="net_income_annual" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {sorted.map((entry) => (
              <Cell
                key={entry.region}
                fill={
                  entry.region === selectedRegion
                    ? PALETTE.primaryBlue
                    : PALETTE.teal
                }
              />
            ))}
            <LabelList
              dataKey="net_income_annual"
              position="right"
              formatter={gbp}
              style={{ fontSize: 11, fill: PALETTE.muted }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
