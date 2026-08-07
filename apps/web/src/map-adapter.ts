import type { MapDocument, ProvisionalEntityKind, Relationship } from '@vee/domain';
import { MarkerType, type Edge, type Node } from '@xyflow/react';

export const KIND_LABELS: Record<ProvisionalEntityKind, string> = {
  customer_phenomenon: 'Customer phenomenon', touchpoint: 'Touchpoint', offer: 'Offer', product: 'Product',
};
export interface MapNodeData extends Record<string, unknown> { title: string; kindLabel: string }

const RELATIONSHIP_LABELS: Record<Relationship['kind'], string> = {
  product_packaged_as_offer: 'packaged as',
  offer_presented_at_touchpoint: 'presented at',
};

export function deriveMapNodes(document: MapDocument, viewId: string, selectedEntityId: string | null): Node<MapNodeData>[] {
  return document.placements.filter(p => p.viewId === viewId).flatMap(placement => {
    const entity = document.entities.find(({ id }) => id === placement.entityId);
    if (!entity) return [];
    return [{ id: entity.id, position: { x: placement.x, y: placement.y }, selected: entity.id === selectedEntityId,
      data: { title: entity.title, kindLabel: KIND_LABELS[entity.kind] }, className: 'map-node' }];
  });
}

export function deriveMapEdges(document: MapDocument): Edge[] {
  return document.relationships.map(relationship => ({
    id: relationship.id,
    source: relationship.kind === 'product_packaged_as_offer' ? relationship.productId : relationship.offerId,
    target: relationship.kind === 'product_packaged_as_offer' ? relationship.offerId : relationship.touchpointId,
    label: RELATIONSHIP_LABELS[relationship.kind],
    markerEnd: { type: MarkerType.ArrowClosed },
    className: 'map-edge',
  }));
}
