import { relevantRepulsorsForTouchpoint, type Entity, type MapDocument, type ProvisionalEntityKind, type Relationship } from '@vee/domain';
import { MarkerType, type BuiltInEdge, type Edge, type Node } from '@xyflow/react';

type MapEdge = Edge | BuiltInEdge;

export const KIND_LABELS: Record<ProvisionalEntityKind, string> = { product: 'Product', offer: 'Offer', touchpoint: 'Touchpoint', core_functional_job: 'Core Functional Job', emotional_job: 'Emotional Job', social_job: 'Social Job', consumption_chain_job: 'Consumption Chain Job', financial_desired_outcome: 'Financial Desired Outcome', related_job: 'Related Job', desired_outcome: 'Desired Outcome', repulsor: 'Repulsor' };
export interface NodeLayout { diameter: number; titleFontSize: number; kindFontSize: number; contentWidth: number; compactTitle: boolean }
export interface MapNodeData extends Record<string, unknown> { title: string; kindLabel: string; layout: NodeLayout; url?: string }
const ROLE_LAYOUTS: Record<ProvisionalEntityKind, Pick<NodeLayout, 'diameter' | 'titleFontSize' | 'kindFontSize'>> = {
  product: { diameter: 136, titleFontSize: 16, kindFontSize: 13 },
  offer: { diameter: 116, titleFontSize: 15, kindFontSize: 12.5 },
  touchpoint: { diameter: 96, titleFontSize: 14, kindFontSize: 12 },
  core_functional_job: { diameter: 116, titleFontSize: 15, kindFontSize: 12.5 },
  emotional_job: { diameter: 116, titleFontSize: 15, kindFontSize: 12.5 },
  social_job: { diameter: 116, titleFontSize: 15, kindFontSize: 12.5 },
  consumption_chain_job: { diameter: 116, titleFontSize: 15, kindFontSize: 12.5 },
  financial_desired_outcome: { diameter: 116, titleFontSize: 15, kindFontSize: 12.5 },
  related_job: { diameter: 96, titleFontSize: 14, kindFontSize: 12 },
  desired_outcome: { diameter: 96, titleFontSize: 14, kindFontSize: 12 },
  repulsor: { diameter: 96, titleFontSize: 14, kindFontSize: 12 },
};

function endpoints(relationship: Relationship): [string, string] {
  if (relationship.kind === 'product_packaged_as_offer') return [relationship.productId, relationship.offerId];
  if (relationship.kind === 'offer_presented_at_touchpoint') return [relationship.offerId, relationship.touchpointId];
  if (relationship.kind === 'touchpoint_contains_touchpoint') return [relationship.parentTouchpointId, relationship.childTouchpointId];
  if (relationship.kind === 'core_functional_job_has_related_job') return [relationship.coreFunctionalJobId, relationship.relatedJobId];
  if (relationship.kind === 'job_has_desired_outcome') return [relationship.jobId, relationship.desiredOutcomeId];
  if (relationship.kind === 'core_functional_job_contextualizes_job') return [relationship.coreFunctionalJobId, relationship.contextualJobId];
  if (relationship.kind === 'touchpoint_mitigates_repulsor') return [relationship.touchpointId, relationship.repulsorId];
  return [relationship.repulsorId, relationship.targetEntityId];
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
export function deriveMapEdges(document: MapDocument): MapEdge[] {
  const authored = deriveVisibleAuthoredRelationships(document).map(relationship => { const [source, target] = endpoints(relationship); return { id: relationship.id, source, target, markerEnd: { type: MarkerType.ArrowClosed }, className: 'map-edge' }; });
  const routes = new Map<string, MapEdge>();
  for (const touchpoint of document.entities.filter(entity => entity.kind === 'touchpoint')) {
    const offerIds = new Set(document.relationships.flatMap(relation => relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === touchpoint.id ? [relation.offerId] : []));
    const intentIds = new Set(document.offerJobSelections.flatMap(selection => offerIds.has(selection.offerId) ? [selection.productJobIntentId] : []));
    const byJob = new Map<string, Set<string>>();
    for (const intent of document.productJobIntents.filter(candidate => intentIds.has(candidate.id))) {
      const outcomes = byJob.get(intent.jobId) ?? new Set<string>(); intent.addressedDesiredOutcomeIds.forEach(id => outcomes.add(id)); byJob.set(intent.jobId, outcomes);
    }
    for (const [jobId, outcomes] of byJob) {
      const sources = outcomes.size ? outcomes : new Set([jobId]);
      for (const source of sources) { const key = `${source}->${touchpoint.id}`; routes.set(key, { id: `intent-route:${key}`, source, target: touchpoint.id, markerEnd: { type: MarkerType.ArrowClosed }, className: 'map-edge derived-intent-edge' }); }
    }
    const financialIds = new Set(document.offerFinancialIntents.flatMap(intent => offerIds.has(intent.offerId) ? [intent.financialDesiredOutcomeId] : []));
    for (const source of financialIds) { const key = `${source}->${touchpoint.id}`; routes.set(key, { id: `financial-intent-route:${key}`, source, target: touchpoint.id, markerEnd: { type: MarkerType.ArrowClosed }, className: 'map-edge derived-intent-edge' }); }
  }
  const resistanceRoutes: MapEdge[] = [];
  for (const touchpoint of document.entities.filter(entity => entity.kind === 'touchpoint')) {
    for (const repulsor of relevantRepulsorsForTouchpoint(document, touchpoint.id)) {
      resistanceRoutes.push({ id: `repulsor-route:${repulsor.id}->${touchpoint.id}`, source: repulsor.id, target: touchpoint.id, markerEnd: { type: MarkerType.ArrowClosed }, className: 'map-edge derived-repulsor-edge' });
    }
  }
  const oppositePairs = new Set(document.relationships.flatMap(relationship => relationship.kind === 'touchpoint_mitigates_repulsor' ? [`${relationship.repulsorId}->${relationship.touchpointId}`] : []));
  const separateOppositePair = (edge: Edge): MapEdge => oppositePairs.has(`${edge.source}->${edge.target}`) || oppositePairs.has(`${edge.target}->${edge.source}`)
    ? { ...edge, type: 'smoothstep', pathOptions: { offset: 24, borderRadius: 12 } }
    : edge;
  return [...authored, ...routes.values(), ...resistanceRoutes].map(separateOppositePair);
}
