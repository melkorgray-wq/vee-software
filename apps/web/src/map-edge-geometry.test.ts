import { describe, expect, it } from 'vitest';
import { circleEdgePoints, circularEdgePath, stableEdgeOffset, type EdgeIdentity } from './map-edge-geometry';

describe('circular map edge geometry', () => {
  it.each([
    ['horizontal', { x: 0, y: 0 }, { x: 100, y: 0 }, 10, 20, { source: { x: 10, y: 0 }, target: { x: 80, y: 0 } }],
    ['vertical', { x: 0, y: 0 }, { x: 0, y: 100 }, 20, 10, { source: { x: 0, y: 20 }, target: { x: 0, y: 90 } }],
    ['diagonal', { x: 0, y: 0 }, { x: 30, y: 40 }, 10, 20, { source: { x: 6, y: 8 }, target: { x: 18, y: 24 } }],
  ])('intersects different-sized circles in a %s layout', (_, source, target, sourceRadius, targetRadius, expected) => expect(circleEdgePoints(source, target, sourceRadius, targetRadius)).toEqual(expected));

  it('preserves endpoint meaning when source and target are swapped', () => expect(circleEdgePoints({ x: 100, y: 0 }, { x: 0, y: 0 }, 20, 10)).toEqual({ source: { x: 80, y: 0 }, target: { x: 10, y: 0 } }));
  it('uses a stable fallback direction for coincident and nearly coincident centers', () => {
    expect(circleEdgePoints({ x: 4, y: 5 }, { x: 4, y: 5 }, 10, 20)).toEqual({ source: { x: 14, y: 5 }, target: { x: -16, y: 5 } });
    expect(circleEdgePoints({ x: 4, y: 5 }, { x: 4 + 1e-8, y: 5 }, 10, 20)).toEqual({ source: { x: 14, y: 5 }, target: { x: -15.99999999, y: 5 } });
  });
  it('adds marker clearance outside the target circle', () => expect(circleEdgePoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 10, 20, 3).target).toEqual({ x: 77, y: 0 }));
  it('reverse relationships remain mirrored', () => {
    const forward = { id: 'a', source: 'left', target: 'right' }; const reverse = { id: 'b', source: 'right', target: 'left' }; const edges: EdgeIdentity[] = [reverse, forward];
    const first = circularEdgePath({ sourceCenter: { x: 0, y: 0 }, targetCenter: { x: 100, y: 0 }, sourceRadius: 10, targetRadius: 10, offset: stableEdgeOffset(forward, edges) });
    const second = circularEdgePath({ sourceCenter: { x: 100, y: 0 }, targetCenter: { x: 0, y: 0 }, sourceRadius: 10, targetRadius: 10, offset: stableEdgeOffset(reverse, [...edges].reverse()) });
    expect(first.control?.y).toBe(28); expect(second.control?.y).toBe(-28);
  });
  it('same source and target edges remain deterministically separated', () => {
    const edges = [{ id: 'b', source: 's', target: 't' }, { id: 'a', source: 's', target: 't' }];
    expect(edges.map(edge => stableEdgeOffset(edge, edges))).toEqual([14, -14]);
    expect([...edges].reverse().map(edge => stableEdgeOffset(edge, [...edges].reverse()))).toEqual([-14, 14]);
  });
  it('distinct sources sharing one target stay straight', () => {
    const edges = [{ id: 'client-a-to-tp', source: 'client-a', target: 'touchpoint' }, { id: 'client-b-to-tp', source: 'client-b', target: 'touchpoint' }];
    expect(edges.map(edge => stableEdgeOffset(edge, edges))).toEqual([0, 0]);
  });
  it('distinct targets sharing one source stay straight', () => {
    const edges = [{ id: 'team-to-fp', source: 'team', target: 'fp' }, { id: 'team-to-sp', source: 'team', target: 'sp' }] as const;
    const fpOffset = stableEdgeOffset(edges[0], edges); const spOffset = stableEdgeOffset(edges[1], edges);
    expect([fpOffset, spOffset]).toEqual([0, 0]);
    expect(circularEdgePath({ sourceCenter: { x: 0, y: 0 }, targetCenter: { x: 100, y: 0 }, sourceRadius: 10, targetRadius: 10, offset: fpOffset }).path).toBe('M 10 0 L 90 0');
    expect(circularEdgePath({ sourceCenter: { x: 0, y: 0 }, targetCenter: { x: 0, y: 100 }, sourceRadius: 10, targetRadius: 10, offset: spOffset }).path).toBe('M 0 10 L 0 90');
  });
  it('preserves source and target boundary direction', () => {
    const result = circularEdgePath({ sourceCenter: { x: 100, y: 0 }, targetCenter: { x: 0, y: 0 }, sourceRadius: 20, targetRadius: 10, offset: 14 });
    expect(result.source.x).toBe(80); expect(result.target.x).toBe(10);
    expect(result.path.startsWith('M 80 0')).toBe(true);
  });
});
