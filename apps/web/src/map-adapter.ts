import type { MapDocument, ProvisionalEntityKind, Relationship } from '@vee/domain';
import { MarkerType, type Edge, type Node } from '@xyflow/react';

export const KIND_LABELS: Record<ProvisionalEntityKind, string> = { customer_phenomenon: 'Customer phenomenon', touchpoint: 'Touchpoint', offer: 'Offer', product: 'Product' };
export const BASE_DIAMETER = 96;
export const HIERARCHY_SCALE = 1.18;
export const MAX_DIAMETER = 160;
export interface MapNodeData extends Record<string, unknown> { title: string; kindLabel: string; url?: string }
const LABELS: Record<Relationship['kind'], string> = { product_packaged_as_offer: 'packaged as', offer_presented_at_touchpoint: 'presented at', touchpoint_contains_touchpoint: 'contains' };

function endpoints(relationship: Relationship): [string, string] {
  if (relationship.kind === 'product_packaged_as_offer') return [relationship.productId, relationship.offerId];
  if (relationship.kind === 'offer_presented_at_touchpoint') return [relationship.offerId, relationship.touchpointId];
  return [relationship.parentTouchpointId, relationship.childTouchpointId];
}
export function deriveStructuralDepths(document: MapDocument): ReadonlyMap<string, number> {
  const children = new Map<string, string[]>();
  for (const relationship of document.relationships) { const [parent, child] = endpoints(relationship); children.set(parent, [...(children.get(parent) ?? []), child]); }
  const memo = new Map<string, number>();
  const depth = (id: string, path = new Set<string>()): number => { if (memo.has(id)) return memo.get(id)!; if (path.has(id)) return 0; const nextPath = new Set(path).add(id); const value = Math.max(0, ...(children.get(id) ?? []).map(child => 1 + depth(child, nextPath))); memo.set(id, value); return value; };
  document.entities.forEach(entity => depth(entity.id)); return memo;
}
export function diameterForDepth(depth: number): number { return Math.min(MAX_DIAMETER, Math.round(BASE_DIAMETER * HIERARCHY_SCALE ** depth)); }
export function deriveMapNodes(document: MapDocument, viewId: string, selectedEntityId: string | null): Node<MapNodeData>[] {
  const depths = deriveStructuralDepths(document);
  return document.placements.filter(p => p.viewId === viewId).flatMap(placement => {
    const entity = document.entities.find(e => e.id === placement.entityId); if (!entity) return [];
    const diameter = diameterForDepth(depths.get(entity.id) ?? 0);
    return [{ id: entity.id, position: { x: placement.x, y: placement.y }, selected: entity.id === selectedEntityId, width: diameter, height: diameter, style: { width: diameter, height: diameter }, data: { title: entity.title, kindLabel: KIND_LABELS[entity.kind], ...(entity.kind === 'touchpoint' && entity.url ? { url: entity.url } : {}) }, className: 'map-node' }];
  });
}
export function deriveMapEdges(document: MapDocument): Edge[] { return document.relationships.map(relationship => { const [source, target] = endpoints(relationship); return { id: relationship.id, source, target, label: LABELS[relationship.kind], markerEnd: { type: MarkerType.ArrowClosed }, className: 'map-edge' }; }); }
