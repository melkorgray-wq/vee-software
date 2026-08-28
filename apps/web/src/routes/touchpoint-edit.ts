import type { Entity, MapDocument, TouchpointIntentDraft as DomainTouchpointIntentDraft, TouchpointIntentFinancialLeaf, TouchpointIntentJobLeaf } from '@vee/domain';

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
export const validateTouchpointIntentDraft = (draft: TouchpointIntentDraft): string | undefined =>
  draft.pendingJobLeafIds.some((id) => !draft.jobLeaves.find((leaf) => leaf.semanticLeafId === id)?.contributorOfferIds.length)
  || draft.pendingFinancialLeafIds.some((id) => !draft.financialLeaves.find((leaf) => leaf.financialDesiredOutcomeId === id)?.contributorOfferIds.length)
    ? 'Choose at least one contributing Offer for every selected Client-intent leaf.' : undefined;

export const entityTitle = (document: MapDocument, id: string): Entity['title'] => document.entities.find((entity) => entity.id === id)?.title ?? id;
