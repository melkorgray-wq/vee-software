import type { MapDocument } from '@vee/domain';

export type SatelliteKind =
  | 'core_functional_job'
  | 'related_job'
  | 'consumption_chain_job'
  | 'emotional_job'
  | 'social_job'
  | 'desired_outcome'
  | 'financial_desired_outcome'
  | 'repulsor';

const PRODUCT_JOB_SATELLITE_KINDS = new Set<SatelliteKind>([
  'core_functional_job',
  'related_job',
  'consumption_chain_job',
  'emotional_job',
  'social_job',
]);

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
  const group = relationGroupsForEntity(document, sourceId).find(candidate => candidate.targets.some(item => item.entityId === targetId));
  if (!document.entities.some(entity => entity.id === targetId) || !group) return [];
  const ids = new Set(group.targets.find(item => item.entityId === targetId)?.paths.flat() ?? []);
  const physicalIds = new Set(document.relationships.map(relation => relation.id));
  return [...ids].filter(id => physicalIds.has(id)).sort(compare);
}

const compare = (left: string, right: string) => left.localeCompare(right);

/** Pure read-only projection owned by the map adapter boundary, independent of orbit rendering. */
export function projectMapRelationSatellites(document: MapDocument): SatelliteGroup[] {
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  const groups = new Map<string, Map<string, Set<string>>>();

  function entity(id: string, kind: 'product' | 'offer' | 'financial_desired_outcome') {
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

  for (const intent of document.productJobIntents) {
    const job = entities.get(intent.jobId);
    if (entity(intent.productId, 'product') && job && PRODUCT_JOB_SATELLITE_KINDS.has(job.kind as SatelliteKind)) {
      add(intent.productId, job.kind as SatelliteKind, job.id, [intent.id]);
    }
  }

  for (const intent of document.offerFinancialIntents) {
    if (entity(intent.offerId, 'offer') && entity(intent.financialDesiredOutcomeId, 'financial_desired_outcome')) {
      add(intent.offerId, 'financial_desired_outcome', intent.financialDesiredOutcomeId, [intent.id]);
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
