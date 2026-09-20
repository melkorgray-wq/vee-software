import type { Entity, MapDocument } from '@vee/domain';

type Product = Extract<Entity, { kind: 'product' }>;
type Touchpoint = Extract<Entity, { kind: 'touchpoint' }>;
type ClientJob = Entity & { kind: 'core_functional_job' | 'related_job' | 'consumption_chain_job' | 'emotional_job' | 'social_job' };
type DesiredOutcome = Entity & { kind: 'desired_outcome' };
type FinancialDesiredOutcome = Entity & { kind: 'financial_desired_outcome' };

export interface OfferBusinessStructure {
  product?: Product;
  touchpoints: Touchpoint[];
  clientIntent: { job: ClientJob; desiredOutcomes: DesiredOutcome[] }[];
  financialIntent: FinancialDesiredOutcome[];
}

const byTitleThenId = <T extends { title: string; id: string }>(left: T, right: T) =>
  left.title.localeCompare(right.title) || left.id.localeCompare(right.id);

/** Builds the Offer document projection only from committed domain records. */
export function deriveOfferBusinessStructure(document: MapDocument, offerId: string): OfferBusinessStructure {
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  const productRelationship = document.relationships.find((relation): relation is Extract<typeof relation, { kind: 'product_packaged_as_offer' }> => relation.kind === 'product_packaged_as_offer' && relation.offerId === offerId);
  const productId = productRelationship?.productId;
  const productEntity = productId ? entities.get(productId) : undefined;
  const product = productEntity?.kind === 'product' ? productEntity : undefined;
  const touchpoints = document.relationships.flatMap(relation => {
    if (relation.kind !== 'offer_presented_at_touchpoint' || relation.offerId !== offerId) return [];
    const entity = entities.get(relation.touchpointId);
    return entity?.kind === 'touchpoint' ? [entity] : [];
  }).sort(byTitleThenId);
  const clientIntent = document.offerJobSelections.flatMap(selection => {
    if (selection.offerId !== offerId) return [];
    const intent = document.productJobIntents.find(candidate => candidate.id === selection.productJobIntentId);
    const job = intent && entities.get(intent.jobId);
    if (!intent || !job || !['core_functional_job', 'related_job', 'consumption_chain_job', 'emotional_job', 'social_job'].includes(job.kind)) return [];
    const desiredOutcomes = (selection.addressedDesiredOutcomeIds ?? []).flatMap(id => {
      const entity = entities.get(id);
      return entity?.kind === 'desired_outcome' ? [entity as DesiredOutcome] : [];
    }).sort(byTitleThenId);
    return [{ job: job as ClientJob, desiredOutcomes }];
  }).sort((left, right) => byTitleThenId(left.job, right.job));
  const financialIntent = document.offerFinancialIntents.flatMap(intent => {
    if (intent.offerId !== offerId) return [];
    const entity = entities.get(intent.financialDesiredOutcomeId);
    return entity?.kind === 'financial_desired_outcome' ? [entity as FinancialDesiredOutcome] : [];
  }).sort(byTitleThenId);
  return { ...(product ? { product } : {}), touchpoints, clientIntent, financialIntent };
}
