// UK dataLookup.js — no US state/zip/filing/marital machinery.

const parseErrorMessage = async (response) => {
  try {
    const payload = await response.json()
    return payload.error || `Request failed with status ${response.status}`
  } catch {
    return `Request failed with status ${response.status}`
  }
}

const apiPath = (path) => {
  const origin = process.env.NEXT_PUBLIC_API_ORIGIN
    || process.env.NEXT_PUBLIC_CLIFF_WATCH_API_ORIGIN
    || ''
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
  const prefix = origin || basePath
  if (!prefix) return path
  return `${prefix.replace(/\/$/, '')}${path}`
}

const postJson = async (path, payload) => {
  const response = await fetch(apiPath(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export const formatCurrency = (value, digits = 0) => new Intl.NumberFormat(
  'en-GB',
  {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  },
).format(value || 0)

export const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`

export async function loadMetadata() {
  const response = await fetch(apiPath('/api/metadata'))
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

const MAX_ADULTS_FALLBACK = 2
const MAX_DEPENDENTS_FALLBACK = 6
const MIN_ADULT_AGE = 16
const MAX_AGE = 120
const DEFAULT_COUNCIL_TAX_BAND = 'D'

const normalizeCouncilTaxBand = (band, metadata) => {
  const bands = (metadata?.council_tax_bands || []).map((b) => b.code)
  const fallback = metadata?.defaults?.council_tax_band || DEFAULT_COUNCIL_TAX_BAND
  const candidate = String(band || '').toUpperCase()
  if (candidate && (!bands.length || bands.includes(candidate))) {
    return candidate
  }
  return fallback
}

const nonnegative = (value) => Math.max(0, Number(value) || 0)

const normalizeAge = (age, minimum = 0) => {
  if (age === '' || age === null || age === undefined) {
    return ''
  }
  const normalized = Number(age)
  return Number.isFinite(normalized)
    ? Math.min(MAX_AGE, Math.max(minimum, normalized))
    : ''
}

export const hasValidAge = (age) => {
  if (age === '' || age === null || age === undefined) return false
  const normalized = Number(age)
  return Number.isFinite(normalized) && normalized >= 0 && normalized <= 120
}

export function hasCompleteHouseholdAges(inputs) {
  const people = inputs?.people || []
  return people.length > 0
    && people.some((person) => person.kind === 'adult')
    && people.every((person) => hasValidAge(person.age))
}

export function hasCompleteRequiredInputs(inputs) {
  return Boolean(inputs?.region) && hasCompleteHouseholdAges(inputs)
}

export function normalizePeople(people = [], metadata) {
  let adultCount = 0
  let dependentCount = 0
  const maxAdults = Math.max(
    1,
    Number(metadata?.defaults?.max_adults) || MAX_ADULTS_FALLBACK,
  )
  const maxDependents = Math.max(
    0,
    Number(metadata?.defaults?.max_dependents) || MAX_DEPENDENTS_FALLBACK,
  )

  return people.flatMap((person) => {
    const requestedAdult = person?.kind !== 'child'
    const kind = requestedAdult && adultCount < maxAdults ? 'adult' : 'child'

    if (kind === 'child' && dependentCount >= maxDependents) {
      return []
    }

    if (kind === 'adult') {
      adultCount += 1
    } else {
      dependentCount += 1
    }

    const isCarer = kind === 'adult' && Boolean(person?.is_carer)
    return [{
      kind,
      age: normalizeAge(person?.age, kind === 'adult' ? MIN_ADULT_AGE : 0),
      is_disabled: Boolean(person?.is_disabled),
      is_blind: Boolean(person?.is_blind),
      is_full_time_student: Boolean(person?.is_full_time_student),
      is_incapable_of_self_care: Boolean(person?.is_incapable_of_self_care),
      is_pregnant: Boolean(person?.is_pregnant),
      is_carer: isCarer,
      care_hours: isCarer ? Math.max(35, Number(person?.care_hours) || 35) : 0,
    }]
  })
}

export function reconcileInputs(inputs, metadata) {
  const normalizedPeople = normalizePeople(inputs?.people || [], metadata)

  const defaultChartMax = Math.max(
    10000,
    Number(metadata?.defaults?.chart_max_earned_income)
      || Number(metadata?.defaults?.series_max_earned_income)
      || 130000,
  )

  return {
    region: inputs?.region || '',
    people: normalizedPeople,
    rent_annual: nonnegative(inputs?.rent_annual),
    childcare_expenses_annual: nonnegative(inputs?.childcare_expenses_annual),
    savings: nonnegative(inputs?.savings),
    partner_earnings: nonnegative(inputs?.partner_earnings),
    pension_income: nonnegative(inputs?.pension_income),
    self_employment_income: nonnegative(inputs?.self_employment_income),
    other_unearned_income: nonnegative(inputs?.other_unearned_income),
    council_tax_band: normalizeCouncilTaxBand(inputs?.council_tax_band, metadata),
    is_renting: inputs?.is_renting !== undefined ? Boolean(inputs.is_renting) : true,
    student_loan_plan: inputs?.student_loan_plan || 'NONE',
    chart_max_earned_income: Math.max(
      10000,
      Number(inputs?.chart_max_earned_income) || defaultChartMax,
    ),
    year: metadata?.year || 2026,
  }
}

export function createInitialInputs(metadata) {
  const defaults = metadata?.defaults || {}
  // Start the wizard with adults only so the dependents step can ask
  // "Any dependents?" before any children exist. Presets and shared URLs
  // still seed children explicitly.
  const defaultAdults = Array.isArray(defaults.people)
    ? defaults.people.filter((person) => person.kind !== 'child')
    : []
  const defaultPeople = defaultAdults.length
    ? defaultAdults
    : [{ kind: 'adult', age: 35 }]

  return reconcileInputs({
    region: defaults.region || '',
    people: normalizePeople(defaultPeople, metadata),
    rent_annual: defaults.rent_annual || 0,
    childcare_expenses_annual: 0,
    council_tax_band: defaults.council_tax_band || DEFAULT_COUNCIL_TAX_BAND,
    is_renting: true,
    student_loan_plan: 'NONE',
    chart_max_earned_income:
      defaults.chart_max_earned_income
      || defaults.series_max_earned_income
      || 130000,
  }, metadata)
}

export function normalizeInputs(inputs, metadata) {
  return reconcileInputs(inputs, metadata)
}

export function buildHouseholdPayload(inputs, metadata) {
  const normalized = normalizeInputs(inputs, metadata)
  return {
    region: normalized.region,
    earned_income: 0,
    year: normalized.year,
    rent_annual: normalized.rent_annual,
    childcare_expenses_annual: normalized.childcare_expenses_annual,
    savings: normalized.savings,
    partner_earnings: normalized.partner_earnings,
    pension_income: normalized.pension_income,
    self_employment_income: normalized.self_employment_income,
    other_unearned_income: normalized.other_unearned_income,
    council_tax_band: normalized.council_tax_band,
    is_renting: normalized.is_renting,
    student_loan_plan: normalized.student_loan_plan || 'NONE',
    people: normalized.people,
  }
}

// Named calculateResult for clarity; calculateStateResult exported as alias
// so any remaining callers that use the old name still work.
export async function calculateResult(inputs, metadata) {
  const payload = buildHouseholdPayload(inputs, metadata)
  const response = await postJson('/api/calculate', payload)
  return response.result
}

// Alias kept for backward-compat with callers in files we don't own
export const calculateStateResult = calculateResult

export async function calculateSeries(inputs, metadata, options = {}) {
  const normalized = normalizeInputs(inputs, metadata)
  const payload = buildHouseholdPayload(inputs, metadata)
  payload.max_earned_income = Math.round(
    options.maxEarnedIncome ?? normalized.chart_max_earned_income,
  )
  payload.step = options.step || metadata?.defaults?.series_step || 500
  if (options.minEarnedIncome) {
    payload.min_earned_income = Math.max(0, Math.round(options.minEarnedIncome))
  }
  return postJson('/api/series', payload)
}

export async function calculateHouseholdTypes(inputs, metadata) {
  return postJson('/api/households', buildHouseholdPayload(inputs, metadata))
}
