import type { Point } from './map-edge-geometry';

export interface OccupiedMapNode extends Point { id: string }
export interface SatelliteOrbitGroup { id: string; kind: string; targetIds: string[] }
export interface PositionedSatelliteGroup extends SatelliteOrbitGroup { position: Point; angle: number }
export interface PositionedSatelliteChild { id: string; position: Point; angle: number }

const SECTORS = 12;
const START_ANGLE = -Math.PI / 2;

function sectorPoint(center: Point, radius: number, sector: number): Point {
  const angle = START_ANGLE + sector * (Math.PI * 2 / SECTORS);
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

/** Chooses among fixed sectors so the visual projection is stable across rerenders. */
export function chooseDeterministicFreeSector(center: Point, radius: number, occupied: readonly OccupiedMapNode[], reservedSectors: readonly number[] = []): number {
  const reserved = new Set(reservedSectors);
  const candidates = Array.from({ length: SECTORS }, (_, sector) => sector).filter(sector => !reserved.has(sector));
  const available = candidates.length ? candidates : Array.from({ length: SECTORS }, (_, sector) => sector);
  return available.map(sector => {
    const point = sectorPoint(center, radius, sector);
    const rawClearance = occupied.reduce((nearest, item) => Math.min(nearest, Math.hypot(point.x - item.x, point.y - item.y)), Number.POSITIVE_INFINITY);
    const clearance = Number.isFinite(rawClearance) ? Math.round(rawClearance * 1e6) / 1e6 : rawClearance;
    return { sector, clearance };
  }).sort((left, right) => right.clearance - left.clearance || left.sector - right.sector)[0]!.sector;
}

/** Places all compact groups on one orbit; authored node coordinates remain input-only. */
export function placeSatelliteGroups(input: { ownerCenter: Point; orbitRadius: number; occupied: readonly OccupiedMapNode[]; groups: readonly SatelliteOrbitGroup[] }): PositionedSatelliteGroup[] {
  const reserved: number[] = [];
  return [...input.groups].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)).map(group => {
    const sector = chooseDeterministicFreeSector(input.ownerCenter, input.orbitRadius, input.occupied, reserved);
    reserved.push(sector);
    const angle = START_ANGLE + sector * (Math.PI * 2 / SECTORS);
    return { ...group, position: sectorPoint(input.ownerCenter, input.orbitRadius, sector), angle };
  });
}

/** Places a stable compact fan beyond a primary satellite, away from its authored Business owner. */
export function placeSatelliteChildFan(input: { ownerCenter: Point; parentCenter: Point; radius: number; childIds: readonly string[]; fanAngle?: number }): PositionedSatelliteChild[] {
  const outwardAngle = Math.atan2(input.parentCenter.y - input.ownerCenter.y, input.parentCenter.x - input.ownerCenter.x);
  const sorted = [...new Set(input.childIds)].sort((left, right) => left.localeCompare(right));
  const spread = input.fanAngle ?? Math.PI / 3;
  return sorted.map((id, index) => {
    const offset = sorted.length === 1 ? 0 : -spread / 2 + spread * index / (sorted.length - 1);
    const angle = outwardAngle + offset;
    return { id, angle, position: { x: input.parentCenter.x + Math.cos(angle) * input.radius, y: input.parentCenter.y + Math.sin(angle) * input.radius } };
  });
}
