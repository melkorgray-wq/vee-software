import { isDesiredOutcomeBearingJob,
  effectiveOfferDesiredOutcomeIds,
  type CanonicalMapDocument,
  type MapDocument,
  type MapReadDocument,
  type OfferJobSelection,
} from '@vee/domain';

export const OFFER_CLIENT_INTENT_GROUND_TYPE_IDS = [
  'core_functional_job',
  'related_job',
  'consumption_chain_job',
  'emotional_job',
  'social_job',
  'financial_desired_outcome',
] as const;

export type OfferClientIntentGroundTypeId = typeof OFFER_CLIENT_INTENT_GROUND_TYPE_IDS[number];
export type OfferClientIntentJobKind = Exclude<OfferClientIntentGroundTypeId, 'financial_desired_outcome'>;

export const CANONICAL_OFFER_CLIENT_INTENT_GROUND_TYPE_IDS = ['functional_job', 'consumption_chain_job', 'emotional_job', 'social_job', 'financial_desired_outcome'] as const;
export type CanonicalOfferClientIntentJobKind = Exclude<typeof CANONICAL_OFFER_CLIENT_INTENT_GROUND_TYPE_IDS[number], 'financial_desired_outcome'>;
type ReadGroundTypeId = OfferClientIntentGroundTypeId | 'functional_job';
type ReadJobKind = Exclude<ReadGroundTypeId, 'financial_desired_outcome'>;
type ReadEntity = MapReadDocument['entities'][number];
const READ_GROUND_TYPE_IDS = ['functional_job', ...OFFER_CLIENT_INTENT_GROUND_TYPE_IDS] as const;

interface OfferClientIntentGroundBase<K extends ReadGroundTypeId = OfferClientIntentGroundTypeId> {
  id: string;
  groundTypeId: K;
  basisId: string;
  neighborOfferIds: string[];
  count: number;
}

export interface OfferClientIntentJobComparison {
  offerId: string;
  desiredOutcomeIds: string[];
  commonDesiredOutcomeIds: string[];
  inspectedOnlyDesiredOutcomeIds: string[];
  neighborOnlyDesiredOutcomeIds: string[];
}

export interface OfferClientIntentJobGround<K extends ReadJobKind = OfferClientIntentJobKind> extends OfferClientIntentGroundBase<K> {
  basisKind: 'job';
  groundTypeId: K;
  jobId: string;
  jobKind: K;
  inspectedDesiredOutcomeIds: string[];
  neighborComparisons: OfferClientIntentJobComparison[];
}

export interface OfferClientIntentFinancialDesiredOutcomeGround extends OfferClientIntentGroundBase {
  basisKind: 'financial_desired_outcome';
  groundTypeId: 'financial_desired_outcome';
  financialDesiredOutcomeId: string;
}

export type OfferClientIntentGround<K extends ReadJobKind = OfferClientIntentJobKind> =
  | OfferClientIntentJobGround<K>
  | OfferClientIntentFinancialDesiredOutcomeGround;

export interface OfferClientIntentNeighborhood<K extends ReadJobKind = OfferClientIntentJobKind> {
  offerId: string;
  grounds: OfferClientIntentGround<K>[];
}

export type CanonicalOfferClientIntentNeighborhood = OfferClientIntentNeighborhood<CanonicalOfferClientIntentJobKind>;
export type OfferClientIntentNeighborhoodRead = OfferClientIntentNeighborhood<ReadJobKind>;
type Offer = Extract<ReadEntity, { kind: 'offer' }>;
type Job = ReadEntity & { kind: ReadJobKind };

const readJob = (entity: ReadEntity): entity is Job => READ_GROUND_TYPE_IDS.some(kind => kind !== 'financial_desired_outcome' && kind === entity.kind);
const TYPE_ORDER = new Map<ReadGroundTypeId, number>(READ_GROUND_TYPE_IDS.map((kind, index) => [kind, index]));

const byTitleThenId = <T extends { title: string; id: string }>(left: T, right: T) =>
  left.title.localeCompare(right.title) || left.id.localeCompare(right.id);

function validDesiredOutcomeIds(
  document: MapReadDocument,
  selection: OfferJobSelection,
  job: Job,
  entitiesById: Map<string, ReadEntity>,
): string[] {
  if (!isDesiredOutcomeBearingJob(job.kind)) return [];

  const ownedIds = new Set(document.relationships.flatMap((relationship) =>
    relationship.kind === 'job_has_desired_outcome' && relationship.jobId === job.id
      ? [relationship.desiredOutcomeId]
      : [],
  ));
  return [...new Set(effectiveOfferDesiredOutcomeIds(document, selection))]
    .flatMap((id) => {
      const entity = entitiesById.get(id);
      return entity?.kind === 'desired_outcome' && ownedIds.has(id) ? [entity] : [];
    })
    .sort(byTitleThenId)
    .map((entity) => entity.id);
}

/** Derives Offer-owned Client-intent intersections without creating domain relationships. */
export function deriveOfferClientIntentNeighborhood(document: MapDocument, inspectedOfferId: string): OfferClientIntentNeighborhood | undefined;
export function deriveOfferClientIntentNeighborhood(document: CanonicalMapDocument, inspectedOfferId: string): CanonicalOfferClientIntentNeighborhood | undefined;
export function deriveOfferClientIntentNeighborhood(document: MapReadDocument, inspectedOfferId: string): OfferClientIntentNeighborhoodRead | undefined;
export function deriveOfferClientIntentNeighborhood(document: MapReadDocument, inspectedOfferId: string): OfferClientIntentNeighborhoodRead | undefined {
  const inspectedOffer = document.entities.find(
    (entity): entity is Offer => entity.id === inspectedOfferId && entity.kind === 'offer',
  );
  if (!inspectedOffer) return undefined;

  const entitiesById = new Map(document.entities.map((entity) => [entity.id, entity]));
  const offersById = new Map(document.entities.flatMap((entity) =>
    entity.kind === 'offer' ? [[entity.id, entity] as const] : [],
  ));
  const intentsById = new Map(document.productJobIntents.map((intent) => [intent.id, intent]));
  const jobScopesByOffer = new Map<string, Map<string, { job: Job; desiredOutcomeIds: Set<string> }>>();

  for (const selection of document.offerJobSelections) {
    const offer = offersById.get(selection.offerId);
    const intent = intentsById.get(selection.productJobIntentId);
    const jobEntity = intent ? entitiesById.get(intent.jobId) : undefined;
    if (!offer || !jobEntity || !readJob(jobEntity)) continue;
    const job = jobEntity;
    const offerJobs = jobScopesByOffer.get(offer.id) ?? new Map();
    const scope = offerJobs.get(job.id) ?? { job, desiredOutcomeIds: new Set<string>() };
    for (const outcomeId of validDesiredOutcomeIds(document, selection, job, entitiesById)) {
      scope.desiredOutcomeIds.add(outcomeId);
    }
    offerJobs.set(job.id, scope);
    jobScopesByOffer.set(offer.id, offerJobs);
  }

  const desiredOutcomesById = new Map(document.entities.flatMap((entity) =>
    entity.kind === 'desired_outcome' ? [[entity.id, entity] as const] : [],
  ));
  const sortDesiredOutcomeIds = (ids: Iterable<string>) => [...ids]
    .flatMap((id) => {
      const outcome = desiredOutcomesById.get(id);
      return outcome ? [outcome] : [];
    })
    .sort(byTitleThenId)
    .map((outcome) => outcome.id);
  const grounds: OfferClientIntentNeighborhoodRead['grounds'] = [];

  for (const inspectedScope of jobScopesByOffer.get(inspectedOffer.id)?.values() ?? []) {
    const comparisons = [...offersById.values()]
      .filter((offer) => offer.id !== inspectedOffer.id)
      .flatMap((offer): OfferClientIntentJobComparison[] => {
        const neighborScope = jobScopesByOffer.get(offer.id)?.get(inspectedScope.job.id);
        if (!neighborScope) return [];
        const inspectedIds = inspectedScope.desiredOutcomeIds;
        const neighborIds = neighborScope.desiredOutcomeIds;
        return [{
          offerId: offer.id,
          desiredOutcomeIds: sortDesiredOutcomeIds(neighborIds),
          commonDesiredOutcomeIds: sortDesiredOutcomeIds([...inspectedIds].filter((id) => neighborIds.has(id))),
          inspectedOnlyDesiredOutcomeIds: sortDesiredOutcomeIds([...inspectedIds].filter((id) => !neighborIds.has(id))),
          neighborOnlyDesiredOutcomeIds: sortDesiredOutcomeIds([...neighborIds].filter((id) => !inspectedIds.has(id))),
        }];
      })
      .sort((left, right) => byTitleThenId(offersById.get(left.offerId)!, offersById.get(right.offerId)!));
    if (!comparisons.length) continue;
    const neighborOfferIds = comparisons.map((comparison) => comparison.offerId);
    grounds.push({
      id: `client-intent:${inspectedScope.job.kind}:${inspectedScope.job.id}`,
      groundTypeId: inspectedScope.job.kind,
      basisId: inspectedScope.job.id,
      basisKind: 'job',
      jobId: inspectedScope.job.id,
      jobKind: inspectedScope.job.kind,
      inspectedDesiredOutcomeIds: sortDesiredOutcomeIds(inspectedScope.desiredOutcomeIds),
      neighborOfferIds,
      count: neighborOfferIds.length,
      neighborComparisons: comparisons,
    });
  }

  const financialOffersByOutcome = new Map<string, Set<string>>();
  for (const intent of document.offerFinancialIntents) {
    if (!offersById.has(intent.offerId)) continue;
    const outcome = entitiesById.get(intent.financialDesiredOutcomeId);
    if (outcome?.kind !== 'financial_desired_outcome') continue;
    const offerIds = financialOffersByOutcome.get(outcome.id) ?? new Set<string>();
    offerIds.add(intent.offerId);
    financialOffersByOutcome.set(outcome.id, offerIds);
  }
  for (const [outcomeId, offerIds] of financialOffersByOutcome) {
    if (!offerIds.has(inspectedOffer.id)) continue;
    const neighborOfferIds = [...offerIds]
      .filter((id) => id !== inspectedOffer.id)
      .sort((left, right) => byTitleThenId(offersById.get(left)!, offersById.get(right)!));
    if (!neighborOfferIds.length) continue;
    grounds.push({
      id: `client-intent:financial_desired_outcome:${outcomeId}`,
      groundTypeId: 'financial_desired_outcome',
      basisId: outcomeId,
      basisKind: 'financial_desired_outcome',
      financialDesiredOutcomeId: outcomeId,
      neighborOfferIds,
      count: neighborOfferIds.length,
    });
  }

  grounds.sort((left, right) => {
    const typeDifference = TYPE_ORDER.get(left.groundTypeId)! - TYPE_ORDER.get(right.groundTypeId)!;
    if (typeDifference) return typeDifference;
    return byTitleThenId(entitiesById.get(left.basisId)!, entitiesById.get(right.basisId)!);
  });
  return { offerId: inspectedOffer.id, grounds };
}
