export const BUSINESS_ENTITY_KINDS = ['product', 'offer', 'touchpoint'] as const;
export const CLIENT_ROOT_ENTITY_KINDS = ['core_functional_job', 'emotional_job', 'social_job', 'consumption_chain_job', 'financial_desired_outcome'] as const;
export const CONTEXTUAL_CLIENT_ENTITY_KINDS = ['related_job', 'desired_outcome'] as const;
export const REPULSOR_ENTITY_KINDS = ['repulsor'] as const;
export const PROVISIONAL_ENTITY_KINDS = [...BUSINESS_ENTITY_KINDS, ...CLIENT_ROOT_ENTITY_KINDS, ...CONTEXTUAL_CLIENT_ENTITY_KINDS, ...REPULSOR_ENTITY_KINDS] as const;
export type ProvisionalEntityKind = typeof PROVISIONAL_ENTITY_KINDS[number];
export type ClientRootEntityKind = typeof CLIENT_ROOT_ENTITY_KINDS[number];
export type ContextualClientEntityKind = typeof CONTEXTUAL_CLIENT_ENTITY_KINDS[number];
export type RepulsorEntityKind = typeof REPULSOR_ENTITY_KINDS[number];
export function isClientRootEntityKind(kind: ProvisionalEntityKind): kind is ClientRootEntityKind { return (CLIENT_ROOT_ENTITY_KINDS as readonly string[]).includes(kind); }
export function isContextualClientEntityKind(kind: ProvisionalEntityKind): kind is ContextualClientEntityKind { return (CONTEXTUAL_CLIENT_ENTITY_KINDS as readonly string[]).includes(kind); }
export const REPULSOR_TARGET_KINDS = ['core_functional_job', 'related_job', 'emotional_job', 'social_job', 'consumption_chain_job', 'financial_desired_outcome'] as const;
export type RepulsorTargetKind = typeof REPULSOR_TARGET_KINDS[number];
export function isRepulsorTargetKind(kind: ProvisionalEntityKind): kind is RepulsorTargetKind { return (REPULSOR_TARGET_KINDS as readonly string[]).includes(kind); }
export const EPISTEMIC_STATUSES = ['observed', 'participant_reported', 'business_intent', 'hypothesis', 'interpretation', 'confirmed_outcome'] as const;
export type EpistemicStatus = typeof EPISTEMIC_STATUSES[number];

export type Entity =
  | { id: string; kind: 'touchpoint'; title: string; locatedInId: string; url?: string }
  | { id: string; kind: 'product'; title: string }
  | { id: string; kind: 'offer'; title: string }
  | { id: string; kind: ClientRootEntityKind | ContextualClientEntityKind | RepulsorEntityKind; title: string };
export type Relationship =
  | { id: string; kind: 'product_packaged_as_offer'; productId: string; offerId: string }
  | { id: string; kind: 'offer_presented_at_touchpoint'; offerId: string; touchpointId: string }
  | { id: string; kind: 'touchpoint_contains_touchpoint'; parentTouchpointId: string; childTouchpointId: string }
  | { id: string; kind: 'core_functional_job_has_related_job'; coreFunctionalJobId: string; relatedJobId: string }
  | { id: string; kind: 'job_has_desired_outcome'; jobId: string; desiredOutcomeId: string }
  | { id: string; kind: 'core_functional_job_contextualizes_job'; coreFunctionalJobId: string; contextualJobId: string }
  | { id: string; kind: 'repulsor_resists'; repulsorId: string; targetEntityId: string }
  | { id: string; kind: 'touchpoint_mitigates_repulsor'; touchpointId: string; repulsorId: string };
export interface TouchpointContainer { id: string; title: string }
export interface EpistemicAnnotation { id: string; subjectEntityId: string; status: EpistemicStatus; sourceNote?: string }
export interface View { id: string; title: string }
export interface Placement { viewId: string; entityId: string; x: number; y: number }
export interface ProductJobIntent { id: string; productId: string; jobId: string; addressedDesiredOutcomeIds: string[] }
export interface OfferJobSelection { id: string; offerId: string; productJobIntentId: string }
export interface OfferFinancialIntent { id: string; offerId: string; financialDesiredOutcomeId: string }
export interface TouchpointJobSelection { id: string; touchpointId: string; offerId: string; productJobIntentId: string; addressedDesiredOutcomeIds: string[] }
export interface TouchpointFinancialSelection { id: string; touchpointId: string; offerId: string; offerFinancialIntentId: string; financialDesiredOutcomeId: string }
export interface MapDocument { id: string; title: string; entities: Entity[]; relationships: Relationship[]; productJobIntents: ProductJobIntent[]; offerJobSelections: OfferJobSelection[]; offerFinancialIntents: OfferFinancialIntent[]; touchpointJobSelections: TouchpointJobSelection[]; touchpointFinancialSelections: TouchpointFinancialSelection[]; touchpointContainers: TouchpointContainer[]; epistemicAnnotations: EpistemicAnnotation[]; views: View[]; placements: Placement[] }

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
function assertRepulsorTargets(document: MapDocument, targetEntityIds: string[]) {
  if (!targetEntityIds.length) throw new DomainError('missing_repulsor_target', 'A Repulsor must resist at least one Client phenomenon.');
  unique(targetEntityIds, 'duplicate_repulsor_target');
  for (const id of targetEntityIds) {
    const target = document.entities.find(entity => entity.id === id);
    if (!target) throw new DomainError('invalid_relationship_reference', 'Repulsor target does not reference an existing entity.');
    if (!isRepulsorTargetKind(target.kind)) throw new DomainError('invalid_relationship_endpoint', 'Repulsor target must reference an eligible Client-side Job or Financial Desired Outcome.');
  }
}

export function createEmptyMapDocument(input: { mapId: string; title: string; viewId: string; viewTitle: string }): MapDocument {
  return { id: input.mapId, title: required(input.title, 'Map title'), entities: [], relationships: [], productJobIntents: [], offerJobSelections: [], offerFinancialIntents: [], touchpointJobSelections: [], touchpointFinancialSelections: [], touchpointContainers: [], epistemicAnnotations: [], views: [{ id: input.viewId, title: required(input.viewTitle, 'View title') }], placements: [] };
}

const PRODUCT_JOB_KINDS = ['core_functional_job', 'related_job', 'emotional_job', 'social_job', 'consumption_chain_job'] as const;
function validateProductJobIntent(document: MapDocument, input: { productId: string; jobId: string; addressedDesiredOutcomeIds: string[] }, ignoredId?: string) {
  entityOfKind(document, input.productId, 'product', 'Product');
  const job = document.entities.find(entity => entity.id === input.jobId);
  if (!job) throw new DomainError('invalid_product_job_reference', 'Job does not reference an existing entity.');
  if (!(PRODUCT_JOB_KINDS as readonly string[]).includes(job.kind)) throw new DomainError('invalid_product_job_kind', 'Product intent must reference an eligible Client Job.');
  if (document.productJobIntents.some(intent => intent.id !== ignoredId && intent.productId === input.productId && intent.jobId === input.jobId)) throw new DomainError('duplicate_product_job_intent', 'A Product may address a Job only once.');
  unique(input.addressedDesiredOutcomeIds, 'duplicate_addressed_desired_outcome');
  if (!['core_functional_job', 'related_job', 'consumption_chain_job'].includes(job.kind) && input.addressedDesiredOutcomeIds.length) throw new DomainError('desired_outcome_not_allowed', 'This Job kind cannot select Desired Outcomes.');
  for (const outcomeId of input.addressedDesiredOutcomeIds) {
    entityOfKind(document, outcomeId, 'desired_outcome', 'Addressed Desired Outcome');
    if (!document.relationships.some(relation => relation.kind === 'job_has_desired_outcome' && relation.jobId === job.id && relation.desiredOutcomeId === outcomeId)) throw new DomainError('desired_outcome_not_owned_by_job', 'Every addressed Desired Outcome must belong to the selected Job.');
  }
}
export function addProductJobIntent(document: MapDocument, input: ProductJobIntent): MapDocument {
  if (document.productJobIntents.some(intent => intent.id === input.id)) throw new DomainError('duplicate_product_job_intent_id', 'Product Job Intent ID already exists.');
  validateProductJobIntent(document, input);
  return { ...document, productJobIntents: [...document.productJobIntents, { ...input, addressedDesiredOutcomeIds: [...input.addressedDesiredOutcomeIds] }] };
}
export function updateProductJobIntent(document: MapDocument, input: ProductJobIntent): MapDocument {
  if (!document.productJobIntents.some(intent => intent.id === input.id)) throw new DomainError('unknown_product_job_intent', 'Product Job Intent does not exist.');
  validateProductJobIntent(document, input, input.id);
  return pruneIrrelevantTouchpointMitigations({ ...document, productJobIntents: document.productJobIntents.map(intent => intent.id === input.id ? { ...input, addressedDesiredOutcomeIds: [...input.addressedDesiredOutcomeIds] } : intent) });
}
export function removeProductJobIntent(document: MapDocument, intentId: string): MapDocument {
  if (!document.productJobIntents.some(intent => intent.id === intentId)) throw new DomainError('unknown_product_job_intent', 'Product Job Intent does not exist.');
  return pruneIrrelevantTouchpointMitigations({ ...document, productJobIntents: document.productJobIntents.filter(intent => intent.id !== intentId), offerJobSelections: document.offerJobSelections.filter(selection => selection.productJobIntentId !== intentId), touchpointJobSelections: document.touchpointJobSelections.filter(selection => selection.productJobIntentId !== intentId) });
}
export function setOfferJobSelections(document: MapDocument, input: { offerId: string; productJobIntentIds: string[]; newSelectionIds: string[] }): MapDocument {
  entityOfKind(document, input.offerId, 'offer', 'Offer'); unique(input.productJobIntentIds, 'duplicate_offer_job_selection');
  const productId = document.relationships.find((relation): relation is Extract<Relationship, { kind: 'product_packaged_as_offer' }> => relation.kind === 'product_packaged_as_offer' && relation.offerId === input.offerId)?.productId;
  for (const intentId of input.productJobIntentIds) if (!document.productJobIntents.some(intent => intent.id === intentId && intent.productId === productId)) throw new DomainError('offer_selection_wrong_product', 'Offer selections must belong to the Offer Product.');
  const existing = document.offerJobSelections.filter(selection => selection.offerId === input.offerId); const retained = new Map(existing.map(selection => [selection.productJobIntentId, selection]));
  const additions = input.productJobIntentIds.filter(id => !retained.has(id));
  if (additions.length !== input.newSelectionIds.length) throw new DomainError('invalid_offer_selection_ids', 'Each new Offer selection requires a fresh ID.');
  unique(input.newSelectionIds, 'duplicate_offer_job_selection_id');
  if (input.newSelectionIds.some(id => document.offerJobSelections.some(selection => selection.id === id))) throw new DomainError('duplicate_offer_job_selection_id', 'Offer Job Selection ID already exists.');
  const replacement = input.productJobIntentIds.map(id => retained.get(id) ?? { id: input.newSelectionIds[additions.indexOf(id)]!, offerId: input.offerId, productJobIntentId: id });
  const retainedIntentIds = new Set(replacement.map(selection => selection.productJobIntentId));
  return pruneIrrelevantTouchpointMitigations({ ...document, offerJobSelections: [...document.offerJobSelections.filter(selection => selection.offerId !== input.offerId), ...replacement], touchpointJobSelections: document.touchpointJobSelections.filter(selection => selection.offerId !== input.offerId || retainedIntentIds.has(selection.productJobIntentId)) });
}

export function setOfferFinancialIntents(document: MapDocument, input: { offerId: string; financialDesiredOutcomeIds: string[]; newIntentIds: string[] }): MapDocument {
  entityOfKind(document, input.offerId, 'offer', 'Offer');
  unique(input.financialDesiredOutcomeIds, 'duplicate_offer_financial_intent');
  input.financialDesiredOutcomeIds.forEach(id => entityOfKind(document, id, 'financial_desired_outcome', 'Financial Desired Outcome'));
  const existing = document.offerFinancialIntents.filter(intent => intent.offerId === input.offerId);
  const retained = new Map(existing.map(intent => [intent.financialDesiredOutcomeId, intent]));
  const additions = input.financialDesiredOutcomeIds.filter(id => !retained.has(id));
  if (additions.length !== input.newIntentIds.length) throw new DomainError('invalid_offer_financial_intent_ids', 'Each new Financial Desired Outcome intent requires a fresh ID.');
  unique(input.newIntentIds, 'duplicate_offer_financial_intent_id');
  if (input.newIntentIds.some(id => document.offerFinancialIntents.some(intent => intent.id === id))) throw new DomainError('duplicate_offer_financial_intent_id', 'Offer Financial Intent ID already exists.');
  const replacement = input.financialDesiredOutcomeIds.map(id => retained.get(id) ?? { id: input.newIntentIds[additions.indexOf(id)]!, offerId: input.offerId, financialDesiredOutcomeId: id });
  const retainedIds = new Set(replacement.map(intent => intent.id));
  return { ...document, offerFinancialIntents: [...document.offerFinancialIntents.filter(intent => intent.offerId !== input.offerId), ...replacement], touchpointFinancialSelections: document.touchpointFinancialSelections.filter(selection => selection.offerId !== input.offerId || retainedIds.has(selection.offerFinancialIntentId)) };
}

function linkedOfferIds(document: MapDocument, touchpointId: string): Set<string> {
  entityOfKind(document, touchpointId, 'touchpoint', 'Touchpoint');
  return new Set(document.relationships.flatMap(relation => relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === touchpointId ? [relation.offerId] : []));
}
function productForOffer(document: MapDocument, offerId: string): string {
  entityOfKind(document, offerId, 'offer', 'Contributing Offer');
  const productId = document.relationships.find((relation): relation is Extract<Relationship, { kind: 'product_packaged_as_offer' }> => relation.kind === 'product_packaged_as_offer' && relation.offerId === offerId)?.productId;
  if (!productId) throw new DomainError('offer_without_product', 'A contributing Offer must belong to a Product.');
  return productId;
}
function validateTouchpointOutcomeScope(document: MapDocument, intent: ProductJobIntent, outcomeIds: string[]): void {
  unique(outcomeIds, 'duplicate_touchpoint_desired_outcome');
  const job = document.entities.find(entity => entity.id === intent.jobId)!;
  if ((job.kind === 'emotional_job' || job.kind === 'social_job') && outcomeIds.length) throw new DomainError('desired_outcome_not_allowed', 'Emotional and Social Jobs cannot have a Desired Outcome subset.');
  const upstream = new Set(intent.addressedDesiredOutcomeIds);
  for (const outcomeId of outcomeIds) {
    entityOfKind(document, outcomeId, 'desired_outcome', 'Touchpoint Desired Outcome');
    if (!document.relationships.some(relation => relation.kind === 'job_has_desired_outcome' && relation.jobId === intent.jobId && relation.desiredOutcomeId === outcomeId)) throw new DomainError('desired_outcome_not_owned_by_job', 'A Touchpoint outcome must belong to the selected Job.');
    if (!upstream.has(outcomeId)) throw new DomainError('touchpoint_outcome_outside_upstream_scope', 'A Touchpoint outcome must be present in Product intent scope.');
  }
}
function assertFreshRecordIds(document: MapDocument, ids: string[]): void {
  unique(ids, 'duplicate_selection_id');
  const used = new Set([...document.productJobIntents, ...document.offerJobSelections, ...document.offerFinancialIntents, ...document.touchpointJobSelections, ...document.touchpointFinancialSelections].map(record => record.id));
  if (ids.some(id => used.has(id))) throw new DomainError('duplicate_selection_id', 'A generated record ID is already in use.');
}

export type TouchpointTopDownSelection =
  | { id: string; kind: 'job'; offerId: string; productJobIntentId: string; addressedDesiredOutcomeIds: string[] }
  | { id: string; kind: 'financial'; offerId: string; offerFinancialIntentId: string };

/** Replaces the authored local scope; upstream Product and Offer intent is never mutated. */
export function setTouchpointIntentSelections(document: MapDocument, input: { touchpointId: string; selections: TouchpointTopDownSelection[] }): MapDocument {
  const linked = linkedOfferIds(document, input.touchpointId); assertFreshRecordIds(document, input.selections.map(selection => selection.id));
  const semantic = new Set<string>(); const jobs: TouchpointJobSelection[] = []; const financial: TouchpointFinancialSelection[] = [];
  for (const selection of input.selections) {
    if (!linked.has(selection.offerId)) throw new DomainError('contributing_offer_not_linked', 'A contributing Offer must be linked to the Touchpoint.');
    if (selection.kind === 'job') {
      const offerSelection = document.offerJobSelections.find(candidate => candidate.offerId === selection.offerId && candidate.productJobIntentId === selection.productJobIntentId);
      if (!offerSelection) throw new DomainError('missing_offer_job_selection', 'The Offer must select the Product Job Intent.');
      const intent = document.productJobIntents.find(candidate => candidate.id === selection.productJobIntentId);
      if (!intent || intent.productId !== productForOffer(document, selection.offerId)) throw new DomainError('offer_selection_wrong_product', 'Product Job Intent must belong to the contributing Offer Product.');
      validateTouchpointOutcomeScope(document, intent, selection.addressedDesiredOutcomeIds);
      const key = `job:${selection.offerId}:${selection.productJobIntentId}:${[...selection.addressedDesiredOutcomeIds].sort().join(',')}`;
      if (semantic.has(key)) throw new DomainError('duplicate_touchpoint_selection', 'The same semantic Touchpoint selection cannot be duplicated for an Offer.'); semantic.add(key);
      jobs.push({ id: selection.id, touchpointId: input.touchpointId, offerId: selection.offerId, productJobIntentId: selection.productJobIntentId, addressedDesiredOutcomeIds: [...selection.addressedDesiredOutcomeIds] });
    } else {
      const intent = document.offerFinancialIntents.find(candidate => candidate.id === selection.offerFinancialIntentId && candidate.offerId === selection.offerId);
      if (!intent) throw new DomainError('missing_offer_financial_intent', 'The Financial Desired Outcome must belong to the contributing Offer intent.');
      const key = `financial:${selection.offerId}:${intent.financialDesiredOutcomeId}`;
      if (semantic.has(key)) throw new DomainError('duplicate_touchpoint_selection', 'The same semantic Touchpoint selection cannot be duplicated for an Offer.'); semantic.add(key);
      financial.push({ id: selection.id, touchpointId: input.touchpointId, offerId: selection.offerId, offerFinancialIntentId: intent.id, financialDesiredOutcomeId: intent.financialDesiredOutcomeId });
    }
  }
  return pruneIrrelevantTouchpointMitigations({ ...document, touchpointJobSelections: [...document.touchpointJobSelections.filter(selection => selection.touchpointId !== input.touchpointId), ...jobs], touchpointFinancialSelections: [...document.touchpointFinancialSelections.filter(selection => selection.touchpointId !== input.touchpointId), ...financial] });
}

export function selectAllLinkedOfferIntentsForTouchpoint(document: MapDocument, input: { touchpointId: string; jobSelectionIds: string[]; financialSelectionIds: string[] }): MapDocument {
  const linked = linkedOfferIds(document, input.touchpointId);
  const jobs = document.offerJobSelections.filter(selection => linked.has(selection.offerId));
  const financial = document.offerFinancialIntents.filter(intent => linked.has(intent.offerId));
  if (jobs.length !== input.jobSelectionIds.length || financial.length !== input.financialSelectionIds.length) throw new DomainError('invalid_selection_ids', 'Every copied Offer intent requires a generated stable ID.');
  return setTouchpointIntentSelections(document, { touchpointId: input.touchpointId, selections: [
    ...jobs.map((selection, index): TouchpointTopDownSelection => ({ id: input.jobSelectionIds[index]!, kind: 'job', offerId: selection.offerId, productJobIntentId: selection.productJobIntentId, addressedDesiredOutcomeIds: [...document.productJobIntents.find(intent => intent.id === selection.productJobIntentId)!.addressedDesiredOutcomeIds] })),
    ...financial.map((intent, index): TouchpointTopDownSelection => ({ id: input.financialSelectionIds[index]!, kind: 'financial', offerId: intent.offerId, offerFinancialIntentId: intent.id })),
  ] });
}

export type BottomUpTouchpointInput = { touchpointId: string; contributingOfferIds: string[]; jobId: string; addressedDesiredOutcomeIds?: string[]; financialDesiredOutcomeId?: never; productJobIntentIds: string[]; offerJobSelectionIds: string[]; touchpointSelectionIds: string[] } | { touchpointId: string; contributingOfferIds: string[]; financialDesiredOutcomeId: string; jobId?: never; addressedDesiredOutcomeIds?: never; offerFinancialIntentIds: string[]; touchpointSelectionIds: string[] };
export function authorTouchpointIntentBottomUp(document: MapDocument, input: BottomUpTouchpointInput): MapDocument {
  const linked = linkedOfferIds(document, input.touchpointId); unique(input.contributingOfferIds, 'duplicate_contributing_offer');
  if (!input.contributingOfferIds.length) throw new DomainError('missing_contributing_offer', 'Choose at least one contributing Offer.');
  for (const offerId of input.contributingOfferIds) if (!linked.has(offerId)) throw new DomainError('contributing_offer_not_linked', 'A contributing Offer must be linked to the Touchpoint.');
  let next = document;
  if (typeof input.financialDesiredOutcomeId === 'string') {
    const financialDesiredOutcomeId = input.financialDesiredOutcomeId;
    entityOfKind(document, financialDesiredOutcomeId, 'financial_desired_outcome', 'Financial Desired Outcome');
    const missing = input.contributingOfferIds.filter(offerId => !document.offerFinancialIntents.some(intent => intent.offerId === offerId && intent.financialDesiredOutcomeId === input.financialDesiredOutcomeId));
    if (missing.length !== input.offerFinancialIntentIds.length || input.contributingOfferIds.length !== input.touchpointSelectionIds.length) throw new DomainError('invalid_selection_ids', 'Every potentially created record requires a generated stable ID.');
    assertFreshRecordIds(document, [...input.offerFinancialIntentIds, ...input.touchpointSelectionIds]);
    missing.forEach((offerId, index) => { next = { ...next, offerFinancialIntents: [...next.offerFinancialIntents, { id: input.offerFinancialIntentIds[index]!, offerId, financialDesiredOutcomeId }] }; });
    const additions = input.contributingOfferIds.map((offerId, index): TouchpointFinancialSelection => { const intent = next.offerFinancialIntents.find(candidate => candidate.offerId === offerId && candidate.financialDesiredOutcomeId === financialDesiredOutcomeId)!; return { id: input.touchpointSelectionIds[index]!, touchpointId: input.touchpointId, offerId, offerFinancialIntentId: intent.id, financialDesiredOutcomeId }; });
    return { ...next, touchpointFinancialSelections: [...next.touchpointFinancialSelections.filter(selection => !(selection.touchpointId === input.touchpointId && additions.some(item => item.offerId === selection.offerId && item.financialDesiredOutcomeId === selection.financialDesiredOutcomeId))), ...additions] };
  }
  const outcomes = input.addressedDesiredOutcomeIds ?? []; const products = [...new Set(input.contributingOfferIds.map(offerId => productForOffer(document, offerId)))];
  const missingProducts = products.filter(productId => !document.productJobIntents.some(intent => intent.productId === productId && intent.jobId === input.jobId));
  const missingOffers = input.contributingOfferIds.filter(offerId => { const productId = productForOffer(document, offerId); const intent = document.productJobIntents.find(candidate => candidate.productId === productId && candidate.jobId === input.jobId); return !intent || !document.offerJobSelections.some(selection => selection.offerId === offerId && selection.productJobIntentId === intent.id); });
  if (missingProducts.length !== input.productJobIntentIds.length || missingOffers.length !== input.offerJobSelectionIds.length || input.contributingOfferIds.length !== input.touchpointSelectionIds.length) throw new DomainError('invalid_selection_ids', 'Every potentially created record requires a generated stable ID.');
  assertFreshRecordIds(document, [...input.productJobIntentIds, ...input.offerJobSelectionIds, ...input.touchpointSelectionIds]);
  missingProducts.forEach((productId, index) => { next = addProductJobIntent(next, { id: input.productJobIntentIds[index]!, productId, jobId: input.jobId, addressedDesiredOutcomeIds: outcomes }); });
  for (const productId of products) { const intent = next.productJobIntents.find(candidate => candidate.productId === productId && candidate.jobId === input.jobId)!; next = updateProductJobIntent(next, { ...intent, addressedDesiredOutcomeIds: [...new Set([...intent.addressedDesiredOutcomeIds, ...outcomes])] }); }
  missingOffers.forEach((offerId, index) => { const productId = productForOffer(next, offerId); const intent = next.productJobIntents.find(candidate => candidate.productId === productId && candidate.jobId === input.jobId)!; next = { ...next, offerJobSelections: [...next.offerJobSelections, { id: input.offerJobSelectionIds[index]!, offerId, productJobIntentId: intent.id }] }; });
  const additions = input.contributingOfferIds.map((offerId, index): TouchpointJobSelection => { const productId = productForOffer(next, offerId); const intent = next.productJobIntents.find(candidate => candidate.productId === productId && candidate.jobId === input.jobId)!; return { id: input.touchpointSelectionIds[index]!, touchpointId: input.touchpointId, offerId, productJobIntentId: intent.id, addressedDesiredOutcomeIds: [...outcomes] }; });
  return pruneIrrelevantTouchpointMitigations({ ...next, touchpointJobSelections: [...next.touchpointJobSelections.filter(selection => !(selection.touchpointId === input.touchpointId && additions.some(item => item.offerId === selection.offerId && item.productJobIntentId === selection.productJobIntentId))), ...additions] });
}

export const narrowTouchpointIntentScope = setTouchpointIntentSelections;
export interface CascadeImpactSummary { offerJobSelectionIds: string[]; offerFinancialIntentIds: string[]; touchpointJobSelectionIds: string[]; touchpointFinancialSelectionIds: string[] }
export function getIntentRemovalImpact(document: MapDocument, input: { offerJobSelectionId?: string; offerFinancialIntentId?: string }): CascadeImpactSummary {
  const job = input.offerJobSelectionId ? document.offerJobSelections.find(selection => selection.id === input.offerJobSelectionId) : undefined;
  const financial = input.offerFinancialIntentId ? document.offerFinancialIntents.find(intent => intent.id === input.offerFinancialIntentId) : undefined;
  return { offerJobSelectionIds: job ? [job.id] : [], offerFinancialIntentIds: financial ? [financial.id] : [], touchpointJobSelectionIds: job ? document.touchpointJobSelections.filter(selection => selection.offerId === job.offerId && selection.productJobIntentId === job.productJobIntentId).map(selection => selection.id) : [], touchpointFinancialSelectionIds: financial ? document.touchpointFinancialSelections.filter(selection => selection.offerFinancialIntentId === financial.id).map(selection => selection.id) : [] };
}
export function removeOfferIntentConfirmed(document: MapDocument, input: { offerJobSelectionId?: string; offerFinancialIntentId?: string }): MapDocument {
  const impact = getIntentRemovalImpact(document, input); const jobIds = new Set(impact.touchpointJobSelectionIds); const financialIds = new Set(impact.touchpointFinancialSelectionIds);
  return pruneIrrelevantTouchpointMitigations({ ...document, offerJobSelections: document.offerJobSelections.filter(selection => !impact.offerJobSelectionIds.includes(selection.id)), offerFinancialIntents: document.offerFinancialIntents.filter(intent => !impact.offerFinancialIntentIds.includes(intent.id)), touchpointJobSelections: document.touchpointJobSelections.filter(selection => !jobIds.has(selection.id)), touchpointFinancialSelections: document.touchpointFinancialSelections.filter(selection => !financialIds.has(selection.id)) });
}

export function setContextualCoreFunctionalJobs(document: MapDocument, input: { contextualJobId: string; coreFunctionalJobIds: string[]; newRelationshipIds: string[] }): MapDocument {
  const contextual = document.entities.find(entity => entity.id === input.contextualJobId);
  if (!contextual || (contextual.kind !== 'emotional_job' && contextual.kind !== 'social_job')) throw new DomainError('invalid_relationship_endpoint', 'Contextual target must be an Emotional or Social Job.');
  unique(input.coreFunctionalJobIds, 'duplicate_contextual_relationship');
  input.coreFunctionalJobIds.forEach(id => entityOfKind(document, id, 'core_functional_job', 'Core Functional Job context'));
  const existing = document.relationships.filter((relation): relation is Extract<Relationship, { kind: 'core_functional_job_contextualizes_job' }> => relation.kind === 'core_functional_job_contextualizes_job' && relation.contextualJobId === input.contextualJobId);
  const retained = new Map(existing.map(relation => [relation.coreFunctionalJobId, relation]));
  const additions = input.coreFunctionalJobIds.filter(id => !retained.has(id));
  if (additions.length !== input.newRelationshipIds.length) throw new DomainError('invalid_relationship_ids', 'Each new context requires a fresh relationship ID.');
  assertRelationshipIds(document, input.newRelationshipIds);
  const replacement = input.coreFunctionalJobIds.map(id => retained.get(id) ?? { id: input.newRelationshipIds[additions.indexOf(id)]!, kind: 'core_functional_job_contextualizes_job' as const, coreFunctionalJobId: id, contextualJobId: input.contextualJobId });
  return { ...document, relationships: [...document.relationships.filter(relation => !(relation.kind === 'core_functional_job_contextualizes_job' && relation.contextualJobId === input.contextualJobId)), ...replacement] };
}

export function relevantRepulsorsForTouchpoint(document: MapDocument, touchpointId: string): Entity[] {
  entityOfKind(document, touchpointId, 'touchpoint', 'Touchpoint');
  const intentIds = new Set(document.touchpointJobSelections.flatMap(selection => selection.touchpointId === touchpointId ? [selection.productJobIntentId] : []));
  const jobIds = new Set(document.productJobIntents.flatMap(intent => intentIds.has(intent.id) ? [intent.jobId] : []));
  const repulsorIds = new Set(document.relationships.flatMap(relation => relation.kind === 'repulsor_resists' && jobIds.has(relation.targetEntityId) ? [relation.repulsorId] : []));
  return document.entities.filter(entity => entity.kind === 'repulsor' && repulsorIds.has(entity.id));
}

export function setTouchpointMitigations(document: MapDocument, input: { touchpointId: string; repulsorIds: string[]; newRelationshipIds: string[] }): MapDocument {
  entityOfKind(document, input.touchpointId, 'touchpoint', 'Touchpoint');
  unique(input.repulsorIds, 'duplicate_touchpoint_mitigation');
  const relevantIds = new Set(relevantRepulsorsForTouchpoint(document, input.touchpointId).map(entity => entity.id));
  for (const id of input.repulsorIds) { entityOfKind(document, id, 'repulsor', 'Mitigated Repulsor'); if (!relevantIds.has(id)) throw new DomainError('irrelevant_touchpoint_mitigation', 'A Touchpoint may mitigate only a currently relevant Repulsor.'); }
  const existing = document.relationships.filter((relation): relation is Extract<Relationship, { kind: 'touchpoint_mitigates_repulsor' }> => relation.kind === 'touchpoint_mitigates_repulsor' && relation.touchpointId === input.touchpointId);
  const retained = new Map(existing.map(relation => [relation.repulsorId, relation]));
  const additions = input.repulsorIds.filter(id => !retained.has(id));
  if (additions.length !== input.newRelationshipIds.length) throw new DomainError('invalid_relationship_ids', 'Each new mitigation requires a fresh relationship ID.');
  assertRelationshipIds(document, input.newRelationshipIds);
  const replacement = input.repulsorIds.map(id => retained.get(id) ?? { id: input.newRelationshipIds[additions.indexOf(id)]!, kind: 'touchpoint_mitigates_repulsor' as const, touchpointId: input.touchpointId, repulsorId: id });
  return { ...document, relationships: [...document.relationships.filter(relation => !(relation.kind === 'touchpoint_mitigates_repulsor' && relation.touchpointId === input.touchpointId)), ...replacement] };
}

function pruneIrrelevantTouchpointMitigations(document: MapDocument): MapDocument {
  const relevantByTouchpoint = new Map(document.entities.filter(entity => entity.kind === 'touchpoint').map(entity => [entity.id, new Set(relevantRepulsorsForTouchpoint(document, entity.id).map(repulsor => repulsor.id))]));
  return { ...document, relationships: document.relationships.filter(relation => relation.kind !== 'touchpoint_mitigates_repulsor' || relevantByTouchpoint.get(relation.touchpointId)?.has(relation.repulsorId)) };
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
  | { kind: ContextualClientEntityKind; parentEntityId: string; relationshipId: string }
  | { kind: 'repulsor'; resistedTargetIds: string[]; relationshipIds: string[] }
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
  } else if (input.kind === 'related_job') {
    entityOfKind(document, input.parentEntityId, 'core_functional_job', 'Related Job parent');
    added = [{ id: input.relationshipId, kind: 'core_functional_job_has_related_job', coreFunctionalJobId: input.parentEntityId, relatedJobId: input.entityId }];
    entity = { id: input.entityId, title, kind: input.kind };
  } else if (input.kind === 'desired_outcome') {
    const parent = document.entities.find(candidate => candidate.id === input.parentEntityId);
    if (!parent) throw new DomainError('invalid_relationship_reference', 'Desired Outcome parent does not reference an existing entity.');
    if (!['core_functional_job', 'related_job', 'consumption_chain_job'].includes(parent.kind)) throw new DomainError('invalid_relationship_endpoint', 'Desired Outcome parent must reference a functional Job.');
    added = [{ id: input.relationshipId, kind: 'job_has_desired_outcome', jobId: input.parentEntityId, desiredOutcomeId: input.entityId }];
    entity = { id: input.entityId, title, kind: input.kind };
  } else if (input.kind === 'repulsor') {
    assertRepulsorTargets(document, input.resistedTargetIds);
    if (input.relationshipIds.length !== input.resistedTargetIds.length) throw new DomainError('invalid_relationship_ids', 'Each resisted target requires a relationship ID.');
    added = input.resistedTargetIds.map((targetEntityId, index) => ({ id: input.relationshipIds[index]!, kind: 'repulsor_resists', repulsorId: input.entityId, targetEntityId }));
    entity = { id: input.entityId, title, kind: input.kind };
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
export type UpdateEntityInput = { entityId: string; title: string; locatedInId?: string; url?: string; linkedProductId?: string; linkedOfferIds?: string[]; relationshipIds?: string[]; parentTouchpointId?: string; parentEntityId?: string; parentRelationshipId?: string };
export function updateEntity(document: MapDocument, input: UpdateEntityInput): MapDocument {
  const entity = document.entities.find(e => e.id === input.entityId); if (!entity) throw new DomainError('unknown_entity', 'Entity does not exist.');
  const title = required(input.title, 'Entity title'); let updated: Entity = { ...entity, title }; let relationships = document.relationships;
  if (entity.kind === 'offer') {
    if (!input.linkedProductId) throw new DomainError('missing_linked_product', 'An Offer must be linked to a Product.'); entityOfKind(document, input.linkedProductId, 'product', 'Linked Product');
    const previousProductId = relationships.find((r): r is Extract<Relationship, { kind: 'product_packaged_as_offer' }> => r.kind === 'product_packaged_as_offer' && r.offerId === entity.id)?.productId;
    relationships = relationships.map(r => r.kind === 'product_packaged_as_offer' && r.offerId === entity.id ? { ...r, productId: input.linkedProductId! } : r);
    if (previousProductId !== input.linkedProductId) document = { ...document, offerJobSelections: document.offerJobSelections.filter(selection => selection.offerId !== entity.id), touchpointJobSelections: document.touchpointJobSelections.filter(selection => selection.offerId !== entity.id) };
  } else if (entity.kind === 'touchpoint') {
    assertContainer(document, input.locatedInId ?? '');
    const offerIds = input.linkedOfferIds ?? []; if (!offerIds.length) throw new DomainError('missing_linked_offer', 'A Touchpoint must present at least one Offer.'); unique(offerIds); offerIds.forEach(id => entityOfKind(document, id, 'offer', 'Linked Offer'));
    const url = optional(input.url); updated = { id: entity.id, kind: 'touchpoint', title, locatedInId: input.locatedInId!, ...(url ? { url } : {}) };
    const oldOffers = relationships.filter(r => r.kind === 'offer_presented_at_touchpoint' && r.touchpointId === entity.id);
    const retainedOfferIds = new Set(offerIds);
    document = { ...document, touchpointJobSelections: document.touchpointJobSelections.filter(selection => selection.touchpointId !== entity.id || retainedOfferIds.has(selection.offerId)), touchpointFinancialSelections: document.touchpointFinancialSelections.filter(selection => selection.touchpointId !== entity.id || retainedOfferIds.has(selection.offerId)) };
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
  } else if (entity.kind === 'related_job' || entity.kind === 'desired_outcome') {
    if (!input.parentEntityId) throw new DomainError('missing_semantic_parent', `${entity.kind === 'related_job' ? 'Related Job' : 'Desired Outcome'} must have a semantic parent.`);
    const parentKind = document.entities.find(candidate => candidate.id === input.parentEntityId)?.kind;
    const valid = entity.kind === 'related_job' ? parentKind === 'core_functional_job' : parentKind === 'core_functional_job' || parentKind === 'related_job' || parentKind === 'consumption_chain_job';
    if (!valid) throw new DomainError(parentKind ? 'invalid_relationship_endpoint' : 'invalid_relationship_reference', `Invalid semantic parent for ${entity.kind === 'related_job' ? 'Related Job' : 'Desired Outcome'}.`);
    const semantic = relationships.filter(r => entity.kind === 'related_job' ? r.kind === 'core_functional_job_has_related_job' && r.relatedJobId === entity.id : r.kind === 'job_has_desired_outcome' && r.desiredOutcomeId === entity.id);
    if (semantic.length !== 1) throw new DomainError('invalid_semantic_parent_count', 'A contextual Client entity must have exactly one semantic parent.');
    relationships = relationships.map(r => r.id !== semantic[0]!.id ? r : r.kind === 'core_functional_job_has_related_job' ? { ...r, coreFunctionalJobId: input.parentEntityId! } : { ...r, jobId: input.parentEntityId! });
  }
  return pruneIrrelevantTouchpointMitigations({ ...document, entities: document.entities.map(e => e.id === entity.id ? updated : e), relationships });
}

export function updateRepulsorTargets(document: MapDocument, input: { repulsorId: string; targetEntityIds: string[]; newRelationshipIds: string[] }): MapDocument {
  entityOfKind(document, input.repulsorId, 'repulsor', 'Repulsor');
  assertRepulsorTargets(document, input.targetEntityIds);
  const existing = document.relationships.filter((relationship): relationship is Extract<Relationship, { kind: 'repulsor_resists' }> => relationship.kind === 'repulsor_resists' && relationship.repulsorId === input.repulsorId);
  const retained = new Map(existing.map(relationship => [relationship.targetEntityId, relationship]));
  const additions = input.targetEntityIds.filter(id => !retained.has(id));
  if (input.newRelationshipIds.length !== additions.length) throw new DomainError('invalid_relationship_ids', 'Each newly resisted target requires a fresh relationship ID.');
  assertRelationshipIds(document, input.newRelationshipIds);
  const replacement = input.targetEntityIds.map(targetEntityId => retained.get(targetEntityId) ?? ({ id: input.newRelationshipIds[additions.indexOf(targetEntityId)]!, kind: 'repulsor_resists' as const, repulsorId: input.repulsorId, targetEntityId }));
  return { ...document, relationships: [...document.relationships.filter(relationship => !(relationship.kind === 'repulsor_resists' && relationship.repulsorId === input.repulsorId)), ...replacement] };
}

export function duplicateEntity(document: MapDocument, input: { sourceEntityId: string; entityId: string; viewId: string; x: number; y: number; relationshipIds: string[] }): MapDocument {
  const source = document.entities.find(e => e.id === input.sourceEntityId); if (!source) throw new DomainError('unknown_entity', 'Source entity does not exist.');
  if (source.kind === 'product') {
    let copy = addEntity(document, { entityId: input.entityId, title: source.title, kind: source.kind, viewId: input.viewId, x: input.x, y: input.y });
    for (const [index, intent] of document.productJobIntents.filter(candidate => candidate.productId === source.id).entries()) copy = addProductJobIntent(copy, { ...intent, id: input.relationshipIds[index]!, productId: input.entityId });
    return copy;
  }
  if (isClientRootEntityKind(source.kind)) {
    let copy = addEntity(document, { entityId: input.entityId, title: source.title, kind: source.kind, viewId: input.viewId, x: input.x, y: input.y });
    if (source.kind === 'emotional_job' || source.kind === 'social_job') {
      const contexts = document.relationships.flatMap(relation => relation.kind === 'core_functional_job_contextualizes_job' && relation.contextualJobId === source.id ? [relation.coreFunctionalJobId] : []);
      copy = setContextualCoreFunctionalJobs(copy, { contextualJobId: input.entityId, coreFunctionalJobIds: contexts, newRelationshipIds: input.relationshipIds.slice(0, contexts.length) });
    }
    return copy;
  }
  if (source.kind === 'related_job' || source.kind === 'desired_outcome') {
    const parentEntityId = source.kind === 'related_job'
      ? document.relationships.find((r): r is Extract<Relationship, { kind: 'core_functional_job_has_related_job' }> => r.kind === 'core_functional_job_has_related_job' && r.relatedJobId === source.id)?.coreFunctionalJobId
      : document.relationships.find((r): r is Extract<Relationship, { kind: 'job_has_desired_outcome' }> => r.kind === 'job_has_desired_outcome' && r.desiredOutcomeId === source.id)?.jobId;
    if (!parentEntityId) throw new DomainError('missing_semantic_parent', 'Contextual Client entity has no semantic parent.');
    return addEntity(document, { entityId: input.entityId, title: source.title, kind: source.kind, parentEntityId, relationshipId: input.relationshipIds[0]!, viewId: input.viewId, x: input.x, y: input.y });
  }
  if (source.kind === 'repulsor') {
    const targetIds = document.relationships.filter((relationship): relationship is Extract<Relationship, { kind: 'repulsor_resists' }> => relationship.kind === 'repulsor_resists' && relationship.repulsorId === source.id).map(relationship => relationship.targetEntityId);
    return addEntity(document, { entityId: input.entityId, title: source.title, kind: 'repulsor', resistedTargetIds: targetIds, relationshipIds: input.relationshipIds.slice(0, targetIds.length), viewId: input.viewId, x: input.x, y: input.y });
  }
  if (source.kind === 'offer') { const relation = document.relationships.find((r): r is Extract<Relationship, { kind: 'product_packaged_as_offer' }> => r.kind === 'product_packaged_as_offer' && r.offerId === source.id)!; let copy = addEntity(document, { entityId: input.entityId, title: source.title, kind: 'offer', linkedProductId: relation.productId, relationshipId: input.relationshipIds[0]!, viewId: input.viewId, x: input.x, y: input.y }); const selected = document.offerJobSelections.filter(selection => selection.offerId === source.id).map(selection => selection.productJobIntentId); copy = setOfferJobSelections(copy, { offerId: input.entityId, productJobIntentIds: selected, newSelectionIds: input.relationshipIds.slice(1, selected.length + 1) }); const financial = document.offerFinancialIntents.filter(intent => intent.offerId === source.id).map(intent => intent.financialDesiredOutcomeId); copy = setOfferFinancialIntents(copy, { offerId: input.entityId, financialDesiredOutcomeIds: financial, newIntentIds: input.relationshipIds.slice(1 + selected.length, 1 + selected.length + financial.length) }); return copy; }
  if (source.kind !== 'touchpoint') throw new DomainError('unsupported_entity_kind', 'Source entity kind cannot be duplicated.');
  const offerIds = document.relationships.filter((r): r is Extract<Relationship, { kind: 'offer_presented_at_touchpoint' }> => r.kind === 'offer_presented_at_touchpoint' && r.touchpointId === source.id).map(r => r.offerId);
  const parent = document.relationships.find((r): r is Extract<Relationship, { kind: 'touchpoint_contains_touchpoint' }> => r.kind === 'touchpoint_contains_touchpoint' && r.childTouchpointId === source.id);
  let copy = addEntity(document, { entityId: input.entityId, title: source.title, kind: 'touchpoint', locatedInId: source.locatedInId, ...(source.url ? { url: source.url } : {}), linkedOfferIds: offerIds, relationshipIds: input.relationshipIds.slice(0, offerIds.length), ...(parent ? { parentTouchpointId: parent.parentTouchpointId, parentRelationshipId: input.relationshipIds[offerIds.length]! } : {}), viewId: input.viewId, x: input.x, y: input.y });
  const sourceJobs = document.touchpointJobSelections.filter(selection => selection.touchpointId === source.id && offerIds.includes(selection.offerId));
  const sourceFinancial = document.touchpointFinancialSelections.filter(selection => selection.touchpointId === source.id && offerIds.includes(selection.offerId));
  const mitigated = document.relationships.flatMap(relation => relation.kind === 'touchpoint_mitigates_repulsor' && relation.touchpointId === source.id ? [relation.repulsorId] : []);
  const offset = offerIds.length + (parent ? 1 : 0);
  copy = setTouchpointIntentSelections(copy, { touchpointId: input.entityId, selections: [...sourceJobs.map((selection, index): TouchpointTopDownSelection => ({ id: input.relationshipIds[offset + index]!, kind: 'job', offerId: selection.offerId, productJobIntentId: selection.productJobIntentId, addressedDesiredOutcomeIds: [...selection.addressedDesiredOutcomeIds] })), ...sourceFinancial.map((selection, index): TouchpointTopDownSelection => ({ id: input.relationshipIds[offset + sourceJobs.length + index]!, kind: 'financial', offerId: selection.offerId, offerFinancialIntentId: selection.offerFinancialIntentId }))] });
  const mitigationOffset = offset + sourceJobs.length + sourceFinancial.length;
  copy = setTouchpointMitigations(copy, { touchpointId: input.entityId, repulsorIds: mitigated, newRelationshipIds: input.relationshipIds.slice(mitigationOffset, mitigationOffset + mitigated.length) });
  return copy;
}
export function movePlacement(document: MapDocument, input: { entityId: string; viewId: string; x: number; y: number }): MapDocument { finite(input.x, input.y); if (!document.entities.some(e => e.id === input.entityId)) throw new DomainError('unknown_entity', 'Entity does not exist.'); if (!document.placements.some(p => p.entityId === input.entityId && p.viewId === input.viewId)) throw new DomainError('unknown_placement', 'Placement does not exist.'); return { ...document, placements: document.placements.map(p => p.entityId === input.entityId && p.viewId === input.viewId ? { ...p, x: input.x, y: input.y } : p) }; }
