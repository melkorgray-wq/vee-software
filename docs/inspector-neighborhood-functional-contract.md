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

### Established entity-specific grounds

For a **Touchpoint**, the accepted grounds are:

- for each Offer linked to the inspected Touchpoint, the other Touchpoints directly linked to that same Offer; and
- for the inspected Touchpoint's `Located in` reference, the other Touchpoints with that same `Located in` reference.

For an **Offer**, the accepted grounds are:

- the other Offers belonging to the same Product; and
- for each Touchpoint linked directly to the inspected Offer, the other Offers directly co-presented at that Touchpoint.

Product, Offer, and Touchpoint are graph entities. `Located in` is a registry reference and must not be rendered, navigated, or modeled as a graph entity. These grounds are entity-specific; they must not be generalized to another entity kind without an accepted ontology decision.

## Current runtime behavior

- `deriveTouchpointBusinessStructure()` derives the Touchpoint projection from committed records. Its `otherTouchpointsByOffer` and `otherTouchpointsInContainer` fields feed `touchpointBusinessStructureSection()` in `apps/web/src/routes/MapSpike.tsx`.
- `offerNeighborhoodSection()` currently derives Offer grounds in `MapSpike.tsx`.
- Shared `NeighborhoodGroups` owns rendering, count badges, disclosure, navigation links, stable group identity, and the shared layout behavior described by the presentation contract.
- Disclosure and Inspector navigation follow the shared presentation and interaction contracts. Disclosure/filter state is transient UI state, not part of `MapDocument`.
- Regression evidence currently lives in `apps/web/src/touchpoint-business-structure.test.ts` and `apps/web/src/routes/MapSpike.test.tsx`.

This contract establishes functional semantics. It does not move entity-specific derivation into `NeighborhoodGroups`; the renderer consumes derived groups and must not become the ontology owner.

## Known implementation gaps

- Touchpoint assembly currently creates an Offer ground for every Offer linked to the inspected Touchpoint, even when that ground has no neighbors. It can also create a `Located in` ground with no neighbors.
- Existing Offer regressions explicitly preserve some zero-neighbor Product grounds.
- Those zero-neighbor groups conflict with the accepted nonempty-ground invariant. A separate runtime task must change the derivation/assembly owners and affected regressions. This documentation-only change intentionally does not alter runtime code or tests, and the current zero-neighbor output is not an accepted invariant.

## Accepted directions for further development

### Client intent grounds

Client intent is an accepted next semantic direction, not implemented Neighborhood behavior:

- an Offer uses its own selected Job/Desired Outcome subsets and its Offer-owned Financial Desired Outcome;
- a Touchpoint uses only locally selected paths that were actually authored for that Touchpoint, together with contributor attribution; and
- available upstream intent is not locally selected intent and therefore is not a local Neighborhood basis.

This direction introduces no new relationship kinds and approves no unconfirmed matching algorithm. Its concrete grounds, grouping, derivation owner, and presentation require an implementation task consistent with the provisional ontology and existing intent ownership.

### Focused exploration

Focused exploration is accepted as a non-mutating functional direction. Ground-type controls may temporarily hide or dim cards that do not match the active type filter without changing `MapDocument` or its authored relationships. This state is a transient view/filter state, not document state.

Before type controls are implemented, the boundary between a concrete ground and its ground type must be defined explicitly. No ground-type taxonomy is accepted by this contract beyond the established entity-specific grounds above.

## Deferred decisions and open questions

- A relevant-Repulsor ground is deferred until Offer-level exposure semantics are agreed. It is not implementation-ready.
- Focused-exploration interaction details remain open: exact control design, hide-versus-dim default, single versus multiple selection, initial mode, keyboard and focus behavior, dismissal/reset behavior, accessibility semantics, and responsive presentation.
- The concrete-ground/ground-type boundary and any reusable ground-type taxonomy remain open and must be settled before type controls are implemented.
- Client-intent matching/grouping details and ownership beyond the accepted constraints above remain open; no speculative relation or algorithm may fill those gaps.

## Owner chain and change gate

The verified owner chains are:

- Touchpoint derivation: `deriveTouchpointBusinessStructure()` and `otherTouchpointsByOffer` / `otherTouchpointsInContainer` in `apps/web/src/touchpoint-business-structure.ts`;
- Inspector assembly and shared rendering: `touchpointBusinessStructureSection()`, `offerNeighborhoodSection()`, and `NeighborhoodGroups` in `apps/web/src/routes/MapSpike.tsx`;
- presentation, disclosure, navigation, focus, and transient-state rules: the [Inspector presentation contract](./inspector-presentation-contract.md) and [Inspector interaction contract](./inspector-interaction-contract.md); and
- regression evidence: `apps/web/src/touchpoint-business-structure.test.ts` and `apps/web/src/routes/MapSpike.test.tsx`.

Future changes must preserve the split between entity-specific derivation and shared rendering, distinguish graph entities from registry references, and test both the changed Inspector and the existing Inspector reference. Accepted semantic changes must update this contract, the actual derivation/assembly owner, and affected regressions together; presentation or interaction changes must also update their respective shared contract and owner.
