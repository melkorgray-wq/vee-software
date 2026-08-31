import { expect, it } from 'vitest';
import { addEntity, addTouchpointContainer, createEmptyMapDocument, duplicateEntity } from '@vee/domain';
import { contextMenuPoint, disclosureOverlayPoint, linkedOfferIds, matchesWorkspaceShortcut, overlayPoint, parentTouchpointOptions, revealViewport, siblingDraft, siblingPlacement, workspaceShortcutAction } from './map-interaction';

it('arbitrates every workspace shortcut interaction state in one policy', () => {
  expect(workspaceShortcutAction('node')).toBe('switch');
  expect(workspaceShortcutAction('dismissible-menu')).toBe('dismiss-and-switch');
  expect(workspaceShortcutAction('tooltip')).toBe('dismiss-and-switch');
  expect(workspaceShortcutAction('inline-edit')).toBe('ignore');
  expect(workspaceShortcutAction('create-draft')).toBe('ignore');
  expect(workspaceShortcutAction('dirty-inspector')).toBe('confirm');
  expect(workspaceShortcutAction('impact-confirmation')).toBe('ignore');
  expect(workspaceShortcutAction('node', true)).toBe('ignore');
});

it('matches the platform workspace modifier without accepting mixed modifiers', () => {
  const event = { code: 'Space', shiftKey: true, ctrlKey: true, metaKey: false, altKey: false };
  expect(matchesWorkspaceShortcut(event, false)).toBe(true);
  expect(matchesWorkspaceShortcut({ ...event, ctrlKey: false, metaKey: true }, true)).toBe(true);
  expect(matchesWorkspaceShortcut({ ...event, metaKey: true }, false)).toBe(false);
  expect(matchesWorkspaceShortcut({ ...event, altKey: true }, false)).toBe(false);
});

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

it('clamps overlays whose anchors are beyond every panel edge', () => {
  const panel = { left: 100, top: 50, width: 600, height: 400 };
  expect(contextMenuPoint({ x: -50, y: -80 }, panel, { width: 160, height: 120 })).toEqual({ x: 8, y: 8 });
  expect(contextMenuPoint({ x: 900, y: 700 }, panel, { width: 160, height: 120 })).toEqual({ x: 432, y: 272 });
});

it('flips and clamps title disclosures at all four panel boundaries', () => {
  const panel = { left: 100, top: 50, width: 400, height: 300 };
  const overlay = { width: 120, height: 60 };
  expect(disclosureOverlayPoint({ left: 105, right: 125, top: 150, bottom: 170 }, panel, overlay)).toEqual({ x: 33, y: 128 });
  expect(disclosureOverlayPoint({ left: 475, right: 495, top: 150, bottom: 170 }, panel, overlay)).toEqual({ x: 247, y: 128 });
  expect(disclosureOverlayPoint({ left: 250, right: 270, top: 52, bottom: 72 }, panel, overlay)).toEqual({ x: 178, y: 30 });
  expect(disclosureOverlayPoint({ left: 250, right: 270, top: 325, bottom: 345 }, panel, overlay)).toEqual({ x: 178, y: 207 });
});

it('keeps an oversized title disclosure at the panel gutter', () => {
  expect(disclosureOverlayPoint({ left: 150, right: 170, top: 80, bottom: 100 }, { left: 100, top: 50, width: 100, height: 80 }, { width: 160, height: 120 })).toEqual({ x: 8, y: 8 });
});

it('does not move a camera that already reveals the local bounds', () => {
  expect(revealViewport({ left: 100, top: 100, right: 300, bottom: 250 }, { width: 800, height: 600 }, { x: 0, y: 0, zoom: 1 })).toBeNull();
});

it('minimally pans to reveal local bounds while preserving zoom', () => {
  expect(revealViewport({ left: 650, top: 100, right: 850, bottom: 250 }, { width: 800, height: 600 }, { x: 0, y: 0, zoom: 1 })).toEqual({ x: -90, y: 0, zoom: 1 });
});

it('zooms out only enough when local bounds cannot fit and never zooms in', () => {
  expect(revealViewport({ left: 0, top: 0, right: 1000, bottom: 500 }, { width: 800, height: 600 }, { x: 0, y: 0, zoom: 1 })?.zoom).toBeCloseTo(.72);
  const small = revealViewport({ left: 100, top: 100, right: 200, bottom: 200 }, { width: 800, height: 600 }, { x: -100, y: -100, zoom: .5 });
  expect(small?.zoom ?? .5).not.toBeGreaterThan(.5);
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
