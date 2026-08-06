import { expect, it } from 'vitest';
import { addEntity, createEmptyMapDocument } from '@vee/domain';
import { deriveMapNodes } from './map-adapter';

it('derives a node without an epistemic annotation and does not mutate domain state', () => {
  const document = addEntity(createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' }),
    { entityId: 'e', title: 'Orbit', kind: 'product', viewId: 'v', x: 12, y: 24 });
  const snapshot = structuredClone(document);
  expect(document.epistemicAnnotations).toEqual([]);
  expect(deriveMapNodes(document, 'v', 'e')[0]).toMatchObject({ id: 'e', position: { x: 12, y: 24 }, selected: true, data: { title: 'Orbit', kindLabel: 'Product' } });
  expect(document).toEqual(snapshot);
});
