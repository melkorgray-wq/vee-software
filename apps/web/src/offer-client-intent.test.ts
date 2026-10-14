import { normalizeLegacyJobs, setJobContextualParents, setFinancialDesiredOutcomeJobContexts, type MapReadDocument } from '@vee/domain';
import { freezeMapReadFixture, legacyOfferReadFixture } from './map-read-test-fixture';
import { describe, expect, it } from 'vitest';
import type { MapDocument, OfferJobSelection } from '@vee/domain';
import {
  OFFER_CLIENT_INTENT_KINDS,
  offerClientIntent,
  offerClientIntentDiscovery,
  type OfferClientIntentJobItem,
} from './offer-client-intent';

function fixture(): MapDocument {
  return {
    id: 'map', title: 'Map', views: [], placements: [], epistemicAnnotations: [], touchpointContainers: [],
    entities: [
      { id: 'product', kind: 'product', title: 'Product' },
      { id: 'other-product', kind: 'product', title: 'Other Product' },
      { id: 'offer', kind: 'offer', title: 'Offer', currentContentSource: null },
      { id: 'other-offer', kind: 'offer', title: 'Other Offer', currentContentSource: null },
      { id: 'cfj-z', kind: 'core_functional_job', title: 'Zulu job' },
      { id: 'cfj-a2', kind: 'core_functional_job', title: 'Alpha job' },
      { id: 'cfj-a1', kind: 'core_functional_job', title: 'Alpha job' },
      { id: 'rj', kind: 'related_job', title: 'Related' },
      { id: 'ccj', kind: 'consumption_chain_job', title: 'Consumption' },
      { id: 'ej', kind: 'emotional_job', title: 'Emotional' },
      { id: 'sj', kind: 'social_job', title: 'Social' },
      { id: 'do-z', kind: 'desired_outcome', title: 'Zulu outcome' },
      { id: 'do-a', kind: 'desired_outcome', title: 'Alpha outcome' },
      { id: 'do-other', kind: 'desired_outcome', title: 'Other outcome' },
      { id: 'do-outside-intent', kind: 'desired_outcome', title: 'Outside Product intent' },
      { id: 'fdo-z', kind: 'financial_desired_outcome', title: 'Zulu financial' },
      { id: 'fdo-a', kind: 'financial_desired_outcome', title: 'Alpha financial' },
      { id: 'wrong-kind', kind: 'product', title: 'Wrong kind' },
    ],
    relationships: [
      { id: 'product-offer', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer' },
      { id: 'product-other-offer', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'other-offer' },
      { id: 'cfj-z-do-z', kind: 'job_has_desired_outcome', jobId: 'cfj-z', desiredOutcomeId: 'do-z' },
      { id: 'cfj-z-do-a', kind: 'job_has_desired_outcome', jobId: 'cfj-z', desiredOutcomeId: 'do-a' },
      { id: 'cfj-z-do-outside', kind: 'job_has_desired_outcome', jobId: 'cfj-z', desiredOutcomeId: 'do-outside-intent' },
      { id: 'rj-do-other', kind: 'job_has_desired_outcome', jobId: 'rj', desiredOutcomeId: 'do-other' },
    ],
    productJobIntents: [
      { id: 'intent-cfj-z', productId: 'product', jobId: 'cfj-z', addressedDesiredOutcomeIds: ['do-z', 'do-a'] },
      { id: 'intent-cfj-a2', productId: 'product', jobId: 'cfj-a2', addressedDesiredOutcomeIds: [] },
      { id: 'intent-cfj-a1', productId: 'product', jobId: 'cfj-a1', addressedDesiredOutcomeIds: [] },
      { id: 'intent-rj', productId: 'product', jobId: 'rj', addressedDesiredOutcomeIds: ['do-other'] },
      { id: 'intent-ccj', productId: 'product', jobId: 'ccj', addressedDesiredOutcomeIds: [] },
      { id: 'intent-ej', productId: 'product', jobId: 'ej', addressedDesiredOutcomeIds: ['do-z'] },
      { id: 'intent-sj', productId: 'product', jobId: 'sj', addressedDesiredOutcomeIds: ['do-z'] },
    ],
    offerJobSelections: [], offerFinancialIntents: [],
    touchpointJobSelections: [], touchpointFinancialSelections: [],
  };
}

const selection = (
  id: string,
  offerId: string,
  productJobIntentId: string,
  addressedDesiredOutcomeIds?: string[],
): OfferJobSelection => ({ id, offerId, productJobIntentId, ...(addressedDesiredOutcomeIds === undefined ? {} : { addressedDesiredOutcomeIds }) });

describe('Offer Client-intent read projection', () => {
  it('returns undefined for a missing or wrong-kind ID and empty groups for an empty Offer', () => {
    const document = fixture();
    expect(offerClientIntent(document, 'missing')).toBeUndefined();
    expect(offerClientIntent(document, 'product')).toBeUndefined();
    expect(offerClientIntent(document, 'offer')).toEqual({ offerId: 'offer', groups: [] });
  });

  it('projects all five Job kinds and independent FDO leaves in canonical order', () => {
    const document = fixture();
    document.offerJobSelections.push(
      selection('selection-sj', 'offer', 'intent-sj', []),
      selection('selection-rj', 'offer', 'intent-rj', []),
      selection('selection-ej', 'offer', 'intent-ej', []),
      selection('selection-ccj', 'offer', 'intent-ccj', []),
      selection('selection-cfj', 'offer', 'intent-cfj-z', []),
    );
    document.offerFinancialIntents.push(
      { id: 'financial-z', offerId: 'offer', financialDesiredOutcomeId: 'fdo-z' },
      { id: 'financial-a', offerId: 'offer', financialDesiredOutcomeId: 'fdo-a' },
    );

    const projection = offerClientIntent(document, 'offer')!;
    expect(OFFER_CLIENT_INTENT_KINDS).toEqual([
      'core_functional_job', 'related_job', 'consumption_chain_job',
      'emotional_job', 'social_job', 'financial_desired_outcome',
    ]);
    expect(projection.groups.map((group) => group.kind)).toEqual(OFFER_CLIENT_INTENT_KINDS);
    expect(projection.groups.at(-1)?.items.map((item) => item.id)).toEqual(['financial-a', 'financial-z']);
  });

  it('sorts multiple Jobs by title then entity ID and preserves selection and Product-intent provenance', () => {
    const document = fixture();
    document.offerJobSelections.push(
      selection('selection-z', 'offer', 'intent-cfj-z', []),
      selection('selection-a2', 'offer', 'intent-cfj-a2', []),
      selection('selection-a1', 'offer', 'intent-cfj-a1', []),
    );
    const projection = offerClientIntent(document, 'offer')!;
    const coreGroup = projection.groups.find((group) => group.kind === 'core_functional_job');
    expect(coreGroup?.items.map((item) => item.jobId)).toEqual(['cfj-a1', 'cfj-a2', 'cfj-z']);
    expect(coreGroup?.items[2]).toMatchObject({
      id: 'selection-z', selectionId: 'selection-z', productJobIntentId: 'intent-cfj-z', jobId: 'cfj-z',
    });
  });

  it('keeps a DO-bearing Job with an empty effective subset and distinguishes fallback from explicit empty', () => {
    const document = fixture();
    document.offerJobSelections.push(
      selection('fallback', 'offer', 'intent-cfj-z'),
      selection('explicit-empty', 'offer', 'intent-cfj-z', []),
      selection('empty-job', 'offer', 'intent-ccj'),
    );
    const groups = offerClientIntent(document, 'offer')!.groups;
    const items: OfferClientIntentJobItem[] = [];
    for (const group of groups) {
      if (group.kind !== 'financial_desired_outcome') items.push(...group.items as OfferClientIntentJobItem[]);
    }
    expect(items.find((item) => item.id === 'fallback')).toMatchObject({ desiredOutcomeIds: ['do-a', 'do-z'] });
    expect(items.find((item) => item.id === 'explicit-empty')).toMatchObject({ desiredOutcomeIds: [] });
    expect(items.find((item) => item.id === 'empty-job')).toMatchObject({ jobId: 'ccj', desiredOutcomeIds: [] });
  });

  it('filters duplicate, stale, wrong-kind, and other-Job outcome IDs', () => {
    const document = fixture();
    document.offerJobSelections.push(selection('selection', 'offer', 'intent-cfj-z', [
      'do-z', 'do-z', 'missing', 'wrong-kind', 'do-other', 'do-outside-intent', 'do-a',
    ]));
    const group = offerClientIntent(document, 'offer')!.groups.find((candidate) => candidate.kind === 'core_functional_job');
    const item = group?.items[0];
    expect(item).toMatchObject({ desiredOutcomeIds: ['do-a', 'do-z'] });
    expect(item?.desiredOutcomes.map((outcome) => outcome.id)).toEqual(['do-a', 'do-z']);
  });

  it('excludes selections whose Product intent does not belong to the inspected Offer Product', () => {
    const document = fixture();
    document.productJobIntents.push({
      id: 'other-product-intent', productId: 'other-product', jobId: 'cfj-z', addressedDesiredOutcomeIds: ['do-z'],
    });
    document.offerJobSelections.push(selection('wrong-product', 'offer', 'other-product-intent', ['do-z']));
    expect(offerClientIntent(document, 'offer')).toEqual({ offerId: 'offer', groups: [] });
  });

  it('does not project Job selections without a valid Product-to-Offer relationship but keeps FDO intent', () => {
    const document = fixture();
    document.relationships = document.relationships.filter((relationship) => relationship.id !== 'product-offer');
    document.offerJobSelections.push(selection('job-selection', 'offer', 'intent-cfj-z', ['do-z']));
    document.offerFinancialIntents.push({ id: 'financial', offerId: 'offer', financialDesiredOutcomeId: 'fdo-a' });
    expect(offerClientIntent(document, 'offer')!.groups).toMatchObject([{
      kind: 'financial_desired_outcome', items: [{ id: 'financial', financialDesiredOutcomeId: 'fdo-a' }],
    }]);
  });

  it('never adds an ordinary Desired Outcome layer to Emotional or Social Jobs', () => {
    const document = fixture();
    document.offerJobSelections.push(
      selection('emotional', 'offer', 'intent-ej', ['do-z']),
      selection('social', 'offer', 'intent-sj'),
    );
    expect(offerClientIntent(document, 'offer')!.groups.map((group) => group.items[0])).toMatchObject([
      { kind: 'emotional_job', desiredOutcomeIds: [], desiredOutcomes: [] },
      { kind: 'social_job', desiredOutcomeIds: [], desiredOutcomes: [] },
    ]);
  });

  it('excludes unselected Product intent, other Offer selections, and other Offer FDO intent', () => {
    const document = fixture();
    document.offerJobSelections.push(selection('other-selection', 'other-offer', 'intent-rj'));
    document.offerFinancialIntents.push({ id: 'other-fdo', offerId: 'other-offer', financialDesiredOutcomeId: 'fdo-a' });
    expect(offerClientIntent(document, 'offer')).toEqual({ offerId: 'offer', groups: [] });
  });

  it('ignores malformed records and projects each valid FDO record as an independent leaf', () => {
    const document = fixture();
    document.offerJobSelections.push(
      selection('missing-intent', 'offer', 'missing'),
      selection('wrong-job', 'offer', 'wrong-intent'),
    );
    document.productJobIntents.push({ id: 'wrong-intent', productId: 'product', jobId: 'wrong-kind', addressedDesiredOutcomeIds: [] });
    document.offerFinancialIntents.push(
      { id: 'financial-2', offerId: 'offer', financialDesiredOutcomeId: 'fdo-a' },
      { id: 'financial-1', offerId: 'offer', financialDesiredOutcomeId: 'fdo-a' },
      { id: 'stale', offerId: 'offer', financialDesiredOutcomeId: 'missing' },
      { id: 'wrong', offerId: 'offer', financialDesiredOutcomeId: 'wrong-kind' },
    );
    const projection = offerClientIntent(document, 'offer')!;
    expect(projection.groups).toHaveLength(1);
    expect(projection.groups[0]?.items).toMatchObject([
      { id: 'financial-1', offerFinancialIntentId: 'financial-1', financialDesiredOutcomeId: 'fdo-a' },
      { id: 'financial-2', offerFinancialIntentId: 'financial-2', financialDesiredOutcomeId: 'fdo-a' },
    ]);
  });

  it('is deterministic and independent of Touchpoint records or external draft data', () => {
    const document = fixture();
    document.offerJobSelections.push(selection('selection', 'offer', 'intent-cfj-z', ['do-z', 'do-a']));
    const expected = offerClientIntent(document, 'offer');
    const withTouchpointRecords = structuredClone(document);
    withTouchpointRecords.touchpointJobSelections.push({
      id: 'touchpoint-job', touchpointId: 'missing', offerId: 'offer',
      productJobIntentId: 'intent-rj', addressedDesiredOutcomeIds: ['do-other'],
    });
    withTouchpointRecords.touchpointFinancialSelections.push({
      id: 'touchpoint-fdo', touchpointId: 'missing', offerId: 'offer',
      offerFinancialIntentId: 'missing', financialDesiredOutcomeId: 'fdo-a',
    });
    withTouchpointRecords.entities.reverse();
    withTouchpointRecords.relationships.reverse();
    withTouchpointRecords.productJobIntents.reverse();
    withTouchpointRecords.offerJobSelections.reverse();
    const unrelatedDraft = { offerJobSelections: [selection('draft', 'offer', 'intent-rj')] };
    expect(unrelatedDraft.offerJobSelections).toHaveLength(1);
    expect(offerClientIntent(withTouchpointRecords, 'offer')).toEqual(expected);
  });
});

describe('Offer Client-intent discovery projection', () => {
  it('projects only the linked Product universe with valid owning DO relationships and direct FDOs', () => {
    const document = fixture();
    document.productJobIntents.push({ id: 'other-intent', productId: 'other-product', jobId: 'cfj-a1', addressedDesiredOutcomeIds: [] });
    const discovery = offerClientIntentDiscovery(document, 'offer', { query: '' });
    expect(discovery.status).toBe('available');
    expect(discovery.source?.productId).toBe('product');
    expect(discovery.source?.jobGroups.map(group => group.productJobIntentId)).not.toContain('other-intent');
    expect(discovery.source?.jobGroups.find(group => group.job.id === 'cfj-z')?.desiredOutcomes.map(outcome => outcome.id)).toEqual(['do-a', 'do-z']);
    expect(discovery.source?.jobGroups.find(group => group.job.id === 'rj')?.desiredOutcomes.map(outcome => outcome.id)).toEqual(['do-other']);
    expect(discovery.financialCandidates.map(candidate => candidate.id)).toEqual(['fdo-a', 'fdo-z']);
  });

  it('keeps membership for DO-bearing Jobs and never gives Emotional or Social Jobs a DO layer', () => {
    const discovery = offerClientIntentDiscovery(fixture(), 'offer', { query: '' });
    expect(discovery.source?.jobGroups.find(group => group.job.id === 'ccj')).toMatchObject({ showJobCandidate: true, desiredOutcomes: [] });
    expect(discovery.source?.jobGroups.find(group => group.job.id === 'ej')?.desiredOutcomes).toEqual([]);
    expect(discovery.source?.jobGroups.find(group => group.job.id === 'sj')?.desiredOutcomes).toEqual([]);
  });

  it('derives checked state solely from committed Offer records', () => {
    const document = fixture();
    document.offerJobSelections.push(selection('selected', 'offer', 'intent-cfj-z', ['do-z']));
    document.offerFinancialIntents.push({ id: 'selected-fdo', offerId: 'offer', financialDesiredOutcomeId: 'fdo-a' });
    const discovery = offerClientIntentDiscovery(document, 'offer', { query: '' });
    const job = discovery.source?.jobGroups.find(group => group.job.id === 'cfj-z');
    expect(job?.checked).toBe(true);
    expect(job?.desiredOutcomes.map(outcome => [outcome.id, outcome.checked])).toEqual([['do-a', false], ['do-z', true]]);
    expect(discovery.financialCandidates.map(outcome => [outcome.id, outcome.checked])).toEqual([['fdo-a', true], ['fdo-z', false]]);
  });

  it('matches Job, nested DO and FDO titles while preserving owning Job context', () => {
    expect(offerClientIntentDiscovery(fixture(), 'offer', { query: 'Zulu job' }).source?.jobGroups.map(group => group.job.id)).toEqual(['cfj-z']);
    const outcome = offerClientIntentDiscovery(fixture(), 'offer', { query: 'Alpha outcome' });
    expect(outcome.source?.jobGroups).toMatchObject([{ job: { id: 'cfj-z' }, showJobCandidate: false, desiredOutcomes: [{ id: 'do-a' }] }]);
    expect(offerClientIntentDiscovery(fixture(), 'offer', { query: 'Zulu financial' }).financialCandidates.map(item => item.id)).toEqual(['fdo-z']);
  });

  it('uses shared kind aliases and kind filtering never expands eligibility', () => {
    const shortcuts = offerClientIntentDiscovery(fixture(), 'offer', { query: 'do' }).kindShortcutMatches.map(item => item.kind);
    expect(shortcuts).toEqual(expect.arrayContaining(['desired_outcome', 'financial_desired_outcome']));
    const desired = offerClientIntentDiscovery(fixture(), 'offer', { query: 'do', kind: 'desired_outcome' });
    expect(desired.source?.jobGroups.every(group => !group.showJobCandidate)).toBe(true);
    expect(desired.source?.jobGroups.flatMap(group => group.desiredOutcomes.map(outcome => outcome.id))).toEqual(['do-other', 'do-a', 'do-z']);
    expect(desired.financialCandidates).toEqual([]);
  });

  it('returns an explicit unavailable result, excludes malformed data, and does not mutate the document', () => {
    const document = fixture();
    document.productJobIntents.push({ id: 'stale', productId: 'product', jobId: 'missing', addressedDesiredOutcomeIds: ['missing'] });
    const before = structuredClone(document);
    expect(offerClientIntentDiscovery(document, 'offer', { query: '' }).source?.jobGroups.some(group => group.id === 'stale')).toBe(false);
    expect(document).toEqual(before);
    document.relationships = document.relationships.filter(relation => relation.id !== 'product-offer');
    expect(offerClientIntentDiscovery(document, 'offer', { query: '' })).toMatchObject({ status: 'unavailable', offerId: 'offer', financialCandidates: [] });
  });
});

describe('EJ/SJ ordinary outcome projection', () => {
  it.each(['emotional_job', 'social_job'] as const)('reads and discovers valid owned %s outcomes', kind => {
    const document = fixture(); const jobId = kind === 'emotional_job' ? 'ej' : 'sj';
    document.relationships.push({ id: 'ej-sj-owns', kind: 'job_has_desired_outcome', jobId, desiredOutcomeId: 'do-z' });
    document.offerJobSelections.push(selection('ej-sj-selection', 'offer', `intent-${jobId}`, ['do-z', 'do-other', 'missing']));
    const group = offerClientIntent(document, 'offer')!.groups.find(group => group.kind === kind)!;
    expect(group.items[0]).toMatchObject({ desiredOutcomeIds: ['do-z'], desiredOutcomes: [{ id: 'do-z' }] });
    expect(JSON.stringify(offerClientIntentDiscovery(document, 'offer', { query: 'Zulu outcome' }))).toContain('do-z');
  });
});


const readOfferJobs = (document: MapReadDocument, offerId = 'o') => offerClientIntent(document, offerId)!.groups.flatMap(group => group.kind === 'financial_desired_outcome' ? [] : group.items);

describe('canonical Offer Client intent read compatibility', () => {
  it('groups normalized Functional Jobs while retaining every selection and Product intent reference', () => {
    const legacy = legacyOfferReadFixture(); const document = normalizeLegacyJobs(legacy);
    const before = structuredClone(document); freezeMapReadFixture(legacy); freezeMapReadFixture(document);
    expect(offerClientIntent(document, 'o')!.groups.map(group => group.kind)).toEqual(['functional_job', 'consumption_chain_job', 'emotional_job', 'social_job', 'financial_desired_outcome']);
    expect(readOfferJobs(document).map(item => item.jobId)).toEqual(['j', 'rj', 'ccj', 'ej', 'sj']);
    const expected = readOfferJobs(legacy).map(item => ({ ...item, kind: item.kind === 'core_functional_job' || item.kind === 'related_job' ? 'functional_job' : item.kind,
      job: { ...item.job, kind: item.job.kind === 'core_functional_job' || item.job.kind === 'related_job' ? 'functional_job' : item.job.kind } }));
    expect(readOfferJobs(document)).toEqual(expected);
    expect(readOfferJobs(document).slice(0, 2).map(({ id, selectionId, productJobIntentId, jobId, desiredOutcomeIds }) => ({ id, selectionId, productJobIntentId, jobId, desiredOutcomeIds }))).toEqual([
      { id: 'os', selectionId: 'os', productJobIntentId: 'pi', jobId: 'j', desiredOutcomeIds: ['a'] },
      { id: 'rs', selectionId: 'rs', productJobIntentId: 'pri', jobId: 'rj', desiredOutcomeIds: ['r-do'] },
    ]);
    expect(offerClientIntent(document, 'o')!.groups.at(-1)).toEqual(offerClientIntent(legacy, 'o')!.groups.at(-1));
    expect(document).toEqual(before);
  });

  it.each(['legacy', 'canonical'] as const)('%s keeps omitted, empty and independent selection records distinct', representation => {
    const document = representation === 'legacy' ? legacyOfferReadFixture() : normalizeLegacyJobs(legacyOfferReadFixture());
    document.offerJobSelections.push(
      { id: 'fallback', offerId: 'o', productJobIntentId: 'pi' },
      { id: 'empty', offerId: 'o', productJobIntentId: 'pi', addressedDesiredOutcomeIds: [] },
      { id: 'duplicate-path', offerId: 'o', productJobIntentId: 'pi', addressedDesiredOutcomeIds: ['b'] },
    );
    freezeMapReadFixture(document);
    const items = readOfferJobs(document).filter(item => item.jobId === 'j');
    expect(items.map(item => item.selectionId)).toEqual(['duplicate-path', 'empty', 'fallback', 'os']);
    expect(items.map(item => item.desiredOutcomeIds)).toEqual([['b'], [], ['a', 'b'], ['a']]);
    expect(readOfferJobs(document, 'o2').find(item => item.jobId === 'j')!.desiredOutcomeIds).toEqual(['a', 'b']);
  });

  it.each(['legacy', 'canonical'] as const)('%s retains Product ownership and intersection checks on malformed scope', representation => {
    const document = representation === 'legacy' ? legacyOfferReadFixture() : normalizeLegacyJobs(legacyOfferReadFixture());
    document.offerJobSelections[0]!.addressedDesiredOutcomeIds = ['a', 'a', 'outside', 'r-do', 'f', 'missing'];
    document.offerJobSelections.push(
      { id: 'foreign-intent', offerId: 'o', productJobIntentId: 'q-pi', addressedDesiredOutcomeIds: ['b'] },
      { id: 'stale-intent', offerId: 'o', productJobIntentId: 'missing' },
      { id: 'bad-job', offerId: 'o', productJobIntentId: 'bad-pi' },
    );
    document.productJobIntents.push({ id: 'bad-pi', productId: 'p', jobId: 'f', addressedDesiredOutcomeIds: [] });
    const before = structuredClone(document); freezeMapReadFixture(document);
    expect(readOfferJobs(document).filter(item => item.jobId === 'j').map(item => [item.id, item.desiredOutcomeIds])).toEqual([['os', ['a']]]);
    const orphaned = structuredClone(document);
    const packagingIndex = orphaned.relationships.findIndex(relation => relation.id === 'po');
    orphaned.relationships.splice(packagingIndex, 1);
    expect(offerClientIntent(orphaned, 'o')!.groups.map(group => group.kind)).toEqual(['financial_desired_outcome']);
    expect(document).toEqual(before);
  });

  it('ignores multiple Job contexts and Job-to-FDO links without inferred selection or parent metadata', () => {
    let document = normalizeLegacyJobs(legacyOfferReadFixture()); const expected = offerClientIntent(document, 'o');
    document = setJobContextualParents(document, { targetJobId: 'rj', parentJobIds: ['j', 'ej', 'u'], newRelationshipIds: ['e-r', 'u-r'] });
    document = setFinancialDesiredOutcomeJobContexts(document, { financialDesiredOutcomeId: 'unselected-f', jobIds: ['j', 'rj', 'u'], newRelationshipIds: ['j-f', 'r-f', 'u-f'] });
    const before = structuredClone(document); freezeMapReadFixture(document);
    expect(offerClientIntent(document, 'o')).toEqual(expected);
    expect(readOfferJobs(document).map(item => item.jobId)).not.toContain('u');
    expect(readOfferJobs(document).every(item => !('contextualParentJobs' in item))).toBe(true);
    expect(offerClientIntent({ ...document, offerJobSelections: [], offerFinancialIntents: [] }, 'o')).toEqual({ offerId: 'o', groups: [] });
    expect(document).toEqual(before);
  });

  it('retains each authored FDO record and excludes stale, wrong-kind and other-Offer financial records', () => {
    const document = normalizeLegacyJobs(legacyOfferReadFixture());
    document.offerFinancialIntents.push(
      { id: 'fi-duplicate', offerId: 'o', financialDesiredOutcomeId: 'f' },
      { id: 'stale-fdo', offerId: 'o', financialDesiredOutcomeId: 'missing' },
      { id: 'wrong-fdo', offerId: 'o', financialDesiredOutcomeId: 'j' },
    );
    freezeMapReadFixture(document);
    const group = offerClientIntent(document, 'o')!.groups.find(group => group.kind === 'financial_desired_outcome')!;
    expect(group.items.map(item => [item.id, item.offerFinancialIntentId, item.financialDesiredOutcomeId])).toEqual([['fi', 'fi', 'f'], ['fi-duplicate', 'fi-duplicate', 'f']]);
  });

  it('keeps exact ordering and empty/absent states without source mutation or discovery migration', () => {
    const legacy = legacyOfferReadFixture(); const document = normalizeLegacyJobs(legacy);
    const reversed = { ...document, entities: [...document.entities].reverse(), relationships: [...document.relationships].reverse(), productJobIntents: [...document.productJobIntents].reverse(), offerJobSelections: [...document.offerJobSelections].reverse(), offerFinancialIntents: [...document.offerFinancialIntents].reverse() };
    const before = structuredClone(document); freezeMapReadFixture(document);
    expect(offerClientIntent(reversed, 'o')).toEqual(offerClientIntent(document, 'o'));
    expect(offerClientIntent(document, 'missing')).toBeUndefined(); expect(offerClientIntent(document, 'p')).toBeUndefined();
    const item = readOfferJobs(document)[0]!; item.desiredOutcomeIds.pop(); item.desiredOutcomes.pop();
    expect(document).toEqual(before);
    expect(offerClientIntentDiscovery(legacy, 'o', { query: '' }).source!.jobGroups.map(group => group.job.kind)).toContain('related_job');
    expect(offerClientIntentDiscovery(legacy, 'o', { query: '' }).source!.jobGroups.map(group => group.job.kind)).not.toContain('functional_job');
  });
});
