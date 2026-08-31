import { describe, expect, it } from 'vitest';
import type { MapDocument } from '@vee/domain';
import { enterMoveMode, inactiveMoveMode, MOVE_STEP, moveInMode, moveVectorForKey } from './map-move-mode';

const document = (): MapDocument => ({
  id: 'map', title: 'Map', views: [{ id: 'view', title: 'View' }],
  entities: [{ id: 'focused', kind: 'product', title: 'Focused' }, { id: 'neighbor', kind: 'offer', title: 'Neighbor' }],
  relationships: [{ id: 'relationship', kind: 'product_packaged_as_offer', productId: 'focused', offerId: 'neighbor' }],
  placements: [{ viewId: 'view', entityId: 'focused', x: 10, y: 20 }, { viewId: 'view', entityId: 'neighbor', x: 100, y: 200 }],
  touchpointContainers: [], epistemicAnnotations: [], productJobIntents: [], offerJobSelections: [], offerFinancialIntents: [], touchpointJobSelections: [], touchpointFinancialSelections: [],
});

describe('Map Move mode', () => {
  it('enters and exits Move mode without changing the document', () => {
    const before = document();
    expect(enterMoveMode('focused', false)).toEqual({ state: 'moving', entityId: 'focused' });
    expect(inactiveMoveMode()).toEqual({ state: 'inactive' });
    expect(before).toEqual(document());
  });
  it('moves only the focused placement for cardinal and diagonal keys', () => {
    const mode = enterMoveMode('focused', false);
    const east = moveInMode(document(), 'view', mode, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(east.placements).toEqual([{ viewId: 'view', entityId: 'focused', x: 10 + MOVE_STEP, y: 20 }, { viewId: 'view', entityId: 'neighbor', x: 100, y: 200 }]);
    const diagonal = moveInMode(east, 'view', mode, { key: '7', code: 'Numpad7' });
    expect(diagonal.placements[0]).toMatchObject({ x: 10, y: 20 - MOVE_STEP });
    expect(moveVectorForKey({ key: '9', code: 'Numpad9' })).toEqual({ x: MOVE_STEP, y: -MOVE_STEP });
  });
  it('preserves entities relationships and neighboring placements', () => {
    const before = document();
    const after = moveInMode(before, 'view', enterMoveMode('focused', false), { key: 'ArrowDown', code: 'ArrowDown' });
    expect(after.entities).toBe(before.entities);
    expect(after.relationships).toBe(before.relationships);
    expect(after.placements[1]).toBe(before.placements[1]);
  });
  it('does not collide with Relations mode or editable controls', () => {
    expect(enterMoveMode('focused', true)).toEqual({ state: 'inactive' });
    const before = document();
    expect(moveInMode(before, 'view', inactiveMoveMode(), { key: 'ArrowLeft', code: 'ArrowLeft' })).toBe(before);
  });
  it('Escape exits without reverting completed moves', () => {
    const after = moveInMode(document(), 'view', enterMoveMode('focused', false), { key: 'ArrowUp', code: 'ArrowUp' });
    expect(inactiveMoveMode()).toEqual({ state: 'inactive' });
    expect(after.placements[0]).toMatchObject({ x: 10, y: 20 - MOVE_STEP });
  });
});
