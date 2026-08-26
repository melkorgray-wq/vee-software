import type { MapDocument } from '@vee/domain';
import { deriveMapEdges, layoutForEntity, type NodeLayout } from './map-adapter';

import type { Point } from './map-interaction';

export const EMPTY_MAP_PLACEMENT: Point = { x: 80, y: 80 };

const VISUAL_GUARD = 24;
const RELATION_GAP = 28;
const DIRECTIONS_PER_RING = 16;
const MAX_RINGS = 64;

interface Rect { left: number; top: number; right: number; bottom: number }
interface OccupiedNode { entityId: string; rect: Rect; diameter: number; center: Point }
export interface ProposedPlacementRelation { sourceId: string; targetId: string }

function rectAt(point: Point, diameter: number): Rect {
  return { left: point.x, top: point.y, right: point.x + diameter, bottom: point.y + diameter };
}

function intersectionArea(a: Rect, b: Rect): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

function occupiedNodes(document: MapDocument, viewId: string): OccupiedNode[] {
  return document.placements.flatMap((placement) => {
    if (placement.viewId !== viewId) return [];
    const entity = document.entities.find((candidate) => candidate.id === placement.entityId);
    if (!entity) return [];
    const diameter = layoutForEntity(entity).diameter;
    return [{ entityId: entity.id, rect: rectAt(placement, diameter), diameter, center: { x: placement.x + diameter / 2, y: placement.y + diameter / 2 } }];
  });
}

function guardIntrusion(candidate: Rect, occupied: OccupiedNode[]): number {
  return occupied.reduce((total, item) => total + intersectionArea(candidate, {
    left: item.rect.left - VISUAL_GUARD,
    top: item.rect.top - VISUAL_GUARD,
    right: item.rect.right + VISUAL_GUARD,
    bottom: item.rect.bottom + VISUAL_GUARD,
  }), 0);
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = orientation(a, b, c); const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a); const cdB = orientation(c, d, b);
  return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0));
}

function segmentRunsThroughRect(a: Point, b: Point, rect: Rect): boolean {
  if (a.x > rect.left && a.x < rect.right && a.y > rect.top && a.y < rect.bottom) return true;
  if (b.x > rect.left && b.x < rect.right && b.y > rect.top && b.y < rect.bottom) return true;
  const topLeft = { x: rect.left, y: rect.top }; const topRight = { x: rect.right, y: rect.top };
  const bottomLeft = { x: rect.left, y: rect.bottom }; const bottomRight = { x: rect.right, y: rect.bottom };
  return segmentsCross(a, b, topLeft, topRight) || segmentsCross(a, b, topRight, bottomRight)
    || segmentsCross(a, b, bottomRight, bottomLeft) || segmentsCross(a, b, bottomLeft, topLeft);
}

function clockwisePoint(origin: Point, radius: number, order: number, diameter: number): Point {
  // Three o'clock starts the stable full-circle tie-break; stronger scores still win.
  const angle = order * (Math.PI * 2 / DIRECTIONS_PER_RING);
  return { x: origin.x + Math.cos(angle) * radius - diameter / 2, y: origin.y + Math.sin(angle) * radius - diameter / 2 };
}

/** Finds a map-coordinate niche without mutating authored placements. */
export function findFreePlacement(document: MapDocument, viewId: string, newNodeLayout: Pick<NodeLayout, 'diameter'>): Point {
  const occupied = occupiedNodes(document, viewId);
  if (!occupied.length) return { ...EMPTY_MAP_PLACEMENT };
  const bounds = occupied.reduce((result, item) => ({ left: Math.min(result.left, item.rect.left), top: Math.min(result.top, item.rect.top), right: Math.max(result.right, item.rect.right), bottom: Math.max(result.bottom, item.rect.bottom) }), occupied[0]!.rect);
  const origin = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
  const largestDiameter = Math.max(newNodeLayout.diameter, ...occupied.map((item) => item.diameter));
  const ringStep = (newNodeLayout.diameter + largestDiameter) / 2 + VISUAL_GUARD;
  for (let ring = 1; ring <= MAX_RINGS; ring += 1) {
    const valid = Array.from({ length: DIRECTIONS_PER_RING }, (_, order) => ({ point: clockwisePoint(origin, ring * ringStep, order, newNodeLayout.diameter), order }))
      .map((candidate) => ({ ...candidate, rect: rectAt(candidate.point, newNodeLayout.diameter) }))
      .filter((candidate) => !occupied.some((item) => intersectionArea(candidate.rect, item.rect) > 0))
      .map((candidate) => ({ ...candidate, guard: guardIntrusion(candidate.rect, occupied) }));
    if (valid.length) return valid.sort((a, b) => a.guard - b.guard || a.order - b.order)[0]!.point;
  }
  return { x: bounds.right + VISUAL_GUARD, y: origin.y - newNodeLayout.diameter / 2 };
}

/** Keeps a canvas-selected top-left point when free, otherwise repairs the collision locally. */
export function findPlacementNearPoint(document: MapDocument, viewId: string, newNodeLayout: Pick<NodeLayout, 'diameter'>, preferredPoint: Point): Point {
  const occupied = occupiedNodes(document, viewId);
  const preferredRect = rectAt(preferredPoint, newNodeLayout.diameter);
  if (!occupied.some((item) => intersectionArea(preferredRect, item.rect) > 0)) return { ...preferredPoint };
  const origin = { x: preferredPoint.x + newNodeLayout.diameter / 2, y: preferredPoint.y + newNodeLayout.diameter / 2 };
  const step = newNodeLayout.diameter / 2 + Math.max(...occupied.map((item) => item.diameter)) / 2 + VISUAL_GUARD;
  for (let ring = 1; ring <= MAX_RINGS; ring += 1) {
    const valid = Array.from({ length: DIRECTIONS_PER_RING }, (_, order) => ({ point: clockwisePoint(origin, ring * step, order, newNodeLayout.diameter), order }))
      .map((candidate) => ({ ...candidate, rect: rectAt(candidate.point, newNodeLayout.diameter) }))
      .filter((candidate) => !occupied.some((item) => intersectionArea(candidate.rect, item.rect) > 0))
      .map((candidate) => ({ ...candidate, guard: guardIntrusion(candidate.rect, occupied) }));
    if (valid.length) return valid.sort((a, b) => a.guard - b.guard || a.order - b.order)[0]!.point;
  }
  return { x: preferredPoint.x, y: preferredPoint.y - MAX_RINGS * step };
}

/**
 * Places one new node around equally weighted, already placed relation anchors. Edge
 * scoring deliberately approximates rendered edges as center-to-center segments.
 * Ring selection happens before visual scoring, so proximity always beats cleanliness.
 */
export function findRelatedPlacement(document: MapDocument, viewId: string, newNodeLayout: Pick<NodeLayout, 'diameter'>, anchorEntityIds: string[], proposedRelations: ProposedPlacementRelation[]): Point {
  const occupied = occupiedNodes(document, viewId);
  const anchors = [...new Set(anchorEntityIds)].sort().flatMap((id) => occupied.filter((node) => node.entityId === id));
  if (!anchors.length) return findFreePlacement(document, viewId, newNodeLayout);
  const origin = { x: anchors.reduce((sum, item) => sum + item.center.x, 0) / anchors.length, y: anchors.reduce((sum, item) => sum + item.center.y, 0) / anchors.length };
  const anchorRadius = Math.max(...anchors.map((item) => Math.hypot(item.center.x - origin.x, item.center.y - origin.y) + item.diameter / 2));
  const firstRadius = anchorRadius + newNodeLayout.diameter / 2 + RELATION_GAP;
  const ringStep = newNodeLayout.diameter / 2 + RELATION_GAP;
  const centers = new Map(occupied.map((item) => [item.entityId, item.center]));
  const existingEdges = deriveMapEdges(document).flatMap((edge) => {
    const source = centers.get(edge.source); const target = centers.get(edge.target);
    return source && target ? [{ sourceId: edge.source, targetId: edge.target, source, target }] : [];
  });
  for (let ring = 0; ring < MAX_RINGS; ring += 1) {
    const radius = firstRadius + ring * ringStep;
    const valid = Array.from({ length: DIRECTIONS_PER_RING }, (_, order) => {
      const point = clockwisePoint(origin, radius, order, newNodeLayout.diameter);
      const rect = rectAt(point, newNodeLayout.diameter); const center = { x: point.x + newNodeLayout.diameter / 2, y: point.y + newNodeLayout.diameter / 2 };
      const proposed = proposedRelations.flatMap((relation) => {
        const otherId = anchors.some((item) => item.entityId === relation.sourceId) ? relation.sourceId : relation.targetId;
        const other = centers.get(otherId); return other ? [{ ...relation, otherId, other }] : [];
      });
      const crossings = proposed.reduce((count, edge) => count + existingEdges.filter((existing) => existing.sourceId !== edge.otherId && existing.targetId !== edge.otherId && segmentsCross(center, edge.other, existing.source, existing.target)).length, 0);
      const through = existingEdges.filter((edge) => segmentRunsThroughRect(edge.source, edge.target, rect)).length;
      const aggregateDistance = anchors.reduce((sum, anchor) => sum + Math.hypot(center.x - anchor.center.x, center.y - anchor.center.y), 0);
      return { point, rect, order, crossings, through, aggregateDistance, guard: guardIntrusion(rect, occupied) };
    }).filter((candidate) => !occupied.some((item) => intersectionArea(candidate.rect, item.rect) > 0));
    if (valid.length) return valid.sort((a, b) => a.crossings - b.crossings || a.through - b.through || a.guard - b.guard || a.aggregateDistance - b.aggregateDistance || a.order - b.order)[0]!.point;
  }
  return findFreePlacement(document, viewId, newNodeLayout);
}
