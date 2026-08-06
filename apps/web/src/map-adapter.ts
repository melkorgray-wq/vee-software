import type { MapDocument } from '@vee/domain';
import type { Node } from '@xyflow/react';

export const KIND_LABELS = {
  customer_phenomenon: 'Customer phenomenon', touchpoint: 'Touchpoint', offer: 'Offer', product: 'Product',
} as const;
export const STATUS_LABELS = {
  observed: 'Observed', participant_reported: 'Participant reported', business_intent: 'Business intent',
  hypothesis: 'Hypothesis', interpretation: 'Interpretation', confirmed_outcome: 'Confirmed outcome',
} as const;

export interface MapNodeData extends Record<string, unknown> { title: string; kindLabel: string; statusLabel: string }

export function deriveMapNodes(document: MapDocument, viewId: string, selectedEntityId: string | null): Node<MapNodeData>[] {
  return document.placements.filter(p => p.viewId === viewId).flatMap(placement => {
    const entity = document.entities.find(({ id }) => id === placement.entityId);
    const annotation = document.epistemicAnnotations.find(({ subjectEntityId }) => subjectEntityId === placement.entityId);
    if (!entity || !annotation) return [];
    return [{ id: entity.id, position: { x: placement.x, y: placement.y }, selected: entity.id === selectedEntityId,
      data: { title: entity.title, kindLabel: KIND_LABELS[entity.kind], statusLabel: STATUS_LABELS[annotation.status] },
      className: 'map-node' }];
  });
}
