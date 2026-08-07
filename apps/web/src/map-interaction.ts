import type { MapDocument, Relationship } from '@vee/domain';

export interface Point { x: number; y: number }
export interface PanelRect { left: number; top: number; width: number; height: number }

export function overlayPoint(client: Point, panel: PanelRect, overlay = { width: 208, height: 224 }): Point {
  return {
    x: Math.max(0, Math.min(client.x - panel.left, Math.max(0, panel.width - overlay.width))),
    y: Math.max(0, Math.min(client.y - panel.top, Math.max(0, panel.height - overlay.height))),
  };
}

export function parentTouchpointOptions(document: MapDocument, childId?: string) {
  const children = new Map<string, string[]>();
  for (const relationship of document.relationships) if (relationship.kind === 'touchpoint_contains_touchpoint') children.set(relationship.parentTouchpointId, [...(children.get(relationship.parentTouchpointId) ?? []), relationship.childTouchpointId]);
  const descendants = new Set<string>(); const pending = childId ? [...(children.get(childId) ?? [])] : [];
  while (pending.length) { const id = pending.pop()!; if (!descendants.has(id)) { descendants.add(id); pending.push(...(children.get(id) ?? [])); } }
  return document.entities.filter(entity => entity.kind === 'touchpoint' && entity.id !== childId && !descendants.has(entity.id));
}

export function linkedOfferIds(document: MapDocument, touchpointId: string): string[] {
  return document.relationships.filter((relationship): relationship is Extract<Relationship, { kind: 'offer_presented_at_touchpoint' }> => relationship.kind === 'offer_presented_at_touchpoint' && relationship.touchpointId === touchpointId).map(relationship => relationship.offerId);
}
