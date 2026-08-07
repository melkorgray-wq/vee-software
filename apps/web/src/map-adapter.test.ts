import { expect, it } from 'vitest';
import { addEntity, createEmptyMapDocument } from '@vee/domain';
import { deriveMapEdges, deriveMapNodes } from './map-adapter';

it('derives a node without an epistemic annotation and does not mutate domain state', () => {
  const document = addEntity(createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' }),
    { entityId: 'e', title: 'Orbit', kind: 'product', viewId: 'v', x: 12, y: 24 });
  const snapshot = structuredClone(document);
  expect(document.epistemicAnnotations).toEqual([]);
  expect(deriveMapNodes(document, 'v', 'e')[0]).toMatchObject({ id: 'e', position: { x: 12, y: 24 }, selected: true, data: { title: 'Orbit', kindLabel: 'Product' } });
  expect(document).toEqual(snapshot);
});

it('derives typed relationship edges with domain IDs, endpoints, and readable labels without mutation', () => {
  let document = createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' });
  document = addEntity(document, { entityId: 'product', title: 'Orbit', kind: 'product', viewId: 'v', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'offer-1', title: 'Subscription', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged-1', viewId: 'v', x: 100, y: 0 });
  document = addEntity(document, { entityId: 'offer-2', title: 'Workshop', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged-2', viewId: 'v', x: 100, y: 100 });
  document = addEntity(document, { entityId: 'touchpoint', title: 'Page', kind: 'touchpoint', locatedIn: 'Website', linkedOfferIds: ['offer-1', 'offer-2'], relationshipIds: ['presented-1', 'presented-2'], viewId: 'v', x: 200, y: 0 });
  const snapshot = structuredClone(document);

  expect(deriveMapEdges(document)).toEqual([
    expect.objectContaining({ id: 'packaged-1', source: 'product', target: 'offer-1', label: 'packaged as' }),
    expect.objectContaining({ id: 'packaged-2', source: 'product', target: 'offer-2', label: 'packaged as' }),
    expect.objectContaining({ id: 'presented-1', source: 'offer-1', target: 'touchpoint', label: 'presented at' }),
    expect.objectContaining({ id: 'presented-2', source: 'offer-2', target: 'touchpoint', label: 'presented at' }),
  ]);
  deriveMapNodes(document, 'v', null);
  expect(document).toEqual(snapshot);
});
