import { expect, it } from 'vitest';
import type { MapDocument } from '@vee/domain';
import { deriveMapEdges } from './map-adapter';
import { deriveRelationLensTrace } from './map-relation-lens';

function fixture(): MapDocument {
  const entities: MapDocument['entities'] = [
    { id: 'product', kind: 'product', title: 'Product' }, { id: 'offer', kind: 'offer', title: 'Offer' },
    { id: 'sibling-offer', kind: 'offer', title: 'Sibling' }, { id: 'job', kind: 'core_functional_job', title: 'Job' },
    { id: 'other-job', kind: 'related_job', title: 'Other job' }, { id: 'a', kind: 'desired_outcome', title: 'A' },
    { id: 'b', kind: 'desired_outcome', title: 'B' }, { id: 'c', kind: 'desired_outcome', title: 'C' },
    { id: 'fdo', kind: 'financial_desired_outcome', title: 'FDO' }, { id: 'touch', kind: 'touchpoint', title: 'Touch' },
    { id: 'unrelated-touch', kind: 'touchpoint', title: 'Unrelated' }, { id: 'repulsor', kind: 'repulsor', title: 'Repulsor' },
  ];
  return {
    id: 'map', title: 'Map', views: [{ id: 'view', title: 'View' }], entities,
    relationships: [
      { id: 'packages', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer' },
      { id: 'packages-sibling', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'sibling-offer' },
      { id: 'presents', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'touch' },
      { id: 'presents-unrelated', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'unrelated-touch' },
      { id: 'owns-a', kind: 'job_has_desired_outcome', jobId: 'job', desiredOutcomeId: 'a' },
      { id: 'owns-b', kind: 'job_has_desired_outcome', jobId: 'job', desiredOutcomeId: 'b' },
      { id: 'owns-c', kind: 'job_has_desired_outcome', jobId: 'job', desiredOutcomeId: 'c' },
      { id: 'resists-job', kind: 'repulsor_resists', repulsorId: 'repulsor', targetEntityId: 'job' },
      { id: 'resists-fdo', kind: 'repulsor_resists', repulsorId: 'repulsor', targetEntityId: 'fdo' },
      { id: 'mitigates', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor' },
    ],
    productJobIntents: [{ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['a', 'b'] }],
    offerJobSelections: [{ id: 'select', offerId: 'offer', productJobIntentId: 'intent' }, { id: 'select-sibling', offerId: 'sibling-offer', productJobIntentId: 'intent' }],
    offerFinancialIntents: [{ id: 'financial', offerId: 'offer', financialDesiredOutcomeId: 'fdo' }],
    touchpointJobSelections: [{ id: 'touch-job', touchpointId: 'touch', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['a'] }],
    touchpointFinancialSelections: [{ id: 'touch-financial', touchpointId: 'touch', offerId: 'offer', offerFinancialIntentId: 'financial', financialDesiredOutcomeId: 'fdo' }],
    touchpointContainers: [], epistemicAnnotations: [], placements: entities.map((entity, index) => ({ viewId: 'view', entityId: entity.id, x: index * 100, y: 0 })),
  };
}

it('Product <-> Job traces are symmetric and include exact addressed DO subset including an unimplemented outcome', () => {
  const document = fixture();
  const forward = deriveRelationLensTrace(document, 'product', 'job');
  expect(deriveRelationLensTrace(document, 'job', 'product')).toEqual(forward);
  expect(forward?.entityIds).toEqual(expect.arrayContaining(['product', 'job', 'a', 'b', 'offer', 'sibling-offer', 'touch']));
  expect(forward?.entityIds).not.toContain('c');
  expect(forward?.edgeIds).toEqual(expect.arrayContaining(['owns-a', 'owns-b', 'intent-route:a->touch']));
  expect(forward?.edgeIds).not.toContain('intent-route:b->touch');
});

it('Product Job lens includes only Touchpoints effectively using that intent and not generic neighbours', () => {
  const trace = deriveRelationLensTrace(fixture(), 'product', 'job')!;
  expect(trace.entityIds).not.toContain('unrelated-touch');
  expect(trace.edgeIds).not.toContain('presents-unrelated');
  expect(trace.entityIds).not.toContain('other-job');
});

it('Offer Job lens excludes sibling Offers', () => {
  const trace = deriveRelationLensTrace(fixture(), 'offer', 'job')!;
  expect(trace.entityIds).toContain('product'); expect(trace.entityIds).not.toContain('sibling-offer');
  expect(trace.edgeIds).toContain('packages'); expect(trace.edgeIds).not.toContain('packages-sibling');
});

it('Product and Offer DO lenses include only the concrete DO, not sibling DOs or Offers', () => {
  const product = deriveRelationLensTrace(fixture(), 'a', 'product')!;
  expect(product.entityIds).toContain('a'); expect(product.entityIds).not.toContain('b');
  const offer = deriveRelationLensTrace(fixture(), 'a', 'offer')!;
  expect(offer.entityIds).toEqual(expect.arrayContaining(['product', 'offer', 'job', 'a', 'touch']));
  expect(offer.entityIds).not.toEqual(expect.arrayContaining(['b', 'sibling-offer']));
});

it('FDO Offer lens excludes Product even when Product -> Offer exists', () => {
  const trace = deriveRelationLensTrace(fixture(), 'offer', 'fdo')!;
  expect(trace.entityIds).toEqual(expect.arrayContaining(['offer', 'fdo', 'touch']));
  expect(trace.entityIds).not.toContain('product'); expect(trace.edgeIds).not.toContain('packages');
});

it('Repulsor Product lens follows only Job exposure and retains manifestation and mitigation', () => {
  const trace = deriveRelationLensTrace(fixture(), 'repulsor', 'product')!;
  expect(trace.entityIds).toEqual(expect.arrayContaining(['repulsor', 'job', 'product', 'a', 'b', 'offer', 'touch']));
  expect(trace.entityIds).not.toContain('fdo');
  expect(trace.edgeIds).toEqual(expect.arrayContaining(['resists-job', 'repulsor-route:repulsor->touch', 'mitigates']));
});

it('Repulsor Offer lens unions Job and FDO exposure while an FDO-only path never leaks Product', () => {
  const both = deriveRelationLensTrace(fixture(), 'offer', 'repulsor')!;
  expect(both.entityIds).toEqual(expect.arrayContaining(['product', 'job', 'fdo', 'offer', 'repulsor']));
  const document = { ...fixture(), offerJobSelections: [], touchpointJobSelections: [] };
  const financialOnly = deriveRelationLensTrace(document, 'offer', 'repulsor')!;
  expect(financialOnly.entityIds).toEqual(expect.arrayContaining(['offer', 'fdo', 'repulsor', 'touch']));
  expect(financialOnly.entityIds).not.toContain('product');
});

it('trace edge set contains only IDs actually rendered by deriveMapEdges', () => {
  const document = fixture(); const rendered = new Set(deriveMapEdges(document).map(edge => edge.id));
  expect(deriveRelationLensTrace(document, 'offer', 'repulsor')!.edgeIds.every(id => rendered.has(id))).toBe(true);
});
