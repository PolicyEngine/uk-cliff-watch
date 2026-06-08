'use client';

import { useEffect, useRef, useState } from 'react';
import { getMetadata, calculate, series, regions } from './api.js';
// format.js is consumed by child components; import here if needed for future inline display
import InputPanel from './components/InputPanel.jsx';
import CliffInsights from './components/CliffInsights.jsx';
import BenefitChart from './components/BenefitChart.jsx';
import ProgramBreakdown from './components/ProgramBreakdown.jsx';
import RegionComparison from './components/RegionComparison.jsx';

const PALETTE = {
  primary: '#2C6496',
  teal: '#39C6C0',
  red: '#d9534f',
  bg: '#F7F9FB',
  text: '#1A1A1A',
  muted: '#5A6B7B',
  border: '#e2e8f0',
  white: '#ffffff',
};

function buildPayload(defaults) {
  return {
    region: defaults.region,
    earned_income: defaults.earned_income ?? 0,
    year: 2026,
    rent_annual: defaults.rent_annual ?? 9000,
    childcare_expenses_annual: 0,
    is_renting: true,
    people: (defaults.people ?? []).map((p) => ({
      kind: p.kind ?? p.type ?? 'adult',
      age: p.age,
    })),
  };
}

function Placeholder({ text = 'Calculating…' }) {
  return (
    <div
      style={{
        background: PALETTE.white,
        border: `1px solid ${PALETTE.border}`,
        borderRadius: 8,
        padding: '2rem',
        textAlign: 'center',
        color: PALETTE.muted,
        fontSize: '0.9rem',
      }}
    >
      {text}
    </div>
  );
}

export default function App() {
  const [metadata, setMetadata] = useState(null);
  const [payload, setPayload] = useState(null);
  const [result, setResult] = useState(null);
  const [seriesData, setSeriesData] = useState(null);
  const [regionsData, setRegionsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('net_income');

  const debounceRef = useRef(null);

  // Fetch metadata once on mount
  useEffect(() => {
    getMetadata()
      .then((meta) => {
        setMetadata(meta);
        setPayload(buildPayload(meta.defaults));
      })
      .catch((err) => {
        setError(`Failed to load metadata: ${err.message}`);
      });
  }, []);

  // Recalculate whenever payload changes, with 350ms debounce
  useEffect(() => {
    if (!payload) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const seriesPayload = {
          ...payload,
          max_earned_income: metadata?.defaults?.series_max_earned_income ?? 80000,
          step: metadata?.defaults?.series_step ?? 500,
        };

        const [calcRes, seriesRes, regionsRes] = await Promise.all([
          calculate(payload),
          series(seriesPayload),
          regions(payload),
        ]);

        setResult(calcRes.result);
        setSeriesData(seriesRes);
        setRegionsData(regionsRes);
      } catch (err) {
        setError(`Calculation error: ${err.message}`);
        setResult(null);
        setSeriesData(null);
        setRegionsData(null);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [payload, metadata]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: PALETTE.bg,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
        color: PALETTE.text,
      }}
    >
      {/* Header */}
      <header
        style={{
          background: PALETTE.primary,
          color: '#fff',
          padding: '0 1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '1rem 0',
            display: 'flex',
            alignItems: 'baseline',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            UK CliffWatch
          </h1>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'rgba(255,255,255,0.8)',
              flexGrow: 1,
            }}
          >
            How the tax-and-benefit system taxes the next pound of work
          </p>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.6)',
              whiteSpace: 'nowrap',
            }}
          >
            Built on{' '}
            <a
              href="https://policyengine.org/uk"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: PALETTE.teal, textDecoration: 'underline' }}
            >
              PolicyEngine UK
            </a>
          </span>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: '#fff3f3',
            borderBottom: `3px solid ${PALETTE.red}`,
            color: '#a00',
            padding: '0.75rem 1.5rem',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Main layout */}
      <main
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '1.5rem',
        }}
      >
        {!metadata || !payload ? (
          <Placeholder text={error ? 'Could not load configuration.' : 'Loading…'} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(280px, 320px) 1fr',
              gap: '1.5rem',
              alignItems: 'start',
            }}
          >
            {/* Left: inputs */}
            <div style={{ position: 'sticky', top: '1.5rem' }}>
              <InputPanel
                metadata={metadata}
                payload={payload}
                onChange={setPayload}
                loading={loading}
              />
            </div>

            {/* Right: charts & insights */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {result ? (
                <CliffInsights result={result} series={seriesData} />
              ) : (
                <Placeholder />
              )}

              {seriesData ? (
                <BenefitChart
                  series={seriesData}
                  payload={payload}
                  view={view}
                  onViewChange={setView}
                />
              ) : (
                <Placeholder />
              )}

              {result ? (
                <ProgramBreakdown result={result} />
              ) : (
                <Placeholder />
              )}

              {regionsData ? (
                <RegionComparison
                  regions={regionsData.regions}
                  selectedRegion={payload.region}
                />
              ) : (
                <Placeholder />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          marginTop: '3rem',
          padding: '1.5rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: PALETTE.muted,
          borderTop: `1px solid ${PALETTE.border}`,
        }}
      >
        UK CliffWatch — powered by{' '}
        <a href="https://policyengine.org/uk" target="_blank" rel="noopener noreferrer">
          PolicyEngine UK
        </a>
        . Tax year {payload?.year ?? 2026}. For illustrative purposes only.
      </footer>
    </div>
  );
}
