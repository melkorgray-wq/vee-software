export const PROVISIONAL_ENTITY_KINDS = ['customer_phenomenon', 'touchpoint', 'offer', 'product'] as const;
export type ProvisionalEntityKind = typeof PROVISIONAL_ENTITY_KINDS[number];

export const EPISTEMIC_STATUSES = ['observed', 'participant_reported', 'business_intent', 'hypothesis', 'interpretation', 'confirmed_outcome'] as const;
export type EpistemicStatus = typeof EPISTEMIC_STATUSES[number];

export type Entity =
  | { id: string; kind: 'touchpoint'; title: string; locatedIn: string }
  | { id: string; kind: Exclude<ProvisionalEntityKind, 'touchpoint'>; title: string };
export type Relationship =
  | { id: string; kind: 'product_packaged_as_offer'; productId: string; offerId: string }
  | { id: string; kind: 'offer_presented_at_touchpoint'; offerId: string; touchpointId: string };
export interface EpistemicAnnotation { id: string; subjectEntityId: string; status: EpistemicStatus; sourceNote?: string }
export interface View { id: string; title: string }
export interface Placement { viewId: string; entityId: string; x: number; y: number }
export interface MapDocument { id: string; title: string; entities: Entity[]; relationships: Relationship[]; epistemicAnnotations: EpistemicAnnotation[]; views: View[]; placements: Placement[] }

export class DomainError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'DomainError'; this.code = code; }
}

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new DomainError(`invalid_${field.toLowerCase().replaceAll(' ', '_')}`, `${field} must not be blank.`);
  return trimmed;
}
function knownStatus(status: string): asserts status is EpistemicStatus {
  if (!(EPISTEMIC_STATUSES as readonly string[]).includes(status)) throw new DomainError('unknown_epistemic_status', 'Epistemic status is not known.');
}
function finite(x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new DomainError('invalid_coordinates', 'Placement coordinates must be finite.');
}
function entityOfKind(document: MapDocument, id: string, kind: ProvisionalEntityKind, field: string) {
  const entity = document.entities.find(candidate => candidate.id === id);
  if (!entity) throw new DomainError('invalid_relationship_reference', `${field} does not reference an existing entity.`);
  if (entity.kind !== kind) throw new DomainError('invalid_relationship_endpoint', `${field} must reference a ${kind.replace('_', ' ')}.`);
}
function uniqueIds(ids: string[], field: string) {
  if (new Set(ids).size !== ids.length) throw new DomainError('duplicate_relationship_id', `${field} must be unique.`);
}

export function createEmptyMapDocument(input: { mapId: string; title: string; viewId: string; viewTitle: string }): MapDocument {
  return { id: input.mapId, title: required(input.title, 'Map title'), entities: [], relationships: [], epistemicAnnotations: [],
    views: [{ id: input.viewId, title: required(input.viewTitle, 'View title') }], placements: [] };
}

type PlacementInput = { entityId: string; title: string; viewId: string; x: number; y: number };
export type AddEntityInput = PlacementInput & (
  | { kind: 'product' | 'customer_phenomenon' }
  | { kind: 'offer'; linkedProductId: string; relationshipId: string }
  | { kind: 'touchpoint'; locatedIn: string; linkedOfferIds: string[]; relationshipIds: string[] }
);

export function addEntity(document: MapDocument, input: AddEntityInput): MapDocument {
  const title = required(input.title, 'Entity title'); finite(input.x, input.y);
  if (document.entities.some(({ id }) => id === input.entityId)) throw new DomainError('duplicate_entity_id', 'Entity ID already exists.');
  if (!document.views.some(({ id }) => id === input.viewId)) throw new DomainError('unknown_view', 'View does not exist.');
  let entity: Entity;
  let relationships: Relationship[] = [];
  if (input.kind === 'offer') {
    entityOfKind(document, input.linkedProductId, 'product', 'Linked Product');
    relationships = [{ id: input.relationshipId, kind: 'product_packaged_as_offer', productId: input.linkedProductId, offerId: input.entityId }];
    entity = { id: input.entityId, title, kind: input.kind };
  } else if (input.kind === 'touchpoint') {
    if (!input.linkedOfferIds.length) throw new DomainError('missing_linked_offer', 'A Touchpoint must present at least one Offer.');
    if (input.relationshipIds.length !== input.linkedOfferIds.length) throw new DomainError('invalid_relationship_ids', 'Each linked Offer requires a relationship ID.');
    uniqueIds(input.linkedOfferIds, 'Linked Offers'); uniqueIds(input.relationshipIds, 'Relationship IDs');
    input.linkedOfferIds.forEach(id => entityOfKind(document, id, 'offer', 'Linked Offer'));
    relationships = input.linkedOfferIds.map((offerId, index) => ({ id: input.relationshipIds[index]!, kind: 'offer_presented_at_touchpoint', offerId, touchpointId: input.entityId }));
    entity = { id: input.entityId, title, kind: input.kind, locatedIn: required(input.locatedIn, 'Located in') };
  } else entity = { id: input.entityId, title, kind: input.kind };
  const newIds = relationships.map(({ id }) => id); uniqueIds(newIds, 'Relationship IDs');
  if (relationships.some(r => document.relationships.some(existing => existing.id === r.id))) throw new DomainError('duplicate_relationship_id', 'Relationship ID already exists.');
  return { ...document, entities: [...document.entities, entity], relationships: [...document.relationships, ...relationships],
    placements: [...document.placements, { viewId: input.viewId, entityId: entity.id, x: input.x, y: input.y }] };
}

export type UpdateEntityInput = { entityId: string; title: string; locatedIn?: string; linkedProductId?: string; linkedOfferIds?: string[]; relationshipIds?: string[] };
export function updateEntity(document: MapDocument, input: UpdateEntityInput): MapDocument {
  const entity = document.entities.find(({ id }) => id === input.entityId);
  if (!entity) throw new DomainError('unknown_entity', 'Entity does not exist.');
  const title = required(input.title, 'Entity title');
  let updated: Entity = { ...entity, title };
  let relationships = document.relationships;
  if (entity.kind === 'offer') {
    if (!input.linkedProductId) throw new DomainError('missing_linked_product', 'An Offer must be linked to a Product.');
    entityOfKind(document, input.linkedProductId, 'product', 'Linked Product');
    relationships = relationships.map(r => r.kind === 'product_packaged_as_offer' && r.offerId === entity.id ? { ...r, productId: input.linkedProductId! } : r);
  } else if (entity.kind === 'touchpoint') {
    const offerIds = input.linkedOfferIds ?? [];
    if (!offerIds.length) throw new DomainError('missing_linked_offer', 'A Touchpoint must present at least one Offer.');
    uniqueIds(offerIds, 'Linked Offers'); offerIds.forEach(id => entityOfKind(document, id, 'offer', 'Linked Offer'));
    updated = { ...entity, title, locatedIn: required(input.locatedIn ?? '', 'Located in') };
    const existing = relationships.filter(r => r.kind === 'offer_presented_at_touchpoint' && r.touchpointId === entity.id);
    const ids = input.relationshipIds ?? existing.map(r => r.id);
    if (ids.length !== offerIds.length) throw new DomainError('invalid_relationship_ids', 'Each linked Offer requires a relationship ID.');
    uniqueIds(ids, 'Relationship IDs');
    const unrelated = relationships.filter(r => !(r.kind === 'offer_presented_at_touchpoint' && r.touchpointId === entity.id));
    if (ids.some(id => unrelated.some(r => r.id === id))) throw new DomainError('duplicate_relationship_id', 'Relationship ID already exists.');
    relationships = [...unrelated, ...offerIds.map((offerId, index) => ({ id: ids[index]!, kind: 'offer_presented_at_touchpoint' as const, offerId, touchpointId: entity.id }))];
  }
  return { ...document, entities: document.entities.map(candidate => candidate.id === entity.id ? updated : candidate), relationships };
}

export function updateEpistemicAnnotation(document: MapDocument, input: { subjectEntityId: string; status: string; sourceNote?: string }): MapDocument {
  knownStatus(input.status); const status: EpistemicStatus = input.status;
  if (!document.entities.some(({ id }) => id === input.subjectEntityId)) throw new DomainError('unknown_entity', 'Subject entity does not exist.');
  if (!document.epistemicAnnotations.some(({ subjectEntityId }) => subjectEntityId === input.subjectEntityId)) throw new DomainError('unknown_annotation', 'Entity annotation does not exist.');
  return { ...document, epistemicAnnotations: document.epistemicAnnotations.map(annotation => annotation.subjectEntityId === input.subjectEntityId
    ? { id: annotation.id, subjectEntityId: annotation.subjectEntityId, status, ...(input.sourceNote?.trim() ? { sourceNote: input.sourceNote.trim() } : {}) } : annotation) };
}

export function movePlacement(document: MapDocument, input: { entityId: string; viewId: string; x: number; y: number }): MapDocument {
  finite(input.x, input.y);
  if (!document.entities.some(({ id }) => id === input.entityId)) throw new DomainError('unknown_entity', 'Entity does not exist.');
  if (!document.views.some(({ id }) => id === input.viewId)) throw new DomainError('unknown_view', 'View does not exist.');
  if (!document.placements.some(p => p.entityId === input.entityId && p.viewId === input.viewId)) throw new DomainError('unknown_placement', 'Placement does not exist.');
  return { ...document, placements: document.placements.map(p => p.entityId === input.entityId && p.viewId === input.viewId ? { ...p, x: input.x, y: input.y } : p) };
}
