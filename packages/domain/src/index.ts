export const BUSINESS_ENTITY_KINDS = ['product', 'offer', 'touchpoint'] as const;
export const CLIENT_ROOT_ENTITY_KINDS = ['core_functional_job', 'emotional_job', 'social_job', 'consumption_chain_job', 'financial_desired_outcome'] as const;
export const PROVISIONAL_ENTITY_KINDS = [...BUSINESS_ENTITY_KINDS, ...CLIENT_ROOT_ENTITY_KINDS] as const;
export type ProvisionalEntityKind = typeof PROVISIONAL_ENTITY_KINDS[number];
export type ClientRootEntityKind = typeof CLIENT_ROOT_ENTITY_KINDS[number];
export function isClientRootEntityKind(kind: ProvisionalEntityKind): kind is ClientRootEntityKind { return (CLIENT_ROOT_ENTITY_KINDS as readonly string[]).includes(kind); }
export const EPISTEMIC_STATUSES = ['observed', 'participant_reported', 'business_intent', 'hypothesis', 'interpretation', 'confirmed_outcome'] as const;
export type EpistemicStatus = typeof EPISTEMIC_STATUSES[number];

export type Entity =
  | { id: string; kind: 'touchpoint'; title: string; locatedInId: string; url?: string }
  | { id: string; kind: 'product'; title: string }
  | { id: string; kind: 'offer'; title: string }
  | { id: string; kind: ClientRootEntityKind; title: string };
export type Relationship =
  | { id: string; kind: 'product_packaged_as_offer'; productId: string; offerId: string }
  | { id: string; kind: 'offer_presented_at_touchpoint'; offerId: string; touchpointId: string }
  | { id: string; kind: 'touchpoint_contains_touchpoint'; parentTouchpointId: string; childTouchpointId: string };
export interface TouchpointContainer { id: string; title: string }
export interface EpistemicAnnotation { id: string; subjectEntityId: string; status: EpistemicStatus; sourceNote?: string }
export interface View { id: string; title: string }
export interface Placement { viewId: string; entityId: string; x: number; y: number }
export interface MapDocument { id: string; title: string; entities: Entity[]; relationships: Relationship[]; touchpointContainers: TouchpointContainer[]; epistemicAnnotations: EpistemicAnnotation[]; views: View[]; placements: Placement[] }

export class DomainError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'DomainError'; this.code = code; }
}
function required(value: string, field: string): string { const trimmed = value.trim(); if (!trimmed) throw new DomainError(`invalid_${field.toLowerCase().replaceAll(' ', '_')}`, `${field} must not be blank.`); return trimmed; }
function optional(value?: string): string | undefined { const trimmed = value?.trim(); return trimmed || undefined; }
function finite(x: number, y: number) { if (!Number.isFinite(x) || !Number.isFinite(y)) throw new DomainError('invalid_coordinates', 'Placement coordinates must be finite.'); }
function entityOfKind(document: MapDocument, id: string, kind: ProvisionalEntityKind, field: string): Entity {
  const entity = document.entities.find(candidate => candidate.id === id);
  if (!entity) throw new DomainError('invalid_relationship_reference', `${field} does not reference an existing entity.`);
  if (entity.kind !== kind) throw new DomainError('invalid_relationship_endpoint', `${field} must reference a ${kind.replace('_', ' ')}.`);
  return entity;
}
function unique(ids: string[], code = 'duplicate_relationship_id') { if (new Set(ids).size !== ids.length) throw new DomainError(code, 'IDs must be unique.'); }
function assertContainer(document: MapDocument, id: string) { if (!document.touchpointContainers.some(container => container.id === id)) throw new DomainError('invalid_touchpoint_container', 'Located in must reference an existing Touchpoint container.'); }
function assertRelationshipIds(document: MapDocument, ids: string[], ignored: string[] = []) { unique(ids); if (ids.some(id => document.relationships.some(r => r.id === id && !ignored.includes(r.id)))) throw new DomainError('duplicate_relationship_id', 'Relationship ID already exists.'); }

export function createEmptyMapDocument(input: { mapId: string; title: string; viewId: string; viewTitle: string }): MapDocument {
  return { id: input.mapId, title: required(input.title, 'Map title'), entities: [], relationships: [], touchpointContainers: [], epistemicAnnotations: [], views: [{ id: input.viewId, title: required(input.viewTitle, 'View title') }], placements: [] };
}
export function addTouchpointContainer(document: MapDocument, input: { id: string; title: string }): MapDocument {
  if (document.touchpointContainers.some(c => c.id === input.id)) throw new DomainError('duplicate_touchpoint_container_id', 'Touchpoint container ID already exists.');
  const title = required(input.title, 'Touchpoint container title');
  const normalized = title.toLocaleLowerCase();
  if (document.touchpointContainers.some(c => c.title.trim().toLocaleLowerCase() === normalized)) throw new DomainError('duplicate_touchpoint_container_title', 'A matching Touchpoint container already exists.');
  return { ...document, touchpointContainers: [...document.touchpointContainers, { id: input.id, title }] };
}

type PlacementInput = { entityId: string; title: string; viewId: string; x: number; y: number };
export type AddEntityInput = PlacementInput & (
  | { kind: 'product' | ClientRootEntityKind }
  | { kind: 'offer'; linkedProductId: string; relationshipId: string }
  | { kind: 'touchpoint'; locatedInId: string; url?: string; linkedOfferIds: string[]; relationshipIds: string[]; parentTouchpointId?: string; parentRelationshipId?: string }
);
export function addEntity(document: MapDocument, input: AddEntityInput): MapDocument {
  const title = required(input.title, 'Entity title'); finite(input.x, input.y);
  if (document.entities.some(e => e.id === input.entityId)) throw new DomainError('duplicate_entity_id', 'Entity ID already exists.');
  if (!document.views.some(v => v.id === input.viewId)) throw new DomainError('unknown_view', 'View does not exist.');
  let entity: Entity; let added: Relationship[] = [];
  if (input.kind === 'offer') {
    entityOfKind(document, input.linkedProductId, 'product', 'Linked Product');
    added = [{ id: input.relationshipId, kind: 'product_packaged_as_offer', productId: input.linkedProductId, offerId: input.entityId }];
    entity = { id: input.entityId, title, kind: 'offer' };
  } else if (input.kind === 'touchpoint') {
    assertContainer(document, input.locatedInId);
    if (!input.linkedOfferIds.length) throw new DomainError('missing_linked_offer', 'A Touchpoint must present at least one Offer.');
    unique(input.linkedOfferIds, 'duplicate_linked_offer');
    if (input.relationshipIds.length !== input.linkedOfferIds.length) throw new DomainError('invalid_relationship_ids', 'Each linked Offer requires a relationship ID.');
    input.linkedOfferIds.forEach(id => entityOfKind(document, id, 'offer', 'Linked Offer'));
    added = input.linkedOfferIds.map((offerId, index) => ({ id: input.relationshipIds[index]!, kind: 'offer_presented_at_touchpoint', offerId, touchpointId: input.entityId }));
    if (input.parentTouchpointId) {
      entityOfKind(document, input.parentTouchpointId, 'touchpoint', 'Parent Touchpoint');
      if (!input.parentRelationshipId) throw new DomainError('missing_parent_relationship_id', 'A parent relationship ID is required.');
      added.push({ id: input.parentRelationshipId, kind: 'touchpoint_contains_touchpoint', parentTouchpointId: input.parentTouchpointId, childTouchpointId: input.entityId });
    }
    const url = optional(input.url); entity = { id: input.entityId, title, kind: 'touchpoint', locatedInId: input.locatedInId, ...(url ? { url } : {}) };
  } else entity = { id: input.entityId, title, kind: input.kind };
  assertRelationshipIds(document, added.map(r => r.id));
  return { ...document, entities: [...document.entities, entity], relationships: [...document.relationships, ...added], placements: [...document.placements, { viewId: input.viewId, entityId: entity.id, x: input.x, y: input.y }] };
}

function createsCycle(document: MapDocument, parentId: string, childId: string): boolean {
  const children = new Map<string, string[]>();
  for (const r of document.relationships) if (r.kind === 'touchpoint_contains_touchpoint') children.set(r.parentTouchpointId, [...(children.get(r.parentTouchpointId) ?? []), r.childTouchpointId]);
  const pending = [childId]; const seen = new Set<string>();
  while (pending.length) { const id = pending.pop()!; if (id === parentId) return true; if (!seen.has(id)) { seen.add(id); pending.push(...(children.get(id) ?? [])); } }
  return false;
}
export type UpdateEntityInput = { entityId: string; title: string; locatedInId?: string; url?: string; linkedProductId?: string; linkedOfferIds?: string[]; relationshipIds?: string[]; parentTouchpointId?: string; parentRelationshipId?: string };
export function updateEntity(document: MapDocument, input: UpdateEntityInput): MapDocument {
  const entity = document.entities.find(e => e.id === input.entityId); if (!entity) throw new DomainError('unknown_entity', 'Entity does not exist.');
  const title = required(input.title, 'Entity title'); let updated: Entity = { ...entity, title }; let relationships = document.relationships;
  if (entity.kind === 'offer') {
    if (!input.linkedProductId) throw new DomainError('missing_linked_product', 'An Offer must be linked to a Product.'); entityOfKind(document, input.linkedProductId, 'product', 'Linked Product');
    relationships = relationships.map(r => r.kind === 'product_packaged_as_offer' && r.offerId === entity.id ? { ...r, productId: input.linkedProductId! } : r);
  } else if (entity.kind === 'touchpoint') {
    assertContainer(document, input.locatedInId ?? '');
    const offerIds = input.linkedOfferIds ?? []; if (!offerIds.length) throw new DomainError('missing_linked_offer', 'A Touchpoint must present at least one Offer.'); unique(offerIds); offerIds.forEach(id => entityOfKind(document, id, 'offer', 'Linked Offer'));
    const url = optional(input.url); updated = { id: entity.id, kind: 'touchpoint', title, locatedInId: input.locatedInId!, ...(url ? { url } : {}) };
    const oldOffers = relationships.filter(r => r.kind === 'offer_presented_at_touchpoint' && r.touchpointId === entity.id);
    const ids = input.relationshipIds ?? oldOffers.map(r => r.id); if (ids.length !== offerIds.length) throw new DomainError('invalid_relationship_ids', 'Each linked Offer requires a relationship ID.');
    const oldParent = relationships.find(r => r.kind === 'touchpoint_contains_touchpoint' && r.childTouchpointId === entity.id);
    const ignored = [...oldOffers.map(r => r.id), ...(oldParent ? [oldParent.id] : [])]; assertRelationshipIds(document, [...ids, ...(input.parentTouchpointId ? [input.parentRelationshipId ?? oldParent?.id ?? ''] : [])], ignored);
    relationships = relationships.filter(r => !(r.kind === 'offer_presented_at_touchpoint' && r.touchpointId === entity.id) && !(r.kind === 'touchpoint_contains_touchpoint' && r.childTouchpointId === entity.id));
    relationships.push(...offerIds.map((offerId, index) => ({ id: ids[index]!, kind: 'offer_presented_at_touchpoint' as const, offerId, touchpointId: entity.id })));
    if (input.parentTouchpointId) {
      entityOfKind(document, input.parentTouchpointId, 'touchpoint', 'Parent Touchpoint');
      if (input.parentTouchpointId === entity.id) throw new DomainError('self_parent', 'A Touchpoint cannot contain itself.');
      if (createsCycle({ ...document, relationships }, input.parentTouchpointId, entity.id)) throw new DomainError('structural_cycle', 'Touchpoint containment cannot form a cycle.');
      relationships.push({ id: input.parentRelationshipId ?? oldParent?.id ?? '', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: input.parentTouchpointId, childTouchpointId: entity.id });
    }
  }
  return { ...document, entities: document.entities.map(e => e.id === entity.id ? updated : e), relationships };
}

export function duplicateEntity(document: MapDocument, input: { sourceEntityId: string; entityId: string; viewId: string; x: number; y: number; relationshipIds: string[] }): MapDocument {
  const source = document.entities.find(e => e.id === input.sourceEntityId); if (!source) throw new DomainError('unknown_entity', 'Source entity does not exist.');
  if (source.kind === 'product' || isClientRootEntityKind(source.kind)) return addEntity(document, { entityId: input.entityId, title: source.title, kind: source.kind, viewId: input.viewId, x: input.x, y: input.y });
  if (source.kind === 'offer') { const relation = document.relationships.find((r): r is Extract<Relationship, { kind: 'product_packaged_as_offer' }> => r.kind === 'product_packaged_as_offer' && r.offerId === source.id)!; return addEntity(document, { entityId: input.entityId, title: source.title, kind: 'offer', linkedProductId: relation.productId, relationshipId: input.relationshipIds[0]!, viewId: input.viewId, x: input.x, y: input.y }); }
  if (source.kind !== 'touchpoint') throw new DomainError('unsupported_entity_kind', 'Source entity kind cannot be duplicated.');
  const offerIds = document.relationships.filter((r): r is Extract<Relationship, { kind: 'offer_presented_at_touchpoint' }> => r.kind === 'offer_presented_at_touchpoint' && r.touchpointId === source.id).map(r => r.offerId);
  const parent = document.relationships.find((r): r is Extract<Relationship, { kind: 'touchpoint_contains_touchpoint' }> => r.kind === 'touchpoint_contains_touchpoint' && r.childTouchpointId === source.id);
  return addEntity(document, { entityId: input.entityId, title: source.title, kind: 'touchpoint', locatedInId: source.locatedInId, ...(source.url ? { url: source.url } : {}), linkedOfferIds: offerIds, relationshipIds: input.relationshipIds.slice(0, offerIds.length), ...(parent ? { parentTouchpointId: parent.parentTouchpointId, parentRelationshipId: input.relationshipIds[offerIds.length]! } : {}), viewId: input.viewId, x: input.x, y: input.y });
}
export function movePlacement(document: MapDocument, input: { entityId: string; viewId: string; x: number; y: number }): MapDocument { finite(input.x, input.y); if (!document.entities.some(e => e.id === input.entityId)) throw new DomainError('unknown_entity', 'Entity does not exist.'); if (!document.placements.some(p => p.entityId === input.entityId && p.viewId === input.viewId)) throw new DomainError('unknown_placement', 'Placement does not exist.'); return { ...document, placements: document.placements.map(p => p.entityId === input.entityId && p.viewId === input.viewId ? { ...p, x: input.x, y: input.y } : p) }; }
