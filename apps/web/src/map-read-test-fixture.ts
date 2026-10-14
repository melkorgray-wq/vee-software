import { normalizeLegacyJobs, setFinancialDesiredOutcomeJobContexts, setJobContextualParents, type MapDocument } from '@vee/domain';

/** Synthetic committed graph shared by the three Map read compatibility suites. */
export function legacyMapReadFixture(): MapDocument {
  const entities: MapDocument['entities'] = [
    { id: 'p', kind: 'product', title: 'Product' },
    { id: 'o', kind: 'offer', title: 'Offer', currentContentSource: null },
    { id: 'o2', kind: 'offer', title: 'Second Offer', currentContentSource: null },
    { id: 't', kind: 'touchpoint', title: 'Touchpoint' },
    { id: 'child', kind: 'touchpoint', title: 'Child Touchpoint' },
    { id: 'j', kind: 'core_functional_job', title: 'Functional activity' },
    { id: 'rj', kind: 'related_job', title: 'Related activity' },
    { id: 'ej', kind: 'emotional_job', title: 'Emotional activity' },
    { id: 'sj', kind: 'social_job', title: 'Social activity' },
    { id: 'ccj', kind: 'consumption_chain_job', title: 'Consumption activity' },
    { id: 'a', kind: 'desired_outcome', title: 'Outcome A' },
    { id: 'b', kind: 'desired_outcome', title: 'Outcome B' },
    { id: 'e-do', kind: 'desired_outcome', title: 'Emotional outcome' },
    { id: 's-do', kind: 'desired_outcome', title: 'Social outcome' },
    { id: 'c-do', kind: 'desired_outcome', title: 'Consumption outcome' },
    { id: 'f', kind: 'financial_desired_outcome', title: 'Financial criterion' },
    { id: 'unselected-f', kind: 'financial_desired_outcome', title: 'Unselected criterion' },
    { id: 'rep', kind: 'repulsor', title: 'Concern' },
    { id: 'f-rep', kind: 'repulsor', title: 'Financial concern' },
  ];
  return {
    id: 'm', title: 'Map', entities,
    relationships: [
      { id: 'po', kind: 'product_packaged_as_offer', productId: 'p', offerId: 'o' },
      { id: 'po2', kind: 'product_packaged_as_offer', productId: 'p', offerId: 'o2' },
      { id: 'ot', kind: 'offer_presented_at_touchpoint', offerId: 'o', touchpointId: 't' },
      { id: 'o2t', kind: 'offer_presented_at_touchpoint', offerId: 'o2', touchpointId: 't' },
      { id: 'oc', kind: 'offer_presented_at_touchpoint', offerId: 'o', touchpointId: 'child' },
      { id: 'tc', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 't', childTouchpointId: 'child' },
      { id: 'j-rj', kind: 'core_functional_job_has_related_job', coreFunctionalJobId: 'j', relatedJobId: 'rj' },
      { id: 'j-ej', kind: 'core_functional_job_contextualizes_job', coreFunctionalJobId: 'j', contextualJobId: 'ej' },
      { id: 'j-a', kind: 'job_has_desired_outcome', jobId: 'j', desiredOutcomeId: 'a' },
      { id: 'j-b', kind: 'job_has_desired_outcome', jobId: 'j', desiredOutcomeId: 'b' },
      { id: 'e-owns', kind: 'job_has_desired_outcome', jobId: 'ej', desiredOutcomeId: 'e-do' },
      { id: 's-owns', kind: 'job_has_desired_outcome', jobId: 'sj', desiredOutcomeId: 's-do' },
      { id: 'c-owns', kind: 'job_has_desired_outcome', jobId: 'ccj', desiredOutcomeId: 'c-do' },
      { id: 'resists', kind: 'repulsor_resists', repulsorId: 'rep', targetEntityId: 'j' },
      { id: 'f-resists', kind: 'repulsor_resists', repulsorId: 'f-rep', targetEntityId: 'f' },
      { id: 'mitigates', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'child', repulsorId: 'rep' },
    ],
    productJobIntents: [
      { id: 'pi', productId: 'p', jobId: 'j', addressedDesiredOutcomeIds: ['a', 'b'] },
      { id: 'pri', productId: 'p', jobId: 'rj', addressedDesiredOutcomeIds: [] },
      { id: 'pei', productId: 'p', jobId: 'ej', addressedDesiredOutcomeIds: [] },
      { id: 'psi', productId: 'p', jobId: 'sj', addressedDesiredOutcomeIds: ['s-do'] },
      { id: 'pci', productId: 'p', jobId: 'ccj', addressedDesiredOutcomeIds: ['c-do'] },
    ],
    offerJobSelections: [
      { id: 'os', offerId: 'o', productJobIntentId: 'pi', addressedDesiredOutcomeIds: ['a'] },
      { id: 'os2', offerId: 'o2', productJobIntentId: 'pi' },
      { id: 'ers', offerId: 'o', productJobIntentId: 'pei', addressedDesiredOutcomeIds: [] },
      { id: 'ss', offerId: 'o', productJobIntentId: 'psi', addressedDesiredOutcomeIds: ['s-do'] },
      { id: 'cs', offerId: 'o', productJobIntentId: 'pci', addressedDesiredOutcomeIds: ['c-do'] },
    ],
    touchpointJobSelections: [
      { id: 'ts', touchpointId: 't', offerId: 'o', productJobIntentId: 'pi', addressedDesiredOutcomeIds: ['a'] },
      { id: 'ts2', touchpointId: 't', offerId: 'o2', productJobIntentId: 'pi', addressedDesiredOutcomeIds: ['a'] },
      { id: 'child-s', touchpointId: 'child', offerId: 'o', productJobIntentId: 'pi', addressedDesiredOutcomeIds: ['a'] },
      { id: 'ets', touchpointId: 't', offerId: 'o', productJobIntentId: 'pei', addressedDesiredOutcomeIds: [] },
      { id: 'sts', touchpointId: 't', offerId: 'o', productJobIntentId: 'psi', addressedDesiredOutcomeIds: ['s-do'] },
      { id: 'cts', touchpointId: 't', offerId: 'o', productJobIntentId: 'pci', addressedDesiredOutcomeIds: ['c-do'] },
    ],
    offerFinancialIntents: [{ id: 'fi', offerId: 'o', financialDesiredOutcomeId: 'f' }],
    touchpointFinancialSelections: [{ id: 'fs', touchpointId: 'child', offerId: 'o', offerFinancialIntentId: 'fi', financialDesiredOutcomeId: 'f' }],
    touchpointContainers: [], epistemicAnnotations: [{ id: 'note', subjectEntityId: 'j', status: 'hypothesis', sourceNote: 'Synthetic fixture' }],
    views: [{ id: 'v', title: 'View' }], placements: entities.map((entity, index) => ({ viewId: 'v', entityId: entity.id, x: index * 150, y: 50 })),
  };
}

export function canonicalMapReadFixture() {
  let document = normalizeLegacyJobs(legacyMapReadFixture());
  document = setJobContextualParents(document, { targetJobId: 'sj', parentJobIds: ['ej', 'j'], newRelationshipIds: ['e-s', 'j-s'] });
  document = setJobContextualParents(document, { targetJobId: 'ccj', parentJobIds: ['sj'], newRelationshipIds: ['s-c'] });
  return setFinancialDesiredOutcomeJobContexts(document, { financialDesiredOutcomeId: 'unselected-f', jobIds: ['j', 'ej', 'sj', 'ccj'], newRelationshipIds: ['j-f', 'e-f', 's-f', 'c-f'] });
}

export function freezeMapReadFixture<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeMapReadFixture); Object.freeze(value); }
  return value;
}
