import { describe, expect, it } from 'vitest';
import { addEntity, createEmptyMapDocument, movePlacement, updateEntity } from './index';

const empty = () => createEmptyMapDocument({ mapId: 'map', title: 'Spike map', viewId: 'view', viewTitle: 'Map view' });
const place = { viewId: 'view', x: 10, y: 20 };
const product = () => addEntity(empty(), { ...place, entityId: 'product', title: 'Orbit', kind: 'product' });
const offer = () => addEntity(product(), { ...place, entityId: 'offer', title: 'Subscription', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged' });

describe('side-aware map domain operations', () => {
  it('creates a Product independently without an automatic annotation', () => {
    const document = product();
    expect(document.entities[0]).toEqual({ id: 'product', title: 'Orbit', kind: 'product' });
    expect(document.epistemicAnnotations).toEqual([]);
  });
  it('requires an existing Product for an Offer and records the typed relationship', () => {
    expect(() => addEntity(empty(), { ...place, entityId: 'offer', title: 'Subscription', kind: 'offer', linkedProductId: 'missing', relationshipId: 'r' })).toThrow('existing entity');
    expect(offer().relationships).toContainEqual({ id: 'packaged', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer' });
  });
  it('rejects an Offer relationship whose endpoint is not a Product', () => {
    const client = addEntity(empty(), { ...place, entityId: 'client', title: 'Need', kind: 'customer_phenomenon' });
    expect(() => addEntity(client, { ...place, entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'client', relationshipId: 'r' })).toThrow('must reference a product');
  });
  it('requires an Offer and Located in for a Touchpoint', () => {
    expect(() => addEntity(product(), { ...place, entityId: 'touch', title: 'Page', kind: 'touchpoint', locatedIn: 'Site', linkedOfferIds: ['product'], relationshipIds: ['r'] })).toThrow('must reference a offer');
    expect(() => addEntity(offer(), { ...place, entityId: 'touch', title: 'Page', kind: 'touchpoint', locatedIn: '', linkedOfferIds: ['offer'], relationshipIds: ['r'] })).toThrow('Located in');
    expect(() => addEntity(offer(), { ...place, entityId: 'touch', title: 'Page', kind: 'touchpoint', locatedIn: 'Site', linkedOfferIds: [], relationshipIds: [] })).toThrow('at least one Offer');
  });
  it('links a Touchpoint to one or multiple Offers with typed relationships', () => {
    const one = addEntity(offer(), { ...place, entityId: 'touch', title: 'Page', kind: 'touchpoint', locatedIn: 'The Quiet Orbit website', linkedOfferIds: ['offer'], relationshipIds: ['presented'] });
    expect(one.entities.at(-1)).toMatchObject({ kind: 'touchpoint', locatedIn: 'The Quiet Orbit website' });
    const twoOffers = addEntity(offer(), { ...place, entityId: 'offer-2', title: 'Workshop', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged-2' });
    const many = addEntity(twoOffers, { ...place, entityId: 'touch', title: 'Page', kind: 'touchpoint', locatedIn: 'Site', linkedOfferIds: ['offer', 'offer-2'], relationshipIds: ['presented-1', 'presented-2'] });
    expect(many.relationships.filter(r => r.kind === 'offer_presented_at_touchpoint')).toHaveLength(2);
  });
  it('keeps kind immutable while editing title and associations', () => {
    const otherProduct = addEntity(offer(), { ...place, entityId: 'product-2', title: 'Other', kind: 'product' });
    const changed = updateEntity(otherProduct, { entityId: 'offer', title: 'Changed', linkedProductId: 'product-2' });
    expect(changed.entities.find(e => e.id === 'offer')).toEqual({ id: 'offer', kind: 'offer', title: 'Changed' });
    expect(changed.relationships.find(r => r.kind === 'product_packaged_as_offer')).toMatchObject({ productId: 'product-2' });
  });
  it('moves placements without changing semantic records', () => {
    const before = product(); const after = movePlacement(before, { entityId: 'product', viewId: 'view', x: 30, y: 40 });
    expect(after.entities).toBe(before.entities); expect(after.relationships).toBe(before.relationships); expect(after.placements[0]).toMatchObject({ x: 30, y: 40 });
  });
});
