import type { Entity, MapDocument, TouchpointContainer } from '@vee/domain';

type Product = Extract<Entity, { kind: 'product' }>;
type Offer = Extract<Entity, { kind: 'offer' }>;
type Touchpoint = Extract<Entity, { kind: 'touchpoint' }>;

export interface TouchpointAncestryBranch {
  product: Product;
  offer: Offer;
  touchpoint: Touchpoint;
}

export interface TouchpointBusinessStructure {
  touchpoint: Touchpoint;
  ancestryBranches: TouchpointAncestryBranch[];
  offers: Offer[];
  container?: TouchpointContainer;
  parent?: Touchpoint;
  children: Touchpoint[];
  otherTouchpointsByOffer: { offer: Offer; touchpoints: Touchpoint[] }[];
  otherTouchpointsInContainer: Touchpoint[];
}

const byTitleThenId = <T extends { title: string; id: string }>(left: T, right: T) =>
  left.title.localeCompare(right.title) || left.id.localeCompare(right.id);

/** Builds the documentary projection solely from committed MapDocument records. */
export function deriveTouchpointBusinessStructure(
  document: MapDocument,
  touchpointId: string,
): TouchpointBusinessStructure | undefined {
  const touchpoint = document.entities.find(
    (entity): entity is Touchpoint => entity.id === touchpointId && entity.kind === 'touchpoint',
  );
  if (!touchpoint) return undefined;

  const entities = new Map(document.entities.map((entity) => [entity.id, entity]));
  const offerIds = new Set(document.relationships.flatMap((relation) =>
    relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === touchpoint.id
      ? [relation.offerId]
      : [],
  ));
  const offers = [...offerIds]
    .flatMap((id) => {
      const entity = entities.get(id);
      return entity?.kind === 'offer' ? [entity] : [];
    })
    .sort(byTitleThenId);

  const ancestryBranches = offers.flatMap((offer) =>
    document.relationships.flatMap((relation) => {
      if (relation.kind !== 'product_packaged_as_offer' || relation.offerId !== offer.id) return [];
      const product = entities.get(relation.productId);
      return product?.kind === 'product' ? [{ product, offer, touchpoint }] : [];
    }),
  ).sort((left, right) => byTitleThenId(left.product, right.product) || byTitleThenId(left.offer, right.offer));

  const directTouchpoint = (id: string) => {
    const entity = entities.get(id);
    return entity?.kind === 'touchpoint' ? entity : undefined;
  };
  const parents = document.relationships.flatMap((relation) => {
    if (relation.kind !== 'touchpoint_contains_touchpoint' || relation.childTouchpointId !== touchpoint.id) return [];
    const parent = directTouchpoint(relation.parentTouchpointId);
    return parent ? [parent] : [];
  }).sort(byTitleThenId);
  const children = document.relationships.flatMap((relation) => {
    if (relation.kind !== 'touchpoint_contains_touchpoint' || relation.parentTouchpointId !== touchpoint.id) return [];
    const child = directTouchpoint(relation.childTouchpointId);
    return child ? [child] : [];
  }).sort(byTitleThenId);

  const otherTouchpointsByOffer = offers.map((offer) => ({
    offer,
    touchpoints: document.relationships.flatMap((relation) => {
      if (relation.kind !== 'offer_presented_at_touchpoint' || relation.offerId !== offer.id || relation.touchpointId === touchpoint.id) return [];
      const other = directTouchpoint(relation.touchpointId);
      return other ? [other] : [];
    }).sort(byTitleThenId),
  }));
  const container = touchpoint.locatedInId
    ? document.touchpointContainers.find((candidate) => candidate.id === touchpoint.locatedInId)
    : undefined;
  const otherTouchpointsInContainer = container
    ? document.entities.filter((entity): entity is Touchpoint =>
        entity.kind === 'touchpoint' && entity.id !== touchpoint.id && entity.locatedInId === container.id,
      ).sort(byTitleThenId)
    : [];

  return {
    touchpoint,
    ancestryBranches,
    offers,
    ...(container ? { container } : {}),
    ...(parents[0] ? { parent: parents[0] } : {}),
    children,
    otherTouchpointsByOffer,
    otherTouchpointsInContainer,
  };
}
