// UK urlState.js — encodes/decodes UK inputs to/from URL query params.
// No state, zip, county, filing status, marital status, or US program fields.

const NUMERIC_FIELDS = [
  ['rent', 'rent_annual'],
  ['cc', 'childcare_expenses_annual'],
  ['max', 'chart_max_earned_income'],
]

const parseNonnegative = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function encodePerson(person) {
  if (person.age === '' || person.age === null || person.age === undefined) {
    return null
  }
  const age = Number(person.age)
  if (!Number.isFinite(age) || age < 0 || age > 120) {
    return null
  }
  const kind = person.kind === 'adult' ? 'a' : 'c'
  return `${Math.round(age)}:${kind}`
}

function decodePerson(token) {
  const value = token.trim()
  const parts = value.split(':')
  if (parts.length < 2) return null
  const [age, kind] = parts
  const parsedAge = parseInt(age, 10)
  if (!Number.isFinite(parsedAge)) return null
  return {
    age: parsedAge,
    kind: kind?.toLowerCase() === 'a' ? 'adult' : 'child',
  }
}

export function encodeInputs(inputs) {
  if (!inputs) return ''
  const params = new URLSearchParams()

  if (inputs.region) {
    params.set('r', inputs.region)
  }

  const people = (inputs.people || []).map(encodePerson).filter(Boolean)
  if (people.length) {
    params.set('p', people.join(','))
  }

  if (inputs.is_renting === false) {
    params.set('rent_flag', '0')
  }

  NUMERIC_FIELDS.forEach(([param, field]) => {
    const value = Number(inputs[field]) || 0
    if (value > 0) {
      params.set(param, String(Math.round(value)))
    }
  })

  return params.toString()
}

export function decodeInputs(search) {
  if (!search) return null
  const params = new URLSearchParams(search.replace(/^\?/, ''))
  if (![...params.keys()].length) return null

  const decoded = {}

  if (params.has('r')) {
    decoded.region = params.get('r').toUpperCase()
  }

  if (params.has('p')) {
    const people = params.get('p').split(',').map(decodePerson).filter(Boolean)
    if (people.length) decoded.people = people
  }

  if (params.has('rent_flag')) {
    decoded.is_renting = params.get('rent_flag') !== '0'
  }

  NUMERIC_FIELDS.forEach(([param, field]) => {
    if (!params.has(param)) return
    const value = parseNonnegative(params.get(param))
    if (value === null) return
    if (field === 'chart_max_earned_income' && value < 10000) return
    decoded[field] = value
  })

  return Object.keys(decoded).length ? decoded : null
}

export function buildShareUrl(inputs) {
  const encoded = encodeInputs(inputs)
  const { origin, pathname } = window.location
  return encoded ? `${origin}${pathname}?${encoded}` : `${origin}${pathname}`
}

export function syncUrlToInputs(inputs) {
  if (typeof window === 'undefined') return
  const encoded = encodeInputs(inputs)
  const next = encoded ? `${window.location.pathname}?${encoded}` : window.location.pathname
  const current = `${window.location.pathname}${window.location.search}`
  if (next !== current) {
    window.history.replaceState(null, '', next)
  }
}
