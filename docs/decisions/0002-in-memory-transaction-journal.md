# ADR 0002: In-memory Domain Transaction Journal

Status: Proposed
Date: 2026-08-31

## Context

The interaction spike applies framework-independent operations to a `MapDocument`, while `MapSpike` currently owns the live document and invokes `setDocument` from several independent commit paths. Some operations also derive placement changes in the web layer after a domain operation. Inspector drafts and other interaction state are deliberately separate from the durable in-memory document.

The requested behavior is one-step semantic undo: one undo must reverse the complete last successful owner-level operation rather than a checkbox change, intermediate draft, or arbitrary React state change. `Ctrl/Cmd+S` must have an honest session-local meaning because disk, server, crash-recovery, and collaboration persistence remain out of scope.

This is a foundational mutation-boundary decision. Adding history to one component callback now would miss other document writers and would make an incidental React snapshot collection appear to be domain history.

## Owner analysis and blocker

The confirmed owner chain is:

1. `packages/domain/src/index.ts` owns pure operations and validation that return a complete next `MapDocument`.
2. Web-layer orchestration owns operations that combine domain calls with authored placement policy.
3. `MapSpike` owns the current live `MapDocument` and contains the keyboard arbiter.

No single transaction entry point currently owns every successful document replacement. Direct `setDocument` calls occur in Inspector apply and semantic auto-commit, Map creation, duplication, title editing, movement, and other interaction paths. The minimum safe owner is therefore a session-local **document transaction coordinator** at the application boundary: above pure domain operations and placement orchestration, but below React controls and keyboard handling. Its API should accept a semantic operation that receives the current document and returns one complete next document, and should publish that result once.

Implementation is blocked on routing every durable writer through that coordinator and agreeing which high-frequency placement gestures constitute a completed semantic transaction. The proposal therefore defers runtime implementation rather than introducing incomplete component snapshot history.

## Proposed decision

Introduce no dependency. Add a small framework-independent transaction-history value and reducer, colocated with the domain package unless later client requirements demonstrate a separate shared application package is warranted. The journal stores document values, not commands, React state, renderer state, or inverse patches.

The application transaction coordinator would own this state:

- `present: MapDocument`;
- `past: MapDocument[]` ordered oldest to newest;
- `future: MapDocument[]` ordered by redo availability; and
- explicit capacity accounting once measured limits are selected.

`commit(operation)` evaluates the operation against `present`. A thrown or rejected operation retains all three collections exactly. A successful operation that returns a changed document appends the prior complete document once, publishes the next document once, and clears `future`. Incomplete UI state never calls `commit`. A no-op result creates no entry.

`undo()` moves the current document to `future` and restores the latest complete prior document. `redo()` moves the current document to `past` and restores the next document. Both operate only within the active in-memory document session. A workspace/document identity change selects a separate empty journal rather than making navigation itself undoable; reload discards all journals.

History contains authored placements because they are part of `MapDocument`. It excludes selection, focus, camera, active workspace view, menus, pending confirmation, validation errors, and incomplete Inspector drafts. After undo or redo, the UI keeps selection only if the selected stable entity ID exists in the restored document; otherwise it clears selection. Camera and active workspace view do not change.

The keyboard arbiter invokes application undo/redo only when the event target is not an editable or keyboard-owned control. Native input, textarea, select, and contenteditable history therefore remains owned by the platform. The proposed shortcuts are `Ctrl/Cmd+Z` for undo and `Ctrl/Cmd+Shift+Z` for redo; `Ctrl+Y` requires a later platform-support decision.

`Ctrl/Cmd+S` is not a storage operation. It may submit the active complete and valid staged owner operation through the same transaction coordinator. With no eligible staged operation it reports “Changes are already live in this session.” Incomplete or invalid drafts retain their validation state. No UI copy may say saved, synced, uploaded, persisted, or backed up unless an external durability owner is later implemented.

## Atomicity and affected contracts

The transaction boundary is the complete `MapDocument` returned by one semantic operation, including any placement reconsideration belonging to that operation. Multi-entity birth, cascade removal, and bottom-up intent completion each create one history entry. A drag or keyboard move should create one entry when the gesture/move mode completes, not one per pointer or key-repeat update; this gesture-finalization rule must be resolved before implementation.

Affected contracts are the domain operation call boundary, web document ownership, post-domain placement orchestration, Inspector semantic-commit policy, Map gesture completion, keyboard arbitration, selection reconciliation, save/status messaging, and workspace/document switching. Persistence and transport contracts are unchanged.

## Alternatives considered

### Command objects with hand-written inverse operations

This can be memory-efficient and could support audit metadata, but every evolving atomic operation needs a correct inverse across cascades and placement changes. It increases implementation and regression cost during ontology discovery and risks partial restoration. It is deferred, not rejected, for a future persisted or collaborative command architecture.

### Structural patches and inverse patches

Patches can reduce memory and transmit changes later, but selecting a patch library or defining a patch protocol adds a foundational dependency or contract before measured need. Patch correctness across schema evolution and stable identity also needs migration rules. This remains a migration option if full documents exceed the measured budget.

### Component snapshots around selected callbacks

This is locally easy but has no complete writer ownership, conflates React lifecycle with semantic operations, and can omit web-layer placement or multi-step orchestration. It is rejected.

### Arbitrary React state time travel

This could restore UI state as well as the document, but would capture drafts, focus, menus, and camera state with unclear semantics and poor native-control behavior. It is rejected.

### No redo

This minimizes state, but makes accidental undo irreversible within the session and provides little memory saving when a user has not undone anything. Redo is included in the proposal, while platform aliases remain open.

## Memory and operational cost

Full immutable document values are the simplest auditable representation and preserve exact record invariants. Because operations already return copied arrays with structurally shared unchanged records, retained memory is expected to be lower than serializing every full document, but that is an inference and must be measured with representative maps.

Both an entry-count limit and an approximate retained-byte budget are required before runtime acceptance so a single large transaction cannot bypass an entry-only cap. Eviction removes the oldest past entries; it never mutates `present`. Exact limits are deliberately not invented in this proposal. Runtime work must add representative memory measurements and document the chosen limits and user-visible exhaustion behavior.

Operational cost is a journal reducer, one application mutation gateway, writer migration, shortcut/focus rules, selection reconciliation, and focused tests. There is no network, storage, schema, migration, or new-package operational cost in the proposed first implementation.

## Reversibility, migration, and rollback

The proposal is reversible because `MapDocument` and every existing pure operation remain unchanged. The coordinator can be removed and callers can publish operation results directly again. No persisted format or API migration is involved.

If later measurement requires patches, the coordinator API can remain stable while the internal history representation changes. If persisted version history or collaboration arrives, session-local undo must not be silently reinterpreted as server history: transaction metadata, conflict semantics, authorization, schema versioning, and migration would require a new accepted decision. A temporary rollback may disable shortcuts and history while retaining the centralized coordinator as the single document-write boundary.

## Risks

- Missing even one direct document writer would make undo incomplete or incorrectly ordered.
- Recording pointer/key-repeat updates individually could exhaust history and violate semantic transaction boundaries.
- Long sessions or large maps could retain excessive memory without measured dual limits.
- Restoring a document while retaining an invalid selection could leave UI references dangling.
- Save wording could imply durability that the runtime does not provide.
- A future persisted/collaborative model may need command metadata not present in document snapshots.

## Required regression guards before acceptance

Implementation must add exact-record tests named for these contracts:

- `undo restores the complete prior document`;
- `one semantic auto-commit creates one undo entry`;
- `incomplete UI state creates no entry`;
- `undo does not intercept native text editing`; and
- `save messaging never claims external persistence`.

Tests must compare complete records and relationships rather than rely on snapshots alone. Domain history behavior must run without React or a renderer. Web tests must cover the mutation gateway, native-control arbitration, selection clearing/preservation, one-entry gesture completion, save messaging, and workspace/document switches.

## Validation and implementation gate

This ADR records discovery only. Before changing runtime behavior:

1. review and accept or revise this decision;
2. enumerate every current `MapDocument` writer and define its semantic transaction boundary;
3. resolve drag and repeated keyboard-move finalization;
4. measure representative retained memory and select both limits;
5. centralize writers without changing behavior;
6. add the regression guards; and
7. run domain tests, focused web interaction tests, web typecheck, workspace lint, and the listed manual browser checks.

## Manual checks remaining

No browser behavior changes in this design-only slice. A future implementation still requires native input undo, Inspector and Map domain undo, keyboard-layout and platform-modifier behavior, save messaging, and workspace/document-switch checks.
