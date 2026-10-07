import type { Entity, MapDocument, Relationship } from '@vee/domain';

export interface ProductNeighborhoodNeighbor {
  productId: string;
  contributorOfferIds: string[];
}

export interface ProductTouchpointNeighborhoodGround {
  id: string;
  basisKind: 'touchpoint';
  basisId: string;
  inspectedContributorOfferIds: string[];
  neighbors: ProductNeighborhoodNeighbor[];
  count: number;
}

export interface ProductNeighborhood {
  productId: string;
  grounds: ProductTouchpointNeighborhoodGround[];
}

const byTitleThenId = (left: Entity, right: Entity) =>
  left.title.localeCompare(right.title) || left.id.localeCompare(right.id);

/** Projects exact shared downstream Touchpoints; Offers remain provenance, never neighbors. */
export function deriveProductNeighborhood(
  document: MapDocument,
  productId: string,
): ProductNeighborhood | undefined {
  const entities = new Map(document.entities.map((entity) => [entity.id, entity]));
  if (entities.get(productId)?.kind !== 'product') return undefined;

  const ownershipByOffer = new Map<string, Extract<Relationship, { kind: 'product_packaged_as_offer' }>[]>();
  for (const relationship of document.relationships) {
    if (relationship.kind !== 'product_packaged_as_offer') continue;
    const ownership = ownershipByOffer.get(relationship.offerId) ?? [];
    ownership.push(relationship);
    ownershipByOffer.set(relationship.offerId, ownership);
  }

  const productsByTouchpoint = new Map<string, Map<string, Set<string>>>();
  for (const relationship of document.relationships) {
    if (relationship.kind !== 'offer_presented_at_touchpoint') continue;
    if (entities.get(relationship.offerId)?.kind !== 'offer'
      || entities.get(relationship.touchpointId)?.kind !== 'touchpoint') continue;
    const ownership = ownershipByOffer.get(relationship.offerId);
    // Preserve the required single ownership record, including malformed duplicate-record rejection.
    if (ownership?.length !== 1) continue;
    const owner = ownership[0]!;
    if (entities.get(owner.productId)?.kind !== 'product') continue;
    const products = productsByTouchpoint.get(relationship.touchpointId) ?? new Map<string, Set<string>>();
    const offers = products.get(owner.productId) ?? new Set<string>();
    offers.add(relationship.offerId);
    products.set(owner.productId, offers);
    productsByTouchpoint.set(relationship.touchpointId, products);
  }

  const sortIds = (ids: Iterable<string>) => [...ids]
    .sort((left, right) => byTitleThenId(entities.get(left)!, entities.get(right)!));
  const grounds: ProductTouchpointNeighborhoodGround[] = [];
  for (const [touchpointId, products] of productsByTouchpoint) {
    const inspectedOffers = products.get(productId);
    if (!inspectedOffers) continue;
    const neighbors = sortIds([...products.keys()].filter((id) => id !== productId))
      .map((id) => ({ productId: id, contributorOfferIds: sortIds(products.get(id)!) }));
    if (!neighbors.length) continue;
    grounds.push({
      id: `touchpoint:${touchpointId}`,
      basisKind: 'touchpoint',
      basisId: touchpointId,
      inspectedContributorOfferIds: sortIds(inspectedOffers),
      neighbors,
      count: neighbors.length,
    });
  }
  grounds.sort((left, right) => byTitleThenId(entities.get(left.basisId)!, entities.get(right.basisId)!));
  return { productId, grounds };
}
