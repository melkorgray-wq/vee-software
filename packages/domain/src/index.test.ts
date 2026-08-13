import { describe, expect, it } from 'vitest';
import { CLIENT_ROOT_ENTITY_KINDS, addEntity, addTouchpointContainer, createEmptyMapDocument, duplicateEntity, movePlacement, updateEntity } from './index';

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
});
