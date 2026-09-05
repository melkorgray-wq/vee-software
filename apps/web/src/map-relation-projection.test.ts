import { expect, it } from 'vitest';
import { addEntity, addProductJobIntent, addTouchpointContainer, createEmptyMapDocument, setOfferFinancialIntents, setOfferJobSelections, setTouchpointIntentSelections, type MapDocument } from '@vee/domain';
import { deriveMapEdges } from './map-adapter';
import { projectMapRelationSatellites, relationGroupsForEntity } from './map-relation-projection';

function base(): MapDocument {
  let document = createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' });
  document = addTouchpointContainer(document, { id: 'site', title: 'Site' });
  document = addEntity(document, { entityId: 'product', title: 'Product', kind: 'product', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'product', relationshipId: 'product-offer', viewId: 'view', x: 100, y: 0 });
  return addEntity(document, { entityId: 'touchpoint', title: 'Touchpoint', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['offer'], relationshipIds: ['offer-touchpoint'], viewId: 'view', x: 200, y: 0 });
}

function financialRoute(): MapDocument {
  let document = addEntity(base(), { entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome', viewId: 'view', x: 0, y: 100 });
  document = setOfferFinancialIntents(document, { offerId: 'offer', financialDesiredOutcomeIds: ['fdo'], newIntentIds: ['financial-intent'] });
  return setTouchpointIntentSelections(document, { touchpointId: 'touchpoint', selections: [{ id: 'financial-selection', kind: 'financial', offerId: 'offer', offerFinancialIntentId: 'financial-intent' }] });
}

it('desired outcome owner relation is represented by edge, not satellite', () => {
  let document = addEntity(base(), { entityId: 'job', title: 'Job', kind: 'core_functional_job', viewId: 'view', x: 0, y: 100 });
  document = addEntity(document, { entityId: 'outcome', title: 'Outcome', kind: 'desired_outcome', parentEntityId: 'job', relationshipId: 'job-outcome', viewId: 'view', x: 100, y: 100 });
  expect(deriveMapEdges(document)).toContainEqual(expect.objectContaining({ id: 'job-outcome', source: 'job', target: 'outcome' }));
  expect(relationGroupsForEntity(document, 'job')).toEqual([]);
});

it('direct resisted Client target has no Repulsor satellite', () => {
  let document = addEntity(base(), { entityId: 'job', title: 'Job', kind: 'social_job', viewId: 'view', x: 0, y: 100 });
  document = addEntity(document, { entityId: 'repulsor', title: 'Fear', kind: 'repulsor', resistedTargetIds: ['job'], relationshipIds: ['resistance'], viewId: 'view', x: 100, y: 100 });
  expect(deriveMapEdges(document)).toContainEqual(expect.objectContaining({ id: 'resistance', source: 'repulsor', target: 'job' }));
  expect(relationGroupsForEntity(document, 'job')).toEqual([]);
});

it('Touchpoint FDO direct route suppresses FDO satellite', () => {
  const document = financialRoute();
  expect(deriveMapEdges(document)).toContainEqual(expect.objectContaining({ id: 'financial-intent-route:fdo->touchpoint', source: 'fdo', target: 'touchpoint' }));
  expect(relationGroupsForEntity(document, 'touchpoint')).toEqual([]);
});

it('Touchpoint relevant Repulsor route suppresses Repulsor satellite', () => {
  let document = addEntity(base(), { entityId: 'job', title: 'Job', kind: 'social_job', viewId: 'view', x: 0, y: 100 });
  document = addProductJobIntent(document, { id: 'product-intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: [] });
  document = setOfferJobSelections(document, { offerId: 'offer', productJobIntentIds: ['product-intent'], newSelectionIds: ['offer-selection'] });
  document = setTouchpointIntentSelections(document, { touchpointId: 'touchpoint', selections: [{ id: 'touch-selection', kind: 'job', offerId: 'offer', productJobIntentId: 'product-intent', addressedDesiredOutcomeIds: [] }] });
  document = addEntity(document, { entityId: 'repulsor', title: 'Fear', kind: 'repulsor', resistedTargetIds: ['job'], relationshipIds: ['resistance'], viewId: 'view', x: 100, y: 100 });
  expect(deriveMapEdges(document)).toContainEqual(expect.objectContaining({ id: 'repulsor-route:repulsor->touchpoint', source: 'repulsor', target: 'touchpoint' }));
  expect(relationGroupsForEntity(document, 'touchpoint')).toEqual([]);
});

it('Offer retains FDO satellite while FDO never projects to Product', () => {
  const document = financialRoute();
  expect(relationGroupsForEntity(document, 'offer')).toEqual([{ displayOwnerId: 'offer', satelliteKind: 'financial_desired_outcome', targets: [{ entityId: 'fdo', paths: [['financial-intent']] }] }]);
  expect(relationGroupsForEntity(document, 'product')).toEqual([]);
  expect(projectMapRelationSatellites(document)).toHaveLength(1);
});

it('ignores stale Offer financial intent endpoints and preserves deterministic ordering', () => {
  let document = addEntity(base(), { entityId: 'fdo-z', title: 'Z', kind: 'financial_desired_outcome', viewId: 'view', x: 0, y: 100 });
  document = addEntity(document, { entityId: 'fdo-a', title: 'A', kind: 'financial_desired_outcome', viewId: 'view', x: 0, y: 200 });
  document = setOfferFinancialIntents(document, { offerId: 'offer', financialDesiredOutcomeIds: ['fdo-z', 'fdo-a'], newIntentIds: ['intent-z', 'intent-a'] });
  const stale = { ...document, offerFinancialIntents: [...document.offerFinancialIntents, { id: 'stale', offerId: 'missing', financialDesiredOutcomeId: 'fdo-a' }] };
  const snapshot = structuredClone(stale);
  expect(relationGroupsForEntity(stale, 'offer')[0]?.targets.map(target => target.entityId)).toEqual(['fdo-a', 'fdo-z']);
  expect(stale).toEqual(snapshot);
});
