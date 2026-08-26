import { expect, it } from 'vitest';
import { createEmptyMapDocument, type Entity, type MapDocument, type ProvisionalEntityKind } from '@vee/domain';
import { layoutForEntity } from './map-adapter';
import { EMPTY_MAP_PLACEMENT, findFreePlacement } from './map-placement';

const VIEW = 'view';
const empty = () => createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: VIEW, viewTitle: 'View' });
const add = (document: MapDocument, id: string, kind: ProvisionalEntityKind, x: number, y: number, viewId = VIEW): MapDocument => ({
  ...document,
  entities: [...document.entities, { id, title: id, kind } as Entity],
  placements: [...document.placements, { entityId: id, viewId, x, y }],
});
const layout = (kind: ProvisionalEntityKind) => layoutForEntity({ kind, title: kind });
const overlaps = (a: { x: number; y: number }, aSize: number, b: { x: number; y: number }, bSize: number) => a.x < b.x + bSize && a.x + aSize > b.x && a.y < b.y + bSize && a.y + aSize > b.y;

it('uses the canonical deterministic seed for an empty view', () => {
  expect(findFreePlacement(empty(), VIEW, layout('product'))).toEqual(EMPTY_MAP_PLACEMENT);
});

it('places one new node without moving or overlapping the existing node', () => {
  const document = add(empty(), 'existing', 'product', 80, 80);
  const before = JSON.stringify(document.placements);
  const point = findFreePlacement(document, VIEW, layout('product'));
  expect(overlaps(point, 136, document.placements[0]!, 136)).toBe(false);
  expect(JSON.stringify(document.placements)).toBe(before);
});

it('uses the actual geometry of differently sized existing and new entities', () => {
  const productDocument = add(empty(), 'touchpoint', 'touchpoint', 0, 0);
  const productPoint = findFreePlacement(productDocument, VIEW, layout('product'));
  expect(overlaps(productPoint, 136, productDocument.placements[0]!, 96)).toBe(false);

  const touchpointDocument = add(empty(), 'product', 'product', 0, 0);
  const touchpointPoint = findFreePlacement(touchpointDocument, VIEW, layout('touchpoint'));
  expect(overlaps(touchpointPoint, 96, touchpointDocument.placements[0]!, 136)).toBe(false);
  expect(productPoint).not.toEqual(touchpointPoint);
});

it('centers rings on occupied rectangle bounds rather than the coordinate average', () => {
  let document = add(empty(), 'left-a', 'touchpoint', 0, 0);
  document = add(document, 'left-b', 'touchpoint', 0, 0);
  document = add(document, 'right', 'touchpoint', 1000, 0);
  const point = findFreePlacement(document, VIEW, layout('touchpoint'));
  // Occupied bounds are 0..1096, so their center is x=548; the first clockwise
  // candidate is directly above it and has top-left x=500.
  expect(point.x).toBeCloseTo(500);
  expect(point.y).toBeCloseTo(-120);
});

function ringBlockers() {
  let document = empty();
  for (let order = 0; order < 16; order += 1) {
    const angle = -Math.PI / 2 + order * Math.PI * 2 / 16;
    document = add(document, `block-${order}`, 'touchpoint', Math.cos(angle) * 120 - 48, Math.sin(angle) * 120 - 48);
  }
  return document;
}

it('uses another valid candidate in the first ring when that ring is partially occupied', () => {
  let document = add(empty(), 'center', 'product', 0, 0);
  document = add(document, 'top-blocker', 'touchpoint', 20, -120);
  document = add(document, 'bottom-blocker', 'touchpoint', 20, 160);
  const point = findFreePlacement(document, VIEW, layout('touchpoint'));
  expect(Math.hypot(point.x + 48 - 68, point.y + 48 - 68)).toBeCloseTo(140);
});

it('advances only when the entire first ring is physically blocked', () => {
  const point = findFreePlacement(ringBlockers(), VIEW, layout('touchpoint'));
  expect(point).toEqual({ x: -47.999999999999986, y: -288 });
});

it('prefers less soft-guard intrusion among physically valid candidates in the nearest ring', () => {
  let document = add(empty(), 'top-right', 'touchpoint', 58, -168);
  document = add(document, 'bottom-left', 'touchpoint', -154, 72);
  const point = findFreePlacement(document, VIEW, layout('touchpoint'));
  // The 12 o'clock candidate is physically valid but sits ten pixels from the
  // top-right node; the zero-intrusion 3 o'clock candidate wins in the same ring.
  expect(point).toEqual({ x: 72, y: -48 });
});

it('treats guard zones as soft and does not leave the nearest physically valid ring', () => {
  let document = empty();
  for (let order = 0; order < 16; order += 1) {
    const angle = -Math.PI / 2 + order * Math.PI * 2 / 16;
    const radialGap = 110 / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
    const radius = 120 + radialGap;
    document = add(document, `guard-${order}`, 'touchpoint', Math.cos(angle) * radius - 48, Math.sin(angle) * radius - 48);
  }
  const point = findFreePlacement(document, VIEW, layout('touchpoint'));
  expect(Math.hypot(point.x + 48, point.y + 48)).toBeCloseTo(120);
});

it('is repeatable and resolves equal candidates clockwise from 12 o’clock', () => {
  const document = add(empty(), 'center', 'product', 0, 0);
  const first = findFreePlacement(document, VIEW, layout('product'));
  expect(first).toEqual(findFreePlacement(document, VIEW, layout('product')));
  expect(first.x).toBeCloseTo(0);
  expect(first.y).toBeCloseTo(-160);
});

it('isolates occupied geometry by view', () => {
  const otherViewOnly = add(empty(), 'elsewhere', 'product', 500, 500, 'other-view');
  expect(findFreePlacement(otherViewOnly, VIEW, layout('touchpoint'))).toEqual(EMPTY_MAP_PLACEMENT);
});
