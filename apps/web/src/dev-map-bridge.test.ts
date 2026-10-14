import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyMapDocument, type MapDocument } from '@vee/domain';
import { registerDevMapBridge } from './dev-map-bridge';

function mapDocument(title = 'Source'): MapDocument {
  const document = createEmptyMapDocument({ mapId: 'map', title, viewId: 'spike-view', viewTitle: 'View' });
  document.entities.push({ id: 'product', kind: 'product', title: 'Original product' });
  document.placements.push({ viewId: 'spike-view', entityId: 'product', x: 10, y: 20 });
  return document;
}

describe('registerDevMapBridge', () => {
  afterEach(() => {
    delete window.__VEE_DEV__;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('registers dump and load only when enabled', () => {
    const load = vi.fn();
    const cleanup = registerDevMapBridge(true, () => mapDocument(), load);
    expect(window.__VEE_DEV__).toEqual({ dump: expect.any(Function), load: expect.any(Function) });
    cleanup();

    registerDevMapBridge(false, () => mapDocument(), load);
    expect(window.__VEE_DEV__).toBeUndefined();
  });

  it('dumps a complete, independent clone of the latest document', () => {
    const source = mapDocument();
    registerDevMapBridge(true, () => source, vi.fn());

    const dumped = window.__VEE_DEV__!.dump();
    expect(dumped).toEqual(source);
    expect(dumped).not.toBe(source);
    expect(dumped.entities).not.toBe(source.entities);
    dumped.entities[0]!.title = 'Mutated dump';
    expect(source.entities[0]!.title).toBe('Original product');
  });

  it('loads an independent clone that cannot be changed by the caller afterward', () => {
    const snapshot = mapDocument('Incoming');
    let accepted = mapDocument();
    registerDevMapBridge(true, () => accepted, document => { accepted = document; });

    window.__VEE_DEV__!.load(snapshot);
    expect(accepted).toEqual(snapshot);
    expect(accepted).not.toBe(snapshot);
    snapshot.entities[0]!.title = 'Caller mutation';
    expect(accepted.entities[0]!.title).toBe('Original product');
  });

  it('rejects invalid snapshots without replacing the current document', () => {
    const original = mapDocument();
    let accepted = original;
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const load = vi.fn((document: MapDocument) => { accepted = document; });
    registerDevMapBridge(true, () => accepted, load);

    window.__VEE_DEV__!.load({ id: 'bad', title: 'Missing arrays' });
    expect(error).toHaveBeenCalledWith(expect.stringContaining('invalid MapDocument'));
    expect(load).not.toHaveBeenCalled();
    expect(accepted).toBe(original);
  });

  it('reports clone failures without replacing the current document', () => {
    const original = mapDocument();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const load = vi.fn();
    registerDevMapBridge(true, () => original, load);
    const uncloneable = mapDocument() as MapDocument & { callback?: () => void };
    uncloneable.callback = () => undefined;

    window.__VEE_DEV__!.load(uncloneable);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Could not clone'), expect.anything());
    expect(load).not.toHaveBeenCalled();
    expect(window.__VEE_DEV__!.dump()).toEqual(original);
  });

  it('only lets the current registration remove its bridge', () => {
    const firstCleanup = registerDevMapBridge(true, () => mapDocument('First'), vi.fn());
    const firstBridge = window.__VEE_DEV__;
    const secondCleanup = registerDevMapBridge(true, () => mapDocument('Second'), vi.fn());
    const secondBridge = window.__VEE_DEV__;

    firstCleanup();
    expect(window.__VEE_DEV__).toBe(secondBridge);
    expect(window.__VEE_DEV__).not.toBe(firstBridge);
    secondCleanup();
    expect(window.__VEE_DEV__).toBeUndefined();
  });
});

describe('legacy runtime snapshot compatibility', () => {
  afterEach(() => { delete window.__VEE_DEV__; vi.restoreAllMocks(); });
  it('keeps valid legacy Job snapshots unchanged', () => {
    const source = createEmptyMapDocument({ mapId: 'legacy', title: 'Legacy', viewId: 'v', viewTitle: 'View' });
    source.entities.push({ id: 'core', kind: 'core_functional_job', title: 'Core' }, { id: 'related', kind: 'related_job', title: 'Related' });
    source.relationships.push({ id: 'context', kind: 'core_functional_job_has_related_job', coreFunctionalJobId: 'core', relatedJobId: 'related' });
    let accepted = mapDocument();
    registerDevMapBridge(true, () => accepted, document => { accepted = document; });
    window.__VEE_DEV__!.load(source);
    expect(accepted).toEqual(source);
    expect(window.__VEE_DEV__!.dump()).toEqual(source);
  });
  it.each(['canonical', 'mixed', 'canonical-relationship-only'] as const)('refuses a %s snapshot without replacing current state', format => {
    const source = mapDocument(); const current = mapDocument('Current');
    const snapshot = structuredClone(source) as unknown as { entities: unknown[]; relationships: unknown[] };
    if (format !== 'canonical-relationship-only') snapshot.entities.push({ id: 'fj', kind: 'functional_job', title: 'Functional' });
    if (format === 'mixed') snapshot.entities.push({ id: 'legacy', kind: 'core_functional_job', title: 'Legacy' });
    snapshot.relationships.push({ id: 'context', kind: 'job_contextualizes_job', sourceJobId: 'fj', targetJobId: 'fj-2' });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined); const load = vi.fn();
    registerDevMapBridge(true, () => current, load);
    window.__VEE_DEV__!.load(snapshot);
    expect(load).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Canonical Job snapshots are not supported'));
    expect(window.__VEE_DEV__!.dump()).toEqual(current);
  });
});
