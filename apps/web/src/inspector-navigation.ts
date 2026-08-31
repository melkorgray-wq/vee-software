export type InspectorHistory = { entries: string[]; index: number };

export type InspectorHistoryAction =
  | { type: 'push'; entityId: string }
  | { type: 'replace'; history: InspectorHistory };

export const emptyInspectorHistory = (): InspectorHistory => ({ entries: [], index: -1 });

/** Owns transient Inspector traversal independently from the shared workspace selection. */
export function inspectorHistoryReducer(history: InspectorHistory, action: InspectorHistoryAction): InspectorHistory {
  if (action.type === 'replace') return action.history;
  if (history.entries[history.index] === action.entityId) return history;
  return {
    entries: [...history.entries.slice(0, history.index + 1), action.entityId],
    index: history.index + 1,
  };
}

/** Resolves traversal against the current document, skipping entries whose entities no longer exist. */
export function traverseInspectorHistory(
  history: InspectorHistory,
  direction: 'back' | 'forward',
  entityExists: (entityId: string) => boolean,
): { history: InspectorHistory; targetId: string } | null {
  const step = direction === 'back' ? -1 : 1;
  for (let index = history.index + step; index >= 0 && index < history.entries.length; index += step) {
    const targetId = history.entries[index]!;
    if (entityExists(targetId)) return { history: { ...history, index }, targetId };
  }
  return null;
}
