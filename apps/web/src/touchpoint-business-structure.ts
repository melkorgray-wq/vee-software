import { isTouchpointDescendant, type Entity, type MapDocument, type TouchpointContainer } from '@vee/domain';

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

export interface TouchpointChildrenCandidates {
  currentChildren: Touchpoint[];
  standaloneBranches: { touchpoint: Touchpoint; childCount: number }[];
  standaloneLeaves: { touchpoint: Touchpoint; childCount: number }[];
}

/** Presentation helper for the initial density of compact overview disclosures. */
export function initialCompactOverviewExpandedGroupIds(
  groups: readonly { id: string; count: number }[],
): Set<string> {
  if (groups.length === 1 && groups[0]!.count <= 4) return new Set([groups[0]!.id]);
  if (groups.length === 2 && groups.every((group) => group.count <= 4) && groups[0]!.count + groups[1]!.count <= 6) {
    return new Set(groups.map((group) => group.id));
  }
  return new Set();
}

export function deriveTouchpointChildrenCandidates(document: MapDocument, parentTouchpointId: string): TouchpointChildrenCandidates {
  const touchpoints = document.entities.filter((entity): entity is Touchpoint => entity.kind === 'touchpoint');
  const parentByChild = new Map(document.relationships.flatMap(relation => relation.kind === 'touchpoint_contains_touchpoint' ? [[relation.childTouchpointId, relation.parentTouchpointId] as const] : []));
  const childCount = (id: string) => document.relationships.filter(relation => relation.kind === 'touchpoint_contains_touchpoint' && relation.parentTouchpointId === id).length;
  const currentChildren = touchpoints.filter(touchpoint => parentByChild.get(touchpoint.id) === parentTouchpointId).sort(byTitleThenId);
  const available = touchpoints.filter(touchpoint => touchpoint.id !== parentTouchpointId && !parentByChild.has(touchpoint.id) && !isTouchpointDescendant(document, touchpoint.id, parentTouchpointId))
    .map(touchpoint => ({ touchpoint, childCount: childCount(touchpoint.id) })).sort((left, right) => byTitleThenId(left.touchpoint, right.touchpoint));
  return { currentChildren, standaloneBranches: available.filter(item => item.childCount > 0), standaloneLeaves: available.filter(item => item.childCount === 0) };
}

export function deriveTouchpointReassignTargets(document: MapDocument, movedTouchpointIds: string[], currentParentId: string): Touchpoint[] {
  return document.entities.filter((entity): entity is Touchpoint => entity.kind === 'touchpoint')
    .filter(entity => entity.id !== currentParentId && !movedTouchpointIds.includes(entity.id) && movedTouchpointIds.every(id => !isTouchpointDescendant(document, id, entity.id)))
    .sort(byTitleThenId);
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
