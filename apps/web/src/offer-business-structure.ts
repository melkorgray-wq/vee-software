import type { Entity, MapDocument } from '@vee/domain';

type Product = Extract<Entity, { kind: 'product' }>;
type Touchpoint = Extract<Entity, { kind: 'touchpoint' }>;

export interface OfferBusinessStructure {
  product: Product;
  touchpoints: Touchpoint[];
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
