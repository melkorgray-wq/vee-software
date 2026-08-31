import { describe, expect, it } from 'vitest';
import { chooseDeterministicFreeSector, placeSatelliteGroups } from './map-satellite-geometry';

describe('map satellite geometry', () => {
  it('chooses a deterministic free sector', () => {
    const occupied = [{ id: 'above', x: 0, y: -100 }];
    expect(chooseDeterministicFreeSector({ x: 0, y: 0 }, 100, occupied)).toBe(6);
    expect(chooseDeterministicFreeSector({ x: 0, y: 0 }, 100, [...occupied])).toBe(6);
  });

  it('uses one orbit without changing node coordinates', () => {
    const owner = { x: 20, y: 30 }; const occupied = [{ id: 'n', x: 50, y: 50 }];
    const snapshot = structuredClone({ owner, occupied });
    const result = placeSatelliteGroups({ ownerCenter: owner, orbitRadius: 80, occupied, groups: [{ id: 'a', kind: 'repulsor', targetIds: ['r'] }, { id: 'b', kind: 'desired_outcome', targetIds: ['d'] }] });
    expect(result.map(item => Math.hypot(item.position.x - owner.x, item.position.y - owner.y))).toEqual([80, 80]);
    expect({ owner, occupied }).toEqual(snapshot);
  });

  it('groups same-kind targets and preserves concrete IDs', () => {
    const [group] = placeSatelliteGroups({ ownerCenter: { x: 0, y: 0 }, orbitRadius: 50, occupied: [], groups: [{ id: 'group', kind: 'repulsor', targetIds: ['r-1', 'r-2'] }] });
    expect(group).toMatchObject({ id: 'group', kind: 'repulsor', targetIds: ['r-1', 'r-2'] });
  });

  it('handles a fully occupied neighborhood deterministically', () => {
    const occupied = Array.from({ length: 12 }, (_, index) => ({ id: String(index), x: Math.cos(-Math.PI / 2 + index * Math.PI / 6) * 50, y: Math.sin(-Math.PI / 2 + index * Math.PI / 6) * 50 }));
    expect(chooseDeterministicFreeSector({ x: 0, y: 0 }, 50, occupied)).toBe(0);
  });
});
