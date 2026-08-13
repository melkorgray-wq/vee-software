import { expect, it } from 'vitest';
import { addEntity, addTouchpointContainer, createEmptyMapDocument, duplicateEntity } from '@vee/domain';
import { contextMenuPoint, linkedOfferIds, overlayPoint, parentTouchpointOptions, siblingDraft, siblingPlacement } from './map-interaction';

it('converts client coordinates to clamped panel-local overlay coordinates', () => {
  const panel = { left: 300, top: 120, width: 700, height: 500 };
  expect(overlayPoint({ x: 340, y: 170 }, panel)).toEqual({ x: 40, y: 50 });
  expect(overlayPoint({ x: 990, y: 610 }, panel)).toEqual({ x: 492, y: 276 });
});

it('places a measured context menu right and down when both directions fit', () => {
  expect(contextMenuPoint({ x: 300, y: 250 }, { left: 100, top: 50, width: 600, height: 400 }, { width: 160, height: 120 })).toEqual({ x: 200, y: 200 });
});

it('flips a measured context menu left when the right side is insufficient', () => {
  expect(contextMenuPoint({ x: 650, y: 150 }, { left: 100, top: 50, width: 600, height: 400 }, { width: 160, height: 120 })).toEqual({ x: 390, y: 100 });
});

it('flips a measured context menu up when the space below is insufficient', () => {
  expect(contextMenuPoint({ x: 300, y: 420 }, { left: 100, top: 50, width: 600, height: 400 }, { width: 160, height: 120 })).toEqual({ x: 200, y: 250 });
});

it('flips a measured context menu left and up at the bottom-right corner', () => {
  expect(contextMenuPoint({ x: 680, y: 430 }, { left: 100, top: 50, width: 600, height: 400 }, { width: 160, height: 120 })).toEqual({ x: 420, y: 260 });
});

it('repositions an overlay upward after its measured height increases', () => {
  const panel = { left: 100, top: 50, width: 600, height: 400 };
  expect(contextMenuPoint({ x: 300, y: 360 }, panel, { width: 160, height: 80 })).toEqual({ x: 200, y: 310 });
  expect(contextMenuPoint({ x: 300, y: 360 }, panel, { width: 160, height: 240 })).toEqual({ x: 200, y: 70 });
});

it('repositions a grown overlay left and up at the bottom-right edge', () => {
  expect(contextMenuPoint({ x: 680, y: 430 }, { left: 100, top: 50, width: 600, height: 400 }, { width: 280, height: 300 })).toEqual({ x: 300, y: 80 });
});

it('keeps the panel gutter when an overlay is taller than the panel', () => {
  expect(contextMenuPoint({ x: 300, y: 420 }, { left: 100, top: 50, width: 600, height: 400 }, { width: 280, height: 520 })).toEqual({ x: 200, y: 8 });
});

it('clamps a menu inside the panel gutter when neither side of the anchor fits', () => {
  expect(contextMenuPoint({ x: 200, y: 150 }, { left: 100, top: 50, width: 200, height: 200 }, { width: 180, height: 180 })).toEqual({ x: 12, y: 12 });
});

it('derives duplicated Touchpoints as valid current-document parents', () => {
  let document = createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' });
  document = addEntity(document, { entityId: 'p', title: 'P', kind: 'product', viewId: 'v', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'o', title: 'O', kind: 'offer', linkedProductId: 'p', relationshipId: 'po', viewId: 'v', x: 0, y: 0 });
  document = addTouchpointContainer(document, { id: 'site', title: 'Site' });
  document = addEntity(document, { entityId: 'a', title: 'Front Page', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['oa'], viewId: 'v', x: 0, y: 0 });
  document = duplicateEntity(document, { sourceEntityId: 'a', entityId: 'b', viewId: 'v', x: 10, y: 10, relationshipIds: ['ob'] });
  document = addEntity(document, { entityId: 'c', title: 'Notion Example', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: linkedOfferIds(document, 'b'), relationshipIds: ['oc'], parentTouchpointId: 'b', parentRelationshipId: 'bc', viewId: 'v', x: 20, y: 20 });
  expect(parentTouchpointOptions(document, 'c').map(entity => entity.id)).toEqual(['a', 'b']);
  expect(document.relationships).toContainEqual({ id: 'bc', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'b', childTouchpointId: 'c' });
  expect(parentTouchpointOptions(document, 'b').map(entity => entity.id)).not.toContain('c');
});

it('derives empty Product and Offer sibling drafts from the current document', () => {
  let document = createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' });
  document = addEntity(document, { entityId: 'p', title: 'Product A', kind: 'product', viewId: 'v', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'o', title: 'Offer A', kind: 'offer', linkedProductId: 'p', relationshipId: 'po', viewId: 'v', x: 190, y: 0 });
  expect(siblingDraft(document, 'p')).toMatchObject({ kind: 'product', title: '', linkedProductId: '', parentTouchpointId: '' });
  const offer = siblingDraft(document, 'o')!;
  expect(offer).toMatchObject({ kind: 'offer', title: '', linkedProductId: 'p' });
  const before = document;
  const committed = addEntity(document, { entityId: 'o2', title: 'Offer B', kind: 'offer', linkedProductId: offer.linkedProductId, relationshipId: 'po2', viewId: 'v', x: 190, y: 125 });
  expect(committed.relationships).toContainEqual({ id: 'po2', kind: 'product_packaged_as_offer', productId: 'p', offerId: 'o2' });
  expect(before.entities).toHaveLength(2);
  expect(before.relationships).toHaveLength(1);
});

it('derives root and child Touchpoint sibling context without authored title or URL', () => {
  let document = createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' });
  document = addEntity(document, { entityId: 'p', title: 'P', kind: 'product', viewId: 'v', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'o', title: 'O', kind: 'offer', linkedProductId: 'p', relationshipId: 'po', viewId: 'v', x: 190, y: 0 });
  document = addTouchpointContainer(document, { id: 'site', title: 'Website' });
  document = addEntity(document, { entityId: 'root', title: 'Services', kind: 'touchpoint', locatedInId: 'site', url: '/services', linkedOfferIds: ['o'], relationshipIds: ['or'], viewId: 'v', x: 380, y: 0 });
  document = addEntity(document, { entityId: 'other', title: 'Front Page', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['oo'], viewId: 'v', x: 380, y: 125 });
  document = addEntity(document, { entityId: 'child', title: 'Notion Example', kind: 'touchpoint', locatedInId: 'site', url: '/notion', linkedOfferIds: ['o'], relationshipIds: ['oc'], parentTouchpointId: 'root', parentRelationshipId: 'rc', viewId: 'v', x: 570, y: 0 });
  expect(siblingDraft(document, 'root')).toMatchObject({ kind: 'touchpoint', title: '', url: '', linkedOfferIds: ['o'], locatedInId: 'site', locatedInQuery: 'Website', parentTouchpointId: '' });
  expect(siblingDraft(document, 'child')).toMatchObject({ kind: 'touchpoint', title: '', url: '', linkedOfferIds: ['o'], locatedInId: 'site', locatedInQuery: 'Website', parentTouchpointId: 'root' });
  const reassigned = document.relationships.map(relationship => relationship.kind === 'touchpoint_contains_touchpoint' && relationship.childTouchpointId === 'child' ? { ...relationship, parentTouchpointId: 'other' } : relationship);
  expect(siblingDraft({ ...document, relationships: reassigned }, 'child')?.parentTouchpointId).toBe('other');
  expect(siblingPlacement(document, 'root', 'v')).toEqual({ x: 380, y: 250 });
});
