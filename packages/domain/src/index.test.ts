import { describe, expect, it } from 'vitest';
import { CLIENT_ROOT_ENTITY_KINDS, addEntity, addProductJobIntent, removeProductJobIntent, setOfferJobSelections, updateProductJobIntent, addTouchpointContainer, createEmptyMapDocument, duplicateEntity, movePlacement, updateEntity, updateRepulsorTargets } from './index';

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
    for (const parentEntityId of ['social_job', 'financial_desired_outcome', 'related-parent', 'product-parent']) expect(() => addEntity(d, { ...place, entityId: `outcome-${parentEntityId}`, title: 'Invalid', kind: 'desired_outcome', parentEntityId, relationshipId: `o-${parentEntityId}` })).toThrow('Core Functional Job or Consumption Chain Job');
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
    expect(() => updateEntity(d, { entityId: 'outcome', title: 'Outcome', parentEntityId: 'related' })).toThrow('Invalid semantic parent');
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
      const one = addEntity(targets(), { ...place, entityId: 'r', title: 'Resistance', kind: 'repulsor', resistedTargetIds: ['core'], relationshipIds: ['rr-core'] });
      expect(one.relationships).toContainEqual({ id: 'rr-core', kind: 'repulsor_resists', repulsorId: 'r', targetEntityId: 'core' });
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
      for (const id of ['product', 'offer', 'touch', 'related', 'outcome', 'other-r']) expect(() => addEntity(d, { ...place, entityId: `bad-${id}`, title: 'Bad', kind: 'repulsor', resistedTargetIds: [id], relationshipIds: [`bad-rel-${id}`] })).toThrow('allowed Client attraction root');
    });
    it('updates targets while preserving retained relation IDs and assigning fresh IDs', () => {
      const created = addEntity(targets(), { ...place, entityId: 'r', title: 'R', kind: 'repulsor', resistedTargetIds: ['core', 'chain'], relationshipIds: ['keep-core', 'remove-chain'] });
      const updated = updateRepulsorTargets(created, { repulsorId: 'r', targetEntityIds: ['core', 'social'], newRelationshipIds: ['add-social'] });
      expect(updated.relationships.filter(r => r.kind === 'repulsor_resists')).toEqual([
        { id: 'keep-core', kind: 'repulsor_resists', repulsorId: 'r', targetEntityId: 'core' },
        { id: 'add-social', kind: 'repulsor_resists', repulsorId: 'r', targetEntityId: 'social' },
      ]);
      expect(() => updateRepulsorTargets(updated, { repulsorId: 'r', targetEntityIds: [], newRelationshipIds: [] })).toThrow('at least one');
      expect(() => updateRepulsorTargets(updated, { repulsorId: 'r', targetEntityIds: ['core', 'core'], newRelationshipIds: [] })).toThrow('unique');
    });
    it('duplicates the target set with fresh IDs and without epistemic annotation', () => {
      let d = addEntity(targets(), { ...place, entityId: 'r', title: 'R', kind: 'repulsor', resistedTargetIds: ['core', 'social'], relationshipIds: ['old-a', 'old-b'] });
      d = { ...d, epistemicAnnotations: [{ id: 'note', subjectEntityId: 'r', status: 'hypothesis' }] };
      const copy = duplicateEntity(d, { sourceEntityId: 'r', entityId: 'copy', viewId: 'view', x: 50, y: 60, relationshipIds: ['new-a', 'new-b'] });
      expect(copy.entities.find(e => e.id === 'copy')).toEqual({ id: 'copy', title: 'R', kind: 'repulsor' });
      expect(copy.relationships.filter(r => r.kind === 'repulsor_resists' && r.repulsorId === 'copy')).toEqual([
        { id: 'new-a', kind: 'repulsor_resists', repulsorId: 'copy', targetEntityId: 'core' },
        { id: 'new-b', kind: 'repulsor_resists', repulsorId: 'copy', targetEntityId: 'social' },
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
