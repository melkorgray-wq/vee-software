import { addTouchpointContainer, applyTouchpointIntentDraft, relevantRepulsorsForTouchpoint, setTouchpointMitigations, updateEntity, type Entity, type MapDocument, type TouchpointIntentDraft as DomainTouchpointIntentDraft, type TouchpointIntentFinancialLeaf, type TouchpointIntentJobLeaf } from '@vee/domain';

export type TouchpointJobLeaf = TouchpointIntentJobLeaf;
export type TouchpointFinancialLeaf = TouchpointIntentFinancialLeaf;
export type TouchpointIntentDraft = DomainTouchpointIntentDraft & { durableBranchSnapshot: { touchpointIntentLeafIds: string[]; otherClientIntentLeafIds: string[] } };

const doBearing = new Set(['core_functional_job', 'related_job', 'consumption_chain_job']);
const direct = new Set(['emotional_job', 'social_job']);
export const jobLeafKey = (leaf: Pick<TouchpointJobLeaf, 'semanticLeafId'>) => `job:${leaf.semanticLeafId}`;
export const financialLeafKey = (leaf: Pick<TouchpointFinancialLeaf, 'financialDesiredOutcomeId'>) => `financial:${leaf.financialDesiredOutcomeId}`;

/** Client entities own this catalogue; upstream Product/Offer intent only determines whether Apply must complete a path. */
export function touchpointIntentCatalogue(document: MapDocument): { jobs: TouchpointJobLeaf[]; financial: TouchpointFinancialLeaf[] } {
  const jobs = document.entities.flatMap((entity): TouchpointJobLeaf[] => {
    if (direct.has(entity.kind)) return [{ jobId: entity.id, semanticLeafId: entity.id, contributorOfferIds: [] }];
    if (!doBearing.has(entity.kind)) return [];
    return document.relationships.flatMap((relation) => relation.kind === 'job_has_desired_outcome' && relation.jobId === entity.id
      ? [{ jobId: entity.id, semanticLeafId: relation.desiredOutcomeId, desiredOutcomeId: relation.desiredOutcomeId, contributorOfferIds: [] }]
      : []);
  });
  const financial = document.entities
    .filter((entity) => entity.kind === 'financial_desired_outcome')
    .map((entity) => ({ financialDesiredOutcomeId: entity.id, contributorOfferIds: [] }));
  return { jobs, financial };
}

export function createTouchpointIntentDraft(document: MapDocument, touchpointId: string): TouchpointIntentDraft {
  const catalogue = touchpointIntentCatalogue(document);
  const jobs = new Map(catalogue.jobs.map((leaf) => [leaf.semanticLeafId, { ...leaf }]));
  for (const selection of document.touchpointJobSelections.filter((item) => item.touchpointId === touchpointId)) {
    const intent = document.productJobIntents.find((item) => item.id === selection.productJobIntentId);
    if (!intent) continue;
    const semanticIds = selection.addressedDesiredOutcomeIds.length ? selection.addressedDesiredOutcomeIds : [intent.jobId];
    for (const semanticLeafId of semanticIds) {
      const leaf = jobs.get(semanticLeafId);
      if (leaf && !leaf.contributorOfferIds.includes(selection.offerId)) leaf.contributorOfferIds.push(selection.offerId);
    }
  }
  const financial = new Map(catalogue.financial.map((leaf) => [leaf.financialDesiredOutcomeId, { ...leaf }]));
  for (const selection of document.touchpointFinancialSelections.filter((item) => item.touchpointId === touchpointId)) {
    const leaf = financial.get(selection.financialDesiredOutcomeId);
    if (leaf && !leaf.contributorOfferIds.includes(selection.offerId)) leaf.contributorOfferIds.push(selection.offerId);
  }
  const selected = [
    ...[...jobs.values()].filter((leaf) => leaf.contributorOfferIds.length).map(jobLeafKey),
    ...[...financial.values()].filter((leaf) => leaf.contributorOfferIds.length).map(financialLeafKey),
  ];
  const all = [...[...jobs.values()].map(jobLeafKey), ...[...financial.values()].map(financialLeafKey)];
  return {
    jobLeaves: [...jobs.values()], financialLeaves: [...financial.values()],
    pendingJobLeafIds: [], pendingFinancialLeafIds: [],
    durableBranchSnapshot: { touchpointIntentLeafIds: selected, otherClientIntentLeafIds: all.filter((key) => !selected.includes(key)) },
  };
}

const normalized = (draft: TouchpointIntentDraft) => ({
  jobs: draft.jobLeaves.filter((leaf) => leaf.contributorOfferIds.length || draft.pendingJobLeafIds.includes(leaf.semanticLeafId)).map((leaf) => [leaf.semanticLeafId, [...leaf.contributorOfferIds].sort()]).sort(),
  financial: draft.financialLeaves.filter((leaf) => leaf.contributorOfferIds.length || draft.pendingFinancialLeafIds.includes(leaf.financialDesiredOutcomeId)).map((leaf) => [leaf.financialDesiredOutcomeId, [...leaf.contributorOfferIds].sort()]).sort(),
});
export const equalTouchpointIntentDraft = (left: TouchpointIntentDraft, right: TouchpointIntentDraft) => JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
export const validateTouchpointIntentDraft = (draft: TouchpointIntentDraft, linkedOfferIds?: string[]): string | undefined =>
  draft.pendingJobLeafIds.some((id) => !draft.jobLeaves.find((leaf) => leaf.semanticLeafId === id)?.contributorOfferIds.length)
  || draft.pendingFinancialLeafIds.some((id) => !draft.financialLeaves.find((leaf) => leaf.financialDesiredOutcomeId === id)?.contributorOfferIds.length)
    ? 'Choose at least one contributing Offer for every selected Client-intent leaf.'
    : linkedOfferIds && [...draft.jobLeaves, ...draft.financialLeaves].some(leaf => leaf.contributorOfferIds.some(id => !linkedOfferIds.includes(id)))
      ? 'Every contributing Offer must remain linked to this Touchpoint.' : undefined;

export type TouchpointEditDraft = {
  title: string;
  linkedOfferIds: string[];
  parentTouchpointId: string;
  locatedInId: string;
  locatedInQuery: string;
  locationDraft: { kind: 'none' } | { kind: 'existing'; containerId: string } | { kind: 'new'; title: string };
  url: string;
  mitigatedRepulsorIds: string[];
  touchpointIntent: TouchpointIntentDraft;
};

/** Builds the complete Touchpoint edit transaction without mutating the durable input document. */
export function applyTouchpointEditDraft(document: MapDocument, input: { touchpointId: string; draft: TouchpointEditDraft; newId: () => string }): MapDocument {
  const validationError = validateTouchpointIntentDraft(input.draft.touchpointIntent, input.draft.linkedOfferIds);
  if (validationError) throw new Error(validationError);

  let next = document;
  let locatedInId = input.draft.locatedInId;
  if (input.draft.locationDraft.kind === 'new') {
    const title = input.draft.locationDraft.title.trim();
    if (!title) throw new Error('Located in requires a name.');
    const existing = next.touchpointContainers.find(container => container.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase());
    locatedInId = existing?.id ?? input.newId();
    if (!existing) next = addTouchpointContainer(next, { id: locatedInId, title });
  } else if (input.draft.locationDraft.kind === 'existing') locatedInId = input.draft.locationDraft.containerId;

  const oldOffers = document.relationships.filter(relation => relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === input.touchpointId);
  const parent = document.relationships.find(relation => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === input.touchpointId);
  next = updateEntity(next, {
    entityId: input.touchpointId,
    title: input.draft.title,
    locatedInId,
    url: input.draft.url,
    linkedOfferIds: input.draft.linkedOfferIds,
    relationshipIds: input.draft.linkedOfferIds.map((_, index) => oldOffers[index]?.id ?? input.newId()),
    ...(input.draft.parentTouchpointId ? { parentTouchpointId: input.draft.parentTouchpointId, parentRelationshipId: parent?.id ?? input.newId() } : {}),
  });
  next = applyTouchpointIntentDraft(next, { touchpointId: input.touchpointId, draft: input.draft.touchpointIntent, newId: input.newId });

  const retained = next.relationships.flatMap(relation => relation.kind === 'touchpoint_mitigates_repulsor' && relation.touchpointId === input.touchpointId ? [relation.repulsorId] : []);
  const relevant = new Set(relevantRepulsorsForTouchpoint(next, input.touchpointId).map(repulsor => repulsor.id));
  const desired = input.draft.mitigatedRepulsorIds.filter(id => relevant.has(id));
  return setTouchpointMitigations(next, {
    touchpointId: input.touchpointId,
    repulsorIds: desired,
    newRelationshipIds: desired.filter(id => !retained.includes(id)).map(() => input.newId()),
  });
}

/** Copies only currently-authored Offer intent into the local draft; it never authors an upstream path. */
export function selectCurrentOfferIntent(document: MapDocument, draft: TouchpointIntentDraft, offerIds: string[]): TouchpointIntentDraft {
  const jobContributors = new Map<string, Set<string>>();
  const financialContributors = new Map<string, Set<string>>();
  for (const offerId of offerIds) {
    for (const selection of document.offerJobSelections.filter(item => item.offerId === offerId)) {
      const intent = document.productJobIntents.find(item => item.id === selection.productJobIntentId);
      const job = intent && document.entities.find(entity => entity.id === intent.jobId);
      if (!intent || !job) continue;
      const semanticLeafIds = doBearing.has(job.kind) ? intent.addressedDesiredOutcomeIds : direct.has(job.kind) ? [job.id] : [];
      for (const leafId of semanticLeafIds) {
        const contributors = jobContributors.get(leafId) ?? new Set<string>();
        contributors.add(offerId); jobContributors.set(leafId, contributors);
      }
    }
    for (const intent of document.offerFinancialIntents.filter(item => item.offerId === offerId)) {
      const contributors = financialContributors.get(intent.financialDesiredOutcomeId) ?? new Set<string>();
      contributors.add(offerId); financialContributors.set(intent.financialDesiredOutcomeId, contributors);
    }
  }
  const jobLeaves = draft.jobLeaves.map(leaf => ({ ...leaf, contributorOfferIds: [...new Set([...leaf.contributorOfferIds, ...(jobContributors.get(leaf.semanticLeafId) ?? [])])] }));
  const financialLeaves = draft.financialLeaves.map(leaf => ({ ...leaf, contributorOfferIds: [...new Set([...leaf.contributorOfferIds, ...(financialContributors.get(leaf.financialDesiredOutcomeId) ?? [])])] }));
  return {
    ...draft, jobLeaves, financialLeaves,
    pendingJobLeafIds: draft.pendingJobLeafIds.filter(id => !jobLeaves.find(leaf => leaf.semanticLeafId === id)?.contributorOfferIds.length),
    pendingFinancialLeafIds: draft.pendingFinancialLeafIds.filter(id => !financialLeaves.find(leaf => leaf.financialDesiredOutcomeId === id)?.contributorOfferIds.length),
  };
}

export const entityTitle = (document: MapDocument, id: string): Entity['title'] => document.entities.find((entity) => entity.id === id)?.title ?? id;
