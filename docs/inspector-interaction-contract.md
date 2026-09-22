# Inspector interaction contract

Status: **Accepted reference for new Inspector work**. It is grounded in `PRODUCT.md`, the hardened Touchpoint Inspector, domain operations, and regression evidence. It does not claim that every Inspector implements the contract or that the proposed architecture is final.

Read this file and the [Inspector presentation contract](./inspector-presentation-contract.md) during Plan/task-stub preparation. Authority runs from repository/product contracts and accepted decisions, through runtime behavior, then automated regression evidence; documentation is corrected when it disagrees. Old notes and screenshots are clues only. Product/Offer section-wide Apply is legacy debt, never the reusable reference.

## Planning gate and audited owners

For each action identify: authored or derived owner; read/edit/incomplete/confirmation/error state; trigger; semantic completion and transaction boundary; navigation/focus owner; invalid/empty/destructive result; reusable reference handler; ontology-specific exception; and regression plus remaining manual check.

The coverage inventory, including all Touchpoint sections, owners, CSS, derivations, tests and gaps, is maintained in the presentation contract’s [Audit coverage](./inspector-presentation-contract.md#audit-coverage). Interaction claims below were checked against `MapSpike.tsx`, `touchpoint-edit.ts`, `touchpoint-business-structure.ts`, `client-scope-packed-layout.ts`, `inspector-navigation.ts`, their named tests, and `packages/domain/src/index.ts`/`index.test.ts`.

## State glossary and ownership

- **Committed `MapDocument`:** the in-memory authored entities, typed relations, intent selections, containers and placements. It is the only current durable-within-the-running-spike document state; there is no external persistence, save, sync, reload or undo guarantee.
- **Local property editor state:** temporary query/value/mode/error state for Title, URL, Located in, Offers, Parent or Children. Its owner is the mounted Inspector surface in `MapSpike.tsx`.
- **Incomplete semantic operation:** a draft or domain plan lacking a required outcome, contributor, parent, Offer, title, confirmation, or other unambiguous owner context. It is not a partial domain mutation.
- **Transient disclosure state:** expanded Neighborhood/Client Scope group IDs keyed by stable owner/group identity. It changes presentation only.
- **Selection:** the currently inspected entity/UI target. It is UI state, distinct from domain relationships.
- **Inspector history:** `InspectorHistory` owned by `inspectorHistoryReducer`; it records transient selected-entity traversal.
- **Map selection:** shared workspace/canvas selection. It may establish the Inspector root but is not Inspector history and is not a domain relation.
- **Focus owner:** the active input, candidate row, heading action, dialog, menu or workspace control. Refs and close reasons in `MapSpike.tsx` coordinate restoration.
- **Confirmation state:** pending exact destructive impact plus Cancel/Confirm; no mutation has occurred for that pending operation.
- **Validation/error/status state:** recoverable local error or time-bounded operation feedback. It does not itself mutate the document.
- **Measured presentation state:** `usePackedPanelLayout` output derived from container/panel measurements. It affects coordinates/height only and is neither selection nor authored data.
- **Neighborhood focus state:** owner-keyed transient selected ground-type IDs plus `dim | hide` mode, owned by shared `NeighborhoodGroups`. It is independent from disclosure and committed data.

## State table

| State | Owner | Entry trigger | Visible result | Commit effect | Dismissal behavior | Persistence / reload standing |
| --- | --- | --- | --- | --- | --- | --- |
| Committed document | `MapSpike.tsx` document state; `MapDocument` and domain commands | Successful complete domain transaction | Read projections update | Replaces document once for the action | Cannot be rolled back by Close/Escape/outside | In-memory spike only; no external persistence/reload promise |
| Local property editor | Relevant `MapSpike.tsx` component state/ref | Activate editable heading/value | Embedded input/candidates/action controls | None until natural completion or complete selection | Cancel/Escape/outside discards unfinished local state; prior commits remain | Transient; remount/reload standing unspecified |
| Incomplete semantic operation | Editor mode or domain plan result (`unresolved`) | Select a leaf/action without required semantic context | Resolver, missing-choice prompt, or recoverable error | None | Nested Back/Cancel/Escape abandons incomplete operation | Transient only |
| Disclosure | owner-keyed expansion maps in `MapSpike.tsx` | Activate disclosure | Panel expands/collapses; expanded groups order first | None | Not an editor rollback; retained only as implemented for mounted/history owner | UI-only; no reload guarantee |
| Selection | workspace route state | Map/entity-link/workspace action | Selected entity Inspector/Map styling | None by itself | Replaced by deliberate selection/navigation | UI-only |
| Inspector history | `inspectorHistoryReducer` | Start, entity link, Back/Forward | Back/Forward availability and inspected target | None | Map round trip retains it when implemented and selection is unchanged | Session UI-only; invalid entities skipped |
| Map selection | Map workspace owner | Canvas selection/reselection | Map target and Inspector root association | None | Reselection establishes a new history root | UI-only |
| Focus | browser + mounted control refs | Keyboard/pointer entry, editor/dialog open | Visible focus on current owner | None | Explicit Close/Escape may restore; outside/switch deliberately does not steal focus | Never document state |
| Confirmation | confirmation state/dialog in `MapSpike.tsx` | Owner reports destructive impact | Modal exact impact and Cancel/Confirm | Confirm performs one transaction; Cancel none | Escape/Cancel closes without mutation | Transient only |
| Validation/error/status | local editor or global message state | Validation/domain failure or success | `role=alert`/`role=status` feedback | Failure none; status describes prior commit | Error remains recoverable; no silent retry | Transient; no sync/save meaning |
| Measured presentation | `usePackedPanelLayout` | mount, panel/container resize/content change | Packed transforms and explicit container height, or Grid fallback | None | Recalculates or falls back; no authored effect | Recomputed, never persisted |
| Neighborhood type selection | `NeighborhoodGroups`, isolated by inspected owner | Native type-checkbox toggle or Reset | Empty means unfiltered; otherwise matching uses selected IDs with OR semantics | None | Toggle adds/removes one type; Reset clears all; unavailable types are pruned | Transient; not stored in document, history, URL, or entity-specific parents |
| Neighborhood focus mode | `NeighborhoodGroups`, isolated by inspected owner | Choose Dim or Hide | Dim retains all cards and de-emphasizes nonmatches; Hide renders matching cards only | None | Mode persists while that owner is mounted; owner change synchronously shows Dim default | Transient; not stored in document, history, URL, or entity-specific parents |

## Commit contract

Semantic completeness is the boundary: **one complete owner-level action → one domain transaction**.

- Complete valid non-destructive relation/control actions commit immediately. Multi-select commits each toggle; single-select commits its complete choice and closes. Title and property text use natural completion (for example Enter/blur where implemented); Escape cancels the incomplete edit.
- Incomplete, ambiguous, invalid, cancelled, or failed operations do not mutate `MapDocument`. Keep the editor recoverable and request only missing context; never infer ontology or contributor identity.
- A destructive change follows impact derivation → exact review → explicit confirmation → one commit. Cancel leaves committed data unchanged. There is no silent retry.
- Close, Escape and pointer-outside dismiss transient state. They are not rollback for already completed local commits. “Apply”, “Save”, “Done”, “saved”, or “synced” must not imply durability that the spike does not have.
- Product/Offer whole-section Apply remains legacy behavior scheduled for replacement. Do not use it as an example for new work.

The owner chain is `MapSpike.tsx` gesture/state → a focused helper in `touchpoint-edit.ts` where present → one framework-independent operation in `@vee/domain` → fresh read/derived projection. UI handlers must not synthesize direct edges that the domain owner does not authorize.

## Navigation and focus

- `navigateInspector()` pushes entity navigation through `inspectorHistoryReducer`; `traverseInspectorHistory()` skips missing entities. Inspector Back/Forward are distinct from browser history, future Undo, and nested editor Back.
- Map reselection starts a history root. The implemented Inspector → Map → Inspector round trip preserves history when Map selection did not change. Linked entity titles navigate internally; safe URLs navigate externally.
- Dirty/impact guards apply only where implemented (notably legacy Product/Offer draft navigation and pending impact confirmation). Do not claim a universal unsaved-changes guard for immediate-commit Touchpoint editors.
- Opening an editor deliberately focuses its first relevant search/candidate/input. Explicit Close and Escape restore focus to the still-mounted/remounted heading action where appropriate. Pointer-outside dismissal and switching editors must not steal focus back from the new pointer/focus owner.
- Candidate rows support native keyboard activation and one primary selection hit area. They must not contain competing entity navigation while local editing is active.
- Escape is progressive: close the deepest resolver/confirmation/nested mode first, then its editor, then any outer transient surface. Nested Back returns one editor level; Inspector Back traverses entities.
- Neighborhood type checkboxes, Reset, and the single-choice Dim/Hide controls are native keyboard controls with visible focus. Before a checkbox, Reset, or Hide mode action could remove the currently focused card subtree, focus moves synchronously to the initiating control (or the stable controls container); focus is never left on detached content. Dim never changes card accessibility or tab order. Neighbor links continue through `navigateInspector()`, and the newly inspected owner synchronously receives empty selection and Dim.

Neighborhood focus and concrete-ground disclosure are independent: selection/mode transitions never toggle disclosure, and Hide → Dim or Reset remounts previously hidden grounds with their existing disclosure state. All focus actions are presentation-only and cause no `MapDocument` transaction, Inspector-history entry, URL mutation, or entity-specific parent state update.

Optional rich Neighborhood content is read-only and remains subordinate to the same disclosure. Its basis and neighbor links use ordinary `navigateInspector()` history navigation; the disclosure button contains no nested basis or neighbor controls. Rich content does not acquire separate disclosure, focus, filtering, card, or layout state. Disclosure and focus/filter actions, basis navigation, neighbor navigation, and reading outcome comparisons never mutate `MapDocument`; navigation changes only transient Inspector/history state under the existing rules.

Current tests cover many focus transitions but do not prove every tab sequence, focus trap, screen reader announcement, external navigation, or browser geometry. Those remain manual browser/accessibility checks.

## Relation and structural editing

Portable interaction grammar:

1. An editable property heading opens a local embedded editor, separate from value navigation.
2. Multi-select stays open until explicit Close or dismissal; every complete toggle is already committed.
3. Single-select closes after a complete selection. Optional Clear is an explicit local action, never a fake candidate; mandatory relations omit it.
4. Search appears only for sufficient candidate space. `RELATION_EDITOR_SEARCH_THRESHOLD = 7` is the current reference, not universal ontology.
5. Close preserves committed selections. Cancel/Escape may abandon only unfinished work.
6. Reassignment/removal uses owner-aware impact planning and confirmation where destructive.

Touchpoint meaning is not portable: Offers are multi-select structural presentation relations; Parent is optional single-select; Children attach/detach/reassign/create use dedicated commands and may require ancestor contributor resolution. `deriveTouchpointChildrenCandidates`, `deriveTouchpointReassignTargets`, `commitTouchpointParent`, and `planTouchpointStructuralChange` own those semantics. A generic radio/checkbox does not authorize generic setters, direct edges, containment, or candidate eligibility.

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

**Reuse:** document frame; semantic visual language; heading edit affordance; entity-link treatment; local embedded editors; semantic-completeness commits; dismissal/focus grammar; disclosure state model; adaptive/packed mechanisms; navigation/history; validation and confirmation boundaries.

**Do not copy literally:** Product → Offer → Touchpoint structure; Offers, Located in, Parent or Children; Touchpoint containment/reassignment; six Client Scope kinds as universal sections; contributor propagation; Resistance relevance/mitigation; specific empty states, counts or labels; Touchpoint-specific eligibility and domain operations.

A future Inspector first defines its ontology-owned properties, relationships, complete operations, destructive impacts and derived projections, then applies the common contracts.

## Maintenance and evidence rule

An accepted common-pattern change updates together: (1) the relevant contract, (2) the shared implementation owner, (3) regressions for the Touchpoint reference, and (4) regressions for other affected Inspector kinds. An entity-specific exception requires an ontology rationale. A low current card count is not grounds for a separate width/disclosure or state model.

Screenshots do not establish interaction semantics or geometry. Combine browser walkthroughs with pure domain/layout regressions and DOM/accessibility-semantic tests. Label uncertainty as current implementation not yet accepted, browser-only observation, missing regression guard, unresolved product/ontology question, or legacy behavior scheduled for replacement. Do not infer persistence, reload, undo, finalized viewport support, finalized ontology, or accessibility guarantees from this contract.
