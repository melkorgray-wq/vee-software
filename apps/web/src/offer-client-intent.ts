import { isDesiredOutcomeBearingJob,
  effectiveOfferDesiredOutcomeIds,
  type Entity,
  type MapDocument,
  type OfferJobSelection,
  type ProductJobIntent,
} from '@vee/domain';
import { clientIntentKindShortcutMatches, clientIntentTitleMatches, normalizeClientIntentQuery, type ClientIntentDiscoveryKind } from './client-intent-discovery';

export const OFFER_CLIENT_INTENT_KINDS = [
  'core_functional_job',
  'related_job',
  'consumption_chain_job',
  'emotional_job',
  'social_job',
  'financial_desired_outcome',
] as const;

export type OfferClientIntentKind = typeof OFFER_CLIENT_INTENT_KINDS[number];
export type OfferClientIntentJobKind = Exclude<OfferClientIntentKind, 'financial_desired_outcome'>;

type JobEntity<K extends OfferClientIntentJobKind = OfferClientIntentJobKind> = Entity & { kind: K };
type DesiredOutcomeEntity = Entity & { kind: 'desired_outcome' };
type FinancialDesiredOutcomeEntity = Entity & { kind: 'financial_desired_outcome' };

export interface OfferClientIntentJobItem<K extends OfferClientIntentJobKind = OfferClientIntentJobKind> {
  id: string;
  kind: K;
  selectionId: string;
  productJobIntentId: string;
  jobId: string;
  job: JobEntity<K>;
  desiredOutcomeIds: string[];
  desiredOutcomes: DesiredOutcomeEntity[];
}

export interface OfferClientIntentJobGroup<K extends OfferClientIntentJobKind = OfferClientIntentJobKind> {
  kind: K;
  items: OfferClientIntentJobItem<K>[];
}

export interface OfferClientIntentFinancialItem {
  id: string;
  kind: 'financial_desired_outcome';
  offerFinancialIntentId: string;
  financialDesiredOutcomeId: string;
  financialDesiredOutcome: FinancialDesiredOutcomeEntity;
}

export interface OfferClientIntentFinancialGroup {
  kind: 'financial_desired_outcome';
  items: OfferClientIntentFinancialItem[];
}

export type OfferClientIntentGroup =
  | OfferClientIntentJobGroup<'core_functional_job'>
  | OfferClientIntentJobGroup<'related_job'>
  | OfferClientIntentJobGroup<'consumption_chain_job'>
  | OfferClientIntentJobGroup<'emotional_job'>
  | OfferClientIntentJobGroup<'social_job'>
  | OfferClientIntentFinancialGroup;

export interface OfferClientIntent {
  offerId: string;
  groups: OfferClientIntentGroup[];
}

export interface OfferIntentDiscoveryOutcome {
  id: string;
  checkboxId: string;
  entity: DesiredOutcomeEntity;
  checked: boolean;
}

export interface OfferIntentDiscoveryJob {
  id: string;
  checkboxId: string;
  productJobIntentId: string;
  job: JobEntity;
  checked: boolean;
  showJobCandidate: boolean;
  desiredOutcomes: OfferIntentDiscoveryOutcome[];
}

export interface OfferIntentDiscoveryFinancial {
  id: string;
  checkboxId: string;
  entity: FinancialDesiredOutcomeEntity;
  checked: boolean;
}

export interface OfferClientIntentDiscovery {
  status: 'available' | 'unavailable';
  offerId?: string;
  source?: { productId: string; product: Entity; jobGroups: OfferIntentDiscoveryJob[] };
  financialCandidates: OfferIntentDiscoveryFinancial[];
  kindShortcutMatches: { kind: ClientIntentDiscoveryKind; label: string }[];
  query: string;
  selectedKind?: ClientIntentDiscoveryKind;
}

const JOB_KINDS = new Set<OfferClientIntentJobKind>([
  'core_functional_job',
  'related_job',
  'consumption_chain_job',
  'emotional_job',
  'social_job',
]);

const byTitleThenId = <T extends { title: string; id: string }>(left: T, right: T) =>
  left.title.localeCompare(right.title) || left.id.localeCompare(right.id);

function desiredOutcomesFor(
  document: MapDocument,
  selection: OfferJobSelection,
  intent: ProductJobIntent,
  job: JobEntity,
  entitiesById: Map<string, Entity>,
): DesiredOutcomeEntity[] {
  if (!isDesiredOutcomeBearingJob(job.kind)) return [];

  const productOutcomeIds = new Set(intent.addressedDesiredOutcomeIds);
  const linkedIds = new Set(document.relationships.flatMap((relationship) =>
    relationship.kind === 'job_has_desired_outcome' && relationship.jobId === job.id
      ? [relationship.desiredOutcomeId]
      : [],
  ));

  return [...new Set(effectiveOfferDesiredOutcomeIds(document, selection))]
    .flatMap((id) => {
      const entity = entitiesById.get(id);
      return entity?.kind === 'desired_outcome' && linkedIds.has(id) && productOutcomeIds.has(id)
        ? [entity as DesiredOutcomeEntity]
        : [];
    })
    .sort(byTitleThenId);
}

function jobItem(
  document: MapDocument,
  selection: OfferJobSelection,
  intent: ProductJobIntent,
  job: JobEntity,
  entitiesById: Map<string, Entity>,
): OfferClientIntentJobItem {
  const desiredOutcomes = desiredOutcomesFor(document, selection, intent, job, entitiesById);
  return {
    id: selection.id,
    kind: job.kind,
    selectionId: selection.id,
    productJobIntentId: intent.id,
    jobId: job.id,
    job,
    desiredOutcomeIds: desiredOutcomes.map((outcome) => outcome.id),
    desiredOutcomes,
  };
}

/** Projects only committed, Offer-owned Client intent without creating domain relationships. */
export function offerClientIntent(document: MapDocument, offerId: string): OfferClientIntent | undefined {
  const inspectedOffer = document.entities.find((entity) => entity.id === offerId && entity.kind === 'offer');
  if (!inspectedOffer) return undefined;

  const entitiesById = new Map(document.entities.map((entity) => [entity.id, entity]));
  const packaged = document.relationships.find((relationship) =>
    relationship.kind === 'product_packaged_as_offer' && relationship.offerId === inspectedOffer.id);
  const productId = packaged?.kind === 'product_packaged_as_offer'
    && entitiesById.get(packaged.productId)?.kind === 'product'
    ? packaged.productId
    : undefined;
  const intentsById = new Map(document.productJobIntents.map((intent) => [intent.id, intent]));
  const jobItems = new Map<OfferClientIntentJobKind, OfferClientIntentJobItem[]>();

  for (const selection of document.offerJobSelections) {
    if (selection.offerId !== inspectedOffer.id) continue;
    const intent = intentsById.get(selection.productJobIntentId);
    const job = intent ? entitiesById.get(intent.jobId) : undefined;
    if (!intent || intent.productId !== productId || !job
      || !JOB_KINDS.has(job.kind as OfferClientIntentJobKind)) continue;
    const typedJob = job as JobEntity;
    const items = jobItems.get(typedJob.kind) ?? [];
    items.push(jobItem(document, selection, intent, typedJob, entitiesById));
    jobItems.set(typedJob.kind, items);
  }

  const financialItems: OfferClientIntentFinancialItem[] = document.offerFinancialIntents.flatMap((intent) => {
    if (intent.offerId !== inspectedOffer.id) return [];
    const outcome = entitiesById.get(intent.financialDesiredOutcomeId);
    if (outcome?.kind !== 'financial_desired_outcome') return [];
    return [{
      id: intent.id,
      kind: 'financial_desired_outcome' as const,
      offerFinancialIntentId: intent.id,
      financialDesiredOutcomeId: outcome.id,
      financialDesiredOutcome: outcome as FinancialDesiredOutcomeEntity,
    }];
  });

  const groups: OfferClientIntentGroup[] = [];
  for (const kind of OFFER_CLIENT_INTENT_KINDS) {
    if (kind === 'financial_desired_outcome') {
      if (financialItems.length) {
        financialItems.sort((left, right) =>
          byTitleThenId(left.financialDesiredOutcome, right.financialDesiredOutcome)
          || left.id.localeCompare(right.id));
        groups.push({ kind, items: financialItems });
      }
      continue;
    }
    const items = jobItems.get(kind);
    if (!items?.length) continue;
    items.sort((left, right) => byTitleThenId(left.job, right.job) || left.id.localeCompare(right.id));
    groups.push({ kind, items } as OfferClientIntentGroup);
  }

  return { offerId: inspectedOffer.id, groups };
}

/** Offer-owned candidate projection. Filtering can only narrow the linked Product eligibility universe. */
export function offerClientIntentDiscovery(
  document: MapDocument,
  offerId: string,
  input: { query: string; kind?: ClientIntentDiscoveryKind },
): OfferClientIntentDiscovery {
  const offer = document.entities.find(entity => entity.id === offerId && entity.kind === 'offer');
  const query = normalizeClientIntentQuery(input.query);
  if (!offer) return { status: 'unavailable', financialCandidates: [], kindShortcutMatches: clientIntentKindShortcutMatches(query), query, ...(input.kind ? { selectedKind: input.kind } : {}) };
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  const packaged = document.relationships.find(relation => relation.kind === 'product_packaged_as_offer' && relation.offerId === offerId);
  const product = packaged?.kind === 'product_packaged_as_offer' ? entities.get(packaged.productId) : undefined;
  if (!product || product.kind !== 'product') return { status: 'unavailable', offerId, financialCandidates: [], kindShortcutMatches: clientIntentKindShortcutMatches(query), query, ...(input.kind ? { selectedKind: input.kind } : {}) };

  const selections = new Map(document.offerJobSelections.filter(selection => selection.offerId === offerId).map(selection => [selection.productJobIntentId, selection]));
  const relationshipOutcomes = new Map<string, Set<string>>();
  for (const relation of document.relationships) {
    if (relation.kind !== 'job_has_desired_outcome') continue;
    const ids = relationshipOutcomes.get(relation.jobId) ?? new Set<string>();
    ids.add(relation.desiredOutcomeId);
    relationshipOutcomes.set(relation.jobId, ids);
  }
  const seenIntents = new Set<string>();
  const allJobs: OfferIntentDiscoveryJob[] = [];
  for (const intent of document.productJobIntents) {
    if (intent.productId !== product.id || seenIntents.has(intent.id)) continue;
    seenIntents.add(intent.id);
    const candidate = entities.get(intent.jobId);
    if (!candidate || !JOB_KINDS.has(candidate.kind as OfferClientIntentJobKind)) continue;
    const job = candidate as JobEntity;
    const selection = selections.get(intent.id);
    const checkedOutcomeIds = new Set(selection ? effectiveOfferDesiredOutcomeIds(document, selection) : []);
    const seenOutcomes = new Set<string>();
    const desiredOutcomes = isDesiredOutcomeBearingJob(job.kind) ? intent.addressedDesiredOutcomeIds.flatMap(id => {
      if (seenOutcomes.has(id) || !relationshipOutcomes.get(job.id)?.has(id)) return [];
      seenOutcomes.add(id);
      const outcome = entities.get(id);
      return outcome?.kind === 'desired_outcome' ? [{
        id: outcome.id,
        checkboxId: `offer-intent:${offerId}:${intent.id}:${outcome.id}`,
        entity: outcome as DesiredOutcomeEntity,
        checked: Boolean(selection && checkedOutcomeIds.has(outcome.id)),
      }] : [];
    }).sort((left, right) => byTitleThenId(left.entity, right.entity)) : [];
    allJobs.push({ id: intent.id, checkboxId: `offer-intent:${offerId}:${intent.id}`, productJobIntentId: intent.id, job, checked: Boolean(selection), showJobCandidate: true, desiredOutcomes });
  }
  allJobs.sort((left, right) => byTitleThenId(left.job, right.job) || left.id.localeCompare(right.id));

  const jobGroups = allJobs.flatMap(group => {
    const jobKindSelected = !input.kind || input.kind === group.job.kind;
    const outcomeKindSelected = !input.kind || input.kind === 'desired_outcome';
    const titleQuery = input.kind ? '' : query;
    const jobMatches = clientIntentTitleMatches(group.job.title, titleQuery);
    const outcomes = outcomeKindSelected ? group.desiredOutcomes.filter(outcome => !titleQuery || jobMatches || clientIntentTitleMatches(outcome.entity.title, titleQuery)) : [];
    const showJobCandidate = jobKindSelected && (!titleQuery || jobMatches);
    return showJobCandidate || outcomes.length ? [{ ...group, showJobCandidate, desiredOutcomes: outcomes }] : [];
  });
  const financialCandidates = document.entities.flatMap(entity => {
    if (entity.kind !== 'financial_desired_outcome' || (input.kind && input.kind !== entity.kind) || !clientIntentTitleMatches(entity.title, input.kind ? '' : query)) return [];
    return [{ id: entity.id, checkboxId: `offer-intent:${offerId}:${entity.id}`, entity: entity as FinancialDesiredOutcomeEntity, checked: document.offerFinancialIntents.some(intent => intent.offerId === offerId && intent.financialDesiredOutcomeId === entity.id) }];
  }).sort((left, right) => byTitleThenId(left.entity, right.entity));

  return {
    status: 'available', offerId,
    source: { productId: product.id, product, jobGroups },
    financialCandidates,
    kindShortcutMatches: clientIntentKindShortcutMatches(query), query, ...(input.kind ? { selectedKind: input.kind } : {}),
  };
}
