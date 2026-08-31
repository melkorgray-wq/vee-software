import { movePlacement, type MapDocument } from '@vee/domain';
import { spatialDirectionForKey } from './map-spatial-navigation';

export type MoveMode = { state: 'inactive' } | { state: 'moving'; entityId: string };
export const MOVE_STEP = 24;
export const inactiveMoveMode = (): MoveMode => ({ state: 'inactive' });

export function enterMoveMode(entityId: string, blocked: boolean): MoveMode {
  return blocked ? inactiveMoveMode() : { state: 'moving', entityId };
}

/** Diagonal movement applies the same authored-view step on both axes. */
export function moveVectorForKey(event: Pick<KeyboardEvent, 'key' | 'code'>): { x: number; y: number } | null {
  const direction = spatialDirectionForKey(event);
  if (!direction) return null;
  return {
    x: direction.includes('west') ? -MOVE_STEP : direction.includes('east') ? MOVE_STEP : 0,
    y: direction.includes('north') ? -MOVE_STEP : direction.includes('south') ? MOVE_STEP : 0,
  };
}

export function moveInMode(document: MapDocument, viewId: string, mode: MoveMode, event: Pick<KeyboardEvent, 'key' | 'code'>): MapDocument {
  if (mode.state === 'inactive') return document;
  const vector = moveVectorForKey(event);
  const placement = document.placements.find(candidate => candidate.viewId === viewId && candidate.entityId === mode.entityId);
  if (!vector || !placement) return document;
  return movePlacement(document, { entityId: mode.entityId, viewId, x: placement.x + vector.x, y: placement.y + vector.y });
}
