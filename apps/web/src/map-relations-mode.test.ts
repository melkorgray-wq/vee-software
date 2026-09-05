import { expect, it } from 'vitest';
import { addEntity, addProductJobIntent, createEmptyMapDocument, setOfferFinancialIntents, setOfferJobSelections, setTouchpointIntentSelections } from '@vee/domain';
import { relationGroupsForEntity, relevantPhysicalEdgeIds, type SatelliteGroup } from './map-relation-projection';
import { focusedRelationTarget, inactiveRelationsMode, reduceRelationsMode, relationEdgeClassName } from './map-relations-mode';

const groups: SatelliteGroup[] = [
  { displayOwnerId: 'source', satelliteKind: 'desired_outcome', targets: [{ entityId: 'a', paths: [['edge-a']] }, { entityId: 'b', paths: [['edge-b']] }] },
  { displayOwnerId: 'source', satelliteKind: 'repulsor', targets: [{ entityId: 'c', paths: [['edge-c']] }] },
];
const singleTargetGroups: SatelliteGroup[] = [groups[1]!];

it('enters from a focused node and traverses groups deterministically', () => {
  let mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'source', groups }).mode;
  expect(mode).toMatchObject({ state: 'group', groupIndex: 0 });
  mode = reduceRelationsMode(mode, { type: 'previous-group' }).mode;
  expect(mode).toMatchObject({ state: 'group', groupIndex: 1 });
  mode = reduceRelationsMode(mode, { type: 'next-group' }).mode;
  expect(mode).toMatchObject({ state: 'group', groupIndex: 0 });
});

it('preserves multi-target concrete-list → Escape → group → Escape → inactive behavior', () => {
  let mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'source', groups }).mode;
  mode = reduceRelationsMode(mode, { type: 'next-target' }).mode;
  expect(focusedRelationTarget(mode)).toBe('a');
  mode = reduceRelationsMode(mode, { type: 'next-target' }).mode;
  expect(focusedRelationTarget(mode)).toBe('b');
  mode = reduceRelationsMode(mode, { type: 'next-target' }).mode;
  expect(focusedRelationTarget(mode)).toBe('b');
  mode = reduceRelationsMode(mode, { type: 'escape' }).mode;
  expect(mode.state).toBe('group');
  expect(reduceRelationsMode(mode, { type: 'escape' }).mode).toEqual({ state: 'inactive' });
});

it('single-target relation group resolves concrete target', () => {
  const mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'source', groups: singleTargetGroups }).mode;
  expect(mode).toMatchObject({ state: 'group', groupIndex: 0 });
  expect(focusedRelationTarget(mode)).toBe('c');
  expect(reduceRelationsMode(mode, { type: 'follow-target' })).toEqual({ mode: { state: 'inactive' }, followedTargetId: 'c' });
});

it('multi-target group does not guess concrete target', () => {
  let mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'source', groups: [groups[0]!] }).mode;
  expect(focusedRelationTarget(mode)).toBeUndefined();
  expect(reduceRelationsMode(mode, { type: 'follow-target' })).toEqual({ mode });
  mode = reduceRelationsMode(mode, { type: 'next-target' }).mode;
  expect(focusedRelationTarget(mode)).toBe('a');
});

it('one-target Product Job group resolves the concrete Job while multi-target requires selection', () => {
  let document = createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' });
  document = addEntity(document, { entityId: 'product', title: 'Product', kind: 'product', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'job-b', title: 'B', kind: 'social_job', viewId: 'view', x: 0, y: 100 });
  document = addProductJobIntent(document, { id: 'intent-b', productId: 'product', jobId: 'job-b', addressedDesiredOutcomeIds: [] });
  let productGroups = relationGroupsForEntity(document, 'product');
  let mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'product', groups: productGroups }).mode;
  expect(reduceRelationsMode(mode, { type: 'follow-target' })).toEqual({ mode: { state: 'inactive' }, followedTargetId: 'job-b' });

  document = addEntity(document, { entityId: 'job-a', title: 'A', kind: 'social_job', viewId: 'view', x: 0, y: 200 });
  document = addProductJobIntent(document, { id: 'intent-a', productId: 'product', jobId: 'job-a', addressedDesiredOutcomeIds: [] });
  productGroups = relationGroupsForEntity(document, 'product');
  mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'product', groups: productGroups }).mode;
  expect(focusedRelationTarget(mode)).toBeUndefined();
  expect(reduceRelationsMode(mode, { type: 'follow-target' })).toEqual({ mode });
  mode = reduceRelationsMode(mode, { type: 'next-target' }).mode;
  expect(focusedRelationTarget(mode)).toBe('job-a');
  expect(relevantPhysicalEdgeIds(document, 'product', 'job-a')).toEqual([]);
});

it('one-target Offer Job group resolves the concrete Job while multi-target behavior remains unchanged', () => {
  let document = createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' });
  document = addEntity(document, { entityId: 'product', title: 'Product', kind: 'product', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'product', relationshipId: 'product-offer', viewId: 'view', x: 100, y: 0 });
  document = addEntity(document, { entityId: 'job-b', title: 'B', kind: 'social_job', viewId: 'view', x: 0, y: 100 });
  document = addProductJobIntent(document, { id: 'intent-b', productId: 'product', jobId: 'job-b', addressedDesiredOutcomeIds: [] });
  document = setOfferJobSelections(document, { offerId: 'offer', productJobIntentIds: ['intent-b'], newSelectionIds: ['selection-b'] });
  let offerGroups = relationGroupsForEntity(document, 'offer');
  let mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'offer', groups: offerGroups }).mode;
  expect(focusedRelationTarget(mode)).toBe('job-b');
  expect(reduceRelationsMode(mode, { type: 'follow-target' })).toEqual({ mode: { state: 'inactive' }, followedTargetId: 'job-b' });

  document = addEntity(document, { entityId: 'job-a', title: 'A', kind: 'social_job', viewId: 'view', x: 0, y: 200 });
  document = addProductJobIntent(document, { id: 'intent-a', productId: 'product', jobId: 'job-a', addressedDesiredOutcomeIds: [] });
  document = setOfferJobSelections(document, { offerId: 'offer', productJobIntentIds: ['intent-b', 'intent-a'], newSelectionIds: ['selection-a'] });
  offerGroups = relationGroupsForEntity(document, 'offer');
  mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'offer', groups: offerGroups }).mode;
  expect(focusedRelationTarget(mode)).toBeUndefined();
  expect(reduceRelationsMode(mode, { type: 'follow-target' })).toEqual({ mode });
  mode = reduceRelationsMode(mode, { type: 'next-target' }).mode;
  expect(focusedRelationTarget(mode)).toBe('job-a');
  expect(relevantPhysicalEdgeIds(document, 'offer', 'job-a')).toEqual([]);
});

it('escape exits single-target relation focus', () => {
  const mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'source', groups: singleTargetGroups }).mode;
  expect(reduceRelationsMode(mode, { type: 'escape' }).mode).toEqual({ state: 'inactive' });
});

it('Enter follows the target on Map without opening Inspector', () => {
  let mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'source', groups }).mode;
  mode = reduceRelationsMode(mode, { type: 'next-target' }).mode;
  expect(reduceRelationsMode(mode, { type: 'follow-target' })).toEqual({ mode: { state: 'inactive' }, followedTargetId: 'a' });
});

it('workspace shortcut opens the focused relation target in Inspector', () => {
  let mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'source', groups }).mode;
  mode = reduceRelationsMode(mode, { type: 'next-target' }).mode;
  expect(focusedRelationTarget(mode)).toBe('a');
});

it('exposes only the visible Offer FDO group and resolves its single target immediately', () => {
  let document = createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' });
  document = addEntity(document, { entityId: 'product', title: 'Product', kind: 'product', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'product', relationshipId: 'product-offer', viewId: 'view', x: 100, y: 0 });
  document = addEntity(document, { entityId: 'touchpoint', title: 'Touchpoint', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['offer-touchpoint'], viewId: 'view', x: 200, y: 0 });
  document = addEntity(document, { entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome', viewId: 'view', x: 0, y: 100 });
  document = setOfferFinancialIntents(document, { offerId: 'offer', financialDesiredOutcomeIds: ['fdo'], newIntentIds: ['intent'] });
  document = setTouchpointIntentSelections(document, { touchpointId: 'touchpoint', selections: [{ id: 'selection', kind: 'financial', offerId: 'offer', offerFinancialIntentId: 'intent' }] });
  expect(relationGroupsForEntity(document, 'touchpoint')).toEqual([]);
  expect(relationGroupsForEntity(document, 'product')).toEqual([]);
  const offerGroups = relationGroupsForEntity(document, 'offer');
  expect(offerGroups).toHaveLength(1);
  const mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'offer', groups: offerGroups }).mode;
  expect(focusedRelationTarget(mode)).toBe('fdo');
  expect(reduceRelationsMode(mode, { type: 'follow-target' })).toEqual({ mode: { state: 'inactive' }, followedTargetId: 'fdo' });
  expect(relevantPhysicalEdgeIds(document, 'offer', 'fdo')).toEqual([]);
  expect(relevantPhysicalEdgeIds(document, 'touchpoint', 'fdo')).toEqual([]);
  expect(relevantPhysicalEdgeIds(document, 'product', 'fdo')).toEqual([]);
});

it('keeps unrelated edges only visually dimmed', () => {
  const relevant = new Set(['path']);
  expect(relationEdgeClassName('map-edge', 'path', relevant)).toBe('map-edge');
  expect(relationEdgeClassName('map-edge', 'other', relevant)).toBe('map-edge relation-dimmed');
});
