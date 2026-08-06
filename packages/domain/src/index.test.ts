import { describe, expect, it } from 'vitest';
import { addEntity, createEmptyMapDocument, movePlacement, updateEntity, updateEpistemicAnnotation } from './index';

const empty = () => createEmptyMapDocument({ mapId: 'map', title: 'Spike map', viewId: 'view', viewTitle: 'Map view' });
const populated = () => addEntity(empty(), { entityId: 'entity', annotationId: 'annotation', title: 'Signal', kind: 'touchpoint',
  status: 'observed', sourceNote: 'Interview', viewId: 'view', x: 10, y: 20 });

describe('map domain operations', () => {
  it('creates an empty document with one view', () => expect(empty()).toMatchObject({ entities: [], epistemicAnnotations: [], placements: [], views: [{ id: 'view' }] }));
  it('atomically adds a separate entity, annotation, and placement', () => {
    const document = populated();
    expect(document.entities[0]).toEqual({ id: 'entity', title: 'Signal', kind: 'touchpoint' });
    expect(document.epistemicAnnotations).toHaveLength(1); expect(document.placements[0]).toEqual({ entityId: 'entity', viewId: 'view', x: 10, y: 20 });
    expect(document.entities[0]).not.toHaveProperty('x'); expect(document.entities[0]).not.toHaveProperty('status');
  });
  it('rejects blank titles and duplicate IDs', () => {
    expect(() => addEntity(empty(), { entityId: 'e', annotationId: 'a', title: ' ', kind: 'offer', status: 'hypothesis', viewId: 'view', x: 0, y: 0 })).toThrow('must not be blank');
    const document = populated();
    expect(() => addEntity(document, { entityId: 'entity', annotationId: 'other', title: 'Other', kind: 'offer', status: 'hypothesis', viewId: 'view', x: 0, y: 0 })).toThrow('Entity ID');
    expect(() => addEntity(document, { entityId: 'other', annotationId: 'annotation', title: 'Other', kind: 'offer', status: 'hypothesis', viewId: 'view', x: 0, y: 0 })).toThrow('Annotation ID');
  });
  it('updates entity without changing placement or annotation', () => { const before = populated(); const after = updateEntity(before, { entityId: 'entity', title: 'Changed', kind: 'product' }); expect(after.placements).toBe(before.placements); expect(after.epistemicAnnotations).toBe(before.epistemicAnnotations); });
  it('updates and clears annotation without changing entity', () => { const before = populated(); const after = updateEpistemicAnnotation(before, { subjectEntityId: 'entity', status: 'interpretation', sourceNote: '' }); expect(after.entities).toBe(before.entities); expect(after.epistemicAnnotations[0]).toEqual({ id: 'annotation', subjectEntityId: 'entity', status: 'interpretation' }); });
  it('moves placement without changing semantic records', () => { const before = populated(); const after = movePlacement(before, { entityId: 'entity', viewId: 'view', x: 30, y: 40 }); expect(after.entities).toBe(before.entities); expect(after.epistemicAnnotations).toBe(before.epistemicAnnotations); expect(after.placements[0]).toMatchObject({ x: 30, y: 40 }); });
  it('rejects unknown references and non-finite coordinates', () => { expect(() => movePlacement(populated(), { entityId: 'missing', viewId: 'view', x: 0, y: 0 })).toThrow('Entity'); expect(() => movePlacement(populated(), { entityId: 'entity', viewId: 'missing', x: 0, y: 0 })).toThrow('View'); expect(() => movePlacement(populated(), { entityId: 'entity', viewId: 'view', x: Infinity, y: 0 })).toThrow('finite'); });
});
