'use client';

import { useState } from 'react';

const PALETTE = {
  primary: '#2C6496',
  teal: '#39C6C0',
  bg: '#F7F9FB',
  text: '#1A1A1A',
  muted: '#5A6B7B',
  border: '#e2e8f0',
  white: '#ffffff',
  inputBg: '#ffffff',
  focusRing: '#2C6496',
};

const styles = {
  panel: {
    background: PALETTE.white,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: 8,
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  sectionTitle: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: PALETTE.muted,
    marginBottom: '0.6rem',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: PALETTE.text,
    marginBottom: '0.3rem',
  },
  input: {
    width: '100%',
    padding: '0.45rem 0.65rem',
    border: `1px solid ${PALETTE.border}`,
    borderRadius: 5,
    fontSize: '0.875rem',
    background: PALETTE.inputBg,
    color: PALETTE.text,
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  select: {
    width: '100%',
    padding: '0.45rem 0.65rem',
    border: `1px solid ${PALETTE.border}`,
    borderRadius: 5,
    fontSize: '0.875rem',
    background: PALETTE.inputBg,
    color: PALETTE.text,
    outline: 'none',
    appearance: 'auto',
  },
  fieldWrap: {
    marginBottom: '0.75rem',
  },
  personRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.4rem',
  },
  removeBtn: {
    background: 'none',
    border: `1px solid #e2e8f0`,
    borderRadius: 4,
    color: '#a00',
    padding: '0.2rem 0.4rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  addBtn: {
    background: 'none',
    border: `1px solid ${PALETTE.primary}`,
    borderRadius: 5,
    color: PALETTE.primary,
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    cursor: 'pointer',
    width: '100%',
    marginTop: '0.35rem',
  },
  toggle: (active) => ({
    padding: '0.3rem 0.75rem',
    border: `1px solid ${active ? PALETTE.primary : PALETTE.border}`,
    borderRadius: 5,
    background: active ? PALETTE.primary : PALETTE.white,
    color: active ? '#fff' : PALETTE.muted,
    fontSize: '0.8rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  loadingBar: {
    height: 3,
    background: `linear-gradient(90deg, ${PALETTE.teal}, ${PALETTE.primary})`,
    borderRadius: 2,
    animation: 'shimmer 1.2s ease-in-out infinite',
  },
};

function NumberInput({ label, value, onChange, min = 0, max, step = 100, prefix = '£' }) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <div style={{ position: 'relative' }}>
        {prefix && (
          <span
            style={{
              position: 'absolute',
              left: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: PALETTE.muted,
              fontSize: '0.875rem',
              pointerEvents: 'none',
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          style={{
            ...styles.input,
            paddingLeft: prefix ? '1.5rem' : styles.input.paddingLeft,
          }}
        />
      </div>
    </div>
  );
}

export default function InputPanel({ metadata, payload, onChange, loading }) {
  if (!metadata || !payload) return null;

  const { regions = [], defaults = {} } = metadata;
  const maxAdults = defaults.max_adults ?? 2;
  const maxDependents = defaults.max_dependents ?? 6;

  const adults = (payload.people ?? []).filter((p) => p.kind === 'adult');
  const dependents = (payload.people ?? []).filter((p) => p.kind === 'child');

  function updateField(field, value) {
    onChange({ ...payload, [field]: value });
  }

  function updatePerson(index, newPerson) {
    const next = [...(payload.people ?? [])];
    next[index] = newPerson;
    onChange({ ...payload, people: next });
  }

  function removePerson(index) {
    const next = (payload.people ?? []).filter((_, i) => i !== index);
    onChange({ ...payload, people: next });
  }

  function addAdult() {
    if (adults.length >= maxAdults) return;
    const next = [...(payload.people ?? []), { kind: 'adult', age: 35 }];
    onChange({ ...payload, people: next });
  }

  function addChild() {
    if (dependents.length >= maxDependents) return;
    const next = [...(payload.people ?? []), { kind: 'child', age: 5 }];
    onChange({ ...payload, people: next });
  }

  // All person indices for display
  const allPeople = payload.people ?? [];

  return (
    <aside style={styles.panel} aria-label="Household configuration">
      {/* Loading bar */}
      <div style={{ height: 3, borderRadius: 2, background: PALETTE.border, overflow: 'hidden' }}>
        {loading && (
          <div
            style={{
              height: '100%',
              width: '40%',
              background: `linear-gradient(90deg, ${PALETTE.teal}, ${PALETTE.primary})`,
              borderRadius: 2,
              animation: 'inputPanelSlide 1.1s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Region */}
      <section>
        <p style={styles.sectionTitle}>Region</p>
        <select
          style={styles.select}
          value={payload.region}
          onChange={(e) => updateField('region', e.target.value)}
        >
          {regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </section>

      {/* Earnings */}
      <section>
        <p style={styles.sectionTitle}>Earnings</p>
        <NumberInput
          label="Gross earned income (annual)"
          value={payload.earned_income}
          onChange={(v) => updateField('earned_income', v)}
          min={0}
          max={300000}
          step={500}
        />
      </section>

      {/* Housing */}
      <section>
        <p style={styles.sectionTitle}>Housing</p>
        <div style={{ ...styles.fieldWrap, marginBottom: '0.5rem' }}>
          <label style={styles.label}>Tenure</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              style={styles.toggle(payload.is_renting === true)}
              onClick={() => updateField('is_renting', true)}
            >
              Renting
            </button>
            <button
              style={styles.toggle(payload.is_renting === false)}
              onClick={() => updateField('is_renting', false)}
            >
              Owning
            </button>
          </div>
        </div>
        {payload.is_renting && (
          <NumberInput
            label="Annual rent"
            value={payload.rent_annual}
            onChange={(v) => updateField('rent_annual', v)}
            min={0}
            max={60000}
            step={500}
          />
        )}
      </section>

      {/* Childcare */}
      {dependents.length > 0 && (
        <section>
          <p style={styles.sectionTitle}>Childcare</p>
          <NumberInput
            label="Annual childcare costs"
            value={payload.childcare_expenses_annual ?? 0}
            onChange={(v) => updateField('childcare_expenses_annual', v)}
            min={0}
            max={50000}
            step={500}
          />
        </section>
      )}

      {/* Household members */}
      <section>
        <p style={styles.sectionTitle}>Household Members</p>

        {allPeople.map((person, idx) => (
          <div key={idx} style={styles.personRow}>
            <span
              style={{
                fontSize: '0.78rem',
                color: PALETTE.muted,
                minWidth: 44,
              }}
            >
              {person.kind === 'adult' ? 'Adult' : 'Child'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: PALETTE.muted,
                  whiteSpace: 'nowrap',
                }}
              >
                Age
              </label>
              <input
                type="number"
                value={person.age}
                min={person.kind === 'adult' ? 18 : 0}
                max={person.kind === 'adult' ? 80 : 17}
                step={1}
                onChange={(e) => updatePerson(idx, { ...person, age: Number(e.target.value) })}
                style={{
                  ...styles.input,
                  width: 64,
                  padding: '0.3rem 0.4rem',
                  textAlign: 'center',
                }}
              />
            </div>
            {/* Only allow removing if it won't leave 0 adults */}
            {!(person.kind === 'adult' && adults.length <= 1) && (
              <button
                style={styles.removeBtn}
                onClick={() => removePerson(idx)}
                aria-label={`Remove ${person.kind} aged ${person.age}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          {adults.length < maxAdults && (
            <button style={{ ...styles.addBtn, flex: 1 }} onClick={addAdult}>
              + Adult
            </button>
          )}
          {dependents.length < maxDependents && (
            <button style={{ ...styles.addBtn, flex: 1 }} onClick={addChild}>
              + Child
            </button>
          )}
        </div>
      </section>

      <style>{`
        @keyframes inputPanelSlide {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </aside>
  );
}
