import { describe, expect, it } from 'vitest';
import { applyProductClientIntentCommand, type MapDocument, type ProductClientIntentCommand } from './index';
import { addProductDefinitionBlock, productDefinitionSourceState, productDefinitionWholeText, removeProductDefinitionBlock, reorderProductDefinitionBlocks, setProductCurrentDefinitionSource, setProductDefinitionExternalCopyUrl, updateProductDefinition, updateProductDefinitionBlock } from './index';
import { CLIENT_ROOT_ENTITY_KINDS, addEntity, addOfferContentBlock, addProductJobIntent, removeOfferContentBlock, removeProductJobIntent, reorderOfferContentBlocks, setOfferContentExternalCopyUrl, setOfferCurrentContentSource, setOfferJobSelections, setContextualCoreFunctionalJobs, setOfferFinancialIntents, updateOfferContentBlock, updateProductJobIntent, addTouchpointContainer, applyTouchpointIntentDraft, changeOfferProduct, createEmptyMapDocument, duplicateEntity, duplicateEntityRelationshipIdCount, movePlacement, offerContentSourceState, offerContentWholeText, updateEntity, updateOfferContent, updateRepulsorTargets, authorTouchpointIntentBottomUp, selectAllLinkedOfferIntentsForTouchpoint, setTouchpointIntentSelections, setTouchpointMitigations, getIntentRemovalImpact, getOfferIntentChangeImpact, getProductIntentChangeImpact, getTouchpointLinkedOfferChangeImpact, removeOfferIntentConfirmed, distributeProductJobIntent, distributeOfferJobIntent, resistanceImpactForOffer, resistanceImpactForProduct, resistanceExposureForProduct, planTouchpointIntentPathChange, commitTouchpointIntentPathPlan, commitTouchpointParent, planTouchpointStructuralChange } from './index';

function completed(result: ReturnType<typeof authorTouchpointIntentBottomUp>) { if (result.status !== 'complete') throw new Error(`Expected complete, got ${result.status}`); return result.document; }

const place = { viewId: 'view', x: 10, y: 20 };
const empty = () => createEmptyMapDocument({ mapId: 'map', title: 'Map', viewId: 'view', viewTitle: 'View' });
function offerDocument() { let d = addEntity(empty(), { ...place, entityId: 'product', title: 'Orbit', kind: 'product' }); d = addEntity(d, { ...place, entityId: 'offer', title: 'Subscription', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged' }); return addTouchpointContainer(d, { id: 'site', title: 'The Quiet Orbit website' }); }
function touchpoint(d = offerDocument(), id = 'touch', parent?: string) { return addEntity(d, { ...place, entityId: id, title: id, kind: 'touchpoint', locatedInId: 'site', url: '  /checkout#pay  ', linkedOfferIds: ['offer'], relationshipIds: [`presented-${id}`], ...(parent ? { parentTouchpointId: parent, parentRelationshipId: `contains-${id}` } : {}) }); }

describe('map authoring domain', () => {
  it.each(['/relative', 'javascript:alert(1)'])('reports owner-specific DomainError codes for invalid document and external-copy URLs: %s', value => {
    const document = offerDocument(); const snapshot = structuredClone(document);
    const productError = expect.objectContaining({ name: 'DomainError', code: 'invalid_product_definition_url' });
    const offerError = expect.objectContaining({ name: 'DomainError', code: 'invalid_offer_content_url' });
    expect(() => updateProductDefinition(document, { productId: 'product', field: 'definitionUrl', value })).toThrowError(productError);
    expect(() => updateOfferContent(document, { offerId: 'offer', field: 'contentUrl', value })).toThrowError(offerError);
    for (const source of ['free_form', 'structured'] as const) {
      expect(() => setProductDefinitionExternalCopyUrl(document, { productId: 'product', source, value })).toThrowError(productError);
      expect(() => setOfferContentExternalCopyUrl(document, { offerId: 'offer', source, value })).toThrowError(offerError);
    }
    expect(document).toEqual(snapshot);
  });

  describe('Product Definition domain foundation', () => {
    const product = (document: ReturnType<typeof offerDocument>, id = 'product') => document.entities.find((entity): entity is Extract<(typeof document.entities)[number], { kind: 'product' }> => entity.id === id && entity.kind === 'product')!;
    const state = (document: ReturnType<typeof offerDocument>) => productDefinitionSourceState(document, 'product');
    function both() {
      const free = updateProductDefinition(offerDocument(), { productId: 'product', field: 'definitionText', value: 'Free\nbody' });
      return addProductDefinitionBlock(free, { productId: 'product', blockId: 'first', title: 'Heading', text: '  Structured\nbody  ' });
    }

    it('keeps existing Products valid and projects absence without changing the document', () => {
      const document = offerDocument(); const snapshot = structuredClone(document);
      expect(product(document)).toEqual({ id: 'product', kind: 'product', title: 'Orbit' });
      expect(state(document)).toEqual({ currentDefinitionSource: null, freeFormEligible: false, structuredEligible: false });
      expect(productDefinitionWholeText(document, 'product')).toBe('Orbit');
      expect(document).toEqual(snapshot);
      expect(updateProductDefinition(document, { productId: 'product', field: 'definitionText' })).toBe(document);
      expect(reorderProductDefinitionBlocks(document, { productId: 'product', blockIds: [] })).toBe(document);
    });

    it('mutates and clears document URL and free-form text independently with normalized no-ops', () => {
      const before = offerDocument();
      const url = updateProductDefinition(before, { productId: 'product', field: 'definitionUrl', value: '  https://example.test/product  ' });
      expect(product(url)).toEqual({ id: 'product', kind: 'product', title: 'Orbit', definitionUrl: 'https://example.test/product' });
      expect(state(url).currentDefinitionSource).toBeNull();
      expect(updateProductDefinition(url, { productId: 'product', field: 'definitionUrl', value: 'https://example.test/product' })).toBe(url);
      const text = updateProductDefinition(url, { productId: 'product', field: 'definitionText', value: '  Line one\nLine two  ' });
      expect(product(text)).toMatchObject({ definitionUrl: 'https://example.test/product', definitionText: 'Line one\nLine two', currentDefinitionSource: 'free_form' });
      expect(updateProductDefinition(text, { productId: 'product', field: 'definitionText', value: 'Line one\nLine two' })).toBe(text);
      const clearedUrl = updateProductDefinition(text, { productId: 'product', field: 'definitionUrl', value: ' ' });
      expect(product(clearedUrl)).not.toHaveProperty('definitionUrl');
      expect(product(clearedUrl).definitionText).toBe('Line one\nLine two');
      const clearedText = updateProductDefinition(clearedUrl, { productId: 'product', field: 'definitionText', value: '\n ' });
      expect(product(clearedText)).toEqual({ id: 'product', kind: 'product', title: 'Orbit', currentDefinitionSource: null });
      expect(product(before)).not.toHaveProperty('definitionText');
    });

    it('validates all external URLs and owners atomically', () => {
      const before = offerDocument(); const snapshot = structuredClone(before);
      for (const value of ['http://example.test/document', 'https://example.test/document']) {
        expect(product(updateProductDefinition(before, { productId: 'product', field: 'definitionUrl', value })).definitionUrl).toBe(value);
      }
      for (const value of ['/relative', 'not a url', 'javascript:alert(1)', 'ftp://example.test/file', 'mailto:author@example.test']) {
        expect(() => updateProductDefinition(before, { productId: 'product', field: 'definitionUrl', value })).toThrow('absolute http: or https:');
        for (const source of ['free_form', 'structured'] as const) {
          expect(() => setProductDefinitionExternalCopyUrl(before, { productId: 'product', source, value })).toThrow('absolute http: or https:');
        }
      }
      for (const productId of ['offer', 'missing']) {
        expect(() => updateProductDefinition(before, { productId, field: 'definitionText', value: 'Wrong owner' })).toThrow();
        expect(() => productDefinitionSourceState(before, productId)).toThrow();
        expect(() => productDefinitionWholeText(before, productId)).toThrow();
        expect(() => addProductDefinitionBlock(before, { productId, blockId: 'new', title: 'Title' })).toThrow();
        expect(() => setProductDefinitionExternalCopyUrl(before, { productId, source: 'free_form', value: 'https://example.test' })).toThrow();
        expect(() => setProductCurrentDefinitionSource(before, { productId, source: 'free_form' })).toThrow();
      }
      expect(before).toEqual(snapshot);
    });

    it('requires body text for eligibility and follows the Offer source-state rules', () => {
      const emptyProduct = offerDocument();
      for (const text of [undefined, '', ' \n ']) {
        const titleOnly = addProductDefinitionBlock(emptyProduct, { productId: 'product', blockId: 'title', title: 'Title', ...(text !== undefined ? { text } : {}) });
        expect(state(titleOnly)).toEqual({ currentDefinitionSource: null, freeFormEligible: false, structuredEligible: false });
        expect(productDefinitionWholeText(titleOnly, 'product')).toBe('Orbit');
        expect(() => setProductCurrentDefinitionSource(titleOnly, { productId: 'product', source: 'structured' })).toThrow('eligible');
      }
      const structured = addProductDefinitionBlock(emptyProduct, { productId: 'product', blockId: 'body', title: 'Title', text: ' Body ' });
      expect(state(structured)).toEqual({ currentDefinitionSource: 'structured', freeFormEligible: false, structuredEligible: true });
      const withFree = updateProductDefinition(structured, { productId: 'product', field: 'definitionText', value: 'Free' });
      expect(state(withFree)).toEqual({ currentDefinitionSource: 'structured', freeFormEligible: true, structuredEligible: true });
      const freeFirst = both();
      expect(state(freeFirst).currentDefinitionSource).toBe('free_form');
      const switched = setProductCurrentDefinitionSource(freeFirst, { productId: 'product', source: 'structured' });
      expect(setProductCurrentDefinitionSource(switched, { productId: 'product', source: 'structured' })).toBe(switched);
      expect(product(switched).definitionText).toBe('Free\nbody');
      expect(product(switched).definitionBlocks).toBe(product(freeFirst).definitionBlocks);
      const fallback = updateProductDefinitionBlock(switched, { productId: 'product', blockId: 'first', field: 'text', value: ' \n ' });
      expect(state(fallback).currentDefinitionSource).toBe('free_form');
      const neither = updateProductDefinition(fallback, { productId: 'product', field: 'definitionText' });
      expect(state(neither).currentDefinitionSource).toBeNull();
      const structuredFallback = updateProductDefinition(freeFirst, { productId: 'product', field: 'definitionText' });
      expect(state(structuredFallback).currentDefinitionSource).toBe('structured');
      expect(() => setProductCurrentDefinitionSource(neither, { productId: 'product', source: 'free_form' })).toThrow('eligible');
      expect(() => setProductCurrentDefinitionSource(freeFirst, { productId: 'product', source: 'other' as never })).toThrow('free_form or structured');
      for (const currentDefinitionSource of [undefined, null, 'stale' as never]) {
        const legacy = { ...freeFirst, entities: freeFirst.entities.map(entity => entity.id === 'product' ? { ...entity, ...(currentDefinitionSource === undefined ? {} : { currentDefinitionSource }) } : entity) };
        if (currentDefinitionSource === undefined) delete product(legacy).currentDefinitionSource;
        const snapshot = structuredClone(legacy);
        expect(state(legacy).currentDefinitionSource).toBe('free_form');
        expect(legacy).toEqual(snapshot);
      }
    });

    it('projects canonical whole text in authored order without block titles or external URLs', () => {
      let document = both();
      document = updateProductDefinition(document, { productId: 'product', field: 'definitionUrl', value: 'https://example.test/doc' });
      document = addProductDefinitionBlock(document, { productId: 'product', blockId: 'empty', title: 'Empty', text: '\n ' });
      document = addProductDefinitionBlock(document, { productId: 'product', blockId: 'last', title: 'Last title', text: ' Last\nbody ' });
      expect(productDefinitionWholeText(document, 'product')).toBe('Orbit\n\nFree\nbody');
      document = setProductCurrentDefinitionSource(document, { productId: 'product', source: 'structured' });
      const snapshot = structuredClone(document);
      expect(productDefinitionWholeText(document, 'product')).toBe('Orbit\n\nStructured\nbody\n\nLast\nbody');
      expect(document).toEqual(snapshot);
      const reordered = reorderProductDefinitionBlocks(document, { productId: 'product', blockIds: ['last', 'empty', 'first'] });
      expect(productDefinitionWholeText(reordered, 'product')).toBe('Orbit\n\nLast\nbody\n\nStructured\nbody');
      const renamed = updateEntity(reordered, { entityId: 'product', title: 'Renamed' });
      expect(product(renamed)).toEqual({ ...product(reordered), title: 'Renamed' });
      expect(productDefinitionWholeText(renamed, 'product')).toBe('Renamed\n\nLast\nbody\n\nStructured\nbody');
    });

    it('inserts stable blocks at the end or after an owned anchor and rejects invalid IDs/titles', () => {
      let document = addProductDefinitionBlock(offerDocument(), { productId: 'product', blockId: ' first ', title: ' First ' });
      document = addProductDefinitionBlock(document, { productId: 'product', blockId: 'last', title: 'Last', text: '' });
      document = addProductDefinitionBlock(document, { productId: 'product', blockId: 'middle', title: 'Middle', text: ' Exact ', afterBlockId: 'first' });
      expect(product(document).definitionBlocks).toEqual([{ id: 'first', title: 'First' }, { id: 'middle', title: 'Middle', text: ' Exact ' }, { id: 'last', title: 'Last', text: '' }]);
      const withOther = addEntity(document, { ...place, kind: 'product', entityId: 'other', title: 'Other' });
      const foreign = addProductDefinitionBlock(withOther, { productId: 'other', blockId: 'foreign', title: 'Foreign' });
      const snapshot = structuredClone(foreign);
      for (const input of [
        { blockId: 'first', title: 'Duplicate' }, { blockId: 'foreign', title: 'Foreign duplicate' },
        { blockId: ' ', title: 'Blank ID' }, { blockId: 'new', title: ' ' },
        { blockId: 'new', title: 'New', afterBlockId: 'missing' }, { blockId: 'new', title: 'New', afterBlockId: 'foreign' },
      ]) expect(() => addProductDefinitionBlock(foreign, { productId: 'product', ...input })).toThrow();
      expect(foreign).toEqual(snapshot);
    });

    it('updates block title and exact optional text independently with identity-preserving no-ops', () => {
      const before = both();
      const title = updateProductDefinitionBlock(before, { productId: 'product', blockId: 'first', field: 'title', value: ' Renamed ' });
      expect(product(title).definitionBlocks![0]).toEqual({ id: 'first', title: 'Renamed', text: '  Structured\nbody  ' });
      expect(updateProductDefinitionBlock(title, { productId: 'product', blockId: 'first', field: 'title', value: 'Renamed' })).toBe(title);
      const text = updateProductDefinitionBlock(title, { productId: 'product', blockId: 'first', field: 'text', value: '' });
      expect(product(text).definitionBlocks![0]).toEqual({ id: 'first', title: 'Renamed', text: '' });
      expect(updateProductDefinitionBlock(text, { productId: 'product', blockId: 'first', field: 'text', value: '' })).toBe(text);
      const absent = updateProductDefinitionBlock(text, { productId: 'product', blockId: 'first', field: 'text' });
      expect(product(absent).definitionBlocks![0]).not.toHaveProperty('text');
      expect(updateProductDefinitionBlock(absent, { productId: 'product', blockId: 'first', field: 'text' })).toBe(absent);
      expect(() => updateProductDefinitionBlock(before, { productId: 'product', blockId: 'first', field: 'title', value: ' ' })).toThrow();
      expect(product(before).definitionBlocks![0]!.title).toBe('Heading');
    });

    it('removes owned blocks, canonicalizes the final collection and normalizes Current', () => {
      let document = setProductCurrentDefinitionSource(both(), { productId: 'product', source: 'structured' });
      document = addProductDefinitionBlock(document, { productId: 'product', blockId: 'title-only', title: 'Title only' });
      const removedBody = removeProductDefinitionBlock(document, { productId: 'product', blockId: 'first' });
      expect(product(removedBody).definitionBlocks).toEqual([{ id: 'title-only', title: 'Title only' }]);
      expect(state(removedBody).currentDefinitionSource).toBe('free_form');
      const removedLast = removeProductDefinitionBlock(removedBody, { productId: 'product', blockId: 'title-only' });
      expect(product(removedLast)).not.toHaveProperty('definitionBlocks');
      expect(product(removedLast).definitionText).toBe('Free\nbody');
      const structuredOnly = addProductDefinitionBlock(offerDocument(), { productId: 'product', blockId: 'body', title: 'Body', text: 'Text' });
      expect(state(removeProductDefinitionBlock(structuredOnly, { productId: 'product', blockId: 'body' })).currentDefinitionSource).toBeNull();
      expect(() => removeProductDefinitionBlock(document, { productId: 'other', blockId: 'first' })).toThrow();
    });

    it('reorders only the exact owned set, retaining block objects and rejecting foreign operations atomically', () => {
      let document = both();
      document = addProductDefinitionBlock(document, { productId: 'product', blockId: 'last', title: 'Last' });
      document = addEntity(document, { ...place, kind: 'product', entityId: 'other', title: 'Other' });
      document = addProductDefinitionBlock(document, { productId: 'other', blockId: 'foreign', title: 'Foreign' });
      const snapshot = structuredClone(document); const blocks = product(document).definitionBlocks!;
      const next = reorderProductDefinitionBlocks(document, { productId: 'product', blockIds: ['last', 'first'] });
      expect(product(next).definitionBlocks).toEqual([blocks[1], blocks[0]]);
      expect(product(next).definitionBlocks![0]).toBe(blocks[1]);
      expect(reorderProductDefinitionBlocks(document, { productId: 'product', blockIds: ['first', 'last'] })).toBe(document);
      for (const blockIds of [[], ['first'], ['first', 'first'], ['first', 'last', 'extra'], ['first', 'foreign']]) {
        expect(() => reorderProductDefinitionBlocks(document, { productId: 'product', blockIds })).toThrow();
      }
      for (const blockId of ['foreign', 'missing']) {
        expect(() => updateProductDefinitionBlock(document, { productId: 'product', blockId, field: 'text', value: 'Bad' })).toThrow();
        expect(() => removeProductDefinitionBlock(document, { productId: 'product', blockId })).toThrow();
      }
      expect(document).toEqual(snapshot);
    });

    it('owns independent external-copy URLs before eligibility and across Current changes', () => {
      const before = offerDocument();
      let document = setProductDefinitionExternalCopyUrl(before, { productId: 'product', source: 'free_form', value: ' https://example.test/copy ' });
      document = setProductDefinitionExternalCopyUrl(document, { productId: 'product', source: 'structured', value: 'https://example.test/copy' });
      expect(state(document).currentDefinitionSource).toBeNull();
      expect(product(document)).toMatchObject({ freeFormExternalCopyUrl: 'https://example.test/copy', structuredExternalCopyUrl: 'https://example.test/copy' });
      expect(setProductDefinitionExternalCopyUrl(document, { productId: 'product', source: 'free_form', value: ' https://example.test/copy ' })).toBe(document);
      document = updateProductDefinition(document, { productId: 'product', field: 'definitionText', value: 'Free' });
      document = addProductDefinitionBlock(document, { productId: 'product', blockId: 'body', title: 'Body', text: 'Structured' });
      const switched = setProductCurrentDefinitionSource(document, { productId: 'product', source: 'structured' });
      expect(product(switched)).toEqual({ ...product(document), currentDefinitionSource: 'structured' });
      const cleared = setProductDefinitionExternalCopyUrl(switched, { productId: 'product', source: 'free_form', value: '\n ' });
      expect(product(cleared)).not.toHaveProperty('freeFormExternalCopyUrl');
      expect(product(cleared).structuredExternalCopyUrl).toBe('https://example.test/copy');
      expect(setProductDefinitionExternalCopyUrl(cleared, { productId: 'product', source: 'free_form' })).toBe(cleared);
      expect(() => setProductDefinitionExternalCopyUrl(before, { productId: 'product', source: 'other' as never, value: 'https://example.test' })).toThrow('free_form or structured');
    });

    it('isolates Definition operations from Offer Content, intent, selections and every unrelated record', () => {
      let document = touchpoint();
      document = addEntity(document, { ...place, entityId: 'job', kind: 'emotional_job', title: 'Feel confident' });
      document = addProductJobIntent(document, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: [] });
      document = setOfferJobSelections(document, { offerId: 'offer', selections: [{ productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] }], newSelectionIds: ['selection'] });
      document.touchpointJobSelections.push({ id: 'touch-selection', touchpointId: 'touch', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] });
      document = addEntity(document, { ...place, entityId: 'fdo', kind: 'financial_desired_outcome', title: 'Financial goal' });
      document = setOfferFinancialIntents(document, { offerId: 'offer', financialDesiredOutcomeIds: ['fdo'], newIntentIds: ['financial'] });
      document.touchpointFinancialSelections.push({ id: 'touch-financial', touchpointId: 'touch', offerId: 'offer', offerFinancialIntentId: 'financial', financialDesiredOutcomeId: 'fdo' });
      document.epistemicAnnotations.push({ id: 'annotation', subjectEntityId: 'product', status: 'hypothesis', sourceNote: 'Existing annotation' });
      document = updateOfferContent(document, { offerId: 'offer', field: 'contentText', value: 'Offer wording' });
      document = addOfferContentBlock(document, { offerId: 'offer', blockId: 'offer-block', title: 'Offer heading', text: 'Offer body' });
      document = setOfferContentExternalCopyUrl(document, { offerId: 'offer', source: 'free_form', value: 'https://example.test/offer-copy' });
      const before = structuredClone(document);
      const assertIsolated = (next: typeof document) => {
        expect({ ...next, entities: next.entities.filter(entity => entity.id !== 'product') }).toEqual({ ...before, entities: before.entities.filter(entity => entity.id !== 'product') });
        for (const [field, value] of Object.entries(document)) if (field !== 'entities') expect(next[field as keyof typeof next]).toBe(value);
        expect(document).toEqual(before);
      };
      let next = updateProductDefinition(document, { productId: 'product', field: 'definitionUrl', value: 'https://example.test/product' }); assertIsolated(next);
      next = updateProductDefinition(next, { productId: 'product', field: 'definitionText', value: 'Product description' }); assertIsolated(next);
      next = addProductDefinitionBlock(next, { productId: 'product', blockId: 'product-block', title: 'Product heading', text: 'Product body' }); assertIsolated(next);
      next = addProductDefinitionBlock(next, { productId: 'product', blockId: 'second', title: 'Second' }); assertIsolated(next);
      next = updateProductDefinitionBlock(next, { productId: 'product', blockId: 'second', field: 'text', value: 'Second body' }); assertIsolated(next);
      next = reorderProductDefinitionBlocks(next, { productId: 'product', blockIds: ['second', 'product-block'] }); assertIsolated(next);
      next = setProductDefinitionExternalCopyUrl(next, { productId: 'product', source: 'structured', value: 'https://example.test/product-copy' }); assertIsolated(next);
      next = setProductCurrentDefinitionSource(next, { productId: 'product', source: 'structured' }); assertIsolated(next);
      next = removeProductDefinitionBlock(next, { productId: 'product', blockId: 'second' }); assertIsolated(next);
      const withNewOffer = addEntity(next, { ...place, kind: 'offer', entityId: 'new-offer', title: 'New Offer', linkedProductId: 'product', relationshipId: 'new-package' });
      expect(withNewOffer.entities.find(entity => entity.id === 'new-offer')).toEqual({ id: 'new-offer', kind: 'offer', title: 'New Offer', currentContentSource: null });
      expect(product(withNewOffer)).toEqual(product(next));
    });
  });


  describe('Offer Content whole text', () => {
    function bothRepresentations() {
      let document = updateOfferContent(offerDocument(), { offerId: 'offer', field: 'contentText', value: 'Free\nbody' });
      document = addOfferContentBlock(document, { offerId: 'offer', blockId: 'first', title: 'First title', text: '  First\nblock  ' });
      document = addOfferContentBlock(document, { offerId: 'offer', blockId: 'missing', title: 'Missing text' });
      document = addOfferContentBlock(document, { offerId: 'offer', blockId: 'empty', title: 'Empty text', text: '' });
      document = addOfferContentBlock(document, { offerId: 'offer', blockId: 'space', title: 'Whitespace text', text: ' \n\t ' });
      return addOfferContentBlock(document, { offerId: 'offer', blockId: 'last', title: 'Last title', text: '\n Last\nblock \t' });
    }

    it('returns only the title when no eligible canonical body is current', () => {
      const document = offerDocument();
      expect(offerContentWholeText(document, 'offer')).toBe('Subscription');
      const urlOnly = updateOfferContent(document, { offerId: 'offer', field: 'contentUrl', value: 'https://example.test/content' });
      expect(offerContentWholeText(urlOnly, 'offer')).toBe('Subscription');
      const titleOnlyStructured = addOfferContentBlock(document, { offerId: 'offer', blockId: 'heading', title: 'Heading' });
      expect(offerContentWholeText(titleOnlyStructured, 'offer')).toBe('Subscription');
    });

    it('preserves committed free-form content and excludes alternate content and URL', () => {
      const document = updateOfferContent(bothRepresentations(), { offerId: 'offer', field: 'contentUrl', value: 'https://example.test/content' });
      expect(offerContentWholeText(document, 'offer')).toBe('Subscription\n\nFree\nbody');
      const withoutUrl = updateOfferContent(document, { offerId: 'offer', field: 'contentUrl' });
      expect(offerContentWholeText(withoutUrl, 'offer')).toBe('Subscription\n\nFree\nbody');
    });

    it('assembles only nonblank block text in authored order with normalized outer whitespace', () => {
      const document = setOfferCurrentContentSource(bothRepresentations(), { offerId: 'offer', source: 'structured' });
      expect(offerContentWholeText(document, 'offer')).toBe('Subscription\n\nFirst\nblock\n\nLast\nblock');
      expect(offerContentWholeText(document, 'offer')).not.toMatch(/First title|Last title|first|last/);
      const reordered = reorderOfferContentBlocks(document, { offerId: 'offer', blockIds: ['last', 'missing', 'empty', 'space', 'first'] });
      expect(offerContentWholeText(reordered, 'offer')).toBe('Subscription\n\nLast\nblock\n\nFirst\nblock');
      const retitled = updateOfferContentBlock(reordered, { offerId: 'offer', blockId: 'first', field: 'title', value: 'Changed heading' });
      expect(offerContentWholeText(retitled, 'offer')).toBe(offerContentWholeText(reordered, 'offer'));
    });

    it('tracks only canonical Current and the Offer title without changing authored bodies', () => {
      const freeForm = bothRepresentations();
      const beforeOffer = freeForm.entities.find(entity => entity.id === 'offer');
      const structured = setOfferCurrentContentSource(freeForm, { offerId: 'offer', source: 'structured' });
      expect(offerContentWholeText(freeForm, 'offer')).toBe('Subscription\n\nFree\nbody');
      expect(offerContentWholeText(structured, 'offer')).toBe('Subscription\n\nFirst\nblock\n\nLast\nblock');
      expect(structured.entities.find(entity => entity.id === 'offer')).toMatchObject({ contentText: 'Free\nbody', contentBlocks: (beforeOffer as Extract<typeof beforeOffer, { kind: 'offer' }>).contentBlocks });
      const renamed = updateEntity(structured, { entityId: 'offer', title: 'Renamed', linkedProductId: 'product' });
      expect(offerContentWholeText(renamed, 'offer')).toBe('Renamed\n\nFirst\nblock\n\nLast\nblock');
    });

    it('keeps duplicate block IDs out and gives a canonical duplicate equivalent body text', () => {
      const source = setOfferCurrentContentSource(bothRepresentations(), { offerId: 'offer', source: 'structured' });
      const copy = duplicateEntity(source, { sourceEntityId: 'offer', entityId: 'copy', title: 'Copied', viewId: 'view', x: 30, y: 40, relationshipIds: ['copy-product'], offerContentBlockIds: ['fresh-first', 'fresh-missing', 'fresh-empty', 'fresh-space', 'fresh-last'] });
      expect(offerContentWholeText(copy, 'copy')).toBe('Copied\n\nFirst\nblock\n\nLast\nblock');
      expect(offerContentWholeText(copy, 'copy')).not.toContain('fresh-');
      expect(offerContentWholeText(copy, 'copy').replace('Copied', 'Subscription')).toBe(offerContentWholeText(source, 'offer'));
    });

    it('rejects invalid owners, follows canonical malformed-state normalization, and is a pure repeatable read', () => {
      const document = bothRepresentations();
      expect(() => offerContentWholeText(document, 'missing')).toThrow('existing entity');
      expect(() => offerContentWholeText(document, 'product')).toThrow('must reference a offer');
      const malformed = { ...document, entities: document.entities.map(entity => entity.id === 'offer' && entity.kind === 'offer' ? { ...entity, currentContentSource: 'structured' as const, contentBlocks: [{ id: 'blank', title: 'Title', text: ' ' }] } : entity) };
      expect(offerContentSourceState(malformed, 'offer')).toMatchObject({ currentContentSource: 'free_form', structuredEligible: false });
      expect(offerContentWholeText(malformed, 'offer')).toBe('Subscription\n\nFree\nbody');
      const snapshot = structuredClone(document);
      const entities = document.entities;
      expect(offerContentWholeText(document, 'offer')).toBe(offerContentWholeText(document, 'offer'));
      expect(document).toEqual(snapshot);
      expect(document.entities).toBe(entities);
    });
  });

  describe('Offer current Content source', () => {
    const current = (document: ReturnType<typeof offerDocument>, id = 'offer') =>
      document.entities.find(entity => entity.id === id && entity.kind === 'offer') as Extract<(typeof document.entities)[number], { kind: 'offer' }>;

    it('projects canonical source and eligibility without mutating the document', () => {
      const emptyOffer = offerDocument();
      const cases = [
        [emptyOffer, { currentContentSource: null, freeFormEligible: false, structuredEligible: false }],
        [updateOfferContent(emptyOffer, { offerId: 'offer', field: 'contentUrl', value: 'https://example.test' }), { currentContentSource: null, freeFormEligible: false, structuredEligible: false }],
        [updateOfferContent(emptyOffer, { offerId: 'offer', field: 'contentText', value: 'Free' }), { currentContentSource: 'free_form', freeFormEligible: true, structuredEligible: false }],
        [addOfferContentBlock(emptyOffer, { offerId: 'offer', blockId: 'body', title: 'Title', text: 'Body' }), { currentContentSource: 'structured', freeFormEligible: false, structuredEligible: true }],
      ] as const;
      for (const [document, expected] of cases) {
        expect(offerContentSourceState(document, 'offer')).toEqual(expected);
        expect(offerContentSourceState(document, 'offer')).toEqual(expected);
      }
      for (const text of [undefined, '', ' \n ']) {
        const document = addOfferContentBlock(emptyOffer, { offerId: 'offer', blockId: `empty-${String(text)}`, title: 'Title', ...(text === undefined ? {} : { text }) });
        expect(offerContentSourceState(document, 'offer')).toEqual({ currentContentSource: null, freeFormEligible: false, structuredEligible: false });
      }
      let both = addOfferContentBlock(updateOfferContent(emptyOffer, { offerId: 'offer', field: 'contentText', value: 'Free' }), { offerId: 'offer', blockId: 'both', title: 'Title', text: 'Body' });
      expect(offerContentSourceState(both, 'offer')).toEqual({ currentContentSource: 'free_form', freeFormEligible: true, structuredEligible: true });
      both = setOfferCurrentContentSource(both, { offerId: 'offer', source: 'structured' });
      expect(offerContentSourceState(both, 'offer')).toEqual({ currentContentSource: 'structured', freeFormEligible: true, structuredEligible: true });
      const fallback = updateOfferContentBlock(both, { offerId: 'offer', blockId: 'both', field: 'text', value: ' ' });
      expect(offerContentSourceState(fallback, 'offer').currentContentSource).toBe('free_form');
      const identity = fallback;
      offerContentSourceState(fallback, 'offer');
      expect(fallback).toBe(identity);
      expect(() => offerContentSourceState(fallback, 'missing')).toThrow('existing entity');
      expect(() => offerContentSourceState(fallback, 'product')).toThrow('must reference a offer');
    });

    it('starts empty and selects only the first representation with a non-whitespace body', () => {
      const emptyOffer = offerDocument();
      expect(current(emptyOffer).currentContentSource).toBeNull();
      expect(current(updateOfferContent(emptyOffer, { offerId: 'offer', field: 'contentUrl', value: 'https://example.test' })).currentContentSource).toBeNull();
      for (const text of [undefined, '', ' \n ']) {
        const block = addOfferContentBlock(emptyOffer, { offerId: 'offer', blockId: `block-${String(text)}`, title: 'Title', ...(text !== undefined ? { text } : {}) });
        expect(current(block).currentContentSource).toBeNull();
      }
      const free = updateOfferContent(emptyOffer, { offerId: 'offer', field: 'contentText', value: ' Body ' });
      expect(current(free).currentContentSource).toBe('free_form');
      expect(current(addOfferContentBlock(free, { offerId: 'offer', blockId: 'structured', title: 'Title', text: 'Body' })).currentContentSource).toBe('free_form');
      const structured = addOfferContentBlock(emptyOffer, { offerId: 'offer', blockId: 'structured', title: 'Title', text: ' Body ' });
      expect(current(structured).currentContentSource).toBe('structured');
      expect(current(updateOfferContent(structured, { offerId: 'offer', field: 'contentText', value: 'Free' })).currentContentSource).toBe('structured');
    });

    it('switches explicitly only to eligible sources and preserves identity for the current source', () => {
      let both = updateOfferContent(offerDocument(), { offerId: 'offer', field: 'contentText', value: 'Free' });
      both = addOfferContentBlock(both, { offerId: 'offer', blockId: 'block', title: 'Title', text: 'Structured' });
      expect(setOfferCurrentContentSource(both, { offerId: 'offer', source: 'free_form' })).toBe(both);
      const structured = setOfferCurrentContentSource(both, { offerId: 'offer', source: 'structured' });
      expect(current(structured).currentContentSource).toBe('structured');
      expect(current(setOfferCurrentContentSource(structured, { offerId: 'offer', source: 'free_form' })).currentContentSource).toBe('free_form');
      const before = offerDocument();
      expect(() => setOfferCurrentContentSource(before, { offerId: 'offer', source: 'structured' })).toThrow('eligible');
      expect(() => setOfferCurrentContentSource(before, { offerId: 'missing', source: 'free_form' })).toThrow();
      expect(() => setOfferCurrentContentSource(before, { offerId: 'offer', source: null } as never)).toThrow('free_form or structured');
      expect(before).toEqual(offerDocument());
    });

    it('normalizes fallbacks atomically across text edits and block removal', () => {
      let both = updateOfferContent(offerDocument(), { offerId: 'offer', field: 'contentText', value: 'Free' });
      both = addOfferContentBlock(both, { offerId: 'offer', blockId: 'one', title: 'One', text: 'Structured' });
      both = addOfferContentBlock(both, { offerId: 'offer', blockId: 'two', title: 'Two', text: 'More' });
      const structured = setOfferCurrentContentSource(both, { offerId: 'offer', source: 'structured' });
      const clearedNonCurrent = updateOfferContent(structured, { offerId: 'offer', field: 'contentText', value: ' ' });
      expect(current(clearedNonCurrent).currentContentSource).toBe('structured');
      const oneRemoved = removeOfferContentBlock(structured, { offerId: 'offer', blockId: 'one' });
      expect(current(oneRemoved).currentContentSource).toBe('structured');
      const fallbackFree = updateOfferContentBlock(oneRemoved, { offerId: 'offer', blockId: 'two', field: 'text', value: '\t' });
      expect(current(fallbackFree).currentContentSource).toBe('free_form');
      const fallbackStructured = updateOfferContent(both, { offerId: 'offer', field: 'contentText', value: '' });
      expect(current(fallbackStructured).currentContentSource).toBe('structured');
      const none = updateOfferContentBlock(removeOfferContentBlock(fallbackStructured, { offerId: 'offer', blockId: 'one' }), { offerId: 'offer', blockId: 'two', field: 'text', value: '' });
      expect(current(none).currentContentSource).toBeNull();
      expect(current(none).contentBlocks?.[0]).toHaveProperty('text', '');
    });

    it('does not recalculate for title, order, URL, or general Offer updates', () => {
      let document = addOfferContentBlock(offerDocument(), { offerId: 'offer', blockId: 'one', title: 'One', text: 'Body' });
      document = addOfferContentBlock(document, { offerId: 'offer', blockId: 'two', title: 'Two' });
      const titled = updateOfferContentBlock(document, { offerId: 'offer', blockId: 'two', field: 'title', value: 'Renamed' });
      expect(current(titled).currentContentSource).toBe('structured');
      expect(current(reorderOfferContentBlocks(titled, { offerId: 'offer', blockIds: ['two', 'one'] })).currentContentSource).toBe('structured');
      expect(current(updateOfferContent(titled, { offerId: 'offer', field: 'contentUrl', value: 'https://example.test' })).currentContentSource).toBe('structured');
      const updated = updateEntity(titled, { entityId: 'offer', title: 'Renamed Offer', linkedProductId: 'product' });
      expect(current(updated)).toMatchObject({ title: 'Renamed Offer', currentContentSource: 'structured', contentBlocks: current(titled).contentBlocks });
    });

    it('duplicates canonical semantic selection with fresh block IDs and normalizes malformed legacy state', () => {
      let source = updateOfferContent(offerDocument(), { offerId: 'offer', field: 'contentText', value: 'Free' });
      source = addOfferContentBlock(source, { offerId: 'offer', blockId: 'block', title: 'Title', text: 'Structured' });
      source = setOfferCurrentContentSource(source, { offerId: 'offer', source: 'structured' });
      const copy = duplicateEntity(source, { sourceEntityId: 'offer', entityId: 'copy', viewId: 'view', x: 1, y: 2, relationshipIds: ['copy-product'], offerContentBlockIds: ['fresh'] });
      expect(current(copy, 'copy')).toMatchObject({ currentContentSource: 'structured', contentText: 'Free', contentBlocks: [{ id: 'fresh', title: 'Title', text: 'Structured' }] });
      expect(current(source).contentBlocks?.[0]?.id).toBe('block');
      const malformed = { ...source, entities: source.entities.map(entity => entity.id === 'offer' ? { ...entity, currentContentSource: 'stale' as never } : entity) };
      const normalized = duplicateEntity(malformed, { sourceEntityId: 'offer', entityId: 'legacy-copy', viewId: 'view', x: 3, y: 4, relationshipIds: ['legacy-product'], offerContentBlockIds: ['legacy-block'] });
      expect(current(normalized, 'legacy-copy').currentContentSource).toBe('free_form');
    });
  });

  describe('Offer Content external-copy URLs', () => {
    const offer = (document: ReturnType<typeof offerDocument>, id = 'offer') => document.entities.find((entity): entity is Extract<(typeof document.entities)[number], { kind: 'offer' }> => entity.id === id && entity.kind === 'offer')!;

    it('authors each source independently without eligibility and permits the same URL for both', () => {
      const titleOnly = addOfferContentBlock(offerDocument(), { offerId: 'offer', blockId: 'heading', title: 'Heading only' });
      const freeForm = setOfferContentExternalCopyUrl(titleOnly, { offerId: 'offer', source: 'free_form', value: '  https://example.test/copy  ' });
      expect(offer(freeForm)).toMatchObject({ freeFormExternalCopyUrl: 'https://example.test/copy', currentContentSource: null });
      expect(offer(freeForm)).not.toHaveProperty('structuredExternalCopyUrl');

      const both = setOfferContentExternalCopyUrl(freeForm, { offerId: 'offer', source: 'structured', value: 'https://example.test/copy' });
      expect(offer(both)).toMatchObject({
        freeFormExternalCopyUrl: 'https://example.test/copy',
        structuredExternalCopyUrl: 'https://example.test/copy',
        contentBlocks: [{ id: 'heading', title: 'Heading only' }],
        currentContentSource: null,
      });
    });

    it('clears only the selected field and preserves identity for normalized no-ops', () => {
      let document = setOfferContentExternalCopyUrl(offerDocument(), { offerId: 'offer', source: 'free_form', value: 'https://example.test/free' });
      document = setOfferContentExternalCopyUrl(document, { offerId: 'offer', source: 'structured', value: 'http://example.test/structured' });
      expect(setOfferContentExternalCopyUrl(document, { offerId: 'offer', source: 'free_form', value: ' https://example.test/free ' })).toBe(document);

      const cleared = setOfferContentExternalCopyUrl(document, { offerId: 'offer', source: 'free_form', value: ' \n\t ' });
      expect(offer(cleared)).not.toHaveProperty('freeFormExternalCopyUrl');
      expect(offer(cleared).structuredExternalCopyUrl).toBe('http://example.test/structured');
      expect(setOfferContentExternalCopyUrl(cleared, { offerId: 'offer', source: 'free_form', value: '' })).toBe(cleared);
      expect(setOfferContentExternalCopyUrl(cleared, { offerId: 'offer', source: 'free_form' })).toBe(cleared);
    });

    it('accepts absolute HTTP(S), rejects other URL forms and unsupported sources atomically', () => {
      const before = offerDocument();
      expect(offer(setOfferContentExternalCopyUrl(before, { offerId: 'offer', source: 'free_form', value: 'http://example.test/copy' })).freeFormExternalCopyUrl).toBe('http://example.test/copy');
      expect(offer(setOfferContentExternalCopyUrl(before, { offerId: 'offer', source: 'structured', value: 'https://example.test/copy' })).structuredExternalCopyUrl).toBe('https://example.test/copy');
      const snapshot = structuredClone(before);
      for (const value of ['/relative', 'not a url', 'javascript:alert(1)', 'ftp://example.test/file', 'mailto:author@example.test']) {
        expect(() => setOfferContentExternalCopyUrl(before, { offerId: 'offer', source: 'free_form', value })).toThrow('absolute http: or https:');
        expect(before).toEqual(snapshot);
      }
      expect(() => setOfferContentExternalCopyUrl(before, { offerId: 'offer', source: 'other' as never, value: 'https://example.test' })).toThrow('free_form or structured');
      expect(() => setOfferContentExternalCopyUrl(before, { offerId: 'product', source: 'free_form', value: 'https://example.test' })).toThrow('must reference a offer');
      expect(before).toEqual(snapshot);
    });

    it('preserves Content, Current, relationships, and unrelated document data across URL and Current edits', () => {
      let document = updateOfferContent(offerDocument(), { offerId: 'offer', field: 'contentUrl', value: 'https://example.test/content' });
      document = updateOfferContent(document, { offerId: 'offer', field: 'contentText', value: 'Free body' });
      document = addOfferContentBlock(document, { offerId: 'offer', blockId: 'body', title: 'Structured', text: 'Structured body' });
      document = setOfferContentExternalCopyUrl(document, { offerId: 'offer', source: 'free_form', value: 'https://example.test/free-copy' });
      const beforeExternalEdit = document;
      const next = setOfferContentExternalCopyUrl(document, { offerId: 'offer', source: 'structured', value: 'https://example.test/structured-copy' });
      expect({ ...offer(next), structuredExternalCopyUrl: undefined }).toEqual({ ...offer(beforeExternalEdit), structuredExternalCopyUrl: undefined });
      expect(next.relationships).toBe(beforeExternalEdit.relationships);
      expect(next.touchpointContainers).toBe(beforeExternalEdit.touchpointContainers);

      const structured = setOfferCurrentContentSource(next, { offerId: 'offer', source: 'structured' });
      const changedContentUrl = updateOfferContent(structured, { offerId: 'offer', field: 'contentUrl', value: 'http://example.test/new-content' });
      expect(offer(changedContentUrl)).toMatchObject({
        contentUrl: 'http://example.test/new-content', contentText: 'Free body',
        contentBlocks: [{ id: 'body', title: 'Structured', text: 'Structured body' }], currentContentSource: 'structured',
        freeFormExternalCopyUrl: 'https://example.test/free-copy', structuredExternalCopyUrl: 'https://example.test/structured-copy',
      });
    });

    it('duplicates both authored URLs unchanged and independently of body or Current', () => {
      let source = setOfferContentExternalCopyUrl(offerDocument(), { offerId: 'offer', source: 'free_form', value: 'https://example.test/free-copy' });
      source = setOfferContentExternalCopyUrl(source, { offerId: 'offer', source: 'structured', value: 'http://example.test/structured-copy' });
      const copy = duplicateEntity(source, { sourceEntityId: 'offer', entityId: 'copy', viewId: 'view', x: 30, y: 40, relationshipIds: ['copy-product'] });
      expect(offer(copy, 'copy')).toEqual({
        id: 'copy', kind: 'offer', title: 'Subscription', currentContentSource: null,
        freeFormExternalCopyUrl: 'https://example.test/free-copy', structuredExternalCopyUrl: 'http://example.test/structured-copy',
      });
    });
  });

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
    expect(updateOfferContent(clearedUrl, { offerId: 'offer', field: 'contentText', value: '\n ' }).entities.find(entity => entity.id === 'offer')).toEqual({ id: 'offer', kind: 'offer', title: 'Subscription', currentContentSource: null });
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
    expect(copy.entities.find(entity => entity.id === 'copy')).toEqual({ id: 'copy', kind: 'offer', title: 'Copy', currentContentSource: 'free_form', contentUrl: 'https://example.test/brief', contentText: 'Line one\nLine two' });
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
  describe('read-only resistance impact projections', () => {
    function resistanceDocument() {
      let d = scoped();
      d = completed(authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], jobId: 'job', addressedDesiredOutcomeIds: ['outcome'], productJobIntentIds: ['intent'], offerJobSelectionIds: ['offer-selection'], touchpointSelectionIds: ['local'] }));
      d = addEntity(d, { ...place, entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome' });
      d = completed(authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], financialDesiredOutcomeId: 'fdo', offerFinancialIntentIds: ['financial-intent'], touchpointSelectionIds: ['financial-local'] }));
      return addEntity(d, { ...place, entityId: 'repulsor', title: 'Friction', kind: 'repulsor', resistedTargetIds: ['job', 'fdo'], relationshipIds: ['resists-job', 'resists-fdo'] });
    }
    const summaries = (d: ReturnType<typeof resistanceDocument>) => resistanceImpactForOffer(d, 'offer')[0]?.grounds.map(ground => ({
      touchpointId: ground.touchpointId,
      target: ground.resistedTarget,
      mitigated: ground.hasMitigationIntent,
    }));

    it('explains independent Job and FDO grounds in canonical Touchpoint and entity order', () => {
      const d = resistanceDocument();
      expect(summaries(d)).toEqual([
        { touchpointId: 'touch', target: { entityId: 'job', kind: 'core_functional_job' }, mitigated: false },
        { touchpointId: 'touch', target: { entityId: 'fdo', kind: 'financial_desired_outcome' }, mitigated: false },
      ]);
    });

    it('keeps different targets and Touchpoints distinct while deduplicating repeated runtime paths', () => {
      let d = resistanceDocument();
      d = addEntity(d, { ...place, entityId: 'touch-2', title: 'Second', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['offer'], relationshipIds: ['presented-2'] });
      d = setTouchpointIntentSelections(d, { touchpointId: 'touch-2', selections: [{ id: 'local-2', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] });
      d = {
        ...d,
        touchpointJobSelections: [...d.touchpointJobSelections, { ...d.touchpointJobSelections[0]!, id: 'duplicate-runtime-path' }],
        relationships: [...d.relationships, { id: 'duplicate-resists-job', kind: 'repulsor_resists', repulsorId: 'repulsor', targetEntityId: 'job' }],
      };
      expect(summaries(d)).toEqual([
        { touchpointId: 'touch', target: { entityId: 'job', kind: 'core_functional_job' }, mitigated: false },
        { touchpointId: 'touch', target: { entityId: 'fdo', kind: 'financial_desired_outcome' }, mitigated: false },
        { touchpointId: 'touch-2', target: { entityId: 'job', kind: 'core_functional_job' }, mitigated: false },
      ]);
    });

    it('reports authored mitigation intent only for its exact Touchpoint and Repulsor', () => {
      let d = resistanceDocument();
      d = addEntity(d, { ...place, entityId: 'touch-2', title: 'Second', kind: 'touchpoint', locatedInId: 'site', linkedOfferIds: ['offer'], relationshipIds: ['presented-2'] });
      d = setTouchpointIntentSelections(d, { touchpointId: 'touch-2', selections: [{ id: 'local-2', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['outcome'] }] });
      d = setTouchpointMitigations(d, { touchpointId: 'touch', repulsorIds: ['repulsor'], newRelationshipIds: ['mitigates'] });
      expect(summaries(d)?.filter(ground => ground.target.entityId === 'job').map(ground => ground.mitigated)).toEqual([true, false]);
    });

    it('excludes another Offer, unlinked, stale, and ineffective selections', () => {
      let d = resistanceDocument();
      d = addEntity(d, { ...place, entityId: 'other-offer', title: 'Other', kind: 'offer', linkedProductId: 'product', relationshipId: 'packaged-other' });
      d = setOfferJobSelections(d, { offerId: 'other-offer', productJobIntentIds: ['intent'], newSelectionIds: ['other-offer-selection'] });
      d = updateEntity(d, { entityId: 'touch', title: 'touch', locatedInId: 'site', linkedOfferIds: ['offer', 'other-offer'], relationshipIds: ['presented-touch', 'presented-other'] });
      const invalidSelections = [
        { ...d.touchpointJobSelections[0]!, id: 'wrong-offer', offerId: 'other-offer' },
        { ...d.touchpointJobSelections[0]!, id: 'stale-job', productJobIntentId: 'missing' },
        { ...d.touchpointJobSelections[0]!, id: 'unlinked-job', touchpointId: 'unlinked' },
      ];
      const invalidFinancial = [
        { ...d.touchpointFinancialSelections[0]!, id: 'wrong-financial-offer', offerId: 'other-offer' },
        { ...d.touchpointFinancialSelections[0]!, id: 'stale-financial', offerFinancialIntentId: 'missing' },
      ];
      d = { ...d, touchpointJobSelections: invalidSelections, touchpointFinancialSelections: invalidFinancial };
      expect(resistanceImpactForOffer(d, 'offer')).toEqual([]);
    });

    it('never treats an ordinary Desired Outcome as a resisted target', () => {
      const d = resistanceDocument();
      const malformed = { ...d, relationships: [...d.relationships, { id: 'invalid-resists-outcome', kind: 'repulsor_resists' as const, repulsorId: 'repulsor', targetEntityId: 'outcome' }] };
      expect(summaries(malformed)).toEqual(summaries(d));
    });

    it('preserves the Product contract, deduplicates its paths, and does not mutate the document', () => {
      const d = resistanceDocument();
      const before = structuredClone(d);
      const arrays = Object.fromEntries(Object.entries(d).filter(([, value]) => Array.isArray(value)));
      expect(resistanceImpactForOffer(d, 'offer')[0]?.grounds).toHaveLength(2);
      expect(resistanceImpactForProduct(d, 'product')).toEqual([{ repulsor: expect.objectContaining({ id: 'repulsor' }), paths: [{ offerId: 'offer', touchpointId: 'touch' }] }]);
      expect(d).toEqual(before);
      for (const [key, value] of Object.entries(arrays)) expect(d[key as keyof typeof d]).toBe(value);
    });
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
    if (targetOfferIds.includes('orphan-offer')) d = { ...d, entities: [...d.entities, { id: 'orphan-offer', title: 'Orphan Offer', kind: 'offer', currentContentSource: null }] };
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

describe('canonical Product Client intent commands', () => {
  function fixture(downstream = false) {
    let d = offerDocument();
    d = addEntity(d, { ...place, entityId: 'job', title: 'Job', kind: 'core_functional_job' });
    for (const id of ['a', 'b']) d = addEntity(d, { ...place, entityId: id, title: id, kind: 'desired_outcome', parentEntityId: 'job', relationshipId: `owns-${id}` });
    if (downstream) {
      d = addProductJobIntent(d, { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['a', 'b'] });
      d = setOfferJobSelections(d, { offerId: 'offer', selections: [{ productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['a', 'b'] }], newSelectionIds: ['offer-selection'] });
      d = touchpoint(d);
      d = setTouchpointIntentSelections(d, { touchpointId: 'touch', selections: [{ id: 'touch-selection', kind: 'job', offerId: 'offer', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['a', 'b'] }] });
      d = addEntity(d, { ...place, entityId: 'rep', title: 'Friction', kind: 'repulsor', resistedTargetIds: ['job'], relationshipIds: ['resists'] });
      d = setTouchpointMitigations(d, { touchpointId: 'touch', repulsorIds: ['rep'], newRelationshipIds: ['mitigates'] });
    }
    return d;
  }
  const run = (d: MapDocument, command: ProductClientIntentCommand, confirmedImpact = false) => applyProductClientIntentCommand(d, { productId: 'product', command, confirmedImpact });
  function done(d: MapDocument, command: ProductClientIntentCommand, confirmedImpact = false) { const r = run(d, command, confirmedImpact); if (r.status !== 'complete') throw new Error('Expected completion'); return r.document; }
  function freeze(v: unknown) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } }
  it('selects existing Job/DO, creates missing membership once and normalizes no-ops', () => {
    const original = fixture();
    let d = done(original, { kind: 'select-job', jobId: 'job', newIntentId: 'intent' });
    expect(d.productJobIntents).toEqual([{ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: [] }]);
    expect(done(d, { kind: 'select-job', jobId: 'job' })).toBe(d);
    d = done(d, { kind: 'select-desired-outcome', jobId: 'job', desiredOutcomeId: 'a' });
    expect(done(d, { kind: 'select-desired-outcome', jobId: 'job', desiredOutcomeId: 'a' })).toBe(d);
    expect(done(original, { kind: 'select-desired-outcome', jobId: 'job', desiredOutcomeId: 'a', newIntentId: 'fresh' }).productJobIntents[0]).toMatchObject({ id: 'fresh', addressedDesiredOutcomeIds: ['a'] });
    expect(d.offerJobSelections).toEqual(original.offerJobSelections);
  });
  it('removes last DO without removing membership and completes no-impact removals', () => {
    const original = fixture();
    expect(done(original, { kind: 'remove-job', jobId: 'job' })).toBe(original);
    let d = done(original, { kind: 'select-desired-outcome', jobId: 'job', desiredOutcomeId: 'a', newIntentId: 'intent' });
    expect(done(d, { kind: 'remove-desired-outcome', jobId: 'job', desiredOutcomeId: 'b' })).toBe(d);
    d = done(d, { kind: 'remove-desired-outcome', jobId: 'job', desiredOutcomeId: 'a' });
    expect(d.productJobIntents[0]!.addressedDesiredOutcomeIds).toEqual([]);
    expect(done(d, { kind: 'remove-job', jobId: 'job' }).productJobIntents).toEqual([]);
  });
  it.each(['remove-job', 'remove-desired-outcome'] as const)('plans exact %s impact without mutation and confirms atomic pruning', kind => {
    const d = fixture(true); const before = structuredClone(d); freeze(d);
    const command: ProductClientIntentCommand = kind === 'remove-job' ? { kind, jobId: 'job' } : { kind, jobId: 'job', desiredOutcomeId: 'b' };
    const r = run(d, command); expect(r.status).toBe('confirmation-required'); expect(d).toEqual(before);
    if (r.status !== 'confirmation-required') throw new Error('Expected review');
    expect(r).not.toHaveProperty('document');
    expect(r.impact).toEqual(kind === 'remove-job' ? { offerJobSelectionIds: ['offer-selection'], touchpointJobSelectionIds: ['touch-selection'], narrowedOfferSelections: [], narrowedTouchpointSelections: [], mitigationRelationshipIds: ['mitigates'] } : { offerJobSelectionIds: [], touchpointJobSelectionIds: [], narrowedOfferSelections: [{ offerJobSelectionId: 'offer-selection', removedDesiredOutcomeIds: ['b'] }], narrowedTouchpointSelections: [{ touchpointJobSelectionId: 'touch-selection', removedDesiredOutcomeIds: ['b'] }], mitigationRelationshipIds: [] });
    const next = done(d, command, true);
    expect(next.entities).toEqual(d.entities); expect(next.placements).toEqual(d.placements);
    expect(next.offerFinancialIntents).toEqual(d.offerFinancialIntents); expect(next.epistemicAnnotations).toEqual(d.epistemicAnnotations);
    if (kind === 'remove-job') { expect(next.offerJobSelections).toEqual([]); expect(next.touchpointJobSelections).toEqual([]); expect(next.relationships.map(r => r.id)).not.toContain('mitigates'); }
    else { expect(next.offerJobSelections[0]!.addressedDesiredOutcomeIds).toEqual(['a']); expect(next.touchpointJobSelections[0]!.addressedDesiredOutcomeIds).toEqual(['a']); }
  });
  it('replays confirmed operation against fresh state without replacing sibling scope', () => {
    const d = fixture(true); const command = { kind: 'remove-desired-outcome', jobId: 'job', desiredOutcomeId: 'b' } as const;
    expect(run(d, command).status).toBe('confirmation-required');
    const fresh = addProductJobIntent(addEntity(d, { ...place, entityId: 'social', title: 'Social', kind: 'social_job' }), { id: 'sibling', productId: 'product', jobId: 'social', addressedDesiredOutcomeIds: [] });
    expect(done(fresh, command, true).productJobIntents.find(i => i.id === 'sibling')).toEqual(fresh.productJobIntents.find(i => i.id === 'sibling'));
  });
  it.each(['core_functional_job', 'consumption_chain_job', 'emotional_job', 'social_job'] as const)('atomically creates %s and membership', kind => {
    const d = fixture(); const next = done(d, { kind: 'create-job', creation: { ...place, kind, entityId: 'new-job', title: '  New Job  ' }, newIntentId: 'new-intent' });
    expect(next.entities.find(e => e.id === 'new-job')).toMatchObject({ kind, title: 'New Job' });
    expect(next.productJobIntents).toEqual([{ id: 'new-intent', productId: 'product', jobId: 'new-job', addressedDesiredOutcomeIds: [] }]);
    expect(next.placements).toHaveLength(d.placements.length + 1);
  });
  it('creates contextual RJ without Product intent to CFJ', () => {
    const next = done(fixture(), { kind: 'create-related-job', creation: { ...place, entityId: 'rj', title: 'Related', parentEntityId: 'job', relationshipId: 'context' }, newIntentId: 'rj-intent' });
    expect(next.productJobIntents.map(i => i.jobId)).toEqual(['rj']);
    expect(next.relationships).toContainEqual({ id: 'context', kind: 'core_functional_job_has_related_job', coreFunctionalJobId: 'job', relatedJobId: 'rj' });
  });
  it.each([false, true])('creates DO, owner relationship and extends/creates Product membership (existing: %s)', existing => {
    let d = fixture(); if (existing) d = done(d, { kind: 'select-desired-outcome', jobId: 'job', desiredOutcomeId: 'a', newIntentId: 'intent' });
    const next = done(d, { kind: 'create-desired-outcome', creation: { ...place, entityId: 'new-do', title: 'New DO', parentEntityId: 'job', relationshipId: 'owns-new' }, newIntentId: 'intent' });
    expect(next.productJobIntents[0]!.addressedDesiredOutcomeIds).toEqual(existing ? ['a', 'new-do'] : ['new-do']);
    expect(next.relationships).toContainEqual({ id: 'owns-new', kind: 'job_has_desired_outcome', jobId: 'job', desiredOutcomeId: 'new-do' });
    expect(next.offerJobSelections).toEqual(d.offerJobSelections);
  });
  it('rejects stale/wrong endpoints, contexts, ownership and missing stable IDs without mutation', () => {
    const d = fixture(); const before = structuredClone(d); freeze(d);
    const commands: ProductClientIntentCommand[] = [
      { kind: 'select-job', jobId: 'missing' }, { kind: 'select-job', jobId: 'a' }, { kind: 'select-job', jobId: 'job' },
      { kind: 'select-desired-outcome', jobId: 'job', desiredOutcomeId: 'missing' }, { kind: 'select-desired-outcome', jobId: 'job', desiredOutcomeId: 'offer' },
      { kind: 'create-related-job', creation: { ...place, entityId: 'rj', title: 'RJ', parentEntityId: 'a', relationshipId: 'context' }, newIntentId: 'rj-intent' },
      { kind: 'create-desired-outcome', creation: { ...place, entityId: 'new-do', title: 'DO', parentEntityId: 'offer', relationshipId: 'new-owns' } },
    ];
    commands.forEach(c => expect(() => run(d, c)).toThrow()); expect(d).toEqual(before);
  });
  it('rejects duplicate memberships and duplicate record IDs instead of guessing', () => {
    const base = done(fixture(), { kind: 'select-job', jobId: 'job', newIntentId: 'intent' });
    for (const record of [{ ...base.productJobIntents[0]!, id: 'duplicate' }, { ...base.productJobIntents[0]!, productId: 'other' }]) {
      const d = { ...base, productJobIntents: [...base.productJobIntents, record] };
      expect(() => run(d, { kind: 'remove-job', jobId: 'job' })).toThrow(/unambiguous/);
    }
  });
  it('rejects creation that would silently repair stale Product membership', () => {
    const d = fixture(); d.productJobIntents.push({ id: 'stale', productId: 'product', jobId: 'new-job', addressedDesiredOutcomeIds: [] });
    const before = structuredClone(d); freeze(d);
    expect(() => run(d, { kind: 'create-job', creation: { ...place, entityId: 'new-job', title: 'New', kind: 'social_job' }, newIntentId: 'fresh' })).toThrow(/cannot repair/);
    expect(d).toEqual(before);
  });
  it('leaves no partial creation after entity/relationship/intent collisions and later validation failure', () => {
    const d = done(fixture(), { kind: 'select-job', jobId: 'job', newIntentId: 'intent' }); const before = structuredClone(d); freeze(d);
    const commands: ProductClientIntentCommand[] = [
      { kind: 'create-job', creation: { ...place, entityId: 'job', title: 'Duplicate', kind: 'social_job' }, newIntentId: 'new-intent' },
      { kind: 'create-job', creation: { ...place, entityId: 'new', title: 'New', kind: 'social_job' }, newIntentId: 'intent' },
      { kind: 'create-job', creation: { ...place, entityId: 'new', title: ' ', kind: 'social_job' }, newIntentId: 'new-intent' },
      { kind: 'create-desired-outcome', creation: { ...place, entityId: 'new', title: 'New', parentEntityId: 'job', relationshipId: 'owns-a' } },
    ];
    commands.forEach(c => expect(() => run(d, c)).toThrow()); expect(d).toEqual(before);
    const absent = fixture(); expect(() => run(absent, { kind: 'create-desired-outcome', creation: { ...place, entityId: 'new', title: 'New', parentEntityId: 'job', relationshipId: 'owns-new' } })).toThrow(/stable ID/);
    expect(absent.entities.some(e => e.id === 'new')).toBe(false);
  });
});


describe('Product resistance exposure', () => {
  const kinds = ['core_functional_job', 'related_job', 'consumption_chain_job', 'emotional_job', 'social_job'] as const;
  function fixture(): MapDocument {
    const d = createEmptyMapDocument({ mapId: 'exposure', title: 'Exposure', viewId: 'view', viewTitle: 'View' });
    d.entities = [{ id: 'product', kind: 'product', title: 'Product' }, { id: 'other-product', kind: 'product', title: 'Other' }, { id: 'rep', kind: 'repulsor', title: 'Friction' }, ...kinds.map((kind, i) => ({ id: `job-${i}`, kind, title: `Job ${i}` }))];
    d.productJobIntents = kinds.map((_, i) => ({ id: `intent-${i}`, productId: 'product', jobId: `job-${i}`, addressedDesiredOutcomeIds: [] }));
    d.relationships = kinds.map((_, i) => ({ id: `resists-${i}`, kind: 'repulsor_resists', repulsorId: 'rep', targetEntityId: `job-${i}` }));
    return d;
  }
  const targets = (d: MapDocument) => resistanceExposureForProduct(d, 'product').map(exposure => ({ repulsorId: exposure.repulsor.id, targets: exposure.grounds.map(ground => ground.resistedTarget) }));

  it('exposes all five explicitly selected Jobs without Offers, Touchpoints or described outcomes', () => {
    const d = fixture();
    expect(targets(d)).toEqual([{ repulsorId: 'rep', targets: kinds.map((kind, i) => ({ entityId: `job-${i}`, kind })) }]);
    expect(resistanceImpactForProduct(d, 'product')).toEqual([]);
  });

  it('retains Job exposure independently of ordinary DO subset contents', () => {
    const d = fixture(); const before = targets(d);
    d.entities.push({ id: 'outcome', kind: 'desired_outcome', title: 'Outcome' });
    d.relationships.push({ id: 'job-outcome', kind: 'job_has_desired_outcome', jobId: 'job-0', desiredOutcomeId: 'outcome' });
    d.productJobIntents[0]!.addressedDesiredOutcomeIds = ['outcome'];
    expect(targets(d)).toEqual(before);
    d.productJobIntents[0]!.addressedDesiredOutcomeIds = ['missing-outcome'];
    expect(targets(d)).toEqual(before);
  });

  it('deduplicates Repulsors and all resisted Job grounds despite duplicate records', () => {
    const d = fixture();
    d.productJobIntents.push({ ...d.productJobIntents[0]!, id: 'duplicate-intent' });
    d.relationships.push({ ...d.relationships[0]!, id: 'duplicate-resistance' });
    d.entities.push({ id: 'second-rep', kind: 'repulsor', title: 'Second friction' });
    d.relationships.push({ id: 'second-resistance', kind: 'repulsor_resists', repulsorId: 'second-rep', targetEntityId: 'job-0' });
    expect(targets(d)).toEqual([
      { repulsorId: 'rep', targets: kinds.map((kind, i) => ({ entityId: `job-${i}`, kind })) },
      { repulsorId: 'second-rep', targets: [{ entityId: 'job-0', kind: 'core_functional_job' }] },
    ]);
  });

  it('never inherits contextual CFJ membership and isolates another Product intent', () => {
    const d = fixture();
    d.relationships.push({ id: 'context', kind: 'core_functional_job_contextualizes_job', coreFunctionalJobId: 'job-0', contextualJobId: 'job-1' });
    d.productJobIntents = [{ id: 'related', productId: 'product', jobId: 'job-1', addressedDesiredOutcomeIds: [] }, { id: 'other', productId: 'other-product', jobId: 'job-0', addressedDesiredOutcomeIds: [] }];
    expect(targets(d)).toEqual([{ repulsorId: 'rep', targets: [{ entityId: 'job-1', kind: 'related_job' }] }]);
    expect(resistanceExposureForProduct(d, 'other-product')[0]?.grounds).toEqual([{ resistedTarget: { entityId: 'job-0', kind: 'core_functional_job' }, manifestations: [] }]);
    d.productJobIntents = [];
    expect(resistanceExposureForProduct(d, 'product')).toEqual([]);
  });

  it('ignores stale and wrong-kind Job and Repulsor endpoints', () => {
    const d = fixture(); const before = targets(d);
    d.productJobIntents.push({ id: 'stale', productId: 'product', jobId: 'missing-job', addressedDesiredOutcomeIds: [] }, { id: 'wrong-kind', productId: 'product', jobId: 'other-product', addressedDesiredOutcomeIds: [] });
    d.relationships.push(
      { id: 'stale-target', kind: 'repulsor_resists', repulsorId: 'rep', targetEntityId: 'missing-job' },
      { id: 'wrong-target', kind: 'repulsor_resists', repulsorId: 'rep', targetEntityId: 'other-product' },
      { id: 'stale-rep', kind: 'repulsor_resists', repulsorId: 'missing-rep', targetEntityId: 'job-0' },
      { id: 'wrong-rep', kind: 'repulsor_resists', repulsorId: 'other-product', targetEntityId: 'job-0' },
    );
    expect(targets(d)).toEqual(before);
  });

  it('excludes FDO and independent ordinary DO even when downstream Offer resistance exists', () => {
    let d = fixture();
    const place = { viewId: 'view', x: 0, y: 0 };
    d = addEntity(d, { ...place, entityId: 'offer', title: 'Offer', kind: 'offer', linkedProductId: 'product', relationshipId: 'owns' });
    d = addEntity(d, { ...place, entityId: 'touch', title: 'Touchpoint', kind: 'touchpoint', linkedOfferIds: ['offer'], relationshipIds: ['presented'] });
    d = addEntity(d, { ...place, entityId: 'fdo', title: 'Affordable', kind: 'financial_desired_outcome' });
    d = addEntity(d, { ...place, entityId: 'financial-rep', title: 'Financial friction', kind: 'repulsor', resistedTargetIds: ['fdo'], relationshipIds: ['financial-resistance'] });
    d = completed(authorTouchpointIntentBottomUp(d, { touchpointId: 'touch', contributingOfferIds: ['offer'], financialDesiredOutcomeId: 'fdo', offerFinancialIntentIds: ['financial-intent'], touchpointSelectionIds: ['financial-selection'] }));
    const legacy = resistanceImpactForProduct(d, 'product'); const offer = resistanceImpactForOffer(d, 'offer');
    expect(legacy).toEqual([{ repulsor: expect.objectContaining({ id: 'financial-rep' }), paths: [{ offerId: 'offer', touchpointId: 'touch' }] }]);
    expect(offer[0]?.grounds[0]?.resistedTarget).toEqual({ entityId: 'fdo', kind: 'financial_desired_outcome' });
    d.entities.push({ id: 'outcome', kind: 'desired_outcome', title: 'Outcome' });
    d.productJobIntents.push({ id: 'malformed-fdo', productId: 'product', jobId: 'fdo', addressedDesiredOutcomeIds: [] }, { id: 'malformed-do', productId: 'product', jobId: 'outcome', addressedDesiredOutcomeIds: [] });
    d.relationships.push({ id: 'resists-outcome', kind: 'repulsor_resists', repulsorId: 'financial-rep', targetEntityId: 'outcome' });
    expect(targets(d)).toEqual([{ repulsorId: 'rep', targets: kinds.map((kind, i) => ({ entityId: `job-${i}`, kind })) }]);
    expect(resistanceImpactForProduct(d, 'product')).toEqual(legacy);
    expect(resistanceImpactForOffer(d, 'offer')).toEqual(offer);
    expect(resistanceExposureForProduct(d, 'product').every(exposure => exposure.grounds.every(ground => ground.manifestations.length === 0))).toBe(true);
  });

  it('orders by title then ID independently of entity, intent and relationship order', () => {
    const d = fixture();
    d.entities.find(e => e.id === 'job-0')!.title = 'Same';
    d.entities.find(e => e.id === 'job-1')!.title = 'Same';
    d.entities.push({ id: 'rep-a', kind: 'repulsor', title: 'Friction' });
    d.relationships.push({ id: 'other-rep', kind: 'repulsor_resists', repulsorId: 'rep-a', targetEntityId: 'job-0' });
    const expected = targets(d);
    expect(expected.map(exposure => exposure.repulsorId)).toEqual(['rep', 'rep-a']);
    expect(expected[0]?.targets.map(target => target.entityId)).toEqual(['job-2', 'job-3', 'job-4', 'job-0', 'job-1']);
    expect(targets({ ...d, entities: [...d.entities].reverse(), productJobIntents: [...d.productJobIntents].reverse(), relationships: [...d.relationships].reverse() })).toEqual(expected);
  });

  it('is read-only on a deeply frozen document and does not create relationships', () => {
    const d = fixture(); const before = structuredClone(d);
    function freeze(value: unknown) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } }
    freeze(d);
    expect(resistanceExposureForProduct(d, 'product')).toHaveLength(1);
    expect(d).toEqual(before);
  });

  it('validates the inspected Product using the existing domain error codes', () => {
    const d = fixture();
    expect(() => resistanceExposureForProduct(d, 'missing')).toThrow(expect.objectContaining({ code: 'invalid_relationship_reference' }));
    expect(() => resistanceExposureForProduct(d, 'rep')).toThrow(expect.objectContaining({ code: 'invalid_relationship_endpoint' }));
  });
});

describe('Product resistance manifestations', () => {
  const kinds = ['core_functional_job', 'related_job', 'consumption_chain_job', 'emotional_job', 'social_job'] as const;
  function fixture(): MapDocument {
    const d = createEmptyMapDocument({ mapId: 'manifestations', title: 'Manifestations', viewId: 'view', viewTitle: 'View' });
    d.entities = [{ id: 'product', kind: 'product', title: 'Product' }, { id: 'other', kind: 'product', title: 'Other Product' }, { id: 'offer', kind: 'offer', title: 'Offer', currentContentSource: null }, { id: 'touch', kind: 'touchpoint', title: 'Touchpoint' }, { id: 'rep', kind: 'repulsor', title: 'Friction' }, ...kinds.map((kind, i) => ({ id: `job-${i}`, kind, title: `Job ${i}` }))];
    d.relationships = [{ id: 'owns', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer' }, { id: 'presents', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'touch' }];
    kinds.forEach((_, i) => {
      const scope = i < 3 ? [`do-${i}`] : [];
      if (i < 3) {
        d.entities.push({ id: `do-${i}`, kind: 'desired_outcome', title: `Outcome ${i}` });
        d.relationships.push({ id: `has-do-${i}`, kind: 'job_has_desired_outcome', jobId: `job-${i}`, desiredOutcomeId: `do-${i}` });
      }
      d.productJobIntents.push({ id: `intent-${i}`, productId: 'product', jobId: `job-${i}`, addressedDesiredOutcomeIds: [...scope] });
      d.offerJobSelections.push({ id: `offer-selection-${i}`, offerId: 'offer', productJobIntentId: `intent-${i}`, addressedDesiredOutcomeIds: [...scope] });
      d.touchpointJobSelections.push({ id: `touch-selection-${i}`, offerId: 'offer', touchpointId: 'touch', productJobIntentId: `intent-${i}`, addressedDesiredOutcomeIds: [...scope] });
      d.relationships.push({ id: `resists-${i}`, kind: 'repulsor_resists', repulsorId: 'rep', targetEntityId: `job-${i}` });
    });
    return d;
  }
  const ground = (d: MapDocument, jobId = 'job-0') => resistanceExposureForProduct(d, 'product')[0]!.grounds.find(g => g.resistedTarget.entityId === jobId)!;
  const path = { offerId: 'offer', touchpointId: 'touch', hasMitigationIntent: false };

  it('retains one actual attributed manifestation per ground for all five Job kinds', () => {
    const d = fixture();
    expect(resistanceExposureForProduct(d, 'product')[0]?.grounds.map(g => g.manifestations)).toEqual(kinds.map(() => [path]));
  });

  it.each(['Product', 'Offer', 'Touchpoint'] as const)('keeps exposure but requires a nonempty effective DO route in %s scope', layer => {
    const d = fixture();
    if (layer === 'Product') d.productJobIntents[0]!.addressedDesiredOutcomeIds = [];
    if (layer === 'Offer') d.offerJobSelections[0]!.addressedDesiredOutcomeIds = [];
    if (layer === 'Touchpoint') d.touchpointJobSelections[0]!.addressedDesiredOutcomeIds = [];
    expect(ground(d).manifestations).toEqual([]);
    expect(resistanceExposureForProduct(d, 'product')[0]?.grounds).toHaveLength(5);
    expect(ground(d, 'job-3').manifestations).toEqual([path]);
  });

  it('normalizes partially invalid DO routes and rejects stale, wrong-kind and other-Job outcomes', () => {
    const d = fixture();
    d.offerJobSelections[0]!.addressedDesiredOutcomeIds!.push('do-1', 'missing', 'product');
    d.touchpointJobSelections[0]!.addressedDesiredOutcomeIds.push('do-1', 'missing', 'product', 'do-0');
    expect(ground(d).manifestations).toEqual([path]);
    d.touchpointJobSelections[0]!.addressedDesiredOutcomeIds = ['do-1', 'missing', 'product'];
    d.productJobIntents[0]!.addressedDesiredOutcomeIds.push('do-1', 'missing', 'product');
    expect(ground(d).manifestations).toEqual([]);
    d.entities = d.entities.filter(e => e.id !== 'do-0');
    d.touchpointJobSelections[0]!.addressedDesiredOutcomeIds = ['do-0'];
    expect(ground(d).manifestations).toEqual([]);
  });

  it('requires Product scope membership even when the shared Offer/Touchpoint route remains effective', () => {
    const d = fixture();
    d.productJobIntents[0]!.addressedDesiredOutcomeIds = ['do-1'];
    expect(resistanceImpactForOffer(d, 'offer')[0]?.grounds.some(g => g.resistedTarget.entityId === 'job-0')).toBe(true);
    expect(ground(d).manifestations).toEqual([]);
  });

  it.each(['Product', 'Offer', 'Touchpoint'] as const)('rejects malformed %s ordinary DO scope for Emotional/Social encounters', layer => {
    const d = fixture();
    for (const i of [3, 4]) {
      if (layer === 'Product') d.productJobIntents[i]!.addressedDesiredOutcomeIds = ['do-0'];
      if (layer === 'Offer') d.offerJobSelections[i]!.addressedDesiredOutcomeIds = ['do-0'];
      if (layer === 'Touchpoint') d.touchpointJobSelections[i]!.addressedDesiredOutcomeIds = ['do-0'];
      expect(ground(d, `job-${i}`).manifestations).toEqual([]);
    }
  });

  const invalidPaths: [string, (d: MapDocument) => void][] = [
    ['missing Offer', d => { d.entities = d.entities.filter(e => e.id !== 'offer'); }],
    ['wrong-kind Offer', d => { d.entities.find(e => e.id === 'offer')!.kind = 'product'; }],
    ['missing Touchpoint', d => { d.entities = d.entities.filter(e => e.id !== 'touch'); }],
    ['wrong-kind Touchpoint', d => { d.entities.find(e => e.id === 'touch')!.kind = 'product'; }],
    ['unowned Offer', d => { d.relationships = d.relationships.filter(r => r.id !== 'owns'); }],
    ['another Product ownership', d => { d.relationships[0] = { id: 'owns', kind: 'product_packaged_as_offer', productId: 'other', offerId: 'offer' }; }],
    ['multiply-owned Offer', d => { d.relationships.push({ id: 'other-owner', kind: 'product_packaged_as_offer', productId: 'other', offerId: 'offer' }); }],
    ['duplicate ownership record', d => { d.relationships.push({ ...d.relationships[0]!, id: 'duplicate-owner' }); }],
    ['missing direct presentation', d => { d.relationships = d.relationships.filter(r => r.id !== 'presents'); }],
    ['missing Offer selection', d => { d.offerJobSelections = []; }],
  ];
  it.each(invalidPaths)('ignores %s without suppressing Product exposure', (_, invalidate) => {
    const d = fixture(); invalidate(d);
    expect(resistanceExposureForProduct(d, 'product')[0]?.grounds.map(g => g.manifestations)).toEqual(kinds.map(() => []));
  });

  it.each(['foreign intent', 'stale intent', 'ambiguous intent ID', 'ambiguous Offer selection', 'ambiguous Offer selection ID', 'ambiguous Touchpoint selection ID', 'unrelated Offer attribution'] as const)('rejects %s without selecting an arbitrary record', invalidity => {
    const d = fixture();
    if (invalidity === 'foreign intent') {
      d.productJobIntents.push({ ...d.productJobIntents[0]!, id: 'foreign', productId: 'other' });
      d.touchpointJobSelections[0]!.productJobIntentId = 'foreign';
      d.offerJobSelections[0]!.productJobIntentId = 'foreign';
    }
    if (invalidity === 'stale intent') d.touchpointJobSelections[0]!.productJobIntentId = 'missing';
    if (invalidity === 'ambiguous intent ID') d.productJobIntents.push({ ...d.productJobIntents[0]!, productId: 'other' });
    if (invalidity === 'ambiguous Offer selection') d.offerJobSelections.push({ ...d.offerJobSelections[0]!, id: 'another' });
    if (invalidity === 'ambiguous Offer selection ID') d.offerJobSelections[1]!.id = d.offerJobSelections[0]!.id;
    if (invalidity === 'ambiguous Touchpoint selection ID') d.touchpointJobSelections[1]!.id = d.touchpointJobSelections[0]!.id;
    if (invalidity === 'unrelated Offer attribution') d.touchpointJobSelections[0]!.offerId = 'other-offer';
    expect(ground(d).manifestations).toEqual([]);
  });

  it('preserves distinct Jobs, Offers and Touchpoints, deduplicates equivalent paths and orders deterministically', () => {
    const d = fixture();
    d.entities.push({ id: 'offer-a', kind: 'offer', title: 'Offer', currentContentSource: null }, { id: 'touch-a', kind: 'touchpoint', title: 'Touchpoint' });
    d.relationships.push(
      { id: 'owns-a', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' },
      { id: 'presents-a', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touch' },
      { id: 'presents-touch-a', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'touch-a' },
      { ...d.relationships[1]!, id: 'duplicate-presentation' },
    );
    d.offerJobSelections.push({ ...d.offerJobSelections[0]!, id: 'offer-a-selection', offerId: 'offer-a' });
    d.touchpointJobSelections.push(
      { ...d.touchpointJobSelections[0]!, id: 'duplicate-path' },
      { ...d.touchpointJobSelections[0]!, id: 'offer-a-path', offerId: 'offer-a' },
      { ...d.touchpointJobSelections[0]!, id: 'touch-a-path', touchpointId: 'touch-a' },
    );
    expect(ground(d).manifestations).toEqual([path, { ...path, touchpointId: 'touch-a' }, { ...path, offerId: 'offer-a' }]);
    expect(ground(d, 'job-1').manifestations).toEqual([path]);
    const expected = resistanceExposureForProduct(d, 'product');
    expect(resistanceExposureForProduct({ ...d, entities: [...d.entities].reverse(), relationships: [...d.relationships].reverse(), productJobIntents: [...d.productJobIntents].reverse(), offerJobSelections: [...d.offerJobSelections].reverse(), touchpointJobSelections: [...d.touchpointJobSelections].reverse() }, 'product')).toEqual(expected);
  });

  it('merges duplicate Job intents for exposure but uses each concrete attributed record scope', () => {
    const d = fixture();
    d.productJobIntents[0]!.addressedDesiredOutcomeIds = [];
    d.productJobIntents.push({ ...d.productJobIntents[0]!, id: 'described', addressedDesiredOutcomeIds: ['do-0'] });
    expect(ground(d).manifestations).toEqual([]);
    d.offerJobSelections[0]!.productJobIntentId = 'described';
    d.touchpointJobSelections[0]!.productJobIntentId = 'described';
    expect(ground(d).manifestations).toEqual([path]);
    expect(resistanceExposureForProduct(d, 'product')[0]?.grounds).toHaveLength(5);
  });

  it('reports mitigation only for the exact manifestation Touchpoint and Repulsor', () => {
    const d = fixture();
    d.entities.push({ id: 'other-rep', kind: 'repulsor', title: 'Other friction' }, { id: 'other-touch', kind: 'touchpoint', title: 'Other Touchpoint' });
    d.relationships.push({ id: 'other-resistance', kind: 'repulsor_resists', repulsorId: 'other-rep', targetEntityId: 'job-0' }, { id: 'other-mitigation', kind: 'touchpoint_mitigates_repulsor', repulsorId: 'rep', touchpointId: 'other-touch' });
    expect(ground(d).manifestations).toEqual([path]);
    d.relationships.push({ id: 'mitigation', kind: 'touchpoint_mitigates_repulsor', repulsorId: 'rep', touchpointId: 'touch' });
    const result = resistanceExposureForProduct(d, 'product');
    expect(result.find(e => e.repulsor.id === 'rep')?.grounds[0]?.manifestations).toEqual([{ ...path, hasMitigationIntent: true }]);
    expect(result.find(e => e.repulsor.id === 'other-rep')?.grounds[0]?.manifestations).toEqual([path]);
    d.touchpointJobSelections = [];
    expect(resistanceExposureForProduct(d, 'product').every(e => e.grounds.every(g => g.manifestations.length === 0))).toBe(true);
  });

  it('never infers Child encounters from Parent selections or a shared container', () => {
    const d = fixture();
    d.entities.push({ id: 'child', kind: 'touchpoint', title: 'Child', locatedInId: 'site' });
    const parent = d.entities.find(entity => entity.id === 'touch');
    if (parent?.kind === 'touchpoint') parent.locatedInId = 'site';
    d.touchpointContainers.push({ id: 'site', title: 'Site' });
    d.relationships.push({ id: 'child-parent', kind: 'touchpoint_contains_touchpoint', childTouchpointId: 'child', parentTouchpointId: 'touch' }, { id: 'child-offer', kind: 'offer_presented_at_touchpoint', offerId: 'offer', touchpointId: 'child' });
    expect(ground(d).manifestations).toEqual([path]);
    d.touchpointJobSelections.push({ ...d.touchpointJobSelections[0]!, id: 'actual-child', touchpointId: 'child' });
    expect(ground(d).manifestations.map(p => p.touchpointId)).toEqual(['child', 'touch']);
  });

  it('preserves legacy projections and the frozen committed document', () => {
    const d = fixture(); const before = structuredClone(d);
    const legacy = resistanceImpactForProduct(d, 'product'); const offer = resistanceImpactForOffer(d, 'offer');
    function freeze(value: unknown) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } }
    freeze(d);
    expect(ground(d).manifestations).toEqual([path]);
    expect(resistanceImpactForProduct(d, 'product')).toEqual(legacy);
    expect(resistanceImpactForOffer(d, 'offer')).toEqual(offer);
    expect(d).toEqual(before);
  });
});
