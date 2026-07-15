import { describe, expect, it } from 'vitest'

import { projectWorkloadPoint, workloadMarkerRadius } from './workloadMapProjection'

describe('geographic workload projection', () => {
  it('projects valid global coordinates onto the fixed equirectangular plane', () => {
    expect(projectWorkloadPoint(90, -180)).toEqual({ x: 0, y: 0 })
    expect(projectWorkloadPoint(0, 0)).toEqual({ x: 180, y: 90 })
    expect(projectWorkloadPoint(-90, 180)).toEqual({ x: 360, y: 180 })
    expect(() => projectWorkloadPoint(91, 0)).toThrow('outside the equirectangular map')
  })

  it('uses bounded square-root marker scaling without accepting zero workload', () => {
    expect(workloadMarkerRadius(1, 100)).toBeCloseTo(3.3)
    expect(workloadMarkerRadius(100, 100)).toBe(10.5)
    expect(workloadMarkerRadius(25, 100)).toBe(6.5)
    expect(() => workloadMarkerRadius(0, 100)).toThrow('marker counts are invalid')
  })
})
