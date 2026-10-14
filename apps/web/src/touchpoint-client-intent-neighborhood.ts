import { isDesiredOutcomeBearingJob,
  effectiveOfferDesiredOutcomeIds,
  type CanonicalMapDocument,
  type MapReadDocument,
  type MapDocument,
} from '@vee/domain';

export const TOUCHPOINT_CLIENT_INTENT_GROUND_TYPE_IDS = [
  'core_functional_job',
  'related_job',
  'consumption_chain_job',
  'emotional_job',
  'social_job',
  'financial_desired_outcome',
] as const;

export type TouchpointClientIntentGroundTypeId = typeof TOUCHPOINT_CLIENT_INTENT_GROUND_TYPE_IDS[number];
export type TouchpointClientIntentJobKind = Exclude<TouchpointClientIntentGroundTypeId, 'financial_desired_outcome'>;

export const CANONICAL_TOUCHPOINT_CLIENT_INTENT_GROUND_TYPE_IDS = ['functional_job', 'consumption_chain_job', 'emotional_job', 'social_job', 'financial_desired_outcome'] as const;
export type CanonicalTouchpointClientIntentJobKind = Exclude<typeof CANONICAL_TOUCHPOINT_CLIENT_INTENT_GROUND_TYPE_IDS[number], 'financial_desired_outcome'>;
type ReadGroundTypeId = TouchpointClientIntentGroundTypeId | 'functional_job';
type ReadJobKind = Exclude<ReadGroundTypeId, 'financial_desired_outcome'>;
type ReadEntity = MapReadDocument['entities'][number];
const READ_GROUND_TYPE_IDS = ['functional_job', ...TOUCHPOINT_CLIENT_INTENT_GROUND_TYPE_IDS] as const;

export interface TouchpointDesiredOutcomeDetail {
  desiredOutcomeId: string;
  contributorOfferIds: string[];
}

interface TouchpointClientIntentGroundBase<K extends ReadGroundTypeId = TouchpointClientIntentGroundTypeId> {
  id: string;
  groundTypeId: K;
  basisId: string;
  neighborTouchpointIds: string[];
  count: number;
}

export interface TouchpointClientIntentJobComparison {
  touchpointId: string;
  contributorOfferIds: string[];
  desiredOutcomes: TouchpointDesiredOutcomeDetail[];
  commonDesiredOutcomeIds: string[];
  inspectedOnlyDesiredOutcomeIds: string[];
  neighborOnlyDesiredOutcomeIds: string[];
}

export interface TouchpointClientIntentJobGround<K extends ReadJobKind = TouchpointClientIntentJobKind> extends TouchpointClientIntentGroundBase<K> {
  basisKind: 'job';
  groundTypeId: K;
  jobId: string;
  jobKind: K;
  inspectedContributorOfferIds: string[];
  inspectedDesiredOutcomes: TouchpointDesiredOutcomeDetail[];
  neighborComparisons: TouchpointClientIntentJobComparison[];
}

export interface TouchpointClientIntentFinancialComparison {
  touchpointId: string;
  contributorOfferIds: string[];
}

export interface TouchpointClientIntentFinancialDesiredOutcomeGround extends TouchpointClientIntentGroundBase {
  basisKind: 'financial_desired_outcome';
  groundTypeId: 'financial_desired_outcome';
  financialDesiredOutcomeId: string;
  inspectedContributorOfferIds: string[];
  neighborComparisons: TouchpointClientIntentFinancialComparison[];
}

export type TouchpointClientIntentGround<K extends ReadJobKind = TouchpointClientIntentJobKind> =
  | TouchpointClientIntentJobGround<K>
  | TouchpointClientIntentFinancialDesiredOutcomeGround;

export interface TouchpointClientIntentNeighborhood<K extends ReadJobKind = TouchpointClientIntentJobKind> {
  touchpointId: string;
  grounds: TouchpointClientIntentGround<K>[];
}

export type CanonicalTouchpointClientIntentNeighborhood = TouchpointClientIntentNeighborhood<CanonicalTouchpointClientIntentJobKind>;
export type TouchpointClientIntentNeighborhoodRead = TouchpointClientIntentNeighborhood<ReadJobKind>;
type Job = ReadEntity & { kind: ReadJobKind };
type JobScope = {
  job: Job;
  contributorOfferIds: Set<string>;
  desiredOutcomeContributors: Map<string, Set<string>>;
};
type FinancialDesiredOutcome = { id: string; title: string; kind: 'financial_desired_outcome' };
type FinancialScope = { outcome: FinancialDesiredOutcome; contributorOfferIds: Set<string> };

const readJob = (entity: ReadEntity): entity is Job => READ_GROUND_TYPE_IDS.some(kind => kind !== 'financial_desired_outcome' && kind === entity.kind);
const readFinancialOutcome = (entity: ReadEntity): entity is ReadEntity & FinancialDesiredOutcome => entity.kind === 'financial_desired_outcome';
const TYPE_ORDER = new Map<ReadGroundTypeId, number>(READ_GROUND_TYPE_IDS.map((kind, index) => [kind, index]));
const byTitleThenId = <T extends { title: string; id: string }>(left: T, right: T) =>
  left.title.localeCompare(right.title) || left.id.localeCompare(right.id);

/** Derives locally authored Touchpoint Client-intent intersections without mutating domain state. */
export function deriveTouchpointClientIntentNeighborhood(document: MapDocument, inspectedTouchpointId: string): TouchpointClientIntentNeighborhood | undefined;
export function deriveTouchpointClientIntentNeighborhood(document: CanonicalMapDocument, inspectedTouchpointId: string): CanonicalTouchpointClientIntentNeighborhood | undefined;
export function deriveTouchpointClientIntentNeighborhood(document: MapReadDocument, inspectedTouchpointId: string): TouchpointClientIntentNeighborhoodRead | undefined;
export function deriveTouchpointClientIntentNeighborhood(document: MapReadDocument, inspectedTouchpointId: string): TouchpointClientIntentNeighborhoodRead | undefined {
  const entitiesById = new Map(document.entities.map((entity) => [entity.id, entity]));
  const inspected = entitiesById.get(inspectedTouchpointId);
  if (inspected?.kind !== 'touchpoint') return undefined;

  const touchpointsById = new Map(document.entities.flatMap((entity) =>
    entity.kind === 'touchpoint' ? [[entity.id, entity] as const] : [],
  ));
  const offersById = new Map(document.entities.flatMap((entity) =>
    entity.kind === 'offer' ? [[entity.id, entity] as const] : [],
  ));
  const intentsById = new Map(document.productJobIntents.map((intent) => [intent.id, intent]));
  const linkedOfferPaths = new Set(document.relationships.flatMap((relationship) =>
    relationship.kind === 'offer_presented_at_touchpoint'
      ? [`${relationship.touchpointId}\u0000${relationship.offerId}`]
      : [],
  ));
  const offerSelectionsByPath = new Map<string, typeof document.offerJobSelections>();
  for (const selection of document.offerJobSelections) {
    if (!offersById.has(selection.offerId) || !intentsById.has(selection.productJobIntentId)) continue;
    const key = `${selection.offerId}\u0000${selection.productJobIntentId}`;
    const selections = offerSelectionsByPath.get(key) ?? [];
    selections.push(selection);
    offerSelectionsByPath.set(key, selections);
  }

  const scopesByTouchpoint = new Map<string, Map<string, JobScope>>();
  for (const selection of document.touchpointJobSelections) {
    if (!touchpointsById.has(selection.touchpointId) || !offersById.has(selection.offerId)) continue;
    if (!linkedOfferPaths.has(`${selection.touchpointId}\u0000${selection.offerId}`)) continue;
    const intent = intentsById.get(selection.productJobIntentId);
    const jobEntity = intent ? entitiesById.get(intent.jobId) : undefined;
    if (!jobEntity || !readJob(jobEntity)) continue;
    const offerSelections = offerSelectionsByPath.get(`${selection.offerId}\u0000${selection.productJobIntentId}`);
    if (!offerSelections?.length) continue;

    const job = jobEntity;
    const validOutcomeIds = new Set<string>();
    if (isDesiredOutcomeBearingJob(job.kind)) {
      const offerOutcomeIds = new Set(offerSelections.flatMap((offerSelection) =>
        effectiveOfferDesiredOutcomeIds(document, offerSelection),
      ));
      for (const outcomeId of new Set(selection.addressedDesiredOutcomeIds)) {
        if (!offerOutcomeIds.has(outcomeId)) continue;
        const outcome = entitiesById.get(outcomeId);
        if (outcome?.kind !== 'desired_outcome') continue;
        if (!document.relationships.some((relationship) =>
          relationship.kind === 'job_has_desired_outcome'
          && relationship.jobId === job.id
          && relationship.desiredOutcomeId === outcomeId)) continue;
        validOutcomeIds.add(outcomeId);
      }
      if (!validOutcomeIds.size) continue;
    }

    const touchpointScopes = scopesByTouchpoint.get(selection.touchpointId) ?? new Map<string, JobScope>();
    const scope = touchpointScopes.get(job.id) ?? {
      job,
      contributorOfferIds: new Set<string>(),
      desiredOutcomeContributors: new Map<string, Set<string>>(),
    };
    scope.contributorOfferIds.add(selection.offerId);
    for (const outcomeId of validOutcomeIds) {
      const contributors = scope.desiredOutcomeContributors.get(outcomeId) ?? new Set<string>();
      contributors.add(selection.offerId);
      scope.desiredOutcomeContributors.set(outcomeId, contributors);
    }
    touchpointScopes.set(job.id, scope);
    scopesByTouchpoint.set(selection.touchpointId, touchpointScopes);
  }

  const financialScopesByTouchpoint = new Map<string, Map<string, FinancialScope>>();
  const financialIntentsById = new Map(document.offerFinancialIntents.map((intent) => [intent.id, intent]));
  for (const selection of document.touchpointFinancialSelections) {
    if (!touchpointsById.has(selection.touchpointId) || !offersById.has(selection.offerId)) continue;
    if (!linkedOfferPaths.has(`${selection.touchpointId}\u0000${selection.offerId}`)) continue;
    const intent = financialIntentsById.get(selection.offerFinancialIntentId);
    if (!intent || intent.offerId !== selection.offerId
      || intent.financialDesiredOutcomeId !== selection.financialDesiredOutcomeId) continue;
    const outcome = entitiesById.get(selection.financialDesiredOutcomeId);
    if (!outcome || !readFinancialOutcome(outcome)) continue;
    const touchpointScopes = financialScopesByTouchpoint.get(selection.touchpointId) ?? new Map<string, FinancialScope>();
    const scope = touchpointScopes.get(outcome.id) ?? {
      outcome,
      contributorOfferIds: new Set<string>(),
    };
    scope.contributorOfferIds.add(selection.offerId);
    touchpointScopes.set(outcome.id, scope);
    financialScopesByTouchpoint.set(selection.touchpointId, touchpointScopes);
  }

  const sortEntityIds = <T extends { id: string; title: string }>(ids: Iterable<string>, candidates: Map<string, T>) => [...new Set(ids)]
    .flatMap((id) => candidates.get(id) ? [candidates.get(id)!] : [])
    .sort(byTitleThenId)
    .map((entity) => entity.id);
  const sortOfferIds = (ids: Iterable<string>) => sortEntityIds(ids, offersById);
  const sortOutcomeIds = (ids: Iterable<string>) => sortEntityIds(ids, new Map(document.entities.flatMap((entity) =>
    entity.kind === 'desired_outcome' ? [[entity.id, entity] as const] : [],
  )));
  const outcomeDetails = (scope: JobScope) => sortOutcomeIds(scope.desiredOutcomeContributors.keys()).map((desiredOutcomeId) => ({
    desiredOutcomeId,
    contributorOfferIds: sortOfferIds(scope.desiredOutcomeContributors.get(desiredOutcomeId) ?? []),
  }));
  const grounds: TouchpointClientIntentNeighborhoodRead['grounds'] = [];

  for (const inspectedScope of scopesByTouchpoint.get(inspected.id)?.values() ?? []) {
    const comparisons = [...touchpointsById.values()].filter((touchpoint) => touchpoint.id !== inspected.id)
      .flatMap((touchpoint): TouchpointClientIntentJobComparison[] => {
        const neighborScope = scopesByTouchpoint.get(touchpoint.id)?.get(inspectedScope.job.id);
        if (!neighborScope) return [];
        const inspectedIds = new Set(inspectedScope.desiredOutcomeContributors.keys());
        const neighborIds = new Set(neighborScope.desiredOutcomeContributors.keys());
        return [{
          touchpointId: touchpoint.id,
          contributorOfferIds: sortOfferIds(neighborScope.contributorOfferIds),
          desiredOutcomes: outcomeDetails(neighborScope),
          commonDesiredOutcomeIds: sortOutcomeIds([...inspectedIds].filter((id) => neighborIds.has(id))),
          inspectedOnlyDesiredOutcomeIds: sortOutcomeIds([...inspectedIds].filter((id) => !neighborIds.has(id))),
          neighborOnlyDesiredOutcomeIds: sortOutcomeIds([...neighborIds].filter((id) => !inspectedIds.has(id))),
        }];
      }).sort((left, right) => byTitleThenId(touchpointsById.get(left.touchpointId)!, touchpointsById.get(right.touchpointId)!));
    if (!comparisons.length) continue;
    const neighborTouchpointIds = comparisons.map((comparison) => comparison.touchpointId);
    grounds.push({
      id: `client-intent:${inspectedScope.job.kind}:${inspectedScope.job.id}`,
      groundTypeId: inspectedScope.job.kind,
      basisId: inspectedScope.job.id,
      basisKind: 'job',
      jobId: inspectedScope.job.id,
      jobKind: inspectedScope.job.kind,
      inspectedContributorOfferIds: sortOfferIds(inspectedScope.contributorOfferIds),
      inspectedDesiredOutcomes: outcomeDetails(inspectedScope),
      neighborTouchpointIds,
      count: neighborTouchpointIds.length,
      neighborComparisons: comparisons,
    });
  }

  for (const inspectedScope of financialScopesByTouchpoint.get(inspected.id)?.values() ?? []) {
    const comparisons = [...touchpointsById.values()].filter((touchpoint) => touchpoint.id !== inspected.id)
      .flatMap((touchpoint): TouchpointClientIntentFinancialComparison[] => {
        const scope = financialScopesByTouchpoint.get(touchpoint.id)?.get(inspectedScope.outcome.id);
        return scope ? [{ touchpointId: touchpoint.id, contributorOfferIds: sortOfferIds(scope.contributorOfferIds) }] : [];
      }).sort((left, right) => byTitleThenId(touchpointsById.get(left.touchpointId)!, touchpointsById.get(right.touchpointId)!));
    if (!comparisons.length) continue;
    const neighborTouchpointIds = comparisons.map((comparison) => comparison.touchpointId);
    grounds.push({
      id: `client-intent:financial_desired_outcome:${inspectedScope.outcome.id}`,
      groundTypeId: 'financial_desired_outcome',
      basisId: inspectedScope.outcome.id,
      basisKind: 'financial_desired_outcome',
      financialDesiredOutcomeId: inspectedScope.outcome.id,
      inspectedContributorOfferIds: sortOfferIds(inspectedScope.contributorOfferIds),
      neighborTouchpointIds,
      count: neighborTouchpointIds.length,
      neighborComparisons: comparisons,
    });
  }

  grounds.sort((left, right) => TYPE_ORDER.get(left.groundTypeId)! - TYPE_ORDER.get(right.groundTypeId)!
    || byTitleThenId(entitiesById.get(left.basisId)!, entitiesById.get(right.basisId)!));
  return { touchpointId: inspected.id, grounds };
}
