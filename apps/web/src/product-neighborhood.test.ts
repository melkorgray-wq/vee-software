import { createEmptyMapDocument, type MapDocument } from '@vee/domain';
import { describe, expect, it } from 'vitest';
import { deriveProductNeighborhood } from './product-neighborhood';

function fixture(): MapDocument {
  return {
    ...createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' }),
    entities: [
      ...['p', 'q', 'r', 's'].map((id) => ({ id, kind: 'product' as const, title: id === 'p' ? 'Inspected' : id === 's' ? 'Zulu' : 'Alpha' })),
      ...['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, kind: 'offer' as const, title: id === 'b' || id === 'd' ? 'Zulu' : 'Alpha', currentContentSource: null })),
      ...['t', 'u', 'v'].map((id) => ({ id, kind: 'touchpoint' as const, title: id === 'v' ? 'Zulu' : 'Alpha' })),
    ],
  };
}

function path(document: MapDocument, productId: string, offerId: string, ...touchpointIds: string[]) {
  document.relationships.push({ id: `owner:${offerId}`, kind: 'product_packaged_as_offer', productId, offerId });
  touchpointIds.forEach((touchpointId) => document.relationships.push({
    id: `${offerId}:${touchpointId}`, kind: 'offer_presented_at_touchpoint', offerId, touchpointId,
  }));
}

function freeze(value: unknown) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
}

describe('deriveProductNeighborhood', () => {
  it('creates one exact Touchpoint ground with Product neighbors and both Offer provenances', () => {
    const document = fixture();
    path(document, 'p', 'a', 't');
    path(document, 'q', 'c', 't');
    expect(deriveProductNeighborhood(document, 'p')).toEqual({ productId: 'p', grounds: [{
      id: 'touchpoint:t', basisKind: 'touchpoint', basisId: 't',
      inspectedContributorOfferIds: ['a'], neighbors: [{ productId: 'q', contributorOfferIds: ['c'] }], count: 1,
    }] });
  });

  it.each([false, true])('merges both provenances and repeated presentation records (equal Offer titles: %s)', (equalTitles) => {
    const document = fixture();
    if (equalTitles) document.entities = document.entities.map((entity) => entity.kind === 'offer' ? { ...entity, title: 'Same' } : entity);
    path(document, 'p', 'b', 't');
    path(document, 'p', 'a', 't');
    path(document, 'q', 'd', 't');
    path(document, 'q', 'c', 't');
    document.relationships.push({ id: 'repeat', kind: 'offer_presented_at_touchpoint', offerId: 'c', touchpointId: 't' });
    expect(deriveProductNeighborhood(document, 'p')?.grounds).toEqual([{
      id: 'touchpoint:t', basisKind: 'touchpoint', basisId: 't', inspectedContributorOfferIds: ['a', 'b'],
      neighbors: [{ productId: 'q', contributorOfferIds: ['c', 'd'] }], count: 1,
    }]);
  });

  it('sorts grounds, Products and Offers by title then ID independently of record order', () => {
    const document = fixture();
    path(document, 'p', 'b', 'v', 'u', 't');
    path(document, 'p', 'a', 't', 'u');
    path(document, 's', 'f', 't');
    path(document, 'r', 'e', 't');
    path(document, 'q', 'd', 'u', 't', 'v');
    path(document, 'q', 'c', 't', 'u');
    const result = deriveProductNeighborhood(document, 'p');
    expect(result?.grounds.map((ground) => ground.basisId)).toEqual(['t', 'u', 'v']);
    expect(result?.grounds[0]?.neighbors).toEqual([
      { productId: 'q', contributorOfferIds: ['c', 'd'] },
      { productId: 'r', contributorOfferIds: ['e'] },
      { productId: 's', contributorOfferIds: ['f'] },
    ]);
    expect(result?.grounds.map((ground) => ground.count)).toEqual([3, 1, 1]);
    expect(result?.grounds.filter((ground) => ground.basisKind === 'touchpoint')[1]?.inspectedContributorOfferIds).toEqual(['a', 'b']);
    document.entities.reverse();
    document.relationships.reverse();
    expect(deriveProductNeighborhood(document, 'p')).toEqual(result);
  });

  it('omits empty grounds, self paths and incomplete neighbor paths', () => {
    const document = fixture();
    expect(deriveProductNeighborhood(document, 'p')).toEqual({ productId: 'p', grounds: [] });
    path(document, 'p', 'a', 't');
    path(document, 'p', 'b', 't');
    path(document, 'q', 'c');
    document.relationships.push({ id: 'orphan', kind: 'offer_presented_at_touchpoint', offerId: 'd', touchpointId: 't' });
    expect(deriveProductNeighborhood(document, 'p')?.grounds).toEqual([]);
  });

  it.each([
    ['missing', 'c', 't'], ['a', 'c', 't'],
    ['q', 'missing', 't'], ['q', 'q', 't'],
    ['q', 'c', 'missing'], ['q', 'c', 'q'],
  ])('ignores stale or wrong-kind endpoints (%s → %s → %s)', (productId, offerId, touchpointId) => {
    const document = fixture();
    path(document, 'p', 'a', 't');
    path(document, productId, offerId, touchpointId);
    expect(deriveProductNeighborhood(document, 'p')?.grounds).toEqual([]);
  });

  it.each(['q', 'p', 'missing'])('rejects multiple ownership records including duplicate and stale ownership (%s)', (extraOwner) => {
    const document = fixture();
    path(document, 'p', 'a', 't');
    path(document, 'q', 'c', 't');
    document.relationships.push({ id: 'extra', kind: 'product_packaged_as_offer', productId: extraOwner, offerId: 'c' });
    expect(deriveProductNeighborhood(document, 'p')?.grounds).toEqual([]);
  });

  it('also rejects malformed ownership on the inspected side without suppressing unrelated valid paths', () => {
    const document = fixture();
    path(document, 'p', 'a', 't');
    path(document, 'q', 'c', 't');
    document.relationships.push({ id: 'extra', kind: 'product_packaged_as_offer', productId: 'r', offerId: 'a' });
    expect(deriveProductNeighborhood(document, 'p')?.grounds).toEqual([]);
    path(document, 'p', 'b', 't');
    expect(deriveProductNeighborhood(document, 'p')?.grounds.filter((ground) => ground.basisKind === 'touchpoint')[0]?.inspectedContributorOfferIds).toEqual(['b']);
  });

  it('does not match equal titles, the same container, or Parent/Child inheritance', () => {
    const document = fixture();
    path(document, 'p', 'a', 't');
    path(document, 'q', 'c', 'u');
    document.touchpointContainers.push({ id: 'container', title: 'Shared' });
    document.entities = document.entities.map((entity) => entity.kind === 'touchpoint' ? { ...entity, locatedInId: 'container' } : entity);
    document.relationships.push({ id: 'containment', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 't', childTouchpointId: 'u' });
    expect(deriveProductNeighborhood(document, 'p')?.grounds).toEqual([]);
    expect(deriveProductNeighborhood(document, 'q')?.grounds).toEqual([]);
  });

  it('keeps Touchpoint grounds independent of authored similarity, intent, resistance, placement and epistemic records', () => {
    const document = fixture();
    path(document, 'p', 'a', 't');
    path(document, 'q', 'c', 'u');
    document.entities = document.entities.map((entity) => entity.kind === 'product' ? { ...entity, definitionText: 'Same definition' } : entity);
    document.entities.push({ id: 'job', kind: 'core_functional_job', title: 'Job' }, { id: 'fdo', kind: 'financial_desired_outcome', title: 'FDO' }, { id: 'repulsor', kind: 'repulsor', title: 'Repulsor' });
    document.productJobIntents.push(...['p', 'q'].map((productId) => ({ id: productId, productId, jobId: 'job', addressedDesiredOutcomeIds: [] })));
    document.offerJobSelections.push({ id: 'sa', offerId: 'a', productJobIntentId: 'p' }, { id: 'sc', offerId: 'c', productJobIntentId: 'q' });
    document.offerFinancialIntents.push(...['a', 'c'].map((offerId) => ({ id: offerId, offerId, financialDesiredOutcomeId: 'fdo' })));
    document.relationships.push({ id: 'resistance', kind: 'repulsor_resists', repulsorId: 'repulsor', targetEntityId: 'job' });
    document.placements.push(...['p', 'q'].map((entityId) => ({ viewId: 'view', entityId, x: 0, y: 0 })));
    document.epistemicAnnotations.push({ id: 'annotation', subjectEntityId: 'p', status: 'observed' });
    expect(deriveProductNeighborhood(document, 'p')?.grounds.filter((ground) => ground.basisKind === 'touchpoint')).toEqual([]);
    document.relationships.push({ id: 'shared', kind: 'offer_presented_at_touchpoint', offerId: 'c', touchpointId: 't' });
    expect(deriveProductNeighborhood(document, 'p')?.grounds[0]?.neighbors).toEqual([{ productId: 'q', contributorOfferIds: ['c'] }]);
  });

  it('returns undefined for missing and non-Product inspected endpoints', () => {
    expect(deriveProductNeighborhood(fixture(), 'missing')).toBeUndefined();
    expect(deriveProductNeighborhood(fixture(), 'a')).toBeUndefined();
  });

  it('does not mutate even a deeply frozen committed document', () => {
    const document = fixture();
    path(document, 'p', 'a', 't');
    path(document, 'q', 'c', 't');
    const before = structuredClone(document);
    freeze(document);
    const result = deriveProductNeighborhood(document, 'p');
    expect(result?.grounds).toHaveLength(1);
    result?.grounds.filter((ground) => ground.basisKind === 'touchpoint')[0]?.inspectedContributorOfferIds.push('not-committed');
    expect(document).toEqual(before);
  });
});

function jobFixture(): MapDocument {
  const document = fixture();
  document.entities.push(
    ...(['core_functional_job', 'related_job', 'consumption_chain_job', 'emotional_job', 'social_job'] as const)
      .map((kind) => ({ id: kind, kind, title: kind })),
    { id: 'do-a', kind: 'desired_outcome', title: 'Alpha' },
    { id: 'do-b', kind: 'desired_outcome', title: 'Alpha' },
    { id: 'do-z', kind: 'desired_outcome', title: 'Zulu' },
    { id: 'other-do', kind: 'desired_outcome', title: 'Other' },
    { id: 'fdo', kind: 'financial_desired_outcome', title: 'Financial' },
  );
  document.relationships.push(...['do-z', 'do-b', 'do-a'].map((desiredOutcomeId) => ({
    id: desiredOutcomeId, kind: 'job_has_desired_outcome' as const, jobId: 'core_functional_job', desiredOutcomeId,
  })), { id: 'other-do', kind: 'job_has_desired_outcome', jobId: 'related_job', desiredOutcomeId: 'other-do' });
  return document;
}

function intent(document: MapDocument, productId: string, jobId: string, addressedDesiredOutcomeIds: string[] = []) {
  document.productJobIntents.push({ id: `intent:${document.productJobIntents.length}`, productId, jobId, addressedDesiredOutcomeIds });
}

function jobs(document: MapDocument) {
  return deriveProductNeighborhood(document, 'p')?.grounds.filter((ground) => ground.basisKind === 'job') ?? [];
}

describe('Product Job Neighborhood', () => {
  it.each([
    { inspected: [], neighbor: [], common: [], onlyInspected: [], onlyNeighbor: [] },
    { inspected: ['do-a'], neighbor: ['do-a'], common: ['do-a'], onlyInspected: [], onlyNeighbor: [] },
    { inspected: ['do-b', 'do-a'], neighbor: ['do-z', 'do-b'], common: ['do-b'], onlyInspected: ['do-a'], onlyNeighbor: ['do-z'] },
    { inspected: ['do-a'], neighbor: ['do-z'], common: [], onlyInspected: ['do-a'], onlyNeighbor: ['do-z'] },
  ])('creates exact comparison for shared Job regardless of overlap: $inspected / $neighbor', ({ inspected, neighbor, common, onlyInspected, onlyNeighbor }) => {
    const document = jobFixture();
    intent(document, 'p', 'core_functional_job', inspected);
    intent(document, 'q', 'core_functional_job', neighbor);
    expect(jobs(document)).toEqual([{
      id: 'client-intent:core_functional_job:core_functional_job', basisKind: 'job', basisId: 'core_functional_job',
      jobKind: 'core_functional_job', count: 1, inspectedDesiredOutcomeIds: [...inspected].sort(),
      neighbors: [{ productId: 'q', desiredOutcomeIds: [...neighbor].sort(), commonDesiredOutcomeIds: common,
        inspectedOnlyDesiredOutcomeIds: onlyInspected, neighborOnlyDesiredOutcomeIds: onlyNeighbor }],
    }]);
  });

  it.each(['core_functional_job', 'related_job', 'consumption_chain_job'])('retains ordinary DO comparison for %s', (kind) => {
    const document = jobFixture();
    document.relationships.push({ id: 'owned', kind: 'job_has_desired_outcome', jobId: kind, desiredOutcomeId: 'do-a' });
    intent(document, 'p', kind, ['do-a']); intent(document, 'q', kind, ['do-a']);
    expect(jobs(document)[0]).toMatchObject({ jobKind: kind, inspectedDesiredOutcomeIds: ['do-a'],
      neighbors: [{ productId: 'q', desiredOutcomeIds: ['do-a'], commonDesiredOutcomeIds: ['do-a'],
        inspectedOnlyDesiredOutcomeIds: [], neighborOnlyDesiredOutcomeIds: [] }] });
  });

  it('merges duplicate intents on both sides and retains only valid owned ordinary outcomes', () => {
    const document = jobFixture();
    intent(document, 'p', 'core_functional_job', ['do-z', 'missing', 'fdo', 'q', 'other-do']);
    intent(document, 'p', 'core_functional_job', ['do-b', 'do-b']);
    intent(document, 'q', 'core_functional_job', ['do-b', 'other-do']);
    intent(document, 'q', 'core_functional_job', ['do-a', 'do-a', 'missing']);
    expect(jobs(document)[0]).toEqual({
      id: 'client-intent:core_functional_job:core_functional_job', basisKind: 'job', basisId: 'core_functional_job',
      jobKind: 'core_functional_job', count: 1, inspectedDesiredOutcomeIds: ['do-b', 'do-z'],
      neighbors: [{ productId: 'q', desiredOutcomeIds: ['do-a', 'do-b'], commonDesiredOutcomeIds: ['do-b'],
        inspectedOnlyDesiredOutcomeIds: ['do-z'], neighborOnlyDesiredOutcomeIds: ['do-a'] }],
    });
  });

  it.each(['emotional_job', 'social_job'])('compares ordinary DO without Offer provenance for %s', (kind) => {
    const document = jobFixture();
    document.relationships.push({ id: 'malformed', kind: 'job_has_desired_outcome', jobId: kind, desiredOutcomeId: 'do-a' });
    intent(document, 'p', kind, ['do-a']);
    intent(document, 'q', kind, ['do-a', 'missing']);
    expect(jobs(document)).toEqual([{
      id: `client-intent:${kind}:${kind}`, basisKind: 'job', basisId: kind, jobKind: kind, count: 1,
      inspectedDesiredOutcomeIds: ['do-a'],
      neighbors: [{ productId: 'q', desiredOutcomeIds: ['do-a'], commonDesiredOutcomeIds: ['do-a'], inspectedOnlyDesiredOutcomeIds: [], neighborOnlyDesiredOutcomeIds: [] }],
    }]);
  });

  it.each([['missing', 'core_functional_job'], ['a', 'core_functional_job'], ['q', 'missing'], ['q', 'p'], ['q', 'fdo'], ['q', 'do-a']])('ignores malformed Product/Job endpoints and unsupported kinds (%s, %s)', (productId, jobId) => {
      const document = jobFixture();
      intent(document, 'p', 'core_functional_job');
      intent(document, productId, jobId);
      intent(document, 'p', 'fdo');
      expect(jobs(document)).toEqual([]);
    });

  it('matches Job entity identity rather than intent IDs or equal Job titles', () => {
    const document = jobFixture();
    document.entities.push({ id: 'different-job', kind: 'core_functional_job', title: 'core_functional_job' });
    intent(document, 'p', 'core_functional_job');
    intent(document, 'q', 'different-job');
    document.productJobIntents[1]!.id = document.productJobIntents[0]!.id;
    expect(jobs(document)).toEqual([]);
    intent(document, 'q', 'core_functional_job');
    expect(jobs(document)).toHaveLength(1);
  });

  it('orders kinds, Job titles/IDs, Products and outcomes independently of input order', () => {
    const document = jobFixture();
    document.entities.push(
      { id: 'job-z', kind: 'core_functional_job', title: 'Zulu' },
      { id: 'job-b', kind: 'core_functional_job', title: 'Alpha' },
      { id: 'job-a', kind: 'core_functional_job', title: 'Alpha' },
    );
    const kinds = ['social_job', 'emotional_job', 'consumption_chain_job', 'related_job', 'core_functional_job', 'job-z', 'job-b', 'job-a'];
    for (const jobId of kinds) {
      for (const productId of ['p', 's', 'r', 'q']) intent(document, productId, jobId, ['do-z', 'do-b', 'do-a']);
    }
    const result = jobs(document);
    expect(result.map((ground) => ground.basisId)).toEqual([
      'job-a', 'job-b', 'core_functional_job', 'job-z', 'related_job', 'consumption_chain_job', 'emotional_job', 'social_job',
    ]);
    expect(result.every((ground) => ground.count === 3 && ground.neighbors.map((neighbor) => neighbor.productId).join() === 'q,r,s')).toBe(true);
    expect(result.find((ground) => ground.basisId === 'core_functional_job')).toMatchObject({ inspectedDesiredOutcomeIds: ['do-a', 'do-b', 'do-z'] });
    document.entities.reverse(); document.relationships.reverse(); document.productJobIntents.reverse();
    expect(jobs(document)).toEqual(result);
  });

  it('preserves Touchpoint grounds exactly, before Job grounds, without mutating a frozen document', () => {
    const document = jobFixture();
    path(document, 'p', 'a', 't'); path(document, 'q', 'c', 't');
    const structural = deriveProductNeighborhood(document, 'p')!.grounds;
    intent(document, 'p', 'core_functional_job', ['do-a']); intent(document, 'q', 'core_functional_job', ['do-b']);
    const before = structuredClone(document);
    freeze(document);
    const result = deriveProductNeighborhood(document, 'p')!;
    expect(result.grounds.filter((ground) => ground.basisKind === 'touchpoint')).toEqual(structural);
    expect(result.grounds.map((ground) => ground.basisKind)).toEqual(['touchpoint', 'job']);
    expect(document).toEqual(before);
  });

  it('derives direct Product scope independently of Offer/Touchpoint selections', () => {
    const document = jobFixture();
    intent(document, 'p', 'core_functional_job', ['do-a']); intent(document, 'q', 'core_functional_job', ['do-z']);
    const before = jobs(document);
    document.offerJobSelections.push({ id: 'offer-selection', offerId: 'a', productJobIntentId: document.productJobIntents[0]!.id, addressedDesiredOutcomeIds: ['do-b'] });
    document.touchpointJobSelections.push({ id: 'touch-selection', touchpointId: 't', offerId: 'a', productJobIntentId: document.productJobIntents[0]!.id, addressedDesiredOutcomeIds: ['do-b'] });
    document.offerFinancialIntents.push({ id: 'financial', offerId: 'a', financialDesiredOutcomeId: 'fdo' });
    expect(jobs(document)).toEqual(before);
    document.productJobIntents = [];
    expect(jobs(document)).toEqual([]);
  });
});
