import { useState } from 'react'
import {
  hasCompleteRequiredInputs,
  hasValidAge,
} from '../dataLookup.js'

const MIN_ADULT_AGE = 16
const MAX_AGE = 120

function newPerson(kind) {
  return {
    kind,
    age: kind === 'adult' ? MIN_ADULT_AGE : 0,
  }
}

function clampAge(age, minimum = 0) {
  if (age === '' || age === null || age === undefined) return ''
  const n = Number(age)
  return Number.isFinite(n) ? Math.min(MAX_AGE, Math.max(minimum, n)) : ''
}

function InfoTooltip({ text }) {
  return (
    <span className="info-tooltip-wrapper">
      <span className="info-tooltip-icon">i</span>
      <span className="info-tooltip-text">{text}</span>
    </span>
  )
}

function GBPField({
  id,
  label,
  value,
  onChange,
  compact = false,
  step = 500,
  tooltip,
}) {
  const input = (
    <input
      type="number"
      id={id}
      min="0"
      step={step}
      value={value ?? 0}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
    />
  )

  if (compact) {
    return (
      <label className="compact-field">
        <span>{label}</span>
        {input}
      </label>
    )
  }

  return (
    <div className="form-group">
      <label htmlFor={id}>
        {label} (£/year)
        {tooltip ? <InfoTooltip text={tooltip} /> : null}
      </label>
      {input}
    </div>
  )
}

function InputPanel({
  metadata,
  inputs,
  loading,
  onCalculate,
  onInputsChange,
  onReset,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const people = inputs?.people || []
  const adultMembers = people
    .map((person, index) => ({ person, index }))
    .filter(({ person }) => person.kind === 'adult')
  const childMembers = people
    .map((person, index) => ({ person, index }))
    .filter(({ person }) => person.kind === 'child')

  const maxAdults = Math.max(1, Number(metadata?.defaults?.max_adults) || 2)
  const maxDependents = Math.max(0, Number(metadata?.defaults?.max_dependents) || 6)
  const adultCount = adultMembers.length
  const childCount = childMembers.length

  const canCalculate = hasCompleteRequiredInputs(inputs)

  // ——— helpers to mutate inputs ———

  const updateField = (field, value) => {
    onInputsChange({ ...inputs, [field]: value })
  }

  const updatePerson = (index, partial) => {
    const nextPeople = people.map((p, i) => (i === index ? { ...p, ...partial } : p))
    onInputsChange({ ...inputs, people: nextPeople })
  }

  const addPerson = (kind) => {
    if (kind === 'adult' && adultCount >= maxAdults) return
    if (kind === 'child' && childCount >= maxDependents) return
    onInputsChange({ ...inputs, people: [...people, newPerson(kind)] })
  }

  const removePerson = (index) => {
    const nextPeople = people.filter((_, i) => i !== index)
    onInputsChange({ ...inputs, people: nextPeople })
  }

  const applyPreset = (preset) => {
    if (!metadata) return
    const payload = preset.payload || {}
    // Merge preset fields into fresh inputs from defaults
    onInputsChange({
      ...(inputs || {}),
      region: payload.region || inputs?.region || '',
      people: Array.isArray(payload.people) ? payload.people : (inputs?.people || []),
      rent_annual: Number(payload.rent_annual) || 0,
      childcare_expenses_annual: Number(payload.childcare_expenses_annual) || 0,
      is_renting: payload.is_renting !== undefined ? Boolean(payload.is_renting) : true,
      chart_max_earned_income:
        inputs?.chart_max_earned_income
        || metadata?.defaults?.chart_max_earned_income
        || 130000,
      year: metadata?.year || 2026,
    })
  }

  const regions = metadata?.regions || []
  const presets = metadata?.presets || []

  if (!metadata || !inputs) {
    return (
      <section className="input-panel">
        <h2>Household information</h2>
        <div className="loading">Loading calculator controls...</div>
      </section>
    )
  }

  return (
    <section className="input-panel">
      <h2>Household information</h2>

      {/* ——— Preset buttons ——— */}
      {presets.length > 0 ? (
        <div className="wizard-step" style={{ marginBottom: '0.75rem' }}>
          <div className="wizard-step-heading">
            <p>Load a preset household or fill in the details below.</p>
          </div>
          <div className="wizard-option-grid">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="wizard-option-card"
                onClick={() => applyPreset(preset)}
              >
                <div className="wizard-option-title">{preset.label}</div>
                {preset.tagline ? (
                  <div className="wizard-option-description">{preset.tagline}</div>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!canCalculate) return
          onCalculate()
        }}
      >
        {/* ——— Region ——— */}
        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="region">Region</label>
          <select
            id="region"
            value={inputs.region || ''}
            onChange={(event) => updateField('region', event.target.value)}
          >
            <option value="">Select a region…</option>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* ——— Household members ——— */}
        <div className="member-section" style={{ marginBottom: '0.85rem' }}>
          {/* Adults */}
          <div className="member-subsection" style={{ marginBottom: '0.75rem' }}>
            <div className="member-subsection-header">
              <div>
                <div className="member-subsection-title">Adults</div>
                <div className="member-subsection-copy">{adultCount} of {maxAdults}</div>
              </div>
              <button
                type="button"
                className="member-add-btn"
                onClick={() => addPerson('adult')}
                disabled={adultCount >= maxAdults}
                title={adultCount >= maxAdults ? `Up to ${maxAdults} adults supported.` : 'Add adult'}
              >
                Add adult
              </button>
            </div>

            <div className="adult-card-grid">
              {adultMembers.map(({ person, index }, ordinal) => (
                <div key={`adult-${index}`} className="adult-card">
                  <div className="adult-card-header">
                    <div className="adult-card-title">
                      {ordinal === 0 ? 'Adult 1' : `Adult ${ordinal + 1}`}
                    </div>
                    <button
                      type="button"
                      className="member-chip-remove"
                      onClick={() => removePerson(index)}
                      aria-label={`Remove Adult ${ordinal + 1}`}
                      disabled={adultCount <= 1}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="person-card-fields person-card-fields--dependent">
                    <label className="compact-field">
                      <span>Age</span>
                      <input
                        type="number"
                        aria-label={`Adult ${ordinal + 1} age`}
                        min={MIN_ADULT_AGE}
                        max={MAX_AGE}
                        step="1"
                        required
                        value={person.age}
                        onChange={(event) =>
                          updatePerson(index, {
                            age: event.target.value === ''
                              ? ''
                              : clampAge(event.target.value, MIN_ADULT_AGE),
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Children */}
          <div className="member-subsection">
            <div className="member-subsection-header">
              <div>
                <div className="member-subsection-title">Children</div>
                <div className="member-subsection-copy">{childCount} of {maxDependents}</div>
              </div>
              <button
                type="button"
                className="member-add-btn"
                onClick={() => addPerson('child')}
                disabled={childCount >= maxDependents}
                title={childCount >= maxDependents ? `Up to ${maxDependents} children supported.` : 'Add child'}
              >
                Add child
              </button>
            </div>

            {childMembers.length === 0 ? (
              <div className="member-empty-state">
                <div className="member-empty-state-title">No children</div>
                <div className="member-empty-state-copy">
                  Click "Add child" to include a child in the household.
                </div>
              </div>
            ) : (
              <div className="dependent-card-grid">
                {childMembers.map(({ person, index }, ordinal) => (
                  <div key={`child-${index}`} className="dependent-card">
                    <div className="adult-card-header">
                      <div className="adult-card-title">Child {ordinal + 1}</div>
                      <button
                        type="button"
                        className="member-chip-remove"
                        onClick={() => removePerson(index)}
                        aria-label={`Remove Child ${ordinal + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="person-card-fields person-card-fields--dependent">
                      <label className="compact-field">
                        <span>Age</span>
                        <input
                          type="number"
                          aria-label={`Child ${ordinal + 1} age`}
                          min="0"
                          max="17"
                          step="1"
                          required
                          value={person.age}
                          onChange={(event) =>
                            updatePerson(index, {
                              age: event.target.value === '' ? '' : clampAge(event.target.value, 0),
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ——— Tenure & Rent ——— */}
        <div className="form-grid" style={{ marginBottom: '0.85rem' }}>
          <div className="form-group">
            <label id="is-renting-label">Tenure</label>
            <button
              type="button"
              className={inputs.is_renting ? 'toggle-switch toggle-switch--on' : 'toggle-switch'}
              role="switch"
              aria-checked={Boolean(inputs.is_renting)}
              aria-labelledby="is-renting-label is-renting-value"
              onClick={() => updateField('is_renting', !inputs.is_renting)}
            >
              <span id="is-renting-value" className="toggle-switch-text">
                {inputs.is_renting ? 'Renting' : 'Not renting'}
              </span>
              <span className="toggle-switch-track" aria-hidden="true">
                <span className="toggle-switch-thumb" />
              </span>
            </button>
          </div>

          {inputs.is_renting ? (
            <GBPField
              id="rent_annual"
              label="Annual rent"
              step={500}
              value={inputs.rent_annual}
              onChange={(value) => updateField('rent_annual', value)}
            />
          ) : null}
        </div>

        {/* ——— Childcare costs ——— */}
        {(inputs.people || []).some((p) => p.kind === 'child') ? (
          <div className="form-grid form-grid--single" style={{ marginBottom: '0.85rem' }}>
            <GBPField
              id="childcare_expenses_annual"
              label="Annual childcare costs"
              step={500}
              value={inputs.childcare_expenses_annual}
              onChange={(value) => updateField('childcare_expenses_annual', value)}
              tooltip="Registered childcare costs paid annually. Used for Tax-Free Childcare eligibility."
            />
          </div>
        ) : null}

        {/* ——— Advanced ——— */}
        <details
          className="advanced-panel"
          open={advancedOpen}
          onToggle={(event) => setAdvancedOpen(event.target.open)}
        >
          <summary className="advanced-summary">Advanced settings</summary>
          <div className="advanced-grid">
            <section className="advanced-section">
              <h3 className="advanced-section-title">Chart range</h3>
              <div className="advanced-field-grid advanced-field-grid--two">
                <GBPField
                  id="chart_max_earned_income"
                  label="Max earnings to chart"
                  step={10000}
                  value={inputs.chart_max_earned_income}
                  onChange={(value) =>
                    updateField('chart_max_earned_income', value || 130000)
                  }
                  tooltip="Upper bound for the earnings axis on the cliff chart."
                />
              </div>
            </section>
          </div>
        </details>

        {/* ——— Actions ——— */}
        <div className="form-actions">
          <button
            type="button"
            className="reset-btn"
            onClick={onReset}
          >
            Reset
          </button>
          <button
            type="submit"
            className="calculate-btn"
            disabled={loading || !canCalculate}
            title={!canCalculate ? 'Complete required fields to continue.' : undefined}
          >
            {loading ? 'Building chart...' : canCalculate ? 'Find cliffs' : 'Complete required fields'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default InputPanel
