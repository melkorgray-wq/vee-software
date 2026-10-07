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
    expect(result?.grounds[1]?.inspectedContributorOfferIds).toEqual(['a', 'b']);
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
    expect(deriveProductNeighborhood(document, 'p')?.grounds[0]?.inspectedContributorOfferIds).toEqual(['b']);
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

  it('ignores authored similarity, intent, resistance, placement and epistemic records', () => {
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
    expect(deriveProductNeighborhood(document, 'p')?.grounds).toEqual([]);
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
    result?.grounds[0]?.inspectedContributorOfferIds.push('not-committed');
    expect(document).toEqual(before);
  });
});
