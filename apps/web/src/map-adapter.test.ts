import { expect, it } from 'vitest';
import { addEntity, addProductJobIntent, addTouchpointContainer, setOfferJobSelections, setTouchpointMitigations, createEmptyMapDocument, updateEntity } from '@vee/domain';
import { KIND_LABELS, deriveMapEdges, deriveMapNodes, deriveVisibleAuthoredRelationships, layoutForEntity } from './map-adapter';

function chain() { let d = createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' }); d = addEntity(d, { entityId: 'p', title: 'Product', kind: 'product', viewId: 'v', x: 0, y: 0 }); d = addEntity(d, { entityId: 'o', title: 'Offer', kind: 'offer', linkedProductId: 'p', relationshipId: 'po', viewId: 'v', x: 100, y: 0 }); d = addTouchpointContainer(d, { id: 'site', title: 'Site' }); d = addEntity(d, { entityId: 't', title: 'Touch', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['ot'], viewId: 'v', x: 200, y: 0 }); return d; }

function child(document = chain(), input: { id: string; parentId: string; offerIds?: string[]; offerRelationshipIds?: string[]; parentRelationshipId: string }) {
  const offerIds = input.offerIds ?? ['o'];
  return addEntity(document, { entityId: input.id, title: input.id, kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: offerIds, relationshipIds: input.offerRelationshipIds ?? offerIds.map(offerId => `${offerId}-${input.id}`), parentTouchpointId: input.parentId, parentRelationshipId: input.parentRelationshipId, viewId: 'v', x: 300, y: 0 });
}
function edgeIds(document: ReturnType<typeof chain>) { return deriveMapEdges(document).map(edge => edge.id); }

it('provides concrete labels for every Client-side root kind', () => {
  expect(KIND_LABELS).toMatchObject({
    core_functional_job: 'Core Functional Job',
    emotional_job: 'Emotional Job',
    social_job: 'Social Job',
    consumption_chain_job: 'Consumption Chain Job',
    financial_desired_outcome: 'Financial Desired Outcome',
  });
  expect(Object.values(KIND_LABELS)).not.toContain('Customer phenomenon');
});

it('renders Product to Offer and Offer to root Touchpoint edges using stable relationship IDs', () => {
  expect(deriveMapEdges(chain())).toEqual([
    expect.objectContaining({ id: 'po', source: 'p', target: 'o', markerEnd: { type: 'arrowclosed' } }),
    expect.objectContaining({ id: 'ot', source: 'o', target: 't', markerEnd: { type: 'arrowclosed' } }),
  ]);
  expect(deriveMapEdges(chain()).every(edge => edge.label === undefined)).toBe(true);
});
it('renders typed contextual Client relationships parent to child without inline labels', () => {
  let d = createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' });
  d = addEntity(d, { entityId: 'core', title: 'Core', kind: 'core_functional_job', viewId: 'v', x: 0, y: 0 });
  d = addEntity(d, { entityId: 'chain', title: 'Chain', kind: 'consumption_chain_job', viewId: 'v', x: 0, y: 100 });
  d = addEntity(d, { entityId: 'related', title: 'Related', kind: 'related_job', parentEntityId: 'core', relationshipId: 'related-edge', viewId: 'v', x: 200, y: 0 });
  d = addEntity(d, { entityId: 'outcome', title: 'Outcome', kind: 'desired_outcome', parentEntityId: 'chain', relationshipId: 'outcome-edge', viewId: 'v', x: 200, y: 100 });
  expect(deriveMapEdges(d)).toEqual([
    expect.objectContaining({ id: 'related-edge', source: 'core', target: 'related', markerEnd: { type: 'arrowclosed' } }),
    expect.objectContaining({ id: 'outcome-edge', source: 'chain', target: 'outcome', markerEnd: { type: 'arrowclosed' } }),
  ]);
  expect(deriveMapEdges(d).every(edge => edge.label === undefined)).toBe(true);
});
it('renders Repulsor resistance from Repulsor to its resisted Client target without an inline label', () => {
  let d = createEmptyMapDocument({ mapId: 'm', title: 'Map', viewId: 'v', viewTitle: 'View' });
  d = addEntity(d, { entityId: 'core', title: 'Core', kind: 'core_functional_job', viewId: 'v', x: 0, y: 0 });
  d = addEntity(d, { entityId: 'repulsor', title: 'Concern', kind: 'repulsor', resistedTargetIds: ['core'], relationshipIds: ['resists'], viewId: 'v', x: 200, y: 0 });
  expect(deriveMapEdges(d)).toEqual([expect.objectContaining({ id: 'resists', source: 'repulsor', target: 'core', markerEnd: { type: 'arrowclosed' } })]);
  expect(deriveMapEdges(d)[0]).not.toHaveProperty('label');
});
it('projects containment as the canonical visible path for a nested Touchpoint', () => {
  const d = child(chain(), { id: 'b', parentId: 't', offerRelationshipIds: ['ob'], parentRelationshipId: 'tb' });
  expect(edgeIds(d)).toEqual(['po', 'ot', 'tb']);
  expect(d.relationships).toContainEqual({ id: 'ob', kind: 'offer_presented_at_touchpoint', offerId: 'o', touchpointId: 'b' });
});
it('projects deep Touchpoint nesting without redundant Offer edges', () => {
  let d = child(chain(), { id: 'b', parentId: 't', offerRelationshipIds: ['ob'], parentRelationshipId: 'tb' });
  d = child(d, { id: 'c', parentId: 'b', offerRelationshipIds: ['oc'], parentRelationshipId: 'bc' });
  expect(edgeIds(d)).toEqual(['po', 'ot', 'tb', 'bc']);
});
it('makes the existing Offer edge visible again when a Touchpoint parent is removed', () => {
  const nested = child(chain(), { id: 'b', parentId: 't', offerRelationshipIds: ['ob'], parentRelationshipId: 'tb' });
  const root = updateEntity(nested, { entityId: 'b', title: 'b', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['ob'] });
  expect(edgeIds(nested)).toEqual(['po', 'ot', 'tb']);
  expect(edgeIds(root)).toEqual(['po', 'ot', 'ob']);
});
it('derives a reparented Touchpoint from the current document without stale edges', () => {
  let d = child(chain(), { id: 'c', parentId: 't', offerRelationshipIds: ['oc'], parentRelationshipId: 'tc' });
  d = child(d, { id: 'b', parentId: 't', offerRelationshipIds: ['ob'], parentRelationshipId: 'tb' });
  const reparented = updateEntity(d, { entityId: 'b', title: 'b', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['ob'], parentTouchpointId: 'c', parentRelationshipId: 'tb' });
  expect(deriveMapEdges(reparented)).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'tb', source: 'c', target: 'b', markerEnd: { type: 'arrowclosed' } })]));
  expect(deriveMapEdges(reparented).find(edge => edge.id === 'tb')).not.toHaveProperty('label');
  expect(deriveMapEdges(reparented)).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'tb', source: 't', target: 'b' })]));
});
it('preserves multiple nested Offer links in MapDocument while omitting them from authored edges', () => {
  let d = addEntity(chain(), { entityId: 'o2', title: 'Offer 2', kind: 'offer', linkedProductId: 'p', relationshipId: 'po2', viewId: 'v', x: 100, y: 100 });
  d = child(d, { id: 'b', parentId: 't', offerIds: ['o', 'o2'], offerRelationshipIds: ['ob', 'o2b'], parentRelationshipId: 'tb' });
  expect(d.relationships.filter(relationship => relationship.kind === 'offer_presented_at_touchpoint' && relationship.touchpointId === 'b').map(relationship => relationship.id)).toEqual(['ob', 'o2b']);
  expect(edgeIds(d)).toEqual(['po', 'ot', 'po2', 'tb']);
});
it('derives authored relationships and React Flow edges without mutating MapDocument', () => {
  const d = child(chain(), { id: 'b', parentId: 't', offerRelationshipIds: ['ob'], parentRelationshipId: 'tb' });
  const snapshot = structuredClone(d);
  deriveVisibleAuthoredRelationships(d); deriveMapEdges(d); deriveMapNodes(d, 'v', 'o');
  expect(d).toEqual(snapshot);
});
it('derives stable authored-map layout from semantic role', () => {
  expect(layoutForEntity({ kind: 'product', title: 'Product' })).toEqual({ diameter: 136, titleFontSize: 16, kindFontSize: 13, contentWidth: 92, compactTitle: false });
  expect(layoutForEntity({ kind: 'offer', title: 'Offer' })).toEqual({ diameter: 116, titleFontSize: 15, kindFontSize: 12.5, contentWidth: 79, compactTitle: false });
  expect(layoutForEntity({ kind: 'touchpoint', title: 'Touchpoint' })).toEqual({ diameter: 96, titleFontSize: 14, kindFontSize: 12, contentWidth: 65, compactTitle: false });
  expect(layoutForEntity({ kind: 'core_functional_job', title: 'A Job' })).toEqual({ diameter: 116, titleFontSize: 15, kindFontSize: 12.5, contentWidth: 79, compactTitle: false });
});
it('keeps ancestor and Touchpoint sizes stable as descendants and siblings are added', () => {
  let d = chain();
  const initial = deriveMapNodes(d, 'v', null);
  expect(initial.map(node => [node.id, node.width])).toEqual([['p', 136], ['o', 116], ['t', 96]]);
  d = addEntity(d, { entityId: 't2', title: 'Sibling', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['ot2'], viewId: 'v', x: 0, y: 0 });
  d = addEntity(d, { entityId: 'child', title: 'Child', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['oc'], parentTouchpointId: 't', parentRelationshipId: 'tc', viewId: 'v', x: 0, y: 0 });
  d = addEntity(d, { entityId: 'child2', title: 'Child sibling', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['o'], relationshipIds: ['oc2'], parentTouchpointId: 't', parentRelationshipId: 'tc2', viewId: 'v', x: 0, y: 0 });
  expect(deriveMapNodes(d, 'v', null).map(node => [node.id, node.width])).toEqual([['p', 136], ['o', 116], ['t', 96], ['t2', 96], ['child', 96], ['child2', 96]]);
});
it('bounds long-title content independently of topology', () => {
  const short = layoutForEntity({ kind: 'offer', title: 'Team' });
  const long = layoutForEntity({ kind: 'offer', title: 'Growth Marketing Team' });
  expect(long).toEqual({ ...short, compactTitle: true });
  expect(long.contentWidth).toBeLessThan(long.diameter);
});

it('projects each authored Desired Outcome route once and invents no unresolved Job route', () => {
  let d = chain();
  d = addEntity(d, { entityId: 'job', title: 'Job', kind: 'core_functional_job', viewId: 'v', x: 0, y: 100 });
  d = addEntity(d, { entityId: 'outcome', title: 'Outcome', kind: 'desired_outcome', parentEntityId: 'job', relationshipId: 'job-outcome', viewId: 'v', x: 100, y: 100 });
  d = addEntity(d, { entityId: 'emotional', title: 'Emotional', kind: 'emotional_job', viewId: 'v', x: 0, y: 200 });
  d = addProductJobIntent(d, { id: 'route-intent', productId: 'p', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] });
  d = addProductJobIntent(d, { id: 'unresolved-intent', productId: 'p', jobId: 'emotional', addressedDesiredOutcomeIds: [] });
  d = setOfferJobSelections(d, { offerId: 'o', productJobIntentIds: ['route-intent', 'unresolved-intent'], newSelectionIds: ['selected-route', 'selected-unresolved'] });
  d = addEntity(d, { entityId: 'o2', title: 'Offer 2', kind: 'offer', linkedProductId: 'p', relationshipId: 'po2', viewId: 'v', x: 100, y: 200 });
  d = setOfferJobSelections(d, { offerId: 'o2', productJobIntentIds: ['route-intent'], newSelectionIds: ['selected-again'] });
  d = updateEntity(d, { entityId: 't', title: 'Touch', locatedInId: 'site', linkedOfferIds: ['o', 'o2'], relationshipIds: ['ot', 'o2t'] });
  const edges = deriveMapEdges(d);
  expect(edges.filter(edge => edge.source === 'outcome' && edge.target === 't')).toHaveLength(1);
  expect(edges).toContainEqual(expect.objectContaining({ id: 'job-outcome', source: 'job', target: 'outcome' }));
  expect(edges.some(edge => ['p', 'o', 'o2', 'emotional', 'job'].includes(edge.source) && edge.target === 't' && edge.id.startsWith('intent-route:'))).toBe(false);
});


it('renders one unlabeled authored Touchpoint to Repulsor mitigation edge', () => {
  let d = chain();
  d = addEntity(d, { entityId: 'job', title: 'Job', kind: 'core_functional_job', viewId: 'v', x: 0, y: 100 });
  d = addProductJobIntent(d, { id: 'intent', productId: 'p', jobId: 'job', addressedDesiredOutcomeIds: [] });
  d = setOfferJobSelections(d, { offerId: 'o', productJobIntentIds: ['intent'], newSelectionIds: ['selection'] });
  d = addEntity(d, { entityId: 'repulsor', title: 'Fear', kind: 'repulsor', resistedTargetIds: ['job'], relationshipIds: ['resists'], viewId: 'v', x: 300, y: 100 });
  d = setTouchpointMitigations(d, { touchpointId: 't', repulsorIds: ['repulsor'], newRelationshipIds: ['mitigates'] });
  const edge = deriveMapEdges(d).filter(candidate => candidate.source === 't' && candidate.target === 'repulsor');
  expect(edge).toEqual([expect.objectContaining({ id: 'mitigates', markerEnd: { type: 'arrowclosed' }, className: 'map-edge' })]);
  expect(edge[0]!.label).toBeUndefined();
});
