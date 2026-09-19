import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

export type PackedPanelPlacement = { id: string; x: number; y: number; width: number };
export type PackedPanelLayout = { columnCount: number; panelWidth: number; height: number; placements: PackedPanelPlacement[] };

type PackedPanelLayoutInput = {
  containerWidth: number;
  minPanelWidth: number;
  maxPanelWidth: number;
  gap: number;
  panelIds: readonly string[];
  measuredHeights: Readonly<Record<string, number>>;
};

export function calculatePackedPanelLayout({ containerWidth, minPanelWidth, maxPanelWidth, gap, panelIds, measuredHeights }: PackedPanelLayoutInput): PackedPanelLayout | null {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0 || minPanelWidth <= 0 || maxPanelWidth < minPanelWidth || gap < 0 || panelIds.length === 0) return null;
  if (panelIds.some(id => { const height = measuredHeights[id]; return height === undefined || !Number.isFinite(height) || height <= 0; })) return null;

  const fittingColumns = Math.max(1, Math.floor((containerWidth + gap) / (minPanelWidth + gap)));
  const columnCount = Math.min(panelIds.length, fittingColumns);
  const panelWidth = Math.min(maxPanelWidth, Math.max(0, (containerWidth - gap * (columnCount - 1)) / columnCount));
  const columnHeights = Array.from({ length: columnCount }, () => 0);
  const placements = panelIds.map(id => {
    let column = 0;
    for (let candidate = 1; candidate < columnCount; candidate += 1) {
      if (columnHeights[candidate]! < columnHeights[column]!) column = candidate;
    }
    const placement = { id, x: column * (panelWidth + gap), y: columnHeights[column]!, width: panelWidth };
    columnHeights[column] = columnHeights[column]! + measuredHeights[id]! + gap;
    return placement;
  });
  const height = Math.max(...columnHeights) - gap;
  return { columnCount, panelWidth, height, placements };
}

const materiallyDifferent = (left: number, right: number) => Math.abs(left - right) > .1;
const layoutsEqual = (left: PackedPanelLayout | null, right: PackedPanelLayout | null) => {
  if (left === right) return true;
  if (!left || !right || left.columnCount !== right.columnCount || materiallyDifferent(left.panelWidth, right.panelWidth) || materiallyDifferent(left.height, right.height) || left.placements.length !== right.placements.length) return false;
  return left.placements.every((placement, index) => {
    const other = right.placements[index];
    return other !== undefined && placement.id === other.id && !materiallyDifferent(placement.x, other.x) && !materiallyDifferent(placement.y, other.y) && !materiallyDifferent(placement.width, other.width);
  });
};

const pixelsForRootRem = (container: HTMLElement, rem: number) => {
  const rootFontSize = Number.parseFloat(globalThis.getComputedStyle(container.ownerDocument.documentElement).fontSize);
  return rem * (Number.isFinite(rootFontSize) ? rootFontSize : 16);
};

export function useClientScopePackedLayout(containerRef: RefObject<HTMLDivElement | null>, panelIds: readonly string[]) {
  const [layout, setLayout] = useState<PackedPanelLayout | null>(null);
  const layoutRef = useRef<PackedPanelLayout | null>(null);
  const panelIdentity = panelIds.join('\u0000');

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      layoutRef.current = null;
      setLayout(null);
      return;
    }
    const calculate = () => {
      const panels = Array.from(container.querySelectorAll<HTMLElement>(':scope > .client-scope-view-panel'));
      const measuredHeights = Object.fromEntries(panels.map(panel => [panel.dataset.clientScopePanelId ?? '', panel.getBoundingClientRect().height]));
      const next = panels.length === panelIds.length ? calculatePackedPanelLayout({
        containerWidth: container.getBoundingClientRect().width,
        minPanelWidth: pixelsForRootRem(container, 18),
        maxPanelWidth: pixelsForRootRem(container, 22),
        gap: pixelsForRootRem(container, .65),
        panelIds,
        measuredHeights,
      }) : null;
      if (!layoutsEqual(layoutRef.current, next)) {
        layoutRef.current = next;
        setLayout(next);
      }
    };
    calculate();
    const observer = new ResizeObserver(calculate);
    observer.observe(container);
    container.querySelectorAll<HTMLElement>(':scope > .client-scope-view-panel').forEach(panel => observer.observe(panel));
    return () => observer.disconnect();
  }, [containerRef, panelIdentity]);

  const placements = new Map(layout?.placements.map(placement => [placement.id, placement]));
  return {
    packed: Boolean(layout),
    containerStyle: layout ? { height: `${layout.height}px` } : undefined,
    panelStyle: (id: string): CSSProperties | undefined => {
      const placement = placements.get(id);
      return placement ? { width: `${placement.width}px`, transform: `translate(${placement.x}px, ${placement.y}px)` } : undefined;
    },
  };
}
