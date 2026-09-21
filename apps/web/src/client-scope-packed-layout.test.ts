import { describe, expect, it } from 'vitest';
import { calculatePackedPanelLayout } from './client-scope-packed-layout';

const layout = (containerWidth: number, panelIds: string[], heights: number[], minPanelWidth = 180, maxPanelWidth = 220, gap = 10) => calculatePackedPanelLayout({
  containerWidth,
  minPanelWidth,
  maxPanelWidth,
  gap,
  panelIds,
  measuredHeights: Object.fromEntries(panelIds.map((id, index) => [id, heights[index]!])),
});

describe('calculatePackedPanelLayout', () => {
  it('keeps one panel in the first bounded, left-aligned column', () => {
    expect(layout(900, ['a'], [70])).toEqual({ columnCount: 1, panelWidth: 220, height: 70, placements: [{ id: 'a', x: 0, y: 0, width: 220 }] });
  });

  it('places equal-height collapsed panels deterministically with leftmost tie-breaking', () => {
    expect(layout(590, ['a', 'b', 'c', 'd'], [40, 40, 40, 40])).toEqual({
      columnCount: 3,
      panelWidth: 190,
      height: 90,
      placements: [
        { id: 'a', x: 0, y: 0, width: 190 },
        { id: 'b', x: 200, y: 0, width: 190 },
        { id: 'c', x: 400, y: 0, width: 190 },
        { id: 'd', x: 0, y: 50, width: 190 },
      ],
    });
  });

  it('fills shorter columns around one tall panel', () => {
    expect(layout(590, ['tall', 'a', 'b', 'c', 'd'], [200, 40, 40, 40, 40])?.placements.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'tall', x: 0, y: 0 }, { id: 'a', x: 200, y: 0 }, { id: 'b', x: 400, y: 0 }, { id: 'c', x: 200, y: 50 }, { id: 'd', x: 400, y: 50 },
    ]);
  });

  it('packs multiple tall panels by their measured rendered heights', () => {
    const result = layout(590, ['a', 'b', 'c', 'd'], [180, 160, 140, 120]);
    expect(result?.placements.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'a', x: 0, y: 0 }, { id: 'b', x: 200, y: 0 }, { id: 'c', x: 400, y: 0 }, { id: 'd', x: 400, y: 150 },
    ]);
    expect(result?.height).toBe(270);
  });

  it('uses one non-overflowing column below the minimum width', () => {
    const result = layout(150, ['a', 'b'], [50, 60]);
    expect(result).toEqual({ columnCount: 1, panelWidth: 150, height: 120, placements: [{ id: 'a', x: 0, y: 0, width: 150 }, { id: 'b', x: 0, y: 60, width: 150 }] });
    expect(Math.max(...result!.placements.map(panel => panel.x + panel.width))).toBeLessThanOrEqual(150);
  });

  it('fits at least three compact 20rem-or-smaller columns at 1152px', () => {
    const result = layout(1152, Array.from({ length: 14 }, (_, index) => `panel-${index}`), Array(14).fill(60), 224, 320, 10.4)!;
    expect(result.columnCount).toBeGreaterThanOrEqual(3);
    expect(result.panelWidth).toBeLessThanOrEqual(320);
    expect(Math.max(...result.placements.map(panel => panel.x + panel.width))).toBeLessThanOrEqual(1152);
  });

  it('fits every column within the container and derives the tallest column height', () => {
    const result = layout(500, ['a', 'b', 'c'], [100, 50, 75])!;
    expect(result.columnCount).toBe(2);
    expect(Math.max(...result.placements.map(panel => panel.x + panel.width))).toBeLessThanOrEqual(500);
    expect(result.height).toBe(135);
  });

  it('changes column count at the usable-width boundary without overflowing', () => {
    const belowBoundary = layout(369, ['a', 'b', 'c'], [40, 40, 40])!;
    const atBoundary = layout(370, ['a', 'b', 'c'], [40, 40, 40])!;

    expect(belowBoundary.columnCount).toBe(1);
    expect(atBoundary.columnCount).toBe(2);
    expect(Math.max(...atBoundary.placements.map(panel => panel.x + panel.width))).toBe(370);
  });

  it('returns identical placements for identical measured inputs', () => {
    const first = layout(590, ['tall', 'short-a', 'short-b', 'last'], [200, 40, 40, 70]);
    const second = layout(590, ['tall', 'short-a', 'short-b', 'last'], [200, 40, 40, 70]);

    expect(second).toEqual(first);
  });

  it('produces deterministic shortest-column placements for reordered panel IDs', () => {
    const first = layout(590, ['a', 'b', 'c', 'd'], [180, 40, 90, 70]);
    const reordered = layout(590, ['c', 'a', 'd', 'b'], [90, 180, 70, 40]);
    expect(reordered?.placements.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'c', x: 0, y: 0 }, { id: 'a', x: 200, y: 0 }, { id: 'd', x: 400, y: 0 }, { id: 'b', x: 400, y: 80 },
    ]);
    expect(layout(590, ['c', 'a', 'd', 'b'], [90, 180, 70, 40])).toEqual(reordered);
    expect(first).not.toEqual(reordered);
  });

  it('never overlaps placements and sets height to the lowest card boundary', () => {
    const heights = { a: 180, b: 65, c: 140, d: 120, e: 45 };
    const result = calculatePackedPanelLayout({ containerWidth: 590, minPanelWidth: 180, maxPanelWidth: 220, gap: 10, panelIds: Object.keys(heights), measuredHeights: heights })!;
    for (let leftIndex = 0; leftIndex < result.placements.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < result.placements.length; rightIndex += 1) {
        const left = result.placements[leftIndex]!; const right = result.placements[rightIndex]!;
        const separated = left.x + left.width <= right.x || right.x + right.width <= left.x
          || left.y + heights[left.id as keyof typeof heights] <= right.y
          || right.y + heights[right.id as keyof typeof heights] <= left.y;
        expect(separated).toBe(true);
      }
    }
    expect(result.height).toBe(Math.max(...result.placements.map(panel => panel.y + heights[panel.id as keyof typeof heights])));
  });

  it('rejects invalid geometry instead of activating a partial packed layout', () => {
    expect(layout(Number.NaN, ['a'], [40])).toBeNull();
    expect(layout(500, ['a'], [0])).toBeNull();
    expect(layout(500, ['a', 'b'], [40])).toBeNull();
    expect(layout(500, ['a'], [40], Number.NaN)).toBeNull();
  });
});
