import type { MapDocument, ProvisionalEntityKind, Relationship } from '@vee/domain';

export interface Point { x: number; y: number }
export interface PanelRect { left: number; top: number; width: number; height: number }
export interface OverlaySize { width: number; height: number }
export type SiblingDraft = { kind: ProvisionalEntityKind; title: ''; linkedProductId: string; linkedOfferIds: string[]; locatedInId: string; locatedInQuery: string; parentTouchpointId: string; parentEntityId: string; resistedTargetIds: string[]; url: '' };

export function overlayPoint(client: Point, panel: PanelRect, overlay = { width: 208, height: 224 }): Point {
  return {
    x: Math.max(0, Math.min(client.x - panel.left, Math.max(0, panel.width - overlay.width))),
    y: Math.max(0, Math.min(client.y - panel.top, Math.max(0, panel.height - overlay.height))),
  };
}

export function contextMenuPoint(client: Point, panel: PanelRect, menu: OverlaySize, gutter = 8): Point {
  const anchor = { x: client.x - panel.left, y: client.y - panel.top };
  const maximum = {
    x: Math.max(gutter, panel.width - menu.width - gutter),
    y: Math.max(gutter, panel.height - menu.height - gutter),
  };
  const x = anchor.x + menu.width + gutter <= panel.width
    ? anchor.x
    : anchor.x - menu.width >= gutter ? anchor.x - menu.width : Math.max(gutter, Math.min(anchor.x, maximum.x));
  const y = anchor.y + menu.height + gutter <= panel.height
    ? anchor.y
    : anchor.y - menu.height >= gutter ? anchor.y - menu.height : Math.max(gutter, Math.min(anchor.y, maximum.y));
  return { x, y };
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

export function siblingDraft(document: MapDocument, entityId: string): SiblingDraft | null {
  const entity = document.entities.find(candidate => candidate.id === entityId);
  if (!entity) return null;
  const result: SiblingDraft = { kind: entity.kind, title: '', linkedProductId: '', linkedOfferIds: [], locatedInId: '', locatedInQuery: '', parentTouchpointId: '', parentEntityId: '', resistedTargetIds: [], url: '' };
  if (entity.kind === 'offer') result.linkedProductId = document.relationships.find((relationship): relationship is Extract<Relationship, { kind: 'product_packaged_as_offer' }> => relationship.kind === 'product_packaged_as_offer' && relationship.offerId === entity.id)?.productId ?? '';
  if (entity.kind === 'touchpoint') {
    result.linkedOfferIds = linkedOfferIds(document, entity.id);
    result.parentTouchpointId = document.relationships.find((relationship): relationship is Extract<Relationship, { kind: 'touchpoint_contains_touchpoint' }> => relationship.kind === 'touchpoint_contains_touchpoint' && relationship.childTouchpointId === entity.id)?.parentTouchpointId ?? '';
    result.locatedInId = entity.locatedInId;
    result.locatedInQuery = document.touchpointContainers.find(container => container.id === entity.locatedInId)?.title ?? '';
  }
  if (entity.kind === 'related_job') result.parentEntityId = document.relationships.find((relationship): relationship is Extract<Relationship, { kind: 'core_functional_job_has_related_job' }> => relationship.kind === 'core_functional_job_has_related_job' && relationship.relatedJobId === entity.id)?.coreFunctionalJobId ?? '';
  if (entity.kind === 'desired_outcome') result.parentEntityId = document.relationships.find((relationship): relationship is Extract<Relationship, { kind: 'job_has_desired_outcome' }> => relationship.kind === 'job_has_desired_outcome' && relationship.desiredOutcomeId === entity.id)?.jobId ?? '';
  if (entity.kind === 'repulsor') result.resistedTargetIds = document.relationships.filter((relationship): relationship is Extract<Relationship, { kind: 'repulsor_resists' }> => relationship.kind === 'repulsor_resists' && relationship.repulsorId === entity.id).map(relationship => relationship.targetEntityId);
  return result;
}

export function siblingPlacement(document: MapDocument, entityId: string, viewId: string, offset = 125): Point | null {
  const selected = document.placements.find(placement => placement.entityId === entityId && placement.viewId === viewId);
  if (!selected) return null;
  let y = selected.y + offset;
  const occupied = new Set(document.placements.filter(placement => placement.viewId === viewId && placement.x === selected.x).map(placement => placement.y));
  while (occupied.has(y)) y += offset;
  return { x: selected.x, y };
}
