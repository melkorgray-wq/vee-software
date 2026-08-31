import { expect, it } from 'vitest';
import { createEmptyMapDocument, type Entity, type MapDocument, type ProvisionalEntityKind } from '@vee/domain';
import { layoutForEntity } from './map-adapter';
import { EMPTY_MAP_PLACEMENT, findFreePlacement, findPlacementNearPoint, findRelatedPlacement, reconsiderPlacementAfterRelationCommit } from './map-placement';

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
  // Occupied bounds are 0..1096, so their center is x=548; the first candidate
  // is directly right of it.
  expect(point.x).toBeCloseTo(620);
  expect(point.y).toBeCloseTo(0);
});

function ringBlockers() {
  let document = empty();
  for (let order = 0; order < 16; order += 1) {
    const angle = order * Math.PI * 2 / 16;
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
  expect(point).toEqual({ x: 192, y: -48 });
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

it('is repeatable and resolves equal candidates clockwise from 3 o’clock', () => {
  const document = add(empty(), 'center', 'product', 0, 0);
  const first = findFreePlacement(document, VIEW, layout('product'));
  expect(first).toEqual(findFreePlacement(document, VIEW, layout('product')));
  expect(first.x).toBeCloseTo(160);
  expect(first.y).toBeCloseTo(0);
});

it('isolates occupied geometry by view', () => {
  const otherViewOnly = add(empty(), 'elsewhere', 'product', 500, 500, 'other-view');
  expect(findFreePlacement(otherViewOnly, VIEW, layout('touchpoint'))).toEqual(EMPTY_MAP_PLACEMENT);
});

it('preserves a physically free preferred top-left point exactly', () => {
  const document = add(empty(), 'existing', 'product', 0, 0);
  expect(findPlacementNearPoint(document, VIEW, layout('touchpoint'), { x: 400, y: 250 })).toEqual({ x: 400, y: 250 });
});

it('repairs a preferred-point collision in the nearest deterministic local ring across sides', () => {
  const document = add(empty(), 'business-product', 'product', 100, 100);
  const before = JSON.stringify(document.placements);
  const point = findPlacementNearPoint(document, VIEW, layout('core_functional_job'), { x: 100, y: 100 });
  expect(overlaps(point, 116, document.placements[0]!, 136)).toBe(false);
  expect(Math.hypot(point.x + 58 - 158, point.y + 58 - 158)).toBeCloseTo(150);
  expect(point).toEqual(findPlacementNearPoint(document, VIEW, layout('core_functional_job'), { x: 100, y: 100 }));
  expect(JSON.stringify(document.placements)).toBe(before);
});

it('starts an equal-score related niche ring to the right', () => {
  const document = add(empty(), 'anchor', 'product', 100, 100);
  const point = findRelatedPlacement(document, VIEW, layout('offer'), ['anchor'], [{ sourceId: 'anchor', targetId: 'new' }]);
  expect(point.x + 58).toBeCloseTo(322);
  expect(point.y + 58).toBeCloseTo(168);
  expect(overlaps(point, 116, document.placements[0]!, 136)).toBe(false);
});

it('uses another direction in the same related ring when the right-first niche is blocked', () => {
  let document = add(empty(), 'anchor', 'product', 100, 100);
  document = add(document, 'right-blocker', 'touchpoint', 270, 120);
  const point = findRelatedPlacement(document, VIEW, layout('offer'), ['anchor'], [{ sourceId: 'anchor', targetId: 'new' }]);
  const anchorCenter = { x: 168, y: 168 };
  expect(Math.hypot(point.x + 58 - anchorCenter.x, point.y + 58 - anchorCenter.y)).toBeCloseTo(154);
  expect(point.x + 58).not.toBeCloseTo(anchorCenter.x + 154);
  expect(overlaps(point, 116, document.placements[1]!, 96)).toBe(false);
});

it('isolates relation anchors and visible-edge heuristics to the current view', () => {
  let document = add(empty(), 'anchor', 'product', 0, 0);
  document = add(document, 'other-view-blocker', 'product', 0, -164, 'other-view');
  const point = findRelatedPlacement(document, VIEW, layout('offer'), ['anchor'], [{ sourceId: 'anchor', targetId: 'new' }]);
  expect(point.x + 58).toBeCloseTo(222);
  expect(point.y + 58).toBeCloseTo(68);
});

const linkOffer = (document: MapDocument, productId: string, offerId: string): MapDocument => ({
  ...document,
  relationships: [...document.relationships, { id: `link-${productId}-${offerId}`, kind: 'product_packaged_as_offer', productId, offerId }],
});

it('reconsiders only the affected node after a committed relation change', () => {
  let before = add(empty(), 'product', 'product', 0, 0);
  before = add(before, 'offer', 'offer', 600, 0);
  const after = linkOffer(before, 'product', 'offer');
  const result = reconsiderPlacementAfterRelationCommit(before, after, VIEW, 'offer');
  expect(result.placements.find(item => item.entityId === 'offer')!.x).toBeLessThan(600);
  expect(result.placements.find(item => item.entityId === 'product')).toEqual(before.placements.find(item => item.entityId === 'product'));
});

it('preserves every neighboring authored placement', () => {
  let before = add(empty(), 'product', 'product', 0, 0);
  before = add(before, 'offer', 'offer', 700, 0);
  before = add(before, 'neighbor', 'touchpoint', 350, 220);
  const result = reconsiderPlacementAfterRelationCommit(before, linkOffer(before, 'product', 'offer'), VIEW, 'offer');
  expect(result.placements.filter(item => item.entityId !== 'offer')).toEqual(before.placements.filter(item => item.entityId !== 'offer'));
});

it('prefers a nearby candidate with one crossing over a remote zero-crossing candidate', () => {
  let before = add(empty(), 'product', 'product', 0, 0);
  before = add(before, 'offer', 'offer', 700, 0);
  before = add(before, 'edge-a', 'touchpoint', 350, -100);
  before = add(before, 'edge-b', 'touchpoint', 350, 100);
  before = { ...before, relationships: [...before.relationships, { id: 'crossing', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'edge-a', childTouchpointId: 'edge-b' }] };
  const result = reconsiderPlacementAfterRelationCommit(before, linkOffer(before, 'product', 'offer'), VIEW, 'offer');
  const moved = result.placements.find(item => item.entityId === 'offer')!;
  expect(Math.hypot(moved.x - 700, moved.y)).toBeLessThanOrEqual(144);
  expect(moved.x).toBeLessThan(700);
});

it('keeps the current placement when benefit is below threshold', () => {
  let before = add(empty(), 'product', 'product', 0, 0);
  before = add(before, 'offer', 'offer', 155, 0);
  const after = linkOffer(before, 'product', 'offer');
  expect(reconsiderPlacementAfterRelationCommit(before, after, VIEW, 'offer').placements).toEqual(after.placements);
});

it('does not reposition on cancelled or failed authoring', () => {
  let before = add(empty(), 'product', 'product', 0, 0);
  before = add(before, 'offer', 'offer', 600, 0);
  expect(reconsiderPlacementAfterRelationCommit(before, before, VIEW, 'offer')).toBe(before);
});

it('is independent of viewport pan and zoom', () => {
  let before = add(empty(), 'product', 'product', 0, 0);
  before = add(before, 'offer', 'offer', 600, 0);
  const after = linkOffer(before, 'product', 'offer');
  const first = reconsiderPlacementAfterRelationCommit(before, after, VIEW, 'offer');
  const second = reconsiderPlacementAfterRelationCommit(structuredClone(before), structuredClone(after), VIEW, 'offer');
  expect(second.placements).toEqual(first.placements);
});
