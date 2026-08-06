export const PROVISIONAL_ENTITY_KINDS = [
  'customer_phenomenon', 'touchpoint', 'offer', 'product',
] as const;

export type ProvisionalEntityKind = typeof PROVISIONAL_ENTITY_KINDS[number];

export const EPISTEMIC_STATUSES = [
  'observed', 'participant_reported', 'business_intent', 'hypothesis',
  'interpretation', 'confirmed_outcome',
] as const;

export type EpistemicStatus = typeof EPISTEMIC_STATUSES[number];
export interface Entity { id: string; kind: ProvisionalEntityKind; title: string }
export interface EpistemicAnnotation {
  id: string;
  subjectEntityId: string;
  status: EpistemicStatus;
  sourceNote?: string;
}
export interface View { id: string; title: string }
export interface Placement { viewId: string; entityId: string; x: number; y: number }
export interface MapDocument {
  id: string;
  title: string;
  entities: Entity[];
  epistemicAnnotations: EpistemicAnnotation[];
  views: View[];
  placements: Placement[];
}

export class DomainError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'DomainError'; this.code = code; }
}

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new DomainError('invalid_title', `${field} must not be blank.`);
  return trimmed;
}
function knownKind(kind: string): asserts kind is ProvisionalEntityKind {
  if (!(PROVISIONAL_ENTITY_KINDS as readonly string[]).includes(kind))
    throw new DomainError('unknown_entity_kind', 'Entity kind is not a known provisional kind.');
}
function knownStatus(status: string): asserts status is EpistemicStatus {
  if (!(EPISTEMIC_STATUSES as readonly string[]).includes(status))
    throw new DomainError('unknown_epistemic_status', 'Epistemic status is not known.');
}
function finite(x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw new DomainError('invalid_coordinates', 'Placement coordinates must be finite.');
}

export function createEmptyMapDocument(input: { mapId: string; title: string; viewId: string; viewTitle: string }): MapDocument {
  return { id: input.mapId, title: required(input.title, 'Map title'), entities: [], epistemicAnnotations: [],
    views: [{ id: input.viewId, title: required(input.viewTitle, 'View title') }], placements: [] };
}

export function addEntity(document: MapDocument, input: {
  entityId: string; title: string; kind: string; annotationId: string; status: string;
  sourceNote?: string; viewId: string; x: number; y: number;
}): MapDocument {
  const title = required(input.title, 'Entity title'); knownKind(input.kind); knownStatus(input.status); finite(input.x, input.y);
  if (document.entities.some(({ id }) => id === input.entityId)) throw new DomainError('duplicate_entity_id', 'Entity ID already exists.');
  if (document.epistemicAnnotations.some(({ id }) => id === input.annotationId)) throw new DomainError('duplicate_annotation_id', 'Annotation ID already exists.');
  if (!document.views.some(({ id }) => id === input.viewId)) throw new DomainError('unknown_view', 'View does not exist.');
  const entity: Entity = { id: input.entityId, title, kind: input.kind };
  // One annotation per created entity is a provisional spike assumption, not a final ontology decision.
  const annotation: EpistemicAnnotation = { id: input.annotationId, subjectEntityId: entity.id, status: input.status,
    ...(input.sourceNote?.trim() ? { sourceNote: input.sourceNote.trim() } : {}) };
  return { ...document, entities: [...document.entities, entity], epistemicAnnotations: [...document.epistemicAnnotations, annotation],
    placements: [...document.placements, { viewId: input.viewId, entityId: entity.id, x: input.x, y: input.y }] };
}

export function updateEntity(document: MapDocument, input: { entityId: string; title: string; kind: string }): MapDocument {
  const title = required(input.title, 'Entity title'); knownKind(input.kind);
  const kind: ProvisionalEntityKind = input.kind;
  if (!document.entities.some(({ id }) => id === input.entityId)) throw new DomainError('unknown_entity', 'Entity does not exist.');
  return { ...document, entities: document.entities.map(entity => entity.id === input.entityId ? { ...entity, title, kind } : entity) };
}

export function updateEpistemicAnnotation(document: MapDocument, input: { subjectEntityId: string; status: string; sourceNote?: string }): MapDocument {
  knownStatus(input.status);
  const status: EpistemicStatus = input.status;
  if (!document.entities.some(({ id }) => id === input.subjectEntityId)) throw new DomainError('unknown_entity', 'Subject entity does not exist.');
  if (!document.epistemicAnnotations.some(({ subjectEntityId }) => subjectEntityId === input.subjectEntityId))
    throw new DomainError('unknown_annotation', 'Entity annotation does not exist.');
  return { ...document, epistemicAnnotations: document.epistemicAnnotations.map(annotation => annotation.subjectEntityId === input.subjectEntityId
    ? { id: annotation.id, subjectEntityId: annotation.subjectEntityId, status,
      ...(input.sourceNote?.trim() ? { sourceNote: input.sourceNote.trim() } : {}) }
    : annotation) };
}

export function movePlacement(document: MapDocument, input: { entityId: string; viewId: string; x: number; y: number }): MapDocument {
  finite(input.x, input.y);
  if (!document.entities.some(({ id }) => id === input.entityId)) throw new DomainError('unknown_entity', 'Entity does not exist.');
  if (!document.views.some(({ id }) => id === input.viewId)) throw new DomainError('unknown_view', 'View does not exist.');
  if (!document.placements.some(p => p.entityId === input.entityId && p.viewId === input.viewId))
    throw new DomainError('unknown_placement', 'Placement does not exist.');
  return { ...document, placements: document.placements.map(p => p.entityId === input.entityId && p.viewId === input.viewId ? { ...p, x: input.x, y: input.y } : p) };
}
