import type { Entity, MapDocument, ProvisionalEntityKind, Relationship } from '@vee/domain';
import { MarkerType, type Edge, type Node } from '@xyflow/react';

export const KIND_LABELS: Record<ProvisionalEntityKind, string> = { product: 'Product', offer: 'Offer', touchpoint: 'Touchpoint', core_functional_job: 'Core Functional Job', emotional_job: 'Emotional Job', social_job: 'Social Job', consumption_chain_job: 'Consumption Chain Job', financial_desired_outcome: 'Financial Desired Outcome' };
export interface NodeLayout { diameter: number; titleFontSize: number; kindFontSize: number; contentWidth: number; compactTitle: boolean }
export interface MapNodeData extends Record<string, unknown> { title: string; kindLabel: string; layout: NodeLayout; url?: string }
const LABELS: Record<Relationship['kind'], string> = { product_packaged_as_offer: 'packaged as', offer_presented_at_touchpoint: 'presented at', touchpoint_contains_touchpoint: 'contains' };
const ROLE_LAYOUTS: Record<ProvisionalEntityKind, Pick<NodeLayout, 'diameter' | 'titleFontSize' | 'kindFontSize'>> = {
  product: { diameter: 136, titleFontSize: 16, kindFontSize: 13 },
  offer: { diameter: 116, titleFontSize: 15, kindFontSize: 12.5 },
  touchpoint: { diameter: 96, titleFontSize: 14, kindFontSize: 12 },
  core_functional_job: { diameter: 116, titleFontSize: 15, kindFontSize: 12.5 },
  emotional_job: { diameter: 116, titleFontSize: 15, kindFontSize: 12.5 },
  social_job: { diameter: 116, titleFontSize: 15, kindFontSize: 12.5 },
  consumption_chain_job: { diameter: 116, titleFontSize: 15, kindFontSize: 12.5 },
  financial_desired_outcome: { diameter: 116, titleFontSize: 15, kindFontSize: 12.5 },
};

function endpoints(relationship: Relationship): [string, string] {
  if (relationship.kind === 'product_packaged_as_offer') return [relationship.productId, relationship.offerId];
  if (relationship.kind === 'offer_presented_at_touchpoint') return [relationship.offerId, relationship.touchpointId];
  return [relationship.parentTouchpointId, relationship.childTouchpointId];
}
export function layoutForEntity(entity: Pick<Entity, 'kind' | 'title'>): NodeLayout {
  const role = ROLE_LAYOUTS[entity.kind];
  return { ...role, contentWidth: Math.round(role.diameter * .68), compactTitle: entity.title.trim().length > 20 };
}
export function deriveMapNodes(document: MapDocument, viewId: string, selectedEntityId: string | null): Node<MapNodeData>[] {
  return document.placements.filter(p => p.viewId === viewId).flatMap(placement => {
    const entity = document.entities.find(e => e.id === placement.entityId); if (!entity) return [];
    const layout = layoutForEntity(entity);
    return [{ id: entity.id, position: { x: placement.x, y: placement.y }, selected: entity.id === selectedEntityId, width: layout.diameter, height: layout.diameter, style: { width: layout.diameter, height: layout.diameter }, data: { title: entity.title, kindLabel: KIND_LABELS[entity.kind], layout, ...(entity.kind === 'touchpoint' && entity.url ? { url: entity.url } : {}) }, className: 'map-node' }];
  });
}
export function deriveVisibleAuthoredRelationships(document: MapDocument): Relationship[] {
  const nestedTouchpointIds = new Set(document.relationships.flatMap(relationship => relationship.kind === 'touchpoint_contains_touchpoint' ? [relationship.childTouchpointId] : []));
  return document.relationships.filter(relationship => relationship.kind !== 'offer_presented_at_touchpoint' || !nestedTouchpointIds.has(relationship.touchpointId));
}
export function deriveMapEdges(document: MapDocument): Edge[] { return deriveVisibleAuthoredRelationships(document).map(relationship => { const [source, target] = endpoints(relationship); return { id: relationship.id, source, target, label: LABELS[relationship.kind], markerEnd: { type: MarkerType.ArrowClosed }, className: 'map-edge' }; }); }
