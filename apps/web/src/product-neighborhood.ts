import { isDesiredOutcomeBearingJob, type Entity, type MapDocument, type Relationship } from '@vee/domain';

export interface ProductNeighborhoodNeighbor {
  productId: string;
  contributorOfferIds: string[];
}

export interface ProductTouchpointNeighborhoodGround {
  id: string;
  basisKind: 'touchpoint';
  basisId: string;
  inspectedContributorOfferIds: string[];
  neighbors: ProductNeighborhoodNeighbor[];
  count: number;
}

export const PRODUCT_JOB_GROUND_KINDS = [
  'core_functional_job', 'related_job', 'consumption_chain_job', 'emotional_job', 'social_job',
] as const;
export type ProductJobGroundKind = typeof PRODUCT_JOB_GROUND_KINDS[number];
type OutcomeBearingJobKind = Extract<ProductJobGroundKind, 'core_functional_job' | 'related_job' | 'consumption_chain_job'>;

export interface ProductJobNeighborhoodNeighbor {
  productId: string;
}

export interface ProductJobDesiredOutcomeComparison extends ProductJobNeighborhoodNeighbor {
  desiredOutcomeIds: string[];
  commonDesiredOutcomeIds: string[];
  inspectedOnlyDesiredOutcomeIds: string[];
  neighborOnlyDesiredOutcomeIds: string[];
}

interface ProductJobGroundBase {
  id: string;
  basisKind: 'job';
  basisId: string;
  count: number;
}

export type ProductJobNeighborhoodGround = ProductJobGroundBase & (
  | { jobKind: OutcomeBearingJobKind; inspectedDesiredOutcomeIds: string[]; neighbors: ProductJobDesiredOutcomeComparison[] }
  | { jobKind: Exclude<ProductJobGroundKind, OutcomeBearingJobKind>; neighbors: ProductJobNeighborhoodNeighbor[] }
);

export type ProductNeighborhoodGround = ProductTouchpointNeighborhoodGround | ProductJobNeighborhoodGround;

export interface ProductNeighborhood {
  productId: string;
  grounds: ProductNeighborhoodGround[];
}

const byTitleThenId = (left: Entity, right: Entity) =>
  left.title.localeCompare(right.title) || left.id.localeCompare(right.id);

/** Projects committed shared Touchpoints and direct Product Job intent without authoring relationships. */
export function deriveProductNeighborhood(
  document: MapDocument,
  productId: string,
): ProductNeighborhood | undefined {
  const entities = new Map(document.entities.map((entity) => [entity.id, entity]));
  if (entities.get(productId)?.kind !== 'product') return undefined;

  const ownershipByOffer = new Map<string, Extract<Relationship, { kind: 'product_packaged_as_offer' }>[]>();
  for (const relationship of document.relationships) {
    if (relationship.kind !== 'product_packaged_as_offer') continue;
    const ownership = ownershipByOffer.get(relationship.offerId) ?? [];
    ownership.push(relationship);
    ownershipByOffer.set(relationship.offerId, ownership);
  }

  const productsByTouchpoint = new Map<string, Map<string, Set<string>>>();
  for (const relationship of document.relationships) {
    if (relationship.kind !== 'offer_presented_at_touchpoint') continue;
    if (entities.get(relationship.offerId)?.kind !== 'offer'
      || entities.get(relationship.touchpointId)?.kind !== 'touchpoint') continue;
    const ownership = ownershipByOffer.get(relationship.offerId);
    // Preserve the required single ownership record, including malformed duplicate-record rejection.
    if (ownership?.length !== 1) continue;
    const owner = ownership[0]!;
    if (entities.get(owner.productId)?.kind !== 'product') continue;
    const products = productsByTouchpoint.get(relationship.touchpointId) ?? new Map<string, Set<string>>();
    const offers = products.get(owner.productId) ?? new Set<string>();
    offers.add(relationship.offerId);
    products.set(owner.productId, offers);
    productsByTouchpoint.set(relationship.touchpointId, products);
  }

  const sortIds = (ids: Iterable<string>) => [...ids]
    .sort((left, right) => byTitleThenId(entities.get(left)!, entities.get(right)!));
  const grounds: ProductTouchpointNeighborhoodGround[] = [];
  for (const [touchpointId, products] of productsByTouchpoint) {
    const inspectedOffers = products.get(productId);
    if (!inspectedOffers) continue;
    const neighbors = sortIds([...products.keys()].filter((id) => id !== productId))
      .map((id) => ({ productId: id, contributorOfferIds: sortIds(products.get(id)!) }));
    if (!neighbors.length) continue;
    grounds.push({
      id: `touchpoint:${touchpointId}`,
      basisKind: 'touchpoint',
      basisId: touchpointId,
      inspectedContributorOfferIds: sortIds(inspectedOffers),
      neighbors,
      count: neighbors.length,
    });
  }
  grounds.sort((left, right) => byTitleThenId(entities.get(left.basisId)!, entities.get(right.basisId)!));
  const jobScopes = new Map<string, Map<string, Set<string>>>();
  const outcomesByJob = new Map<string, Set<string>>();
  for (const relationship of document.relationships) {
    if (relationship.kind !== 'job_has_desired_outcome'
      || entities.get(relationship.desiredOutcomeId)?.kind !== 'desired_outcome') continue;
    const outcomes = outcomesByJob.get(relationship.jobId) ?? new Set<string>();
    outcomes.add(relationship.desiredOutcomeId);
    outcomesByJob.set(relationship.jobId, outcomes);
  }
  for (const intent of document.productJobIntents) {
    const job = entities.get(intent.jobId);
    if (entities.get(intent.productId)?.kind !== 'product'
      || !job || !PRODUCT_JOB_GROUND_KINDS.some((kind) => kind === job.kind)) continue;
    const products = jobScopes.get(job.id) ?? new Map<string, Set<string>>();
    const outcomes = products.get(intent.productId) ?? new Set<string>();
    if (isDesiredOutcomeBearingJob(job.kind)) {
      for (const id of intent.addressedDesiredOutcomeIds) {
        if (outcomesByJob.get(job.id)?.has(id)) outcomes.add(id);
      }
    }
    products.set(intent.productId, outcomes);
    jobScopes.set(job.id, products);
  }

  const jobGrounds: ProductJobNeighborhoodGround[] = [];
  for (const [jobId, products] of jobScopes) {
    const inspectedOutcomes = products.get(productId);
    if (!inspectedOutcomes) continue;
    const neighborIds = sortIds([...products.keys()].filter((id) => id !== productId));
    if (!neighborIds.length) continue;
    const jobKind = entities.get(jobId)!.kind as ProductJobGroundKind;
    const base: ProductJobGroundBase = {
      id: `client-intent:${jobKind}:${jobId}`, basisKind: 'job', basisId: jobId, count: neighborIds.length,
    };
    if (jobKind === 'emotional_job' || jobKind === 'social_job') {
      jobGrounds.push({ ...base, jobKind, neighbors: neighborIds.map((id) => ({ productId: id })) });
    } else {
      jobGrounds.push({
        ...base, jobKind, inspectedDesiredOutcomeIds: sortIds(inspectedOutcomes),
        neighbors: neighborIds.map((id) => {
          const neighborOutcomes = products.get(id)!;
          return {
            productId: id,
            desiredOutcomeIds: sortIds(neighborOutcomes),
            commonDesiredOutcomeIds: sortIds([...inspectedOutcomes].filter((outcomeId) => neighborOutcomes.has(outcomeId))),
            inspectedOnlyDesiredOutcomeIds: sortIds([...inspectedOutcomes].filter((outcomeId) => !neighborOutcomes.has(outcomeId))),
            neighborOnlyDesiredOutcomeIds: sortIds([...neighborOutcomes].filter((outcomeId) => !inspectedOutcomes.has(outcomeId))),
          };
        }),
      });
    }
  }
  jobGrounds.sort((left, right) => PRODUCT_JOB_GROUND_KINDS.indexOf(left.jobKind) - PRODUCT_JOB_GROUND_KINDS.indexOf(right.jobKind)
    || byTitleThenId(entities.get(left.basisId)!, entities.get(right.basisId)!));
  return { productId, grounds: [...grounds, ...jobGrounds] };
}
