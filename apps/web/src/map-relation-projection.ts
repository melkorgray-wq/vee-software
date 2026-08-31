import { relevantRepulsorsForTouchpoint, type Entity, type MapDocument } from '@vee/domain';

export type SatelliteKind = 'desired_outcome' | 'financial_desired_outcome' | 'repulsor';

export interface SatelliteTarget {
  entityId: string;
  /** Stable authored/derived contributor paths; these are visualization provenance, not relationships. */
  paths: string[][];
}

export interface SatelliteGroup {
  displayOwnerId: string;
  satelliteKind: SatelliteKind;
  targets: SatelliteTarget[];
}

export function relationGroupsForEntity(document: MapDocument, entityId: string): SatelliteGroup[] {
  return projectMapRelationSatellites(document).filter(group => group.displayOwnerId === entityId);
}

/** Resolves projection provenance to physical renderer edges without extending semantic paths. */
export function relevantPhysicalEdgeIds(document: MapDocument, sourceId: string, targetId: string): string[] {
  const target = document.entities.find(entity => entity.id === targetId);
  const group = relationGroupsForEntity(document, sourceId).find(candidate => candidate.targets.some(item => item.entityId === targetId));
  if (!target || !group) return [];
  const ids = new Set(group.targets.find(item => item.entityId === targetId)?.paths.flat() ?? []);
  if (group.satelliteKind === 'financial_desired_outcome' && target.kind === 'financial_desired_outcome' && document.entities.some(entity => entity.id === sourceId && entity.kind === 'touchpoint')) {
    ids.add(`financial-intent-route:${targetId}->${sourceId}`);
  }
  if (group.satelliteKind === 'repulsor' && target.kind === 'repulsor' && document.entities.some(entity => entity.id === sourceId && entity.kind === 'touchpoint')) {
    ids.add(`repulsor-route:${targetId}->${sourceId}`);
  }
  const physicalIds = new Set(document.relationships.map(relation => relation.id));
  return [...ids].filter(id => physicalIds.has(id) || id.startsWith('financial-intent-route:') || id.startsWith('repulsor-route:')).sort(compare);
}

const compare = (left: string, right: string) => left.localeCompare(right);

/** Pure read-only projection owned by the map adapter boundary, independent of orbit rendering. */
export function projectMapRelationSatellites(document: MapDocument): SatelliteGroup[] {
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  const groups = new Map<string, Map<string, Set<string>>>();

  function entity(id: string, kind: Entity['kind']): Entity | undefined {
    const candidate = entities.get(id);
    return candidate?.kind === kind ? candidate : undefined;
  }
  function add(ownerId: string, kind: SatelliteKind, targetId: string, path: string[]): void {
    const key = `${ownerId}\u0000${kind}`;
    const targets = groups.get(key) ?? new Map<string, Set<string>>();
    const paths = targets.get(targetId) ?? new Set<string>();
    paths.add([...path].sort(compare).join('\u0000'));
    targets.set(targetId, paths);
    groups.set(key, targets);
  }

  for (const relation of document.relationships) {
    if (relation.kind === 'job_has_desired_outcome') {
      const owner = entities.get(relation.jobId);
      const validOwner = owner && (owner.kind === 'core_functional_job' || owner.kind === 'related_job' || owner.kind === 'consumption_chain_job');
      if (validOwner && entity(relation.desiredOutcomeId, 'desired_outcome')) add(owner.id, 'desired_outcome', relation.desiredOutcomeId, [relation.id]);
    }
    if (relation.kind === 'repulsor_resists') {
      const target = entities.get(relation.targetEntityId);
      const eligible = target && ['core_functional_job', 'related_job', 'emotional_job', 'social_job', 'consumption_chain_job', 'financial_desired_outcome'].includes(target.kind);
      if (eligible && entity(relation.repulsorId, 'repulsor')) add(target.id, 'repulsor', relation.repulsorId, [relation.id]);
    }
  }

  for (const intent of document.offerFinancialIntents) {
    if (entity(intent.offerId, 'offer') && entity(intent.financialDesiredOutcomeId, 'financial_desired_outcome')) {
      add(intent.offerId, 'financial_desired_outcome', intent.financialDesiredOutcomeId, [intent.id]);
    }
  }

  for (const selection of document.touchpointFinancialSelections) {
    const intent = document.offerFinancialIntents.find(candidate => candidate.id === selection.offerFinancialIntentId);
    const linked = document.relationships.some(relation => relation.kind === 'offer_presented_at_touchpoint' && relation.offerId === selection.offerId && relation.touchpointId === selection.touchpointId);
    if (entity(selection.touchpointId, 'touchpoint') && linked && intent?.offerId === selection.offerId && intent.financialDesiredOutcomeId === selection.financialDesiredOutcomeId && entity(selection.financialDesiredOutcomeId, 'financial_desired_outcome')) {
      add(selection.touchpointId, 'financial_desired_outcome', selection.financialDesiredOutcomeId, [intent.id, selection.id]);
    }
  }

  for (const touchpoint of document.entities.filter(candidate => candidate.kind === 'touchpoint')) {
    for (const repulsor of relevantRepulsorsForTouchpoint(document, touchpoint.id)) {
      const resistedTargets = new Set(document.relationships.flatMap(relation => relation.kind === 'repulsor_resists' && relation.repulsorId === repulsor.id ? [relation.targetEntityId] : []));
      const contributorIds = [
        ...document.touchpointJobSelections.filter(selection => selection.touchpointId === touchpoint.id && document.productJobIntents.some(intent => intent.id === selection.productJobIntentId && resistedTargets.has(intent.jobId))).map(selection => selection.id),
        ...document.touchpointFinancialSelections.filter(selection => selection.touchpointId === touchpoint.id && resistedTargets.has(selection.financialDesiredOutcomeId)).map(selection => selection.id),
        ...document.relationships.filter(relation => relation.kind === 'repulsor_resists' && relation.repulsorId === repulsor.id && resistedTargets.has(relation.targetEntityId)).map(relation => relation.id),
      ];
      add(touchpoint.id, 'repulsor', repulsor.id, contributorIds);
    }
  }

  return [...groups.entries()].map(([key, targets]) => {
    const [displayOwnerId, satelliteKind] = key.split('\u0000') as [string, SatelliteKind];
    return {
      displayOwnerId,
      satelliteKind,
      targets: [...targets.entries()].sort(([left], [right]) => compare(left, right)).map(([entityId, paths]) => ({ entityId, paths: [...paths].sort(compare).map(path => path.split('\u0000')) })),
    };
  }).sort((left, right) => compare(left.displayOwnerId, right.displayOwnerId) || compare(left.satelliteKind, right.satelliteKind));
}
