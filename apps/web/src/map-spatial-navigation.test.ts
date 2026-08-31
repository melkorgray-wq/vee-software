import { describe, expect, it } from 'vitest';
import { nearestSpatialCandidate, spatialSector } from './map-spatial-navigation';

describe('map spatial navigation geometry', () => {
  it('separates all eight angular sectors at explicit boundaries', () => {
    const source = { x: 0, y: 0 };
    const point = (degrees: number) => ({ x: Math.cos(degrees * Math.PI / 180), y: Math.sin(degrees * Math.PI / 180) });
    expect([22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map(degrees => spatialSector(source, point(degrees)))).toEqual([
      'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east',
    ]);
  });

  it('assigns a genuine northwest candidate to Numpad7 rather than ArrowUp', () => {
    expect(spatialSector({ x: 0, y: 0 }, { x: -10, y: -10 })).toBe('north-west');
  });

  it('selects the nearest candidate with a stable ID tie-break', () => {
    const source = { id: 'source', x: 0, y: 0 };
    const candidates = [{ id: 'z', x: 10, y: 0 }, { id: 'b', x: 5, y: 0 }, { id: 'a', x: 5, y: 0 }];
    expect(nearestSpatialCandidate(source, candidates, 'east')?.id).toBe('a');
  });

  it('returns null without widening an empty sector', () => {
    expect(nearestSpatialCandidate({ id: 'source', x: 0, y: 0 }, [{ id: 'north-west', x: -1, y: -1 }], 'north')).toBeNull();
  });

  it('does not wrap across the map', () => {
    expect(nearestSpatialCandidate({ id: 'east-edge', x: 10, y: 0 }, [{ id: 'west-edge', x: -10, y: 0 }], 'east')).toBeNull();
  });
});
