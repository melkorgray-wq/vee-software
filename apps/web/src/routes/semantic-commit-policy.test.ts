import { describe, expect, it, vi } from 'vitest';
import { commitSemanticOperation, semanticCommitState } from './semantic-commit-policy';

describe('semantic commit policy', () => {
  it('single-contributor selection is commit-ready', () => {
    expect(semanticCommitState({ valid: true, semanticallyComplete: true })).toEqual({ status: 'complete' });
  });

  it('multiple contributors remain incomplete', () => {
    expect(semanticCommitState({ valid: true, semanticallyComplete: false, incompleteReason: 'contributor-required' }))
      .toEqual({ status: 'incomplete', reason: 'contributor-required' });
  });

  it('destructive removal remains incomplete until confirmation', () => {
    expect(semanticCommitState({ valid: true, semanticallyComplete: true, destructive: true })).toEqual({ status: 'destructive-awaiting-confirmation' });
    expect(semanticCommitState({ valid: true, semanticallyComplete: true, destructive: true, confirmed: true })).toEqual({ status: 'complete' });
  });

  it('confirmed change produces one atomic operation', () => {
    const operation = vi.fn((document: { value: number }) => ({ value: document.value + 1 }));
    const result = commitSemanticOperation({ value: 0 }, semanticCommitState({ valid: true, semanticallyComplete: true, destructive: true, confirmed: true }), operation);
    expect(operation).toHaveBeenCalledOnce();
    expect(result).toEqual({ state: { status: 'complete' }, document: { value: 1 } });
  });

  it('failed commit preserves the prior durable document', () => {
    const prior = { value: 0 };
    const result = commitSemanticOperation(prior, { status: 'complete' }, () => { throw new Error('collision'); });
    expect(result.document).toBe(prior);
    expect(result.state).toEqual({ status: 'failed', message: 'collision' });
  });
});
