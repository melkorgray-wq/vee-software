import type { MapDocument, ProvisionalEntityKind } from '@vee/domain';
import type { Node } from '@xyflow/react';

export const KIND_LABELS: Record<ProvisionalEntityKind, string> = {
  customer_phenomenon: 'Customer phenomenon', touchpoint: 'Touchpoint', offer: 'Offer', product: 'Product',
};
export interface MapNodeData extends Record<string, unknown> { title: string; kindLabel: string }

export function deriveMapNodes(document: MapDocument, viewId: string, selectedEntityId: string | null): Node<MapNodeData>[] {
  return document.placements.filter(p => p.viewId === viewId).flatMap(placement => {
    const entity = document.entities.find(({ id }) => id === placement.entityId);
    if (!entity) return [];
    return [{ id: entity.id, position: { x: placement.x, y: placement.y }, selected: entity.id === selectedEntityId,
      data: { title: entity.title, kindLabel: KIND_LABELS[entity.kind] }, className: 'map-node' }];
  });
}
