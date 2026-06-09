import { useMemo, useState } from 'react'
import { hasCompleteRequiredInputs, hasValidAge } from '../dataLookup.js'
import { WizardOptionCard, WizardProgress } from 'policyengine-household-wizard'

const MIN_ADULT_AGE = 18
const MAX_AGE = 120

const clampAdultAge = (age) => {
  if (age === '' || age === null || age === undefined) return ''
  const normalized = Number(age)
  return Number.isFinite(normalized)
    ? Math.min(MAX_AGE, Math.max(MIN_ADULT_AGE, normalized))
    : ''
}

const WIZARD_STEPS = [
  { id: 'location', label: 'Location' },
  { id: 'household', label: 'Household' },
  { id: 'adults', label: 'Adults' },
  { id: 'dependents', label: 'Dependents' },
  { id: 'review', label: 'Review' },
]

// Person flags. Disabled/Blind/Needs care map to real policyengine-uk inputs;
// Student is carried for parity with limited modelling.
const PERSON_FLAGS = [
  { key: 'is_disabled', label: 'Disabled' },
  { key: 'is_blind', label: 'Blind' },
  { key: 'is_full_time_student', label: 'Student' },
  { key: 'is_incapable_of_self_care', label: 'Needs care' },
]

function PersonFlagGrid({ person, updatePerson }) {
  return (
    <div className="person-flag-grid">
      {PERSON_FLAGS.map((flag) => (
        <label key={flag.key} className="member-checkbox-label member-checkbox-label--compact">
          <input
            type="checkbox"
            checked={Boolean(person[flag.key])}
            onChange={(event) => updatePerson({ [flag.key]: event.target.checked })}
          />
          <span>{flag.label}</span>
        </label>
      ))}
    </div>
  )
}

function InfoTooltip({ text }) {
  return (
    <span className="info-tooltip-wrapper">
      <span className="info-tooltip-icon">i</span>
      <span className="info-tooltip-text">{text}</span>
    </span>
  )
}

function CurrencyField({ id, label, value, onChange, compact = false, step = 500, tooltip }) {
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

function InputPanel({ metadata, inputs, loading, onCalculate, onInputsChange, onReset }) {
  const [currentStepId, setCurrentStepId] = useState('location')

  const people = inputs?.people || []
  const adultCount = people.filter((person) => person.kind === 'adult').length
  const dependentCount = people.filter((person) => person.kind === 'child').length
  const isCouple = adultCount >= 2
  const canCalculate = hasCompleteRequiredInputs(inputs)
  const currentStepIndex = Math.max(0, WIZARD_STEPS.findIndex((step) => step.id === currentStepId))
  const maxAdults = Math.max(1, Number(metadata?.defaults?.max_adults) || 2)
  const maxDependents = Math.max(0, Number(metadata?.defaults?.max_dependents) || 6)
  const regions = metadata?.regions || []
  const presets = metadata?.presets || []
  const selectedRegion = regions.find((region) => region.code === inputs?.region)
  const regionName = selectedRegion?.name || inputs?.region || 'Missing'

  const rowMeta = useMemo(() => {
    let adultOrdinal = 0
    let dependentOrdinal = 0
    return people.map((person) => {
      if (person.kind === 'child') {
        dependentOrdinal += 1
        return { ordinal: dependentOrdinal, label: `Child ${dependentOrdinal}` }
      }
      adultOrdinal += 1
      return {
        ordinal: adultOrdinal,
        label: adultOrdinal === 1
          ? 'Adult 1'
          : adultOrdinal === 2 && isCouple
            ? 'Adult 2 (partner)'
            : `Adult ${adultOrdinal}`,
      }
    })
  }, [isCouple, people])

  const update = (partial) => onInputsChange({ ...inputs, ...partial })
  const setRegion = (code) => update({ region: code })
  const setPeople = (nextPeople) => update({ people: nextPeople })

  const addPerson = (kind) => {
    if (kind === 'adult' && adultCount >= maxAdults) return
    if (kind === 'child' && dependentCount >= maxDependents) return
    setPeople([...people, { kind, age: kind === 'adult' ? 30 : '' }])
  }

  const removePerson = (index) => {
    setPeople(people.filter((_, position) => position !== index))
  }

  const updatePersonAge = (index, value) => {
    setPeople(people.map((person, position) => (
      position === index ? { ...person, age: value } : person
    )))
  }

  const updatePerson = (index, partial) => {
    setPeople(people.map((person, position) => (
      position === index ? { ...person, ...partial } : person
    )))
  }

  const chooseHousehold = (couple) => {
    const adults = people.filter((person) => person.kind === 'adult')
    const children = people.filter((person) => person.kind === 'child')
    let nextAdults = adults
    if (couple) {
      while (nextAdults.length < 2) nextAdults = [...nextAdults, { kind: 'adult', age: 30 }]
      nextAdults = nextAdults.slice(0, 2)
    } else {
      nextAdults = adults.length ? [adults[0]] : [{ kind: 'adult', age: 30 }]
    }
    setPeople([...nextAdults, ...children])
    goToStep('adults')
  }

  const chooseNoDependents = () => {
    setPeople(people.filter((person) => person.kind !== 'child'))
    goToStep('review')
  }

  const applyPreset = (preset) => {
    const payload = preset.payload || {}
    onInputsChange({
      year: 2026,
      region: payload.region,
      rent_annual: payload.rent_annual ?? 0,
      childcare_expenses_annual: payload.childcare_expenses_annual ?? 0,
      savings: payload.savings ?? 0,
      partner_earnings: payload.partner_earnings ?? 0,
      pension_income: payload.pension_income ?? 0,
      self_employment_income: payload.self_employment_income ?? 0,
      other_unearned_income: payload.other_unearned_income ?? 0,
      is_renting: payload.is_renting ?? (payload.rent_annual ?? 0) > 0,
      chart_max_earned_income: inputs?.chart_max_earned_income
        || metadata?.defaults?.chart_max_earned_income || 130000,
      people: (payload.people || []).map((person) => ({ kind: person.kind, age: person.age })),
    })
    goToStep('review')
  }

  const adultMembers = people
    .map((person, index) => ({ person, index, meta: rowMeta[index] }))
    .filter(({ person }) => person.kind === 'adult')
  const dependentMembers = people
    .map((person, index) => ({ person, index, meta: rowMeta[index] }))
    .filter(({ person }) => person.kind === 'child')

  const locationStepComplete = Boolean(inputs?.region)
  const adultStepComplete = adultMembers.length > 0
    && adultMembers.every(({ person }) => hasValidAge(person.age))
  const dependentStepComplete = dependentMembers.every(({ person }) => hasValidAge(person.age))
  const currentStepComplete = {
    location: locationStepComplete,
    household: adultCount >= 1,
    adults: adultStepComplete,
    dependents: dependentStepComplete,
    review: canCalculate,
  }[currentStepId]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex >= WIZARD_STEPS.length - 1

  function goToStep(stepId) {
    if (WIZARD_STEPS.some((step) => step.id === stepId)) setCurrentStepId(stepId)
  }

  const goBack = () => {
    if (isFirstStep) return
    setCurrentStepId(WIZARD_STEPS[currentStepIndex - 1].id)
  }

  const goNext = () => {
    if (isLastStep) return
    if (currentStepId === 'adults') {
      setPeople(people.map((person) => (
        person.kind === 'adult' ? { ...person, age: clampAdultAge(person.age) } : person
      )))
    }
    setCurrentStepId(WIZARD_STEPS[currentStepIndex + 1].id)
  }

  const resetWizard = () => {
    onReset()
    goToStep('location')
  }

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
      {presets.length ? (
        <div className="wizard-quickstart">
          <span className="wizard-quickstart-label">Quick start</span>
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="member-add-btn wizard-quickstart-chip"
              onClick={() => applyPreset(preset)}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
      <WizardProgress
        totalSteps={WIZARD_STEPS.length}
        currentStepIndex={currentStepIndex}
        currentStepLabel={WIZARD_STEPS[currentStepIndex]?.label}
        aria-label="Household setup progress"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!currentStepComplete) return
          if (isLastStep) {
            if (!canCalculate) return
            onCalculate()
            return
          }
          goNext()
        }}
      >
        {currentStepId === 'location' ? (
          <section className="wizard-step">
            <div className="wizard-step-heading">
              <h3>Where does the household live?</h3>
              <p>Select the UK region. Devolved taxes and local housing costs vary by region.</p>
            </div>
            <div className="form-grid form-grid--single">
              <div className="form-group">
                <label htmlFor="region">Region</label>
                <select
                  id="region"
                  required
                  value={inputs.region || ''}
                  onChange={(event) => setRegion(event.target.value)}
                  aria-label="Region"
                >
                  <option value="" disabled>Select a region</option>
                  {regions.map((region) => (
                    <option key={region.code} value={region.code}>{region.name}</option>
                  ))}
                </select>
                {selectedRegion ? (
                  <div className="zip-state-result" role="status" aria-live="polite">
                    <span>Region</span>
                    <strong>{selectedRegion.name}</strong>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {currentStepId === 'household' ? (
          <section className="wizard-step">
            <div className="wizard-step-heading">
              <h3>Single adult or a couple?</h3>
              <p>We use this to decide whether to include a partner in the benefit unit.</p>
            </div>
            <div className="wizard-option-grid">
              <WizardOptionCard
                selected={!isCouple}
                title="Single adult"
                description="One adult in the benefit unit; the primary earner is the chart's earnings axis."
                onClick={() => chooseHousehold(false)}
              />
              <WizardOptionCard
                selected={isCouple}
                title="Couple"
                description="Adds a partner and models a joint benefit unit (Universal Credit, etc.)."
                onClick={() => chooseHousehold(true)}
              />
            </div>
          </section>
        ) : null}

        {currentStepId === 'adults' ? (
          <section className="wizard-step member-section">
            <div className="wizard-step-heading">
              <h3>Who are the adults?</h3>
              <p>Adult 1 is the earnings axis on the chart. Any partner&apos;s earnings stay fixed.</p>
            </div>
            <div className="member-subsection">
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
                  title={adultCount >= maxAdults ? `This calculator supports up to ${maxAdults} adults.` : 'Add adult'}
                >
                  Add adult
                </button>
              </div>
              <div className="adult-card-grid">
                {adultMembers.map(({ person, index, meta }) => (
                  <div key={`adult-${index}`} className="adult-card">
                    <div className="adult-card-header">
                      <div className="adult-card-title">{meta?.label}</div>
                      <button
                        type="button"
                        className="member-chip-remove"
                        onClick={() => removePerson(index)}
                        aria-label={`Remove ${meta?.label}`}
                        title={`Remove ${meta?.label}`}
                        disabled={adultCount <= 1}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="person-card-fields">
                      <label className="compact-field">
                        <span>Age</span>
                        <input
                          type="number"
                          aria-label={`${meta?.label} age`}
                          min="16"
                          max="120"
                          step="1"
                          required
                          value={person.age}
                          onChange={(event) => updatePersonAge(index, event.target.value)}
                        />
                      </label>
                    </div>

                    <div className="person-option-grid">
                      <label className="member-checkbox-label member-checkbox-label--compact">
                        <input
                          type="checkbox"
                          checked={Boolean(person.is_pregnant)}
                          onChange={(event) => updatePerson(index, { is_pregnant: event.target.checked })}
                        />
                        <span>Pregnant</span>
                      </label>
                      <PersonFlagGrid
                        person={person}
                        updatePerson={(partial) => updatePerson(index, partial)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {currentStepId === 'dependents' ? (
          <section className="wizard-step member-section">
            <div className="wizard-step-heading">
              <h3>Any dependents?</h3>
              <p>Add children or other dependents whose benefits and tax credits should be included.</p>
            </div>
            {dependentMembers.length === 0 ? (
              <div className="wizard-option-grid">
                <WizardOptionCard
                  selected={false}
                  title="No dependents"
                  description="Continue with adults only."
                  onClick={chooseNoDependents}
                />
                <WizardOptionCard
                  selected={false}
                  title="Add a dependent"
                  description="Start with a blank age, then add disability, blind, or care needs if relevant."
                  onClick={() => addPerson('child')}
                />
              </div>
            ) : (
              <div className="member-subsection">
                <div className="member-subsection-header">
                  <div>
                    <div className="member-subsection-title">Dependents</div>
                    <div className="member-subsection-copy">{dependentCount} of {maxDependents}</div>
                  </div>
                  <button
                    type="button"
                    className="member-add-btn"
                    onClick={() => addPerson('child')}
                    disabled={dependentCount >= maxDependents}
                    title={dependentCount >= maxDependents ? `This calculator supports up to ${maxDependents} dependents.` : 'Add dependent'}
                  >
                    Add dependent
                  </button>
                </div>
                <div className="dependent-card-grid">
                  {dependentMembers.map(({ person, index, meta }) => (
                    <div key={`dependent-${index}`} className="dependent-card">
                      <div className="adult-card-header">
                        <div className="adult-card-title">{meta?.label}</div>
                        <button
                          type="button"
                          className="member-chip-remove"
                          onClick={() => removePerson(index)}
                          aria-label={`Remove ${meta?.label}`}
                          title={`Remove ${meta?.label}`}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="person-card-fields person-card-fields--dependent">
                        <label className="compact-field">
                          <span>Age</span>
                          <input
                            type="number"
                            aria-label={`${meta?.label} age`}
                            min="0"
                            max="120"
                            step="1"
                            required
                            value={person.age}
                            onChange={(event) => updatePersonAge(index, event.target.value)}
                          />
                        </label>
                      </div>

                      <PersonFlagGrid
                        person={person}
                        updatePerson={(partial) => updatePerson(index, partial)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : null}

        {currentStepId === 'review' ? (
          <section className="wizard-step">
            <div className="wizard-step-heading">
              <h3>Review and calculate</h3>
              <p>Check the household, adjust costs if needed, then build the cliff chart.</p>
            </div>
            <div className="wizard-review-grid">
              <button type="button" className="wizard-review-item" onClick={() => goToStep('location')}>
                <span>Region</span>
                <strong>{regionName}</strong>
              </button>
              <button type="button" className="wizard-review-item" onClick={() => goToStep('household')}>
                <span>Household</span>
                <strong>{isCouple ? 'Couple' : 'Single adult'}</strong>
              </button>
              <button type="button" className="wizard-review-item" onClick={() => goToStep('adults')}>
                <span>Adults</span>
                <strong>{adultCount} adult{adultCount === 1 ? '' : 's'}</strong>
              </button>
              <button type="button" className="wizard-review-item" onClick={() => goToStep('dependents')}>
                <span>Dependents</span>
                <strong>{dependentCount} dependent{dependentCount === 1 ? '' : 's'}</strong>
              </button>
            </div>

            <details className="advanced-panel" open>
              <summary className="advanced-summary">Housing, childcare &amp; chart range</summary>
              <div className="advanced-grid">
                <section className="advanced-section">
                  <h3 className="advanced-section-title">Housing</h3>
                  <div className="advanced-field-grid advanced-field-grid--two">
                    <div className="form-group">
                      <label id="tenure-label">Tenure</label>
                      <button
                        type="button"
                        className={inputs.is_renting ? 'toggle-switch toggle-switch--on' : 'toggle-switch'}
                        role="switch"
                        aria-checked={Boolean(inputs.is_renting)}
                        aria-labelledby="tenure-label tenure-value"
                        onClick={() => update({ is_renting: !inputs.is_renting })}
                      >
                        <span id="tenure-value" className="toggle-switch-text">
                          {inputs.is_renting ? 'Renting' : 'Owner / no rent'}
                        </span>
                        <span className="toggle-switch-track" aria-hidden="true">
                          <span className="toggle-switch-thumb" />
                        </span>
                      </button>
                    </div>
                    <CurrencyField
                      id="rent_annual"
                      label="Rent"
                      value={inputs.rent_annual}
                      onChange={(value) => update({ rent_annual: value })}
                      tooltip="Annual rent. Drives Housing Benefit and the Universal Credit housing element."
                    />
                  </div>
                </section>

                <section className="advanced-section">
                  <h3 className="advanced-section-title">Childcare</h3>
                  <div className="advanced-field-grid">
                    <CurrencyField
                      id="childcare_expenses_annual"
                      label="Childcare costs"
                      value={inputs.childcare_expenses_annual}
                      onChange={(value) => update({ childcare_expenses_annual: value })}
                    />
                  </div>
                </section>

                <section className="advanced-section">
                  <h3 className="advanced-section-title">Savings &amp; capital</h3>
                  <div className="advanced-field-grid">
                    <CurrencyField
                      id="savings"
                      label="Savings / capital"
                      step={1000}
                      value={inputs.savings}
                      onChange={(value) => update({ savings: value })}
                      tooltip="Total household savings and capital. Universal Credit tapers from £6,000 and stops entirely above £16,000 — a hard cliff."
                    />
                  </div>
                </section>

                <section className="advanced-section">
                  <h3 className="advanced-section-title">Other income</h3>
                  <div className="advanced-field-grid advanced-field-grid--two">
                    {isCouple ? (
                      <CurrencyField
                        id="partner_earnings"
                        label="Partner's earnings"
                        value={inputs.partner_earnings}
                        onChange={(value) => update({ partner_earnings: value })}
                        tooltip="Annual employment income for the second adult. Counts toward the joint benefit unit, so it tapers Universal Credit just like the primary earner's pay."
                      />
                    ) : null}
                    <CurrencyField
                      id="pension_income"
                      label="Private pension income"
                      value={inputs.pension_income}
                      onChange={(value) => update({ pension_income: value })}
                      tooltip="Annual private or occupational pension income on the primary adult. For pensioners it withdraws Pension Credit pound-for-pound."
                    />
                    <CurrencyField
                      id="self_employment_income"
                      label="Self-employment income"
                      value={inputs.self_employment_income}
                      onChange={(value) => update({ self_employment_income: value })}
                      tooltip="Annual profit from self-employment on the primary adult. Taxed and means-tested like earnings."
                    />
                    <CurrencyField
                      id="other_unearned_income"
                      label="Other unearned income"
                      value={inputs.other_unearned_income}
                      onChange={(value) => update({ other_unearned_income: value })}
                      tooltip="Savings interest, dividends or property income on the primary adult. Modelled as taxable savings interest."
                    />
                  </div>
                </section>
              </div>
            </details>
          </section>
        ) : null}

        <div className="form-actions">
          <button type="button" className="reset-btn" onClick={resetWizard}>Reset</button>
          <button type="button" className="reset-btn" onClick={goBack} disabled={isFirstStep}>Back</button>
          <button
            type="submit"
            className="calculate-btn"
            disabled={loading || !currentStepComplete}
            title={!currentStepComplete ? 'Complete this step to continue.' : undefined}
          >
            {loading
              ? 'Building chart...'
              : isLastStep
                ? canCalculate ? 'Find cliffs' : 'Complete required fields'
                : 'Continue'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default InputPanel
