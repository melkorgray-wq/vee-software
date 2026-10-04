import type { Entity, MapDocument } from '@vee/domain';

type Product = Extract<Entity, { kind: 'product' }>;
type Offer = Extract<Entity, { kind: 'offer' }>;

export interface ProductBusinessStructure {
  product: Product;
  offers: Offer[];
}

export interface ProductOfferMoveCandidate {
  offer: Offer;
  currentProduct: Product;
}

const byTitleThenId = <T extends { title: string; id: string }>(left: T, right: T) =>
  left.title.localeCompare(right.title) || left.id.localeCompare(right.id);

/** Builds the Product documentary projection solely from committed MapDocument records. */
export function deriveProductBusinessStructure(
  document: MapDocument,
  productId: string,
): ProductBusinessStructure | undefined {
  const product = document.entities.find(
    (entity): entity is Product => entity.id === productId && entity.kind === 'product',
  );
  if (!product) return undefined;

  const entities = new Map(document.entities.map((entity) => [entity.id, entity]));
  const offerIds = new Set(document.relationships.flatMap((relation) =>
    relation.kind === 'product_packaged_as_offer' && relation.productId === product.id
      ? [relation.offerId]
      : [],
  ));
  const offers = [...offerIds]
    .flatMap((id) => {
      const entity = entities.get(id);
      return entity?.kind === 'offer' ? [entity] : [];
    })
    .sort(byTitleThenId);

  return { product, offers };
}

/** Projects Offers that could enter a future, separately owned Product-move operation. */
export function projectProductOfferMoveCandidates(
  document: MapDocument,
  productId: string,
): ProductOfferMoveCandidate[] {
  const entities = new Map(document.entities.map((entity) => [entity.id, entity]));
  if (entities.get(productId)?.kind !== 'product') return [];

  return document.entities
    .flatMap((entity): ProductOfferMoveCandidate[] => {
      if (entity.kind !== 'offer') return [];
      const ownershipRelationships = document.relationships.filter(
        (relationship): relationship is Extract<MapDocument['relationships'][number], { kind: 'product_packaged_as_offer' }> =>
          relationship.kind === 'product_packaged_as_offer' && relationship.offerId === entity.id,
      );
      const ownershipRelationship = ownershipRelationships[0];
      if (ownershipRelationships.length !== 1 || !ownershipRelationship) return [];
      const currentProduct = entities.get(ownershipRelationship.productId);
      if (currentProduct?.kind !== 'product' || currentProduct.id === productId) return [];
      return [{ offer: entity, currentProduct }];
    })
    .sort((left, right) => byTitleThenId(left.offer, right.offer));
}
