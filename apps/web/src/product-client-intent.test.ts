import { normalizeLegacyJobs, setFinancialDesiredOutcomeJobContexts, setJobContextualParents, type MapReadDocument } from '@vee/domain';
import { freezeMapReadFixture, legacyMapReadFixture } from './map-read-test-fixture';
import { createEmptyMapDocument, type MapDocument } from '@vee/domain';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { PRODUCT_CLIENT_INTENT_KINDS, productClientIntent, productClientIntentDiscovery, type ProductClientIntentDiscovery, type ProductCreateChoice, type CanonicalProductClientIntentDiscovery, type CanonicalProductClientIntentDiscoveryInput, type CanonicalProductDiscoveryKind } from './product-client-intent';
import { CLIENT_INTENT_DISCOVERY_KINDS, clientIntentKindShortcutMatches } from './client-intent-discovery';
function fixture(): MapDocument {
  const d = createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' });
  d.entities.push({ id: 'p', kind: 'product', title: 'Product' });
  for (const kind of PRODUCT_CLIENT_INTENT_KINDS) {
    d.entities.push({ id: kind, kind, title: kind });
    d.productJobIntents.push({ id: `intent:${kind}`, productId: 'p', jobId: kind, addressedDesiredOutcomeIds: [] });
  }
  d.entities.push({ id: 'do', kind: 'desired_outcome', title: 'Faster delivery' }, { id: 'fdo', kind: 'financial_desired_outcome', title: 'Faster delivery' }, { id: 'rep', kind: 'repulsor', title: 'Faster delivery' });
  d.relationships.push({ id: 'owns', kind: 'job_has_desired_outcome', jobId: 'core_functional_job', desiredOutcomeId: 'do' }, { id: 'context', kind: 'core_functional_job_has_related_job', coreFunctionalJobId: 'core_functional_job', relatedJobId: 'related_job' });
  return d;
}
const discovery = (d: MapDocument, query = 'New title', extra = {}) => productClientIntentDiscovery(d, 'p', { query, ...extra });
function freeze(v: unknown) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } }
describe('Product Client intent projection', () => {
  it('distinguishes absent owner and valid empty authored state', () => {
    const d = fixture(); d.productJobIntents = [];
    expect(productClientIntent(d, 'missing')).toBeUndefined();
    expect(productClientIntent(d, 'do')).toBeUndefined();
    expect(productClientIntent(d, 'p')).toEqual({ productId: 'p', groups: [] });
  });
  it('projects five kinds with incomplete ordinary outcome knowledge', () => {
    const groups = productClientIntent(fixture(), 'p')!.groups;
    expect(groups.map(g => g.kind)).toEqual(PRODUCT_CLIENT_INTENT_KINDS);
    for (const g of groups) expect(g.items[0]).toMatchObject({ outcomeKnowledge: 'empty', desiredOutcomes: [] });
  });
  it('merges duplicate intent scope and filters invalid, foreign and wrong-kind outcomes', () => {
    const d = fixture();
    d.productJobIntents.push({ id: 'duplicate', productId: 'p', jobId: 'core_functional_job', addressedDesiredOutcomeIds: ['do', 'do', 'missing', 'fdo', 'rep'] }, { id: 'bad', productId: 'p', jobId: 'fdo', addressedDesiredOutcomeIds: [] }, { id: 'stale', productId: 'p', jobId: 'missing', addressedDesiredOutcomeIds: [] });
    d.productJobIntents.find(i => i.jobId === 'related_job')!.addressedDesiredOutcomeIds = ['do'];
    const groups = productClientIntent(d, 'p')!.groups;
    expect(groups[0]!.items).toHaveLength(1);
    expect(groups[0]!.items[0]).toMatchObject({ desiredOutcomes: [{ id: 'do' }], outcomeKnowledge: 'selected', productJobIntentIds: ['duplicate', 'intent:core_functional_job'] });
    expect(groups[1]!.items[0]).toMatchObject({ desiredOutcomes: [], outcomeKnowledge: 'empty' });
  });
  it.each(PRODUCT_CLIENT_INTENT_KINDS)('projects nonempty selected scope for %s', kind => {
    const d = fixture(); d.relationships = [{ id: 'owns', kind: 'job_has_desired_outcome', jobId: kind, desiredOutcomeId: 'do' }];
    d.productJobIntents.find(i => i.jobId === kind)!.addressedDesiredOutcomeIds = ['do'];
    expect(productClientIntent(d, 'p')!.groups.find(g => g.kind === kind)!.items[0]).toMatchObject({ outcomeKnowledge: 'selected', desiredOutcomes: [{ id: 'do' }] });
  });
  it('retains RJ context without selecting its CFJ; suppresses stale, wrong-kind and ambiguous context', () => {
    const d = fixture(); d.productJobIntents = d.productJobIntents.filter(i => i.jobId === 'related_job');
    expect(productClientIntent(d, 'p')!.groups).toHaveLength(1);
    expect(productClientIntent(d, 'p')!.groups[0]!.items[0]).toMatchObject({ contextualCoreJob: { id: 'core_functional_job' } });
    d.relationships.push({ id: 'duplicate-context', kind: 'core_functional_job_has_related_job', coreFunctionalJobId: 'core_functional_job', relatedJobId: 'related_job' });
    expect(productClientIntent(d, 'p')!.groups[0]!.items[0]).not.toHaveProperty('contextualCoreJob');
    d.relationships = [{ id: 'wrong', kind: 'core_functional_job_has_related_job', coreFunctionalJobId: 'do', relatedJobId: 'related_job' }];
    expect(productClientIntent(d, 'p')!.groups[0]!.items[0]).not.toHaveProperty('contextualCoreJob');
  });
});
describe('Product Client intent discovery', () => {
  it('searches eligible titles, nests DO under an unselected Job and excludes FDO/Repulsor', () => {
    const d = fixture(); d.productJobIntents = [];
    expect(discovery(d, 'Faster').jobGroups).toMatchObject([{ job: { id: 'core_functional_job' }, checked: false, showJobCandidate: false, desiredOutcomes: [{ owningJobId: 'core_functional_job', entity: { id: 'do' }, checked: false }] }]);
    expect(discovery(d, 'core_functional').jobGroups[0]!.desiredOutcomes).toHaveLength(1);
    expect(discovery(d, 'do').kindShortcutMatches.map(m => m.kind)).not.toContain('financial_desired_outcome');
    expect(discovery(d, 'do', { kind: 'desired_outcome' }).jobGroups.every(g => !g.showJobCandidate)).toBe(true);
  });
  it('derives checked state only from Product records and valid ownership', () => {
    const d = fixture(); d.productJobIntents[0]!.addressedDesiredOutcomeIds = ['do'];
    expect(discovery(d, 'Faster').jobGroups[0]).toMatchObject({ checked: true, desiredOutcomes: [{ checked: true }] });
    expect(discovery(d, 'social').jobGroups[0]).toHaveProperty('desiredOutcomes', []);
    d.relationships = [];
    expect(discovery(d, 'Faster').jobGroups).toEqual([]);
  });
  it('has no blank creation menu and preserves query title case separately', () => {
    expect(discovery(fixture(), '  ').createChoices).toEqual([]);
    expect(discovery(fixture(), '  New Title  ')).toMatchObject({ title: 'New Title', query: 'new title' });
  });
  it.each([0, 1, 2])('resolves RJ and global DO create context with %s candidates', count => {
    const d = fixture(); d.entities = d.entities.filter(e => !PRODUCT_CLIENT_INTENT_KINDS.some(k => k === e.kind));
    for (let i = 0; i < count; i++) d.entities.push({ id: `cfj:${i}`, kind: 'core_functional_job', title: 'Same' });
    const choices = discovery(d).createChoices;
    for (const kind of ['related_job', 'desired_outcome']) {
      const choice = choices.find(c => c.kind === kind);
      if (!count) expect(choice).toBeUndefined();
      else expect(choice).toMatchObject({ resolution: count === 1 ? { status: 'resolved', owner: { id: 'cfj:0' } } : { status: 'requires-choice', candidates: [{ id: 'cfj:0' }, { id: 'cfj:1' }] } });
    }
    expect(choices.map(c => c.kind)).toEqual(expect.arrayContaining(['core_functional_job', 'consumption_chain_job', 'emotional_job', 'social_job']));
  });
  it('fixes a valid branch owner and never falls back from invalid context', () => {
    const d = fixture();
    expect(discovery(d, 'New', { jobId: 'related_job' }).createChoices.find(c => c.kind === 'desired_outcome')).toMatchObject({ resolution: { status: 'resolved', owner: { id: 'related_job' } } });
    for (const jobId of ['missing', 'do']) expect(discovery(d, 'New', { jobId })).toMatchObject({ status: 'unavailable', jobGroups: [], createChoices: [] });
    expect(productClientIntentDiscovery(d, 'missing', { query: 'New' }).status).toBe('unavailable');
  });
  it('is deterministic and does not mutate frozen input', () => {
    const d = fixture(); d.entities.push({ id: 'cfj-z', kind: 'core_functional_job', title: 'core_functional_job' });
    d.productJobIntents.push({ id: 'z', productId: 'p', jobId: 'cfj-z', addressedDesiredOutcomeIds: [] });
    const reversed = { ...d, entities: [...d.entities].reverse(), relationships: [...d.relationships].reverse(), productJobIntents: [...d.productJobIntents].reverse() };
    const before = structuredClone(d); freeze(d);
    expect(productClientIntent(d, 'p')).toEqual(productClientIntent(reversed, 'p'));
    expect(discovery(d, '')).toEqual(discovery(reversed, ''));
    expect(discovery(d)).toEqual(discovery(reversed));
    expect(d).toEqual(before);
  });
});


function productReadFixture(): MapDocument {
  const d = legacyMapReadFixture();
  for (const id of ['j', 'rj']) d.entities.find(entity => entity.id === id)!.title = 'Same activity';
  d.entities.push({ id: 'r-do', kind: 'desired_outcome', title: 'Related criterion' }, { id: 'u', kind: 'core_functional_job', title: 'A context' });
  d.relationships.push({ id: 'r-owns', kind: 'job_has_desired_outcome', jobId: 'rj', desiredOutcomeId: 'r-do' });
  d.productJobIntents.find(intent => intent.jobId === 'rj')!.addressedDesiredOutcomeIds = ['r-do'];
  return d;
}
const readItem = (d: MapReadDocument, jobId: string) => productClientIntent(d, 'p')!.groups.flatMap(group => group.items).find(item => item.job.id === jobId)!;

describe('canonical Product Client intent read compatibility', () => {
  it('groups normalized CFJ/RJ as distinct Functional Jobs and preserves exact authored membership and scope', () => {
    const legacy = productReadFixture(); const canonical = normalizeLegacyJobs(legacy);
    freezeMapReadFixture(legacy); freezeMapReadFixture(canonical);
    const result = productClientIntent(canonical, 'p')!;
    expect(result.groups.map(group => group.kind)).toEqual(['functional_job', 'consumption_chain_job', 'emotional_job', 'social_job']);
    expect(result.groups[0]!.items.map(item => item.job.id)).toEqual(['j', 'rj']);
    for (const group of productClientIntent(legacy, 'p')!.groups) for (const old of group.items) {
      const current = readItem(canonical, old.job.id);
      expect(current.id).toBe(old.id);
      expect(current.job).toEqual({ ...old.job, kind: old.kind === 'core_functional_job' || old.kind === 'related_job' ? 'functional_job' : old.kind });
      expect(current.productJobIntentIds).toEqual(old.productJobIntentIds);
      expect(current.desiredOutcomes).toEqual(old.desiredOutcomes);
      expect(current.outcomeKnowledge).toBe(old.outcomeKnowledge);
      expect(current).not.toHaveProperty('contextualCoreJob');
    }
    expect(readItem(canonical, 'j')).toMatchObject({ id: 'product-intent:p:j', productJobIntentIds: ['pi'], desiredOutcomes: [{ id: 'a' }, { id: 'b' }], outcomeKnowledge: 'selected' });
    expect(readItem(canonical, 'rj')).toMatchObject({ id: 'product-intent:p:rj', productJobIntentIds: ['pri'], desiredOutcomes: [{ id: 'r-do' }], contextualParentJobs: [{ id: 'j' }] });
    expect(readItem(canonical, 'ej')).toMatchObject({ desiredOutcomes: [], outcomeKnowledge: 'empty', contextualParentJobs: [{ id: 'j' }] });
    expect(readItem(canonical, 'j')).not.toHaveProperty('contextualParentJobs');
  });

  it('exposes every direct contextual parent, preserves roots and never selects an ancestor or FDO context', () => {
    let d = normalizeLegacyJobs(productReadFixture());
    d = setJobContextualParents(d, { targetJobId: 'rj', parentJobIds: ['j', 'ej', 'u'], newRelationshipIds: ['e-r', 'u-r'] });
    d = setJobContextualParents(d, { targetJobId: 'j', parentJobIds: ['ccj'], newRelationshipIds: ['c-j'] });
    d = setFinancialDesiredOutcomeJobContexts(d, { financialDesiredOutcomeId: 'unselected-f', jobIds: ['rj', 'u'], newRelationshipIds: ['r-f', 'u-f'] });
    d.productJobIntents = d.productJobIntents.filter(intent => intent.jobId === 'rj');
    const before = structuredClone(d); freezeMapReadFixture(d);
    const result = productClientIntent(d, 'p')!;
    expect(result.groups).toHaveLength(1); expect(result.groups[0]!.items).toHaveLength(1);
    const item = result.groups[0]!.items[0]!;
    expect(item.contextualParentJobs?.map(parent => [parent.id, parent.kind])).toEqual([['u', 'functional_job'], ['ej', 'emotional_job'], ['j', 'functional_job']]);
    expect(item.contextualParentJobs?.map(parent => parent.id)).not.toContain('ccj');
    expect(item).not.toHaveProperty('contextualCoreJob');
    item.contextualParentJobs!.pop(); item.productJobIntentIds.pop(); item.desiredOutcomes.pop();
    expect(d).toEqual(before);
  });

  it('deduplicates direct context records and ignores malformed endpoints without repairing the source', () => {
    const d = normalizeLegacyJobs(productReadFixture());
    d.relationships.push(
      { id: 'repeated-context', kind: 'job_contextualizes_job', sourceJobId: 'j', targetJobId: 'rj' },
      { id: 'missing-context', kind: 'job_contextualizes_job', sourceJobId: 'missing', targetJobId: 'rj' },
      { id: 'wrong-context', kind: 'job_contextualizes_job', sourceJobId: 'f', targetJobId: 'rj' },
      { id: 'self-context', kind: 'job_contextualizes_job', sourceJobId: 'rj', targetJobId: 'rj' },
      { id: 'wrong-target', kind: 'job_contextualizes_job', sourceJobId: 'u', targetJobId: 'missing' },
    );
    const before = structuredClone(d); freezeMapReadFixture(d);
    expect(readItem(d, 'rj').contextualParentJobs?.map(job => job.id)).toEqual(['j']);
    expect(productClientIntent(d, 'p')!.groups.flatMap(group => group.items).map(item => item.job.id)).not.toContain('u');
    expect(d).toEqual(before);
  });

  it('merges duplicate authored intent records and filters stale, wrong-kind and foreign outcomes', () => {
    const d = normalizeLegacyJobs(productReadFixture());
    d.productJobIntents.find(intent => intent.id === 'pi')!.addressedDesiredOutcomeIds = ['a'];
    d.productJobIntents.push(
      { id: 'duplicate', productId: 'p', jobId: 'j', addressedDesiredOutcomeIds: ['b', 'a', 'a', 'missing', 'f', 'rep', 'r-do'] },
      { id: 'wrong-kind', productId: 'p', jobId: 'f', addressedDesiredOutcomeIds: [] },
      { id: 'stale-job', productId: 'p', jobId: 'missing', addressedDesiredOutcomeIds: [] },
      { id: 'other-product', productId: 'missing', jobId: 'u', addressedDesiredOutcomeIds: [] },
    );
    const before = structuredClone(d); freezeMapReadFixture(d);
    expect(readItem(d, 'j')).toMatchObject({ productJobIntentIds: ['duplicate', 'pi'], desiredOutcomes: [{ id: 'a' }, { id: 'b' }] });
    expect(productClientIntent(d, 'p')!.groups[0]!.items.map(item => item.job.id)).toEqual(['j', 'rj']);
    expect(d).toEqual(before);
  });

  it('retains valid empty/absent owner results and deterministic kind, Job, context and DO ordering', () => {
    const d = normalizeLegacyJobs(productReadFixture());
    d.entities.find(entity => entity.id === 'b')!.title = 'Outcome A';
    const reversed = { ...d, entities: [...d.entities].reverse(), relationships: [...d.relationships].reverse(), productJobIntents: [...d.productJobIntents].reverse() };
    const before = structuredClone(d); freezeMapReadFixture(d);
    expect(productClientIntent(d, 'p')).toEqual(productClientIntent(reversed, 'p'));
    expect(readItem(d, 'j').desiredOutcomes.map(outcome => outcome.id)).toEqual(['a', 'b']);
    expect(productClientIntent(d, 'missing')).toBeUndefined(); expect(productClientIntent(d, 'j')).toBeUndefined();
    expect(productClientIntent({ ...d, productJobIntents: [] }, 'p')).toEqual({ productId: 'p', groups: [] });
    expect(d).toEqual(before);
  });

  it('leaves legacy read context and search/create discovery eligibility unchanged', () => {
    const d = productReadFixture(); const before = structuredClone(d); freezeMapReadFixture(d);
    const result = productClientIntentDiscovery(d, 'p', { query: 'New title' });
    expect(result.createChoices.map(choice => choice.kind)).toEqual(['core_functional_job', 'consumption_chain_job', 'emotional_job', 'social_job', 'related_job', 'desired_outcome']);
    expect(result.createChoices.map(choice => choice.kind)).not.toContain('functional_job');
    expect(result.jobGroups.map(group => group.job.kind)).not.toContain('financial_desired_outcome');
    expect(readItem(d, 'rj')).toMatchObject({ contextualCoreJob: { id: 'j' } });
    expect(readItem(d, 'rj')).not.toHaveProperty('contextualParentJobs');
    expect(productClientIntentDiscovery(d, 'p', { query: '', jobId: 'rj' }).jobGroups[0]).toMatchObject({ job: { id: 'rj' }, desiredOutcomes: [{ id: 'r-do', checked: true }] });
    expect(d).toEqual(before);
  });
});


it('reads canonical EJ/SJ contexts without requiring any Functional Job or selecting the parent', () => {
  const legacy = createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' });
  legacy.entities.push({ id: 'p', kind: 'product', title: 'Product' }, { id: 'e', kind: 'emotional_job', title: 'Emotional' }, { id: 's', kind: 'social_job', title: 'Social' });
  legacy.productJobIntents.push({ id: 'selected', productId: 'p', jobId: 's', addressedDesiredOutcomeIds: [] });
  const d = setJobContextualParents(normalizeLegacyJobs(legacy), { targetJobId: 's', parentJobIds: ['e'], newRelationshipIds: ['e-s'] });
  freezeMapReadFixture(d);
  expect(productClientIntent(d, 'p')).toEqual({ productId: 'p', groups: [{ kind: 'social_job', items: [{
    id: 'product-intent:p:s', job: { id: 's', kind: 'social_job', title: 'Social' }, kind: 'social_job', productJobIntentIds: ['selected'],
    desiredOutcomes: [], outcomeKnowledge: 'empty', contextualParentJobs: [{ id: 'e', kind: 'emotional_job', title: 'Emotional' }],
  }] }] });
});


const canonicalProductDiscovery = (document: MapReadDocument, query = '', extra: Omit<CanonicalProductClientIntentDiscoveryInput, 'query' | 'readModel'> = {}) =>
  productClientIntentDiscovery(document, 'p', { query, ...extra, readModel: 'canonical' });

describe('canonical Product Client-intent Discovery read compatibility', () => {
  it('preserves normalized discovery state and strict legacy results with canonical creation unavailable', () => {
    const legacy = productReadFixture(); const document = normalizeLegacyJobs(legacy);
    expectTypeOf(productClientIntentDiscovery(legacy, 'p', { query: '' })).toEqualTypeOf<ProductClientIntentDiscovery>();
    expectTypeOf<ReturnType<typeof productClientIntentDiscovery>>().toEqualTypeOf<ProductClientIntentDiscovery>();
    expectTypeOf(productClientIntentDiscovery(legacy, 'p', { query: 'New' }).createChoices).toEqualTypeOf<ProductCreateChoice[]>();
    expectTypeOf(productClientIntentDiscovery(document, 'p', { query: '', readModel: 'canonical' })).toEqualTypeOf<CanonicalProductClientIntentDiscovery>();
    expectTypeOf(canonicalProductDiscovery(document).createChoices).toEqualTypeOf<[]>();
    expectTypeOf<CanonicalProductClientIntentDiscoveryInput>().toExtend<{ readModel: 'canonical' }>();
    expectTypeOf<Extract<CanonicalProductDiscoveryKind, 'core_functional_job' | 'related_job' | 'financial_desired_outcome'>>().toEqualTypeOf<never>();
    const old = productClientIntentDiscovery(legacy, 'p', { query: '' });
    const result = canonicalProductDiscovery(document);
    const expected = old.jobGroups.map(group => {
      const base = { ...group };
      delete base.contextualCoreJob;
      return { ...base, job: { ...group.job, kind: group.job.kind === 'core_functional_job' || group.job.kind === 'related_job' ? 'functional_job' : group.job.kind } };
    });
    expect(result).toEqual({ ...old, jobGroups: expected });
    expect(result.jobGroups.map(group => [group.job.id, group.job.kind])).toEqual([
      ['u', 'functional_job'], ['j', 'functional_job'], ['rj', 'functional_job'], ['ccj', 'consumption_chain_job'], ['ej', 'emotional_job'], ['sj', 'social_job'],
    ]);
    expect(result.jobGroups.find(group => group.job.id === 'j')).toEqual({ id: 'product-intent:p:j', job: { id: 'j', title: 'Same activity', kind: 'functional_job' }, productJobIntentIds: ['pi'], checked: true, showJobCandidate: true,
      desiredOutcomes: [{ id: 'a', owningJobId: 'j', entity: { id: 'a', kind: 'desired_outcome', title: 'Outcome A' }, checked: true }, { id: 'b', owningJobId: 'j', entity: { id: 'b', kind: 'desired_outcome', title: 'Outcome B' }, checked: true }] });
    expect(result.jobGroups.find(group => group.job.id === 'u')).toMatchObject({ checked: false, productJobIntentIds: [], desiredOutcomes: [] });
    expect(result.jobGroups.every(group => !('contextualCoreJob' in group))).toBe(true);
    expect(productClientIntentDiscovery(legacy, 'p', { query: '' }).jobGroups.find(group => group.job.id === 'rj')).toHaveProperty('contextualCoreJob');
  });

  it('keeps direct DO search, selected state and same-title Job identities separate', () => {
    const document = normalizeLegacyJobs(productReadFixture());
    expect(canonicalProductDiscovery(document, 'Same activity').jobGroups.map(group => group.job.id)).toEqual(['j', 'rj']);
    expect(canonicalProductDiscovery(document, '  RELATED CRITERION ').jobGroups).toMatchObject([{ job: { id: 'rj' }, checked: true, showJobCandidate: false, desiredOutcomes: [{ id: 'r-do', owningJobId: 'rj', checked: true }] }]);
    document.productJobIntents = document.productJobIntents.filter(intent => intent.jobId !== 'rj');
    expect(canonicalProductDiscovery(document, 'Related criterion').jobGroups[0]).toMatchObject({ job: { id: 'rj' }, checked: false, productJobIntentIds: [], showJobCandidate: false, desiredOutcomes: [{ id: 'r-do', checked: false }] });
    expect(canonicalProductDiscovery(document, '').jobGroups.find(group => group.job.id === 'ej')).toMatchObject({ checked: true, desiredOutcomes: [{ id: 'e-do', checked: false }] });
  });

  it.each(['functional_job', 'consumption_chain_job', 'emotional_job', 'social_job'] as const)('browses canonical %s without legacy kind mapping', kind => {
    const document = normalizeLegacyJobs(productReadFixture());
    const result = canonicalProductDiscovery(document, 'unmatched title', { kind });
    expect(result.jobGroups.map(group => group.job.kind)).toEqual(kind === 'functional_job' ? [kind, kind, kind] : [kind]);
    expect(result.jobGroups.every(group => group.showJobCandidate && group.desiredOutcomes!.length === 0)).toBe(true);
    expect(result.createChoices).toEqual([]);
  });

  it('preserves branch-local Desired Outcome browsing and never falls back from invalid owners', () => {
    const document = normalizeLegacyJobs(productReadFixture());
    const branch = canonicalProductDiscovery(document, 'New title', { jobId: 'rj', kind: 'desired_outcome' });
    expect(branch).toMatchObject({ status: 'available', createChoices: [], jobGroups: [{ job: { id: 'rj' }, showJobCandidate: false, desiredOutcomes: [{ id: 'r-do', owningJobId: 'rj', checked: true }] }] });
    expect(canonicalProductDiscovery(document, 'Outcome A', { jobId: 'rj' }).jobGroups).toEqual([]);
    expect(canonicalProductDiscovery(document, '', { jobId: 'u' })).toMatchObject({ status: 'available', jobGroups: [{ job: { id: 'u' }, checked: false }] });
    for (const jobId of ['missing', 'a', 'f', 'p', '']) expect(canonicalProductDiscovery(document, ' New Title ', { jobId })).toEqual({ status: 'unavailable', productId: 'p', query: 'new title', title: 'New Title', jobGroups: [], kindShortcutMatches: [], createChoices: [] });
    for (const productId of ['missing', 'j', 'f']) expect(productClientIntentDiscovery(document, productId, { query: 'New', readModel: 'canonical' })).toMatchObject({ status: 'unavailable', jobGroups: [], kindShortcutMatches: [], createChoices: [] });
  });

  it.each(['', '  ', ' New Title ', 'Same activity', 'Related criterion'])('never offers canonical creation for query "%s" globally or under a valid owner', query => {
    const legacy = productReadFixture(); const document = normalizeLegacyJobs(legacy);
    for (const jobId of [undefined, 'j', 'rj', 'u']) {
      const result = jobId === undefined ? canonicalProductDiscovery(document, query) : canonicalProductDiscovery(document, query, { jobId });
      expect(result.status).toBe('available'); expect(result.createChoices).toEqual([]);
      expect(result.query).toBe(query.trim().toLocaleLowerCase()); expect(result.title).toBe(query.trim());
    }
    if (query.trim()) expect(productClientIntentDiscovery(legacy, 'p', { query }).createChoices.map(choice => choice.kind)).toEqual(['core_functional_job', 'consumption_chain_job', 'emotional_job', 'social_job', 'related_job', 'desired_outcome']);
  });

  it('merges exact intent identities while ignoring stale, wrong-kind and foreign ordinary DO selections', () => {
    const document = normalizeLegacyJobs(productReadFixture());
    document.productJobIntents.find(intent => intent.id === 'pi')!.addressedDesiredOutcomeIds = ['a'];
    document.productJobIntents.push(
      { id: 'duplicate', productId: 'p', jobId: 'j', addressedDesiredOutcomeIds: ['b', 'b', 'r-do', 'f', 'rep', 'missing'] },
      { id: 'other-product', productId: 'missing-product', jobId: 'u', addressedDesiredOutcomeIds: [] },
      { id: 'missing-job', productId: 'p', jobId: 'missing', addressedDesiredOutcomeIds: [] },
      { id: 'wrong-job', productId: 'p', jobId: 'f', addressedDesiredOutcomeIds: [] },
    );
    document.relationships.push({ id: 'duplicate-owner', kind: 'job_has_desired_outcome', jobId: 'j', desiredOutcomeId: 'a' }, { id: 'stale-owner', kind: 'job_has_desired_outcome', jobId: 'j', desiredOutcomeId: 'missing' }, { id: 'wrong-owner', kind: 'job_has_desired_outcome', jobId: 'j', desiredOutcomeId: 'f' });
    const result = canonicalProductDiscovery(document);
    expect(result.jobGroups.find(group => group.job.id === 'j')).toMatchObject({ id: 'product-intent:p:j', checked: true, productJobIntentIds: ['duplicate', 'pi'], desiredOutcomes: [{ id: 'a', owningJobId: 'j', checked: true }, { id: 'b', owningJobId: 'j', checked: true }] });
    expect(result.jobGroups.find(group => group.job.id === 'u')).toMatchObject({ checked: false, productJobIntentIds: [] });
    expect(result.jobGroups.map(group => group.job.id)).not.toContain('f');
  });

  it('does not infer Product membership or outcomes from contextual parents or financial contexts', () => {
    let document = normalizeLegacyJobs(productReadFixture());
    document.productJobIntents = document.productJobIntents.filter(intent => intent.jobId === 'rj');
    const expected = canonicalProductDiscovery(document);
    document = setJobContextualParents(document, { targetJobId: 'rj', parentJobIds: ['j', 'ej', 'u'], newRelationshipIds: ['e-r', 'u-r'] });
    document = setFinancialDesiredOutcomeJobContexts(document, { financialDesiredOutcomeId: 'unselected-f', jobIds: ['j', 'rj', 'u'], newRelationshipIds: ['j-f', 'r-f', 'u-f'] });
    expect(canonicalProductDiscovery(document)).toEqual(expected);
    expect(canonicalProductDiscovery(document).jobGroups.filter(group => group.checked).map(group => group.job.id)).toEqual(['rj']);
    expect(canonicalProductDiscovery(document, 'Outcome A', { jobId: 'rj' }).jobGroups).toEqual([]);
    expect(canonicalProductDiscovery(document).jobGroups.every(group => !('contextualCoreJob' in group) && !('contextualParentJobs' in group))).toBe(true);
  });

  it.each(['empty', 'emotional-social-only'] as const)('uses explicit read mode for %s canonical graphs without exposing creation', shape => {
    const legacy = createEmptyMapDocument({ mapId: 'empty', title: 'Empty', viewId: 'v', viewTitle: 'View' });
    legacy.entities.push({ id: 'p', title: 'Product', kind: 'product' });
    if (shape === 'emotional-social-only') legacy.entities.push({ id: 'e', title: 'Emotional', kind: 'emotional_job' }, { id: 's', title: 'Social', kind: 'social_job' });
    const document = normalizeLegacyJobs(legacy);
    expect(document).toEqual(legacy);
    expect(canonicalProductDiscovery(document, 'functional').kindShortcutMatches).toEqual([{ kind: 'functional_job', label: 'Functional Job' }]);
    expect(canonicalProductDiscovery(document, 'functional').createChoices).toEqual([]);
    expect(productClientIntentDiscovery(legacy, 'p', { query: 'functional' }).kindShortcutMatches).toEqual([{ kind: 'core_functional_job', label: 'Core Functional Job' }]);
    expect(productClientIntentDiscovery(legacy, 'p', { query: 'functional' }).createChoices.length).toBeGreaterThan(0);
    expect(canonicalProductDiscovery(document).jobGroups).toHaveLength(shape === 'empty' ? 0 : 2);
  });

  it.each(['functional', 'Functional Job', 'job', 'core', 'related', 'FJ', 'desired', 'financial'])('keeps Product-specific canonical shortcuts and excludes FDO for query "%s"', query => {
    const document = normalizeLegacyJobs(productReadFixture());
    const result = canonicalProductDiscovery(document, query);
    expect(result.kindShortcutMatches.some(shortcut => shortcut.kind === 'functional_job')).toBe('functional job'.includes(query.toLocaleLowerCase()));
    expect(result.kindShortcutMatches.filter(shortcut => shortcut.kind !== 'functional_job')).toEqual(clientIntentKindShortcutMatches(query).filter(shortcut => !['core_functional_job', 'related_job', 'financial_desired_outcome'].includes(shortcut.kind)));
    expect(result.kindShortcutMatches.map(shortcut => shortcut.kind)).not.toContain('financial_desired_outcome');
    expect(result.kindShortcutMatches.map(shortcut => shortcut.kind)).not.toContain('core_functional_job');
    expect(result.kindShortcutMatches.map(shortcut => shortcut.kind)).not.toContain('related_job');
    expect(result.jobGroups.map(group => group.job.kind)).not.toContain('financial_desired_outcome');
    expect(result.createChoices).toEqual([]);
    expect(CLIENT_INTENT_DISCOVERY_KINDS).toContain('core_functional_job');
    expect(clientIntentKindShortcutMatches('related')).toEqual([{ kind: 'related_job', label: 'Related Job' }]);
  });

  it.each(['legacy', 'canonical'] as const)('%s is deterministic on frozen documents and retains sorted IDs and selection isolation', representation => {
    const legacy = productReadFixture(); const document = representation === 'legacy' ? legacy : normalizeLegacyJobs(legacy);
    document.entities.find(entity => entity.id === 'b')!.title = 'Outcome A';
    const reversed = structuredClone(document);
    reversed.entities.reverse(); reversed.relationships.reverse(); reversed.productJobIntents.reverse();
    const read = (source: MapReadDocument) => canonicalProductDiscovery(source);
    const before = structuredClone(document); freezeMapReadFixture(document);
    const result = representation === 'legacy' ? productClientIntentDiscovery(legacy, 'p', { query: '' }) : read(document);
    if (representation === 'legacy') {
      const reversedLegacy = { ...legacy, entities: [...legacy.entities].reverse(), relationships: [...legacy.relationships].reverse(), productJobIntents: [...legacy.productJobIntents].reverse() };
      expect(productClientIntentDiscovery(reversedLegacy, 'p', { query: '' })).toEqual(result);
    } else expect(read(reversed)).toEqual(result);
    const job = result.jobGroups.find(group => group.job.id === 'j')!;
    expect(job.desiredOutcomes!.map(outcome => outcome.id)).toEqual(['a', 'b']);
    job.productJobIntentIds.pop(); job.desiredOutcomes![0]!.checked = false;
    expect(document).toEqual(before);
  });
});
