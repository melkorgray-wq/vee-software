import { expect, it } from 'vitest';
import { addEntity, addTouchpointContainer, createEmptyMapDocument, duplicateEntity } from '@vee/domain';
import { linkedOfferIds, overlayPoint, parentTouchpointOptions } from './map-interaction';

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
