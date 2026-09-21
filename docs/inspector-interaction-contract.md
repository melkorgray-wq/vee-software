# Inspector interaction contract

Status: **Accepted reference for new Inspector work**. Grounded in the hardened Touchpoint Inspector, its tests, and `PRODUCT.md`. This is a reusable interaction contract, not a claim that all entity kinds implement it. See [presentation contract](./inspector-presentation-contract.md) for sizing and layout.

Read this file at **Plan / task-stub stage** before proposing Inspector navigation, editing, selection, derived disclosure, or transient-state behavior. Match owner-specific semantics to `PRODUCT.md` and the domain model.

## Planning gate

For every affected action, identify:

| Question | Required answer in the task stub |
| --- | --- |
| Owner | Which entity owns the authored data or derived projection? |
| State | Read, editing, unresolved, impact confirmation, failed, or complete? What is transient vs committed? |
| Trigger | What exact gesture starts or completes the operation? |
| Commit boundary | When does a complete, valid, unambiguous operation commit? |
| Navigation/focus | Which action is edit vs entity link? Where does keyboard focus go on Close, Escape, switching editor and commit? |
| Invalid/empty/destructive | What is visible, what is requested and what is left unchanged? |
| Reuse | Which reference handler, UI pattern and tests apply; what ontology-specific deviation is justified? |

The reusable contract is evaluated **before implementation**, not added as a post-hoc checklist. Do not simply copy owner-specific Touchpoint commands into Offer or Product.

## Editable document and owner-level commits

Map and Inspector edit one `MapDocument`. The completed, valid, unambiguous, non-destructive local gesture triggers a single atomic domain operation. Transient editors, search queries, focus, selected UI tabs and expanded groups are not durable authored changes. Existing Product/Offer section-wide Apply is transitional runtime debt, **not** a reusable Inspector interaction.

| Event | Contract |
| --- | --- |
| Entity link | Navigate to that entity's Inspector through Inspector history, without entering edit mode. |
| Editable property heading | On hover/focus disclose `Click to edit`; activate its embedded local editor, separately from the property's value link. |
| Title Enter/blur | Commit a valid title once; Escape cancels the incomplete inline edit. |
| Single-select relation | A complete valid radio choice commits and closes. Optional Clear is a separate explicit action; mandatory relations have no Clear. |
| Multi-select relation | A complete valid checkbox row commits immediately; the editor may remain open for subsequent choices. |
| Client semantic path | Commit when the full valid local path is known; request only genuinely missing parent/DO/contributor context, without guessing. |
| Destructive operation | Show the exact dependent impact before committing; Cancel leaves committed data unchanged; Confirm commits that operation. |
| Invalid, unresolved, cancelled, failed | Preserve committed document and unrelated state, display error or missing semantic choice. |
| Close / Escape / outside | Dismiss transient editor without rolling back already committed operations. |
| Nested Back | Return one level within the current editor; do not confuse with Inspector Back, browser history or future Undo. |

A read-only derived block is not an editable authored relation. No `Apply`, `Save` or `Done` should be required to reaffirm an already completed gesture. An editor must never hide a dirty uncommitted form draft and present stale read-state as if it were current durable state.

## Navigation, focus and hit areas

- Entity titles are navigation links; external URLs open outside the Inspector; heading actions edit. Label/checkbox rows in a picker are single selection hit areas, not mixed with a second navigation target.
- Explicit Close and Escape return focus to the current mounted heading action when appropriate. Outside pointer and switching to a different editor must **not** steal focus by restoring it to an old owner. Keep keyboard interaction and visible focus after immediate commits.
- Inspector Back/Forward uses transient selected-entity history. Map reselection establishes a new root; an Inspector → Map → Inspector round trip without selection change preserves history. Nested editor Back, browser Back and Undo are different mechanisms.
- Reuse `RELATION_EDITOR_SEARCH_THRESHOLD = 7` as the current reference for optional searchable relation candidates unless a measured difference warrants another threshold.

## Business structure: shared gesture, owner-specific semantics

- Touchpoint linked Offers: multi-select structural relations with review of downstream intent/mitigation impact. Parent: optional single-select, explicit Clear; Children attach/detach/reassign/create invoke dedicated structural commands and may need contributor resolution.
- Offer linked Product: mandatory single relation; Touchpoint's optional `Clear parent` does not apply. A Product change can affect Offer and downstream Touchpoint intent. Connected Touchpoints are many-to-many inverse relations; Touchpoints are not a containment copy of Children. Preserve valid structural requirements and destructive review.
- A reusable radio/checkbox editor does **not** authorize a new direct domain edge or a generic setter.

## Client scope: read and edit

- Touchpoint read-state shows the nonempty canonical kinds CFJ, RJ, CCJ, EJ, SJ and FDO with independent disclosure and mini-dendrites. DO-bearing Job shows its selected DO; EJ/SJ have no ordinary DO; FDO is a separate independent leaf.
- `initialCompactOverviewExpandedGroupIds()` provides current initial density for Touchpoint Neighborhood and Client Scope: one group with count ≤4 opens; two groups open if each count ≤4 and total ≤6; otherwise default collapsed. Preserve user-selected state and stable group identity. These exact thresholds are a reference, not automatic semantics for every possible future panel.
- Expanded groups are ordered first in Touchpoint Neighborhood and Client Scope, while preserving stable links/identity and focus. Independent group expansion is transient, not a document commit.
- Touchpoint Client scope editing is a state **within the persistent section**, not a nested whole-form editor. A single ontology-aware `Search Client intent` and compact upstream-source disclosures guide selection. For Child Touchpoint, the immediate Parent is the semantic source; the Child must author its own contributing Offer path.
- For a DO-bearing CFJ/RJ/CCJ there is no direct Touchpoint path without an addressed DO. EJ/SJ may be direct Job paths; FDO is through Offer only, never Product. Use owner-specific domain operations for Offer/Client-side editing. A selected intent is not proof of realized outcomes.

## Derived Neighborhood and Resistance

- Neighborhood is a read-only derived projection from committed data. Each group names its actual provenance/ground; count unique neighbors within that ground. The same neighbor may appear under distinct grounds. Disclosure is independent and navigation opens an entity Inspector; it does not author neighbor-to-neighbor relationships.
- Touchpoint Resistance is derived relevance, separate from optional authored local `Mitigated here`. Product/Offer do not copy that checkbox. Their current derived impact and future broader intent-based exposure must not be silently conflated.

## Regression and evolution

The task stub identifies the applicable current tests and adds focused checks for gestures, commits, failed/cancelled operations, focus, keyboard, navigation and disclosure identity. Relevant reference coverage lives in `apps/web/src/routes/MapSpike.test.tsx`; domain commands belong in domain-level tests. `pnpm check` does not replace a real layout and interaction walkthrough.

When an agreed shared behavior changes, update this contract, the shared owner (where appropriate), and affected tests in the same change. Document a genuine owner-specific exception and its rationale here or in the owning product contract. Do not create another Inspector-specific rule merely because the local JSX differs.
