import { expect, it } from 'vitest';
import { addEntity, addTouchpointContainer, createEmptyMapDocument, duplicateEntity } from '@vee/domain';
import { linkedOfferIds, overlayPoint, parentTouchpointOptions, siblingDraft, siblingPlacement } from './map-interaction';

it('converts client coordinates to clamped panel-local overlay coordinates', () => {
  const panel = { left: 300, top: 120, width: 700, height: 500 };
  expect(overlayPoint({ x: 340, y: 170 }, panel)).toEqual({ x: 40, y: 50 });
  expect(overlayPoint({ x: 990, y: 610 }, panel)).toEqual({ x: 492, y: 276 });
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
