/**
 * UK CliffWatch draft helpers.
 *
 * The US version bridged to the `policyengine-household-wizard` package.
 * The UK version has no such dependency: the household is represented
 * directly as an `inputs` object and edited in plain React.
 *
 * Exports that App.jsx and InputPanel.jsx use:
 *   createInitialScenario(metadata)  – kept for compatibility, returns scenario defaults
 *   inputsToDraft(inputs)            – identity shim (inputs IS the draft)
 *   inputsToScenario(inputs, meta)   – extract scenario slice
 *   combineDraftAndScenarioToInputs  – merge draft+scenario back to inputs
 *   isDraftReady(draft)              – validation predicate
 *
 * The cleanest path: App.jsx uses a single `inputs` state.
 * These helpers are thin shims so we can keep App.jsx edits minimal.
 */

function nonnegative(value) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function coerceNumber(value) {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Return the "scenario" slice (chart settings, finances) from a full inputs
 * object, or sensible defaults from metadata.
 */
export function createInitialScenario(metadata) {
  const defaults = metadata?.defaults || {}
  return {
    chart_max_earned_income: Math.max(
      10000,
      Number(defaults.chart_max_earned_income)
        || Number(defaults.series_max_earned_income)
        || 130000,
    ),
    rent_annual: nonnegative(defaults.rent_annual),
    childcare_expenses_annual: 0,
    is_renting: true,
  }
}

/**
 * In the UK version the `draft` IS the inputs object (no wizard adapter).
 * This shim returns the inputs unchanged so call-sites that do
 * `setDraft(inputsToDraft(fromUrl))` continue to work.
 */
export function inputsToDraft(inputs) {
  if (!inputs) return null
  return inputs
}

/**
 * Extract the scenario (financial / chart) fields from a full inputs object.
 * Fills missing fields from metadata defaults.
 */
export function inputsToScenario(inputs, metadata) {
  if (!inputs) return createInitialScenario(metadata)
  const defaults = createInitialScenario(metadata)
  return {
    chart_max_earned_income:
      coerceNumber(inputs.chart_max_earned_income) ?? defaults.chart_max_earned_income,
    rent_annual: nonnegative(inputs.rent_annual ?? defaults.rent_annual),
    childcare_expenses_annual: nonnegative(inputs.childcare_expenses_annual),
    is_renting: inputs.is_renting !== undefined ? Boolean(inputs.is_renting) : defaults.is_renting,
  }
}

/**
 * Merge draft (household) + scenario (finances/chart) back into a single
 * `inputs` object.  In the UK version draft already carries everything,
 * so we simply spread scenario on top.
 */
export function combineDraftAndScenarioToInputs(draft, scenario, metadata) {
  if (!draft) return null
  // draft is already a full inputs object in the UK; scenario may carry
  // updated overrides (chart range, rent, childcare, is_renting).
  return {
    ...draft,
    ...(scenario || {}),
    year: draft?.year || metadata?.year || 2026,
  }
}

/**
 * Legacy alias: in the UK version the draft IS the inputs, so draftToInputs
 * is an identity shim.  Kept so existing test imports resolve without error.
 */
export function draftToInputs(draft, defaults = {}) {
  if (!draft) return defaults
  return { ...defaults, ...draft }
}

/**
 * Returns true when the draft (= inputs) has at least one region and one adult
 * with a valid age — i.e. is ready to calculate.
 */
export function isDraftReady(draft) {
  if (!draft?.region) return false
  const people = draft?.people || []
  const adults = people.filter((p) => p.kind === 'adult')
  return adults.length > 0 && adults.every((p) => {
    const age = Number(p.age)
    return Number.isFinite(age) && age >= 0 && age <= 120
  })
}
