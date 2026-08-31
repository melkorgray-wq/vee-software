import { expect, it } from 'vitest';
import { addEntity, createEmptyMapDocument, setOfferFinancialIntents, setTouchpointIntentSelections } from '@vee/domain';
import { relevantPhysicalEdgeIds, type SatelliteGroup } from './map-relation-projection';
import { focusedRelationTarget, inactiveRelationsMode, reduceRelationsMode, relationEdgeClassName } from './map-relations-mode';

const groups: SatelliteGroup[] = [
  { displayOwnerId: 'source', satelliteKind: 'desired_outcome', targets: [{ entityId: 'a', paths: [['edge-a']] }, { entityId: 'b', paths: [['edge-b']] }] },
  { displayOwnerId: 'source', satelliteKind: 'repulsor', targets: [{ entityId: 'c', paths: [['edge-c']] }] },
];

it('enters from a focused node and traverses groups deterministically', () => {
  let mode = reduceRelationsMode(inactiveRelationsMode(), { type: 'enter', sourceId: 'source', groups }).mode;
  expect(mode).toMatchObject({ state: 'group', groupIndex: 0 });
  mode = reduceRelationsMode(mode, { type: 'previous-group' }).mode;
  expect(mode).toMatchObject({ state: 'group', groupIndex: 1 });
  mode = reduceRelationsMode(mode, { type: 'next-group' }).mode;
  expect(mode).toMatchObject({ state: 'group', groupIndex: 0 });
});

it('navigates concrete targets and backs out one level per Escape', () => {
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

it('returns exact relevant edge IDs without extending an FDO path to Product', () => {
  let document = createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' });
  document = addEntity(document, { entityId: 'product', title: 'Product', kind: 'product', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'product', relationshipId: 'product-offer', viewId: 'view', x: 100, y: 0 });
  document = addEntity(document, { entityId: 'touchpoint', title: 'Touchpoint', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['offer-touchpoint'], viewId: 'view', x: 200, y: 0 });
  document = addEntity(document, { entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome', viewId: 'view', x: 0, y: 100 });
  document = setOfferFinancialIntents(document, { offerId: 'offer', financialDesiredOutcomeIds: ['fdo'], newIntentIds: ['intent'] });
  document = setTouchpointIntentSelections(document, { touchpointId: 'touchpoint', selections: [{ id: 'selection', kind: 'financial', offerId: 'offer', offerFinancialIntentId: 'intent' }] });
  expect(relevantPhysicalEdgeIds(document, 'touchpoint', 'fdo')).toEqual(['financial-intent-route:fdo->touchpoint']);
  expect(relevantPhysicalEdgeIds(document, 'product', 'fdo')).toEqual([]);
});

it('keeps unrelated edges only visually dimmed', () => {
  const relevant = new Set(['path']);
  expect(relationEdgeClassName('map-edge', 'path', relevant)).toBe('map-edge');
  expect(relationEdgeClassName('map-edge', 'other', relevant)).toBe('map-edge relation-dimmed');
});
