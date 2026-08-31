import { describe, expect, it } from 'vitest';
import { createEmptyMapDocument, type MapDocument } from '@vee/domain';
import { applyTouchpointEditDraft, connectionPickerCatalogue, createTouchpointIntentDraft, equalTouchpointIntentDraft, filterConnectionCandidates, selectCurrentOfferIntent, touchpointIntentCatalogue, validateTouchpointIntentDraft } from './touchpoint-edit';

function fixture(): MapDocument {
  return {
    ...createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' }),
    entities: [
      { id: 'job', kind: 'core_functional_job', title: 'Job' }, { id: 'emotional', kind: 'emotional_job', title: 'Feel safe' },
      { id: 'do-a', kind: 'desired_outcome', title: 'DO A' }, { id: 'do-b', kind: 'desired_outcome', title: 'DO B' },
      { id: 'fdo', kind: 'financial_desired_outcome', title: 'Affordable' }, { id: 'product', kind: 'product', title: 'Product' },
      { id: 'offer-a', kind: 'offer', title: 'Offer A' }, { id: 'offer-b', kind: 'offer', title: 'Offer B' }, { id: 'touch', kind: 'touchpoint', title: 'Touchpoint' },
    ],
    relationships: [
      { id: 'owns-a', kind: 'job_has_desired_outcome', jobId: 'job', desiredOutcomeId: 'do-a' }, { id: 'owns-b', kind: 'job_has_desired_outcome', jobId: 'job', desiredOutcomeId: 'do-b' },
      { id: 'packages-a', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' }, { id: 'packages-b', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-b' },
      { id: 'presents-a', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touch' }, { id: 'presents-b', kind: 'offer_presented_at_touchpoint', offerId: 'offer-b', touchpointId: 'touch' },
    ],
    productJobIntents: [{ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] }],
    offerJobSelections: [{ id: 'offer-job-a', offerId: 'offer-a', productJobIntentId: 'intent' }, { id: 'offer-job-b', offerId: 'offer-b', productJobIntentId: 'intent' }],
    touchpointJobSelections: [
      { id: 'path-a', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
      { id: 'path-b', touchpointId: 'touch', offerId: 'offer-b', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a', 'do-b'] },
    ],
  };
}

describe('Touchpoint edit intent draft', () => {
  it('connection picker filters by exact entity kind and partial title', () => {
    const candidates = connectionPickerCatalogue(fixture(), 'touchpoint');
    expect(filterConnectionCandidates(candidates, { kind: 'core_functional_job', query: '' }).map(candidate => candidate.semanticLeafId)).toEqual(['do-a', 'do-b']);
    expect(filterConnectionCandidates(candidates, { query: 'safe' }).map(candidate => candidate.semanticLeafId)).toEqual(['emotional']);
    expect(filterConnectionCandidates(candidates, { query: 'do b' }).map(candidate => candidate.semanticLeafId)).toEqual(['do-b']);
  });

  it('DO results retain their owning Job', () => {
    const result = connectionPickerCatalogue(fixture(), 'touchpoint').find(candidate => candidate.semanticLeafId === 'do-a');
    expect(result).toMatchObject({ kind: 'job', entity: { id: 'job', kind: 'core_functional_job' }, desiredOutcome: { id: 'do-a' } });
  });

  it('FDO is excluded from Product connection candidates', () => {
    expect(connectionPickerCatalogue(fixture(), 'product').map(candidate => candidate.semanticLeafId)).not.toContain('fdo');
    expect(connectionPickerCatalogue(fixture(), 'offer').map(candidate => candidate.semanticLeafId)).toContain('fdo');
  });

  it('catalogues Client-owned semantic leaves independently of upstream intent', () => {
    const catalogue = touchpointIntentCatalogue(fixture());
    expect(catalogue.jobs.map(leaf => leaf.semanticLeafId)).toEqual(['do-a', 'do-b', 'emotional']);
    expect(catalogue.financial).toEqual([{ financialDesiredOutcomeId: 'fdo', contributorOfferIds: [] }]);
  });

  it('preserves each Desired Outcome to Offer path and snapshots stable branches', () => {
    const draft = createTouchpointIntentDraft(fixture(), 'touch');
    expect(draft.jobLeaves.find(leaf => leaf.semanticLeafId === 'do-a')?.contributorOfferIds).toEqual(['offer-a', 'offer-b']);
    expect(draft.jobLeaves.find(leaf => leaf.semanticLeafId === 'do-b')?.contributorOfferIds).toEqual(['offer-b']);
    expect(draft.durableBranchSnapshot.touchpointIntentLeafIds).toEqual(['job:do-a', 'job:do-b']);
    expect(draft.durableBranchSnapshot.otherClientIntentLeafIds).toEqual(['job:emotional', 'financial:fdo']);
  });

  it('compares contributor attribution and rejects pending leaves without one', () => {
    const left = createTouchpointIntentDraft(fixture(), 'touch'); const right = structuredClone(left);
    right.jobLeaves.find(leaf => leaf.semanticLeafId === 'do-a')!.contributorOfferIds = ['offer-a'];
    expect(equalTouchpointIntentDraft(left, right)).toBe(false);
    right.pendingJobLeafIds = ['emotional'];
    expect(validateTouchpointIntentDraft(right)).toMatch(/contributing Offer/);
  });

  it('copies valid current Offer intent into the draft with per-Offer attribution', () => {
    const document = fixture();
    document.productJobIntents.push(
      { id: 'emotional-intent', productId: 'product', jobId: 'emotional', addressedDesiredOutcomeIds: [] },
      { id: 'incomplete-intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: [] },
    );
    document.offerJobSelections.push(
      { id: 'offer-emotional', offerId: 'offer-a', productJobIntentId: 'emotional-intent' },
      { id: 'offer-incomplete', offerId: 'offer-a', productJobIntentId: 'incomplete-intent' },
    );
    document.offerFinancialIntents.push({ id: 'financial-intent', offerId: 'offer-b', financialDesiredOutcomeId: 'fdo' });
    const original = createTouchpointIntentDraft(document, 'touch');
    original.jobLeaves.forEach(leaf => { leaf.contributorOfferIds = []; });
    original.financialLeaves.forEach(leaf => { leaf.contributorOfferIds = []; });
    original.pendingJobLeafIds = ['emotional'];

    const selected = selectCurrentOfferIntent(document, original, ['offer-a', 'offer-b']);

    expect(selected.jobLeaves.find(leaf => leaf.semanticLeafId === 'do-a')?.contributorOfferIds).toEqual(['offer-a', 'offer-b']);
    expect(selected.jobLeaves.find(leaf => leaf.semanticLeafId === 'emotional')?.contributorOfferIds).toEqual(['offer-a']);
    expect(selected.financialLeaves[0]?.contributorOfferIds).toEqual(['offer-b']);
    expect(selected.pendingJobLeafIds).toEqual([]);
    expect(document.touchpointJobSelections).toHaveLength(2);
  });

  it('atomically applies structure, materialized intent, and mitigation from one draft', () => {
    const document = fixture();
    document.entities.push({ id: 'repulsor', kind: 'repulsor', title: 'Doubt' });
    document.relationships.push({ id: 'resists', kind: 'repulsor_resists', repulsorId: 'repulsor', targetEntityId: 'job' });
    const intent = createTouchpointIntentDraft(document, 'touch');
    intent.jobLeaves.find(leaf => leaf.semanticLeafId === 'do-a')!.contributorOfferIds = ['offer-a'];
    intent.jobLeaves.find(leaf => leaf.semanticLeafId === 'do-b')!.contributorOfferIds = [];
    const nextId = (() => { let value = 0; return () => `new-${++value}`; })();

    const next = applyTouchpointEditDraft(document, { touchpointId: 'touch', newId: nextId, draft: {
      title: 'Edited touchpoint', linkedOfferIds: ['offer-a'], parentTouchpointId: '', locatedInId: '', locatedInQuery: 'Website',
      locationDraft: { kind: 'new', title: 'Website' }, url: 'https://example.test', mitigatedRepulsorIds: ['repulsor'], touchpointIntent: intent,
    } });

    expect(document.entities.find(entity => entity.id === 'touch')?.title).toBe('Touchpoint');
    expect(document.touchpointContainers).toEqual([]);
    expect(next.entities.find(entity => entity.id === 'touch')).toMatchObject({ title: 'Edited touchpoint', locatedInId: 'new-1', url: 'https://example.test' });
    expect(next.touchpointJobSelections).toHaveLength(1);
    expect(next.relationships).toContainEqual(expect.objectContaining({ kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor' }));
  });

  it('rejects unresolved or unlinked contributors without changing the durable document', () => {
    const document = fixture();
    const intent = createTouchpointIntentDraft(document, 'touch');
    intent.pendingJobLeafIds = ['emotional'];
    const snapshot = structuredClone(document);
    expect(() => applyTouchpointEditDraft(document, { touchpointId: 'touch', newId: () => 'unused', draft: {
      title: 'Not applied', linkedOfferIds: ['offer-a'], parentTouchpointId: '', locatedInId: '', locatedInQuery: '', locationDraft: { kind: 'none' }, url: '', mitigatedRepulsorIds: [], touchpointIntent: intent,
    } })).toThrow(/contributing Offer/);
    expect(document).toEqual(snapshot);
  });
});
