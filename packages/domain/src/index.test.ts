import { describe, expect, it } from 'vitest';
import { CLIENT_ROOT_ENTITY_KINDS, addEntity, addProductJobIntent, removeProductJobIntent, setOfferJobSelections, setContextualCoreFunctionalJobs, setOfferFinancialIntents, updateProductJobIntent, addTouchpointContainer, createEmptyMapDocument, duplicateEntity, movePlacement, updateEntity, updateRepulsorTargets, authorTouchpointIntentBottomUp, selectAllLinkedOfferIntentsForTouchpoint, setTouchpointIntentSelections, getIntentRemovalImpact, removeOfferIntentConfirmed, distributeProductJobIntent, distributeOfferJobIntent, resistanceImpactForOffer, resistanceImpactForProduct } from './index';

const place = { viewId: 'view', x: 10, y: 20 };
const empty = () => createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' });
function offerDocument() { let d = addEntity(empty(), { ...place, entityId: 'product', title: 'Orbit', kind: 'product' }); d = addEntity(d, { ...place, entityId: 'offer', title: 'Subscription', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged' }); return addTouchpointContainer(d, { id: 'site', title: 'The Quiet Orbit website' }); }
function touchpoint(d = offerDocument(), id = 'touch', parent?: string) { return addEntity(d, { ...place, entityId: id, title: id, kind: 'touchpoint', locatedInId: 'site', url: '  /checkout#pay  ', linkedOfferIds: ['offer'], relationshipIds: [`presented-${id}`], ...(parent ? { parentTouchpointId: parent, parentRelationshipId: `contains-${id}` } : {}) }); }

describe('map authoring domain', () => {
  it.each(CLIENT_ROOT_ENTITY_KINDS)('adds and duplicates independent %s roots without relationships or annotations', kind => {
    const business = addEntity(empty(), { ...place, entityId: 'product', title: 'Unrelated Product', kind: 'product' });
    const created = addEntity(business, { ...place, entityId: kind, title: `A ${kind}`, kind });
    expect(created.entities.at(-1)).toEqual({ id: kind, title: `A ${kind}`, kind });
    expect(created.placements.at(-1)).toEqual({ entityId: kind, ...place });
    expect(created.relationships).toEqual([]);
    expect(created.epistemicAnnotations).toEqual([]);

    const annotated = { ...created, epistemicAnnotations: [{ id: 'knowledge', subjectEntityId: kind, status: 'hypothesis' as const }] };
    const copy = duplicateEntity(annotated, { sourceEntityId: kind, entityId: `${kind}-copy`, viewId: 'view', x: 30, y: 40, relationshipIds: [] });
    expect(copy.entities.at(-1)).toEqual({ id: `${kind}-copy`, title: `A ${kind}`, kind });
    expect(copy.relationships).toEqual([]);
    expect(copy.epistemicAnnotations).toEqual(annotated.epistemicAnnotations);
    expect(copy.epistemicAnnotations.some(annotation => annotation.subjectEntityId === `${kind}-copy`)).toBe(false);
  });
  it('authors only the accepted contextual Client parent relationships transactionally', () => {
    let d = addEntity(empty(), { ...place, entityId: 'core', title: 'Core', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'chain', title: 'Chain', kind: 'consumption_chain_job' });
    d = addEntity(d, { ...place, entityId: 'related', title: 'Related', kind: 'related_job', parentEntityId: 'core', relationshipId: 'core-related' });
    d = addEntity(d, { ...place, entityId: 'core-outcome', title: 'Core outcome', kind: 'desired_outcome', parentEntityId: 'core', relationshipId: 'core-outcome-edge' });
    d = addEntity(d, { ...place, entityId: 'chain-outcome', title: 'Chain outcome', kind: 'desired_outcome', parentEntityId: 'chain', relationshipId: 'chain-outcome-edge' });
    expect(d.relationships.slice(-3)).toEqual([
      { id: 'core-related', kind: 'core_functional_job_has_related_job', coreFunctionalJobId: 'core', relatedJobId: 'related' },
      { id: 'core-outcome-edge', kind: 'job_has_desired_outcome', jobId: 'core', desiredOutcomeId: 'core-outcome' },
      { id: 'chain-outcome-edge', kind: 'job_has_desired_outcome', jobId: 'chain', desiredOutcomeId: 'chain-outcome' },
    ]);
    expect(d.placements.filter(p => ['related', 'core-outcome', 'chain-outcome'].includes(p.entityId))).toHaveLength(3);
  });
  it('rejects orphaned contextual entities and every invalid parent type', () => {
    let d = empty();
    for (const kind of ['emotional_job', 'social_job', 'financial_desired_outcome'] as const) d = addEntity(d, { ...place, entityId: kind, title: kind, kind });
    d = addEntity(d, { ...place, entityId: 'product-parent', title: 'Product', kind: 'product' });
    d = addEntity(d, { ...place, entityId: 'offer-parent', title: 'Offer', kind: 'offer', linkedProductId: 'product-parent', relationshipId: 'po' });
    d = addEntity(d, { ...place, entityId: 'core', title: 'Core', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'related-parent', title: 'Related', kind: 'related_job', parentEntityId: 'core', relationshipId: 'cr' });
    expect(() => addEntity(d, { ...place, entityId: 'orphan', title: 'Orphan', kind: 'related_job' } as Parameters<typeof addEntity>[1])).toThrow();
    for (const parentEntityId of ['emotional_job', 'offer-parent']) expect(() => addEntity(d, { ...place, entityId: `related-${parentEntityId}`, title: 'Invalid', kind: 'related_job', parentEntityId, relationshipId: `r-${parentEntityId}` })).toThrow('core functional');
    for (const parentEntityId of ['social_job', 'financial_desired_outcome', 'product-parent']) expect(() => addEntity(d, { ...place, entityId: `outcome-${parentEntityId}`, title: 'Invalid', kind: 'desired_outcome', parentEntityId, relationshipId: `o-${parentEntityId}` })).toThrow('functional Job');
  });
  it('reparents contextual Client entities only to valid parents and preserves exactly one relation', () => {
    let d = addEntity(empty(), { ...place, entityId: 'core-a', title: 'A', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'core-b', title: 'B', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'chain', title: 'Chain', kind: 'consumption_chain_job' });
    d = addEntity(d, { ...place, entityId: 'related', title: 'Related', kind: 'related_job', parentEntityId: 'core-a', relationshipId: 'related-edge' });
    d = addEntity(d, { ...place, entityId: 'outcome', title: 'Outcome', kind: 'desired_outcome', parentEntityId: 'core-a', relationshipId: 'outcome-edge' });
    const movedRelated = updateEntity(d, { entityId: 'related', title: 'Related', parentEntityId: 'core-b' });
    const movedOutcome = updateEntity(movedRelated, { entityId: 'outcome', title: 'Outcome', parentEntityId: 'chain' });
    expect(movedOutcome.relationships).toContainEqual({ id: 'related-edge', kind: 'core_functional_job_has_related_job', coreFunctionalJobId: 'core-b', relatedJobId: 'related' });
    expect(movedOutcome.relationships).toContainEqual({ id: 'outcome-edge', kind: 'job_has_desired_outcome', jobId: 'chain', desiredOutcomeId: 'outcome' });
    expect(() => updateEntity(d, { entityId: 'related', title: 'Related', parentEntityId: 'chain' })).toThrow('Invalid semantic parent');
    expect(updateEntity(d, { entityId: 'outcome', title: 'Outcome', parentEntityId: 'related' }).relationships).toContainEqual({ id: 'outcome-edge', kind: 'job_has_desired_outcome', jobId: 'related', desiredOutcomeId: 'outcome' });
    const invalid = { ...d, relationships: [...d.relationships, { id: 'extra', kind: 'job_has_desired_outcome' as const, jobId: 'core-b', desiredOutcomeId: 'outcome' }] };
    expect(() => updateEntity(invalid, { entityId: 'outcome', title: 'Outcome', parentEntityId: 'core-b' })).toThrow('exactly one');
  });
  it.each(['related_job', 'desired_outcome'] as const)('duplicates %s with its semantic parent, a fresh relation, and no copied annotation', kind => {
    let d = addEntity(empty(), { ...place, entityId: 'core', title: 'Core', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'source', title: 'Source', kind, parentEntityId: 'core', relationshipId: 'original-edge' });
    d = { ...d, epistemicAnnotations: [{ id: 'knowledge', subjectEntityId: 'source', status: 'hypothesis' }] };
    const copy = duplicateEntity(d, { sourceEntityId: 'source', entityId: 'copy', viewId: 'view', x: 50, y: 60, relationshipIds: ['copy-edge'] });
    expect(copy.entities.at(-1)).toMatchObject({ id: 'copy', kind, title: 'Source' });
    expect(copy.relationships.at(-1)).toMatchObject({ id: 'copy-edge', ...(kind === 'related_job' ? { coreFunctionalJobId: 'core', relatedJobId: 'copy' } : { jobId: 'core', desiredOutcomeId: 'copy' }) });
    expect(copy.epistemicAnnotations.some(annotation => annotation.subjectEntityId === 'copy')).toBe(false);
  });
  it('creates reusable containers and requires a valid reference', () => {
    const d = offerDocument(); expect(d.touchpointContainers).toEqual([{ id: 'site', title: 'The Quiet Orbit website' }]);
    expect(() => touchpoint({ ...d, touchpointContainers: [] })).toThrow('existing Touchpoint container');
    expect(() => addTouchpointContainer(d, { id: 'other', title: ' the quiet orbit WEBSITE ' })).toThrow('matching');
  });
  it('stores a trimmed optional URL without using it as identity', () => {
    const d = touchpoint(); expect(d.entities.at(-1)).toMatchObject({ id: 'touch', locatedInId: 'site', url: '/checkout#pay' });
    const noUrl = addEntity(offerDocument(), { ...place, entityId: 'offline', title: 'Booth', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['offer'], relationshipIds: ['presented'] }); expect(noUrl.entities.at(-1)).not.toHaveProperty('url');
  });
  it('allows lightweight Touchpoint creation with only its Offer relationship', () => {
    const d = addEntity(offerDocument(), { ...place, entityId: 'lightweight', title: 'Checkout', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['presented'] });
    expect(d.entities.at(-1)).toEqual({ id: 'lightweight', title: 'Checkout', kind: 'touchpoint' });
    expect(d.relationships.at(-1)).toEqual({ id: 'presented', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'lightweight' });
    expect(d.touchpointJobSelections).toEqual([]); expect(d.touchpointFinancialSelections).toEqual([]);
    expect(d.relationships.some(relation => relation.kind === 'touchpoint_mitigates_repulsor')).toBe(false);
  });
  it('creates valid containment and permits multiple children', () => {
    let d = touchpoint(); d = touchpoint(d, 'child-a', 'touch'); d = touchpoint(d, 'child-b', 'touch');
    expect(d.relationships.filter(r => r.kind === 'touchpoint_contains_touchpoint')).toEqual([
      { id: 'contains-child-a', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'touch', childTouchpointId: 'child-a' },
      { id: 'contains-child-b', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'touch', childTouchpointId: 'child-b' },
    ]);
    expect(d.relationships.filter(r => r.kind === 'offer_presented_at_touchpoint' && r.touchpointId === 'child-a')).toHaveLength(1);
  });
  it('enforces one parent, rejects self-parenting, and rejects cycles', () => {
    let d = touchpoint(); d = touchpoint(d, 'child', 'touch'); d = touchpoint(d, 'other');
    const current = d.relationships.filter(r => r.kind === 'offer_presented_at_touchpoint' && r.touchpointId === 'child').map(r => r.id);
    const moved = updateEntity(d, { entityId: 'child', title: 'child', locatedInId: 'site', linkedOfferIds: ['offer'], relationshipIds: current, parentTouchpointId: 'other', parentRelationshipId: 'new-parent' });
    expect(moved.relationships.filter(r => r.kind === 'touchpoint_contains_touchpoint' && r.childTouchpointId === 'child')).toHaveLength(1);
    expect(() => updateEntity(d, { entityId: 'touch', title: 'touch', locatedInId: 'site', linkedOfferIds: ['offer'], relationshipIds: ['presented-touch'], parentTouchpointId: 'touch', parentRelationshipId: 'self' })).toThrow('cannot contain itself');
    expect(() => updateEntity(d, { entityId: 'touch', title: 'touch', locatedInId: 'site', linkedOfferIds: ['offer'], relationshipIds: ['presented-touch'], parentTouchpointId: 'child', parentRelationshipId: 'cycle' })).toThrow('cycle');
  });
  it('duplicates authored relations with new IDs but no annotations or descendants', () => {
    let d = touchpoint(); d = touchpoint(d, 'child', 'touch'); d = { ...d, epistemicAnnotations: [{ id: 'knowledge', subjectEntityId: 'child', status: 'observed' }] };
    const copy = duplicateEntity(d, { sourceEntityId: 'child', entityId: 'copy', viewId: 'view', x: 50, y: 60, relationshipIds: ['copy-offer', 'copy-parent'] });
    expect(copy.entities.find(e => e.id === 'copy')).toMatchObject({ kind: 'touchpoint', locatedInId: 'site', url: '/checkout#pay' });
    expect(copy.relationships).toContainEqual({ id: 'copy-parent', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'touch', childTouchpointId: 'copy' });
    expect(copy.epistemicAnnotations).toEqual(d.epistemicAnnotations); expect(copy.epistemicAnnotations.some(a => a.subjectEntityId === 'copy')).toBe(false);
  });
  it('moves view placement without changing semantic records', () => { const before = addEntity(empty(), { ...place, entityId: 'p', title: 'P', kind: 'product' }); const after = movePlacement(before, { entityId: 'p', viewId: 'view', x: 30, y: 40 }); expect(after.entities).toBe(before.entities); expect(after.placements[0]).toMatchObject({ x: 30, y: 40 }); });
  describe('Repulsor semantics', () => {
    function targets() {
      let d = empty();
      for (const [id, kind] of [
        ['core', 'core_functional_job'], ['chain', 'consumption_chain_job'], ['emotional', 'emotional_job'],
        ['social', 'social_job'], ['financial', 'financial_desired_outcome'],
      ] as const) d = addEntity(d, { ...place, entityId: id, title: id, kind });
      return d;
    }
    it('transactionally creates one- and many-target Repulsors in semantic direction', () => {
      const one = addEntity(targets(), { ...place, entityId: 'r', title: 'Resistance', kind: 'repulsor', resistedTargetIds: ['financial'], relationshipIds: ['rr-financial'] });
      expect(one.relationships).toContainEqual({ id: 'rr-financial', kind: 'repulsor_resists', repulsorId: 'r', targetEntityId: 'financial' });
      const many = addEntity(targets(), { ...place, entityId: 'r', title: 'Resistance', kind: 'repulsor', resistedTargetIds: ['core', 'chain', 'emotional', 'social', 'financial'], relationshipIds: ['a', 'b', 'c', 'd', 'e'] });
      expect(many.relationships.filter(r => r.kind === 'repulsor_resists')).toHaveLength(5);
      expect(many.placements).toContainEqual({ viewId: 'view', entityId: 'r', x: 10, y: 20 });
    });
    it('rejects zero, duplicate, unknown, and every disallowed target kind', () => {
      expect(() => addEntity(targets(), { ...place, entityId: 'r', title: 'R', kind: 'repulsor', resistedTargetIds: [], relationshipIds: [] })).toThrow('at least one');
      expect(() => addEntity(targets(), { ...place, entityId: 'r', title: 'R', kind: 'repulsor', resistedTargetIds: ['core', 'core'], relationshipIds: ['a', 'b'] })).toThrow('unique');
      expect(() => addEntity(targets(), { ...place, entityId: 'r', title: 'R', kind: 'repulsor', resistedTargetIds: ['missing'], relationshipIds: ['a'] })).toThrow('existing entity');
      let d = targets();
      d = addEntity(d, { ...place, entityId: 'product', title: 'P', kind: 'product' });
      d = addEntity(d, { ...place, entityId: 'offer', title: 'O', kind: 'offer', linkedProductId: 'product', relationshipId: 'po' });
      d = addTouchpointContainer(d, { id: 'site', title: 'Site' });
      d = addEntity(d, { ...place, entityId: 'touch', title: 'T', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['offer'], relationshipIds: ['ot'] });
      d = addEntity(d, { ...place, entityId: 'related', title: 'RJ', kind: 'related_job', parentEntityId: 'core', relationshipId: 'cr' });
      d = addEntity(d, { ...place, entityId: 'outcome', title: 'DO', kind: 'desired_outcome', parentEntityId: 'core', relationshipId: 'cd' });
      d = addEntity(d, { ...place, entityId: 'other-r', title: 'R', kind: 'repulsor', resistedTargetIds: ['core'], relationshipIds: ['rc'] });
      for (const id of ['product', 'offer', 'touch', 'outcome', 'other-r']) expect(() => addEntity(d, { ...place, entityId: `bad-${id}`, title: 'Bad', kind: 'repulsor', resistedTargetIds: [id], relationshipIds: [`bad-rel-${id}`] })).toThrow('eligible Client-side');
    });
    it('updates targets while preserving retained relation IDs and assigning fresh IDs', () => {
      const created = addEntity(targets(), { ...place, entityId: 'r', title: 'R', kind: 'repulsor', resistedTargetIds: ['core', 'chain'], relationshipIds: ['keep-core', 'remove-chain'] });
      const updated = updateRepulsorTargets(created, { repulsorId: 'r', targetEntityIds: ['core', 'financial'], newRelationshipIds: ['add-financial'] });
      expect(updated.relationships.filter(r => r.kind === 'repulsor_resists')).toEqual([
        { id: 'keep-core', kind: 'repulsor_resists', repulsorId: 'r', targetEntityId: 'core' },
        { id: 'add-financial', kind: 'repulsor_resists', repulsorId: 'r', targetEntityId: 'financial' },
      ]);
      expect(() => updateRepulsorTargets(updated, { repulsorId: 'r', targetEntityIds: [], newRelationshipIds: [] })).toThrow('at least one');
      expect(() => updateRepulsorTargets(updated, { repulsorId: 'r', targetEntityIds: ['core', 'core'], newRelationshipIds: [] })).toThrow('unique');
    });
    it('duplicates the target set with fresh IDs and without epistemic annotation', () => {
      let d = addEntity(targets(), { ...place, entityId: 'r', title: 'R', kind: 'repulsor', resistedTargetIds: ['core', 'financial'], relationshipIds: ['old-a', 'old-b'] });
      d = { ...d, epistemicAnnotations: [{ id: 'note', subjectEntityId: 'r', status: 'hypothesis' }] };
      const copy = duplicateEntity(d, { sourceEntityId: 'r', entityId: 'copy', viewId: 'view', x: 50, y: 60, relationshipIds: ['new-a', 'new-b'] });
      expect(copy.entities.find(e => e.id === 'copy')).toEqual({ id: 'copy', title: 'R', kind: 'repulsor' });
      expect(copy.relationships.filter(r => r.kind === 'repulsor_resists' && r.repulsorId === 'copy')).toEqual([
        { id: 'new-a', kind: 'repulsor_resists', repulsorId: 'copy', targetEntityId: 'core' },
        { id: 'new-b', kind: 'repulsor_resists', repulsorId: 'copy', targetEntityId: 'financial' },
      ]);
      expect(copy.epistemicAnnotations).toEqual(d.epistemicAnnotations);
      expect(copy.epistemicAnnotations.some(a => a.subjectEntityId === 'copy')).toBe(false);
    });
  });
  describe('Job-centered Product and Offer intent', () => {
    function intentDocument() {
      let d = addEntity(empty(), { ...place, entityId: 'product', title: 'Product', kind: 'product' });
      for (const [id, kind] of [['core', 'core_functional_job'], ['chain', 'consumption_chain_job'], ['emotional', 'emotional_job'], ['social', 'social_job']] as const) d = addEntity(d, { ...place, entityId: id, title: id, kind });
      d = addEntity(d, { ...place, entityId: 'outcome', title: 'Outcome', kind: 'desired_outcome', parentEntityId: 'core', relationshipId: 'core-outcome' });
      d = addEntity(d, { ...place, entityId: 'other-outcome', title: 'Other', kind: 'desired_outcome', parentEntityId: 'chain', relationshipId: 'chain-outcome' });
      return d;
    }
    it('accepts eligible Jobs, enforces outcome ownership, and rejects duplicates and invalid kinds', () => {
      const d = addProductJobIntent(intentDocument(), { id: 'intent', productId: 'product', jobId: 'core', addressedDesiredOutcomeIds: ['outcome'] });
      expect(d.productJobIntents[0]).toMatchObject({ jobId: 'core', addressedDesiredOutcomeIds: ['outcome'] });
      expect(() => addProductJobIntent(d, { id: 'duplicate', productId: 'product', jobId: 'core', addressedDesiredOutcomeIds: [] })).toThrow('only once');
      expect(() => addProductJobIntent(intentDocument(), { id: 'wrong-owner', productId: 'product', jobId: 'core', addressedDesiredOutcomeIds: ['other-outcome'] })).toThrow('belong');
      expect(() => addProductJobIntent(intentDocument(), { id: 'invalid-kind', productId: 'product', jobId: 'outcome', addressedDesiredOutcomeIds: [] })).toThrow('eligible Client Job');
      expect(() => addProductJobIntent(intentDocument(), { id: 'invalid-subset', productId: 'product', jobId: 'emotional', addressedDesiredOutcomeIds: ['outcome'] })).toThrow('cannot select');
    });
    it('restricts Offer selections, prunes them on intent removal and Product change, and preserves Client entities', () => {
      let d = addProductJobIntent(intentDocument(), { id: 'intent', productId: 'product', jobId: 'core', addressedDesiredOutcomeIds: ['outcome'] });
      d = addEntity(d, { ...place, entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged' });
      d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['selection'] });
      const cleaned = removeProductJobIntent(d, 'intent');
      expect(cleaned.offerJobSelections).toEqual([]); expect(cleaned.entities.some(entity => entity.id === 'outcome')).toBe(true); expect(cleaned.relationships).toContainEqual(expect.objectContaining({ desiredOutcomeId: 'outcome' }));
      const other = addEntity(d, { ...place, entityId: 'other-product', title: 'Other', kind: 'product' });
      expect(updateEntity(other, { entityId: 'offer', title: 'Offer', linkedProductId: 'other-product' }).offerJobSelections).toEqual([]);
      const foreign = addProductJobIntent(other, { id: 'foreign', productId: 'other-product', jobId: 'core', addressedDesiredOutcomeIds: [] });
      expect(() => setOfferJobSelections(foreign, { offerId: 'offer', productJobIntentIds: ['foreign'], newSelectionIds: ['foreign-selection'] })).toThrow('Offer Product');
    });
    it('removing an addressed Outcome preserves Client ontology and duplication creates fresh authored record IDs', () => {
      let d = addProductJobIntent(intentDocument(), { id: 'intent', productId: 'product', jobId: 'core', addressedDesiredOutcomeIds: ['outcome'] });
      d = updateProductJobIntent(d, { ...d.productJobIntents[0]!, addressedDesiredOutcomeIds: [] });
      expect(d.entities.some(entity => entity.id === 'outcome')).toBe(true); expect(d.relationships).toContainEqual(expect.objectContaining({ desiredOutcomeId: 'outcome' }));
      const productCopy = duplicateEntity(d, { sourceEntityId: 'product', entityId: 'product-copy', viewId: 'view', x: 30, y: 40, relationshipIds: ['fresh-intent'] });
      expect(productCopy.productJobIntents).toContainEqual({ ...d.productJobIntents[0]!, id: 'fresh-intent', productId: 'product-copy' });
      let offered = addEntity(productCopy, { ...place, entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged' });
      offered = setOfferJobSelections(offered, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['selection'] });
      const offerCopy = duplicateEntity(offered, { sourceEntityId: 'offer', entityId: 'offer-copy', viewId: 'view', x: 50, y: 60, relationshipIds: ['fresh-packaged', 'fresh-selection'] });
      expect(offerCopy.offerJobSelections).toContainEqual({ id: 'fresh-selection', offerId: 'offer-copy', productJobIntentId: 'intent' });
    });
  });

});

describe('Touchpoint mitigation', () => {
  function mitigationDocument() {
    let d = offerDocument();
    d = addEntity(d, { ...place, entityId: 'job-a', title: 'Job A', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'outcome-a', title: 'Outcome A', kind: 'desired_outcome', parentEntityId: 'job-a', relationshipId: 'owns-outcome-a' });
    d = addEntity(d, { ...place, entityId: 'job-b', title: 'Job B', kind: 'emotional_job' });
    d = addProductJobIntent(d, { id: 'intent-a', productId: 'product', jobId: 'job-a', addressedDesiredOutcomeIds: ['outcome-a'] });
    d = addProductJobIntent(d, { id: 'intent-b', productId: 'product', jobId: 'job-b', addressedDesiredOutcomeIds: [] });
    d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent-a', 'intent-b'], newSelectionIds: ['selection-a', 'selection-b'] });
    d = touchpoint(d);
    d = selectAllLinkedOfferIntentsForTouchpoint(d, { touchpointId: 'touch', jobSelectionIds: ['touch-a', 'touch-b'], financialSelectionIds: [] });
    d = addEntity(d, { ...place, entityId: 'repulsor', title: 'Fear', kind: 'repulsor', resistedTargetIds: ['job-a', 'job-b'], relationshipIds: ['resists-a', 'resists-b'] });
    return d;
  }
  it('derives and deduplicates relevant Repulsors through inherited Offer Job selections', async () => {
    const { relevantRepulsorsForTouchpoint } = await import('./index');
    let d = mitigationDocument();
    d = addEntity(d, { ...place, entityId: 'offer-2', title: 'Second', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged-2' });
    d = setOfferJobSelections(d, { offerId: 'offer-2', productJobIntentIds: ['intent-a'], newSelectionIds: ['selection-3'] });
    d = updateEntity(d, { entityId: 'touch', title: 'touch', locatedInId: 'site', linkedOfferIds: ['offer', 'offer-2'], relationshipIds: ['presented-touch', 'presented-2'] });
    expect(relevantRepulsorsForTouchpoint(d, 'touch').map(entity => entity.id)).toEqual(['repulsor']);
  });
  function financialMitigationDocument() {
    let d = offerDocument();
    d = addEntity(d, { ...place, entityId: 'financial', title: 'Stay within budget', kind: 'financial_desired_outcome' });
    d = setOfferFinancialIntents(d, { offerId: 'offer', financialDesiredOutcomeIds: ['financial'], newIntentIds: ['financial-intent'] });
    d = touchpoint(d);
    d = addEntity(d, { ...place, entityId: 'repulsor', title: 'Unexpected fees', kind: 'repulsor', resistedTargetIds: ['financial'], relationshipIds: ['resists-financial'] });
    return d;
  }
  it('derives Financial Desired Outcome resistance only from an authored Touchpoint selection', async () => {
    const { relevantRepulsorsForTouchpoint } = await import('./index');
    const unselected = financialMitigationDocument();
    expect(relevantRepulsorsForTouchpoint(unselected, 'touch')).toEqual([]);
    const selected = setTouchpointIntentSelections(unselected, { touchpointId: 'touch', selections: [{ id: 'touch-financial', kind: 'financial', offerId: 'offer', offerFinancialIntentId: 'financial-intent' }] });
    expect(relevantRepulsorsForTouchpoint(selected, 'touch').map(entity => entity.id)).toEqual(['repulsor']);
  });
  it('deduplicates Financial Desired Outcome relevance through multiple selected Offer paths and allows mitigation', async () => {
    const { relevantRepulsorsForTouchpoint, setTouchpointMitigations } = await import('./index');
    let d = financialMitigationDocument();
    d = addEntity(d, { ...place, entityId: 'offer-2', title: 'Second', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged-2' });
    d = setOfferFinancialIntents(d, { offerId: 'offer-2', financialDesiredOutcomeIds: ['financial'], newIntentIds: ['financial-intent-2'] });
    d = updateEntity(d, { entityId: 'touch', title: 'touch', locatedInId: 'site', linkedOfferIds: ['offer', 'offer-2'], relationshipIds: ['presented-touch', 'presented-2'] });
    d = setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [
      { id: 'touch-financial-1', kind: 'financial', offerId: 'offer', offerFinancialIntentId: 'financial-intent' },
      { id: 'touch-financial-2', kind: 'financial', offerId: 'offer-2', offerFinancialIntentId: 'financial-intent-2' },
    ] });
    expect(relevantRepulsorsForTouchpoint(d, 'touch').map(entity => entity.id)).toEqual(['repulsor']);
    d = setTouchpointMitigations(d, { touchpointId: 'touch', repulsorIds: ['repulsor'], newRelationshipIds: ['mitigates-financial'] });
    expect(d.relationships).toContainEqual({ id: 'mitigates-financial', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor' });
  });
  it('prunes mitigation when the last selected Financial Desired Outcome path is removed', async () => {
    const { setTouchpointMitigations } = await import('./index');
    let d = setTouchpointIntentSelections(financialMitigationDocument(), { touchpointId: 'touch', selections: [{ id: 'touch-financial', kind: 'financial', offerId: 'offer', offerFinancialIntentId: 'financial-intent' }] });
    d = setTouchpointMitigations(d, { touchpointId: 'touch', repulsorIds: ['repulsor'], newRelationshipIds: ['mitigates-financial'] });
    d = setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [] });
    expect(d.relationships.some(relation => relation.kind === 'touchpoint_mitigates_repulsor')).toBe(false);
    expect(d.relationships).toContainEqual({ id: 'resists-financial', kind: 'repulsor_resists', repulsorId: 'repulsor', targetEntityId: 'financial' });
  });
  it('validates authored mitigation endpoints and duplicates, and supports checking and unchecking', async () => {
    const { setTouchpointMitigations } = await import('./index'); let d = mitigationDocument();
    expect(() => setTouchpointMitigations(d, { touchpointId: 'job-a', repulsorIds: ['repulsor'], newRelationshipIds: ['bad'] })).toThrow('touchpoint');
    expect(() => setTouchpointMitigations(d, { touchpointId: 'touch', repulsorIds: ['job-a'], newRelationshipIds: ['bad'] })).toThrow('repulsor');
    expect(() => setTouchpointMitigations(d, { touchpointId: 'touch', repulsorIds: ['repulsor', 'repulsor'], newRelationshipIds: ['a', 'b'] })).toThrow('unique');
    d = setTouchpointMitigations(d, { touchpointId: 'touch', repulsorIds: ['repulsor'], newRelationshipIds: ['mitigates'] });
    expect(d.relationships).toContainEqual({ id: 'mitigates', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor' });
    expect(setTouchpointMitigations(d, { touchpointId: 'touch', repulsorIds: [], newRelationshipIds: [] }).relationships).not.toContainEqual(expect.objectContaining({ kind: 'touchpoint_mitigates_repulsor' }));
  });
  it('prunes mitigation only after all inherited Job paths disappear and preserves Client topology', async () => {
    const { setTouchpointMitigations } = await import('./index'); let d = setTouchpointMitigations(mitigationDocument(), { touchpointId: 'touch', repulsorIds: ['repulsor'], newRelationshipIds: ['mitigates'] });
    d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent-b'], newSelectionIds: [] });
    expect(d.relationships.some(relation => relation.kind === 'touchpoint_mitigates_repulsor')).toBe(true);
    d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: [], newSelectionIds: [] });
    expect(d.relationships.some(relation => relation.kind === 'touchpoint_mitigates_repulsor')).toBe(false);
    expect(d.entities.some(entity => entity.id === 'repulsor')).toBe(true);
    expect(d.relationships.filter(relation => relation.kind === 'repulsor_resists')).toHaveLength(2);
  });
  it('duplicates valid mitigation with a fresh relationship ID without duplicating its Repulsor', async () => {
    const { setTouchpointMitigations } = await import('./index'); const d = setTouchpointMitigations(mitigationDocument(), { touchpointId: 'touch', repulsorIds: ['repulsor'], newRelationshipIds: ['mitigates'] });
    const copy = duplicateEntity(d, { sourceEntityId: 'touch', entityId: 'copy', viewId: 'view', x: 50, y: 60, relationshipIds: ['copy-offer', 'copy-touch-a', 'copy-touch-b', 'copy-mitigation'] });
    expect(copy.relationships).toContainEqual({ id: 'copy-mitigation', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'copy', repulsorId: 'repulsor' });
    expect(copy.entities.filter(entity => entity.kind === 'repulsor')).toHaveLength(1);
  });
});

describe('final authored semantics', () => {
  it('owns Related Job outcomes and preserves their parent on duplication', () => {
    let d = addEntity(empty(), { ...place, entityId: 'core-x', title: 'Core', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'related-x', title: 'Related', kind: 'related_job', parentEntityId: 'core-x', relationshipId: 'related-edge' });
    d = addEntity(d, { ...place, entityId: 'outcome-x', title: 'Outcome', kind: 'desired_outcome', parentEntityId: 'related-x', relationshipId: 'outcome-edge' });
    d = addEntity(d, { ...place, entityId: 'product-x', title: 'Product', kind: 'product' });
    d = addProductJobIntent(d, { id: 'intent-x', productId: 'product-x', jobId: 'related-x', addressedDesiredOutcomeIds: ['outcome-x'] });
    const copy = duplicateEntity(d, { sourceEntityId: 'outcome-x', entityId: 'outcome-copy', ...place, relationshipIds: ['copy-edge'] });
    expect(copy.relationships).toContainEqual({ id: 'copy-edge', kind: 'job_has_desired_outcome', jobId: 'related-x', desiredOutcomeId: 'outcome-copy' });
  });
});

describe('context and financial intent records', () => {
  it('allows zero or many CFJ contexts and preserves retained relationship IDs', () => {
    let d = addEntity(empty(), { ...place, entityId: 'cfj-a', title: 'A', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'cfj-b', title: 'B', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'ej', title: 'Feel secure', kind: 'emotional_job' });
    expect(d.relationships).toEqual([]);
    d = setContextualCoreFunctionalJobs(d, { contextualJobId: 'ej', coreFunctionalJobIds: ['cfj-a'], newRelationshipIds: ['ctx-a'] });
    d = setContextualCoreFunctionalJobs(d, { contextualJobId: 'ej', coreFunctionalJobIds: ['cfj-a', 'cfj-b'], newRelationshipIds: ['ctx-b'] });
    expect(d.relationships.filter(r => r.kind === 'core_functional_job_contextualizes_job').map(r => r.id)).toEqual(['ctx-a', 'ctx-b']);
    expect(() => setContextualCoreFunctionalJobs(d, { contextualJobId: 'cfj-a', coreFunctionalJobIds: ['cfj-b'], newRelationshipIds: ['bad'] })).toThrow('Emotional or Social');
  });

  it('stores Offer Financial Desired Outcome intent independently and preserves retained IDs', () => {
    let d = offerDocument();
    d = addEntity(d, { ...place, entityId: 'fdo-a', title: 'Afford', kind: 'financial_desired_outcome' });
    d = addEntity(d, { ...place, entityId: 'fdo-b', title: 'Reduce risk', kind: 'financial_desired_outcome' });
    d = setOfferFinancialIntents(d, { offerId: 'offer', financialDesiredOutcomeIds: ['fdo-a'], newIntentIds: ['financial-a'] });
    d = setOfferFinancialIntents(d, { offerId: 'offer', financialDesiredOutcomeIds: ['fdo-a', 'fdo-b'], newIntentIds: ['financial-b'] });
    expect(d.offerFinancialIntents.map(i => i.id)).toEqual(['financial-a', 'financial-b']);
    expect(() => setOfferFinancialIntents(d, { offerId: 'offer', financialDesiredOutcomeIds: ['product'], newIntentIds: ['bad'] })).toThrow('Financial Desired Outcome');
    const changed = addEntity(d, { ...place, entityId: 'other-product', title: 'Other', kind: 'product' });
    expect(updateEntity(changed, { entityId: 'offer', title: 'Subscription', linkedProductId: 'other-product' }).offerFinancialIntents).toEqual(d.offerFinancialIntents);
  });
});


describe('Touchpoint intent scope', () => {
  function scoped() {
    let d = touchpoint();
    d = addEntity(d, { ...place, entityId: 'job', title: 'Job', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'outcome', title: 'Outcome', kind: 'desired_outcome', parentEntityId: 'job', relationshipId: 'owns-outcome' });
    return d;
  }
  it('authors bottom-up atomically and extends Product scope without replacing existing outcomes', () => {
    let d = scoped();
    const original = d;
    expect(() => authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['missing'], jobId: 'job', addressedDesiredOutcomeIds: ['outcome'], productJobIntentIds: ['intent'], offerJobSelectionIds: ['offer-selection'], touchpointSelectionIds: ['touch-selection'] })).toThrowError(/linked/);
    expect(d).toBe(original);
    d = authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], jobId: 'job', addressedDesiredOutcomeIds: ['outcome'], productJobIntentIds: ['intent'], offerJobSelectionIds: ['offer-selection'], touchpointSelectionIds: ['touch-selection'] });
    expect(d.productJobIntents).toEqual([{ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] }]);
    expect(d.offerJobSelections).toHaveLength(1);
    expect(d.touchpointJobSelections[0]).toMatchObject({ touchpointId: 'touch', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] });
  });
  it('supports top-down all scope and narrowing while rejecting outcomes outside upstream scope', () => {
    let d = scoped();
    d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] });
    d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['offer-selection'] });
    d = selectAllLinkedOfferIntentsForTouchpoint(d, { touchpointId: 'touch', jobSelectionIds: ['touch-selection'], financialSelectionIds: [] });
    expect(d.touchpointJobSelections[0]?.addressedDesiredOutcomeIds).toEqual(['outcome']);
    expect(() => setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'narrowed', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] }] })).toThrowError(/requires at least one Desired Outcome/);
    expect(() => setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'bad', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['job'] }] })).toThrow();
  });
  it('keeps FDO at Offer level and exposes a confirmed cascade impact', () => {
    let d = scoped();
    d = addEntity(d, { ...place, entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome' });
    d = authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], financialDesiredOutcomeId: 'fdo', offerFinancialIntentIds: ['financial-intent'], touchpointSelectionIds: ['touch-financial'] });
    expect(d.productJobIntents).toEqual([]);
    const impact = getIntentRemovalImpact(d, { offerFinancialIntentId: 'financial-intent' });
    expect(impact.touchpointFinancialSelectionIds).toEqual(['touch-financial']);
    d = removeOfferIntentConfirmed(d, { offerFinancialIntentId: 'financial-intent' });
    expect(d.offerFinancialIntents).toEqual([]); expect(d.touchpointFinancialSelections).toEqual([]);
    expect(d.entities.some(entity => entity.id === 'fdo')).toBe(true);
  });
  it('accepts incomplete upstream DO-bearing intent but omits it when copying Offer scope', () => {
    let d = scoped();
    d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: [] });
    d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['offer-selection'] });
    const selected = selectAllLinkedOfferIntentsForTouchpoint(d, { touchpointId: 'touch', jobSelectionIds: [], financialSelectionIds: [] });
    expect(selected.offerJobSelections).toHaveLength(1); expect(selected.touchpointJobSelections).toEqual([]);
    expect(() => authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], jobId: 'job', addressedDesiredOutcomeIds: [], productJobIntentIds: [], offerJobSelectionIds: [], touchpointSelectionIds: ['local'] })).toThrowError(/requires at least one Desired Outcome/);
    expect(d.touchpointJobSelections).toEqual([]);
  });
  it('normalizes downstream outcome scope without deleting incomplete upstream intent', () => {
    let d = scoped();
    d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] });
    d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['offer-selection'] });
    d = setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'local', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] });
    d = updateProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: [] });
    expect(d.productJobIntents[0]?.addressedDesiredOutcomeIds).toEqual([]); expect(d.offerJobSelections).toHaveLength(1); expect(d.touchpointJobSelections).toEqual([]); expect(d.entities.some(entity => entity.id === 'outcome')).toBe(true);
  });
  it('distributes downward only to explicitly selected descendants', () => {
    let d = scoped();
    d = addEntity(d, { ...place, entityId: 'offer-2', title: 'Other', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged-2' });
    d = distributeProductJobIntent(d, { intent: { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] }, offerIds: ['offer'], newOfferSelectionIds: ['offer-selection'] });
    expect(d.offerJobSelections.map(selection => selection.offerId)).toEqual(['offer']);
    d = addEntity(d, { ...place, entityId: 'touch-2', title: 'Other Touchpoint', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['offer'], relationshipIds: ['presented-2'] });
    d = distributeOfferJobIntent(d, { offerId: 'offer', productJobIntentId: 'intent', touchpointIds: ['touch'], addressedDesiredOutcomeIds: ['outcome'], newTouchpointSelectionIds: ['local'] });
    expect(d.touchpointJobSelections.map(selection => selection.touchpointId)).toEqual(['touch']);
  });
  it('aggregates resistance without authoring Product or Offer relationships', () => {
    let d = scoped();
    d = authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], jobId: 'job', addressedDesiredOutcomeIds: ['outcome'], productJobIntentIds: ['intent'], offerJobSelectionIds: ['offer-selection'], touchpointSelectionIds: ['local'] });
    d = addEntity(d, { ...place, entityId: 'repulsor', title: 'Friction', kind: 'repulsor', resistedTargetIds: ['job'], relationshipIds: ['resists'] });
    const relationshipCount = d.relationships.length;
    expect(resistanceImpactForOffer(d, 'offer')).toEqual([{ repulsor: expect.objectContaining({ id: 'repulsor' }), touchpointIds: ['touch'] }]);
    expect(resistanceImpactForProduct(d, 'product')).toEqual([{ repulsor: expect.objectContaining({ id: 'repulsor' }), paths: [{ offerId: 'offer', touchpointId: 'touch' }] }]);
    expect(d.relationships).toHaveLength(relationshipCount);
  });
});
