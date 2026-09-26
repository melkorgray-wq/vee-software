# Inspector interaction contract

Status: **Accepted reference for new Inspector work**. It is grounded in `PRODUCT.md`, the hardened Touchpoint Inspector, domain operations, and regression evidence. It does not claim that every Inspector implements the contract or that the proposed architecture is final.

Read this file and the [Inspector presentation contract](./inspector-presentation-contract.md) during Plan/task-stub preparation. For a new Inspector kind or Neighborhood extension, also follow the [Neighborhood functional contract](./inspector-neighborhood-functional-contract.md) and [transfer checklist](./inspector-presentation-contract.md#neighborhood-transfer-checklist); preserve the established shared transient-state and navigation behavior rather than recreating it per kind. Authority runs from repository/product contracts and accepted decisions, through runtime behavior, then automated regression evidence; documentation is corrected when it disagrees. Old notes and screenshots are clues only. Product/Offer section-wide Apply is legacy debt, never the reusable reference.

## Planning gate and audited owners

For each action identify: authored or derived owner; read/edit/incomplete/confirmation/error state; trigger; semantic completion and transaction boundary; navigation/focus owner; invalid/empty/destructive result; reusable reference handler; ontology-specific exception; and regression plus remaining manual check.

The coverage inventory, including all Touchpoint sections, Offer Business structure, owners, CSS, derivations, tests and gaps, is maintained in the presentation contract’s [Audit coverage](./inspector-presentation-contract.md#audit-coverage). Interaction claims below were checked against `MapSpike.tsx`, `touchpoint-edit.ts` (including its atomic Offer replacement helpers), `touchpoint-business-structure.ts`, `offer-business-structure.ts`, `client-scope-packed-layout.ts`, `inspector-navigation.ts`, and canonical `duplicateEntity()`/`duplicateEntityRelationshipIdCount()` in `packages/domain/src/index.ts`. Evidence includes focused `offer-business-structure.test.ts`, `touchpoint-edit.test.ts`, `MapSpike.test.tsx`, `inspector-navigation.test.ts`, and `packages/domain/src/index.test.ts` regressions.

## State glossary and ownership

- **Committed `MapDocument`:** the in-memory authored entities, typed relations, intent selections, containers and placements. It is the only current durable-within-the-running-spike document state; there is no external persistence, save, sync, reload or undo guarantee.
- **Local property editor state:** temporary query/value/mode/error state for Title, URL, Located in, Offers, Parent or Children. Its owner is the mounted Inspector surface in `MapSpike.tsx`; each concrete editor defines whether dismissal first naturally completes its active field.
- **Offer Content property editor:** `contentUrl` draft, `contentText` draft, active-field identity, disclosure state, and scroll snapshot are transient UI state owned by `MapSpike.tsx`. Only committed `contentUrl` and `contentText` belong to the Offer in `MapDocument`.
- **Incomplete semantic operation:** a draft or domain plan lacking a required outcome, contributor, parent, Offer, title, confirmation, or other unambiguous owner context. It is not a partial domain mutation.
- **Transient disclosure state:** expanded Neighborhood/Client Scope group IDs keyed by stable owner/group identity. It changes presentation only.
- **Selection:** the currently inspected entity/UI target. It is UI state, distinct from domain relationships.
- **Inspector history:** `InspectorHistory` owned by `inspectorHistoryReducer`; it records transient selected-entity traversal.
- **Map selection:** shared workspace/canvas selection. It may establish the Inspector root but is not Inspector history and is not a domain relation.
- **Focus owner:** the active input, candidate row, heading action, dialog, menu or workspace control. Refs and close reasons in `MapSpike.tsx` coordinate restoration.
- **Confirmation state:** pending exact destructive impact plus Cancel/Confirm; no mutation has occurred for that pending operation.
- **Nested replacement planning:** transient, incomplete UI state comprising an existing replacement choice, sibling-title input, planned duplicate title, and impact confirmation. None is committed domain data, and none mutates `MapDocument` before confirmed completion.
- **Validation/error/status state:** recoverable local error or time-bounded operation feedback. It does not itself mutate the document.
- **Measured presentation state:** `usePackedPanelLayout` output derived from container/panel measurements. It affects coordinates/height only and is neither selection nor authored data.
- **Neighborhood focus state:** owner-keyed transient selected ground-type IDs plus `dim | hide` mode, owned by shared `NeighborhoodGroups`. It is independent from disclosure and committed data.

## State table

| State | Owner | Entry trigger | Visible result | Commit effect | Dismissal behavior | Persistence / reload standing |
| --- | --- | --- | --- | --- | --- | --- |
| Committed document | `MapSpike.tsx` document state; `MapDocument` and domain commands | Successful complete domain transaction | Read projections update | Replaces document once for the action | Cannot be rolled back by Close/Escape/outside | In-memory spike only; no external persistence/reload promise |
| Local property editor | Relevant `MapSpike.tsx` component state/ref | Activate editable heading/value | Embedded input/candidates/action controls | None until that editor’s defined natural completion or complete selection | Dismissal behavior is editor-specific; unfinished state may be completed or abandoned as its accepted contract defines, while prior commits remain | Transient; remount/reload standing unspecified |
| Offer Content property editor | `offerContentSection()` draft and active-field refs in `MapSpike.tsx` | Activate Add/Edit Offer Content | Two independent URL/text fields with recoverable URL error | Natural completion of one valid active field calls `updateOfferContent()` once; disclosure/scroll restoration: **None** | Close/outside/switch completes the valid active field first; invalid URL blocks dismissal; Escape abandons only that active draft | Drafts, active field, disclosure, and scroll snapshot are transient UI state; committed values are in-memory `MapDocument` state |
| Incomplete semantic operation | Editor mode or domain plan result (`unresolved`) | Select a leaf/action without required semantic context | Resolver, missing-choice prompt, or recoverable error | None | Nested Back/Cancel/Escape abandons incomplete operation | Transient only |
| Disclosure | owner-keyed expansion maps in `MapSpike.tsx` | Activate disclosure | Panel expands/collapses; expanded groups order first | None | Not an editor rollback; retained only as implemented for mounted/history owner | UI-only; no reload guarantee |
| Selection | workspace route state | Map/entity-link/workspace action | Selected entity Inspector/Map styling | None by itself | Replaced by deliberate selection/navigation | UI-only |
| Inspector history | `inspectorHistoryReducer` | Start, entity link, Back/Forward | Back/Forward availability and inspected target | None | Map round trip retains it when implemented and selection is unchanged | Session UI-only; invalid entities skipped |
| Map selection | Map workspace owner | Canvas selection/reselection | Map target and Inspector root association | None | Reselection establishes a new history root | UI-only |
| Focus | browser + mounted control refs | Keyboard/pointer entry, editor/dialog open | Visible focus on current owner | None | Explicit Close/Escape may restore; outside/switch deliberately does not steal focus | Never document state |
| Confirmation | confirmation state/dialog in `MapSpike.tsx` | Owner reports destructive impact | Modal exact impact and Cancel/Confirm | Confirm performs one transaction; Cancel none | Escape/Cancel closes without mutation | Transient only |
| Nested replacement planning | nested editor and confirmation state in `MapSpike.tsx` | Sole mandatory Offer removal requires a complete replacement | Existing-Offer choice, sibling-title input or planned duplicate title, followed by exact impact review | One confirmed completion creates/duplicates and replaces atomically; all earlier steps have no effect | Back moves one nested level; Escape/Cancel/unfinished Close discard only the plan | Transient only; never persisted in `MapDocument` |
| Validation/error/status | local editor or global message state | Validation/domain failure or success | `role=alert`/`role=status` feedback | Failure none; status describes prior commit | Error remains recoverable; no silent retry | Transient; no sync/save meaning |
| Measured presentation | `usePackedPanelLayout` | mount, panel/container resize/content change | Packed transforms and explicit container height, or Grid fallback | None | Recalculates or falls back; no authored effect | Recomputed, never persisted |
| Neighborhood type selection | `NeighborhoodGroups`, isolated by inspected owner | Native type-checkbox toggle or Reset | Empty means unfiltered; otherwise matching uses selected IDs with OR semantics | None | Toggle adds/removes one type; Reset clears all; unavailable types are pruned | Transient; not stored in document, history, URL, or entity-specific parents |
| Neighborhood focus mode | `NeighborhoodGroups`, isolated by inspected owner | Choose Dim or Hide | Dim retains all cards and de-emphasizes nonmatches; Hide renders matching cards only | None | Mode persists while that owner is mounted; owner change synchronously shows Dim default | Transient; not stored in document, history, URL, or entity-specific parents |

## Commit contract

Semantic completeness is the boundary: **one complete owner-level action → one domain transaction**.

- Complete valid non-destructive relation/control actions commit immediately. Multi-select commits each toggle; single-select commits its complete choice and closes. Title and property text use natural completion (for example Enter/blur where implemented); Escape cancels the incomplete edit.
- Incomplete, ambiguous, invalid, cancelled, or failed operations do not mutate `MapDocument`. Keep the editor recoverable and request only missing context; never infer ontology or contributor identity.
- A destructive change follows impact derivation → exact review → explicit confirmation → one commit. Cancel leaves committed data unchanged. There is no silent retry.
- Close, Escape and pointer-outside dismiss transient state. They are not rollback for already completed local commits. Natural completion remains the generic property commit boundary, but each concrete editor must define whether that completion occurs before dismissal. Offer Content completes a valid active field before Close/outside/switch and uses Escape to abandon only that active unfinished field; do not transfer this specialization to relation editors, nested incomplete operations, or other property editors without their own accepted contract. “Apply”, “Save”, “Done”, “saved”, or “synced” must not imply durability that the spike does not have.
- Product/Offer whole-section Apply remains legacy behavior scheduled for replacement. Do not use it as an example for new work.

The owner chain is `MapSpike.tsx` gesture/state → a focused helper in `touchpoint-edit.ts` where present → one framework-independent operation in `@vee/domain` → fresh read/derived projection. UI handlers must not synthesize direct edges that the domain owner does not authorize.

## Navigation and focus

- `navigateInspector()` pushes entity navigation through `inspectorHistoryReducer`; `traverseInspectorHistory()` skips missing entities. Inspector Back/Forward are distinct from browser history, future Undo, and nested editor Back.
- Map reselection starts a history root. The implemented Inspector → Map → Inspector round trip preserves history when Map selection did not change. Linked entity titles navigate internally; safe URLs navigate externally.
- Dirty/impact guards apply only where implemented (notably legacy Product/Offer draft navigation and pending impact confirmation). Do not claim a universal unsaved-changes guard for immediate-commit Touchpoint editors.
- Opening an editor deliberately focuses its first relevant search/candidate/input. Explicit Close and Escape restore focus to the still-mounted/remounted heading action where appropriate. Pointer-outside dismissal and switching editors must not steal focus back from the new pointer/focus owner. A wide embedded section editor may place textual **Close** beside its local section heading; a compact editor may retain Close at the local edge of its surface. This placement adapts to the surface and does not change commit/dismissal semantics; icon-only X is neither mandatory nor the reference pattern.
- Candidate rows support native keyboard activation and one primary selection hit area. They must not contain competing entity navigation while local editing is active.
- Escape is progressive: close the deepest resolver/confirmation/nested mode first, then its editor, then any outer transient surface. Nested Back returns one editor level; Inspector Back traverses entities.
- After successful sibling creation or duplication and sole-Offer replacement, the new Offer opens in the Inspector from a draft built from the committed result. The navigation adds an Inspector-history entry, so Inspector Back returns to the departing Offer.
- In that flow, Back moves one nested level and Escape remains progressive. Confirmation Cancel/Escape, nested Back, and unfinished Close cancel only incomplete state; none rolls back an earlier completed commit.
- Neighborhood type checkboxes, Reset, and the single-choice Dim/Hide controls are native keyboard controls with visible focus. Before a checkbox, Reset, or Hide mode action could remove the currently focused card subtree, focus moves synchronously to the initiating control (or the stable controls container); focus is never left on detached content. Dim never changes card accessibility or tab order. Neighbor links continue through `navigateInspector()`, and the newly inspected owner synchronously receives empty selection and Dim.

Neighborhood focus and concrete-ground disclosure are independent: selection/mode transitions never toggle disclosure, and Hide → Dim or Reset remounts previously hidden grounds with their existing disclosure state. All focus actions are presentation-only and cause no `MapDocument` transaction, Inspector-history entry, URL mutation, or entity-specific parent state update.

Optional rich Neighborhood content is read-only and remains subordinate to the same disclosure. Basis, neighbor, ordinary Desired Outcome, and contributor Offer links use only ordinary `navigateInspector()` history navigation. The disclosure button contains no nested basis, neighbor, outcome, or contributor controls. Rich content does not acquire separate disclosure, focus, filtering, card, or layout state. Disclosure and focus/filter actions, all rich-content navigation, and reading comparison/provenance detail never mutate `MapDocument`; navigation changes only transient Inspector/history state under the existing rules.

Current tests cover many focus transitions but do not prove every tab sequence, focus trap, screen reader announcement, external navigation, or browser geometry. Those remain manual browser/accessibility checks.

## Offer Content property editing

`contentUrl` and `contentText` are two independent Offer-authored property operations. Their shared embedded surface does not combine them into one transaction. Natural completion of the active valid field performs exactly one `updateOfferContent()` commit; moving between fields may therefore commit one sibling before the other.

- Explicit **Close**, pointer-outside dismissal, and switch-editor first complete the active valid field, then close or transfer ownership. URL validation failure performs no document mutation, blocks that dismissal/switch, keeps the editor recoverable, and retains its error locally.
- **Escape** explicitly abandons only the current unfinished active field and closes the editor. Escape and every other dismissal path preserve any sibling property already committed; they never roll it back.
- Offer-wide legacy **Apply** does not participate in Content editing. Disclosure and collapse scroll restoration are presentation interactions with commit effect **None**.
- Close placement follows the surface adaptation in [Navigation and focus](#navigation-and-focus): explicit Close/Escape may return focus to the Content heading affordance, while pointer-outside and switch-editor preserve the new focus owner.

This completion-before-dismissal rule is the accepted Offer Content specialization, not a silent rewrite of the generic local-property, relation-editor, or nested-operation contract.

## Relation and structural editing

Portable interaction grammar:

1. An editable property heading opens a local embedded editor, separate from value navigation.
2. Multi-select stays open until explicit Close or dismissal; every complete toggle is already committed.
3. Single-select closes after a complete selection. Optional Clear is an explicit local action, never a fake candidate; mandatory relations omit it.
4. Search appears only for sufficient candidate space. `RELATION_EDITOR_SEARCH_THRESHOLD = 7` is the current reference, not universal ontology.
5. Close preserves committed selections. Cancel/Escape may abandon only unfinished work.
6. Reassignment/removal uses owner-aware impact planning and confirmation where destructive.
7. A mandatory relation cannot pass through an empty committed state. When removing its sole current value requires another value, the outer editor opens a transient nested replacement step; choosing a candidate changes no document, and one explicit confirmation commits the complete replacement atomically. Back/Escape returns one level without mutation. The review is required even when downstream impact is empty and includes the owner's exact impact when it is not.

Touchpoint meaning is not portable: Offers are multi-select structural presentation relations with at least one Offer required. Attempting to remove a Touchpoint's sole Offer never creates an unchecked committed state or passes through a temporarily empty committed set. The nested screen explains, using the actual Touchpoint and Offer titles, that the Touchpoint must present at least one Offer. The user may select an existing replacement Offer, create a blank sibling Offer, or canonically duplicate the departing Offer. Destructive impact review remains explicit and uses Touchpoint-owned complete-set semantics; one confirmation creates or duplicates the replacement and replaces the sole relation atomically, never through Clear or detach-then-attach.

**Create sibling Offer.** `sibling` is a UX/domain interpretation, not an entity kind or relationship kind. The new Offer is packaged as the same Product, and the user supplies only its required Title. Otherwise it is blank: it inherits no Offer Job selections, addressed scope, Offer Financial intent, Connected Touchpoints, or Touchpoint encounter intent. `createSiblingOfferAndReplace()` is the focused owner of this atomic operation. Entering the mode, typing a title, Back, Escape, or Cancel creates no partial data.

**Duplicate current Offer.** Canonical `duplicateEntity()` defines Offer duplication. The duplicate receives the same Product and canonical Offer-owned authored state, including `contentUrl`, `contentText`, current Offer Job selections/addressed scope, and Offer Financial intent. It does not receive Connected Touchpoints, derived Neighborhood, or Touchpoint-owned encounter Job/Financial Desired Outcome selections. Transient Content drafts, disclosure, and scroll state are not copied. `duplicateOfferAndReplace()` composes canonical duplication with Touchpoint-owned replacement rather than implementing a forked copy algorithm. A collision-safe, distinguishable title is part of the accepted duplicate flow.

Ownership is explicit: `MapSpike.tsx` owns the gesture, nested editor, confirmation, focus, and Inspector navigation. `touchpoint-edit.ts` owns the Offer-side adapter and atomic `replaceTouchpointLinkedOffer()`, `createSiblingOfferAndReplace()`, and `duplicateOfferAndReplace()` helpers. `commitTouchpointLinkedOffers()` owns the complete Offer set for one Touchpoint, while `getTouchpointLinkedOfferChangeImpact()` determines departing-attributed downstream impact. `duplicateEntity()` determines copied Offer-owned authored state. JSX neither synthesizes relation arrays nor implements another duplication algorithm.

Atomic completion preserves these invariants:

- no committed result leaves the Touchpoint without an Offer;
- creation/duplication, Product relation, placement, and replacement appear together in one completed `MapDocument`;
- only Touchpoint intent paths attributed to the departing Offer are removed, while unrelated surviving paths and other Touchpoints remain unchanged;
- replacement neither creates nor reattributes Touchpoint Client intent automatically; and
- a stale precondition or validation failure leaves no partial entity, relationship, or placement record.

Parent is optional single-select; Children attach/detach/reassign/create use dedicated commands and may require ancestor contributor resolution. `deriveTouchpointChildrenCandidates`, `deriveTouchpointReassignTargets`, `commitTouchpointParent`, and `planTouchpointStructuralChange` own those semantics. A generic radio/checkbox does not authorize generic setters, direct edges, containment, candidate eligibility, or the Offer replacement mechanics above.

## Client Scope and Resistance

- Read disclosure is transient presentation; authoring changes intent. Global discovery (`globalIntentDiscovery`) differs from upstream sources (`touchpointUpstreamSources`). Selectable leaves and paths remain ontology-aware.
- DO-bearing Core Functional, Related and Consumption Chain Jobs require ordinary Desired Outcome paths; Emotional/Social Jobs may route directly; Financial Desired Outcome routes through Offer. Contributor ambiguity produces a resolver/incomplete path, never a guessed contributor.
- Client authoring uses progressive Escape and immediate owner-aware commits only after a complete path. The Child must author its own contributing Offer path; Parent context is not contributor identity.
- Resistance relevance is derived by `relevantRepulsorsForTouchpoint`; mitigation is an authored `touchpoint_mitigates_repulsor` relation committed by `commitTouchpointMitigation`/`setTouchpointMitigations`. Never convert derived relevance automatically into mitigation, or treat mitigation as proof that resistance was resolved.

These are Touchpoint ontology-specific exclusions. The reusable grammar is read disclosure versus authoring, provenance visibility, explicit incomplete/resolver state, progressive dismissal, owner-aware commits, and separation of derived from authored state.

## Error and boundary behavior

- Validation/domain failure preserves the committed document and unrelated UI state. Keep the editor open when recovery is possible and render actionable local error text.
- `MapSpike.tsx` owns current `role="alert"`/`role="status"` messages; local editors own their field/resolver errors. Success timeout must not erase an error. No silent retry is permitted.
- Empty means a valid absence and offers the appropriate authoring action. Invalid means the proposed operation failed validation. Unavailable means data/action cannot currently be resolved or selected. Do not collapse these into the same navigable-looking state.
- Confirmation owns focus while active and blocks bypass routes; exact trapping/restoration remains a required browser check where automated evidence is incomplete.
- Ambiguous ontology, missing contributors, or unresolved product rules remain incomplete/unresolved. The UI must not manufacture a semantic path.

## Reuse boundary

**Reuse:** document frame; semantic visual language; heading edit affordance; entity-link treatment; local embedded editors; independent property commits; recoverable validation; local action grouping; transient disclosure/scroll restoration; owner-aware focus; semantic-completeness commits; nested incomplete state; contextual explanation; explicit impact review; atomic completion; progressive Back/Escape/Cancel and meaningful focus return; disclosure state model; adaptive/packed mechanisms; navigation/history; validation and confirmation boundaries.

**Do not copy literally:** Offer Content fields, URL meaning, empty-state copy, first-nonempty-paragraph preview rule, or canonical Offer duplication contents; Product → Offer → Touchpoint structure; Offers, Located in, Parent or Children; Touchpoint containment/reassignment; Product sibling meaning; the Touchpoint minimum-one-Offer invariant; encounter-intent pruning; six Client Scope kinds as universal sections; contributor propagation; Resistance relevance/mitigation; specific empty states, counts or labels; Touchpoint-specific eligibility and domain operations. The accepted Offer/Touchpoint replacement mechanics do not establish a universal implementation for every mandatory relation.

A future Inspector first defines its ontology-owned properties, relationships, complete operations, destructive impacts and derived projections, then applies the common contracts.

## Maintenance and evidence rule

An accepted common-pattern change updates together: (1) the relevant contract, (2) the shared implementation owner, (3) regressions for the Touchpoint reference, and (4) regressions for other affected Inspector kinds. An entity-specific exception requires an ontology rationale. A low current card count is not grounds for a separate width/disclosure or state model.

Screenshots do not establish interaction semantics or geometry. Combine browser walkthroughs with pure domain/layout regressions and DOM/accessibility-semantic tests. Label uncertainty as current implementation not yet accepted, browser-only observation, missing regression guard, unresolved product/ontology question, or legacy behavior scheduled for replacement. Do not infer persistence, reload, undo, finalized viewport support, finalized ontology, or accessibility guarantees from this contract.
