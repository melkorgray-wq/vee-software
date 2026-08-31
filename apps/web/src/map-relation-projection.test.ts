import { expect, it } from 'vitest';
import { addEntity, addProductJobIntent, addTouchpointContainer, createEmptyMapDocument, setOfferFinancialIntents, setOfferJobSelections, setTouchpointIntentSelections, type MapDocument } from '@vee/domain';
import { projectMapRelationSatellites } from './map-relation-projection';

function base(): MapDocument {
  let document = createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' });
  document = addTouchpointContainer(document, { id: 'site', title: 'Site' });
  document = addEntity(document, { entityId: 'product', title: 'Product', kind: 'product', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'offer-b', title: 'Offer B', kind: 'offer', linkedProductId: 'product', relationshipId: 'product-offer-b', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'offer-a', title: 'Offer A', kind: 'offer', linkedProductId: 'product', relationshipId: 'product-offer-a', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'touchpoint', title: 'Touchpoint', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['offer-a', 'offer-b'], relationshipIds: ['offer-a-touchpoint', 'offer-b-touchpoint'], viewId: 'view', x: 0, y: 0 });
  return document;
}

function group(document: MapDocument, owner: string, kind: string) {
  return projectMapRelationSatellites(document).find(candidate => candidate.displayOwnerId === owner && candidate.satelliteKind === kind);
}

it('projects an FDO to its Offer and attributed Touchpoint but never Product', () => {
  let document = addEntity(base(), { entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome', viewId: 'view', x: 0, y: 0 });
  document = setOfferFinancialIntents(document, { offerId: 'offer-a', financialDesiredOutcomeIds: ['fdo'], newIntentIds: ['financial-intent'] });
  document = setTouchpointIntentSelections(document, { touchpointId: 'touchpoint', selections: [{ id: 'financial-selection', kind: 'financial', offerId: 'offer-a', offerFinancialIntentId: 'financial-intent' }] });
  expect(group(document, 'offer-a', 'financial_desired_outcome')?.targets).toEqual([{ entityId: 'fdo', paths: [['financial-intent']] }]);
  expect(group(document, 'touchpoint', 'financial_desired_outcome')?.targets).toEqual([{ entityId: 'fdo', paths: [['financial-intent', 'financial-selection']] }]);
  expect(projectMapRelationSatellites(document).some(candidate => candidate.displayOwnerId === 'product')).toBe(false);
});

it('preserves Desired Outcome ownership under its Job', () => {
  let document = addEntity(base(), { entityId: 'job', title: 'Job', kind: 'core_functional_job', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'outcome', title: 'Outcome', kind: 'desired_outcome', parentEntityId: 'job', relationshipId: 'job-outcome', viewId: 'view', x: 0, y: 0 });
  document = addProductJobIntent(document, { id: 'product-intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] });
  document = setOfferJobSelections(document, { offerId: 'offer-a', productJobIntentIds: ['product-intent'], newSelectionIds: ['offer-selection'] });
  expect(group(document, 'job', 'desired_outcome')?.targets).toEqual([{ entityId: 'outcome', paths: [['job-outcome']] }]);
  expect(group(document, 'offer-a', 'desired_outcome')).toBeUndefined();
});

it('does not project a Repulsor upstream without supported relevance', () => {
  let document = addEntity(base(), { entityId: 'job', title: 'Job', kind: 'social_job', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'repulsor', title: 'Fear', kind: 'repulsor', resistedTargetIds: ['job'], relationshipIds: ['resistance'], viewId: 'view', x: 0, y: 0 });
  const projection = projectMapRelationSatellites(document);
  expect(group(document, 'job', 'repulsor')?.targets).toEqual([{ entityId: 'repulsor', paths: [['resistance']] }]);
  expect(projection.some(candidate => ['product', 'offer-a', 'offer-b', 'touchpoint'].includes(candidate.displayOwnerId) && candidate.satelliteKind === 'repulsor')).toBe(false);
});

it('deduplicates one concrete target reached by multiple valid records', () => {
  let document = addEntity(base(), { entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome', viewId: 'view', x: 0, y: 0 });
  document = setOfferFinancialIntents(document, { offerId: 'offer-a', financialDesiredOutcomeIds: ['fdo'], newIntentIds: ['intent-a'] });
  document = setOfferFinancialIntents(document, { offerId: 'offer-b', financialDesiredOutcomeIds: ['fdo'], newIntentIds: ['intent-b'] });
  document = setTouchpointIntentSelections(document, { touchpointId: 'touchpoint', selections: [
    { id: 'selection-b', kind: 'financial', offerId: 'offer-b', offerFinancialIntentId: 'intent-b' },
    { id: 'selection-a', kind: 'financial', offerId: 'offer-a', offerFinancialIntentId: 'intent-a' },
  ] });
  expect(group(document, 'touchpoint', 'financial_desired_outcome')?.targets).toEqual([{ entityId: 'fdo', paths: [['intent-a', 'selection-a'], ['intent-b', 'selection-b']] }]);
});

it('does not infer generic transitive relationships', () => {
  let document = addEntity(base(), { entityId: 'core', title: 'Core', kind: 'core_functional_job', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'related', title: 'Related', kind: 'related_job', parentEntityId: 'core', relationshipId: 'core-related', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'outcome', title: 'Outcome', kind: 'desired_outcome', parentEntityId: 'related', relationshipId: 'related-outcome', viewId: 'view', x: 0, y: 0 });
  expect(group(document, 'related', 'desired_outcome')).toBeDefined();
  expect(group(document, 'core', 'desired_outcome')).toBeUndefined();
  const stale = { ...document, relationships: [...document.relationships, { id: 'stale', kind: 'job_has_desired_outcome', jobId: 'missing', desiredOutcomeId: 'outcome' } as const] };
  expect(projectMapRelationSatellites(stale)).toEqual(projectMapRelationSatellites(document));
});

it('returns stable group and target ordering', () => {
  let document = addEntity(base(), { entityId: 'z-job', title: 'Z', kind: 'core_functional_job', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'z-outcome', title: 'Z', kind: 'desired_outcome', parentEntityId: 'z-job', relationshipId: 'z-path', viewId: 'view', x: 0, y: 0 });
  document = addEntity(document, { entityId: 'a-outcome', title: 'A', kind: 'desired_outcome', parentEntityId: 'z-job', relationshipId: 'a-path', viewId: 'view', x: 0, y: 0 });
  const snapshot = structuredClone(document);
  expect(projectMapRelationSatellites(document)).toEqual([{ displayOwnerId: 'z-job', satelliteKind: 'desired_outcome', targets: [
    { entityId: 'a-outcome', paths: [['a-path']] }, { entityId: 'z-outcome', paths: [['z-path']] },
  ] }]);
  expect(document).toEqual(snapshot);
});
