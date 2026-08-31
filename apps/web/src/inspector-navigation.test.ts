import { describe, expect, it } from 'vitest';
import { emptyInspectorHistory, inspectorHistoryReducer, traverseInspectorHistory } from './inspector-navigation';

describe('Inspector entity history', () => {
  it('pushes entity navigation and clears the forward branch', () => {
    let history = emptyInspectorHistory();
    for (const entityId of ['product', 'offer', 'touchpoint']) history = inspectorHistoryReducer(history, { type: 'push', entityId });
    const back = traverseInspectorHistory(history, 'back', () => true)!;
    history = inspectorHistoryReducer(back.history, { type: 'push', entityId: 'other-offer' });
    expect(history).toEqual({ entries: ['product', 'offer', 'other-offer'], index: 2 });
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
