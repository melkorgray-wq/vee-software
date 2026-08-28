import { describe, expect, it } from 'vitest';
import { createEmptyMapDocument, type MapDocument } from '@vee/domain';
import { createTouchpointIntentDraft, equalTouchpointIntentDraft, touchpointIntentCatalogue, validateTouchpointIntentDraft } from './touchpoint-edit';

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
});
