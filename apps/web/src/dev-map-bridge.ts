import type { MapDocument } from '@vee/domain';

declare global {
  interface Window {
    __VEE_DEV__?: {
      dump(): MapDocument;
      load(snapshot: unknown): void;
    };
  }
}

const MAP_DOCUMENT_ARRAY_FIELDS = [
  'entities',
  'relationships',
  'productJobIntents',
  'offerJobSelections',
  'offerFinancialIntents',
  'touchpointJobSelections',
  'touchpointFinancialSelections',
  'touchpointContainers',
  'epistemicAnnotations',
  'views',
  'placements',
] as const;

function isPlainMapDocumentShape(snapshot: unknown): snapshot is MapDocument {
  if (snapshot === null || typeof snapshot !== 'object') return false;
  const prototype = Object.getPrototypeOf(snapshot);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const candidate = snapshot as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.title === 'string'
    && MAP_DOCUMENT_ARRAY_FIELDS.every(field => Array.isArray(candidate[field]));
}

// TEMPORARY DEV-ONLY MAP BRIDGE.
// Remove when real MapDocument persistence / versioned documents land.
export function registerDevMapBridge(
  enabled: boolean,
  readDocument: () => MapDocument,
  loadDocument: (document: MapDocument) => void,
): () => void {
  if (!enabled) return () => undefined;

  const bridge: NonNullable<Window['__VEE_DEV__']> = {
    dump: () => structuredClone(readDocument()),
    load: (snapshot) => {
      if (!isPlainMapDocumentShape(snapshot)) {
        console.error('[VEE DEV map bridge] Refused to load an invalid MapDocument snapshot.');
        return;
      }
      let clone: MapDocument;
      try {
        clone = structuredClone(snapshot);
      } catch (error) {
        console.error('[VEE DEV map bridge] Could not clone the MapDocument snapshot; current document was not changed.', error);
        return;
      }
      loadDocument(clone);
    },
  };

  window.__VEE_DEV__ = bridge;
  return () => {
    if (window.__VEE_DEV__ === bridge) delete window.__VEE_DEV__;
  };
}
