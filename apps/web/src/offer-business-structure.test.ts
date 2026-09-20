import { describe, expect, it } from 'vitest';
import { createEmptyMapDocument, type MapDocument } from '@vee/domain';
import { deriveOfferBusinessStructure } from './offer-business-structure';

function fixture(): MapDocument {
  const empty = createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' });
  return {
    ...empty,
    entities: [
      { id: 'product', kind: 'product', title: 'Platform' }, { id: 'offer', kind: 'offer', title: 'Plan' },
      { id: 'touch-b', kind: 'touchpoint', title: 'Support' }, { id: 'touch-a', kind: 'touchpoint', title: 'Checkout' },
      { id: 'job', kind: 'core_functional_job', title: 'Make progress' },
      { id: 'do-a', kind: 'desired_outcome', title: 'Finish faster' }, { id: 'do-b', kind: 'desired_outcome', title: 'Reduce effort' },
      { id: 'fdo', kind: 'financial_desired_outcome', title: 'Stay affordable' },
    ],
    relationships: [
      { id: 'po', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer' },
      { id: 'ot-b', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'touch-b' },
      { id: 'ot-a', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'touch-a' },
      { id: 'jd-a', kind: 'job_has_desired_outcome', jobId: 'job', desiredOutcomeId: 'do-a' },
      { id: 'jd-b', kind: 'job_has_desired_outcome', jobId: 'job', desiredOutcomeId: 'do-b' },
    ],
    productJobIntents: [{ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] }],
    offerJobSelections: [{ id: 'selection', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-b'] }],
    offerFinancialIntents: [{ id: 'financial', offerId: 'offer', financialDesiredOutcomeId: 'fdo' }],
  };
}

describe('deriveOfferBusinessStructure', () => {
  it('projects committed Offer structure and preserves its selected Desired Outcome subset', () => {
    const result = deriveOfferBusinessStructure(fixture(), 'offer');
    expect(result.product?.title).toBe('Platform');
    expect(result.touchpoints.map(entity => entity.title)).toEqual(['Checkout', 'Support']);
    expect(result.clientIntent.map(item => [item.job.title, item.desiredOutcomes.map(outcome => outcome.title)])).toEqual([['Make progress', ['Reduce effort']]]);
    expect(result.financialIntent.map(entity => entity.title)).toEqual(['Stay affordable']);
  });

  it('allows empty Offer intent and connected Touchpoints', () => {
    const document = fixture();
    document.offerJobSelections = []; document.offerFinancialIntents = [];
    document.relationships = document.relationships.filter(relation => relation.kind !== 'offer_presented_at_touchpoint');
    expect(deriveOfferBusinessStructure(document, 'offer')).toMatchObject({ touchpoints: [], clientIntent: [], financialIntent: [] });
  });
});
