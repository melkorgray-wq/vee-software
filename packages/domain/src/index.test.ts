import { describe, expect, it } from 'vitest';
import { CLIENT_ROOT_ENTITY_KINDS, addEntity, addOfferContentBlock, addProductJobIntent, removeOfferContentBlock, removeProductJobIntent, reorderOfferContentBlocks, setOfferJobSelections, setContextualCoreFunctionalJobs, setOfferFinancialIntents, updateOfferContentBlock, updateProductJobIntent, addTouchpointContainer, applyTouchpointIntentDraft, changeOfferProduct, createEmptyMapDocument, duplicateEntity, duplicateEntityRelationshipIdCount, movePlacement, updateEntity, updateOfferContent, updateRepulsorTargets, authorTouchpointIntentBottomUp, selectAllLinkedOfferIntentsForTouchpoint, setTouchpointIntentSelections, setTouchpointMitigations, getIntentRemovalImpact, getOfferIntentChangeImpact, getProductIntentChangeImpact, getTouchpointLinkedOfferChangeImpact, removeOfferIntentConfirmed, distributeProductJobIntent, distributeOfferJobIntent, resistanceImpactForOffer, resistanceImpactForProduct, planTouchpointIntentPathChange, commitTouchpointIntentPathPlan, commitTouchpointParent, planTouchpointStructuralChange } from './index';

function completed(result: ReturnType<typeof authorTouchpointIntentBottomUp>) { if (result.status !== 'complete') throw new Error(`Expected complete, got ${result.status}`); return result.document; }

const place = { viewId: 'view', x: 10, y: 20 };
const empty = () => createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' });
function offerDocument() { let d = addEntity(empty(), { ...place, entityId: 'product', title: 'Orbit', kind: 'product' }); d = addEntity(d, { ...place, entityId: 'offer', title: 'Subscription', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged' }); return addTouchpointContainer(d, { id: 'site', title: 'The Quiet Orbit website' }); }
function touchpoint(d = offerDocument(), id = 'touch', parent?: string) { return addEntity(d, { ...place, entityId: id, title: id, kind: 'touchpoint', locatedInId: 'site', url: '  /checkout#pay  ', linkedOfferIds: ['offer'], relationshipIds: [`presented-${id}`], ...(parent ? { parentTouchpointId: parent, parentRelationshipId: `contains-${id}` } : {}) }); }

describe('map authoring domain', () => {
  describe('Offer structured Content blocks', () => {
    function blocks() {
      let document = addOfferContentBlock(offerDocument(), { offerId: 'offer', blockId: 'first', title: ' First ', text: '' });
      document = addOfferContentBlock(document, { offerId: 'offer', blockId: 'middle', title: 'Middle', text: 'Body' });
      return addOfferContentBlock(document, { offerId: 'offer', blockId: 'last', title: 'Last' });
    }
    const offer = (document: ReturnType<typeof offerDocument>, id = 'offer') => document.entities.find((entity): entity is Extract<(typeof document.entities)[number], { kind: 'offer' }> => entity.id === id && entity.kind === 'offer')!;

    it('appends normalized blocks in authored order and validates owner, title, and document-wide IDs', () => {
      const document = blocks();
      expect(offer(document).contentBlocks).toEqual([
        { id: 'first', title: 'First', text: '' }, { id: 'middle', title: 'Middle', text: 'Body' }, { id: 'last', title: 'Last' },
      ]);
      expect(() => addOfferContentBlock(document, { offerId: 'offer', blockId: 'new', title: '  ' })).toThrow('must not be blank');
      expect(() => addOfferContentBlock(document, { offerId: 'offer', blockId: 'first', title: 'Again' })).toThrow('already exists');
      expect(() => addOfferContentBlock(document, { offerId: 'product', blockId: 'new', title: 'Wrong' })).toThrow('must reference a offer');
      expect(() => addOfferContentBlock(document, { offerId: 'missing', blockId: 'new', title: 'Missing' })).toThrow('does not reference');
      let other = addEntity(document, { ...place, entityId: 'other', title: 'Other', kind: 'offer', linkedProductId: 'product', relationshipId: 'other-product' });
      other = addOfferContentBlock(other, { offerId: 'other', blockId: 'other-block', title: 'Other block' });
      expect(() => addOfferContentBlock(other, { offerId: 'offer', blockId: 'other-block', title: 'Collision' })).toThrow('already exists');
    });

    it.each([
      ['first', ['first', 'inserted', 'middle', 'last']],
      ['middle', ['first', 'middle', 'inserted', 'last']],
      ['last', ['first', 'middle', 'last', 'inserted']],
    ])('inserts atomically after the %s block without changing existing blocks', (afterBlockId, expectedIds) => {
      const document = blocks();
      const existing = offer(document).contentBlocks!;
      const inserted = addOfferContentBlock(document, { offerId: 'offer', blockId: 'inserted', title: ' Inserted ', text: 'New', afterBlockId });
      expect(offer(inserted).contentBlocks?.map(block => block.id)).toEqual(expectedIds);
      expect(offer(inserted).contentBlocks?.find(block => block.id === 'inserted')).toEqual({ id: 'inserted', title: 'Inserted', text: 'New' });
      for (const block of existing) expect(offer(inserted).contentBlocks?.find(candidate => candidate.id === block.id)).toBe(block);
      expect(offer(document).contentBlocks).toBe(existing);
    });

    it('rejects unknown and foreign insertion anchors without mutation', () => {
      let document = blocks();
      document = addEntity(document, { ...place, entityId: 'other', title: 'Other', kind: 'offer', linkedProductId: 'product', relationshipId: 'other-product' });
      document = addOfferContentBlock(document, { offerId: 'other', blockId: 'foreign', title: 'Foreign' });
      const snapshot = structuredClone(document);
      for (const afterBlockId of ['unknown', 'foreign']) {
        expect(() => addOfferContentBlock(document, { offerId: 'offer', blockId: `new-${afterBlockId}`, title: 'New', afterBlockId })).toThrow('does not belong');
        expect(document).toEqual(snapshot);
      }
      expect(() => addOfferContentBlock(document, { offerId: 'offer', blockId: 'first', title: 'Duplicate', afterBlockId: 'middle' })).toThrow('already exists');
      expect(() => addOfferContentBlock(document, { offerId: 'offer', blockId: 'new-blank', title: ' ', afterBlockId: 'middle' })).toThrow('must not be blank');
      expect(document).toEqual(snapshot);
    });

    it('updates title and exact optional text independently with identity-preserving normalized no-ops', () => {
      const document = blocks();
      const titled = updateOfferContentBlock(document, { offerId: 'offer', blockId: 'middle', field: 'title', value: '  Renamed  ' });
      expect(offer(titled).contentBlocks).toEqual([{ id: 'first', title: 'First', text: '' }, { id: 'middle', title: 'Renamed', text: 'Body' }, { id: 'last', title: 'Last' }]);
      expect(updateOfferContentBlock(titled, { offerId: 'offer', blockId: 'middle', field: 'title', value: ' Renamed ' })).toBe(titled);
      expect(() => updateOfferContentBlock(document, { offerId: 'offer', blockId: 'middle', field: 'title', value: '\t ' })).toThrow('must not be blank');
      const emptyText = updateOfferContentBlock(document, { offerId: 'offer', blockId: 'middle', field: 'text', value: '' });
      expect(offer(emptyText).contentBlocks![1]).toEqual({ id: 'middle', title: 'Middle', text: '' });
      const absentText = updateOfferContentBlock(emptyText, { offerId: 'offer', blockId: 'middle', field: 'text', value: undefined });
      expect(offer(absentText).contentBlocks![1]).toEqual({ id: 'middle', title: 'Middle' });
      expect(updateOfferContentBlock(absentText, { offerId: 'offer', blockId: 'middle', field: 'text', value: undefined })).toBe(absentText);
      expect(offer(absentText).contentUrl).toBeUndefined();
      expect(() => updateOfferContentBlock(document, { offerId: 'offer', blockId: 'unknown', field: 'text', value: 'x' })).toThrow('does not belong');
    });

    it('removes first, middle, and final blocks while preserving order and canonicalizing empty state', () => {
      const document = blocks();
      const withoutFirst = removeOfferContentBlock(document, { offerId: 'offer', blockId: 'first' });
      expect(offer(withoutFirst).contentBlocks?.map(block => block.id)).toEqual(['middle', 'last']);
      const withoutMiddle = removeOfferContentBlock(document, { offerId: 'offer', blockId: 'middle' });
      expect(offer(withoutMiddle).contentBlocks?.map(block => block.id)).toEqual(['first', 'last']);
      const one = removeOfferContentBlock(withoutMiddle, { offerId: 'offer', blockId: 'first' });
      const none = removeOfferContentBlock(one, { offerId: 'offer', blockId: 'last' });
      expect(offer(none)).not.toHaveProperty('contentBlocks');
      expect(none.relationships).toBe(document.relationships);
      expect(() => removeOfferContentBlock(document, { offerId: 'offer', blockId: 'unknown' })).toThrow('does not belong');
      let other = addEntity(document, { ...place, entityId: 'other', title: 'Other', kind: 'offer', linkedProductId: 'product', relationshipId: 'other-product' });
      other = addOfferContentBlock(other, { offerId: 'other', blockId: 'foreign', title: 'Foreign' });
      expect(() => removeOfferContentBlock(other, { offerId: 'offer', blockId: 'foreign' })).toThrow('does not belong');
      expect(() => updateOfferContentBlock(other, { offerId: 'offer', blockId: 'foreign', field: 'text', value: 'x' })).toThrow('does not belong');
    });

    it('reorders only the exact current set while retaining block objects and rejecting invalid plans atomically', () => {
      const document = blocks();
      const original = offer(document).contentBlocks!;
      const reordered = reorderOfferContentBlocks(document, { offerId: 'offer', blockIds: ['last', 'first', 'middle'] });
      expect(offer(reordered).contentBlocks).toEqual([original[2], original[0], original[1]]);
      expect(offer(reordered).contentBlocks![0]).toBe(original[2]);
      expect(reorderOfferContentBlocks(document, { offerId: 'offer', blockIds: ['first', 'middle', 'last'] })).toBe(document);
      for (const blockIds of [['first', 'first', 'last'], ['first', 'middle'], ['first', 'middle', 'last', 'extra'], ['first', 'middle', 'stale']]) {
        expect(() => reorderOfferContentBlocks(document, { offerId: 'offer', blockIds })).toThrow();
        expect(offer(document).contentBlocks).toBe(original);
      }
      let other = addEntity(document, { ...place, entityId: 'other', title: 'Other', kind: 'offer', linkedProductId: 'product', relationshipId: 'other-product' });
      other = addOfferContentBlock(other, { offerId: 'other', blockId: 'foreign', title: 'Foreign' });
      expect(() => reorderOfferContentBlocks(other, { offerId: 'offer', blockIds: ['first', 'middle', 'foreign'] })).toThrow();
      const noBlocks = offerDocument();
      expect(reorderOfferContentBlocks(noBlocks, { offerId: 'offer', blockIds: [] })).toBe(noBlocks);
      expect(() => reorderOfferContentBlocks(noBlocks, { offerId: 'offer', blockIds: ['added'] })).toThrow();
    });

    it('duplicates blocks with a separate fresh ID pool without changing relationship accounting or source state', () => {
      const document = blocks();
      const snapshot = structuredClone(document);
      expect(duplicateEntityRelationshipIdCount(document, 'offer')).toBe(1);
      const copy = duplicateEntity(document, { sourceEntityId: 'offer', entityId: 'copy', viewId: 'view', x: 30, y: 40, relationshipIds: ['copy-product'], offerContentBlockIds: ['copy-first', 'copy-middle', 'copy-last'] });
      expect(offer(copy, 'copy').contentBlocks).toEqual([
        { id: 'copy-first', title: 'First', text: '' }, { id: 'copy-middle', title: 'Middle', text: 'Body' }, { id: 'copy-last', title: 'Last' },
      ]);
      expect(document).toEqual(snapshot);
      for (const offerContentBlockIds of [undefined, ['one'], ['a', 'a', 'c'], ['a', ' ', 'c'], ['a', 'first', 'c']]) {
        expect(() => duplicateEntity(document, { sourceEntityId: 'offer', entityId: 'bad-copy', viewId: 'view', x: 30, y: 40, relationshipIds: ['bad-product'], ...(offerContentBlockIds ? { offerContentBlockIds } : {}) })).toThrow();
      }
    });
  });

  it('updates independent optional Offer Content fields and treats normalized no-ops as identity', () => {
    const before = offerDocument();
    const urlOnly = updateOfferContent(before, { offerId: 'offer', field: 'contentUrl', value: '  https://example.test/brief  ' });
    expect(urlOnly.entities.find(entity => entity.id === 'offer')).toMatchObject({ contentUrl: 'https://example.test/brief' });
    expect(updateOfferContent(urlOnly, { offerId: 'offer', field: 'contentUrl', value: 'https://example.test/brief' })).toBe(urlOnly);
    const textOnly = updateOfferContent(before, { offerId: 'offer', field: 'contentText', value: '  First line\nSecond line  ' });
    expect(textOnly.entities.find(entity => entity.id === 'offer')).toMatchObject({ contentText: 'First line\nSecond line' });
    const withUrl = updateOfferContent(before, { offerId: 'offer', field: 'contentUrl', value: 'http://example.test/doc' });
    const both = updateOfferContent(withUrl, { offerId: 'offer', field: 'contentText', value: 'Notes' });
    expect(both.entities.find(entity => entity.id === 'offer')).toMatchObject({ contentUrl: 'http://example.test/doc', contentText: 'Notes' });
    const clearedUrl = updateOfferContent(both, { offerId: 'offer', field: 'contentUrl', value: '' });
    expect(clearedUrl.entities.find(entity => entity.id === 'offer')).toMatchObject({ contentText: 'Notes' });
    expect(updateOfferContent(clearedUrl, { offerId: 'offer', field: 'contentText', value: '\n ' }).entities.find(entity => entity.id === 'offer')).toEqual({ id: 'offer', kind: 'offer', title: 'Subscription' });
  });
  it('rejects unsafe Offer Content URLs and preserves every unrelated document record', () => {
    const before = offerDocument();
    for (const contentUrl of ['javascript:alert(1)', '/relative', 'ftp://example.test/file', 'not a url']) {
      expect(() => updateOfferContent(before, { offerId: 'offer', field: 'contentUrl', value: contentUrl })).toThrow('absolute http: or https:');
    }
    expect(() => updateOfferContent(before, { offerId: 'product', field: 'contentText', value: 'Wrong owner' })).toThrow('must reference a offer');
    const next = updateOfferContent(before, { offerId: 'offer', field: 'contentText', value: 'Draft' });
    expect(next.entities.filter(entity => entity.id !== 'offer')).toEqual(before.entities.filter(entity => entity.id !== 'offer'));
    expect({ ...next, entities: before.entities }).toEqual(before);
  });
  it('canonically duplicates both authored Offer Content fields', () => {
    const withUrl = updateOfferContent(offerDocument(), { offerId: 'offer', field: 'contentUrl', value: 'https://example.test/brief' });
    const source = updateOfferContent(withUrl, { offerId: 'offer', field: 'contentText', value: 'Line one\nLine two' });
    const copy = duplicateEntity(source, { sourceEntityId: 'offer', entityId: 'copy', title: 'Copy', viewId: 'view', x: 30, y: 40, relationshipIds: ['copy-product'] });
    expect(copy.entities.find(entity => entity.id === 'copy')).toEqual({ id: 'copy', kind: 'offer', title: 'Copy', contentUrl: 'https://example.test/brief', contentText: 'Line one\nLine two' });
  });
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
  it('clears only a Touchpoint parent while preserving the entity and unrelated relationships', () => {
    let d = touchpoint(); d = touchpoint(d, 'child', 'touch'); d = touchpoint(d, 'other');
    const cleared = commitTouchpointParent(d, { touchpointId: 'child', parentTouchpointId: '' });
    expect(cleared.entities).toBe(d.entities);
    expect(cleared.entities.find(entity => entity.id === 'child')).toEqual(d.entities.find(entity => entity.id === 'child'));
    expect(cleared.relationships).toEqual(d.relationships.filter(relationship => relationship.kind !== 'touchpoint_contains_touchpoint' || relationship.childTouchpointId !== 'child'));
    expect(cleared.relationships).toContainEqual(expect.objectContaining({ id: 'presented-other' }));
    expect(() => commitTouchpointParent(d, { touchpointId: 'touch', parentTouchpointId: 'child', relationshipId: 'cycle' })).toThrow('cycle');
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
    it('previews the complete Offer replacement impact without mutating upstream intent', () => {
      let d = addProductJobIntent(intentDocument(), { id: 'intent', productId: 'product', jobId: 'core', addressedDesiredOutcomeIds: ['outcome'] });
      d = addEntity(d, { ...place, entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged' });
      d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['selection'] });
      d = addEntity(d, { ...place, entityId: 'touch', title: 'Checkout', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['presented'] });
      d = setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'touch-selection', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] });
      expect(getOfferIntentChangeImpact(d, { offerId: 'offer', productId: 'product', productJobIntentIds: [], financialDesiredOutcomeIds: [] })).toEqual({ touchpointJobSelectionIds: ['touch-selection'], narrowedTouchpointSelections: [], touchpointFinancialSelectionIds: [] });
      expect(d.productJobIntents).toContainEqual(expect.objectContaining({ id: 'intent' }));
    });
    it('previews Offer subset narrowing while preserving the downstream Job path', () => {
      let d = intentDocument();
      d = addEntity(d, { ...place, entityId: 'outcome-b', title: 'Outcome B', kind: 'desired_outcome', parentEntityId: 'core', relationshipId: 'owns-b' });
      d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'core', addressedDesiredOutcomeIds: ['outcome', 'outcome-b'] });
      d = addEntity(d, { ...place, entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged' });
      d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['selection'] });
      d = addEntity(d, { ...place, entityId: 'touch', title: 'Checkout', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['presented'] });
      d = setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'touch-selection', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome', 'outcome-b'] }] });
      expect(getOfferIntentChangeImpact(d, { offerId: 'offer', productId: 'product', selections: [{ productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }], financialDesiredOutcomeIds: [] })).toEqual({
        touchpointJobSelectionIds: [], narrowedTouchpointSelections: [{ touchpointJobSelectionId: 'touch-selection', removedDesiredOutcomeIds: ['outcome-b'] }], touchpointFinancialSelectionIds: [],
      });
    });
    it('changes an Offer Product atomically, preserves the relationship ID and unrelated records, and treats the current Product as a no-op', () => {
      let d = addProductJobIntent(intentDocument(), { id: 'intent', productId: 'product', jobId: 'core', addressedDesiredOutcomeIds: ['outcome'] });
      d = addEntity(d, { ...place, entityId: 'other-product', title: 'Other Product', kind: 'product' });
      d = addEntity(d, { ...place, entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged' });
      d = addEntity(d, { ...place, entityId: 'unrelated-offer', title: 'Unrelated', kind: 'offer', linkedProductId: 'product', relationshipId: 'unrelated-packaged' });
      d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['selection'] });
      d = setOfferJobSelections(d, { offerId: 'unrelated-offer', productJobIntentIds: ['intent'], newSelectionIds: ['unrelated-selection'] });
      expect(changeOfferProduct(d, { offerId: 'offer', productId: 'product' })).toBe(d);
      const changed = changeOfferProduct(d, { offerId: 'offer', productId: 'other-product' });
      expect(changed.relationships).toContainEqual({ id: 'packaged', kind: 'product_packaged_as_offer', productId: 'other-product', offerId: 'offer' });
      expect(changed.offerJobSelections).not.toContainEqual(expect.objectContaining({ offerId: 'offer' }));
      expect(changed.offerJobSelections).toContainEqual(expect.objectContaining({ id: 'unrelated-selection' }));
    });
    it('validates Offer and Product IDs and requires confirmation before applying downstream impact', () => {
      let d = addProductJobIntent(intentDocument(), { id: 'intent', productId: 'product', jobId: 'core', addressedDesiredOutcomeIds: ['outcome'] });
      d = addEntity(d, { ...place, entityId: 'other-product', title: 'Other Product', kind: 'product' });
      d = addEntity(d, { ...place, entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged' });
      d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['selection'] });
      d = addEntity(d, { ...place, entityId: 'touch', title: 'Touchpoint', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['presented'] });
      d = setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'touch-selection', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] });
      expect(() => changeOfferProduct(d, { offerId: 'missing', productId: 'other-product' })).toThrow('Offer');
      expect(() => changeOfferProduct(d, { offerId: 'offer', productId: 'missing' })).toThrow('Product');
      expect(() => changeOfferProduct(d, { offerId: 'offer', productId: 'other-product' })).toThrow('confirmation');
      expect(d.relationships).toContainEqual(expect.objectContaining({ id: 'packaged', productId: 'product' }));
      expect(d.offerJobSelections).toContainEqual(expect.objectContaining({ id: 'selection' }));
      expect(d.touchpointJobSelections).toContainEqual(expect.objectContaining({ id: 'touch-selection' }));
      const changed = changeOfferProduct(d, { offerId: 'offer', productId: 'other-product', confirmedImpact: true });
      expect(changed.offerJobSelections).toEqual([]);
      expect(changed.touchpointJobSelections).toEqual([]);
    });
    it('preserves Product-independent Offer and Touchpoint financial intent during a Product change', () => {
      let d = intentDocument();
      d = addEntity(d, { ...place, entityId: 'other-product', title: 'Other Product', kind: 'product' });
      d = addEntity(d, { ...place, entityId: 'financial', title: 'Budget', kind: 'financial_desired_outcome' });
      d = addEntity(d, { ...place, entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged' });
      d = setOfferFinancialIntents(d, { offerId: 'offer', financialDesiredOutcomeIds: ['financial'], newIntentIds: ['financial-intent'] });
      d = addEntity(d, { ...place, entityId: 'touch', title: 'Touchpoint', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['presented'] });
      d = setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'touch-financial', kind: 'financial', offerId: 'offer', offerFinancialIntentId: 'financial-intent' }] });
      const changed = changeOfferProduct(d, { offerId: 'offer', productId: 'other-product' });
      expect(changed.offerFinancialIntents).toEqual(d.offerFinancialIntents);
      expect(changed.touchpointFinancialSelections).toEqual(d.touchpointFinancialSelections);
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
      expect(offerCopy.offerJobSelections).toContainEqual({ id: 'fresh-selection', offerId: 'offer-copy', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] });
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
    d = completed(authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], jobId: 'job', addressedDesiredOutcomeIds: ['outcome'], productJobIntentIds: ['intent'], offerJobSelectionIds: ['offer-selection'], touchpointSelectionIds: ['touch-selection'] }));
    expect(d.productJobIntents).toEqual([{ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] }]);
    expect(d.offerJobSelections).toHaveLength(1);
    expect(d.touchpointJobSelections[0]).toMatchObject({ touchpointId: 'touch', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] });
  });
  it('atomically applies a full draft, retains upstream scope and prunes mitigation after local removal', () => {
    let d = scoped();
    d = addEntity(d, { ...place, entityId: 'other-outcome', title: 'Other', kind: 'desired_outcome', parentEntityId: 'job', relationshipId: 'owns-other' });
    d = addEntity(d, { ...place, entityId: 'emotional', title: 'Confident', kind: 'emotional_job' });
    d = addEntity(d, { ...place, entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome' });
    d = addEntity(d, { ...place, entityId: 'repulsor', title: 'Friction', kind: 'repulsor', resistedTargetIds: ['job'], relationshipIds: ['resists'] });
    d = addProductJobIntent(d, { id: 'existing-intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['other-outcome'] });
    const ids = (() => { let index = 0; return () => `generated-${++index}`; })();
    const draft = { jobLeaves: [
      { jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer'] },
      { jobId: 'emotional', semanticLeafId: 'emotional', contributorOfferIds: ['offer'] },
    ], financialLeaves: [{ financialDesiredOutcomeId: 'fdo', contributorOfferIds: ['offer'] }], pendingJobLeafIds: [], pendingFinancialLeafIds: [] };
    d = applyTouchpointIntentDraft(d, { touchpointId: 'touch', draft, newId: ids });
    expect(d.productJobIntents.find(intent => intent.id === 'existing-intent')?.addressedDesiredOutcomeIds).toEqual(['other-outcome', 'outcome']);
    expect(d.productJobIntents.some(intent => intent.jobId === 'fdo')).toBe(false);
    expect(d.touchpointJobSelections).toEqual(expect.arrayContaining([
      expect.objectContaining({ offerId: 'offer', addressedDesiredOutcomeIds: ['outcome'] }),
      expect.objectContaining({ offerId: 'offer', addressedDesiredOutcomeIds: [] }),
    ]));
    d = setTouchpointMitigations(d, { touchpointId: 'touch', repulsorIds: ['repulsor'], newRelationshipIds: ['mitigates'] });
    const upstream = { productJobIntents: d.productJobIntents, offerJobSelections: d.offerJobSelections, offerFinancialIntents: d.offerFinancialIntents };
    d = applyTouchpointIntentDraft(d, { touchpointId: 'touch', draft: { ...draft, jobLeaves: [], financialLeaves: [] }, newId: ids });
    expect(d).toMatchObject(upstream); expect(d.touchpointJobSelections).toEqual([]); expect(d.touchpointFinancialSelections).toEqual([]);
    expect(d.relationships.some(relation => relation.kind === 'touchpoint_mitigates_repulsor')).toBe(false);
  });
  it('rejects invalid or contributor-less draft paths without mutating the input', () => {
    const d = scoped(); const before = structuredClone(d); let ids = 0;
    const jobOnly = applyTouchpointIntentDraft(d, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'job', contributorOfferIds: ['offer'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: () => `id-${++ids}` });
    expect(jobOnly.touchpointJobSelections[0]?.addressedDesiredOutcomeIds).toEqual([]);
    expect(() => applyTouchpointIntentDraft(d, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: [] }], financialLeaves: [], pendingJobLeafIds: ['outcome'], pendingFinancialLeafIds: [] }, newId: () => `id-${++ids}` })).toThrow(/contributing Offer/);
    expect(d).toEqual(before); expect(d.productJobIntents).toEqual([]);
  });
  describe('authorTouchpointIntentBottomUp invariants', () => {
    function twoOfferScope() {
      let d = scoped();
      d = addEntity(d, { ...place, entityId: 'do-b', title: 'Outcome B', kind: 'desired_outcome', parentEntityId: 'job', relationshipId: 'owns-do-b' });
      d = addEntity(d, { ...place, entityId: 'offer-b', title: 'Offer B', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged-b' });
      return updateEntity(d, { entityId: 'touch', title: 'touch', locatedInId: 'site', url: '/checkout#pay', linkedOfferIds: ['offer', 'offer-b'], relationshipIds: ['presented-touch', 'presented-touch-b'] });
    }
    const draft = (jobLeaves: { jobId: string; semanticLeafId: string; desiredOutcomeId?: string; contributorOfferIds: string[] }[] = [], financialLeaves: { financialDesiredOutcomeId: string; contributorOfferIds: string[] }[] = []) => ({ jobLeaves, financialLeaves, pendingJobLeafIds: [], pendingFinancialLeafIds: [] });
    const ids = (prefix = 'generated') => { let index = 0; return () => `${prefix}-${++index}`; };

    it('DO-bearing Job supports a Job-only path without a route subset', () => {
      const d = completed(authorTouchpointIntentBottomUp(scoped(), { touchpointId: 'touch', contributingOfferIds: ['offer'], jobId: 'job', addressedDesiredOutcomeIds: [], productJobIntentIds: ['intent'], offerJobSelectionIds: ['offer-selection'], touchpointSelectionIds: ['touch-selection'] }));
      expect(d.productJobIntents[0]?.addressedDesiredOutcomeIds).toEqual([]);
      expect(d.offerJobSelections[0]?.addressedDesiredOutcomeIds).toEqual([]);
      expect(d.touchpointJobSelections[0]?.addressedDesiredOutcomeIds).toEqual([]);
    });

    it('selecting one DO does not include its sibling DO', () => {
      const d = applyTouchpointIntentDraft(twoOfferScope(), { touchpointId: 'touch', draft: draft([{ jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer'] }]), newId: ids() });
      expect(d.productJobIntents[0]?.addressedDesiredOutcomeIds).toEqual(['outcome']);
      expect(d.touchpointJobSelections[0]?.addressedDesiredOutcomeIds).toEqual(['outcome']);
      expect(d.productJobIntents[0]?.addressedDesiredOutcomeIds).not.toContain('do-b');
    });

    it('DO A through Offer A and DO B through Offer B create distinct Touchpoint selections with distinct subsets', () => {
      const d = applyTouchpointIntentDraft(twoOfferScope(), { touchpointId: 'touch', draft: draft([
        { jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer'] },
        { jobId: 'job', semanticLeafId: 'do-b', desiredOutcomeId: 'do-b', contributorOfferIds: ['offer-b'] },
      ]), newId: ids() });
      expect(d.touchpointJobSelections).toEqual(expect.arrayContaining([
        expect.objectContaining({ offerId: 'offer', addressedDesiredOutcomeIds: ['outcome'] }),
        expect.objectContaining({ offerId: 'offer-b', addressedDesiredOutcomeIds: ['do-b'] }),
      ]));
      expect(new Set(d.touchpointJobSelections.map(selection => selection.id))).toHaveLength(2);
    });

    it('one DO through Offer A and Offer B preserves both durable paths without duplicates', () => {
      const input = draft([{ jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer', 'offer-b'] }]);
      const d = applyTouchpointIntentDraft(twoOfferScope(), { touchpointId: 'touch', draft: input, newId: ids() });
      expect(d.offerJobSelections.map(selection => selection.offerId).sort()).toEqual(['offer', 'offer-b']);
      expect(d.touchpointJobSelections.map(selection => [selection.offerId, selection.addressedDesiredOutcomeIds])).toEqual(expect.arrayContaining([['offer', ['outcome']], ['offer-b', ['outcome']]]));
      expect(new Set(d.touchpointJobSelections.map(selection => `${selection.offerId}:${selection.productJobIntentId}`)).size).toBe(2);
    });

    it('missing upstream Job path atomically creates Product intent, Offer selection, and Touchpoint selection', () => {
      const before = scoped();
      const d = completed(authorTouchpointIntentBottomUp(before, { touchpointId: 'touch', contributingOfferIds: ['offer'], jobId: 'job', addressedDesiredOutcomeIds: ['outcome'], productJobIntentIds: ['intent'], offerJobSelectionIds: ['offer-selection'], touchpointSelectionIds: ['touch-selection'] }));
      expect(d.productJobIntents).toEqual([{ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] }]);
      expect(d.offerJobSelections).toEqual([{ id: 'offer-selection', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }]);
      expect(d.touchpointJobSelections).toEqual([{ id: 'touch-selection', touchpointId: 'touch', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }]);
      expect(before.productJobIntents).toEqual([]);
    });

    it('existing Product intent without the selected DO is extended additively', () => {
      let d = twoOfferScope();
      d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-b'] });
      d = completed(authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], jobId: 'job', addressedDesiredOutcomeIds: ['outcome'], productJobIntentIds: [], offerJobSelectionIds: ['offer-selection'], touchpointSelectionIds: ['touch-selection'] }));
      expect(d.productJobIntents).toEqual([{ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-b', 'outcome'] }]);
    });

    it('existing Product intent without an Offer selection receives only the missing Offer path', () => {
      let d = twoOfferScope();
      d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] });
      d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['offer-selection'] });
      d = completed(authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer', 'offer-b'], jobId: 'job', addressedDesiredOutcomeIds: ['outcome'], productJobIntentIds: [], offerJobSelectionIds: ['offer-selection-b'], touchpointSelectionIds: ['touch-a', 'touch-b'] }));
      expect(d.productJobIntents).toHaveLength(1);
      expect(d.offerJobSelections).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'offer-selection', addressedDesiredOutcomeIds: ['outcome'] }), expect.objectContaining({ id: 'offer-selection-b', addressedDesiredOutcomeIds: ['outcome'] })]));
    });

    it('repeated Apply is idempotent', () => {
      const intentDraft = draft([{ jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer'] }]);
      const first = applyTouchpointIntentDraft(scoped(), { touchpointId: 'touch', draft: intentDraft, newId: ids('first') });
      const second = applyTouchpointIntentDraft(first, { touchpointId: 'touch', draft: intentDraft, newId: ids('second') });
      expect(second).toEqual(first);
    });

    it('Emotional and Social paths never receive an ordinary DO subset', () => {
      let d = scoped();
      d = addEntity(d, { ...place, entityId: 'emotional', title: 'Feel confident', kind: 'emotional_job' });
      d = addEntity(d, { ...place, entityId: 'social', title: 'Be respected', kind: 'social_job' });
      d = applyTouchpointIntentDraft(d, { touchpointId: 'touch', draft: draft([
        { jobId: 'emotional', semanticLeafId: 'emotional', contributorOfferIds: ['offer'] },
        { jobId: 'social', semanticLeafId: 'social', contributorOfferIds: ['offer'] },
      ]), newId: ids() });
      expect(d.touchpointJobSelections).toHaveLength(2);
      expect(d.touchpointJobSelections.every(selection => selection.addressedDesiredOutcomeIds.length === 0)).toBe(true);
    });

    it('FDO creates only Offer and Touchpoint scope without changing Product intent', () => {
      let d = scoped();
      d = addEntity(d, { ...place, entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome' });
      const productScope = d.productJobIntents;
      d = completed(authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], financialDesiredOutcomeId: 'fdo', offerFinancialIntentIds: ['financial-intent'], touchpointSelectionIds: ['financial-selection'] }));
      expect(d.productJobIntents).toBe(productScope); expect(d.offerJobSelections).toEqual([]); expect(d.touchpointJobSelections).toEqual([]);
      expect(d.offerFinancialIntents).toHaveLength(1); expect(d.touchpointFinancialSelections).toHaveLength(1);
    });

    it('removing a local leaf preserves upstream scope', () => {
      const withLeaf = applyTouchpointIntentDraft(scoped(), { touchpointId: 'touch', draft: draft([{ jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer'] }]), newId: ids() });
      const withoutLeaf = applyTouchpointIntentDraft(withLeaf, { touchpointId: 'touch', draft: draft(), newId: ids('remove') });
      expect(withoutLeaf.productJobIntents).toEqual(withLeaf.productJobIntents); expect(withoutLeaf.offerJobSelections).toEqual(withLeaf.offerJobSelections);
      expect(withoutLeaf.touchpointJobSelections).toEqual([]);
    });

    it('removing one contributor preserves the alternative contributor', () => {
      const both = draft([{ jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer', 'offer-b'] }]);
      let d = applyTouchpointIntentDraft(twoOfferScope(), { touchpointId: 'touch', draft: both, newId: ids() });
      d = applyTouchpointIntentDraft(d, { touchpointId: 'touch', draft: draft([{ jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer-b'] }]), newId: ids('remove') });
      expect(d.touchpointJobSelections).toEqual([expect.objectContaining({ offerId: 'offer-b', addressedDesiredOutcomeIds: ['outcome'] })]);
      expect(d.offerJobSelections.map(selection => selection.offerId).sort()).toEqual(['offer', 'offer-b']);
    });

    it('unlink review identifies alternate contributors', () => {
      let d = applyTouchpointIntentDraft(twoOfferScope(), { touchpointId: 'touch', draft: draft(
        [{ jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer', 'offer-b'] }],
      ), newId: ids() });
      d = addEntity(d, { ...place, entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome' });
      d = applyTouchpointIntentDraft(d, { touchpointId: 'touch', draft: draft(
        [{ jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer', 'offer-b'] }],
        [{ financialDesiredOutcomeId: 'fdo', contributorOfferIds: ['offer'] }],
      ), newId: ids('financial') });
      const upstream = { product: structuredClone(d.productJobIntents), offer: structuredClone(d.offerJobSelections), financial: structuredClone(d.offerFinancialIntents) };

      expect(getTouchpointLinkedOfferChangeImpact(d, { touchpointId: 'touch', linkedOfferIds: ['offer-b'] })).toEqual([
        expect.objectContaining({ kind: 'job', offerId: 'offer', jobId: 'job', desiredOutcomeIds: ['outcome'], alternativeContributingOfferIds: ['offer-b'] }),
        expect.objectContaining({ kind: 'financial', offerId: 'offer', financialDesiredOutcomeId: 'fdo', alternativeContributingOfferIds: [] }),
      ]);
      expect({ product: d.productJobIntents, offer: d.offerJobSelections, financial: d.offerFinancialIntents }).toEqual(upstream);
      expect(getTouchpointLinkedOfferChangeImpact(d, { touchpointId: 'touch', linkedOfferIds: ['offer', 'offer-b'] })).toEqual([]);
    });

    it('Apply error leaves no partial local or upstream changes', () => {
      const d = twoOfferScope(); const before = structuredClone(d);
      expect(() => applyTouchpointIntentDraft(d, { touchpointId: 'touch', draft: draft([
        { jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer'] },
        { jobId: 'job', semanticLeafId: 'do-b', desiredOutcomeId: 'do-b', contributorOfferIds: ['missing'] },
      ]), newId: ids() })).toThrow(/linked/);
      expect(d).toEqual(before); expect(d.productJobIntents).toEqual([]); expect(d.offerJobSelections).toEqual([]); expect(d.touchpointJobSelections).toEqual([]);
    });

    it('mitigation is checked against post-intent relevance', () => {
      let d = twoOfferScope();
      d = addEntity(d, { ...place, entityId: 'other-job', title: 'Other Job', kind: 'core_functional_job' });
      d = addEntity(d, { ...place, entityId: 'other-do', title: 'Other outcome', kind: 'desired_outcome', parentEntityId: 'other-job', relationshipId: 'owns-other-do' });
      d = addEntity(d, { ...place, entityId: 'repulsor', title: 'Friction', kind: 'repulsor', resistedTargetIds: ['job'], relationshipIds: ['resists-job'] });
      d = applyTouchpointIntentDraft(d, { touchpointId: 'touch', draft: draft([{ jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer'] }]), newId: ids() });
      d = setTouchpointMitigations(d, { touchpointId: 'touch', repulsorIds: ['repulsor'], newRelationshipIds: ['mitigates'] });
      d = applyTouchpointIntentDraft(d, { touchpointId: 'touch', draft: draft([{ jobId: 'other-job', semanticLeafId: 'other-do', desiredOutcomeId: 'other-do', contributorOfferIds: ['offer-b'] }]), newId: ids('replacement') });
      expect(d.touchpointJobSelections).toEqual([expect.objectContaining({ offerId: 'offer-b', addressedDesiredOutcomeIds: ['other-do'] })]);
      expect(d.relationships.some(relationship => relationship.kind === 'touchpoint_mitigates_repulsor')).toBe(false);
      expect(() => setTouchpointMitigations(d, { touchpointId: 'touch', repulsorIds: ['repulsor'], newRelationshipIds: ['no-longer-relevant'] })).toThrow(/currently relevant/);
    });
  });
  it('supports top-down all scope and narrowing while rejecting outcomes outside upstream scope', () => {
    let d = scoped();
    d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] });
    d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['offer-selection'] });
    d = selectAllLinkedOfferIntentsForTouchpoint(d, { touchpointId: 'touch', jobSelectionIds: ['touch-selection'], financialSelectionIds: [] });
    expect(d.touchpointJobSelections[0]?.addressedDesiredOutcomeIds).toEqual(['outcome']);
    d = setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'touch-selection', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] }] });
    expect(d.touchpointJobSelections[0]?.addressedDesiredOutcomeIds).toEqual([]);
    expect(() => setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'bad', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['job'] }] })).toThrow();
  });
  it('keeps Offer path identity while changing its explicit subset and reads legacy scope as the Product scope', () => {
    let d = scoped();
    d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] });
    d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['offer-selection'] });
    d = setOfferJobSelections(d, { offerId: 'offer', selections: [{ productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] }], newSelectionIds: [] });
    expect(d.offerJobSelections).toEqual([{ id: 'offer-selection', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] }]);
    expect(() => setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'local', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] })).toThrowError(/immediate Offer scope/);
    const legacy = { ...d, offerJobSelections: [{ id: 'legacy', offerId: 'offer', productJobIntentId: 'intent' }] };
    const selected = setTouchpointIntentSelections(legacy, { touchpointId: 'touch', selections: [{ id: 'legacy-local', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] });
    expect(selected.touchpointJobSelections[0]?.addressedDesiredOutcomeIds).toEqual(['outcome']);
  });
  it('keeps FDO at Offer level and exposes a confirmed cascade impact', () => {
    let d = scoped();
    d = addEntity(d, { ...place, entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome' });
    d = completed(authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], financialDesiredOutcomeId: 'fdo', offerFinancialIntentIds: ['financial-intent'], touchpointSelectionIds: ['touch-financial'] }));
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
    const selected = selectAllLinkedOfferIntentsForTouchpoint(d, { touchpointId: 'touch', jobSelectionIds: ['local'], financialSelectionIds: [] });
    expect(selected.offerJobSelections).toHaveLength(1); expect(selected.touchpointJobSelections[0]?.addressedDesiredOutcomeIds).toEqual([]);
    const authored = completed(authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], jobId: 'job', addressedDesiredOutcomeIds: [], productJobIntentIds: [], offerJobSelectionIds: [], touchpointSelectionIds: ['local'] }));
    expect(authored.touchpointJobSelections[0]?.addressedDesiredOutcomeIds).toEqual([]);
    expect(d.touchpointJobSelections).toEqual([]);
  });
  it('normalizes downstream outcome scope without deleting incomplete upstream intent', () => {
    let d = scoped();
    d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] });
    d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['offer-selection'] });
    d = setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'local', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] });
    d = updateProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: [] });
    expect(d.productJobIntents[0]?.addressedDesiredOutcomeIds).toEqual([]); expect(d.offerJobSelections).toHaveLength(1); expect(d.touchpointJobSelections).toEqual([expect.objectContaining({ id: 'local', addressedDesiredOutcomeIds: [] })]); expect(d.entities.some(entity => entity.id === 'outcome')).toBe(true);
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
    d = completed(authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], jobId: 'job', addressedDesiredOutcomeIds: ['outcome'], productJobIntentIds: ['intent'], offerJobSelectionIds: ['offer-selection'], touchpointSelectionIds: ['local'] }));
    d = addEntity(d, { ...place, entityId: 'repulsor', title: 'Friction', kind: 'repulsor', resistedTargetIds: ['job'], relationshipIds: ['resists'] });
    const relationshipCount = d.relationships.length;
    expect(resistanceImpactForOffer(d, 'offer')).toEqual([{ repulsor: expect.objectContaining({ id: 'repulsor' }), touchpointIds: ['touch'] }]);
    expect(resistanceImpactForProduct(d, 'product')).toEqual([{ repulsor: expect.objectContaining({ id: 'repulsor' }), paths: [{ offerId: 'offer', touchpointId: 'touch' }] }]);
    expect(d.relationships).toHaveLength(relationshipCount);
  });
});

describe('Product intent change impact', () => {
  function downstreamDocument() {
    let d = offerDocument();
    d = addEntity(d, { ...place, entityId: 'job', title: 'Grow', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'do-a', title: 'More leads', kind: 'desired_outcome', parentEntityId: 'job', relationshipId: 'owns-a' });
    d = addEntity(d, { ...place, entityId: 'do-b', title: 'Lower cost', kind: 'desired_outcome', parentEntityId: 'job', relationshipId: 'owns-b' });
    d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] });
    d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['offer-selection'] });
    d = touchpoint(d);
    return setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'touch-selection', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a', 'do-b'] }] });
  }
  it('reports Offer and Touchpoint paths removed with a Product Job Intent', () => {
    expect(getProductIntentChangeImpact(downstreamDocument(), { productId: 'product', intents: [] })).toEqual({ offerJobSelectionIds: ['offer-selection'], touchpointJobSelectionIds: ['touch-selection'], narrowedOfferSelections: [], narrowedTouchpointSelections: [] });
  });
  it('reports only the removed Desired Outcome scope and preserves contributing paths', () => {
    expect(getProductIntentChangeImpact(downstreamDocument(), { productId: 'product', intents: [{ jobId: 'job', addressedDesiredOutcomeIds: ['do-a'] }] })).toEqual({ offerJobSelectionIds: [], touchpointJobSelectionIds: [], narrowedOfferSelections: [{ offerJobSelectionId: 'offer-selection', removedDesiredOutcomeIds: ['do-b'] }], narrowedTouchpointSelections: [{ touchpointJobSelectionId: 'touch-selection', removedDesiredOutcomeIds: ['do-b'] }] });
  });
  it('has no impact for additive Product intent', () => {
    const d = downstreamDocument();
    expect(getProductIntentChangeImpact(d, { productId: 'product', intents: [{ jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] }] })).toEqual({ offerJobSelectionIds: [], touchpointJobSelectionIds: [], narrowedOfferSelections: [], narrowedTouchpointSelections: [] });
  });
});

describe('bottom-up structural ancestry propagation', () => {
  function ancestryDocument(parentOffers = ['offer'], grandparentOffers = ['offer']) {
    let d = offerDocument();
    for (const offerId of [...new Set([...parentOffers, ...grandparentOffers])].filter(id => id !== 'offer')) d = addEntity(d, { ...place, entityId: offerId, title: offerId, kind: 'offer', linkedProductId: 'product', relationshipId: `packaged-${offerId}` });
    d = addEntity(d, { ...place, entityId: 'grandparent', title: 'Grandparent', kind: 'touchpoint', linkedOfferIds: grandparentOffers, relationshipIds: grandparentOffers.map(id => `grandparent-${id}`) });
    d = addEntity(d, { ...place, entityId: 'parent', title: 'Parent', kind: 'touchpoint', linkedOfferIds: parentOffers, relationshipIds: parentOffers.map(id => `parent-${id}`), parentTouchpointId: 'grandparent', parentRelationshipId: 'grandparent-contains-parent' });
    d = addEntity(d, { ...place, entityId: 'child', title: 'Child', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['child-offer'], parentTouchpointId: 'parent', parentRelationshipId: 'parent-contains-child' });
    d = addEntity(d, { ...place, entityId: 'job', title: 'Job', kind: 'core_functional_job' });
    return addEntity(d, { ...place, entityId: 'outcome', title: 'Outcome', kind: 'desired_outcome', parentEntityId: 'job', relationshipId: 'job-outcome' });
  }
  const jobInput = (extra = {}) => ({ touchpointId: 'child', contributingOfferIds: ['offer'], jobId: 'job', addressedDesiredOutcomeIds: ['outcome'], productJobIntentIds: ['intent'], offerJobSelectionIds: ['offer-selection'], touchpointSelectionIds: ['child-selection', 'parent-selection', 'grandparent-selection'], ...extra });

  it('propagates the same DO scope through a child, parent, and grandparent using each local contributor', () => {
    const d = completed(authorTouchpointIntentBottomUp(ancestryDocument(), jobInput()));
    expect(d.touchpointJobSelections.map(selection => [selection.touchpointId, selection.offerId, selection.addressedDesiredOutcomeIds])).toEqual([
      ['child', 'offer', ['outcome']], ['parent', 'offer', ['outcome']], ['grandparent', 'offer', ['outcome']],
    ]);
  });

  it('reports ambiguous ancestor candidates without changing the input and accepts an explicit stable-ID choice', () => {
    const before = ancestryDocument(['offer', 'offer-b']); const snapshot = structuredClone(before);
    const unresolved = authorTouchpointIntentBottomUp(before, jobInput());
    expect(unresolved).toEqual({ status: 'unresolved', reason: 'ancestor_contributor_required', touchpointId: 'parent', candidateOfferIds: ['offer', 'offer-b'] });
    expect(before).toEqual(snapshot);
    const d = completed(authorTouchpointIntentBottomUp(before, jobInput({ ancestorContributingOfferIds: { parent: 'offer-b' }, offerJobSelectionIds: ['offer-selection', 'offer-b-selection'] })));
    expect(d.touchpointJobSelections.find(selection => selection.touchpointId === 'parent')?.offerId).toBe('offer-b');
    expect(d.touchpointJobSelections.filter(selection => selection.touchpointId === 'parent')).toHaveLength(1);
  });

  it('identifies the ancestor, semantic leaf, and candidate Offers when draft authoring genuinely needs a choice', () => {
    const before = ancestryDocument(['offer', 'offer-b']);
    let sequence = 0;
    expect(() => applyTouchpointIntentDraft(before, {
      touchpointId: 'child',
      draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'outcome', desiredOutcomeId: 'outcome', contributorOfferIds: ['offer'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] },
      newId: () => `specific-context-${++sequence}`,
    })).toThrow('Choose a contributing Offer for ancestor Touchpoint Parent (parent) while authoring Outcome (outcome). Candidates: Subscription (offer), offer-b (offer-b).');
  });

  it('skips an ancestor whose semantic leaf is already durably satisfied', () => {
    const before = ancestryDocument(['offer', 'offer-b']);
    before.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] });
    before.offerJobSelections.push({ id: 'offer-selection', offerId: 'offer', productJobIntentId: 'intent' });
    before.touchpointJobSelections.push({ id: 'parent-existing', touchpointId: 'parent', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] });
    const d = completed(authorTouchpointIntentBottomUp(before, { ...jobInput(), productJobIntentIds: [], offerJobSelectionIds: [], touchpointSelectionIds: ['child-selection', 'grandparent-selection'] }));
    expect(d.touchpointJobSelections.filter(selection => selection.touchpointId === 'parent')).toEqual([before.touchpointJobSelections[0]]);
    expect(d.touchpointJobSelections.some(selection => selection.touchpointId === 'parent' && selection.offerId === 'offer-b')).toBe(false);
  });

  it('treats a broader ancestor Job plus DO path as satisfying Job-only authoring', () => {
    const before = ancestryDocument(['offer', 'offer-b']);
    before.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] });
    before.offerJobSelections.push({ id: 'offer-selection', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] });
    before.touchpointJobSelections.push({ id: 'parent-existing', touchpointId: 'parent', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] });
    const d = completed(authorTouchpointIntentBottomUp(before, { touchpointId: 'child', contributingOfferIds: ['offer'], jobId: 'job', addressedDesiredOutcomeIds: [], productJobIntentIds: [], offerJobSelectionIds: [], touchpointSelectionIds: ['child-selection', 'grandparent-selection'] }));
    expect(d.touchpointJobSelections.filter(selection => selection.touchpointId === 'parent')).toEqual([before.touchpointJobSelections[0]]);
  });

  it('returns invalid when an ancestor has no local contributor path and never creates a structural Offer relation', () => {
    const before = ancestryDocument();
    const relationships = before.relationships.filter(relation => !(relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === 'parent'));
    const malformed = { ...before, relationships }; const snapshot = structuredClone(malformed);
    expect(authorTouchpointIntentBottomUp(malformed, jobInput())).toEqual({ status: 'invalid', reason: 'no_ancestor_contributor_path', touchpointId: 'parent' });
    expect(malformed).toEqual(snapshot);
  });

  it('retains semantic paths without consuming IDs and rejects insufficient, duplicate, and colliding IDs atomically', () => {
    const first = completed(authorTouchpointIntentBottomUp(ancestryDocument(), jobInput()));
    expect(completed(authorTouchpointIntentBottomUp(first, { ...jobInput(), productJobIntentIds: [], offerJobSelectionIds: [], touchpointSelectionIds: [] }))).toEqual(first);
    for (const ids of [['only-one'], ['same', 'same', 'same'], ['intent', 'fresh', 'fresh-2']]) {
      const before = ancestryDocument(); const snapshot = structuredClone(before);
      expect(() => authorTouchpointIntentBottomUp(before, { ...jobInput(), touchpointSelectionIds: ids })).toThrow();
      expect(before).toEqual(snapshot);
    }
  });

  it('rejects multi-parent and cyclic containment before any mutation', () => {
    for (const relationship of [
      { id: 'second-parent', kind: 'touchpoint_contains_touchpoint' as const, parentTouchpointId: 'grandparent', childTouchpointId: 'child' },
      { id: 'cycle', kind: 'touchpoint_contains_touchpoint' as const, parentTouchpointId: 'child', childTouchpointId: 'grandparent' },
    ]) {
      const before = ancestryDocument(); before.relationships.push(relationship); const snapshot = structuredClone(before);
      expect(() => authorTouchpointIntentBottomUp(before, jobInput())).toThrow(); expect(before).toEqual(snapshot);
    }
  });

  it('propagates FDO through ancestor Offers without creating Product Job scope', () => {
    let before = ancestryDocument(['offer-b'], ['offer']);
    before = addEntity(before, { ...place, entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome' });
    const d = completed(authorTouchpointIntentBottomUp(before, { touchpointId: 'child', contributingOfferIds: ['offer'], financialDesiredOutcomeId: 'fdo', offerFinancialIntentIds: ['offer-fdo', 'offer-b-fdo'], touchpointSelectionIds: ['child-fdo', 'parent-fdo', 'grandparent-fdo'] }));
    expect(d.touchpointFinancialSelections.map(selection => [selection.touchpointId, selection.offerId])).toEqual([['child', 'offer'], ['parent', 'offer-b'], ['grandparent', 'offer']]);
    expect(d.productJobIntents).toEqual([]); expect(d.offerJobSelections).toEqual([]);
  });
});

describe('Touchpoint local Job path subset planning', () => {
  function localSubsetDocument(outcomes: string[]) {
    let d = touchpoint();
    d = addEntity(d, { ...place, entityId: 'job', title: 'Job', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'do-a', title: 'A', kind: 'desired_outcome', parentEntityId: 'job', relationshipId: 'owns-a' });
    d = addEntity(d, { ...place, entityId: 'do-b', title: 'B', kind: 'desired_outcome', parentEntityId: 'job', relationshipId: 'owns-b' });
    d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] });
    d = setOfferJobSelections(d, { offerId: 'offer', productJobIntentIds: ['intent'], newSelectionIds: ['offer-selection'] });
    return setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'touch-selection', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: outcomes }] });
  }

  it('expands the mutable DO subset while retaining the stable local path ID', () => {
    const before = localSubsetDocument(['do-a']); const upstream = structuredClone({ product: before.productJobIntents, offer: before.offerJobSelections });
    const plan = planTouchpointIntentPathChange(before, { target: { kind: 'job', touchpointId: 'touch', offerId: 'offer', productJobIntentId: 'intent', semanticLeafId: 'do-b' }, checked: true, newSelectionId: 'must-not-be-used' });
    const next = commitTouchpointIntentPathPlan(before, plan);
    expect(next.touchpointJobSelections).toEqual([{ id: 'touch-selection', touchpointId: 'touch', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a', 'do-b'] }]);
    expect({ product: next.productJobIntents, offer: next.offerJobSelections }).toEqual(upstream);
  });

  it('narrows the mutable DO subset while retaining siblings and stable local path ID', () => {
    const before = localSubsetDocument(['do-a', 'do-b']); const snapshot = structuredClone(before);
    const plan = planTouchpointIntentPathChange(before, { target: { kind: 'job', touchpointId: 'touch', offerId: 'offer', productJobIntentId: 'intent', semanticLeafId: 'do-a' }, checked: false });
    const next = commitTouchpointIntentPathPlan(before, plan);
    expect(next.touchpointJobSelections).toEqual([{ id: 'touch-selection', touchpointId: 'touch', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-b'] }]);
    expect(next.productJobIntents).toEqual(snapshot.productJobIntents); expect(next.offerJobSelections).toEqual(snapshot.offerJobSelections);
  });
});

describe('Touchpoint structural subtree planning', () => {
  function semanticMoveDocument(targetOfferIds: string[] = ['offer-b'], includeSibling = false) {
    let d = offerDocument();
    for (const offerId of [...new Set(targetOfferIds)].filter(id => id !== 'orphan-offer')) d = addEntity(d, { ...place, entityId: offerId, title: offerId, kind: 'offer', linkedProductId: 'product', relationshipId: `packages-${offerId}` });
    if (targetOfferIds.includes('orphan-offer')) d = { ...d, entities: [...d.entities, { id: 'orphan-offer', title: 'Orphan Offer', kind: 'offer' }] };
    d = addEntity(d, { ...place, entityId: 'old-parent', title: 'Old Parent', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['old-parent-offer'] });
    d = addEntity(d, { ...place, entityId: 'new-parent', title: 'New Parent', kind: 'touchpoint', linkedOfferIds: targetOfferIds, relationshipIds: targetOfferIds.map(id => `new-parent-${id}`) });
    d = addEntity(d, { ...place, entityId: 'moved', title: 'Moved', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['moved-offer'], parentTouchpointId: 'old-parent', parentRelationshipId: 'old-moved' });
    d = addEntity(d, { ...place, entityId: 'deep', title: 'Deep', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['deep-offer'], parentTouchpointId: 'moved', parentRelationshipId: 'moved-deep' });
    if (includeSibling) d = addEntity(d, { ...place, entityId: 'sibling', title: 'Sibling', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['sibling-offer'], parentTouchpointId: 'old-parent', parentRelationshipId: 'old-sibling' });
    d = addEntity(d, { ...place, entityId: 'job', title: 'Job', kind: 'core_functional_job' });
    d = addEntity(d, { ...place, entityId: 'outcome', title: 'Outcome', kind: 'desired_outcome', parentEntityId: 'job', relationshipId: 'job-outcome' });
    d = addEntity(d, { ...place, entityId: 'fdo', title: 'FDO', kind: 'financial_desired_outcome' });
    d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['outcome'] });
    d = setOfferJobSelections(d, { offerId: 'offer', selections: [{ productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }], newSelectionIds: ['offer-job'] });
    d = setOfferFinancialIntents(d, { offerId: 'offer', financialDesiredOutcomeIds: ['fdo'], newIntentIds: ['offer-fdo'] });
    return d;
  }
  const allocator = () => { let next = 0; return () => `planned-${next++}`; };

  it('detaches one root without changing its subtree, semantic records, entity, or placement', () => {
    let before = touchpoint(); before = touchpoint(before, 'child', 'touch'); before = touchpoint(before, 'grandchild', 'child');
    before.touchpointJobSelections.push({ id: 'local', touchpointId: 'child', offerId: 'offer', productJobIntentId: 'missing', addressedDesiredOutcomeIds: [] });
    const snapshot = structuredClone(before);
    const result = planTouchpointStructuralChange(before, { command: { kind: 'detach', childTouchpointIds: ['child'] }, newId: () => 'unused' });
    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;
    expect(result.document.relationships.some(relation => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === 'child')).toBe(false);
    expect(result.document.relationships).toContainEqual({ id: 'contains-grandchild', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'child', childTouchpointId: 'grandchild' });
    expect(result.document.entities).toEqual(before.entities); expect(result.document.placements).toEqual(before.placements); expect(result.document.touchpointJobSelections).toEqual(before.touchpointJobSelections);
    expect(before).toEqual(snapshot);
  });

  it('detach all is one immutable commit over the source snapshot', () => {
    let before = touchpoint(); before = touchpoint(before, 'a', 'touch'); before = touchpoint(before, 'b', 'touch'); before = touchpoint(before, 'nested', 'a');
    const result = planTouchpointStructuralChange(before, { command: { kind: 'detach', childTouchpointIds: ['a', 'b'] }, newId: () => 'unused' });
    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;
    expect(result.document.relationships.filter(relation => relation.kind === 'touchpoint_contains_touchpoint')).toEqual([{ id: 'contains-nested', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'a', childTouchpointId: 'nested' }]);
  });

  it('rejects attaching an already-parented root and a cycle without mutation', () => {
    let before = touchpoint(); before = touchpoint(before, 'child', 'touch'); before = touchpoint(before, 'grandchild', 'child'); const snapshot = structuredClone(before);
    expect(planTouchpointStructuralChange(before, { command: { kind: 'attach', childTouchpointIds: ['child'], targetParentTouchpointId: 'grandchild' }, newId: () => 'new' })).toMatchObject({ status: 'invalid', reason: 'already_parented' });
    expect(planTouchpointStructuralChange(before, { command: { kind: 'reassign', childTouchpointIds: ['child'], targetParentTouchpointId: 'grandchild' }, newId: () => 'new' })).toMatchObject({ status: 'invalid', reason: 'structural_cycle' });
    expect(before).toEqual(snapshot);
  });

  it('reassigns an authored branch and reconciles root Job membership plus a deep DO through one contributor', () => {
    let before = semanticMoveDocument();
    before = setTouchpointIntentSelections(before, { touchpointId: 'moved', selections: [{ id: 'moved-job', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] }] });
    before = setTouchpointIntentSelections(before, { touchpointId: 'deep', selections: [{ id: 'deep-job', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] });
    before = setTouchpointIntentSelections(before, { touchpointId: 'old-parent', selections: [{ id: 'old-job', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] });
    const snapshot = structuredClone(before);
    const result = planTouchpointStructuralChange(before, { command: { kind: 'reassign', childTouchpointIds: ['moved'], targetParentTouchpointId: 'new-parent' }, newId: allocator() });
    expect(result.status).toBe('complete'); if (result.status !== 'complete') return;
    expect(result.document.relationships).toContainEqual({ id: 'old-moved', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'new-parent', childTouchpointId: 'moved' });
    expect(result.document.relationships).toContainEqual({ id: 'moved-deep', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'moved', childTouchpointId: 'deep' });
    expect(result.document.touchpointJobSelections.find(item => item.touchpointId === 'new-parent')).toMatchObject({ offerId: 'offer-b', addressedDesiredOutcomeIds: ['outcome'] });
    expect(result.document.touchpointJobSelections.find(item => item.id === 'old-job')).toEqual(before.touchpointJobSelections.find(item => item.id === 'old-job'));
    expect(result.affectedAncestorTouchpointIds).toEqual(['new-parent']);
    expect(before).toEqual(snapshot);
  });

  it('keeps FDO Offer-owned while reconciling it through the new ancestry', () => {
    let before = semanticMoveDocument();
    before = setTouchpointIntentSelections(before, { touchpointId: 'deep', selections: [{ id: 'deep-fdo', kind: 'financial', offerId: 'offer', offerFinancialIntentId: 'offer-fdo' }] });
    const productScope = structuredClone(before.productJobIntents);
    const result = planTouchpointStructuralChange(before, { command: { kind: 'reassign', childTouchpointIds: ['moved'], targetParentTouchpointId: 'new-parent' }, newId: allocator() });
    expect(result.status).toBe('complete'); if (result.status !== 'complete') return;
    expect(result.document.offerFinancialIntents).toContainEqual(expect.objectContaining({ offerId: 'offer-b', financialDesiredOutcomeId: 'fdo' }));
    expect(result.document.touchpointFinancialSelections).toContainEqual(expect.objectContaining({ touchpointId: 'new-parent', offerId: 'offer-b', financialDesiredOutcomeId: 'fdo' }));
    expect(result.document.productJobIntents).toEqual(productScope);
  });

  it('returns one stable unresolved contributor obligation and completes after that choice without interim mutation', () => {
    let before = semanticMoveDocument(['offer-b', 'offer-c']);
    before = setTouchpointIntentSelections(before, { touchpointId: 'deep', selections: [{ id: 'deep-job', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] });
    const snapshot = structuredClone(before); const command = { kind: 'reassign' as const, childTouchpointIds: ['moved'], targetParentTouchpointId: 'new-parent' };
    const unresolved = planTouchpointStructuralChange(before, { command, newId: allocator() });
    expect(unresolved).toMatchObject({ status: 'unresolved', touchpointId: 'new-parent', sourceTouchpointId: 'deep', candidateOfferIds: ['offer-b', 'offer-c'] });
    expect(before).toEqual(snapshot);
    if (unresolved.status !== 'unresolved') return;
    const complete = planTouchpointStructuralChange(before, { command, ancestorContributorChoices: { [unresolved.obligationKey]: 'offer-c' }, newId: allocator() });
    expect(complete.status).toBe('complete'); if (complete.status !== 'complete') return;
    expect(complete.document.touchpointJobSelections).toContainEqual(expect.objectContaining({ touchpointId: 'new-parent', offerId: 'offer-c', addressedDesiredOutcomeIds: ['outcome'] }));
  });

  it('returns invalid without publishing containment when the new ancestry has no contributor path', () => {
    let before = semanticMoveDocument();
    before = setTouchpointIntentSelections(before, { touchpointId: 'moved', selections: [{ id: 'moved-job', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] }] });
    before = { ...before, relationships: before.relationships.filter(relation => !(relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === 'new-parent')) };
    const snapshot = structuredClone(before);
    expect(planTouchpointStructuralChange(before, { command: { kind: 'reassign', childTouchpointIds: ['moved'], targetParentTouchpointId: 'new-parent' }, newId: allocator() })).toMatchObject({ status: 'invalid', reason: 'no_ancestor_contributor_path', touchpointId: 'new-parent' });
    expect(before).toEqual(snapshot);
    expect(before.relationships).toContainEqual(expect.objectContaining({ parentTouchpointId: 'old-parent', childTouchpointId: 'moved' }));
  });

  it('bulk reassign applies semantic additions from every branch in one complete document', () => {
    let before = semanticMoveDocument(['offer-b'], true);
    before = setTouchpointIntentSelections(before, { touchpointId: 'deep', selections: [{ id: 'deep-job', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] });
    before = setTouchpointIntentSelections(before, { touchpointId: 'sibling', selections: [{ id: 'sibling-fdo', kind: 'financial', offerId: 'offer', offerFinancialIntentId: 'offer-fdo' }] });
    before = setTouchpointIntentSelections(before, { touchpointId: 'old-parent', selections: [{ id: 'old-job', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }, { id: 'old-fdo', kind: 'financial', offerId: 'offer', offerFinancialIntentId: 'offer-fdo' }] });
    const oldJob = before.touchpointJobSelections.find(selection => selection.id === 'old-job'); const oldFdo = before.touchpointFinancialSelections.find(selection => selection.id === 'old-fdo');
    const result = planTouchpointStructuralChange(before, { command: { kind: 'reassign', childTouchpointIds: ['moved', 'sibling'], targetParentTouchpointId: 'new-parent' }, newId: allocator() });
    expect(result.status).toBe('complete'); if (result.status !== 'complete') return;
    expect(result.document.relationships.flatMap(relation => relation.kind === 'touchpoint_contains_touchpoint' && ['moved', 'sibling'].includes(relation.childTouchpointId) ? [relation.parentTouchpointId] : [])).toEqual(['new-parent', 'new-parent']);
    expect(result.document.touchpointJobSelections).toContainEqual(expect.objectContaining({ touchpointId: 'new-parent', offerId: 'offer-b', addressedDesiredOutcomeIds: ['outcome'] }));
    expect(result.document.touchpointFinancialSelections).toContainEqual(expect.objectContaining({ touchpointId: 'new-parent', offerId: 'offer-b', financialDesiredOutcomeId: 'fdo' }));
    expect(result.document.touchpointJobSelections.find(selection => selection.id === 'old-job')).toEqual(oldJob);
    expect(result.document.touchpointFinancialSelections.find(selection => selection.id === 'old-fdo')).toEqual(oldFdo);
    expect(result.affectedAncestorTouchpointIds).toEqual(['new-parent']);
  });

  it('bulk invalidation after an earlier branch plan leaves every branch on its old parent', () => {
    let before = semanticMoveDocument(['orphan-offer'], true);
    before = setTouchpointIntentSelections(before, { touchpointId: 'moved', selections: [{ id: 'moved-fdo', kind: 'financial', offerId: 'offer', offerFinancialIntentId: 'offer-fdo' }] });
    before = setTouchpointIntentSelections(before, { touchpointId: 'sibling', selections: [{ id: 'sibling-job', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] });
    const snapshot = structuredClone(before);
    const result = planTouchpointStructuralChange(before, { command: { kind: 'reassign', childTouchpointIds: ['moved', 'sibling'], targetParentTouchpointId: 'new-parent' }, newId: allocator() });
    expect(result).toMatchObject({ status: 'invalid', reason: 'no_ancestor_contributor_path', touchpointId: 'new-parent' });
    expect(before).toEqual(snapshot);
    expect(before.relationships.flatMap(relation => relation.kind === 'touchpoint_contains_touchpoint' && ['moved', 'sibling'].includes(relation.childTouchpointId) ? [relation.parentTouchpointId] : [])).toEqual(['old-parent', 'old-parent']);
    expect(before.offerFinancialIntents.some(intent => intent.offerId === 'orphan-offer')).toBe(false);
  });
});
