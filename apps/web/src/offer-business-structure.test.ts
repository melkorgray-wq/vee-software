import { describe, expect, it } from 'vitest';
import { createEmptyMapDocument, type MapDocument } from '@vee/domain';
import { deriveOfferBusinessStructure, projectConnectedTouchpointCandidates } from './offer-business-structure';

function fixture(): MapDocument {
  const base = createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' });
  return {
    ...base,
    entities: [
      { id: 'product', kind: 'product', title: 'Product' },
      { id: 'offer', kind: 'offer', title: 'Offer' },
      { id: 'touch-z', kind: 'touchpoint', title: 'Beta' },
      { id: 'touch-b', kind: 'touchpoint', title: 'Alpha' },
      { id: 'touch-a', kind: 'touchpoint', title: 'Alpha' },
    ],
    relationships: [{ id: 'packaged', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer' }],
  };
}

describe('deriveOfferBusinessStructure', () => {
  it('returns the one valid committed Product and no Touchpoints when none are connected', () => {
    expect(deriveOfferBusinessStructure(fixture(), 'offer')).toEqual({
      product: { id: 'product', kind: 'product', title: 'Product' },
      touchpoints: [],
    });
  });

  it('deduplicates and deterministically orders directly connected committed Touchpoints', () => {
    const document = fixture();
    document.relationships.push(
      { id: 'z', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'touch-z' },
      { id: 'a', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'touch-a' },
      { id: 'b', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'touch-b' },
      { id: 'duplicate', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'touch-a' },
    );
    expect(deriveOfferBusinessStructure(document, 'offer')?.touchpoints.map(entity => entity.id)).toEqual(['touch-a', 'touch-b', 'touch-z']);
  });

  it('ignores stale and wrong-kind endpoint records and rejects a non-unique valid Product', () => {
    const document = fixture();
    document.relationships.push(
      { id: 'stale-touch', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'missing' },
      { id: 'wrong-touch', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'product' },
      { id: 'stale-product', kind: 'product_packaged_as_offer', productId: 'missing', offerId: 'offer' },
      { id: 'wrong-product', kind: 'product_packaged_as_offer', productId: 'touch-a', offerId: 'offer' },
    );
    expect(deriveOfferBusinessStructure(document, 'offer')?.touchpoints).toEqual([]);
    document.entities.push({ id: 'product-2', kind: 'product', title: 'Other' });
    document.relationships.push({ id: 'packaged-2', kind: 'product_packaged_as_offer', productId: 'product-2', offerId: 'offer' });
    expect(deriveOfferBusinessStructure(document, 'offer')).toBeUndefined();
  });
});

describe('projectConnectedTouchpointCandidates', () => {
  it('projects committed Root/Child metadata, unique valid Offer counts, and deterministic title/ID order', () => {
    const document = fixture();
    document.entities.push({ id: 'offer-b', kind: 'offer', title: 'Offer B' });
    document.relationships.push(
      { id: 'a', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'touch-a' },
      { id: 'a-duplicate', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'touch-a' },
      { id: 'b', kind: 'offer_presented_at_touchpoint', offerId: 'offer-b', touchpointId: 'touch-a' },
      { id: 'child', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'touch-z', childTouchpointId: 'touch-a' },
      { id: 'stale-offer', kind: 'offer_presented_at_touchpoint', offerId: 'missing', touchpointId: 'touch-b' },
      { id: 'wrong-touch', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'product' },
      { id: 'stale-parent', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'missing', childTouchpointId: 'touch-b' },
    );
    expect(projectConnectedTouchpointCandidates(document, 'offer')).toEqual([
      { id: 'touch-a', title: 'Alpha', connected: true, structuralRole: 'Child', linkedOfferCount: 2 },
      { id: 'touch-b', title: 'Alpha', connected: false, structuralRole: 'Root', linkedOfferCount: 0 },
      { id: 'touch-z', title: 'Beta', connected: false, structuralRole: 'Root', linkedOfferCount: 0 },
    ]);
  });

  it('does not depend on draft or UI state outside the durable document', () => {
    const document = fixture();
    expect(projectConnectedTouchpointCandidates(document, 'offer')).toEqual(projectConnectedTouchpointCandidates(structuredClone(document), 'offer'));
  });
});
