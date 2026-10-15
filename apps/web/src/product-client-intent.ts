import { isDesiredOutcomeBearingJob, type CanonicalEntity, type CanonicalMapDocument, type Entity, type MapDocument, type MapReadDocument } from '@vee/domain';
import { clientIntentKindShortcutMatches, clientIntentTitleMatches, normalizeClientIntentQuery } from './client-intent-discovery';

export const PRODUCT_CLIENT_INTENT_KINDS = ['core_functional_job', 'related_job', 'consumption_chain_job', 'emotional_job', 'social_job'] as const;
export type ProductClientIntentKind = typeof PRODUCT_CLIENT_INTENT_KINDS[number];
export const CANONICAL_PRODUCT_CLIENT_INTENT_KINDS = ['functional_job', 'consumption_chain_job', 'emotional_job', 'social_job'] as const;
export type CanonicalProductClientIntentKind = typeof CANONICAL_PRODUCT_CLIENT_INTENT_KINDS[number];
type ReadJobKind = ProductClientIntentKind | CanonicalProductClientIntentKind;
const READ_JOB_KINDS = ['functional_job', ...PRODUCT_CLIENT_INTENT_KINDS] as const;
type OutcomeJobKind = ProductClientIntentKind;
type DiscoveryKind = ProductClientIntentKind | 'desired_outcome';
export type CanonicalProductDiscoveryKind = CanonicalProductClientIntentKind | 'desired_outcome';
type ReadDiscoveryKind = DiscoveryKind | CanonicalProductDiscoveryKind;
type Job = Entity & { kind: ProductClientIntentKind };
type Outcome = Entity & { kind: 'desired_outcome' };
type ReadEntity = MapReadDocument['entities'][number];
type ReadJob = ReadEntity & { kind: ReadJobKind };
type CanonicalJob = CanonicalEntity & { kind: CanonicalProductClientIntentKind };
const ordinaryOutcome = (entity: ReadEntity | undefined): entity is Outcome => entity?.kind === 'desired_outcome';
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
export interface CanonicalProductClientIntentItem {
  id: string;
  job: CanonicalJob;
  kind: CanonicalProductClientIntentKind;
  productJobIntentIds: string[];
  desiredOutcomes: Outcome[];
  outcomeKnowledge: 'empty' | 'selected';
  /** Direct authored contexts only; absent for a Job with no valid contextual parents. */
  contextualParentJobs?: CanonicalJob[];
}
export interface CanonicalProductClientIntent { productId: string; groups: { kind: CanonicalProductClientIntentKind; items: CanonicalProductClientIntentItem[] }[] }
interface ProductClientIntentReadItem extends Omit<CanonicalProductClientIntentItem, 'job' | 'kind'> {
  job: ReadJob;
  kind: ReadJobKind;
  contextualCoreJob?: Entity;
}
export interface ProductClientIntentRead { productId: string; groups: { kind: ReadJobKind; items: ProductClientIntentReadItem[] }[] }
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
export interface CanonicalProductDiscoveryJob extends Omit<ProductDiscoveryJob, 'job' | 'contextualCoreJob'> {
  job: CanonicalJob;
}
interface ProductDiscoveryJobRead extends Omit<ProductDiscoveryJob, 'job'> { job: ReadJob }
export interface CanonicalProductClientIntentDiscovery extends Omit<ProductClientIntentDiscovery, 'jobGroups' | 'kindShortcutMatches' | 'createChoices'> {
  jobGroups: CanonicalProductDiscoveryJob[];
  kindShortcutMatches: { kind: CanonicalProductDiscoveryKind; label: string }[];
  createChoices: [];
}
export interface ProductClientIntentDiscoveryRead extends Omit<ProductClientIntentDiscovery, 'jobGroups' | 'kindShortcutMatches'> {
  jobGroups: ProductDiscoveryJobRead[];
  kindShortcutMatches: { kind: ReadDiscoveryKind; label: string }[];
}
export type ProductClientIntentDiscoveryInput = { query: string; kind?: DiscoveryKind; jobId?: string; readModel?: 'legacy' };
export type CanonicalProductClientIntentDiscoveryInput = { query: string; kind?: CanonicalProductDiscoveryKind; jobId?: string; readModel: 'canonical' };

const byTitleThenId = (a: Pick<ReadEntity, 'id' | 'title'>, b: Pick<ReadEntity, 'id' | 'title'>) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
const eligible = (entity: ReadEntity): entity is Job => PRODUCT_CLIENT_INTENT_KINDS.some(kind => kind === entity.kind);

function ownedOutcomes(document: MapReadDocument, jobId: string): Outcome[] {
  const ids = new Set(document.relationships.flatMap(relation => relation.kind === 'job_has_desired_outcome' && relation.jobId === jobId ? [relation.desiredOutcomeId] : []));
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  return [...ids].flatMap(id => { const entity = entities.get(id); return ordinaryOutcome(entity) ? [entity] : []; }).sort(byTitleThenId);
}

/** Shared committed selection state; discovery and read grouping retain separate eligibility. */
function membershipState(document: MapReadDocument, productId: string, jobId: string) {
  const intents = document.productJobIntents.filter(intent => intent.productId === productId && intent.jobId === jobId);
  const selected = new Set(intents.flatMap(intent => intent.addressedDesiredOutcomeIds));
  return {
    id: `product-intent:${productId}:${jobId}`,
    productJobIntentIds: [...new Set(intents.map(intent => intent.id))].sort((a, b) => a.localeCompare(b)),
    checked: intents.length > 0,
    outcomes: ownedOutcomes(document, jobId).map(entity => ({ id: entity.id, owningJobId: jobId, entity, checked: selected.has(entity.id) })),
  };
}

function legacyContext(document: MapReadDocument, job: ReadJob): Entity | undefined {
  if (job.kind !== 'related_job') return undefined;
  // Preserve the legacy single-parent rule, including duplicate-record rejection.
  const parents = document.relationships.filter(relation => relation.kind === 'core_functional_job_has_related_job' && relation.relatedJobId === job.id);
  const relation = parents[0];
  const parentId = parents.length === 1 && relation?.kind === 'core_functional_job_has_related_job' ? relation.coreFunctionalJobId : undefined;
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  const parent = parentId ? entities.get(parentId) : undefined;
  return parent?.kind === 'core_functional_job' ? parent : undefined;
}

function universe(document: MapReadDocument, productId: string, readModel: 'legacy' | 'canonical') {
  const kindOrder: readonly ReadJobKind[] = readModel === 'canonical' ? CANONICAL_PRODUCT_CLIENT_INTENT_KINDS : PRODUCT_CLIENT_INTENT_KINDS;
  const jobs = document.entities.filter(readJob).filter(job => kindOrder.some(kind => kind === job.kind))
    .sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || byTitleThenId(a, b));
  const state = (job: ReadJob) => {
    const contextualCoreJob = readModel === 'canonical' ? undefined : legacyContext(document, job);
    return { ...membershipState(document, productId, job.id), job, ...(contextualCoreJob ? { contextualCoreJob } : {}) };
  };
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  return { valid: entities.get(productId)?.kind === 'product', jobs, state };
}

const readJob = (entity: ReadEntity): entity is ReadJob => READ_JOB_KINDS.some(kind => kind === entity.kind);
const canonicalJob = (entity: ReadEntity): entity is CanonicalJob => CANONICAL_PRODUCT_CLIENT_INTENT_KINDS.some(kind => kind === entity.kind);

/** Committed Product membership; duplicate records merge valid scope without becoming mutation targets. */
export function productClientIntent(document: MapDocument, productId: string): ProductClientIntent | undefined;
export function productClientIntent(document: CanonicalMapDocument, productId: string): CanonicalProductClientIntent | undefined;
export function productClientIntent(document: MapReadDocument, productId: string): ProductClientIntentRead | undefined;
export function productClientIntent(document: MapReadDocument, productId: string): ProductClientIntentRead | undefined {
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  if (entities.get(productId)?.kind !== 'product') return undefined;
  const jobs = document.entities.filter(readJob).slice().sort(byTitleThenId);
  const groups = READ_JOB_KINDS.flatMap(kind => {
    const items: ProductClientIntentReadItem[] = jobs.filter(job => job.kind === kind).flatMap<ProductClientIntentReadItem>(job => {
      const { checked, outcomes, ...base } = membershipState(document, productId, job.id);
      if (!checked) return [];
      const desiredOutcomes = outcomes.filter(outcome => outcome.checked).map(outcome => outcome.entity);
      const contextualCoreJob = legacyContext(document, job);
      const parentIds = new Set(document.relationships.flatMap(relation => relation.kind === 'job_contextualizes_job' && relation.targetJobId === job.id && relation.sourceJobId !== job.id ? [relation.sourceJobId] : []));
      const contextualParentJobs = [...entities.values()].filter(canonicalJob).filter(parent => parentIds.has(parent.id)).sort(byTitleThenId);
      return [{ ...base, job, kind: job.kind, desiredOutcomes, outcomeKnowledge: desiredOutcomes.length ? 'selected' : 'empty',
        ...(contextualCoreJob ? { contextualCoreJob } : {}), ...(contextualParentJobs.length ? { contextualParentJobs } : {}),
      }];
    });
    return items.length ? [{ kind, items }] : [];
  });
  return { productId, groups };
}

/** Search and creation eligibility only; no drafts, contributor paths or domain commands. */
export function productClientIntentDiscovery(document: CanonicalMapDocument, productId: string, input: CanonicalProductClientIntentDiscoveryInput): CanonicalProductClientIntentDiscovery;
export function productClientIntentDiscovery(document: MapReadDocument, productId: string, input: CanonicalProductClientIntentDiscoveryInput): CanonicalProductClientIntentDiscovery;
// Keep the legacy overload last for existing ReturnType-based consumers.
export function productClientIntentDiscovery(document: MapDocument, productId: string, input: ProductClientIntentDiscoveryInput): ProductClientIntentDiscovery;
export function productClientIntentDiscovery(document: MapReadDocument, productId: string, input: ProductClientIntentDiscoveryInput | CanonicalProductClientIntentDiscoveryInput): ProductClientIntentDiscoveryRead {
  const source = universe(document, productId, input.readModel ?? 'legacy');
  const query = normalizeClientIntentQuery(input.query);
  const title = input.query.trim();
  const result: ProductClientIntentDiscoveryRead = { status: 'unavailable', productId, query, title, jobGroups: [], kindShortcutMatches: [], createChoices: [] };
  const branch = input.jobId === undefined ? undefined : source.jobs.find(job => job.id === input.jobId && isDesiredOutcomeBearingJob(job.kind));
  if (!source.valid || (input.jobId !== undefined && !branch)) return result;
  result.status = 'available';
  result.kindShortcutMatches = clientIntentKindShortcutMatches(query).filter((match): match is { kind: DiscoveryKind; label: string } => match.kind !== 'financial_desired_outcome');
  if (input.readModel === 'canonical') {
    const shortcuts: CanonicalProductClientIntentDiscovery['kindShortcutMatches'] = [];
    if (query && 'functional job'.includes(query)) shortcuts.push({ kind: 'functional_job', label: 'Functional Job' });
    shortcuts.push(...result.kindShortcutMatches.flatMap(({ kind, label }) =>
      kind === 'core_functional_job' || kind === 'related_job' ? [] : [{ kind, label }],
    ));
    result.kindShortcutMatches = shortcuts;
  }
  const titleQuery = input.kind ? '' : query;
  result.jobGroups = (branch ? [branch] : source.jobs).flatMap(job => {
    const { outcomes, ...base } = source.state(job);
    const matches = clientIntentTitleMatches(job.title, titleQuery);
    const showJobCandidate = (!input.kind || input.kind === job.kind) && matches;
    const desiredOutcomes = !input.kind || input.kind === 'desired_outcome' ? outcomes.filter(outcome => matches || clientIntentTitleMatches(outcome.entity.title, titleQuery)) : [];
    return showJobCandidate || desiredOutcomes.length ? [{ ...base, showJobCandidate, ...(isDesiredOutcomeBearingJob(job.kind) ? { desiredOutcomes } : {}) }] : [];
  });
  // Canonical discovery is read-only, including branch-local and nonblank-query continuations.
  if (input.readModel === 'canonical') {
    const createChoices: [] = [];
    return { ...result, createChoices };
  }
  if (!title) return result;
  const legacyJobs = source.jobs.filter(eligible);
  const legacyBranch = branch && eligible(branch) ? branch : undefined;
  result.createChoices = ['core_functional_job', 'consumption_chain_job', 'emotional_job', 'social_job'].map(kind => ({ kind } as ProductCreateChoice));
  for (const kind of ['related_job', 'desired_outcome'] as const) {
    const candidates = (kind === 'related_job' ? legacyJobs.filter(job => job.kind === 'core_functional_job') : legacyBranch ? [legacyBranch] : legacyJobs.filter(job => isDesiredOutcomeBearingJob(job.kind))).slice().sort(byTitleThenId);
    if (candidates.length) result.createChoices.push({ kind, resolution: candidates.length === 1 ? { status: 'resolved', owner: candidates[0]! } : { status: 'requires-choice', candidates } });
  }
  return result;
}
