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
