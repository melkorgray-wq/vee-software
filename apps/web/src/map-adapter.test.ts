import { expect, it } from 'vitest';
import { addEntity, addTouchpointContainer, createEmptyMapDocument } from '@vee/domain';
import { deriveMapEdges, deriveMapNodes, layoutForEntity } from './map-adapter';

function chain() { let d = createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' }); d = addEntity(d, { entityId: 'p', title: 'Product', kind: 'product', viewId: 'v', x: 0, y: 0 }); d = addEntity(d, { entityId: 'o', title: 'Offer', kind: 'offer', linkedProductId: 'p', relationshipId: 'po', viewId: 'v', x: 100, y: 0 }); d = addTouchpointContainer(d, { id: 'site', title: 'Site' }); d = addEntity(d, { entityId: 't', title: 'Touch', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['ot'], viewId: 'v', x: 200, y: 0 }); return d; }

it('derives all visible typed edges using stable domain IDs', () => { let d = chain(); d = addEntity(d, { entityId: 'child', title: 'Child', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['oc'], parentTouchpointId: 't', parentRelationshipId: 'tc', viewId: 'v', x: 300, y: 0 }); expect(deriveMapEdges(d)).toEqual([
  expect.objectContaining({ id: 'po', source: 'p', target: 'o', label: 'packaged as' }), expect.objectContaining({ id: 'ot', source: 'o', target: 't', label: 'presented at' }), expect.objectContaining({ id: 'oc', source: 'o', target: 'child', label: 'presented at' }), expect.objectContaining({ id: 'tc', source: 't', target: 'child', label: 'contains' }),
]); });
it('derives stable authored-map layout from semantic role', () => {
  expect(layoutForEntity({ kind: 'product', title: 'Product' })).toEqual({ diameter: 136, titleFontSize: 16, kindFontSize: 13, contentWidth: 92, compactTitle: false });
  expect(layoutForEntity({ kind: 'offer', title: 'Offer' })).toEqual({ diameter: 116, titleFontSize: 15, kindFontSize: 12.5, contentWidth: 79, compactTitle: false });
  expect(layoutForEntity({ kind: 'touchpoint', title: 'Touchpoint' })).toEqual({ diameter: 96, titleFontSize: 14, kindFontSize: 12, contentWidth: 65, compactTitle: false });
  expect(layoutForEntity({ kind: 'customer_phenomenon', title: 'Placeholder' })).toEqual({ diameter: 116, titleFontSize: 15, kindFontSize: 12.5, contentWidth: 79, compactTitle: false });
});
it('keeps ancestor and Touchpoint sizes stable as descendants and siblings are added', () => {
  let d = chain();
  const initial = deriveMapNodes(d, 'v', null);
  expect(initial.map(node => [node.id, node.width])).toEqual([['p', 136], ['o', 116], ['t', 96]]);
  d = addEntity(d, { entityId: 't2', title: 'Sibling', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['ot2'], viewId: 'v', x: 0, y: 0 });
  d = addEntity(d, { entityId: 'child', title: 'Child', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['oc'], parentTouchpointId: 't', parentRelationshipId: 'tc', viewId: 'v', x: 0, y: 0 });
  d = addEntity(d, { entityId: 'child2', title: 'Child sibling', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['oc2'], parentTouchpointId: 't', parentRelationshipId: 'tc2', viewId: 'v', x: 0, y: 0 });
  expect(deriveMapNodes(d, 'v', null).map(node => [node.id, node.width])).toEqual([['p', 136], ['o', 116], ['t', 96], ['t2', 96], ['child', 96], ['child2', 96]]);
});
it('derives rendering without mutating the map document', () => { const d = chain(); const snapshot = structuredClone(d); deriveMapNodes(d, 'v', 'o'); expect(d).toEqual(snapshot); });
it('bounds long-title content independently of topology', () => {
  const short = layoutForEntity({ kind: 'offer', title: 'Team' });
  const long = layoutForEntity({ kind: 'offer', title: 'Growth Marketing Team' });
  expect(long).toEqual({ ...short, compactTitle: true });
  expect(long.contentWidth).toBeLessThan(long.diameter);
});
