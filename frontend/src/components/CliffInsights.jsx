"use client";

const gbp = (v) =>
  (v < 0 ? "−£" : "£") + Math.round(Math.abs(v || 0)).toLocaleString("en-GB");

const PALETTE = {
  primaryBlue: "#2C6496",
  teal: "#39C6C0",
  cliffRed: "#d9534f",
  amber: "#F4B740",
  green: "#2E8540",
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
  placeholder: {
    color: PALETTE.muted,
    fontSize: 14,
    padding: "24px 0",
    textAlign: "center",
  },
  cardsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    border: `1px solid ${PALETTE.gridline}`,
    padding: 16,
    flex: "1 1 180px",
    minWidth: 160,
    maxWidth: 260,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: PALETTE.muted,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: 6,
  },
  cardNote: {
    fontSize: 12,
    color: PALETTE.muted,
    lineHeight: 1.4,
  },
  narrative: {
    fontSize: 14,
    color: PALETTE.muted,
    lineHeight: 1.7,
    borderTop: `1px solid ${PALETTE.gridline}`,
    paddingTop: 16,
    margin: 0,
  },
};

// ── helpers ──────────────────────────────────────────────────────────────────

function marginalRateColor(rate) {
  if (rate >= 0.6) return PALETTE.cliffRed;
  if (rate >= 0.4) return PALETTE.amber;
  return PALETTE.green;
}

/** Find the worst cliff in series.data (largest cliff_drop_annual > 0). */
function findWorstCliff(data) {
  if (!Array.isArray(data) || data.length === 0) return null;
  let best = null;
  for (const pt of data) {
    const drop = pt.cliff_drop_annual || 0;
    if (drop > 0 && (!best || drop > best.cliff_drop_annual)) {
      best = pt;
    }
  }
  return best;
}

/**
 * Find the longest consecutive run of points with marginal_rate_pct >= 60.
 * Returns { start: earned_income, end: earned_income, length } or null.
 */
function findFlatHighRateZone(data, threshold = 60) {
  if (!Array.isArray(data) || data.length === 0) return null;

  let bestRun = null;
  let runStart = null;
  let runLen = 0;

  for (let i = 0; i < data.length; i++) {
    const pt = data[i];
    if ((pt.marginal_rate_pct || 0) >= threshold) {
      if (runStart === null) runStart = pt;
      runLen++;
    } else {
      if (runLen > 0 && (!bestRun || runLen > bestRun.length)) {
        bestRun = { start: runStart.earned_income, end: data[i - 1].earned_income, length: runLen };
      }
      runStart = null;
      runLen = 0;
    }
  }
  // Handle run that extends to end of array
  if (runLen > 0 && (!bestRun || runLen > bestRun.length)) {
    bestRun = {
      start: runStart.earned_income,
      end: data[data.length - 1].earned_income,
      length: runLen,
    };
  }

  // Only meaningful if the zone spans at least ~£2,000 of earnings
  if (!bestRun || bestRun.end - bestRun.start < 2000) return null;
  return bestRun;
}

/** Build the dynamic narrative paragraph. */
function buildNarrative(result, seriesData, maxMarginalRatePct) {
  const zone = findFlatHighRateZone(seriesData);

  if (zone) {
    const keepPence = Math.round(
      100 - (maxMarginalRatePct || 60)
    );
    const keepStr = keepPence > 0 ? `${keepPence}p` : "very little";
    return (
      `This household keeps ${keepStr} of each extra pound earned across roughly ` +
      `${gbp(zone.start)}–${gbp(zone.end)} of earnings — a flat wall of high marginal rates ` +
      `created by the Universal Credit taper stacking on Income Tax and National Insurance.`
    );
  }

  // Fallback: describe the household's net income and marginal rate
  const netIncome = result?.totals?.net_income;
  const emr = result?.cliff?.effective_marginal_rate;
  if (netIncome != null && emr != null) {
    const pct = Math.round(emr * 100);
    return (
      `At current earnings this household takes home ${gbp(netIncome)} per year. ` +
      `The effective marginal rate is ${pct}% — meaning ${pct}p of each additional pound ` +
      `is lost to tax or withdrawn benefits. Check the full curve above to see where ` +
      `work pays best.`
    );
  }

  return (
    "Adjust the sliders above to see how taxes and benefits interact for this household " +
    "across different earnings levels."
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export default function CliffInsights({ result, series }) {
  const hasResult = result != null;
  const hasSeries = series != null && Array.isArray(series.data);

  if (!hasResult && !hasSeries) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.placeholder}>Calculating…</div>
      </div>
    );
  }

  // ── Card 1: Marginal rate on the next £1 ─────────────────────────────────
  const emr = result?.cliff?.effective_marginal_rate ?? null;
  const emrPct = emr != null ? Math.round(emr * 100) : null;
  const emrColor = emr != null ? marginalRateColor(emr) : PALETTE.muted;

  // ── Card 2: Worst cliff ───────────────────────────────────────────────────
  const worstCliff = hasSeries ? findWorstCliff(series.data) : null;

  // ── Card 3: Highest marginal rate ─────────────────────────────────────────
  const maxRate = series?.max_marginal_rate_pct ?? null;

  // ── Card 4: Net income now ────────────────────────────────────────────────
  const netIncome = result?.totals?.net_income ?? null;

  // ── Narrative ─────────────────────────────────────────────────────────────
  const narrative = buildNarrative(
    result,
    hasSeries ? series.data : [],
    maxRate
  );

  return (
    <div style={styles.wrapper}>
      <div style={styles.cardsRow}>
        {/* Card 1 — Marginal rate */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Marginal rate on the next £1</div>
          <div style={{ ...styles.cardValue, color: emrColor }}>
            {emrPct != null ? `${emrPct}%` : "—"}
          </div>
          <div style={styles.cardNote}>
            of every extra pound earned is taken by tax or lost benefits.
          </div>
        </div>

        {/* Card 2 — Worst cliff */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Worst cliff</div>
          {worstCliff ? (
            <>
              <div style={{ ...styles.cardValue, color: PALETTE.cliffRed }}>
                −{gbp(worstCliff.cliff_drop_annual)}
              </div>
              <div style={styles.cardNote}>
                at {gbp(worstCliff.earned_income)} of earnings
                {Array.isArray(worstCliff.cliff_drivers) &&
                  worstCliff.cliff_drivers.length > 0 && (
                    <>
                      {" · "}
                      {worstCliff.cliff_drivers
                        .slice(0, 2)
                        .map((d) => d.label)
                        .join(", ")}
                    </>
                  )}
              </div>
            </>
          ) : (
            <>
              <div style={{ ...styles.cardValue, color: PALETTE.green }}>
                No hard cliff
              </div>
              <div style={styles.cardNote}>but watch the marginal rate.</div>
            </>
          )}
        </div>

        {/* Card 3 — Highest marginal rate */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Highest marginal rate</div>
          <div
            style={{
              ...styles.cardValue,
              color:
                maxRate != null
                  ? marginalRateColor(maxRate / 100)
                  : PALETTE.muted,
            }}
          >
            {maxRate != null ? `${Math.round(maxRate)}%` : "—"}
          </div>
          <div style={styles.cardNote}>the steepest point on the curve.</div>
        </div>

        {/* Card 4 — Net income now */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Net income now</div>
          <div style={{ ...styles.cardValue, color: PALETTE.primaryBlue }}>
            {netIncome != null ? gbp(netIncome) : "—"}
          </div>
          <div style={styles.cardNote}>take-home after tax and benefits.</div>
        </div>
      </div>

      {/* Narrative paragraph */}
      <p style={styles.narrative}>{narrative}</p>
    </div>
  );
}
