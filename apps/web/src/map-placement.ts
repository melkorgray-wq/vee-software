import type { MapDocument } from '@vee/domain';
import { layoutForEntity, type NodeLayout } from './map-adapter';

import type { Point } from './map-interaction';

export const EMPTY_MAP_PLACEMENT: Point = { x: 80, y: 80 };

const VISUAL_GUARD = 24;
const DIRECTIONS_PER_RING = 16;
const MAX_RINGS = 64;

interface Rect { left: number; top: number; right: number; bottom: number }

function rectAt(point: Point, diameter: number): Rect {
  return { left: point.x, top: point.y, right: point.x + diameter, bottom: point.y + diameter };
}

function intersectionArea(a: Rect, b: Rect): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

/**
 * Finds a map-coordinate niche without mutating authored placements. Candidate order
 * starts at 12 o'clock and sweeps clockwise, which is the stable final tie-break.
 */
export function findFreePlacement(document: MapDocument, viewId: string, newNodeLayout: Pick<NodeLayout, 'diameter'>): Point {
  const occupied = document.placements.flatMap((placement) => {
    if (placement.viewId !== viewId) return [];
    const entity = document.entities.find((candidate) => candidate.id === placement.entityId);
    if (!entity) return [];
    const diameter = layoutForEntity(entity).diameter;
    return [{ rect: rectAt(placement, diameter), diameter }];
  });
  if (!occupied.length) return { ...EMPTY_MAP_PLACEMENT };

  const bounds = occupied.reduce((result, item) => ({
    left: Math.min(result.left, item.rect.left),
    top: Math.min(result.top, item.rect.top),
    right: Math.max(result.right, item.rect.right),
    bottom: Math.max(result.bottom, item.rect.bottom),
  }), occupied[0]!.rect);
  const origin = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
  const largestDiameter = Math.max(newNodeLayout.diameter, ...occupied.map((item) => item.diameter));
  const ringStep = (newNodeLayout.diameter + largestDiameter) / 2 + VISUAL_GUARD;

  for (let ring = 1; ring <= MAX_RINGS; ring += 1) {
    const radius = ring * ringStep;
    const valid: Array<{ point: Point; guardIntrusion: number; order: number }> = [];
    for (let order = 0; order < DIRECTIONS_PER_RING; order += 1) {
      const angle = -Math.PI / 2 + order * (Math.PI * 2 / DIRECTIONS_PER_RING);
      const point = {
        x: origin.x + Math.cos(angle) * radius - newNodeLayout.diameter / 2,
        y: origin.y + Math.sin(angle) * radius - newNodeLayout.diameter / 2,
      };
      const candidate = rectAt(point, newNodeLayout.diameter);
      if (occupied.some((item) => intersectionArea(candidate, item.rect) > 0)) continue;
      const guardIntrusion = occupied.reduce((total, item) => total + intersectionArea(candidate, {
        left: item.rect.left - VISUAL_GUARD,
        top: item.rect.top - VISUAL_GUARD,
        right: item.rect.right + VISUAL_GUARD,
        bottom: item.rect.bottom + VISUAL_GUARD,
      }), 0);
      valid.push({ point, guardIntrusion, order });
    }
    if (valid.length) {
      valid.sort((a, b) => a.guardIntrusion - b.guardIntrusion || a.order - b.order);
      return valid[0]!.point;
    }
  }

  // The finite search is deliberately bounded; this deterministic outer candidate
  // remains beyond the occupied bounds even for an exceptionally large document.
  return { x: bounds.right + VISUAL_GUARD, y: origin.y - newNodeLayout.diameter / 2 };
}
