import { isDesiredOutcomeBearingJob, type Entity, type MapDocument } from '@vee/domain';
import { clientIntentKindShortcutMatches, clientIntentTitleMatches, normalizeClientIntentQuery } from './client-intent-discovery';

export const PRODUCT_CLIENT_INTENT_KINDS = ['core_functional_job', 'related_job', 'consumption_chain_job', 'emotional_job', 'social_job'] as const;
export type ProductClientIntentKind = typeof PRODUCT_CLIENT_INTENT_KINDS[number];
type OutcomeJobKind = ProductClientIntentKind;
type DiscoveryKind = ProductClientIntentKind | 'desired_outcome';
type Job = Entity & { kind: ProductClientIntentKind };
type Outcome = Entity & { kind: 'desired_outcome' };
interface JobBase {
  id: string;
  job: Job;
  productJobIntentIds: string[];
  contextualCoreJob?: Entity;
}
export type ProductClientIntentItem = JobBase & (
  | { kind: OutcomeJobKind; desiredOutcomes: Outcome[]; outcomeKnowledge: 'empty' | 'selected' }
);
export interface ProductClientIntent { productId: string; groups: { kind: ProductClientIntentKind; items: ProductClientIntentItem[] }[] }
export interface ProductDiscoveryJob extends JobBase {
  checked: boolean;
  showJobCandidate: boolean;
  desiredOutcomes?: { id: string; owningJobId: string; entity: Outcome; checked: boolean }[];
}
export type ProductCreateChoice =
  | { kind: 'core_functional_job' | 'consumption_chain_job' | 'emotional_job' | 'social_job' }
  | { kind: 'related_job' | 'desired_outcome'; resolution: { status: 'resolved'; owner: Job } | { status: 'requires-choice'; candidates: Job[] } };
export interface ProductClientIntentDiscovery {
  status: 'available' | 'unavailable';
  productId: string;
  query: string;
  title: string;
  jobGroups: ProductDiscoveryJob[];
  kindShortcutMatches: { kind: DiscoveryKind; label: string }[];
  createChoices: ProductCreateChoice[];
}
const byTitleThenId = (a: Entity, b: Entity) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
const eligible = (entity: Entity): entity is Job => PRODUCT_CLIENT_INTENT_KINDS.some(kind => kind === entity.kind);

function universe(document: MapDocument, productId: string) {
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  const jobs = document.entities.filter(eligible).sort((a, b) => PRODUCT_CLIENT_INTENT_KINDS.indexOf(a.kind) - PRODUCT_CLIENT_INTENT_KINDS.indexOf(b.kind) || byTitleThenId(a, b));
  const outcomes = (job: Job): Outcome[] => !isDesiredOutcomeBearingJob(job.kind) ? [] : [...new Set(document.relationships.flatMap(relation => relation.kind === 'job_has_desired_outcome' && relation.jobId === job.id ? [relation.desiredOutcomeId] : []))]
    .flatMap(id => { const entity = entities.get(id); return entity?.kind === 'desired_outcome' ? [entity as Outcome] : []; }).sort(byTitleThenId);
  const state = (job: Job) => {
    const intents = document.productJobIntents.filter(intent => intent.productId === productId && intent.jobId === job.id);
    const selected = new Set(intents.flatMap(intent => intent.addressedDesiredOutcomeIds));
    // Context is descriptive only. Malformed multiple parent records never select an arbitrary CFJ.
    const parents = document.relationships.filter(relation => relation.kind === 'core_functional_job_has_related_job' && relation.relatedJobId === job.id);
    const parent = parents.length === 1 && parents[0]?.kind === 'core_functional_job_has_related_job' ? entities.get(parents[0].coreFunctionalJobId) : undefined;
    return {
      id: `product-intent:${productId}:${job.id}`, job,
      productJobIntentIds: [...new Set(intents.map(intent => intent.id))].sort((a, b) => a.localeCompare(b)),
      checked: intents.length > 0,
      ...(job.kind === 'related_job' && parent?.kind === 'core_functional_job' ? { contextualCoreJob: parent } : {}),
      outcomes: outcomes(job).map(entity => ({ id: entity.id, owningJobId: job.id, entity, checked: selected.has(entity.id) })),
    };
  };
  return { valid: entities.get(productId)?.kind === 'product', jobs, state };
}

/** Committed Product membership; duplicate records merge valid scope without becoming mutation targets. */
export function productClientIntent(document: MapDocument, productId: string): ProductClientIntent | undefined {
  const source = universe(document, productId);
  if (!source.valid) return undefined;
  const groups = PRODUCT_CLIENT_INTENT_KINDS.flatMap(kind => {
    const items: ProductClientIntentItem[] = source.jobs.filter(job => job.kind === kind).flatMap<ProductClientIntentItem>(job => {
      const { checked, outcomes, ...base } = source.state(job);
      if (!checked) return [];
      const desiredOutcomes = outcomes.filter(outcome => outcome.checked).map(outcome => outcome.entity);
      return [{ ...base, kind: job.kind as OutcomeJobKind, desiredOutcomes, outcomeKnowledge: desiredOutcomes.length ? 'selected' : 'empty' }];
    });
    return items.length ? [{ kind, items }] : [];
  });
  return { productId, groups };
}

/** Search and creation eligibility only; no drafts, contributor paths or domain commands. */
export function productClientIntentDiscovery(document: MapDocument, productId: string, input: { query: string; kind?: DiscoveryKind; jobId?: string }): ProductClientIntentDiscovery {
  const source = universe(document, productId);
  const query = normalizeClientIntentQuery(input.query);
  const title = input.query.trim();
  const result: ProductClientIntentDiscovery = { status: 'unavailable', productId, query, title, jobGroups: [], kindShortcutMatches: [], createChoices: [] };
  const branch = input.jobId === undefined ? undefined : source.jobs.find(job => job.id === input.jobId && isDesiredOutcomeBearingJob(job.kind));
  if (!source.valid || (input.jobId !== undefined && !branch)) return result;
  result.status = 'available';
  result.kindShortcutMatches = clientIntentKindShortcutMatches(query).filter((match): match is { kind: DiscoveryKind; label: string } => match.kind !== 'financial_desired_outcome');
  const titleQuery = input.kind ? '' : query;
  result.jobGroups = (branch ? [branch] : source.jobs).flatMap(job => {
    const { outcomes, ...base } = source.state(job);
    const matches = clientIntentTitleMatches(job.title, titleQuery);
    const showJobCandidate = (!input.kind || input.kind === job.kind) && matches;
    const desiredOutcomes = !input.kind || input.kind === 'desired_outcome' ? outcomes.filter(outcome => matches || clientIntentTitleMatches(outcome.entity.title, titleQuery)) : [];
    return showJobCandidate || desiredOutcomes.length ? [{ ...base, showJobCandidate, ...(isDesiredOutcomeBearingJob(job.kind) ? { desiredOutcomes } : {}) }] : [];
  });
  if (!title) return result;
  result.createChoices = ['core_functional_job', 'consumption_chain_job', 'emotional_job', 'social_job'].map(kind => ({ kind } as ProductCreateChoice));
  for (const kind of ['related_job', 'desired_outcome'] as const) {
    const candidates = (kind === 'related_job' ? source.jobs.filter(job => job.kind === 'core_functional_job') : branch ? [branch] : source.jobs.filter(job => isDesiredOutcomeBearingJob(job.kind))).slice().sort(byTitleThenId);
    if (candidates.length) result.createChoices.push({ kind, resolution: candidates.length === 1 ? { status: 'resolved', owner: candidates[0]! } : { status: 'requires-choice', candidates } });
  }
  return result;
}
