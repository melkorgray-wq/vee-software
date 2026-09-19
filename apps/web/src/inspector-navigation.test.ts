import { describe, expect, it } from 'vitest';
import { emptyInspectorHistory, inspectorHistoryReducer, traverseInspectorHistory } from './inspector-navigation';

describe('Inspector entity history', () => {
  it('starts a new session with one root entity or no entries without a selection', () => {
    expect(inspectorHistoryReducer(emptyInspectorHistory(), { type: 'start', entityId: 'product' })).toEqual({ entries: ['product'], index: 0 });
    expect(inspectorHistoryReducer({ entries: ['old'], index: 0 }, { type: 'start', entityId: null })).toEqual({ entries: [], index: -1 });
  });

  it('restarts the same root without retaining entries from the previous session', () => {
    const previous = { entries: ['product', 'offer', 'product'], index: 2 };
    expect(inspectorHistoryReducer(previous, { type: 'start', entityId: 'product' })).toEqual({ entries: ['product'], index: 0 });
  });

  it('pushes entity navigation and clears the forward branch', () => {
    let history = emptyInspectorHistory();
    for (const entityId of ['product', 'offer', 'touchpoint']) history = inspectorHistoryReducer(history, { type: 'push', entityId });
    const back = traverseInspectorHistory(history, 'back', () => true)!;
    history = inspectorHistoryReducer(back.history, { type: 'push', entityId: 'other-offer' });
    expect(history).toEqual({ entries: ['product', 'offer', 'other-offer'], index: 2 });
  });

  it('supports several pushes, Back and Forward before replacing a forward branch', () => {
    let history = inspectorHistoryReducer(emptyInspectorHistory(), { type: 'start', entityId: 'product' });
    for (const entityId of ['offer', 'touchpoint']) history = inspectorHistoryReducer(history, { type: 'push', entityId });
    const back = traverseInspectorHistory(history, 'back', () => true)!;
    expect(back.targetId).toBe('offer');
    const forward = traverseInspectorHistory(back.history, 'forward', () => true)!;
    expect(forward.targetId).toBe('touchpoint');
    history = inspectorHistoryReducer(back.history, { type: 'push', entityId: 'job' });
    expect(history).toEqual({ entries: ['product', 'offer', 'job'], index: 2 });
    expect(traverseInspectorHistory(history, 'forward', () => true)).toBeNull();
  });

  it('does not duplicate the current entity', () => {
    const history = inspectorHistoryReducer(emptyInspectorHistory(), { type: 'push', entityId: 'product' });
    expect(inspectorHistoryReducer(history, { type: 'push', entityId: 'product' })).toBe(history);
  });

  it('handles a missing history target deterministically', () => {
    const history = { entries: ['product', 'deleted-offer', 'touchpoint'], index: 2 };
    expect(traverseInspectorHistory(history, 'back', id => id !== 'deleted-offer')).toEqual({
      history: { entries: history.entries, index: 0 },
      targetId: 'product',
    });
    expect(traverseInspectorHistory({ ...history, index: 0 }, 'forward', id => id !== 'deleted-offer')?.targetId).toBe('touchpoint');
  });
});
