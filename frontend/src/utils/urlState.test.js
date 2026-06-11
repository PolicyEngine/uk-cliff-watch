import assert from 'node:assert/strict'
import test from 'node:test'

import { decodeInputs, encodeInputs } from './urlState.js'

test('URL state round-trips core UK household inputs', () => {
  const encoded = encodeInputs({
    region: 'NORTH_WEST',
    is_renting: false,
    rent_annual: 9000,
    childcare_expenses_annual: 1200,
    chart_max_earned_income: 135000,
    people: [
      { kind: 'adult', age: 35 },
      { kind: 'child', age: 4 },
    ],
  })

  assert.equal(encoded, 'r=NORTH_WEST&p=35%3Aa%2C4%3Ac&rent_flag=0&rent=9000&cc=1200&max=135000')
  assert.deepEqual(decodeInputs(`?${encoded}`), {
    region: 'NORTH_WEST',
    is_renting: false,
    rent_annual: 9000,
    childcare_expenses_annual: 1200,
    chart_max_earned_income: 135000,
    people: [
      { kind: 'adult', age: 35 },
      { kind: 'child', age: 4 },
    ],
  })
})

test('URL decoder ignores invalid values', () => {
  assert.deepEqual(decodeInputs('?r=north_west&p=bad,30:a&rent=-1&max=9999'), {
    region: 'NORTH_WEST',
    people: [{ kind: 'adult', age: 30 }],
  })
})
