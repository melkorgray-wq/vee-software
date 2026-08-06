import { expect, it } from 'vitest';
import { addEntity, createEmptyMapDocument } from '@vee/domain';
import { deriveMapNodes } from './map-adapter';

it('derives position and readable labels without mutating domain state', () => {
  const document = addEntity(createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' }),
    { entityId: 'e', annotationId: 'a', title: 'Checkout', kind: 'touchpoint', status: 'participant_reported', viewId: 'v', x: 12, y: 24 });
  const snapshot = structuredClone(document);
  expect(deriveMapNodes(document, 'v', 'e')[0]).toMatchObject({ id: 'e', position: { x: 12, y: 24 }, selected: true,
    data: { title: 'Checkout', kindLabel: 'Touchpoint', statusLabel: 'Participant reported' } });
  expect(document).toEqual(snapshot);
});
