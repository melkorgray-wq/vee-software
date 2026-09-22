# Inspector Neighborhood functional contract

Status: **Accepted functional contract for Inspector Neighborhood**. This contract defines accepted functional semantics and explicitly separates them from current runtime behavior, implementation gaps, accepted future direction, and deferred decisions. It is grounded in [`PRODUCT.md`](../PRODUCT.md), the [Inspector presentation contract](./inspector-presentation-contract.md), and the [Inspector interaction contract](./inspector-interaction-contract.md). It does not settle the proposed architecture, provisional ontology, or the deferred choices named below.

## Purpose

Neighborhood is a read-only local window onto real, existing intersections among entities of the same kind. It complements rather than replaces spatial exploration on the Map and follows reciprocal map/document authoring: the Map supports spatial exploration while the Inspector provides a documentary view of the same committed domain records.

Neighborhood does not diagnose absent relationships, suggest potential neighbors, or create relationships. It reports what the committed document establishes; it does not infer what ought to exist.

## Accepted functional invariants

### Existence and projection

- The only source is the committed `MapDocument`. Drafts, available candidates, upstream availability, Map placement, selection, and transient UI state do not create Neighborhood facts.
- The inspected entity is never its own neighbor.
- A **concrete ground** is one actual basis for grouping neighbors, such as one specific Offer, Product, Touchpoint, or `Located in` registry reference. A concrete ground exists in the projection only when it has at least one valid neighbor.
- A ground-type heading is shown only when at least one nonempty concrete ground of that type exists. Zero-neighbor cards, empty type headings, speculative neighbors, and prompts implying missing relationships are forbidden.
- Neighbors are deduplicated by stable entity ID within a concrete ground. The same entity may appear in different grounds when each ground has its own real basis.
- A ground count is the number of unique neighbors in that concrete ground. Because grounds may overlap, their counts must not be summed or presented as a global unique-neighbor total.
- Neighborhood is read-only: it does not mutate `MapDocument`, author neighbor-to-neighbor relationships, or turn available upstream intent into authored local selection.

### Ground-type focused exploration

- A **ground type** is presentation metadata classifying one concrete, already-existing nonempty ground. It is neither a domain entity nor an ontology-wide taxonomy. The available types are the unique ground types represented by at least one current nonempty ground, in deterministic first-appearance order; potential types, empty types, and zero counts are not presented.
- Current Touchpoint mappings are Offer grounds → `offer` / **Offer** and the container ground → `container` / **Located in**. Current Offer mappings are the Product ground → `product` / **Product** and co-presentation grounds → `touchpoint` / **Touchpoint**. Concrete-ground IDs (`offer:…`, `container:…`, `product:…`, and `touchpoint:…`) remain unchanged. These mappings do not establish a shared ontology taxonomy; future ground kinds extend the shared presentation metadata explicitly.
- **Selected types** are a transient set of ground-type IDs. An empty set means an unfiltered view. With a nonempty set, a ground matches when its `groundTypeId` is selected; multiple selected types use OR semantics.
- **Focus mode** is transient `dim | hide` and defaults to `dim`. In Dim, all grounds retain their composition and order while nonmatching grounds are visually de-emphasized. In Hide, only matching grounds are presented. Reset clears the selected set; with no selected types, every ground is fully visible regardless of the stored mode.
- Selection and mode are owned by shared `NeighborhoodGroups`, isolated by inspected owner, and synchronously default to empty selection plus Dim when entity navigation changes the owner. If committed grounds change and a selected type is no longer available, that type is removed from the effective selection; losing all selected types is equivalent to reset.
- Existing concrete-ground disclosure is independent transient state. Filtering never changes it, so Hide → Dim and reset restore the same grounds and disclosure choices. Focused exploration never changes neighbor arrays, counts, IDs, basis metadata, navigation targets, or `MapDocument`.

### Established entity-specific grounds

For a **Touchpoint**, the accepted grounds are:

- for each Offer linked to the inspected Touchpoint, the other Touchpoints directly linked to that same Offer; and
- for the inspected Touchpoint's `Located in` reference, the other Touchpoints with that same `Located in` reference.

For an **Offer**, the accepted grounds are:

- the other Offers belonging to the same Product; and
- for each Touchpoint linked directly to the inspected Offer, the other Offers directly co-presented at that Touchpoint.

The accepted Offer Client-intent semantic projection adds six ground types, in deterministic order: `core_functional_job`, `related_job`, `consumption_chain_job`, `emotional_job`, `social_job`, and `financial_desired_outcome`. These IDs classify Offer-Neighborhood projection grounds; they do not introduce a new ontology taxonomy. Client-intent grounds are derived only from valid Offer-owned `OfferJobSelection` and `OfferFinancialIntent` records. Product intent by itself is not an Offer ground.

- A Job ground's concrete basis is the resolved Job entity ID, not a Product-intent or Offer-selection record ID. Product Job intents belonging to different Products therefore match when their valid Offer selections resolve to the same Job. A Job ground exists only when the inspected Offer and at least one other valid Offer select that Job.
- For Core Functional, Related, and Consumption Chain Jobs, each Offer's scope is its effective Offer-selected Desired Outcome subset, including the compatibility fallback owned by `effectiveOfferDesiredOutcomeIds()`. The projection retains only existing ordinary Desired Outcomes connected to that concrete Job by `job_has_desired_outcome`; duplicate, stale, wrong-kind, and other-Job references do not contribute. Multiple malformed selections for the same Offer and Job merge their valid subsets while the Offer remains one neighbor.
- A Job ground retains the inspected Offer's full effective subset and, per neighbor, the neighbor's full effective subset plus intersection, inspected-only, and neighbor-only Desired Outcome IDs. Ordinary Desired Outcomes are comparison detail beneath the Job and never separate concrete grounds. A shared Job is sufficient even when the subsets are identical, overlapping, disjoint, or both empty; sharing a Job does not assert the same Desired Outcome scope or a Touchpoint encounter path.
- Emotional and Social Job grounds use the same concrete Job identity but always have empty Desired Outcome arrays. Malformed ordinary Desired Outcome data does not create an outcome branch for those Job kinds.
- A Financial Desired Outcome is not a Job. Its concrete ground exists only when the inspected Offer and another Offer each own a valid `OfferFinancialIntent` to the same existing Financial Desired Outcome. It is neither inherited from Product intent nor inferred from the entity's mere existence.
- Concrete IDs are `client-intent:<job-kind>:<job-id>` for Job grounds and `client-intent:financial_desired_outcome:<financial-desired-outcome-id>` for Financial Desired Outcome grounds. Neighbors, outcome arrays, and grounds have deterministic title-then-ID ordering within the fixed type order; neighbor identity is the Offer entity ID and counts reflect unique neighbors.

The accepted Touchpoint Client-intent semantic projection uses the same six local projection type IDs and canonical CFJ, RJ, CCJ, EJ, SJ, FDO order. These remain projection metadata for current semantic grounds rather than an ontology-wide taxonomy. A Touchpoint participates only through a valid selection authored locally for that Touchpoint; Product or Offer availability without a `TouchpointJobSelection` or `TouchpointFinancialSelection` never creates local scope. Parent Touchpoints neither contribute nor expand a Child's scope: each Touchpoint is evaluated only from its own selection records.

- A Job ground matches Touchpoints by the resolved concrete Job entity ID, independently of Product intent, Offer contributor, or selection-record identity. The complete local path requires existing Touchpoint and Offer endpoints, a direct `offer_presented_at_touchpoint` relation between them, an existing `ProductJobIntent` resolving to one of the five supported Job kinds, and an `OfferJobSelection` owned by that same Offer for that same Product intent.
- For Core Functional, Related, and Consumption Chain Jobs, a local path materializes only with a nonempty valid ordinary Desired Outcome subset. Each locally selected outcome must exist, be connected to the concrete Job by `job_has_desired_outcome`, and belong to the effective Offer-selected subset, including the compatibility semantics owned by `effectiveOfferDesiredOutcomeIds()`. Empty or fully invalid subsets and incomplete Job-membership records do not create an encounter. A shared Job remains a ground when two materialized nonempty subsets are identical, overlapping, or disjoint; ordinary Desired Outcomes remain comparison detail rather than separate grounds.
- Emotional and Social Jobs use the same validated upstream path but materialize directly from a valid local Job selection. They require no ordinary Desired Outcome, and malformed outcome IDs on their compatibility records are ignored.
- A Financial Desired Outcome ground requires a local `TouchpointFinancialSelection` whose Touchpoint and Offer exist and are directly linked, whose `offerFinancialIntentId` resolves to an `OfferFinancialIntent` owned by that Offer, and whose selection and intent resolve to the same existing Financial Desired Outcome entity. Product intent, Offer availability, or entity existence alone is insufficient.
- Contributor provenance is retained separately from semantic identity. Different Offers do not prevent two Touchpoints from matching; duplicate paths through one or more Offers merge by Job or FDO basis identity rather than creating contributor-specific grounds. Job outcome detail preserves every unique contributor Offer for each valid Desired Outcome leaf, while FDO and direct-Job detail preserve their contributing Offers.
- Concrete IDs remain `client-intent:<job-kind>:<job-id>` and `client-intent:financial_desired_outcome:<financial-desired-outcome-id>`. Neighbors are unique Touchpoints ordered by title then ID; Desired Outcomes and contributor Offers use the same title-then-ID rule; grounds use canonical type order followed by basis title and ID. Counts equal the unique neighbor count, and malformed or stale compatibility records are ignored rather than thrown.

Product, Offer, and Touchpoint are graph entities. `Located in` is a registry reference and must not be rendered, navigated, or modeled as a graph entity. These grounds are entity-specific; they must not be generalized to another entity kind without an accepted ontology decision.

## Current runtime behavior

- `deriveTouchpointBusinessStructure()` derives the Touchpoint projection from committed records. Its `otherTouchpointsByOffer` and `otherTouchpointsInContainer` fields feed `touchpointBusinessStructureSection()` in `apps/web/src/routes/MapSpike.tsx`.
- `offerNeighborhoodSection()` derives the existing Product and shared-Touchpoint grounds, invokes `deriveOfferClientIntentNeighborhood()` once for the committed document and inspected Offer, and adapts that framework-independent projection to `NeighborhoodPresentationGroup`. Step 3B, the read-only runtime integration, is implemented. Structural grounds remain first (nonempty Product, then deterministic shared Touchpoints), followed by semantic grounds in canonical CFJ, RJ, CCJ, EJ, SJ, FDO order.
- `deriveTouchpointClientIntentNeighborhood()` implements and tests the framework-independent Step 4A Touchpoint semantic projection. Step 4B adapts that projection into the Inspector after nonempty shared-Offer grounds and the nonempty **Located in** ground, followed by semantic grounds in canonical CFJ, RJ, CCJ, EJ, SJ, FDO order. Counts remain unique neighboring Touchpoints. Expanded cards navigate to the concrete basis and neighboring Touchpoints, compare projection-owned local ordinary-DO subsets for DO-bearing Jobs, and show projection-owned contributor Offer provenance without making Offers or DOs grounds or count items.
- The six runtime ground-type labels are **Core Functional Job**, **Related Job**, **Consumption Chain Job**, **Emotional Job**, **Social Job**, and **Financial Desired Outcome**. They are local presentation labels for projection type IDs, not an ontology-wide taxonomy. Each semantic card is titled by its concrete Job or FDO entity; Job identity remains the ground even when Offer selections originate under different Products.
- DO-bearing Job cards show each neighboring Offer's projection-owned common, inspected-only, and neighbor-only subsets. Empty subsets remain explicit `None`; these rows compare local Offer selections and do not decide whether the shared Job ground exists. Ordinary Desired Outcomes are detail, never grounds or count items. Emotional/Social Job cards have no ordinary-DO branch. FDO is an independent outcome ground, not a Job or inherited Product intent.
- Both projections exclude concrete grounds without valid neighbors and omit the entire Neighborhood section when no nonempty grounds remain.
- Shared `NeighborhoodGroups` owns rendering, count badges, disclosure, navigation links, stable group identity, and the shared layout behavior described by the presentation contract. Its optional rich expanded-content slot receives only the existing Inspector navigation callback; the Offer adapter owns semantic read content, while the renderer retains its unchanged neighbor-list fallback.
- Disclosure and Inspector navigation follow the shared presentation and interaction contracts. Disclosure/filter state is transient UI state, not part of `MapDocument`.
- Regression evidence currently lives in `apps/web/src/touchpoint-business-structure.test.ts`, `apps/web/src/offer-client-intent-neighborhood.test.ts`, `apps/web/src/touchpoint-client-intent-neighborhood.test.ts`, and `apps/web/src/routes/MapSpike.test.tsx`.

This contract establishes functional semantics. It does not move entity-specific derivation into `NeighborhoodGroups`; the renderer consumes derived groups and must not become the ontology owner.

## Deferred decisions and open questions

- A relevant-Repulsor ground is deferred until Offer-level exposure semantics are agreed. It is not implementation-ready.
- Client-intent matching/grouping beyond the accepted Offer and Touchpoint projections remains open; no speculative relation or algorithm may fill those gaps.

## Owner chain and change gate

The verified owner chains are:

- Touchpoint derivation: `deriveTouchpointBusinessStructure()` and `otherTouchpointsByOffer` / `otherTouchpointsInContainer` in `apps/web/src/touchpoint-business-structure.ts`;
- Offer Client-intent semantic derivation: `deriveOfferClientIntentNeighborhood()` in `apps/web/src/offer-client-intent-neighborhood.ts`, with focused regressions in `apps/web/src/offer-client-intent-neighborhood.test.ts`;
- Touchpoint Client-intent semantic derivation (Step 4A): `deriveTouchpointClientIntentNeighborhood()` in `apps/web/src/touchpoint-client-intent-neighborhood.ts`, with focused regressions in `apps/web/src/touchpoint-client-intent-neighborhood.test.ts`;
- Inspector assembly and shared rendering: `touchpointBusinessStructureSection()`, `offerNeighborhoodSection()`, and `NeighborhoodGroups` in `apps/web/src/routes/MapSpike.tsx`;
- presentation, disclosure, navigation, focus, and transient-state rules: the [Inspector presentation contract](./inspector-presentation-contract.md) and [Inspector interaction contract](./inspector-interaction-contract.md); and
- regression evidence: `apps/web/src/touchpoint-business-structure.test.ts` and `apps/web/src/routes/MapSpike.test.tsx`.

Future changes must preserve the split between entity-specific derivation and shared rendering, distinguish graph entities from registry references, and test both the changed Inspector and the existing Inspector reference. Accepted semantic changes must update this contract, the actual derivation/assembly owner, and affected regressions together; presentation or interaction changes must also update their respective shared contract and owner.
