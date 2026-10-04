import { createEmptyMapDocument, type MapDocument } from '@vee/domain';
import { describe, expect, it } from 'vitest';
import { deriveProductBusinessStructure, projectProductOfferMoveCandidates } from './product-business-structure';

function fixture(): MapDocument {
  const base = createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' });
  return {
    ...base,
    entities: [
      { id: 'product', kind: 'product', title: 'Product' },
      { id: 'other-product', kind: 'product', title: 'Other Product' },
      { id: 'offer-z', kind: 'offer', title: 'Beta', currentContentSource: null },
      { id: 'offer-b', kind: 'offer', title: 'Alpha', currentContentSource: null },
      { id: 'offer-a', kind: 'offer', title: 'Alpha', currentContentSource: null },
      { id: 'other-offer', kind: 'offer', title: 'Other', currentContentSource: null },
      { id: 'touchpoint', kind: 'touchpoint', title: 'Touchpoint' },
    ],
  };
}

describe('deriveProductBusinessStructure', () => {
  it('returns a valid Product with an empty Offers list when none are connected', () => {
    expect(deriveProductBusinessStructure(fixture(), 'product')).toEqual({
      product: { id: 'product', kind: 'product', title: 'Product' },
      offers: [],
    });
  });

  it('includes only direct Offers of the selected Product', () => {
    const document = fixture();
    document.relationships.push(
      { id: 'selected', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' },
      { id: 'other', kind: 'product_packaged_as_offer', productId: 'other-product', offerId: 'other-offer' },
      { id: 'unrelated', kind: 'offer_presented_at_touchpoint', offerId: 'offer-z', touchpointId: 'touchpoint' },
    );

    expect(deriveProductBusinessStructure(document, 'product')?.offers.map((offer) => offer.id)).toEqual(['offer-a']);
  });

  it('deduplicates repeated relationships to an Offer by stable entity ID', () => {
    const document = fixture();
    document.relationships.push(
      { id: 'first', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' },
      { id: 'duplicate', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' },
    );

    expect(deriveProductBusinessStructure(document, 'product')?.offers.map((offer) => offer.id)).toEqual(['offer-a']);
  });

  it('sorts Offers deterministically by title and then ID', () => {
    const document = fixture();
    document.relationships.push(
      { id: 'z', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-z' },
      { id: 'b', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-b' },
      { id: 'a', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' },
    );

    expect(deriveProductBusinessStructure(document, 'product')?.offers.map((offer) => offer.id)).toEqual([
      'offer-a',
      'offer-b',
      'offer-z',
    ]);
  });

  it('ignores stale and wrong-kind Offer endpoints', () => {
    const document = fixture();
    document.relationships.push(
      { id: 'valid', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' },
      { id: 'stale', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'missing' },
      { id: 'wrong-kind', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'touchpoint' },
    );

    expect(deriveProductBusinessStructure(document, 'product')?.offers.map((offer) => offer.id)).toEqual(['offer-a']);
  });

  it('returns undefined for a missing or non-Product inspected entity', () => {
    const document = fixture();

    expect(deriveProductBusinessStructure(document, 'missing')).toBeUndefined();
    expect(deriveProductBusinessStructure(document, 'offer-a')).toBeUndefined();
  });

  it('does not mutate the committed MapDocument', () => {
    const document = fixture();
    document.relationships.push(
      { id: 'selected', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' },
    );
    const before = structuredClone(document);

    deriveProductBusinessStructure(document, 'product');

    expect(document).toEqual(before);
  });

  it('does not include Touchpoints reached through an Offer', () => {
    const document = fixture();
    document.relationships.push(
      { id: 'packaged', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' },
      { id: 'presented', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touchpoint' },
    );

    expect(deriveProductBusinessStructure(document, 'product')).toEqual({
      product: { id: 'product', kind: 'product', title: 'Product' },
      offers: [{ id: 'offer-a', kind: 'offer', title: 'Alpha', currentContentSource: null }],
    });
  });
});

describe('projectProductOfferMoveCandidates', () => {
  it('includes only Offers with exactly one valid owner other than the inspected Product', () => {
    const document = fixture();
    document.relationships.push(
      { id: 'eligible', kind: 'product_packaged_as_offer', productId: 'other-product', offerId: 'other-offer' },
      { id: 'current', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' },
      { id: 'stale', kind: 'product_packaged_as_offer', productId: 'missing', offerId: 'offer-b' },
      { id: 'wrong-kind', kind: 'product_packaged_as_offer', productId: 'touchpoint', offerId: 'offer-z' },
    );

    expect(projectProductOfferMoveCandidates(document, 'product')).toEqual([{
      offer: expect.objectContaining({ id: 'other-offer' }),
      currentProduct: expect.objectContaining({ id: 'other-product' }),
    }]);
  });

  it('excludes orphaned, multiply owned, and duplicate-record ownership', () => {
    const document = fixture();
    document.relationships.push(
      { id: 'one', kind: 'product_packaged_as_offer', productId: 'other-product', offerId: 'offer-a' },
      { id: 'two', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' },
      { id: 'duplicate-a', kind: 'product_packaged_as_offer', productId: 'other-product', offerId: 'offer-b' },
      { id: 'duplicate-b', kind: 'product_packaged_as_offer', productId: 'other-product', offerId: 'offer-b' },
    );

    expect(projectProductOfferMoveCandidates(document, 'product')).toEqual([]);
  });

  it('returns each Offer once in title then ID order', () => {
    const document = fixture();
    document.relationships.push(
      { id: 'z', kind: 'product_packaged_as_offer', productId: 'other-product', offerId: 'offer-z' },
      { id: 'b', kind: 'product_packaged_as_offer', productId: 'other-product', offerId: 'offer-b' },
      { id: 'a', kind: 'product_packaged_as_offer', productId: 'other-product', offerId: 'offer-a' },
    );

    expect(projectProductOfferMoveCandidates(document, 'product').map(candidate => candidate.offer.id)).toEqual([
      'offer-a', 'offer-b', 'offer-z',
    ]);
  });

  it('returns empty for an invalid inspected Product and does not mutate the document', () => {
    const document = fixture();
    const before = structuredClone(document);

    expect(projectProductOfferMoveCandidates(document, 'missing')).toEqual([]);
    expect(projectProductOfferMoveCandidates(document, 'offer-a')).toEqual([]);
    expect(document).toEqual(before);
  });
});
