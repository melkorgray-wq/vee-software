import { describe, expect, it } from 'vitest';
import { createEmptyMapDocument, relevantRepulsorsForTouchpoint, type MapDocument } from '@vee/domain';
import { applyTouchpointEditDraft, commitOfferConnectedTouchpoint, commitTouchpointBusinessProperty, commitTouchpointLinkedOffers, commitTouchpointMitigation, commitTouchpointParent, connectionPickerCatalogue, createTouchpointIntentDraft, equalTouchpointIntentDraft, filterConnectionCandidates, globalIntentDiscovery, replaceTouchpointLinkedOffer, selectCurrentOfferIntent, touchpointClientScope, touchpointIntentCatalogue, touchpointUpstreamSources, validateTouchpointIntentDraft } from './touchpoint-edit';

function fixture(): MapDocument {
  return {
    ...createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' }),
    entities: [
      { id: 'job', kind: 'core_functional_job', title: 'Job' }, { id: 'emotional', kind: 'emotional_job', title: 'Feel safe' },
      { id: 'do-a', kind: 'desired_outcome', title: 'DO A' }, { id: 'do-b', kind: 'desired_outcome', title: 'DO B' },
      { id: 'fdo', kind: 'financial_desired_outcome', title: 'Affordable' }, { id: 'product', kind: 'product', title: 'Product' },
      { id: 'offer-a', kind: 'offer', title: 'Offer A' }, { id: 'offer-b', kind: 'offer', title: 'Offer B' }, { id: 'touch', kind: 'touchpoint', title: 'Touchpoint' },
    ],
    relationships: [
      { id: 'owns-a', kind: 'job_has_desired_outcome', jobId: 'job', desiredOutcomeId: 'do-a' }, { id: 'owns-b', kind: 'job_has_desired_outcome', jobId: 'job', desiredOutcomeId: 'do-b' },
      { id: 'packages-a', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' }, { id: 'packages-b', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-b' },
      { id: 'presents-a', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touch' }, { id: 'presents-b', kind: 'offer_presented_at_touchpoint', offerId: 'offer-b', touchpointId: 'touch' },
    ],
    productJobIntents: [{ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] }],
    offerJobSelections: [{ id: 'offer-job-a', offerId: 'offer-a', productJobIntentId: 'intent' }, { id: 'offer-job-b', offerId: 'offer-b', productJobIntentId: 'intent' }],
    touchpointJobSelections: [
      { id: 'path-a', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
      { id: 'path-b', touchpointId: 'touch', offerId: 'offer-b', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a', 'do-b'] },
    ],
  };
}

function tqoDetachSequenceFixture(): MapDocument {
  const document = fixture();
  document.entities.push(
    { id: 'offer-clarity', kind: 'offer', title: 'Marketing clarity' },
    { id: 'offer-launch', kind: 'offer', title: 'Launch from scratch' },
    { id: 'tp-leadform', kind: 'touchpoint', title: 'Partnership request' },
    { id: 'tp-book-call', kind: 'touchpoint', title: 'Leadform · Book a call' },
    { id: 'tp-send-context', kind: 'touchpoint', title: 'Leadform · Send context' },
  );
  document.relationships.push(
    { id: 'packages-clarity', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-clarity' },
    { id: 'packages-launch', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-launch' },
    { id: 'leadform-book', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'tp-leadform', childTouchpointId: 'tp-book-call' },
    { id: 'leadform-context', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'tp-leadform', childTouchpointId: 'tp-send-context' },
    ...['offer-a', 'offer-b', 'offer-clarity', 'offer-launch'].flatMap(offerId => ['tp-leadform', 'tp-book-call', 'tp-send-context'].map(touchpointId => ({ id: `${offerId}-${touchpointId}`, kind: 'offer_presented_at_touchpoint' as const, offerId, touchpointId }))),
  );
  document.offerJobSelections.push(
    { id: 'clarity-onboard', offerId: 'offer-clarity', productJobIntentId: 'intent' },
    { id: 'launch-onboard', offerId: 'offer-launch', productJobIntentId: 'intent' },
  );
  document.touchpointJobSelections.push(
    { id: 'leadform-onboard', touchpointId: 'tp-leadform', offerId: 'offer-clarity', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
    { id: 'book-onboard-a', touchpointId: 'tp-book-call', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
    { id: 'book-onboard-clarity', touchpointId: 'tp-book-call', offerId: 'offer-clarity', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
    { id: 'context-clarity', touchpointId: 'tp-send-context', offerId: 'offer-clarity', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
    { id: 'context-onboard', touchpointId: 'tp-send-context', offerId: 'offer-launch', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
  );
  return document;
}

describe('Touchpoint linked Offer commit', () => {
  it('retains relationship IDs, allocates only additions, removes safely, and does not mutate input', () => {
    const document = fixture();
    document.entities.push({ id: 'offer-c', kind: 'offer', title: 'Offer C' });
    const snapshot = structuredClone(document);
    const ids = ['presents-c'];
    const added = commitTouchpointLinkedOffers(document, { touchpointId: 'touch', linkedOfferIds: ['offer-b', 'offer-c'], confirmedRemoval: true, newId: () => ids.shift()! });
    expect(added.relationships).toContainEqual(expect.objectContaining({ id: 'presents-b', offerId: 'offer-b', touchpointId: 'touch' }));
    expect(added.relationships).toContainEqual(expect.objectContaining({ id: 'presents-c', offerId: 'offer-c', touchpointId: 'touch' }));
    expect(added.relationships).not.toContainEqual(expect.objectContaining({ id: 'presents-a' }));
    expect(added.relationships.filter(relation => relation.kind !== 'offer_presented_at_touchpoint')).toEqual(document.relationships.filter(relation => relation.kind !== 'offer_presented_at_touchpoint'));
    expect(document).toEqual(snapshot);
  });
});

describe('Offer connected Touchpoint inverse commit', () => {
  it('attaches and safely detaches through the Touchpoint owner without mutating the input', () => {
    const document = fixture();
    document.entities.push({ id: 'touch-b', kind: 'touchpoint', title: 'Other', locatedInId: 'site', url: 'https://example.test' });
    document.touchpointContainers.push({ id: 'site', title: 'Site' });
    document.relationships.push(
      { id: 'presents-b-other', kind: 'offer_presented_at_touchpoint', offerId: 'offer-b', touchpointId: 'touch-b' },
      { id: 'contains', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'touch', childTouchpointId: 'touch-b' },
    );
    const snapshot = structuredClone(document);
    const attached = commitOfferConnectedTouchpoint(document, { offerId: 'offer-a', touchpointId: 'touch-b', connected: true, newId: () => 'presents-a-other' });
    expect(attached.relationships).toContainEqual({ id: 'presents-a-other', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touch-b' });
    expect(document).toEqual(snapshot);
    const detached = commitOfferConnectedTouchpoint(attached, { offerId: 'offer-a', touchpointId: 'touch-b', connected: false, confirmedRemoval: true, newId: () => { throw new Error('must not allocate'); } });
    expect(detached.relationships).not.toContainEqual(expect.objectContaining({ id: 'presents-a-other' }));
    expect(detached.relationships).toContainEqual(expect.objectContaining({ id: 'presents-b-other' }));
    expect(detached.relationships).toContainEqual(expect.objectContaining({ id: 'contains' }));
    expect(detached.entities.find(entity => entity.id === 'touch-b')).toMatchObject({ locatedInId: 'site', url: 'https://example.test' });
    expect(detached.touchpointJobSelections).toEqual(document.touchpointJobSelections);
  });

  it('rejects removing the final Offer and unknown endpoints, and preserves no-op identity', () => {
    const document = fixture();
    expect(commitOfferConnectedTouchpoint(document, { offerId: 'offer-a', touchpointId: 'touch', connected: true, newId: () => 'unused' })).toBe(document);
    expect(() => commitOfferConnectedTouchpoint(document, { offerId: 'missing', touchpointId: 'touch', connected: true, newId: () => 'unused' })).toThrow('Offer does not exist.');
    expect(() => commitOfferConnectedTouchpoint(document, { offerId: 'offer-a', touchpointId: 'missing', connected: true, newId: () => 'unused' })).toThrow('Touchpoint does not exist.');
    const sole = { ...document, relationships: document.relationships.filter(relation => relation.id !== 'presents-b') };
    expect(() => commitOfferConnectedTouchpoint(sole, { offerId: 'offer-a', touchpointId: 'touch', connected: false, confirmedRemoval: true, newId: () => 'unused' })).toThrow('A Touchpoint must present at least one Offer.');
    expect(sole.relationships).toContainEqual(expect.objectContaining({ id: 'presents-a' }));
  });

  it('confirmed removal prunes only downstream records that lose the removed contributor path', () => {
    const document = fixture();
    const committed = commitOfferConnectedTouchpoint(document, { offerId: 'offer-a', touchpointId: 'touch', connected: false, confirmedRemoval: true, newId: () => 'unused' });
    expect(committed.touchpointJobSelections).toEqual([{ id: 'path-b', touchpointId: 'touch', offerId: 'offer-b', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a', 'do-b'] }]);
    expect(committed.offerJobSelections.map(selection => selection.id)).toEqual(document.offerJobSelections.map(selection => selection.id));
    expect(committed.productJobIntents).toEqual(document.productJobIntents);
  });

  it('reproduces the TQO bottom-up sequence without reauthoring surviving committed intent', () => {
    let document = tqoDetachSequenceFixture();

    // The successful first operation has an already-authored ancestor leaf.
    document = commitOfferConnectedTouchpoint(document, { offerId: 'offer-clarity', touchpointId: 'tp-book-call', connected: false, confirmedRemoval: true, newId: () => { throw new Error('must not author'); } });
    expect(document.touchpointJobSelections).toContainEqual(expect.objectContaining({ id: 'book-onboard-a' }));
    expect(document.touchpointJobSelections).not.toContainEqual(expect.objectContaining({ id: 'book-onboard-clarity' }));

    // State immediately before the formerly failing operation: the parent leaf has
    // been removed, while Send context retains Launch → DO A and has three viable
    // ancestor contributor Offers. A structural detach must not reauthor that leaf.
    document = commitOfferConnectedTouchpoint(document, { offerId: 'offer-clarity', touchpointId: 'tp-leadform', connected: false, confirmedRemoval: true, newId: () => { throw new Error('must not author'); } });
    expect(document.touchpointJobSelections.filter(selection => selection.touchpointId === 'tp-leadform')).toEqual([]);
    expect(document.touchpointJobSelections).toContainEqual(expect.objectContaining({ id: 'context-onboard', offerId: 'offer-launch', addressedDesiredOutcomeIds: ['do-a'] }));
    expect(document.relationships.flatMap(relation => relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === 'tp-leadform' ? [relation.offerId] : []).sort()).toEqual(['offer-a', 'offer-b', 'offer-launch']);

    document = commitOfferConnectedTouchpoint(document, { offerId: 'offer-clarity', touchpointId: 'tp-send-context', connected: false, confirmedRemoval: true, newId: () => { throw new Error('must not author'); } });
    expect(document.touchpointJobSelections).toContainEqual(expect.objectContaining({ id: 'context-onboard', offerId: 'offer-launch' }));
    expect(document.touchpointJobSelections).not.toContainEqual(expect.objectContaining({ id: 'context-clarity' }));
    expect(document.touchpointJobSelections.filter(selection => selection.touchpointId === 'tp-leadform')).toEqual([]);
  });
});

describe('atomic Touchpoint Offer replacement', () => {
  it('replaces the sole Offer without mutating input, prunes only departing paths, and authors no replacement intent', () => {
    const document = fixture();
    document.relationships = document.relationships.filter(relation => relation.id !== 'presents-b');
    document.touchpointJobSelections = document.touchpointJobSelections.filter(selection => selection.id !== 'path-b');
    document.entities.push({ id: 'other-touch', kind: 'touchpoint', title: 'Other Touchpoint' });
    document.relationships.push({ id: 'other-link', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'other-touch' });
    document.touchpointJobSelections.push({ id: 'other-touch-path', touchpointId: 'other-touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] });
    const snapshot = structuredClone(document);
    const replaced = replaceTouchpointLinkedOffer(document, { touchpointId: 'touch', departingOfferId: 'offer-a', replacementOfferId: 'offer-b', confirmedRemoval: true, newId: () => 'replacement-link' });
    expect(document).toEqual(snapshot);
    expect(replaced.relationships).toContainEqual({ id: 'replacement-link', kind: 'offer_presented_at_touchpoint', offerId: 'offer-b', touchpointId: 'touch' });
    expect(replaced.relationships).not.toContainEqual(expect.objectContaining({ id: 'presents-a' }));
    expect(replaced.touchpointJobSelections).not.toContainEqual(expect.objectContaining({ id: 'path-a' }));
    expect(replaced.touchpointJobSelections).toContainEqual(expect.objectContaining({ id: 'other-touch-path' }));
    expect(replaced.touchpointJobSelections.some(selection => selection.touchpointId === 'touch' && selection.offerId === 'offer-b')).toBe(false);
    expect(replaced.entities.find(entity => entity.id === 'touch')).toEqual(document.entities.find(entity => entity.id === 'touch'));
  });

  it('rejects unknown/equal Offers, missing confirmation, and a stale sole-link precondition', () => {
    const sole = fixture(); sole.relationships = sole.relationships.filter(relation => relation.id !== 'presents-b');
    const command = { touchpointId: 'touch', departingOfferId: 'offer-a', replacementOfferId: 'offer-b', confirmedRemoval: true, newId: () => 'replacement' };
    expect(() => replaceTouchpointLinkedOffer(sole, { ...command, replacementOfferId: 'missing' })).toThrow('Replacement Offer does not exist.');
    expect(() => replaceTouchpointLinkedOffer(sole, { ...command, replacementOfferId: 'offer-a' })).toThrow('must differ');
    expect(() => replaceTouchpointLinkedOffer(sole, { ...command, confirmedRemoval: false })).toThrow('Confirm removal');
    expect(() => replaceTouchpointLinkedOffer(fixture(), command)).toThrow('no longer');
  });
});

describe('Touchpoint mitigation commit', () => {
  it('adds and removes only the requested relevant mitigation while retaining IDs and remaining mitigations', () => {
    const document = fixture();
    document.entities.push({ id: 'repulsor-a', kind: 'repulsor', title: 'Doubt' }, { id: 'repulsor-b', kind: 'repulsor', title: 'Delay' });
    document.relationships.push(
      { id: 'resists-a', kind: 'repulsor_resists', repulsorId: 'repulsor-a', targetEntityId: 'job' },
      { id: 'resists-b', kind: 'repulsor_resists', repulsorId: 'repulsor-b', targetEntityId: 'job' },
      { id: 'mitigates-b', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor-b' },
    );
    const added = commitTouchpointMitigation(document, { touchpointId: 'touch', repulsorId: 'repulsor-a', mitigated: true, newId: () => 'mitigates-a' });
    expect(added.relationships).toEqual(expect.arrayContaining([
      { id: 'mitigates-a', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor-a' },
      { id: 'mitigates-b', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor-b' },
    ]));
    expect(commitTouchpointMitigation(added, { touchpointId: 'touch', repulsorId: 'repulsor-a', mitigated: true, newId: () => { throw new Error('must not allocate'); } })).toBe(added);
    const removed = commitTouchpointMitigation(added, { touchpointId: 'touch', repulsorId: 'repulsor-a', mitigated: false, newId: () => { throw new Error('must not allocate'); } });
    expect(removed.relationships).not.toContainEqual(expect.objectContaining({ id: 'mitigates-a' }));
    expect(removed.relationships).toContainEqual(expect.objectContaining({ id: 'mitigates-b' }));
    expect(commitTouchpointMitigation(removed, { touchpointId: 'touch', repulsorId: 'repulsor-a', mitigated: false, newId: () => { throw new Error('must not allocate'); } })).toBe(removed);
  });

  it('rejects a Repulsor outside the current derived relevance', () => {
    const document = fixture();
    document.entities.push({ id: 'repulsor', kind: 'repulsor', title: 'Irrelevant' });
    expect(() => commitTouchpointMitigation(document, { touchpointId: 'touch', repulsorId: 'repulsor', mitigated: true, newId: () => 'unused' })).toThrow(/not relevant/);
  });
});

describe('Touchpoint parent commit', () => {
  it('adds, changes with the same relation ID, clears, and does not mutate the input', () => {
    const document = fixture();
    document.entities.push(
      { id: 'parent-a', kind: 'touchpoint', title: 'Parent A' },
      { id: 'parent-b', kind: 'touchpoint', title: 'Parent B' },
      { id: 'repulsor', kind: 'repulsor', title: 'Doubt' },
    );
    document.touchpointContainers.push({ id: 'site', title: 'Site' });
    Object.assign(document.entities.find(entity => entity.id === 'touch')!, { locatedInId: 'site', url: 'https://keep.example' });
    document.relationships.push(
      { id: 'resists', kind: 'repulsor_resists', repulsorId: 'repulsor', targetEntityId: 'job' },
      { id: 'mitigates', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor' },
    );
    const snapshot = structuredClone(document);
    const ids = ['contains', 'intent-a', 'intent-b'];
    const added = commitTouchpointParent(document, { touchpointId: 'touch', parentTouchpointId: 'parent-a', newId: () => ids.shift()! });
    expect(added.relationships.filter(relation => relation.kind === 'touchpoint_contains_touchpoint')).toEqual([
      { id: 'contains', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'parent-a', childTouchpointId: 'touch' },
    ]);
    expect(document).toEqual(snapshot);

    const changed = commitTouchpointParent(added, { touchpointId: 'touch', parentTouchpointId: 'parent-b', newId: (() => { let id = 0; return () => `changed-${++id}`; })() });
    expect(changed.relationships.filter(relation => relation.kind === 'touchpoint_contains_touchpoint')).toEqual([
      { id: 'contains', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'parent-b', childTouchpointId: 'touch' },
    ]);
    expect(changed.entities.find(entity => entity.id === 'touch')).toMatchObject({ locatedInId: 'site', url: 'https://keep.example' });
    expect(changed.relationships).toContainEqual(expect.objectContaining({ id: 'mitigates' }));
    expect(changed.touchpointJobSelections).toEqual(document.touchpointJobSelections);

    expect(commitTouchpointParent(changed, { touchpointId: 'touch', parentTouchpointId: 'parent-b', newId: () => { throw new Error('must not allocate'); } })).toBe(changed);
    const cleared = commitTouchpointParent(changed, { touchpointId: 'touch', parentTouchpointId: '', newId: (() => { let id = 0; return () => `clear-${++id}`; })() });
    expect(cleared.relationships.some(relation => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === 'touch')).toBe(false);
  });

  it('rejects unknown entities, self-parenting, and cycles through domain validation', () => {
    const document = fixture();
    document.entities.push({ id: 'parent', kind: 'touchpoint', title: 'Parent' });
    document.relationships.push({ id: 'parent-offer', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'parent' });
    expect(() => commitTouchpointParent(document, { touchpointId: 'missing', parentTouchpointId: '', newId: () => 'unused' })).toThrow(/does not exist/);
    expect(() => commitTouchpointParent(document, { touchpointId: 'touch', parentTouchpointId: 'missing', newId: () => 'unused' })).toThrow(/existing Touchpoint/);
    expect(() => commitTouchpointParent(document, { touchpointId: 'touch', parentTouchpointId: 'touch', newId: () => 'self' })).toThrow(/cannot contain itself/);
    const cycleIds = ['contains-parent', 'cycle-intent-a', 'cycle-intent-b'];
    const childOfTouch = commitTouchpointParent(document, { touchpointId: 'parent', parentTouchpointId: 'touch', newId: () => cycleIds.shift()! });
    expect(() => commitTouchpointParent(childOfTouch, { touchpointId: 'touch', parentTouchpointId: 'parent', newId: () => 'cycle' })).toThrow(/cycle/);
  });
});

describe('Touchpoint edit intent draft', () => {
  it.each([
    { subset: [] as string[], checkedOutcomes: [] },
    { subset: ['do-a'], checkedOutcomes: ['do-a'] },
    { subset: ['do-a', 'do-b'], checkedOutcomes: ['do-a', 'do-b'] },
  ])('projects an Offer Job path with $subset independently from its Desired Outcome subset', ({ subset, checkedOutcomes }) => {
    const document = fixture();
    document.touchpointJobSelections = [{ id: 'path', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: subset }];

    const leaves = touchpointUpstreamSources(document, 'touch').find(source => source.sourceKind === 'offer' && source.source.id === 'offer-a')!.jobGroups[0]!.leaves;

    expect(leaves.find(leaf => leaf.semanticId === 'job')).toMatchObject({ checked: true });
    for (const desiredOutcomeId of ['do-a', 'do-b']) {
      expect(leaves.find(leaf => leaf.semanticId === desiredOutcomeId)).toMatchObject({ checked: checkedOutcomes.includes(desiredOutcomeId) });
    }
  });

  it('projects Parent semantics independently from the Parent contributor', () => {
    const document = fixture();
    document.entities.push({ id: 'parent', kind: 'touchpoint', title: 'Parent' });
    document.relationships = [...document.relationships.filter(relation => relation.kind !== 'offer_presented_at_touchpoint' || relation.touchpointId !== 'touch' || relation.offerId !== 'offer-a'),
      { id: 'parent-link', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'parent' },
      { id: 'contains', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'parent', childTouchpointId: 'touch' }];
    document.touchpointJobSelections = [{ id: 'parent-path', touchpointId: 'parent', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] }];
    document.offerFinancialIntents.push({ id: 'parent-fdo', offerId: 'offer-a', financialDesiredOutcomeId: 'fdo' });
    document.touchpointFinancialSelections.push({ id: 'parent-fdo-path', touchpointId: 'parent', offerId: 'offer-a', offerFinancialIntentId: 'parent-fdo', financialDesiredOutcomeId: 'fdo' });

    const parent = touchpointUpstreamSources(document, 'touch').find(source => source.sourceKind === 'parent')!;
    const leaf = parent.jobGroups[0]!.leaves.find(item => item.semanticId === 'do-a')!;
    expect(leaf).toMatchObject({ semanticId: 'do-a', owningJobId: 'job', contributorOfferId: '', available: true, checked: false, provenanceOfferIds: ['offer-a'], childContributorOfferIds: ['offer-b'] });
    expect(parent.financialLeaves[0]).toMatchObject({ semanticId: 'fdo', contributorOfferId: '', available: true, provenanceOfferIds: ['offer-a'], childContributorOfferIds: ['offer-b'] });
  });

  it('reads Parent-source checked state from the Child contributor rather than Parent provenance', () => {
    const document = fixture();
    document.entities.push({ id: 'parent', kind: 'touchpoint', title: 'Parent' });
    document.relationships.push({ id: 'contains', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'parent', childTouchpointId: 'touch' });
    document.touchpointJobSelections.push({ id: 'parent-path', touchpointId: 'parent', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] });
    const leaf = touchpointUpstreamSources(document, 'touch').find(source => source.sourceKind === 'parent')!.jobGroups[0]!.leaves.find(item => item.semanticId === 'do-a')!;
    expect(leaf.checkedContributorOfferIds).toEqual(['offer-a', 'offer-b']);
    expect(leaf.provenanceOfferIds).toEqual(['offer-a']);
  });

  it('projects an empty Child Job path into Parent Job membership without inheriting Parent contributor identity', () => {
    const document = fixture();
    document.entities.push({ id: 'parent', kind: 'touchpoint', title: 'Parent' });
    document.relationships.push({ id: 'contains', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'parent', childTouchpointId: 'touch' });
    document.touchpointJobSelections = [
      { id: 'parent-path', touchpointId: 'parent', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
      { id: 'child-path', touchpointId: 'touch', offerId: 'offer-b', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] },
    ];

    const leaves = touchpointUpstreamSources(document, 'touch').find(source => source.sourceKind === 'parent')!.jobGroups[0]!.leaves;
    expect(leaves.find(leaf => leaf.semanticId === 'job')).toMatchObject({ checked: true, checkedContributorOfferIds: ['offer-b'], provenanceOfferIds: ['offer-a'] });
    expect(leaves.find(leaf => leaf.semanticId === 'do-a')).toMatchObject({ checked: false, checkedContributorOfferIds: [], provenanceOfferIds: ['offer-a'] });
  });
  it('commits only a normalized URL and returns the durable document for an unchanged value', () => {
    const document = fixture();
    const touchpoint = document.entities.find(entity => entity.id === 'touch')!;
    Object.assign(touchpoint, { url: 'https://old.example' });
    const next = commitTouchpointBusinessProperty(document, { touchpointId: 'touch', property: 'url', url: '  https://new.example  ' });
    expect(next.entities.find(entity => entity.id === 'touch')).toMatchObject({ title: 'Touchpoint', url: 'https://new.example' });
    expect(next.relationships).toEqual(document.relationships);
    expect(next.touchpointJobSelections).toEqual(document.touchpointJobSelections);
    expect(commitTouchpointBusinessProperty(next, { touchpointId: 'touch', property: 'url', url: 'https://new.example' })).toBe(next);
  });

  it('atomically creates or reuses a container and assigns it while preserving other facts', () => {
    const document = fixture();
    Object.assign(document.entities.find(entity => entity.id === 'touch')!, { url: 'https://keep.example' });
    const created = commitTouchpointBusinessProperty(document, { touchpointId: 'touch', property: 'located-in', location: { kind: 'new', id: 'web', title: 'Website' } });
    expect(created.touchpointContainers).toEqual([{ id: 'web', title: 'Website' }]);
    expect(created.entities.find(entity => entity.id === 'touch')).toMatchObject({ locatedInId: 'web', url: 'https://keep.example' });
    expect(created.touchpointJobSelections).toEqual(document.touchpointJobSelections);
    const reused = commitTouchpointBusinessProperty(created, { touchpointId: 'touch', property: 'located-in', location: { kind: 'new', id: 'unused', title: ' website ' } });
    expect(reused.touchpointContainers).toEqual([{ id: 'web', title: 'Website' }]);
    expect(reused).toBe(created);
  });

  it('leaves the input and no orphan container when assignment fails', () => {
    const document = fixture();
    document.relationships = document.relationships.filter(relation => !(relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === 'touch'));
    const snapshot = structuredClone(document);
    expect(() => commitTouchpointBusinessProperty(document, { touchpointId: 'touch', property: 'located-in', location: { kind: 'new', id: 'orphan', title: 'Broken' } })).toThrow(/Offer/);
    expect(document).toEqual(snapshot);
  });
  it('connection picker filters by exact entity kind and partial title', () => {
    const candidates = connectionPickerCatalogue(fixture(), 'touchpoint');
    expect(filterConnectionCandidates(candidates, { kind: 'core_functional_job', query: '' }).map(candidate => candidate.semanticLeafId)).toEqual(['do-a', 'do-b']);
    expect(filterConnectionCandidates(candidates, { query: 'safe' }).map(candidate => candidate.semanticLeafId)).toEqual(['emotional']);
    expect(filterConnectionCandidates(candidates, { query: 'do b' }).map(candidate => candidate.semanticLeafId)).toEqual(['do-b']);
  });

  it('DO results retain their owning Job', () => {
    const result = connectionPickerCatalogue(fixture(), 'touchpoint').find(candidate => candidate.semanticLeafId === 'do-a');
    expect(result).toMatchObject({ kind: 'job', entity: { id: 'job', kind: 'core_functional_job' }, desiredOutcome: { id: 'do-a' } });
  });

  it('discovers ontology-valid title matches with owner-aware branches', () => {
    const document = fixture();
    document.entities.push({ id: 'offer-match', kind: 'offer', title: 'DO B commercial' }, { id: 'repulsor-match', kind: 'repulsor', title: 'DO B concern' });
    const result = globalIntentDiscovery(document, { query: 'do b' });
    expect(result.titleMatches.jobGroups).toHaveLength(1);
    expect(result.titleMatches.jobGroups[0]?.job.id).toBe('job');
    expect(result.titleMatches.jobGroups[0]?.leaves.find(leaf => leaf.semanticId === 'do-b')).toMatchObject({ entity: { id: 'do-b' }, owningJobId: 'job' });
    expect(result.titleMatches.directLeaves).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('offer-match');
    expect(JSON.stringify(result)).not.toContain('repulsor-match');
  });

  it('projects current-Touchpoint semantic membership and concrete contributor paths into discovery', () => {
    const document = fixture();
    document.entities.push({ id: 'other-touch', kind: 'touchpoint', title: 'Other' });
    document.touchpointJobSelections.push({
      id: 'other-selection', touchpointId: 'other-touch', offerId: 'offer-a',
      productJobIntentId: document.productJobIntents[0]!.id, addressedDesiredOutcomeIds: ['do-b'],
    });

    const leaves = globalIntentDiscovery(document, { query: 'do', touchpointId: 'touch' }).titleMatches.jobGroups.flatMap(group => group.leaves);
    expect(leaves.find(leaf => leaf.semanticId === 'do-a')).toMatchObject({
      checked: true,
      owningJobId: 'job',
      contributorPaths: [
        { offerId: 'offer-a', productJobIntentId: expect.any(String) },
        { offerId: 'offer-b', productJobIntentId: expect.any(String) },
      ],
    });
    expect(leaves.find(leaf => leaf.semanticId === 'do-b')).toMatchObject({ checked: true, owningJobId: 'job' });
    expect(globalIntentDiscovery(document, { query: 'do b', touchpointId: 'other-touch' }).titleMatches.jobGroups[0]!.leaves.find(leaf => leaf.semanticId === 'do-b')).toMatchObject({
      checked: true,
      contributorPaths: [{ offerId: 'offer-a' }],
    });
    expect(globalIntentDiscovery(document, { query: 'do b', touchpointId: 'missing' }).titleMatches.jobGroups[0]!.leaves.find(leaf => leaf.semanticId === 'do-b')).toMatchObject({ checked: false, contributorPaths: [] });
  });

  it('projects Job contributor paths even when those paths also contain Desired Outcomes', () => {
    const result = globalIntentDiscovery(fixture(), { query: 'Job', touchpointId: 'touch' });
    const job = result.titleMatches.jobGroups[0]?.leaves.find(leaf => leaf.kind === 'job');
    expect(job).toMatchObject({ checked: true, checkedContributorOfferIds: ['offer-a', 'offer-b'] });
    expect(job?.contributorPaths?.map(path => path.offerId)).toEqual(['offer-a', 'offer-b']);
  });

  it('returns kind labels and aliases separately from simultaneous title matches', () => {
    const document = fixture();
    document.entities.push({ id: 'outcome-emotion', kind: 'emotional_job', title: 'Outcome confidence' });
    const outcome = globalIntentDiscovery(document, { query: 'Outcome' });
    expect(outcome.titleMatches.directLeaves.map(leaf => leaf.entity.id)).toContain('outcome-emotion');
    expect(outcome.kindShortcutMatches.map(match => match.kind)).toEqual(expect.arrayContaining(['desired_outcome', 'financial_desired_outcome']));
    expect(globalIntentDiscovery(document, { query: 'Desired' }).kindShortcutMatches.map(match => match.kind)).toEqual(expect.arrayContaining(['desired_outcome', 'financial_desired_outcome']));
  });

  it('browses only eligible entities for a selected kind shortcut', () => {
    const document = fixture();
    document.entities.push(
      { id: 'related', kind: 'related_job', title: 'Related' }, { id: 'related-do', kind: 'desired_outcome', title: 'Related result' },
      { id: 'chain', kind: 'consumption_chain_job', title: 'Chain' }, { id: 'chain-do', kind: 'desired_outcome', title: 'Chain result' },
      { id: 'social', kind: 'social_job', title: 'Belong' }, { id: 'product-nope', kind: 'product', title: 'Desired Product' },
    );
    document.relationships.push(
      { id: 'related-owns', kind: 'job_has_desired_outcome', jobId: 'related', desiredOutcomeId: 'related-do' },
      { id: 'chain-owns', kind: 'job_has_desired_outcome', jobId: 'chain', desiredOutcomeId: 'chain-do' },
    );
    const desired = globalIntentDiscovery(document, { query: 'desired', kind: 'desired_outcome' });
    expect(desired.jobGroups.flatMap(group => group.leaves.filter(leaf => leaf.kind === 'desired-outcome').map(leaf => leaf.entity.id))).toEqual(['do-a', 'do-b', 'related-do', 'chain-do']);
    expect(desired.directLeaves).toEqual([]);
    expect(globalIntentDiscovery(document, { query: 'social', kind: 'social_job' }).directLeaves.map(leaf => leaf.entity.id)).toEqual(['social']);
    expect(globalIntentDiscovery(document, { query: 'financial', kind: 'financial_desired_outcome' }).directLeaves.map(leaf => leaf.entity.id)).toEqual(['fdo']);
    expect(JSON.stringify(desired)).not.toContain('product-nope');
  });

  it('FDO is excluded from Product connection candidates', () => {
    expect(connectionPickerCatalogue(fixture(), 'product').map(candidate => candidate.semanticLeafId)).not.toContain('fdo');
    expect(connectionPickerCatalogue(fixture(), 'offer').map(candidate => candidate.semanticLeafId)).toContain('fdo');
  });

  it('catalogues Client-owned semantic leaves independently of upstream intent', () => {
    const catalogue = touchpointIntentCatalogue(fixture());
    expect(catalogue.jobs.map(leaf => leaf.semanticLeafId)).toEqual(['job', 'do-a', 'do-b', 'emotional']);
    expect(catalogue.financial).toEqual([{ financialDesiredOutcomeId: 'fdo', contributorOfferIds: [] }]);
  });

  it('preserves each Desired Outcome to Offer path and snapshots stable branches', () => {
    const draft = createTouchpointIntentDraft(fixture(), 'touch');
    expect(draft.jobLeaves.find(leaf => leaf.semanticLeafId === 'do-a')?.contributorOfferIds).toEqual(['offer-a', 'offer-b']);
    expect(draft.jobLeaves.find(leaf => leaf.semanticLeafId === 'do-b')?.contributorOfferIds).toEqual(['offer-b']);
    expect(draft.durableBranchSnapshot.touchpointIntentLeafIds).toEqual(['job:job', 'job:do-a', 'job:do-b']);
    expect(draft.durableBranchSnapshot.otherClientIntentLeafIds).toEqual(['job:emotional', 'financial:fdo']);
  });

  it('projects durable Client scope with owner-aware Jobs, direct Jobs, standalone FDOs, and contributor attribution', () => {
    const document = fixture();
    document.entities.push(
      { id: 'related', kind: 'related_job', title: 'Related' }, { id: 'related-do', kind: 'desired_outcome', title: 'Related DO' },
      { id: 'chain', kind: 'consumption_chain_job', title: 'Chain' }, { id: 'chain-do', kind: 'desired_outcome', title: 'Chain DO' },
      { id: 'social', kind: 'social_job', title: 'Belong' }, { id: 'repulsor', kind: 'repulsor', title: 'Doubt' },
    );
    document.relationships.push(
      { id: 'related-owns', kind: 'job_has_desired_outcome', jobId: 'related', desiredOutcomeId: 'related-do' },
      { id: 'chain-owns', kind: 'job_has_desired_outcome', jobId: 'chain', desiredOutcomeId: 'chain-do' },
      { id: 'resists', kind: 'repulsor_resists', repulsorId: 'repulsor', targetEntityId: 'job' },
      { id: 'mitigates', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor' },
    );
    document.productJobIntents.push(
      { id: 'related-intent', productId: 'product', jobId: 'related', addressedDesiredOutcomeIds: ['related-do'] },
      { id: 'chain-intent', productId: 'product', jobId: 'chain', addressedDesiredOutcomeIds: ['chain-do'] },
      { id: 'emotional-intent', productId: 'product', jobId: 'emotional', addressedDesiredOutcomeIds: [] },
      { id: 'social-intent', productId: 'product', jobId: 'social', addressedDesiredOutcomeIds: [] },
    );
    document.touchpointJobSelections.push(
      { id: 'related-path', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'related-intent', addressedDesiredOutcomeIds: ['related-do'] },
      { id: 'chain-path', touchpointId: 'touch', offerId: 'offer-b', productJobIntentId: 'chain-intent', addressedDesiredOutcomeIds: ['chain-do'] },
      { id: 'emotional-path', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'emotional-intent', addressedDesiredOutcomeIds: [] },
      { id: 'social-path', touchpointId: 'touch', offerId: 'offer-b', productJobIntentId: 'social-intent', addressedDesiredOutcomeIds: [] },
    );
    document.offerFinancialIntents.push({ id: 'offer-financial', offerId: 'offer-a', financialDesiredOutcomeId: 'fdo' });
    document.touchpointFinancialSelections.push({ id: 'financial-path', touchpointId: 'touch', offerId: 'offer-a', offerFinancialIntentId: 'offer-financial', financialDesiredOutcomeId: 'fdo' });

    const scope = touchpointClientScope(document, 'touch');

    expect(scope.jobGroups.map(group => [group.job.kind, group.desiredOutcomes.map(leaf => leaf.semanticLeafId)])).toEqual([
      ['core_functional_job', ['do-a', 'do-b']], ['emotional_job', []], ['related_job', ['related-do']], ['consumption_chain_job', ['chain-do']], ['social_job', []],
    ]);
    expect(scope.jobGroups[0]?.desiredOutcomes[0]).toMatchObject({ semanticLeafId: 'do-a', contributorOfferIds: ['offer-a', 'offer-b'] });
    expect(scope.jobGroups.filter(group => group.job.id === 'job')).toHaveLength(1);
    expect(scope.financialLeaves).toEqual([{ entity: expect.objectContaining({ id: 'fdo', kind: 'financial_desired_outcome' }), semanticLeafId: 'fdo', contributorOfferIds: ['offer-a'] }]);
    expect(JSON.stringify(scope)).not.toContain('repulsor');
  });

  it('ignores pending draft selections because Client scope is projected from the durable document', () => {
    const document = fixture();
    const pending = createTouchpointIntentDraft(document, 'touch');
    pending.financialLeaves[0]!.contributorOfferIds = ['offer-a'];
    pending.pendingFinancialLeafIds = ['fdo'];

    expect(touchpointClientScope(document, 'touch').financialLeaves).toEqual([]);
  });

  it('compares contributor attribution and rejects pending leaves without one', () => {
    const left = createTouchpointIntentDraft(fixture(), 'touch'); const right = structuredClone(left);
    right.jobLeaves.find(leaf => leaf.semanticLeafId === 'do-a')!.contributorOfferIds = ['offer-a'];
    expect(equalTouchpointIntentDraft(left, right)).toBe(false);
    right.pendingJobLeafIds = ['emotional'];
    expect(validateTouchpointIntentDraft(right)).toMatch(/contributing Offer/);
  });

  it('copies valid current Offer intent into the draft with per-Offer attribution', () => {
    const document = fixture();
    document.productJobIntents.push(
      { id: 'emotional-intent', productId: 'product', jobId: 'emotional', addressedDesiredOutcomeIds: [] },
      { id: 'incomplete-intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: [] },
    );
    document.offerJobSelections.push(
      { id: 'offer-emotional', offerId: 'offer-a', productJobIntentId: 'emotional-intent' },
      { id: 'offer-incomplete', offerId: 'offer-a', productJobIntentId: 'incomplete-intent' },
    );
    document.offerFinancialIntents.push({ id: 'financial-intent', offerId: 'offer-b', financialDesiredOutcomeId: 'fdo' });
    const original = createTouchpointIntentDraft(document, 'touch');
    original.jobLeaves.forEach(leaf => { leaf.contributorOfferIds = []; });
    original.financialLeaves.forEach(leaf => { leaf.contributorOfferIds = []; });
    original.pendingJobLeafIds = ['emotional'];

    const selected = selectCurrentOfferIntent(document, original, ['offer-a', 'offer-b']);

    expect(selected.jobLeaves.find(leaf => leaf.semanticLeafId === 'do-a')?.contributorOfferIds).toEqual(['offer-a', 'offer-b']);
    expect(selected.jobLeaves.find(leaf => leaf.semanticLeafId === 'emotional')?.contributorOfferIds).toEqual(['offer-a']);
    expect(selected.financialLeaves[0]?.contributorOfferIds).toEqual(['offer-b']);
    expect(selected.pendingJobLeafIds).toEqual([]);
    expect(document.touchpointJobSelections).toHaveLength(2);
  });

  it('atomically applies structure, materialized intent, and mitigation from one draft', () => {
    const document = fixture();
    document.entities.push({ id: 'repulsor', kind: 'repulsor', title: 'Doubt' });
    document.relationships.push({ id: 'resists', kind: 'repulsor_resists', repulsorId: 'repulsor', targetEntityId: 'job' });
    const intent = createTouchpointIntentDraft(document, 'touch');
    intent.jobLeaves.find(leaf => leaf.semanticLeafId === 'job')!.contributorOfferIds = ['offer-a'];
    intent.jobLeaves.find(leaf => leaf.semanticLeafId === 'do-a')!.contributorOfferIds = ['offer-a'];
    intent.jobLeaves.find(leaf => leaf.semanticLeafId === 'do-b')!.contributorOfferIds = [];
    const nextId = (() => { let value = 0; return () => `new-${++value}`; })();

    const next = applyTouchpointEditDraft(document, { touchpointId: 'touch', newId: nextId, draft: {
      title: 'Edited touchpoint', linkedOfferIds: ['offer-a'], parentTouchpointId: '', locatedInId: '', locatedInQuery: 'Website',
      locationDraft: { kind: 'new', title: 'Website' }, url: 'https://example.test', mitigatedRepulsorIds: ['repulsor'], touchpointIntent: intent,
    } });

    expect(document.entities.find(entity => entity.id === 'touch')?.title).toBe('Touchpoint');
    expect(document.touchpointContainers).toEqual([]);
    expect(next.entities.find(entity => entity.id === 'touch')).toMatchObject({ title: 'Edited touchpoint', locatedInId: 'new-1', url: 'https://example.test' });
    expect(next.touchpointJobSelections).toHaveLength(1);
    expect(next.relationships).toContainEqual(expect.objectContaining({ kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor' }));
  });

  it('preserves an existing mitigation when applying an unrelated Touchpoint field', () => {
    const document = fixture();
    document.entities.push({ id: 'repulsor', kind: 'repulsor', title: 'Doubt' });
    document.relationships.push(
      { id: 'resists', kind: 'repulsor_resists', repulsorId: 'repulsor', targetEntityId: 'job' },
      { id: 'mitigates', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor' },
    );
    const draft = createTouchpointIntentDraft(document, 'touch');

    const next = applyTouchpointEditDraft(document, { touchpointId: 'touch', newId: (() => { let id = 0; return () => `preserve-${++id}`; })(), draft: {
      title: 'Renamed Touchpoint', linkedOfferIds: ['offer-a', 'offer-b'], parentTouchpointId: '', locatedInId: '', locatedInQuery: '',
      locationDraft: { kind: 'none' }, url: '', mitigatedRepulsorIds: ['repulsor'], touchpointIntent: draft,
    } });

    expect(next.relationships).toContainEqual({ id: 'mitigates', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor' });
    expect(relevantRepulsorsForTouchpoint(next, 'touch').map(repulsor => repulsor.id)).toContain('repulsor');
  });

  it('rejects unresolved or unlinked contributors without changing the durable document', () => {
    const document = fixture();
    const intent = createTouchpointIntentDraft(document, 'touch');
    intent.pendingJobLeafIds = ['emotional'];
    const snapshot = structuredClone(document);
    expect(() => applyTouchpointEditDraft(document, { touchpointId: 'touch', newId: () => 'unused', draft: {
      title: 'Not applied', linkedOfferIds: ['offer-a'], parentTouchpointId: '', locatedInId: '', locatedInQuery: '', locationDraft: { kind: 'none' }, url: '', mitigatedRepulsorIds: [], touchpointIntent: intent,
    } })).toThrow(/contributing Offer/);
    expect(document).toEqual(snapshot);
  });
});
