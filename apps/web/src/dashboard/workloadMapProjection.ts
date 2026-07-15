export function projectWorkloadPoint(
  latitude: number,
  longitude: number,
): { readonly x: number; readonly y: number } {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Workload coordinate is outside the equirectangular map boundary')
  }
  return Object.freeze({ x: longitude + 180, y: 90 - latitude })
}

export function workloadMarkerRadius(memberImageCount: number, maximum: number): number {
  if (
    !Number.isSafeInteger(memberImageCount) ||
    memberImageCount < 1 ||
    !Number.isSafeInteger(maximum) ||
    maximum < memberImageCount
  ) {
    throw new Error('Workload marker counts are invalid')
  }
  return 2.5 + Math.sqrt(memberImageCount / maximum) * 8
}
