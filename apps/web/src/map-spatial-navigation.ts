import type { Point } from './map-interaction';

export type SpatialDirection = 'north' | 'north-east' | 'east' | 'south-east' | 'south' | 'south-west' | 'west' | 'north-west';
export interface SpatialCandidate extends Point { id: string }

const CLOCKWISE_DIRECTIONS: SpatialDirection[] = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

/**
 * Eight 45-degree sectors use screen coordinates and are half-open clockwise:
 * the counter-clockwise boundary is included and the clockwise boundary is excluded.
 */
export function spatialSector(source: Point, candidate: Point): SpatialDirection | null {
  const dx = candidate.x - source.x;
  const dy = candidate.y - source.y;
  if (dx === 0 && dy === 0) return null;
  const degrees = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  // Absorb the sub-ulp drift introduced when an exact boundary is expressed as a point.
  return CLOCKWISE_DIRECTIONS[Math.floor(((degrees + 22.5 + 1e-10) % 360) / 45)]!;
}

/** Selects only within the requested sector; distance then stable ID define total ordering. */
export function nearestSpatialCandidate(source: SpatialCandidate, candidates: readonly SpatialCandidate[], direction: SpatialDirection): SpatialCandidate | null {
  return candidates
    .filter(candidate => candidate.id !== source.id && spatialSector(source, candidate) === direction)
    .map(candidate => ({ candidate, distance: (candidate.x - source.x) ** 2 + (candidate.y - source.y) ** 2 }))
    .sort((a, b) => a.distance - b.distance || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0))[0]?.candidate ?? null;
}

const NUMPAD_DIRECTIONS: Partial<Record<string, SpatialDirection>> = {
  Numpad1: 'south-west', Numpad2: 'south', Numpad3: 'south-east', Numpad4: 'west',
  Numpad6: 'east', Numpad7: 'north-west', Numpad8: 'north', Numpad9: 'north-east',
};

export function spatialDirectionForKey(event: Pick<KeyboardEvent, 'key' | 'code'>): SpatialDirection | null {
  if (event.key === 'ArrowUp') return 'north';
  if (event.key === 'ArrowRight') return 'east';
  if (event.key === 'ArrowDown') return 'south';
  if (event.key === 'ArrowLeft') return 'west';
  return NUMPAD_DIRECTIONS[event.code] ?? null;
}
