import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  allowedPerformanceMaximum,
  assertWithinPerformanceBudget,
} from './verify-geographic-performance-budgets.mjs'

const budget = Object.freeze({
  baseline: 1000,
  relativeTolerance: 0.1,
  absoluteTolerance: 150,
  unit: 'milliseconds',
})

describe('geographic performance budgets', () => {
  it('uses the larger measured relative or absolute tolerance', () => {
    assert.equal(allowedPerformanceMaximum(budget), 1150)
    assert.equal(
      allowedPerformanceMaximum({ ...budget, relativeTolerance: 0.25 }),
      1250,
    )
  })

  it('accepts the ceiling and rejects a regression beyond it', () => {
    assert.equal(assertWithinPerformanceBudget('startup', 1150, budget), 1150)
    assert.throws(
      () => assertWithinPerformanceBudget('startup', 1150.01, budget),
      /exceeds the measured regression ceiling/u,
    )
  })

  it('rejects invalid measurements and budgets', () => {
    assert.throws(
      () => assertWithinPerformanceBudget('startup', Number.NaN, budget),
      /measurement must be a non-negative finite number/u,
    )
    assert.throws(
      () => allowedPerformanceMaximum({ ...budget, relativeTolerance: -1 }),
      /relativeTolerance must be a non-negative finite number/u,
    )
  })
})
