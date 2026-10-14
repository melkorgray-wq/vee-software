import { normalizeLegacyJobs, setJobContextualParents, setFinancialDesiredOutcomeJobContexts, type MapReadDocument } from '@vee/domain';
import { freezeMapReadFixture, legacyOfferReadFixture } from './map-read-test-fixture';
import { offerClientIntent } from './offer-client-intent';
import { describe, expect, it } from 'vitest';
import type { MapDocument } from '@vee/domain';
import {
  OFFER_CLIENT_INTENT_GROUND_TYPE_IDS,
  deriveOfferClientIntentNeighborhood,
  type OfferClientIntentJobGround,
} from './offer-client-intent-neighborhood';

function fixture(): MapDocument {
  return {
    id: 'map', title: 'Map', views: [], placements: [], epistemicAnnotations: [], touchpointContainers: [],
    touchpointJobSelections: [], touchpointFinancialSelections: [],
    entities: [
      { id: 'product-a', kind: 'product', title: 'Product A' },
      { id: 'product-b', kind: 'product', title: 'Product B' },
      { id: 'offer-z', kind: 'offer', title: 'Zulu', currentContentSource: null },
      { id: 'offer-b', kind: 'offer', title: 'Beta', currentContentSource: null },
      { id: 'offer-a', kind: 'offer', title: 'Alpha', currentContentSource: null },
      { id: 'cfj', kind: 'core_functional_job', title: 'Build' },
      { id: 'rj', kind: 'related_job', title: 'Coordinate' },
      { id: 'ccj', kind: 'consumption_chain_job', title: 'Acquire' },
      { id: 'ej', kind: 'emotional_job', title: 'Feel confident' },
      { id: 'sj', kind: 'social_job', title: 'Belong' },
      { id: 'do-z', kind: 'desired_outcome', title: 'Zulu outcome' },
      { id: 'do-a2', kind: 'desired_outcome', title: 'Alpha outcome' },
      { id: 'do-a1', kind: 'desired_outcome', title: 'Alpha outcome' },
      { id: 'do-other', kind: 'desired_outcome', title: 'Other job outcome' },
      { id: 'fdo-z', kind: 'financial_desired_outcome', title: 'Spend less' },
      { id: 'fdo-a', kind: 'financial_desired_outcome', title: 'Affordable' },
      { id: 'wrong-kind', kind: 'product', title: 'Wrong kind' },
    ],
    relationships: [
      { id: 'cfj-do-z', kind: 'job_has_desired_outcome', jobId: 'cfj', desiredOutcomeId: 'do-z' },
      { id: 'cfj-do-a2', kind: 'job_has_desired_outcome', jobId: 'cfj', desiredOutcomeId: 'do-a2' },
      { id: 'cfj-do-a1', kind: 'job_has_desired_outcome', jobId: 'cfj', desiredOutcomeId: 'do-a1' },
      { id: 'rj-do-other', kind: 'job_has_desired_outcome', jobId: 'rj', desiredOutcomeId: 'do-other' },
    ],
    productJobIntents: [
      { id: 'a-cfj', productId: 'product-a', jobId: 'cfj', addressedDesiredOutcomeIds: ['do-z', 'do-a2', 'do-a1'] },
      { id: 'b-cfj', productId: 'product-b', jobId: 'cfj', addressedDesiredOutcomeIds: ['do-z', 'do-a2', 'do-a1'] },
      { id: 'a-rj', productId: 'product-a', jobId: 'rj', addressedDesiredOutcomeIds: ['do-other'] },
      { id: 'a-ccj', productId: 'product-a', jobId: 'ccj', addressedDesiredOutcomeIds: [] },
      { id: 'a-ej', productId: 'product-a', jobId: 'ej', addressedDesiredOutcomeIds: [] },
      { id: 'a-sj', productId: 'product-a', jobId: 'sj', addressedDesiredOutcomeIds: [] },
    ],
    offerJobSelections: [],
    offerFinancialIntents: [],
  };
}

const selection = (id: string, offerId: string, productJobIntentId: string, addressedDesiredOutcomeIds?: string[]) => ({
  id, offerId, productJobIntentId, ...(addressedDesiredOutcomeIds ? { addressedDesiredOutcomeIds } : {}),
});

function jobGrounds(document: MapDocument, offerId = 'offer-z') {
  return deriveOfferClientIntentNeighborhood(document, offerId)!.grounds.filter(
    (ground): ground is OfferClientIntentJobGround => ground.basisKind === 'job',
  );
}

describe('Offer Client-intent Neighborhood projection', () => {
  it('returns undefined for a missing or wrong-kind inspected Offer and an empty projection for a valid Offer', () => {
    const document = fixture();
    expect(deriveOfferClientIntentNeighborhood(document, 'missing')).toBeUndefined();
    expect(deriveOfferClientIntentNeighborhood(document, 'product-a')).toBeUndefined();
    expect(deriveOfferClientIntentNeighborhood(document, 'offer-z')).toEqual({ offerId: 'offer-z', grounds: [] });
  });

  it('matches one Job by concrete Job identity across Product intents from different Products', () => {
    const document = fixture();
    document.offerJobSelections.push(
      selection('z-cfj', 'offer-z', 'a-cfj', ['do-z']),
      selection('a-cfj', 'offer-a', 'b-cfj', ['do-a1']),
    );
    expect(jobGrounds(document)).toMatchObject([{
      id: 'client-intent:core_functional_job:cfj', groundTypeId: 'core_functional_job', basisId: 'cfj',
      jobId: 'cfj', jobKind: 'core_functional_job', neighborOfferIds: ['offer-a'], count: 1,
    }]);
  });

  it('does not inherit an unselected Product intent for either Offer', () => {
    const document = fixture();
    document.offerJobSelections.push(selection('z-cfj', 'offer-z', 'a-cfj', []));
    expect(jobGrounds(document)).toEqual([]);
    document.offerJobSelections = [selection('a-cfj', 'offer-a', 'b-cfj', [])];
    expect(jobGrounds(document)).toEqual([]);
  });

  it('compares identical, overlapping, disjoint and empty effective subsets for DO-bearing Jobs', () => {
    const document = fixture();
    document.productJobIntents.push(
      { id: 'b-rj', productId: 'product-b', jobId: 'rj', addressedDesiredOutcomeIds: ['do-other'] },
      { id: 'b-ccj', productId: 'product-b', jobId: 'ccj', addressedDesiredOutcomeIds: [] },
    );
    document.offerJobSelections.push(
      selection('z-cfj', 'offer-z', 'a-cfj', ['do-a1', 'do-a2']),
      selection('a-cfj', 'offer-a', 'b-cfj', ['do-a2', 'do-z']),
      selection('b-cfj', 'offer-b', 'b-cfj', ['do-z']),
      selection('z-rj', 'offer-z', 'a-rj', ['do-other']),
      selection('a-rj', 'offer-a', 'b-rj', ['do-other']),
      selection('z-ccj', 'offer-z', 'a-ccj', []),
      selection('a-ccj', 'offer-a', 'b-ccj', []),
    );
    const [cfj, rj, ccj] = jobGrounds(document);
    expect(cfj?.inspectedDesiredOutcomeIds).toEqual(['do-a1', 'do-a2']);
    expect(cfj?.neighborComparisons).toEqual([
      { offerId: 'offer-a', desiredOutcomeIds: ['do-a2', 'do-z'], commonDesiredOutcomeIds: ['do-a2'], inspectedOnlyDesiredOutcomeIds: ['do-a1'], neighborOnlyDesiredOutcomeIds: ['do-z'] },
      { offerId: 'offer-b', desiredOutcomeIds: ['do-z'], commonDesiredOutcomeIds: [], inspectedOnlyDesiredOutcomeIds: ['do-a1', 'do-a2'], neighborOnlyDesiredOutcomeIds: ['do-z'] },
    ]);
    expect(rj?.neighborComparisons[0]).toMatchObject({ commonDesiredOutcomeIds: ['do-other'], inspectedOnlyDesiredOutcomeIds: [], neighborOnlyDesiredOutcomeIds: [] });
    expect(ccj?.neighborComparisons[0]).toMatchObject({ desiredOutcomeIds: [], commonDesiredOutcomeIds: [], inspectedOnlyDesiredOutcomeIds: [], neighborOnlyDesiredOutcomeIds: [] });
  });

  it('uses the compatibility fallback when addressedDesiredOutcomeIds is absent', () => {
    const document = fixture();
    document.offerJobSelections.push(selection('z-cfj', 'offer-z', 'a-cfj'), selection('a-cfj', 'offer-a', 'b-cfj', ['do-z']));
    expect(jobGrounds(document)[0]?.inspectedDesiredOutcomeIds).toEqual(['do-a1', 'do-a2', 'do-z']);
  });

  it('keeps EJ and SJ subsets empty and ignores malformed Desired Outcome data', () => {
    const document = fixture();
    document.productJobIntents.push(
      { id: 'b-ej', productId: 'product-b', jobId: 'ej', addressedDesiredOutcomeIds: ['do-z'] },
      { id: 'b-sj', productId: 'product-b', jobId: 'sj', addressedDesiredOutcomeIds: ['missing'] },
    );
    document.offerJobSelections.push(
      selection('z-ej', 'offer-z', 'a-ej', ['do-z']), selection('a-ej', 'offer-a', 'b-ej', ['do-a1']),
      selection('z-sj', 'offer-z', 'a-sj', ['missing']), selection('a-sj', 'offer-a', 'b-sj', ['do-z']),
    );
    for (const ground of jobGrounds(document)) {
      expect(ground.inspectedDesiredOutcomeIds).toEqual([]);
      expect(ground.neighborComparisons[0]).toMatchObject({ desiredOutcomeIds: [], commonDesiredOutcomeIds: [], inspectedOnlyDesiredOutcomeIds: [], neighborOnlyDesiredOutcomeIds: [] });
    }
  });

  it('creates only shared Offer-owned FDO grounds and deduplicates duplicate intents', () => {
    const document = fixture();
    document.offerFinancialIntents.push(
      { id: 'z-a', offerId: 'offer-z', financialDesiredOutcomeId: 'fdo-a' },
      { id: 'a-a', offerId: 'offer-a', financialDesiredOutcomeId: 'fdo-a' },
      { id: 'a-a-duplicate', offerId: 'offer-a', financialDesiredOutcomeId: 'fdo-a' },
      { id: 'z-only', offerId: 'offer-z', financialDesiredOutcomeId: 'fdo-z' },
    );
    expect(deriveOfferClientIntentNeighborhood(document, 'offer-z')!.grounds).toEqual([{
      id: 'client-intent:financial_desired_outcome:fdo-a', groundTypeId: 'financial_desired_outcome', basisId: 'fdo-a',
      basisKind: 'financial_desired_outcome', financialDesiredOutcomeId: 'fdo-a', neighborOfferIds: ['offer-a'], count: 1,
    }]);
  });

  it('allows one neighbor in several grounds but only once within each ground', () => {
    const document = fixture();
    document.offerJobSelections.push(
      selection('z-cfj', 'offer-z', 'a-cfj', []), selection('a-cfj', 'offer-a', 'b-cfj', []),
      selection('a-cfj-duplicate', 'offer-a', 'b-cfj', ['do-z']),
      selection('z-rj', 'offer-z', 'a-rj', []), selection('a-rj', 'offer-a', 'a-rj', []),
    );
    expect(jobGrounds(document).map((ground) => [ground.jobId, ground.neighborOfferIds, ground.count])).toEqual([
      ['cfj', ['offer-a'], 1], ['rj', ['offer-a'], 1],
    ]);
  });

  it('ignores stale and wrong-kind Offer, intent, Job, DO and FDO references', () => {
    const document = fixture();
    document.productJobIntents.push(
      { id: 'missing-job', productId: 'product-a', jobId: 'missing', addressedDesiredOutcomeIds: [] },
      { id: 'wrong-job', productId: 'product-a', jobId: 'wrong-kind', addressedDesiredOutcomeIds: [] },
    );
    document.offerJobSelections.push(
      selection('valid-z', 'offer-z', 'a-cfj', ['do-a1', 'do-other', 'missing', 'wrong-kind', 'do-a1']),
      selection('valid-a', 'offer-a', 'b-cfj', ['do-a1']),
      selection('missing-offer', 'missing', 'a-cfj', []),
      selection('missing-intent', 'offer-a', 'missing', []),
      selection('missing-job-selection', 'offer-a', 'missing-job', []),
      selection('wrong-job-selection', 'offer-a', 'wrong-job', []),
    );
    document.offerFinancialIntents.push(
      { id: 'stale-offer', offerId: 'missing', financialDesiredOutcomeId: 'fdo-a' },
      { id: 'stale-fdo', offerId: 'offer-z', financialDesiredOutcomeId: 'missing' },
      { id: 'wrong-fdo', offerId: 'offer-z', financialDesiredOutcomeId: 'wrong-kind' },
    );
    expect(jobGrounds(document)[0]?.inspectedDesiredOutcomeIds).toEqual(['do-a1']);
    expect(jobGrounds(document)).toHaveLength(1);
  });

  it('uses stable type order, concrete basis identity, title/ID ordering and is input-order independent', () => {
    const document = fixture();
    document.productJobIntents.push({ id: 'second-cfj', productId: 'product-a', jobId: 'cfj-2', addressedDesiredOutcomeIds: [] });
    document.entities.push({ id: 'cfj-2', kind: 'core_functional_job', title: 'Build' });
    document.offerJobSelections.push(
      selection('z-rj', 'offer-z', 'a-rj', []), selection('a-rj', 'offer-a', 'a-rj', []),
      selection('z-cfj-2', 'offer-z', 'second-cfj', []), selection('a-cfj-2', 'offer-a', 'second-cfj', []),
      selection('z-cfj', 'offer-z', 'a-cfj', ['do-z', 'do-a2', 'do-a1']),
      selection('b-cfj', 'offer-b', 'b-cfj', ['do-a2']), selection('a-cfj', 'offer-a', 'b-cfj', ['do-a1']),
    );
    const expected = deriveOfferClientIntentNeighborhood(document, 'offer-z');
    expect(OFFER_CLIENT_INTENT_GROUND_TYPE_IDS).toEqual(['core_functional_job', 'related_job', 'consumption_chain_job', 'emotional_job', 'social_job', 'financial_desired_outcome']);
    expect(expected!.grounds.map((ground) => ground.id)).toEqual([
      'client-intent:core_functional_job:cfj', 'client-intent:core_functional_job:cfj-2', 'client-intent:related_job:rj',
    ]);
    expect(expected!.grounds[0]).toMatchObject({ basisId: 'cfj', neighborOfferIds: ['offer-a', 'offer-b'], count: 2 });
    const reversed = structuredClone(document);
    reversed.entities.reverse(); reversed.relationships.reverse(); reversed.productJobIntents.reverse();
    reversed.offerJobSelections.reverse(); reversed.offerFinancialIntents.reverse();
    expect(deriveOfferClientIntentNeighborhood(reversed, 'offer-z')).toEqual(expected);
  });

  it('does not mutate the MapDocument', () => {
    const document = fixture();
    document.offerJobSelections.push(selection('z-cfj', 'offer-z', 'a-cfj'), selection('a-cfj', 'offer-a', 'b-cfj', ['do-z']));
    const before = structuredClone(document);
    deriveOfferClientIntentNeighborhood(document, 'offer-z');
    expect(document).toEqual(before);
  });
});


const readJobGrounds = (document: MapReadDocument) => deriveOfferClientIntentNeighborhood(document, 'o')!.grounds.filter(ground => ground.basisKind === 'job');

describe('canonical Offer Neighborhood read compatibility', () => {
  it('preserves normalized comparisons and distinct same-title Jobs in canonical type order', () => {
    const legacy = legacyOfferReadFixture(); const document = normalizeLegacyJobs(legacy);
    const before = structuredClone(document); freezeMapReadFixture(legacy); freezeMapReadFixture(document);
    const old = deriveOfferClientIntentNeighborhood(legacy, 'o')!;
    const expected = old.grounds.map(ground => ground.basisKind === 'financial_desired_outcome' ? ground : {
      ...ground, id: `client-intent:${ground.jobKind === 'core_functional_job' || ground.jobKind === 'related_job' ? 'functional_job' : ground.jobKind}:${ground.jobId}`,
      groundTypeId: ground.jobKind === 'core_functional_job' || ground.jobKind === 'related_job' ? 'functional_job' : ground.jobKind,
      jobKind: ground.jobKind === 'core_functional_job' || ground.jobKind === 'related_job' ? 'functional_job' : ground.jobKind,
    });
    const result = deriveOfferClientIntentNeighborhood(document, 'o')!;
    expect(result.grounds).toEqual(expected);
    expect(result.grounds.map(ground => [ground.basisId, ground.groundTypeId])).toEqual([
      ['j', 'functional_job'], ['rj', 'functional_job'], ['ccj', 'consumption_chain_job'], ['ej', 'emotional_job'], ['sj', 'social_job'], ['f', 'financial_desired_outcome'],
    ]);
    expect(readJobGrounds(document)[0]).toEqual({ id: 'client-intent:functional_job:j', basisId: 'j', basisKind: 'job', jobId: 'j', jobKind: 'functional_job', groundTypeId: 'functional_job',
      inspectedDesiredOutcomeIds: ['a'], neighborOfferIds: ['qo', 'o2'], count: 2, neighborComparisons: [
        { offerId: 'qo', desiredOutcomeIds: ['b'], commonDesiredOutcomeIds: [], inspectedOnlyDesiredOutcomeIds: ['a'], neighborOnlyDesiredOutcomeIds: ['b'] },
        { offerId: 'o2', desiredOutcomeIds: ['a', 'b'], commonDesiredOutcomeIds: ['a'], inspectedOnlyDesiredOutcomeIds: [], neighborOnlyDesiredOutcomeIds: ['b'] },
      ] });
    expect(document).toEqual(before);
  });

  it.each([
    { inspected: [], neighbor: [], common: [], onlyI: [], onlyN: [] },
    { inspected: ['a'], neighbor: ['a'], common: ['a'], onlyI: [], onlyN: [] },
    { inspected: ['a', 'b'], neighbor: ['b'], common: ['b'], onlyI: ['a'], onlyN: [] },
    { inspected: ['a'], neighbor: ['b'], common: [], onlyI: ['a'], onlyN: ['b'] },
  ])('preserves concrete Job matching with selected subsets $inspected / $neighbor', scope => {
    const document = normalizeLegacyJobs(legacyOfferReadFixture());
    document.offerJobSelections = [{ id: 'inspected', offerId: 'o', productJobIntentId: 'pi', addressedDesiredOutcomeIds: scope.inspected }, { id: 'neighbor', offerId: 'qo', productJobIntentId: 'q-pi', addressedDesiredOutcomeIds: scope.neighbor }];
    freezeMapReadFixture(document);
    expect(readJobGrounds(document)).toEqual([{ id: 'client-intent:functional_job:j', basisId: 'j', basisKind: 'job', jobId: 'j', jobKind: 'functional_job', groundTypeId: 'functional_job', count: 1,
      neighborOfferIds: ['qo'], inspectedDesiredOutcomeIds: scope.inspected, neighborComparisons: [{ offerId: 'qo', desiredOutcomeIds: scope.neighbor,
        commonDesiredOutcomeIds: scope.common, inspectedOnlyDesiredOutcomeIds: scope.onlyI, neighborOnlyDesiredOutcomeIds: scope.onlyN }] }]);
  });

  it.each(['legacy', 'canonical'] as const)('%s preserves the established Neighborhood validation independently of read-state', representation => {
    const document = representation === 'legacy' ? legacyOfferReadFixture() : normalizeLegacyJobs(legacyOfferReadFixture());
    document.offerJobSelections[0]!.addressedDesiredOutcomeIds = ['a', 'outside', 'outside', 'r-do', 'f', 'missing'];
    document.offerJobSelections.push({ id: 'extra-q', offerId: 'qo', productJobIntentId: 'q-pi', addressedDesiredOutcomeIds: ['outside'] });
    const before = structuredClone(document); freezeMapReadFixture(document);
    const j = readJobGrounds(document).find(ground => ground.jobId === 'j')!;
    expect(j.inspectedDesiredOutcomeIds).toEqual(['a', 'outside']);
    expect(j.neighborComparisons.find(comparison => comparison.offerId === 'qo')).toMatchObject({ desiredOutcomeIds: ['b', 'outside'], commonDesiredOutcomeIds: ['outside'] });
    const read = offerClientIntent(document, 'o')!.groups.flatMap(group => group.kind === 'financial_desired_outcome' ? [] : group.items).find(item => item.jobId === 'j')!;
    expect(read.desiredOutcomeIds).toEqual(['a']);
    // Neighborhood historically resolves selection -> intent -> Job without the read-state Product ownership boundary.
    const withoutPackaging = structuredClone(document);
    for (let index = withoutPackaging.relationships.length - 1; index >= 0; index--) {
      if (withoutPackaging.relationships[index]!.kind === 'product_packaged_as_offer') withoutPackaging.relationships.splice(index, 1);
    }
    expect(deriveOfferClientIntentNeighborhood(withoutPackaging, 'o')).toEqual(deriveOfferClientIntentNeighborhood(document, 'o'));
    expect(offerClientIntent(withoutPackaging, 'o')!.groups.map(group => group.kind)).toEqual(['financial_desired_outcome']);
    expect(document).toEqual(before);
  });

  it('deduplicates selected Job and financial paths by Offer while ignoring stale endpoints', () => {
    const document = normalizeLegacyJobs(legacyOfferReadFixture());
    document.offerJobSelections.push(
      { id: 'duplicate', offerId: 'qo', productJobIntentId: 'q-pi', addressedDesiredOutcomeIds: ['a', 'a'] },
      { id: 'stale-intent', offerId: 'qo', productJobIntentId: 'missing' },
      { id: 'stale-offer', offerId: 'missing', productJobIntentId: 'pi' },
      { id: 'stale-job', offerId: 'qo', productJobIntentId: 'bad-pi' },
    );
    document.productJobIntents.push({ id: 'bad-pi', productId: 'q', jobId: 'f', addressedDesiredOutcomeIds: [] });
    document.offerFinancialIntents.push({ id: 'duplicate-f', offerId: 'qo', financialDesiredOutcomeId: 'f' }, { id: 'missing-f', offerId: 'qo', financialDesiredOutcomeId: 'missing' }, { id: 'wrong-f', offerId: 'qo', financialDesiredOutcomeId: 'j' });
    freezeMapReadFixture(document);
    const j = readJobGrounds(document).find(ground => ground.jobId === 'j')!;
    expect(j.neighborOfferIds).toEqual(['qo', 'o2']); expect(j.count).toBe(2);
    expect(j.neighborComparisons[0]).toMatchObject({ desiredOutcomeIds: ['a', 'b'], commonDesiredOutcomeIds: ['a'] });
    expect(deriveOfferClientIntentNeighborhood(document, 'o')!.grounds.at(-1)).toEqual({ id: 'client-intent:financial_desired_outcome:f', basisId: 'f', basisKind: 'financial_desired_outcome', financialDesiredOutcomeId: 'f', groundTypeId: 'financial_desired_outcome', neighborOfferIds: ['qo', 'o2'], count: 2 });
  });

  it('does not match contextual parents, transitive paths or same-title Functional Jobs, nor infer financial intent', () => {
    let document = normalizeLegacyJobs(legacyOfferReadFixture()); const expected = deriveOfferClientIntentNeighborhood(document, 'o');
    document = setJobContextualParents(document, { targetJobId: 'rj', parentJobIds: ['j', 'ej', 'u'], newRelationshipIds: ['e-r', 'u-r'] });
    document = setFinancialDesiredOutcomeJobContexts(document, { financialDesiredOutcomeId: 'unselected-f', jobIds: ['j', 'rj', 'u'], newRelationshipIds: ['j-f', 'r-f', 'u-f'] });
    expect(deriveOfferClientIntentNeighborhood(document, 'o')).toEqual(expected);
    document.productJobIntents.push({ id: 'q-u', productId: 'q', jobId: 'u', addressedDesiredOutcomeIds: [] });
    document.offerJobSelections = [{ id: 'j-selected', offerId: 'o', productJobIntentId: 'pi', addressedDesiredOutcomeIds: [] }, { id: 'different-job', offerId: 'qo', productJobIntentId: 'q-u', addressedDesiredOutcomeIds: [] }];
    document.offerFinancialIntents = [];
    const before = structuredClone(document); freezeMapReadFixture(document);
    expect(deriveOfferClientIntentNeighborhood(document, 'o')).toEqual({ offerId: 'o', grounds: [] });
    expect(document).toEqual(before);
  });

  it('keeps ordering, absent/empty results and source immutability across repeated canonical reads', () => {
    const document = normalizeLegacyJobs(legacyOfferReadFixture());
    const reversed = { ...document, entities: [...document.entities].reverse(), relationships: [...document.relationships].reverse(), productJobIntents: [...document.productJobIntents].reverse(), offerJobSelections: [...document.offerJobSelections].reverse(), offerFinancialIntents: [...document.offerFinancialIntents].reverse() };
    const before = structuredClone(document); freezeMapReadFixture(document);
    const result = deriveOfferClientIntentNeighborhood(document, 'o')!;
    expect(deriveOfferClientIntentNeighborhood(reversed, 'o')).toEqual(result);
    expect(deriveOfferClientIntentNeighborhood(document, 'missing')).toBeUndefined(); expect(deriveOfferClientIntentNeighborhood(document, 'p')).toBeUndefined();
    result.grounds[0]!.neighborOfferIds.pop();
    expect(document).toEqual(before);
    expect(deriveOfferClientIntentNeighborhood({ ...document, offerJobSelections: [], offerFinancialIntents: [] }, 'o')).toEqual({ offerId: 'o', grounds: [] });
  });
});
