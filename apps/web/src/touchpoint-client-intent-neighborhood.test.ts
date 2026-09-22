import { describe, expect, it } from 'vitest';
import type { MapDocument } from '@vee/domain';
import {
  TOUCHPOINT_CLIENT_INTENT_GROUND_TYPE_IDS,
  deriveTouchpointClientIntentNeighborhood,
  type TouchpointClientIntentJobGround,
} from './touchpoint-client-intent-neighborhood';

function fixture(): MapDocument {
  return {
    id: 'map', title: 'Map', views: [], placements: [], epistemicAnnotations: [], touchpointContainers: [],
    entities: [
      { id: 'product-a', kind: 'product', title: 'Product A' }, { id: 'product-b', kind: 'product', title: 'Product B' },
      { id: 'offer-z', kind: 'offer', title: 'Zulu Offer' }, { id: 'offer-a', kind: 'offer', title: 'Alpha Offer' },
      { id: 'offer-b', kind: 'offer', title: 'Beta Offer' },
      { id: 'touch-z', kind: 'touchpoint', title: 'Zulu Touchpoint' }, { id: 'touch-a', kind: 'touchpoint', title: 'Alpha Touchpoint' },
      { id: 'touch-b', kind: 'touchpoint', title: 'Beta Touchpoint' }, { id: 'child', kind: 'touchpoint', title: 'Child' },
      { id: 'cfj', kind: 'core_functional_job', title: 'Build' }, { id: 'rj', kind: 'related_job', title: 'Coordinate' },
      { id: 'ccj', kind: 'consumption_chain_job', title: 'Acquire' }, { id: 'ej', kind: 'emotional_job', title: 'Feel confident' },
      { id: 'sj', kind: 'social_job', title: 'Belong' },
      { id: 'do-z', kind: 'desired_outcome', title: 'Zulu outcome' }, { id: 'do-a', kind: 'desired_outcome', title: 'Alpha outcome' },
      { id: 'do-b', kind: 'desired_outcome', title: 'Beta outcome' }, { id: 'do-other', kind: 'desired_outcome', title: 'Other outcome' },
      { id: 'fdo', kind: 'financial_desired_outcome', title: 'Affordable' }, { id: 'fdo-other', kind: 'financial_desired_outcome', title: 'Spend less' },
      { id: 'wrong', kind: 'product', title: 'Wrong kind' },
    ],
    relationships: [
      { id: 'link-z-z', kind: 'offer_presented_at_touchpoint', offerId: 'offer-z', touchpointId: 'touch-z' },
      { id: 'link-b-z', kind: 'offer_presented_at_touchpoint', offerId: 'offer-b', touchpointId: 'touch-z' },
      { id: 'link-a-a', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touch-a' },
      { id: 'link-b-a', kind: 'offer_presented_at_touchpoint', offerId: 'offer-b', touchpointId: 'touch-a' },
      { id: 'link-a-b', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touch-b' },
      { id: 'link-a-child', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'child' },
      { id: 'parent-child', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'touch-z', childTouchpointId: 'child' },
      ...['do-z', 'do-a', 'do-b'].map((desiredOutcomeId) => ({ id: `cfj-${desiredOutcomeId}`, kind: 'job_has_desired_outcome' as const, jobId: 'cfj', desiredOutcomeId })),
      { id: 'rj-do', kind: 'job_has_desired_outcome', jobId: 'rj', desiredOutcomeId: 'do-other' },
      { id: 'ccj-do', kind: 'job_has_desired_outcome', jobId: 'ccj', desiredOutcomeId: 'do-b' },
    ],
    productJobIntents: [
      { id: 'a-cfj', productId: 'product-a', jobId: 'cfj', addressedDesiredOutcomeIds: ['do-z', 'do-a', 'do-b'] },
      { id: 'b-cfj', productId: 'product-b', jobId: 'cfj', addressedDesiredOutcomeIds: ['do-z', 'do-a', 'do-b'] },
      { id: 'a-rj', productId: 'product-a', jobId: 'rj', addressedDesiredOutcomeIds: ['do-other'] },
      { id: 'a-ccj', productId: 'product-a', jobId: 'ccj', addressedDesiredOutcomeIds: ['do-b'] },
      { id: 'a-ej', productId: 'product-a', jobId: 'ej', addressedDesiredOutcomeIds: [] },
      { id: 'a-sj', productId: 'product-a', jobId: 'sj', addressedDesiredOutcomeIds: [] },
    ],
    offerJobSelections: [
      { id: 'oz-cfj', offerId: 'offer-z', productJobIntentId: 'a-cfj', addressedDesiredOutcomeIds: ['do-z', 'do-a', 'do-b'] },
      { id: 'oa-cfj', offerId: 'offer-a', productJobIntentId: 'b-cfj', addressedDesiredOutcomeIds: ['do-z', 'do-a', 'do-b'] },
      { id: 'ob-cfj', offerId: 'offer-b', productJobIntentId: 'a-cfj' },
      ...['rj', 'ccj', 'ej', 'sj'].map((kind) => ({ id: `oa-${kind}`, offerId: 'offer-a', productJobIntentId: `a-${kind}`, addressedDesiredOutcomeIds: kind === 'rj' ? ['do-other'] : kind === 'ccj' ? ['do-b'] : [] })),
      { id: 'ob-ej', offerId: 'offer-b', productJobIntentId: 'a-ej', addressedDesiredOutcomeIds: [] },
      { id: 'ob-sj', offerId: 'offer-b', productJobIntentId: 'a-sj', addressedDesiredOutcomeIds: [] },
    ],
    offerFinancialIntents: [
      { id: 'oz-fdo', offerId: 'offer-z', financialDesiredOutcomeId: 'fdo' },
      { id: 'oa-fdo', offerId: 'offer-a', financialDesiredOutcomeId: 'fdo' },
      { id: 'ob-fdo', offerId: 'offer-b', financialDesiredOutcomeId: 'fdo' },
      { id: 'oa-other', offerId: 'offer-a', financialDesiredOutcomeId: 'fdo-other' },
    ],
    touchpointJobSelections: [], touchpointFinancialSelections: [],
  };
}

const localJob = (id: string, touchpointId: string, offerId: string, productJobIntentId: string, addressedDesiredOutcomeIds: string[]) =>
  ({ id, touchpointId, offerId, productJobIntentId, addressedDesiredOutcomeIds });
const jobs = (document: MapDocument, touchpointId = 'touch-z') => deriveTouchpointClientIntentNeighborhood(document, touchpointId)!.grounds
  .filter((ground): ground is TouchpointClientIntentJobGround => ground.basisKind === 'job');

describe('Touchpoint Client-intent Neighborhood projection', () => {
  it('returns undefined for a missing or wrong-kind ID and empty grounds for a valid Touchpoint', () => {
    const document = fixture();
    expect(deriveTouchpointClientIntentNeighborhood(document, 'missing')).toBeUndefined();
    expect(deriveTouchpointClientIntentNeighborhood(document, 'offer-z')).toBeUndefined();
    expect(deriveTouchpointClientIntentNeighborhood(document, 'touch-z')).toEqual({ touchpointId: 'touch-z', grounds: [] });
  });

  it('matches a Job across different valid Offers and Products and preserves per-leaf contributors', () => {
    const document = fixture();
    document.touchpointJobSelections.push(
      localJob('z-1', 'touch-z', 'offer-z', 'a-cfj', ['do-z', 'do-a']),
      localJob('z-2', 'touch-z', 'offer-b', 'a-cfj', ['do-a']),
      localJob('a-1', 'touch-a', 'offer-a', 'b-cfj', ['do-a', 'do-b']),
      localJob('a-2', 'touch-a', 'offer-b', 'a-cfj', ['do-a']),
    );
    expect(jobs(document)[0]).toEqual({
      id: 'client-intent:core_functional_job:cfj', groundTypeId: 'core_functional_job', basisId: 'cfj', basisKind: 'job',
      jobId: 'cfj', jobKind: 'core_functional_job', inspectedContributorOfferIds: ['offer-b', 'offer-z'],
      inspectedDesiredOutcomes: [
        { desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-b', 'offer-z'] },
        { desiredOutcomeId: 'do-z', contributorOfferIds: ['offer-z'] },
      ],
      neighborTouchpointIds: ['touch-a'], count: 1,
      neighborComparisons: [{
        touchpointId: 'touch-a', contributorOfferIds: ['offer-a', 'offer-b'],
        desiredOutcomes: [{ desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a', 'offer-b'] }, { desiredOutcomeId: 'do-b', contributorOfferIds: ['offer-a'] }],
        commonDesiredOutcomeIds: ['do-a'], inspectedOnlyDesiredOutcomeIds: ['do-z'], neighborOnlyDesiredOutcomeIds: ['do-b'],
      }],
    });
  });

  it('requires a nonempty valid local subset for every DO-bearing encounter', () => {
    const document = fixture();
    document.touchpointJobSelections.push(
      localJob('z', 'touch-z', 'offer-z', 'a-cfj', ['do-a']),
      localJob('empty', 'touch-a', 'offer-a', 'b-cfj', []),
      localJob('invalid', 'touch-b', 'offer-a', 'b-cfj', ['missing', 'do-other', 'wrong']),
    );
    expect(jobs(document)).toEqual([]);
    document.touchpointJobSelections.push(localJob('a-valid', 'touch-a', 'offer-a', 'b-cfj', ['do-z']));
    expect(jobs(document)[0]?.neighborComparisons[0]).toMatchObject({
      commonDesiredOutcomeIds: [], inspectedOnlyDesiredOutcomeIds: ['do-a'], neighborOnlyDesiredOutcomeIds: ['do-z'],
    });
  });

  it('does not turn upstream availability into scope and accepts EJ/SJ direct paths without ordinary DOs', () => {
    const document = fixture();
    expect(jobs(document)).toEqual([]);
    document.touchpointJobSelections.push(
      localJob('z-ej', 'touch-z', 'offer-b', 'a-ej', ['missing']),
      localJob('a-ej', 'touch-a', 'offer-a', 'a-ej', ['do-a']),
      localJob('z-sj', 'touch-z', 'offer-b', 'a-sj', []),
      localJob('a-sj', 'touch-a', 'offer-a', 'a-sj', ['wrong']),
    );
    expect(jobs(document).map((ground) => [ground.jobKind, ground.inspectedDesiredOutcomes])).toEqual([
      ['emotional_job', []], ['social_job', []],
    ]);
  });

  it('derives FDO only from valid local selections and keeps contributor provenance', () => {
    const document = fixture();
    document.touchpointFinancialSelections.push(
      { id: 'z-1', touchpointId: 'touch-z', offerId: 'offer-z', offerFinancialIntentId: 'oz-fdo', financialDesiredOutcomeId: 'fdo' },
      { id: 'z-2', touchpointId: 'touch-z', offerId: 'offer-b', offerFinancialIntentId: 'ob-fdo', financialDesiredOutcomeId: 'fdo' },
      { id: 'a-1', touchpointId: 'touch-a', offerId: 'offer-a', offerFinancialIntentId: 'oa-fdo', financialDesiredOutcomeId: 'fdo' },
      { id: 'bad', touchpointId: 'touch-a', offerId: 'offer-a', offerFinancialIntentId: 'oa-other', financialDesiredOutcomeId: 'fdo' },
    );
    expect(deriveTouchpointClientIntentNeighborhood(document, 'touch-z')!.grounds).toEqual([{
      id: 'client-intent:financial_desired_outcome:fdo', groundTypeId: 'financial_desired_outcome', basisId: 'fdo',
      basisKind: 'financial_desired_outcome', financialDesiredOutcomeId: 'fdo', inspectedContributorOfferIds: ['offer-b', 'offer-z'],
      neighborTouchpointIds: ['touch-a'], count: 1,
      neighborComparisons: [{ touchpointId: 'touch-a', contributorOfferIds: ['offer-a'] }],
    }]);
  });

  it('does not inherit Parent scope and lets one neighbor occur in independent grounds', () => {
    const document = fixture();
    document.touchpointJobSelections.push(
      localJob('z-cfj', 'touch-z', 'offer-z', 'a-cfj', ['do-a']), localJob('a-cfj', 'touch-a', 'offer-a', 'b-cfj', ['do-a']),
      localJob('z-ej', 'touch-z', 'offer-b', 'a-ej', []), localJob('a-ej', 'touch-a', 'offer-a', 'a-ej', []),
    );
    expect(jobs(document).map((ground) => [ground.jobId, ground.neighborTouchpointIds])).toEqual([
      ['cfj', ['touch-a']], ['ej', ['touch-a']],
    ]);
    expect(deriveTouchpointClientIntentNeighborhood(document, 'child')).toEqual({ touchpointId: 'child', grounds: [] });
  });

  it('ignores duplicate and stale compatibility records, unlinked Offers, and wrong-kind references', () => {
    const document = fixture();
    document.productJobIntents.push(
      { id: 'missing-job', productId: 'product-a', jobId: 'missing', addressedDesiredOutcomeIds: [] },
      { id: 'wrong-job', productId: 'product-a', jobId: 'wrong', addressedDesiredOutcomeIds: [] },
    );
    document.touchpointJobSelections.push(
      localJob('z', 'touch-z', 'offer-z', 'a-cfj', ['do-a', 'do-a']),
      localJob('z-duplicate', 'touch-z', 'offer-z', 'a-cfj', ['do-a']),
      localJob('a', 'touch-a', 'offer-a', 'b-cfj', ['do-a']),
      localJob('unlinked', 'touch-b', 'offer-b', 'a-cfj', ['do-a']),
      localJob('missing-touchpoint', 'missing', 'offer-a', 'b-cfj', ['do-a']),
      localJob('wrong-touchpoint', 'offer-z', 'offer-a', 'b-cfj', ['do-a']),
      localJob('missing-offer', 'touch-a', 'missing', 'b-cfj', ['do-a']),
      localJob('wrong-offer', 'touch-a', 'wrong', 'b-cfj', ['do-a']),
      localJob('missing-intent', 'touch-a', 'offer-a', 'missing', ['do-a']),
      localJob('missing-job', 'touch-a', 'offer-a', 'missing-job', ['do-a']),
      localJob('wrong-job', 'touch-a', 'offer-a', 'wrong-job', ['do-a']),
    );
    expect(jobs(document)).toHaveLength(1);
    expect(jobs(document)[0]).toMatchObject({ neighborTouchpointIds: ['touch-a'], count: 1 });
  });

  it('uses canonical/title ordering, stable IDs, and is input-order independent without mutation', () => {
    const document = fixture();
    document.touchpointJobSelections.push(
      localJob('z-ej', 'touch-z', 'offer-b', 'a-ej', []), localJob('b-ej', 'touch-b', 'offer-a', 'a-ej', []),
      localJob('a-ej', 'touch-a', 'offer-a', 'a-ej', []),
      localJob('z-cfj', 'touch-z', 'offer-z', 'a-cfj', ['do-z', 'do-a']), localJob('a-cfj', 'touch-a', 'offer-a', 'b-cfj', ['do-a']),
    );
    const before = structuredClone(document);
    const expected = deriveTouchpointClientIntentNeighborhood(document, 'touch-z');
    expect(TOUCHPOINT_CLIENT_INTENT_GROUND_TYPE_IDS).toEqual([
      'core_functional_job', 'related_job', 'consumption_chain_job', 'emotional_job', 'social_job', 'financial_desired_outcome',
    ]);
    expect(expected!.grounds.map((ground) => ground.id)).toEqual([
      'client-intent:core_functional_job:cfj', 'client-intent:emotional_job:ej',
    ]);
    expect(expected!.grounds[1]).toMatchObject({ neighborTouchpointIds: ['touch-a', 'touch-b'], count: 2 });
    expect(document).toEqual(before);
    const reversed = structuredClone(document);
    reversed.entities.reverse(); reversed.relationships.reverse(); reversed.productJobIntents.reverse();
    reversed.offerJobSelections.reverse(); reversed.offerFinancialIntents.reverse();
    reversed.touchpointJobSelections.reverse(); reversed.touchpointFinancialSelections.reverse();
    expect(deriveTouchpointClientIntentNeighborhood(reversed, 'touch-z')).toEqual(expected);
  });
});
