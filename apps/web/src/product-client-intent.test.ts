import { createEmptyMapDocument, type MapDocument } from '@vee/domain';
import { describe, expect, it } from 'vitest';
import { PRODUCT_CLIENT_INTENT_KINDS, productClientIntent, productClientIntentDiscovery } from './product-client-intent';
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
  it('projects five kinds, incomplete outcome knowledge and no EJ/SJ outcome branch', () => {
    const groups = productClientIntent(fixture(), 'p')!.groups;
    expect(groups.map(g => g.kind)).toEqual(PRODUCT_CLIENT_INTENT_KINDS);
    for (const g of groups.slice(0, 3)) expect(g.items[0]).toMatchObject({ outcomeKnowledge: 'empty', desiredOutcomes: [] });
    for (const g of groups.slice(3)) expect(g.items[0]).not.toHaveProperty('desiredOutcomes');
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
  it.each(['core_functional_job', 'related_job', 'consumption_chain_job'] as const)('projects nonempty selected scope for %s', kind => {
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
    expect(discovery(d, 'social').jobGroups[0]).not.toHaveProperty('desiredOutcomes');
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
    for (const jobId of ['missing', 'do', 'social_job']) expect(discovery(d, 'New', { jobId })).toMatchObject({ status: 'unavailable', jobGroups: [], createChoices: [] });
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
