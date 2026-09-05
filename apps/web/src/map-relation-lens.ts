import { isDesiredOutcomeBearingJob, type MapDocument } from '@vee/domain';
import { deriveMapEdges, deriveVisibleAuthoredRelationships } from './map-adapter';
import { relationGroupsForEntity } from './map-relation-projection';

export interface RelationLensTrace { entityIds: string[]; edgeIds: string[] }

const compare = (left: string, right: string) => left.localeCompare(right);
type RelationshipOfKind<K extends MapDocument['relationships'][number]['kind']> = Extract<MapDocument['relationships'][number], { kind: K }>;
function relationshipOfKind<K extends MapDocument['relationships'][number]['kind']>(document: MapDocument, kind: K, predicate: (relationship: RelationshipOfKind<K>) => boolean): RelationshipOfKind<K> | undefined {
  return document.relationships.filter((relationship): relationship is RelationshipOfKind<K> => relationship.kind === kind).find(predicate);
}

/** Pure structural reading projection for one concrete satellite relation. */
export function deriveRelationLensTrace(document: MapDocument, sourceId: string, targetId: string): RelationLensTrace | undefined {
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  const source = entities.get(sourceId); const target = entities.get(targetId);
  if (!source || !target || !relationGroupsForEntity(document, sourceId).some(group => group.targets.some(item => item.entityId === targetId))) return undefined;
  const entityIds = new Set<string>(); const candidateEdgeIds = new Set<string>();
  const addEntity = (id: string) => { if (entities.has(id)) entityIds.add(id); };
  const addEdge = (id: string) => candidateEdgeIds.add(id);
  const visibleRelationships = deriveVisibleAuthoredRelationships(document);
  const packaged = (offerId: string) => relationshipOfKind(document, 'product_packaged_as_offer', relation => relation.offerId === offerId);
  const ownedOutcomeEdge = (jobId: string, outcomeId: string) => relationshipOfKind(document, 'job_has_desired_outcome', relation => relation.jobId === jobId && relation.desiredOutcomeId === outcomeId);

  function addTouchpointTopology(offerId: string, touchpointId: string): void {
    addEntity(touchpointId);
    let current = touchpointId;
    const visited = new Set<string>();
    while (!visited.has(current)) {
      visited.add(current);
      const containment = relationshipOfKind(document, 'touchpoint_contains_touchpoint', relation => relation.childTouchpointId === current);
      if (!containment) break;
      addEdge(containment.id); addEntity(containment.parentTouchpointId); current = containment.parentTouchpointId;
    }
    const offerEdge = visibleRelationships.filter((relation): relation is RelationshipOfKind<'offer_presented_at_touchpoint'> => relation.kind === 'offer_presented_at_touchpoint').find(relation => relation.offerId === offerId && relation.touchpointId === current);
    if (offerEdge) addEdge(offerEdge.id);
  }

  function addJobIntent(intent: MapDocument['productJobIntents'][number], offerIds: string[], onlyOutcomeId?: string): string[] {
    const job = entities.get(intent.jobId); if (!job) return [];
    addEntity(intent.productId); addEntity(job.id);
    const outcomeIds = isDesiredOutcomeBearingJob(job.kind)
      ? intent.addressedDesiredOutcomeIds.filter(id => (!onlyOutcomeId || id === onlyOutcomeId) && Boolean(ownedOutcomeEdge(job.id, id)) && entities.get(id)?.kind === 'desired_outcome')
      : [];
    for (const outcomeId of outcomeIds) { addEntity(outcomeId); addEdge(ownedOutcomeEdge(job.id, outcomeId)!.id); }
    for (const offerId of offerIds) {
      const topology = packaged(offerId);
      if (!topology || topology.productId !== intent.productId || entities.get(offerId)?.kind !== 'offer') continue;
      addEntity(offerId); addEdge(topology.id);
      for (const selection of document.touchpointJobSelections.filter(item => item.offerId === offerId && item.productJobIntentId === intent.id)) {
        const routeSources = isDesiredOutcomeBearingJob(job.kind)
          ? outcomeIds.filter(id => selection.addressedDesiredOutcomeIds.includes(id))
          : (selection.addressedDesiredOutcomeIds.length === 0 && (job.kind === 'emotional_job' || job.kind === 'social_job') ? [job.id] : []);
        if (!routeSources.length) continue;
        addTouchpointTopology(offerId, selection.touchpointId);
        for (const routeSource of routeSources) addEdge(`intent-route:${routeSource}->${selection.touchpointId}`);
      }
    }
    return outcomeIds;
  }

  function selectedOffers(intentId: string, restrictedOfferId?: string): string[] {
    return document.offerJobSelections.filter(selection => selection.productJobIntentId === intentId && (!restrictedOfferId || selection.offerId === restrictedOfferId)).map(selection => selection.offerId);
  }

  const job = [source, target].find(entity => ['core_functional_job', 'related_job', 'consumption_chain_job', 'emotional_job', 'social_job'].includes(entity.kind));
  const product = [source, target].find(entity => entity.kind === 'product');
  const offer = [source, target].find(entity => entity.kind === 'offer');
  const outcome = [source, target].find(entity => entity.kind === 'desired_outcome');
  const financial = [source, target].find(entity => entity.kind === 'financial_desired_outcome');
  const repulsor = [source, target].find(entity => entity.kind === 'repulsor');

  if (job && product) {
    for (const intent of document.productJobIntents.filter(item => item.productId === product.id && item.jobId === job.id)) addJobIntent(intent, selectedOffers(intent.id));
  } else if (job && offer) {
    const topology = packaged(offer.id);
    for (const intent of document.productJobIntents.filter(item => item.jobId === job.id && item.productId === topology?.productId && selectedOffers(item.id, offer.id).length)) addJobIntent(intent, [offer.id]);
  } else if (outcome && product) {
    for (const intent of document.productJobIntents.filter(item => item.productId === product.id && item.addressedDesiredOutcomeIds.includes(outcome.id) && ownedOutcomeEdge(item.jobId, outcome.id))) addJobIntent(intent, selectedOffers(intent.id), outcome.id);
  } else if (outcome && offer) {
    const topology = packaged(offer.id);
    for (const intent of document.productJobIntents.filter(item => item.productId === topology?.productId && item.addressedDesiredOutcomeIds.includes(outcome.id) && ownedOutcomeEdge(item.jobId, outcome.id) && selectedOffers(item.id, offer.id).length)) addJobIntent(intent, [offer.id], outcome.id);
  } else if (financial && offer) {
    addEntity(financial.id); addEntity(offer.id);
    const intents = document.offerFinancialIntents.filter(item => item.offerId === offer.id && item.financialDesiredOutcomeId === financial.id);
    for (const intent of intents) for (const selection of document.touchpointFinancialSelections.filter(item => item.offerId === offer.id && item.offerFinancialIntentId === intent.id && item.financialDesiredOutcomeId === financial.id)) {
      addTouchpointTopology(offer.id, selection.touchpointId); addEdge(`financial-intent-route:${financial.id}->${selection.touchpointId}`);
    }
  } else if (repulsor && (product || offer)) {
    addEntity(repulsor.id); if (product) addEntity(product.id); else addEntity(offer!.id);
    const resisted = document.relationships.filter((relation): relation is RelationshipOfKind<'repulsor_resists'> => relation.kind === 'repulsor_resists' && relation.repulsorId === repulsor.id);
    for (const resistance of resisted) {
      const resistedEntity = entities.get(resistance.targetEntityId); if (!resistedEntity) continue;
      if (resistedEntity.kind === 'financial_desired_outcome' && offer) {
        const intents = document.offerFinancialIntents.filter(item => item.offerId === offer.id && item.financialDesiredOutcomeId === resistedEntity.id);
        if (!intents.length) continue;
        addEntity(resistedEntity.id); addEdge(resistance.id);
        for (const intent of intents) for (const selection of document.touchpointFinancialSelections.filter(item => item.offerId === offer.id && item.offerFinancialIntentId === intent.id && item.financialDesiredOutcomeId === resistedEntity.id)) {
          addTouchpointTopology(offer.id, selection.touchpointId); addEdge(`financial-intent-route:${resistedEntity.id}->${selection.touchpointId}`); addRepulsorTouchpoint(selection.touchpointId);
        }
      } else {
        const intents = document.productJobIntents.filter(item => item.jobId === resistedEntity.id && (product ? item.productId === product.id : selectedOffers(item.id, offer!.id).length > 0 && item.productId === packaged(offer!.id)?.productId));
        for (const intent of intents) {
          addEntity(repulsor.id); addEdge(resistance.id);
          const offers = product ? selectedOffers(intent.id) : [offer!.id];
          addJobIntent(intent, offers);
          for (const selection of document.touchpointJobSelections.filter(item => offers.includes(item.offerId) && item.productJobIntentId === intent.id)) addRepulsorTouchpoint(selection.touchpointId);
        }
      }
    }
  }

  function addRepulsorTouchpoint(touchpointId: string): void {
    if (!entityIds.has(touchpointId)) return;
    addEdge(`repulsor-route:${repulsor!.id}->${touchpointId}`);
    for (const mitigation of document.relationships.filter((relation): relation is RelationshipOfKind<'touchpoint_mitigates_repulsor'> => relation.kind === 'touchpoint_mitigates_repulsor' && relation.touchpointId === touchpointId && relation.repulsorId === repulsor!.id)) addEdge(mitigation.id);
  }

  // Only renderer-owned IDs can survive into a lens.
  const renderedIds = new Set(deriveMapEdges(document).map(edge => edge.id));
  return { entityIds: [...entityIds].sort(compare), edgeIds: [...candidateEdgeIds].filter(id => renderedIds.has(id)).sort(compare) };
}
