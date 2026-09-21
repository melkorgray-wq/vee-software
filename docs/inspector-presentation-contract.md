# Inspector presentation contract

Status: **Accepted reference for new Inspector work**. Source: the hardened Touchpoint Inspector on the repository mainline. The contract defines portable presentation rules; it does **not** claim that Product and Offer already implement them. The running code and tests remain the authority for current behavior.

Read this file during **Plan / task-stub preparation**, before designing or modifying Inspector layout, controls, or presentation. Also read [Inspector behavior contract](./inspector-behavior.md) when the work affects interaction.

## Planning gate

For every new Inspector screen or section:

1. Identify the equivalent Touchpoint presentation surface and its active code/CSS owner below.
2. State which existing layout, control, and visual states will be reused without introducing entity-specific dimensions or a parallel component.
3. Separate genuine differences due to entity ontology (relations, intent, available actions) from presentation. An initially single-card view is **not** an ontological reason for its own width rules.
4. When the reference cannot meet the desired result, propose the smallest shared-owner change, its impact on existing Inspectors, and its regression checks **before** implementing a local override.
5. If the agreed shared pattern changes, update this contract and affected tests in the **same change**. Do not treat an external prompt or old screenshot as the contract.

### Active owners

| Pattern | Existing owner |
| --- | --- |
| Inspector page, header, section/links, shared control dimensions | `apps/web/src/styles.css` |
| Business structure and Neighborhood JSX; Inspector navigation | `apps/web/src/routes/MapSpike.tsx` |
| Touchpoint authored Business projection | `apps/web/src/touchpoint-business-structure.ts` |
| Client Scope measured-height packing | `apps/web/src/client-scope-packed-layout.ts` and `ClientScopePackedGroups` in `MapSpike.tsx` |
| Layout and UI regressions | `apps/web/src/client-scope-packed-layout.test.ts`, `apps/web/src/routes/MapSpike.test.tsx` |

Reusing the appearance does **not** mean copying Touchpoint owner-specific domain logic.

## Document frame and section hierarchy

- `.inspector` has `min-width: 0` and adaptive padding `clamp(.75rem, 2vw, 1.5rem)`. The header and Inspector form use the available document width with `max-width: 72rem` and centered margins. A new section should not silently limit that width.
- The header presents editable Title, entity kind/side, applicable Business lineage, and Inspector Back/Forward. Linked entity titles are navigational, while external URL, edit controls and derived chips have distinct affordances.
- Use document sections according to actual semantics: Business structure, derived Neighborhood, Client scope, Resistance as applicable. Never invent Placement/Containment for an entity merely to fill a symmetrical grid.
- Business structure reference: `.business-structure-regions` uses `minmax(0, 1.6fr) minmax(12rem, 1fr)`, `gap: 1rem 1.5rem`. It collapses at `max-width: 42rem`. Reuse `.business-structure-property`, `.business-structure-links` and editable heading patterns; adapt field meaning to the owner.
- Entity navigation is a text-like, underlined accent-colored button, distinct from `Click to edit` on an editable property heading. URL is an external link, not internal entity navigation.

## Neighborhood: shared compact disclosure

For a derived Neighborhood, reuse `.business-structure-derived`, `.derived-heading`, `.derived-neighborhood-slices`, `.derived-neighborhood-slice`, `.derived-neighborhood-disclosure`, `.derived-neighborhood-count`, and `.derived-neighborhood-content`.

- The section uses available Inspector width. Each card remains compact. The Touchpoint grid reference is `repeat(auto-fit, minmax(min(100%, 14rem), 20rem))`, `justify-content: start`, `align-items: start`, and `gap: .65rem`. At document width 1152px, three 20rem cards and two .65rem gaps can fit.
- Current card padding: `.35rem`; border: `1px`; radius: `.4rem`. Disclosure uses `auto minmax(0, 1fr) auto` with padding `.3rem .35rem`. Count has `min-width: 1.45rem`, `font-size: .68rem`. These are shared implementation values, not independent per-entity tokens.
- Preserve label wrapping, `min-width: 0`, a focus-visible affordance, independent disclosure, counts with defined units, and link navigation. A neighbor may appear under different grounds but is deduplicated within one ground.
- At `max-width: 30rem`, the shared fallback is a single column. Test single, two, and many groups, long labels, collapsed and expanded states, and narrow widths.
- Do not copy the former Offer-only `25.5rem` section cap or larger `20rem–25.5rem` grid tracks into new sections. These were a local response to one Product group and prevented three-column layout after further grounds were added. Inspect the current branch because the parallel Offer layout PR may already be replacing them.

**Important implementation distinction:** Touchpoint Neighborhood currently uses ordinary CSS Grid, which can leave space below shorter cards in a row. Touchpoint **Client Scope** uses measured-height packing. Do not claim Neighborhood already has masonry packing. If independent compact packing for Neighborhood is accepted, evaluate reuse/extraction of the existing packed-layout owner with measured heights, stable IDs, ResizeObserver and tests. Do not invent a second packing algorithm.

## Client Scope and other compact panels

- The reference read-state renders nonempty panels for the six canonical kinds: CFJ, RJ, CCJ, EJ, SJ, FDO. Use `.client-scope-view-groups` fallback grid `repeat(auto-fit, minmax(min(100%, 18rem), 22rem))` with `.65rem` gap.
- `ClientScopePackedGroups` / `useClientScopePackedLayout` measures actual panel and container sizes and places each panel into the lowest current column; parameters: `18rem` minimum panel, `22rem` maximum, `.65rem` gap. ResizeObserver recalculates height and positions. Preserve stable panel identity and logical reading/focus order. Never use absolute placement without a measured container height.
- Panel reference: padding `.35rem`, border `1px`, radius `.4rem`; disclosure with `auto minmax(0, 1fr) auto`; a count chip, independent state, and semantic mini-dendrite for Job → selected DO. EJ/SJ do not receive fake ordinary DO children; FDO is an independent leaf.
- Distinguish **chosen, authored intent** from upstream options. The presentation can be shared, while its projection, contributor attribution and domain commands belong to the individual entity.

## Controls, text, accessibility

- Prefer the active shared classes: `.inspector-property-heading-action`, `.inspector-secondary-action`, `.inspector-relation-editor`, `.inspector-relation-row`, `.inspector-relation-indicator`, `.intent-selection-surface`. Inspect their actual styling and reuse them; do not make new Offer/Product-only dimensions for identical actions.
- Current interaction sizing includes a `1rem` checkbox and `.9rem` relation indicator. Such current values are not assertions of universal accessibility target sizes. Preserve full-row selection hit areas where implemented, keyboard focus, long-title wrapping and narrow viewport behavior.
- Derived/read-only status chips must not look like edit buttons. No generic sticky Apply footer in a new immediate-commit Inspector: it is legacy Product/Offer form debt, not a shared presentation primitive.

## Regression and change policy

An Inspector layout task stub must record the existing pattern/owner, reused sizing and behavior, justified exceptions, impacted Inspector kinds, and checks. Check the real available **container** width (not just viewport width), dynamic card count, differing expanded heights, no overlap or horizontal overflow, focus visibility, and one/many groups. Browser measurements are diagnostic evidence for a concrete viewport; do not turn them into arbitrary global pixel mandates.

This contract is enforced through repository planning instructions and by using shared code/tests. Documentation alone is not an automated layout test. Any approved change to the reference must amend this contract and the corresponding regression tests in the same change.
