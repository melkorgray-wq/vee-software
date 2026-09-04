import type { SatelliteGroup } from './map-relation-projection';

export type RelationsMode =
  | { state: 'inactive' }
  | { state: 'group'; sourceId: string; groups: SatelliteGroup[]; groupIndex: number }
  | { state: 'concrete-list'; sourceId: string; groups: SatelliteGroup[]; groupIndex: number; targetIndex: number };

export type RelationsModeAction =
  | { type: 'enter'; sourceId: string; groups: SatelliteGroup[] }
  | { type: 'previous-group' | 'next-group' | 'previous-target' | 'next-target' | 'follow-target' | 'escape' };

export interface RelationsModeResult { mode: RelationsMode; followedTargetId?: string }

export const inactiveRelationsMode = (): RelationsMode => ({ state: 'inactive' });

/** Owns nested relation focus; it never mutates or derives domain relationships. */
export function reduceRelationsMode(mode: RelationsMode, action: RelationsModeAction): RelationsModeResult {
  if (action.type === 'enter') {
    return action.groups.length
      ? { mode: { state: 'group', sourceId: action.sourceId, groups: action.groups, groupIndex: 0 } }
      : { mode };
  }
  if (mode.state === 'inactive') return { mode };
  if (action.type === 'escape') {
    if (mode.state === 'concrete-list') return { mode: { state: 'group', sourceId: mode.sourceId, groups: mode.groups, groupIndex: mode.groupIndex } };
    return { mode: inactiveRelationsMode() };
  }
  if (action.type === 'previous-group' || action.type === 'next-group') {
    const delta = action.type === 'previous-group' ? -1 : 1;
    const groupIndex = (mode.groupIndex + delta + mode.groups.length) % mode.groups.length;
    return { mode: { state: 'group', sourceId: mode.sourceId, groups: mode.groups, groupIndex } };
  }
  if (action.type === 'previous-target' || action.type === 'next-target') {
    const targets = mode.groups[mode.groupIndex]!.targets;
    if (!targets.length) return { mode };
    if (mode.state === 'group') return { mode: { ...mode, state: 'concrete-list', targetIndex: 0 } };
    const delta = action.type === 'previous-target' ? -1 : 1;
    const targetIndex = Math.max(0, Math.min(mode.targetIndex + delta, targets.length - 1));
    return { mode: { ...mode, targetIndex } };
  }
  if (action.type === 'follow-target') {
    const followedTargetId = focusedRelationTarget(mode);
    return followedTargetId ? { mode: inactiveRelationsMode(), followedTargetId } : { mode };
  }
  return { mode };
}

export function focusedRelationTarget(mode: RelationsMode): string | undefined {
  if (mode.state === 'inactive') return undefined;
  const targets = mode.groups[mode.groupIndex]!.targets;
  if (mode.state === 'group') return targets.length === 1 ? targets[0]!.entityId : undefined;
  return targets[mode.targetIndex]?.entityId;
}

export function relationEdgeClassName(base: string | undefined, edgeId: string, relevantIds: ReadonlySet<string> | null): string {
  return `${base ?? ''}${relevantIds && !relevantIds.has(edgeId) ? ' relation-dimmed' : ''}`.trim();
}
