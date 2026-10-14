import { describe, expect, expectTypeOf, it } from 'vitest';
import { normalizeLegacyJobs, setJobContextualParents, setFinancialDesiredOutcomeJobContexts, type MapDocument, type MapReadDocument } from '@vee/domain';
import { freezeMapReadFixture, legacyOfferReadFixture } from './map-read-test-fixture';
import {
  TOUCHPOINT_CLIENT_INTENT_GROUND_TYPE_IDS,
  CANONICAL_TOUCHPOINT_CLIENT_INTENT_GROUND_TYPE_IDS,
  type CanonicalTouchpointClientIntentNeighborhood,
  type TouchpointClientIntentNeighborhood,
  deriveTouchpointClientIntentNeighborhood,
  type TouchpointClientIntentJobGround,
} from './touchpoint-client-intent-neighborhood';

function fixture(): MapDocument {
  return {
    id: 'map', title: 'Map', views: [], placements: [], epistemicAnnotations: [], touchpointContainers: [],
    entities: [
      { id: 'product-a', kind: 'product', title: 'Product A' }, { id: 'product-b', kind: 'product', title: 'Product B' },
      { id: 'offer-z', kind: 'offer', title: 'Zulu Offer', currentContentSource: null }, { id: 'offer-a', kind: 'offer', title: 'Alpha Offer', currentContentSource: null },
      { id: 'offer-b', kind: 'offer', title: 'Beta Offer', currentContentSource: null },
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

  it('does not turn upstream availability or EJ/SJ Job-only membership into encounters', () => {
    const document = fixture();
    expect(jobs(document)).toEqual([]);
    document.touchpointJobSelections.push(
      localJob('z-ej', 'touch-z', 'offer-b', 'a-ej', ['missing']),
      localJob('a-ej', 'touch-a', 'offer-a', 'a-ej', ['do-a']),
      localJob('z-sj', 'touch-z', 'offer-b', 'a-sj', []),
      localJob('a-sj', 'touch-a', 'offer-a', 'a-sj', ['wrong']),
    );
    expect(jobs(document)).toEqual([]);
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
    document.entities.push({ id: 'ej-do', kind: 'desired_outcome', title: 'Feel assured' });
    document.relationships.push({ id: 'ej-owns', kind: 'job_has_desired_outcome', jobId: 'ej', desiredOutcomeId: 'ej-do' });
    document.productJobIntents.find(i => i.id === 'a-ej')!.addressedDesiredOutcomeIds = ['ej-do'];
    for (const selection of document.offerJobSelections.filter(s => s.productJobIntentId === 'a-ej')) selection.addressedDesiredOutcomeIds = ['ej-do'];
    document.touchpointJobSelections.push(
      localJob('z-cfj', 'touch-z', 'offer-z', 'a-cfj', ['do-a']), localJob('a-cfj', 'touch-a', 'offer-a', 'b-cfj', ['do-a']),
      localJob('z-ej', 'touch-z', 'offer-b', 'a-ej', ['ej-do']), localJob('a-ej', 'touch-a', 'offer-a', 'a-ej', ['ej-do']),
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
    document.entities.push({ id: 'ej-do', kind: 'desired_outcome', title: 'Feel assured' });
    document.relationships.push({ id: 'ej-owns', kind: 'job_has_desired_outcome', jobId: 'ej', desiredOutcomeId: 'ej-do' });
    document.productJobIntents.find(i => i.id === 'a-ej')!.addressedDesiredOutcomeIds = ['ej-do'];
    for (const selection of document.offerJobSelections.filter(s => s.productJobIntentId === 'a-ej')) selection.addressedDesiredOutcomeIds = ['ej-do'];
    document.touchpointJobSelections.push(
      localJob('z-ej', 'touch-z', 'offer-b', 'a-ej', ['ej-do']), localJob('b-ej', 'touch-b', 'offer-a', 'a-ej', ['ej-do']),
      localJob('a-ej', 'touch-a', 'offer-a', 'a-ej', ['ej-do']),
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

it.each(['emotional_job', 'social_job'] as const)('%s compares only effective owned outcomes and never falls back to Job-only encounters', kind => {
  const document = fixture(); document.entities.find(entity => entity.id === 'cfj')!.kind = kind;
  document.touchpointJobSelections.push(localJob('z', 'touch-z', 'offer-z', 'a-cfj', ['do-a']), localJob('a', 'touch-a', 'offer-a', 'b-cfj', ['do-a', 'do-b']));
  expect(jobs(document)[0]).toMatchObject({ jobKind: kind, neighborComparisons: [{ commonDesiredOutcomeIds: ['do-a'], inspectedOnlyDesiredOutcomeIds: [], neighborOnlyDesiredOutcomeIds: ['do-b'] }] });
  const before = structuredClone(document);
  document.touchpointJobSelections[0]!.addressedDesiredOutcomeIds = [];
  expect(jobs(document)).toEqual([]);
  expect(document.productJobIntents).toEqual(before.productJobIntents);
  expect(document.offerJobSelections).toEqual(before.offerJobSelections);
  expect(document.touchpointJobSelections).toHaveLength(2);
});


// Normalize a valid graph first; malformed compatibility records are injected only in read tests.
function legacyTouchpointReadFixture(): MapDocument {
  const document = legacyOfferReadFixture();
  document.entities.push({ id: 'n', kind: 'touchpoint', title: 'Neighbor Touchpoint' });
  document.relationships.push({ id: 'qo-n', kind: 'offer_presented_at_touchpoint', offerId: 'qo', touchpointId: 'n' });
  document.offerJobSelections.find(selection => selection.id === 'ers')!.addressedDesiredOutcomeIds = ['e-do'];
  document.touchpointJobSelections = [
    localJob('t-j', 't', 'o', 'pi', ['a']),
    localJob('t-j2', 't', 'o2', 'pi', ['b']),
    localJob('child-j', 'child', 'o', 'pi', ['a']),
    localJob('n-j', 'n', 'qo', 'q-pi', ['b']),
  ];
  for (const intent of document.productJobIntents.filter(intent => intent.productId === 'p' && intent.id !== 'pi')) {
    for (const [touchpointId, offerId, intentId] of [['t', 'o', intent.id], ['child', 'o', intent.id], ['n', 'qo', `q-${intent.id}`]] as const) {
      document.touchpointJobSelections.push(localJob(`${touchpointId}-${intent.id}`, touchpointId, offerId, intentId, [...intent.addressedDesiredOutcomeIds]));
    }
  }
  document.touchpointFinancialSelections.push(
    { id: 't-f', touchpointId: 't', offerId: 'o', offerFinancialIntentId: 'fi', financialDesiredOutcomeId: 'f' },
    { id: 'n-f', touchpointId: 'n', offerId: 'qo', offerFinancialIntentId: 'q-fi', financialDesiredOutcomeId: 'f' },
  );
  return document;
}

const readGrounds = (document: MapReadDocument, touchpointId = 't') => deriveTouchpointClientIntentNeighborhood(document, touchpointId)!.grounds;
const readJobGround = (document: MapReadDocument, jobId = 'j') => readGrounds(document).find(ground => ground.basisKind === 'job' && ground.jobId === jobId);

describe('canonical Touchpoint Client-intent Neighborhood read compatibility', () => {
  it('preserves normalized legacy scopes, identities and comparisons with only canonical kind metadata changed', () => {
    const legacy = legacyTouchpointReadFixture();
    const legacyBefore = structuredClone(legacy);
    freezeMapReadFixture(legacy);
    const canonical = normalizeLegacyJobs(legacy);
    expectTypeOf(deriveTouchpointClientIntentNeighborhood(legacy, 't')).toEqualTypeOf<TouchpointClientIntentNeighborhood | undefined>();
    expectTypeOf(deriveTouchpointClientIntentNeighborhood(canonical, 't')).toEqualTypeOf<CanonicalTouchpointClientIntentNeighborhood | undefined>();
    const expected = readGrounds(legacy).map(ground => {
      if (ground.basisKind !== 'job' || !['core_functional_job', 'related_job'].includes(ground.jobKind)) return ground;
      return { ...ground, id: `client-intent:functional_job:${ground.jobId}`, groundTypeId: 'functional_job', jobKind: 'functional_job' };
    });
    expect(readGrounds(canonical)).toEqual(expected);
    expect(legacy).toEqual(legacyBefore);
    expect(readGrounds(canonical).map(ground => ground.id)).toEqual([
      'client-intent:functional_job:j', 'client-intent:functional_job:rj',
      'client-intent:consumption_chain_job:ccj', 'client-intent:emotional_job:ej',
      'client-intent:social_job:sj', 'client-intent:financial_desired_outcome:f',
    ]);
    expect(CANONICAL_TOUCHPOINT_CLIENT_INTENT_GROUND_TYPE_IDS).toEqual(['functional_job', 'consumption_chain_job', 'emotional_job', 'social_job', 'financial_desired_outcome']);
    expect(readJobGround(canonical)).toEqual({
      id: 'client-intent:functional_job:j', groundTypeId: 'functional_job', basisKind: 'job', basisId: 'j', jobId: 'j', jobKind: 'functional_job',
      count: 2, neighborTouchpointIds: ['child', 'n'], inspectedContributorOfferIds: ['o', 'o2'],
      inspectedDesiredOutcomes: [{ desiredOutcomeId: 'a', contributorOfferIds: ['o'] }, { desiredOutcomeId: 'b', contributorOfferIds: ['o2'] }],
      neighborComparisons: [
        { touchpointId: 'child', contributorOfferIds: ['o'], desiredOutcomes: [{ desiredOutcomeId: 'a', contributorOfferIds: ['o'] }], commonDesiredOutcomeIds: ['a'], inspectedOnlyDesiredOutcomeIds: ['b'], neighborOnlyDesiredOutcomeIds: [] },
        { touchpointId: 'n', contributorOfferIds: ['qo'], desiredOutcomes: [{ desiredOutcomeId: 'b', contributorOfferIds: ['qo'] }], commonDesiredOutcomeIds: ['b'], inspectedOnlyDesiredOutcomeIds: ['a'], neighborOnlyDesiredOutcomeIds: [] },
      ],
    });
  });

  it.each(['j', 'ccj', 'ej', 'sj'])('requires nonempty effective locally selected DO for canonical Job %s', jobId => {
    const document = normalizeLegacyJobs(legacyTouchpointReadFixture());
    expect(readJobGround(document, jobId)).toBeDefined();
    for (const selection of document.touchpointJobSelections.filter(selection => selection.touchpointId === 't')) {
      if (document.productJobIntents.find(intent => intent.id === selection.productJobIntentId)?.jobId === jobId) selection.addressedDesiredOutcomeIds = [];
    }
    expect(readJobGround(document, jobId)).toBeUndefined();
    for (const selection of document.touchpointJobSelections.filter(selection => selection.touchpointId === 't')) {
      if (document.productJobIntents.find(intent => intent.id === selection.productJobIntentId)?.jobId === jobId) selection.addressedDesiredOutcomeIds = ['missing', 'f', 'p', jobId === 'j' ? 'e-do' : 'a'];
    }
    expect(readJobGround(document, jobId)).toBeUndefined();
    expect(document.productJobIntents).toHaveLength(10);
  });

  it('keeps disjoint valid local subsets as a shared concrete Job ground', () => {
    const document = normalizeLegacyJobs(legacyTouchpointReadFixture());
    document.touchpointJobSelections = document.touchpointJobSelections.filter(selection => selection.id !== 't-j2' && selection.id !== 'child-j');
    expect(readJobGround(document)).toMatchObject({
      neighborTouchpointIds: ['n'], count: 1,
      neighborComparisons: [{ touchpointId: 'n', commonDesiredOutcomeIds: [], inspectedOnlyDesiredOutcomeIds: ['a'], neighborOnlyDesiredOutcomeIds: ['b'] }],
    });
  });

  it('unions every matching Offer selection while retaining explicit-empty and omitted-scope compatibility', () => {
    const document = normalizeLegacyJobs(legacyTouchpointReadFixture());
    document.touchpointJobSelections.find(selection => selection.id === 't-j')!.addressedDesiredOutcomeIds = ['outside', 'outside'];
    document.touchpointJobSelections.find(selection => selection.id === 't-j2')!.addressedDesiredOutcomeIds = [];
    // Explicit selection of an owned DO stays independent of the Product subset in this owner.
    document.offerJobSelections.push({ id: 'second-os', offerId: 'o', productJobIntentId: 'pi', addressedDesiredOutcomeIds: ['outside'] });
    expect(readJobGround(document)).toMatchObject({ inspectedContributorOfferIds: ['o'], inspectedDesiredOutcomes: [{ desiredOutcomeId: 'outside', contributorOfferIds: ['o'] }] });
    document.offerJobSelections.splice(document.offerJobSelections.findIndex(selection => selection.id === 'second-os'), 1);
    expect(readJobGround(document)).toBeUndefined();
    document.touchpointJobSelections.find(selection => selection.id === 't-j2')!.addressedDesiredOutcomeIds = ['b'];
    expect(readJobGround(document)).toMatchObject({ inspectedContributorOfferIds: ['o2'], inspectedDesiredOutcomes: [{ desiredOutcomeId: 'b', contributorOfferIds: ['o2'] }] });
    document.offerJobSelections.find(selection => selection.id === 'os2')!.addressedDesiredOutcomeIds = [];
    expect(readJobGround(document)).toBeUndefined();
  });

  it('does not match distinct same-title Functional Jobs or contextual parents', () => {
    const document = normalizeLegacyJobs(legacyTouchpointReadFixture());
    document.touchpointJobSelections = document.touchpointJobSelections.filter(selection =>
      selection.touchpointId === 't' ? selection.productJobIntentId === 'pi' : selection.productJobIntentId === 'pri' || selection.productJobIntentId === 'q-pri');
    document.touchpointFinancialSelections = [];
    expect(readGrounds(document)).toEqual([]);
    const contextual = setJobContextualParents(document, { targetJobId: 'rj', parentJobIds: ['j', 'ej', 'sj'], newRelationshipIds: ['e-r', 's-r'] });
    expect(readGrounds(contextual)).toEqual([]);
  });

  it('ignores multiple contexts, financial contexts and unselected Jobs without manufacturing local scope', () => {
    const document = normalizeLegacyJobs(legacyTouchpointReadFixture());
    const expected = readGrounds(document);
    let contextual = setJobContextualParents(document, { targetJobId: 'rj', parentJobIds: ['j', 'ej', 'sj', 'u'], newRelationshipIds: ['e-r', 's-r', 'u-r'] });
    contextual = setFinancialDesiredOutcomeJobContexts(contextual, { financialDesiredOutcomeId: 'unselected-f', jobIds: ['j', 'ej', 'sj', 'ccj'], newRelationshipIds: ['j-f', 'e-f', 's-f', 'c-f'] });
    expect(readGrounds(contextual)).toEqual(expected);
    contextual.touchpointJobSelections = [];
    contextual.touchpointFinancialSelections = [];
    expect(readGrounds(contextual)).toEqual([]);
  });

  it('requires exact local FDO attribution and preserves independent financial contributor routes', () => {
    const document = normalizeLegacyJobs(legacyTouchpointReadFixture());
    const financial = readGrounds(document).find(ground => ground.basisKind === 'financial_desired_outcome');
    expect(financial).toEqual({ id: 'client-intent:financial_desired_outcome:f', groundTypeId: 'financial_desired_outcome', basisKind: 'financial_desired_outcome', basisId: 'f', financialDesiredOutcomeId: 'f', inspectedContributorOfferIds: ['o'], neighborTouchpointIds: ['child', 'n'], count: 2, neighborComparisons: [{ touchpointId: 'child', contributorOfferIds: ['o'] }, { touchpointId: 'n', contributorOfferIds: ['qo'] }] });
    document.productJobIntents = []; document.offerJobSelections = []; document.touchpointJobSelections = [];
    expect(readGrounds(document)).toEqual([financial]);
    document.touchpointFinancialSelections.find(selection => selection.id === 't-f')!.offerFinancialIntentId = 'q-fi';
    expect(readGrounds(document)).toEqual([]);
    document.touchpointFinancialSelections.find(selection => selection.id === 't-f')!.offerFinancialIntentId = 'missing';
    expect(readGrounds(document)).toEqual([]);
    document.touchpointFinancialSelections.find(selection => selection.id === 't-f')!.offerFinancialIntentId = 'fi';
    document.touchpointFinancialSelections.find(selection => selection.id === 't-f')!.financialDesiredOutcomeId = 'unselected-f';
    expect(readGrounds(document)).toEqual([]);
  });

  it('ignores stale, wrong-kind, unlinked and misattributed paths without adding contributor provenance', () => {
    const document = normalizeLegacyJobs(legacyTouchpointReadFixture());
    const expected = readGrounds(document);
    document.productJobIntents.push(
      { id: 'missing-job', productId: 'p', jobId: 'missing', addressedDesiredOutcomeIds: ['a'] },
      { id: 'wrong-job', productId: 'p', jobId: 'f', addressedDesiredOutcomeIds: ['a'] },
    );
    document.offerJobSelections.push(
      { id: 'missing-selection', offerId: 'o2', productJobIntentId: 'missing-job', addressedDesiredOutcomeIds: ['a'] },
      { id: 'wrong-selection', offerId: 'o2', productJobIntentId: 'wrong-job', addressedDesiredOutcomeIds: ['a'] },
    );
    document.touchpointJobSelections.push(
      localJob('missing-t', 'missing', 'o2', 'pi', ['a']), localJob('wrong-t', 'o', 'o2', 'pi', ['a']),
      localJob('missing-o', 't', 'missing', 'pi', ['a']), localJob('wrong-o', 't', 'p', 'pi', ['a']),
      localJob('unlinked', 'child', 'o2', 'pi', ['a']), localJob('missing-i', 't', 'o2', 'missing', ['a']),
      localJob('missing-j', 't', 'o2', 'missing-job', ['a']), localJob('wrong-j', 't', 'o2', 'wrong-job', ['a']),
      localJob('wrong-attribution', 't', 'o2', 'q-pi', ['a']),
      localJob('invalid-do', 't', 'o2', 'pi', ['missing', 'e-do', 'f', 'p']),
      { ...document.touchpointJobSelections[0]!, id: 'duplicate-t', addressedDesiredOutcomeIds: ['a', 'a'] },
    );
    document.touchpointFinancialSelections.push(
      { ...document.touchpointFinancialSelections[0]!, id: 'duplicate-f' },
      { id: 'wrong-f', touchpointId: 't', offerId: 'o2', offerFinancialIntentId: 'fi', financialDesiredOutcomeId: 'f' },
      { id: 'stale-f', touchpointId: 't', offerId: 'o2', offerFinancialIntentId: 'missing', financialDesiredOutcomeId: 'f' },
    );
    expect(readGrounds(document)).toEqual(expected);
  });

  it('never inherits Parent scope but accepts independently authored Child selections', () => {
    const document = normalizeLegacyJobs(legacyTouchpointReadFixture());
    expect(readGrounds(document, 'child')).toHaveLength(6);
    document.touchpointJobSelections = document.touchpointJobSelections.filter(selection => selection.touchpointId !== 'child');
    document.touchpointFinancialSelections = document.touchpointFinancialSelections.filter(selection => selection.touchpointId !== 'child');
    expect(readGrounds(document, 'child')).toEqual([]);
    expect(readGrounds(document).every(ground => !ground.neighborTouchpointIds.includes('child'))).toBe(true);
  });

  it('keeps empty/missing inspected states and deterministic title/ID sorting on frozen canonical input', () => {
    const document = normalizeLegacyJobs(legacyTouchpointReadFixture());
    for (const id of ['child', 'n']) document.entities.find(entity => entity.id === id)!.title = 'Same Touchpoint';
    for (const id of ['o', 'o2', 'qo']) document.entities.find(entity => entity.id === id)!.title = 'Same Offer';
    for (const id of ['a', 'b']) document.entities.find(entity => entity.id === id)!.title = 'Same Outcome';
    const before = structuredClone(document);
    const expected = deriveTouchpointClientIntentNeighborhood(freezeMapReadFixture(document), 't');
    expect(expected!.grounds.every(ground => ground.neighborTouchpointIds.join(',') === 'child,n' && ground.count === 2)).toBe(true);
    const reversed = structuredClone(before);
    reversed.entities.reverse(); reversed.relationships.reverse(); reversed.productJobIntents.reverse(); reversed.offerJobSelections.reverse();
    reversed.offerFinancialIntents.reverse(); reversed.touchpointJobSelections.reverse(); reversed.touchpointFinancialSelections.reverse();
    expect(deriveTouchpointClientIntentNeighborhood(reversed, 't')).toEqual(expected);
    expect(document).toEqual(before);
    expect(deriveTouchpointClientIntentNeighborhood(document, 'missing')).toBeUndefined();
    expect(deriveTouchpointClientIntentNeighborhood(document, 'o')).toBeUndefined();
    reversed.touchpointJobSelections = []; reversed.touchpointFinancialSelections = [];
    expect(deriveTouchpointClientIntentNeighborhood(reversed, 't')).toEqual({ touchpointId: 't', grounds: [] });
  });
});
