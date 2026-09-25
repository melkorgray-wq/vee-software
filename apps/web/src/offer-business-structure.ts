import type { Entity, MapDocument } from '@vee/domain';

type Product = Extract<Entity, { kind: 'product' }>;
type Touchpoint = Extract<Entity, { kind: 'touchpoint' }>;

export interface OfferBusinessStructure {
  product: Product;
  touchpoints: Touchpoint[];
}

export interface ConnectedTouchpointCandidate {
  id: string;
  title: string;
  connected: boolean;
  structuralRole: 'Root' | 'Child';
  linkedOfferCount: number;
}

const byTitleThenId = <T extends { title: string; id: string }>(left: T, right: T) =>
  left.title.localeCompare(right.title) || left.id.localeCompare(right.id);

/** Builds the Offer documentary projection solely from committed MapDocument records. */
export function deriveOfferBusinessStructure(document: MapDocument, offerId: string): OfferBusinessStructure | undefined {
  if (!document.entities.some(entity => entity.id === offerId && entity.kind === 'offer')) return undefined;
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  const validProducts = document.relationships.flatMap(relation => {
    if (relation.kind !== 'product_packaged_as_offer' || relation.offerId !== offerId) return [];
    const product = entities.get(relation.productId);
    return product?.kind === 'product' ? [product] : [];
  });
  if (validProducts.length !== 1) return undefined;

  const touchpointIds = new Set(document.relationships.flatMap(relation =>
    relation.kind === 'offer_presented_at_touchpoint' && relation.offerId === offerId ? [relation.touchpointId] : [],
  ));
  const touchpoints = [...touchpointIds].flatMap(id => {
    const entity = entities.get(id);
    return entity?.kind === 'touchpoint' ? [entity] : [];
  }).sort(byTitleThenId);
  return { product: validProducts[0]!, touchpoints };
}

/** Candidate metadata is derived exclusively from committed, valid domain endpoints. */
export function projectConnectedTouchpointCandidates(document: MapDocument, offerId: string): ConnectedTouchpointCandidate[] {
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  const validOfferIds = new Set(document.entities.flatMap(entity => entity.kind === 'offer' ? [entity.id] : []));
  const childIds = new Set(document.relationships.flatMap(relation => {
    if (relation.kind !== 'touchpoint_contains_touchpoint') return [];
    return entities.get(relation.parentTouchpointId)?.kind === 'touchpoint' && entities.get(relation.childTouchpointId)?.kind === 'touchpoint'
      ? [relation.childTouchpointId] : [];
  }));
  const offersByTouchpoint = new Map<string, Set<string>>();
  for (const relation of document.relationships) {
    if (relation.kind !== 'offer_presented_at_touchpoint' || entities.get(relation.touchpointId)?.kind !== 'touchpoint' || !validOfferIds.has(relation.offerId)) continue;
    const offerIds = offersByTouchpoint.get(relation.touchpointId) ?? new Set<string>();
    offerIds.add(relation.offerId);
    offersByTouchpoint.set(relation.touchpointId, offerIds);
  }
  return document.entities.flatMap((entity): ConnectedTouchpointCandidate[] => entity.kind === 'touchpoint' ? [{
    id: entity.id,
    title: entity.title,
    connected: offersByTouchpoint.get(entity.id)?.has(offerId) ?? false,
    structuralRole: childIds.has(entity.id) ? 'Child' : 'Root',
    linkedOfferCount: offersByTouchpoint.get(entity.id)?.size ?? 0,
  }] : []).sort(byTitleThenId);
}
