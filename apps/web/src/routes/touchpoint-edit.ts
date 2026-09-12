import { addTouchpointContainer, applyTouchpointIntentDraft, relevantRepulsorsForTouchpoint, setTouchpointMitigations, updateEntity, type Entity, type MapDocument, type TouchpointIntentDraft as DomainTouchpointIntentDraft, type TouchpointIntentFinancialLeaf, type TouchpointIntentJobLeaf } from '@vee/domain';

export type TouchpointJobLeaf = TouchpointIntentJobLeaf;
export type TouchpointFinancialLeaf = TouchpointIntentFinancialLeaf;
export type TouchpointIntentDraft = DomainTouchpointIntentDraft & { durableBranchSnapshot: { touchpointIntentLeafIds: string[]; otherClientIntentLeafIds: string[] } };

export type TouchpointClientScope = {
  jobGroups: {
    job: Entity;
    semanticLeafId?: string;
    contributorOfferIds?: string[];
    desiredOutcomes: { entity: Entity; semanticLeafId: string; contributorOfferIds: string[] }[];
  }[];
  financialLeaves: { entity: Entity; semanticLeafId: string; contributorOfferIds: string[] }[];
};

const doBearing = new Set(['core_functional_job', 'related_job', 'consumption_chain_job']);
const direct = new Set(['emotional_job', 'social_job']);
export type UpstreamLeaf = {
  kind: 'job' | 'desired-outcome' | 'financial'; entity: Entity; semanticId: string; sourceId: string;
  contributorOfferId: string; checkboxId: string; checked: boolean; available: boolean;
  productJobIntentId?: string; offerFinancialIntentId?: string;
  provenanceOfferIds?: string[]; childContributorOfferIds?: string[]; checkedContributorOfferIds?: string[];
  owningJobId?: string;
};
export type UpstreamJobGroup = { job: Entity; leaves: UpstreamLeaf[] };
export type TouchpointUpstreamBlock = { sourceKind: 'offer' | 'parent'; source: Entity; contributorOfferId?: string; jobGroups: UpstreamJobGroup[]; financialLeaves: UpstreamLeaf[] };

const pathId = (touchpointId: string, sourceKind: string, sourceId: string, offerId: string, semanticId: string) =>
  [touchpointId, sourceKind, sourceId, offerId, semanticId].map(encodeURIComponent).join(':');

/** Durable, framework-independent projection for the upstream-first Client scope editor. */
export function touchpointUpstreamSources(document: MapDocument, touchpointId: string): TouchpointUpstreamBlock[] {
  const linked = new Set(document.relationships.flatMap(relation => relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === touchpointId ? [relation.offerId] : []));
  const checkedJob = (offerId: string, intentId: string, semanticId: string) => document.touchpointJobSelections.some(selection => selection.touchpointId === touchpointId && selection.offerId === offerId && selection.productJobIntentId === intentId && (selection.addressedDesiredOutcomeIds.length ? selection.addressedDesiredOutcomeIds.includes(semanticId) : document.productJobIntents.find(intent => intent.id === intentId)?.jobId === semanticId));
  const checkedFinancial = (offerId: string, intentId: string) => document.touchpointFinancialSelections.some(selection => selection.touchpointId === touchpointId && selection.offerId === offerId && selection.offerFinancialIntentId === intentId);
  const block = (sourceKind: 'offer' | 'parent', source: Entity, paths: { offerId: string; productJobIntentId?: string; offerFinancialIntentId?: string }[]): TouchpointUpstreamBlock => {
    const groups = new Map<string, UpstreamJobGroup>(); const financialLeaves: UpstreamLeaf[] = [];
    for (const path of paths) {
      const available = linked.has(path.offerId);
      if (path.productJobIntentId) {
        const intent = document.productJobIntents.find(item => item.id === path.productJobIntentId); const job = document.entities.find(item => item.id === intent?.jobId);
        if (!intent || !job || (!doBearing.has(job.kind) && !direct.has(job.kind))) continue;
        const semanticIds = doBearing.has(job.kind) ? intent.addressedDesiredOutcomeIds : [job.id];
        if (!semanticIds.length) continue;
        const group = groups.get(job.id) ?? { job, leaves: [] };
        for (const semanticId of semanticIds) {
          const entity = semanticId === job.id ? job : document.entities.find(item => item.id === semanticId && item.kind === 'desired_outcome');
          if (!entity || group.leaves.some(leaf => leaf.semanticId === semanticId && leaf.contributorOfferId === path.offerId)) continue;
          group.leaves.push({ kind: semanticId === job.id ? 'job' : 'desired-outcome', entity, semanticId, sourceId: source.id, contributorOfferId: path.offerId, checkboxId: pathId(touchpointId, sourceKind, source.id, path.offerId, semanticId), checked: checkedJob(path.offerId, intent.id, semanticId), available, productJobIntentId: intent.id, owningJobId: job.id });
        }
        if (group.leaves.length) groups.set(job.id, group);
      } else if (path.offerFinancialIntentId) {
        const intent = document.offerFinancialIntents.find(item => item.id === path.offerFinancialIntentId); const entity = document.entities.find(item => item.id === intent?.financialDesiredOutcomeId && item.kind === 'financial_desired_outcome');
        if (intent && entity) financialLeaves.push({ kind: 'financial', entity, semanticId: entity.id, sourceId: source.id, contributorOfferId: path.offerId, checkboxId: pathId(touchpointId, sourceKind, source.id, path.offerId, entity.id), checked: checkedFinancial(path.offerId, intent.id), available, offerFinancialIntentId: intent.id });
      }
    }
    return { sourceKind, source, ...(sourceKind === 'offer' ? { contributorOfferId: source.id } : {}), jobGroups: [...groups.values()], financialLeaves };
  };
  const offers = [...linked].flatMap(offerId => {
    const offer = document.entities.find(entity => entity.id === offerId && entity.kind === 'offer'); if (!offer) return [];
    return [block('offer', offer, [...document.offerJobSelections.filter(item => item.offerId === offerId).map(item => ({ offerId, productJobIntentId: item.productJobIntentId })), ...document.offerFinancialIntents.filter(item => item.offerId === offerId).map(item => ({ offerId, offerFinancialIntentId: item.id }))])];
  });
  const parentRelation = document.relationships.find((relation): relation is Extract<typeof relation, { kind: 'touchpoint_contains_touchpoint' }> => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === touchpointId);
  const parentId = parentRelation?.parentTouchpointId;
  const parent = document.entities.find(entity => entity.id === parentId && entity.kind === 'touchpoint');
  if (parent) {
    const childOffers = [...linked]; const groups = new Map<string, UpstreamJobGroup>(); const financialLeaves: UpstreamLeaf[] = [];
    for (const selection of document.touchpointJobSelections.filter(item => item.touchpointId === parent.id)) {
      const intent = document.productJobIntents.find(item => item.id === selection.productJobIntentId); const job = document.entities.find(item => item.id === intent?.jobId);
      if (!intent || !job || (!doBearing.has(job.kind) && !direct.has(job.kind))) continue;
      const semanticIds = doBearing.has(job.kind) ? selection.addressedDesiredOutcomeIds : [job.id]; const group = groups.get(job.id) ?? { job, leaves: [] };
      for (const semanticId of semanticIds) {
        const entity = semanticId === job.id ? job : document.entities.find(item => item.id === semanticId && item.kind === 'desired_outcome'); if (!entity) continue;
        const candidates = childOffers.filter(offerId => document.relationships.some(relation => relation.kind === 'product_packaged_as_offer' && relation.offerId === offerId));
        const checked = candidates.filter(offerId => document.touchpointJobSelections.some(child => child.touchpointId === touchpointId && child.offerId === offerId && document.productJobIntents.find(item => item.id === child.productJobIntentId)?.jobId === job.id && (child.addressedDesiredOutcomeIds.length ? child.addressedDesiredOutcomeIds.includes(semanticId) : semanticId === job.id)));
        const prior = group.leaves.find(leaf => leaf.semanticId === semanticId);
        if (prior) { prior.provenanceOfferIds = [...new Set([...(prior.provenanceOfferIds ?? []), selection.offerId])]; continue; }
        group.leaves.push({ kind: semanticId === job.id ? 'job' : 'desired-outcome', entity, semanticId, sourceId: parent.id, contributorOfferId: '', checkboxId: pathId(touchpointId, 'parent', parent.id, 'child-contributor', semanticId), checked: checked.length > 0, available: candidates.length > 0, provenanceOfferIds: [selection.offerId], childContributorOfferIds: candidates, checkedContributorOfferIds: checked, owningJobId: job.id });
      }
      if (group.leaves.length) groups.set(job.id, group);
    }
    for (const selection of document.touchpointFinancialSelections.filter(item => item.touchpointId === parent.id)) {
      const entity = document.entities.find(item => item.id === selection.financialDesiredOutcomeId && item.kind === 'financial_desired_outcome'); if (!entity) continue;
      const checked = childOffers.filter(offerId => document.touchpointFinancialSelections.some(child => child.touchpointId === touchpointId && child.offerId === offerId && child.financialDesiredOutcomeId === entity.id));
      const prior = financialLeaves.find(leaf => leaf.semanticId === entity.id);
      if (prior) { prior.provenanceOfferIds = [...new Set([...(prior.provenanceOfferIds ?? []), selection.offerId])]; continue; }
      financialLeaves.push({ kind: 'financial', entity, semanticId: entity.id, sourceId: parent.id, contributorOfferId: '', checkboxId: pathId(touchpointId, 'parent', parent.id, 'child-contributor', entity.id), checked: checked.length > 0, available: childOffers.length > 0, provenanceOfferIds: [selection.offerId], childContributorOfferIds: childOffers, checkedContributorOfferIds: checked });
    }
    if (groups.size || financialLeaves.length) offers.push({ sourceKind: 'parent', source: parent, jobGroups: [...groups.values()], financialLeaves });
  }
  return offers;
}

export type GlobalIntentGroup = { job: Entity; leaves: UpstreamLeaf[] };
export type GlobalIntentMatches = { jobGroups: GlobalIntentGroup[]; directLeaves: UpstreamLeaf[] };
export type GlobalIntentDiscovery = GlobalIntentMatches & {
  titleMatches: GlobalIntentMatches;
  kindShortcutMatches: { kind: ConnectionPickerKind; label: string }[];
};
const discoveryKindTerms: Record<ConnectionPickerKind, { label: string; aliases: string[] }> = {
  core_functional_job: { label: 'Core Functional Job', aliases: ['core', 'functional', 'job'] },
  related_job: { label: 'Related Job', aliases: ['related', 'job'] },
  consumption_chain_job: { label: 'Consumption Chain Job', aliases: ['consumption', 'chain', 'job'] },
  desired_outcome: { label: 'Desired Outcome', aliases: ['desired', 'outcome', 'do'] },
  emotional_job: { label: 'Emotional Job', aliases: ['emotional', 'emotion', 'job'] },
  social_job: { label: 'Social Job', aliases: ['social', 'job'] },
  financial_desired_outcome: { label: 'Financial Desired Outcome', aliases: ['financial', 'desired', 'outcome', 'fdo'] },
};
export function globalIntentDiscovery(document: MapDocument, input: { query: string; kind?: ConnectionPickerKind | undefined }): GlobalIntentDiscovery {
  const query = input.query.trim().toLocaleLowerCase();
  const project = (kind: ConnectionPickerKind | undefined, titleQuery: string): GlobalIntentMatches => {
    const jobGroups: GlobalIntentGroup[] = []; const directLeaves: UpstreamLeaf[] = [];
    for (const entity of document.entities) {
    if (doBearing.has(entity.kind)) {
      const outcomes = document.relationships.flatMap(relation => relation.kind === 'job_has_desired_outcome' && relation.jobId === entity.id ? document.entities.filter(candidate => candidate.id === relation.desiredOutcomeId && candidate.kind === 'desired_outcome') : []);
      const jobMatches = !titleQuery || entity.title.toLocaleLowerCase().includes(titleQuery);
      const visible = kind === 'desired_outcome'
        ? outcomes
        : (!kind || kind === entity.kind) ? outcomes.filter(outcome => jobMatches || outcome.title.toLocaleLowerCase().includes(titleQuery)) : [];
      const titleVisible = kind === 'desired_outcome' && titleQuery ? visible.filter(outcome => outcome.title.toLocaleLowerCase().includes(titleQuery)) : visible;
      if (titleVisible.length) jobGroups.push({ job: entity, leaves: titleVisible.map(outcome => ({ kind: 'desired-outcome', entity: outcome, semanticId: outcome.id, sourceId: 'global', contributorOfferId: '', checkboxId: `global:${entity.id}:${outcome.id}`, checked: false, available: true, owningJobId: entity.id })) });
    } else if ((direct.has(entity.kind) || entity.kind === 'financial_desired_outcome') && (!kind || kind === entity.kind) && (!titleQuery || entity.title.toLocaleLowerCase().includes(titleQuery))) directLeaves.push({ kind: entity.kind === 'financial_desired_outcome' ? 'financial' : 'job', entity, semanticId: entity.id, sourceId: 'global', contributorOfferId: '', checkboxId: `global:${entity.id}`, checked: false, available: true });
    }
    return { jobGroups, directLeaves };
  };
  const titleMatches = query ? project(undefined, query) : { jobGroups: [], directLeaves: [] };
  const kindShortcutMatches = query ? CONNECTION_PICKER_KINDS.flatMap(kind => {
    const terms = discoveryKindTerms[kind];
    return terms.label.toLocaleLowerCase().includes(query) || terms.aliases.some(alias => alias.includes(query) || query.includes(alias)) ? [{ kind, label: terms.label }] : [];
  }) : [];
  const visible = input.kind ? project(input.kind, '') : titleMatches;
  return { ...visible, titleMatches, kindShortcutMatches };
}
export const jobLeafKey = (leaf: Pick<TouchpointJobLeaf, 'semanticLeafId'>) => `job:${leaf.semanticLeafId}`;
export const financialLeafKey = (leaf: Pick<TouchpointFinancialLeaf, 'financialDesiredOutcomeId'>) => `financial:${leaf.financialDesiredOutcomeId}`;

export const CONNECTION_PICKER_KINDS = ['core_functional_job', 'related_job', 'consumption_chain_job', 'desired_outcome', 'emotional_job', 'social_job', 'financial_desired_outcome'] as const;
export type ConnectionPickerKind = typeof CONNECTION_PICKER_KINDS[number];
export type ConnectionCandidate =
  | { kind: 'job'; entity: Entity; semanticLeafId: string; desiredOutcome?: Entity }
  | { kind: 'financial'; entity: Entity; semanticLeafId: string; desiredOutcome?: undefined };

/** Builds searchable semantic candidates without introducing a second relationship model. */
export function connectionPickerCatalogue(document: MapDocument, ownerKind: 'product' | 'offer' | 'touchpoint'): ConnectionCandidate[] {
  const candidates = document.entities.flatMap((entity): ConnectionCandidate[] => {
    if (direct.has(entity.kind)) return [{ kind: 'job', entity, semanticLeafId: entity.id }];
    if (!doBearing.has(entity.kind)) return [];
    return document.relationships.flatMap(relation => {
      if (relation.kind !== 'job_has_desired_outcome' || relation.jobId !== entity.id) return [];
      const desiredOutcome = document.entities.find(candidate => candidate.id === relation.desiredOutcomeId && candidate.kind === 'desired_outcome');
      return desiredOutcome ? [{ kind: 'job' as const, entity, semanticLeafId: desiredOutcome.id, desiredOutcome }] : [];
    });
  });
  if (ownerKind !== 'product') candidates.push(...document.entities.filter(entity => entity.kind === 'financial_desired_outcome').map(entity => ({ kind: 'financial' as const, entity, semanticLeafId: entity.id })));
  return candidates;
}

export function filterConnectionCandidates(candidates: ConnectionCandidate[], input: { query: string; kind?: ConnectionPickerKind | undefined }): ConnectionCandidate[] {
  const query = input.query.trim().toLocaleLowerCase();
  return candidates.filter(candidate => {
    if (input.kind && candidate.entity.kind !== input.kind) return false;
    return !query || candidate.entity.title.toLocaleLowerCase().includes(query) || candidate.desiredOutcome?.title.toLocaleLowerCase().includes(query);
  });
}

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

/** Projects only committed Touchpoint intent into an owner-aware Client-side read model. */
export function touchpointClientScope(document: MapDocument, touchpointId: string): TouchpointClientScope {
  const durable = createTouchpointIntentDraft(document, touchpointId);
  const selectedKeys = new Set(durable.durableBranchSnapshot.touchpointIntentLeafIds);
  const selectedJobLeaves = durable.jobLeaves.filter((leaf) => selectedKeys.has(jobLeafKey(leaf)));
  const jobGroups = document.entities.flatMap((job): TouchpointClientScope['jobGroups'] => {
    if (!doBearing.has(job.kind) && !direct.has(job.kind)) return [];
    const leaves = selectedJobLeaves.filter((leaf) => leaf.jobId === job.id);
    if (!leaves.length) return [];
    if (direct.has(job.kind)) {
      const leaf = leaves.find((candidate) => candidate.semanticLeafId === job.id);
      return leaf ? [{ job, semanticLeafId: leaf.semanticLeafId, contributorOfferIds: [...leaf.contributorOfferIds], desiredOutcomes: [] }] : [];
    }
    const desiredOutcomes = leaves.flatMap((leaf) => {
      const entity = document.entities.find((candidate) => candidate.id === leaf.desiredOutcomeId && candidate.kind === 'desired_outcome');
      return entity ? [{ entity, semanticLeafId: leaf.semanticLeafId, contributorOfferIds: [...leaf.contributorOfferIds] }] : [];
    });
    return desiredOutcomes.length ? [{ job, desiredOutcomes }] : [];
  });
  const financialLeaves = durable.financialLeaves.flatMap((leaf) => {
    if (!selectedKeys.has(financialLeafKey(leaf))) return [];
    const entity = document.entities.find((candidate) => candidate.id === leaf.financialDesiredOutcomeId && candidate.kind === 'financial_desired_outcome');
    return entity ? [{ entity, semanticLeafId: leaf.financialDesiredOutcomeId, contributorOfferIds: [...leaf.contributorOfferIds] }] : [];
  });
  return { jobGroups, financialLeaves };
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

/** Immediately commits the complete target Offer set from a fresh durable Touchpoint snapshot. */
export function commitTouchpointLinkedOffers(document: MapDocument, input: { touchpointId: string; linkedOfferIds: string[]; confirmedRemoval?: boolean; newId: () => string }): MapDocument {
  const touchpoint = document.entities.find(entity => entity.id === input.touchpointId);
  if (touchpoint?.kind !== 'touchpoint') throw new Error('Touchpoint does not exist.');
  if (new Set(input.linkedOfferIds).size !== input.linkedOfferIds.length) throw new Error('An Offer cannot be linked more than once.');
  if (input.linkedOfferIds.some(id => !document.entities.some(entity => entity.id === id && entity.kind === 'offer'))) throw new Error('Linked Offers must be existing Offer entities.');
  const linkedOfferIds = [...input.linkedOfferIds];
  let touchpointIntent = createTouchpointIntentDraft(document, touchpoint.id);
  if (input.confirmedRemoval) touchpointIntent = {
    ...touchpointIntent,
    jobLeaves: touchpointIntent.jobLeaves.map(leaf => ({ ...leaf, contributorOfferIds: leaf.contributorOfferIds.filter(id => linkedOfferIds.includes(id)) })),
    financialLeaves: touchpointIntent.financialLeaves.map(leaf => ({ ...leaf, contributorOfferIds: leaf.contributorOfferIds.filter(id => linkedOfferIds.includes(id)) })),
  };
  const parentTouchpointId = document.relationships.find((relation): relation is Extract<MapDocument['relationships'][number], { kind: 'touchpoint_contains_touchpoint' }> => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === touchpoint.id)?.parentTouchpointId ?? '';
  return applyTouchpointEditDraft(document, { touchpointId: touchpoint.id, newId: input.newId, draft: {
    title: touchpoint.title, linkedOfferIds, parentTouchpointId,
    locatedInId: touchpoint.locatedInId ?? '',
    locatedInQuery: document.touchpointContainers.find(container => container.id === touchpoint.locatedInId)?.title ?? '',
    locationDraft: touchpoint.locatedInId ? { kind: 'existing', containerId: touchpoint.locatedInId } : { kind: 'none' },
    url: touchpoint.url ?? '',
    mitigatedRepulsorIds: document.relationships.flatMap(relation => relation.kind === 'touchpoint_mitigates_repulsor' && relation.touchpointId === touchpoint.id ? [relation.repulsorId] : []),
    touchpointIntent,
  } });
}

/** Immediately commits a parent from a fresh durable Touchpoint snapshot. */
export function commitTouchpointParent(document: MapDocument, input: { touchpointId: string; parentTouchpointId: string; newId: () => string }): MapDocument {
  const touchpoint = document.entities.find(entity => entity.id === input.touchpointId);
  if (touchpoint?.kind !== 'touchpoint') throw new Error('Touchpoint does not exist.');
  if (input.parentTouchpointId && !document.entities.some(entity => entity.id === input.parentTouchpointId && entity.kind === 'touchpoint')) throw new Error('Parent must be an existing Touchpoint.');
  const currentParentId = document.relationships.find((relation): relation is Extract<MapDocument['relationships'][number], { kind: 'touchpoint_contains_touchpoint' }> => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === touchpoint.id)?.parentTouchpointId ?? '';
  if (currentParentId === input.parentTouchpointId) return document;
  const linkedOfferIds = document.relationships.flatMap(relation => relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === touchpoint.id ? [relation.offerId] : []);
  return applyTouchpointEditDraft(document, { touchpointId: touchpoint.id, newId: input.newId, draft: {
    title: touchpoint.title, linkedOfferIds, parentTouchpointId: input.parentTouchpointId,
    locatedInId: touchpoint.locatedInId ?? '',
    locatedInQuery: document.touchpointContainers.find(container => container.id === touchpoint.locatedInId)?.title ?? '',
    locationDraft: touchpoint.locatedInId ? { kind: 'existing', containerId: touchpoint.locatedInId } : { kind: 'none' },
    url: touchpoint.url ?? '',
    mitigatedRepulsorIds: document.relationships.flatMap(relation => relation.kind === 'touchpoint_mitigates_repulsor' && relation.touchpointId === touchpoint.id ? [relation.repulsorId] : []),
    touchpointIntent: createTouchpointIntentDraft(document, touchpoint.id),
  } });
}

type TouchpointBusinessPropertyInput =
  | { property: 'url'; url: string }
  | { property: 'located-in'; location: { kind: 'none' } | { kind: 'existing'; containerId: string } | { kind: 'new'; id: string; title: string } };

/** Commits one documentary Business property from current durable topology. */
export function commitTouchpointBusinessProperty(document: MapDocument, input: { touchpointId: string } & TouchpointBusinessPropertyInput): MapDocument {
  const touchpoint = document.entities.find((entity) => entity.id === input.touchpointId);
  if (touchpoint?.kind !== 'touchpoint') throw new Error('Touchpoint does not exist.');

  let next = document;
  let locatedInId = touchpoint.locatedInId;
  if (input.property === 'located-in') {
    if (input.location.kind === 'new') {
      const title = input.location.title.trim();
      if (!title) throw new Error('Located in requires a name.');
      const existing = document.touchpointContainers.find((container) => container.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase());
      locatedInId = existing?.id ?? input.location.id;
      if (!existing) next = addTouchpointContainer(next, { id: input.location.id, title });
    } else locatedInId = input.location.kind === 'existing' ? input.location.containerId : undefined;
  }

  const linkedOffers = document.relationships.filter((relation): relation is Extract<MapDocument['relationships'][number], { kind: 'offer_presented_at_touchpoint' }> => relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === touchpoint.id);
  const parent = document.relationships.find((relation): relation is Extract<MapDocument['relationships'][number], { kind: 'touchpoint_contains_touchpoint' }> => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === touchpoint.id);
  const url = input.property === 'url' ? input.url : touchpoint.url;
  const normalizedUrl = url?.trim() ?? '';
  if (locatedInId === touchpoint.locatedInId && normalizedUrl === (touchpoint.url ?? '')) return document;
  return updateEntity(next, {
    entityId: touchpoint.id,
    title: touchpoint.title,
    ...(locatedInId ? { locatedInId } : {}),
    ...(normalizedUrl ? { url: normalizedUrl } : {}),
    linkedOfferIds: linkedOffers.map((relation) => relation.offerId),
    relationshipIds: linkedOffers.map((relation) => relation.id),
    ...(parent ? { parentTouchpointId: parent.parentTouchpointId, parentRelationshipId: parent.id } : {}),
  });
}

/** Builds the complete Touchpoint edit transaction without mutating the durable input document. */
export function applyTouchpointEditDraft(document: MapDocument, input: { touchpointId: string; draft: TouchpointEditDraft; newId: () => string }): MapDocument {
  const validationError = validateTouchpointIntentDraft(input.draft.touchpointIntent, input.draft.linkedOfferIds);
  if (validationError) throw new Error(validationError);
  // Structural/property commits carry a durable intent snapshot. Only an actual
  // semantic edit owns bottom-up propagation through the resulting ancestry.
  const intentChanged = !equalTouchpointIntentDraft(input.draft.touchpointIntent, createTouchpointIntentDraft(document, input.touchpointId));

  let next = document;
  let locatedInId = input.draft.locatedInId;
  if (input.draft.locationDraft.kind === 'new') {
    const title = input.draft.locationDraft.title.trim();
    if (!title) throw new Error('Located in requires a name.');
    const existing = next.touchpointContainers.find(container => container.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase());
    locatedInId = existing?.id ?? input.newId();
    if (!existing) next = addTouchpointContainer(next, { id: locatedInId, title });
  } else if (input.draft.locationDraft.kind === 'existing') locatedInId = input.draft.locationDraft.containerId;

  const oldOffers = document.relationships.filter((relation): relation is Extract<MapDocument['relationships'][number], { kind: 'offer_presented_at_touchpoint' }> => relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === input.touchpointId);
  const parent = document.relationships.find(relation => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === input.touchpointId);
  next = updateEntity(next, {
    entityId: input.touchpointId,
    title: input.draft.title,
    locatedInId,
    url: input.draft.url,
    linkedOfferIds: input.draft.linkedOfferIds,
    relationshipIds: input.draft.linkedOfferIds.map(offerId => oldOffers.find(relation => relation.offerId === offerId)?.id ?? input.newId()),
    ...(input.draft.parentTouchpointId ? { parentTouchpointId: input.draft.parentTouchpointId, parentRelationshipId: parent?.id ?? input.newId() } : {}),
  });
  if (intentChanged) next = applyTouchpointIntentDraft(next, { touchpointId: input.touchpointId, draft: input.draft.touchpointIntent, newId: input.newId });

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
