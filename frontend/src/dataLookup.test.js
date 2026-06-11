import assert from 'node:assert/strict'
import test from 'node:test'

import { buildHouseholdPayload, normalizePeople } from './dataLookup.js'

const metadata = {
  year: 2026,
  council_tax_bands: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((code) => ({
    code,
    label: `Band ${code}`,
  })),
  defaults: {
    max_adults: 2,
    max_dependents: 2,
    council_tax_band: 'D',
    chart_max_earned_income: 135000,
  },
}

test('normalizePeople enforces limits and adult age minimums', () => {
  assert.deepEqual(
    normalizePeople([
      { kind: 'adult', age: 15 },
      { kind: 'adult', age: 44, is_carer: true },
      { kind: 'adult', age: 30 },
      { kind: 'child', age: 7 },
      { kind: 'child', age: 4 },
      { kind: 'child', age: 2 },
    ], metadata),
    [
      { kind: 'adult', age: 16, is_disabled: false, is_blind: false, is_full_time_student: false, is_incapable_of_self_care: false, is_pregnant: false, is_carer: false, care_hours: 0 },
      { kind: 'adult', age: 44, is_disabled: false, is_blind: false, is_full_time_student: false, is_incapable_of_self_care: false, is_pregnant: false, is_carer: true, care_hours: 35 },
      { kind: 'child', age: 30, is_disabled: false, is_blind: false, is_full_time_student: false, is_incapable_of_self_care: false, is_pregnant: false, is_carer: false, care_hours: 0 },
      { kind: 'child', age: 7, is_disabled: false, is_blind: false, is_full_time_student: false, is_incapable_of_self_care: false, is_pregnant: false, is_carer: false, care_hours: 0 },
    ],
  )
})

test('buildHouseholdPayload preserves advanced UK inputs', () => {
  assert.deepEqual(buildHouseholdPayload({
    region: 'LONDON',
    rent_annual: 12000,
    childcare_expenses_annual: 3000,
    savings: 16000,
    partner_earnings: 5000,
    pension_income: 1000,
    self_employment_income: 2000,
    other_unearned_income: 300,
    council_tax_band: 'g',
    is_renting: true,
    student_loan_plan: 'PLAN_2',
    people: [{ kind: 'adult', age: 35 }],
  }, metadata), {
    region: 'LONDON',
    earned_income: 0,
    year: 2026,
    rent_annual: 12000,
    childcare_expenses_annual: 3000,
    savings: 16000,
    partner_earnings: 5000,
    pension_income: 1000,
    self_employment_income: 2000,
    other_unearned_income: 300,
    council_tax_band: 'G',
    is_renting: true,
    student_loan_plan: 'PLAN_2',
    people: [{ kind: 'adult', age: 35, is_disabled: false, is_blind: false, is_full_time_student: false, is_incapable_of_self_care: false, is_pregnant: false, is_carer: false, care_hours: 0 }],
  })
})
