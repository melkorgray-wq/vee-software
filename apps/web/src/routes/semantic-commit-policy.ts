export type SemanticCommitState =
  | { status: 'complete' }
  | { status: 'incomplete'; reason: 'contributor-required' | 'semantic-input-required' }
  | { status: 'invalid'; message: string }
  | { status: 'destructive-awaiting-confirmation' }
  | { status: 'committing' }
  | { status: 'failed'; message: string };

export function semanticCommitState(input: {
  semanticallyComplete: boolean;
  valid: boolean;
  destructive?: boolean;
  confirmed?: boolean;
  incompleteReason?: 'contributor-required' | 'semantic-input-required';
  invalidMessage?: string;
}): SemanticCommitState {
  if (!input.valid) return { status: 'invalid', message: input.invalidMessage ?? 'This operation is invalid.' };
  if (!input.semanticallyComplete) return { status: 'incomplete', reason: input.incompleteReason ?? 'semantic-input-required' };
  if (input.destructive && !input.confirmed) return { status: 'destructive-awaiting-confirmation' };
  return { status: 'complete' };
}

/** Executes an eligible operation once; failures retain the exact prior durable value. */
export function commitSemanticOperation<T>(prior: T, state: SemanticCommitState, operation: (document: T) => T):
  | { state: { status: 'complete' }; document: T }
  | { state: Exclude<SemanticCommitState, { status: 'complete' }>; document: T } {
  if (state.status !== 'complete') return { state, document: prior };
  try {
    return { state: { status: 'complete' }, document: operation(prior) };
  } catch (error) {
    return { state: { status: 'failed', message: error instanceof Error ? error.message : 'The operation failed.' }, document: prior };
  }
}
