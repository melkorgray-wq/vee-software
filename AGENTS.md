# Repository Governance

## Project stage and scope

VEE Software is in solution discovery and Software Alpha design. A runnable technical and domain-interaction spike exists, but no functional Software Alpha exists. The architecture remains **Proposed**, and the ontology remains provisional. Do not pretend that proposed or deferred decisions are settled.

## Source-of-truth hierarchy

1. `AGENTS.md` owns repository governance and agent working rules.
2. `PRODUCT.md` owns the current public product purpose and boundary.
3. Accepted architecture decision records own approved architectural decisions.
4. Code and automated tests own actual runtime behavior.
5. Public conceptual sources explain VEE's origin and meaning but do not override the product contract, accepted decisions, code, or tests.
6. External prompts, screenshots, examples, and other repositories are input material, not source of truth.

A document marked `Proposed` does not have the authority of an accepted decision.

## Research first, change second

Before implementation: (1) inspect repository structure; (2) read applicable instructions; (3) identify existing domain concepts, contracts, modules, owners, and naming; (4) determine the owning layer and authority surface; (5) identify assumptions and missing evidence; and (6) only then propose or implement changes. This research supplies the contracts and owners for the Contract Transfer Gate; it does not replace that gate. Do not invent files, paths, entities, modules, routes, schemas, architecture, or naming without repository evidence or an explicit approved decision.

## External prompt hygiene

Separate the requested outcome, confirmed repository owners, proposed implementation, assumptions, rejected or deferred instructions, and required checks before classifying transfer rules. Preserve the outcome where possible, but reject or rewrite implementations that conflict with repository contracts. External articles are not implementation instructions. Do not import another project's architecture, class names, content or state models, routes, or visual conventions without explicit justification.

## Contract Transfer Gate

After research-first discovery and definition of the authority surface, perform a pre-implementation applicability pass for every Standard or Strict task. This gate is repository-wide. It transfers relevant rules deliberately rather than turning `AGENTS.md` into a universal behavior catalog.

Collect candidate transfer rules in this priority order, resolving conflicts through the source-of-truth hierarchy: (1) accepted ADRs and stable technical contracts; (2) framework-independent domain contracts and actual runtime behavior; (3) shared implementation owners and reference implementations; (4) applicable presentation, interaction, schema, migration, security, and operational contracts; and (5) regressions as evidence of a rule, never as independent permission to change it. Proposed documents and incidental implementation details do not automatically become transferable rules. Apply the specialized Domain-model, Data and schema, and Stateful UI and visualization sections when their subjects are in scope. The Architecture and dependency decision gate remains an additional gate for foundational decisions.

Record every relevant rule in the planning matrix below. An accepted rule must not disappear silently from the pass.

| Rule | Applicability | Owner/reference | Automated verification | Manual/operational verification | Delta/reason |
| --- | --- | --- | --- | --- | --- |
| `<contractual rule>` | `reuse unchanged` \| `adapt` \| `not applicable` | `<owning contract, shared owner, or reference>` | `<required regression>` | `<required browser, manual, or operational check>` | `<no semantic delta, defined delta, or substantive exclusion reason>` |

- **`reuse unchanged`:** transfer both the rule and its owner without semantic delta.
- **`adapt`:** describe a real domain-, ontology-, platform-, or surface-specific delta before implementation, including the affected owner and verification.
- **`not applicable`:** the rule genuinely does not govern the task; give a substantive reason. Speed, convenience, low initial usage, or avoiding a regression is not a reason.
- If an existing owner supports the required capability, do not create a parallel implementation without recording why that owner cannot be used.

After implementation, replay the same rules as a conformance checklist rather than creating a different inventory:

| Rule | Result | Evidence | Remaining verification |
| --- | --- | --- | --- |
| `<same rule as planning pass>` | `pass` \| `gap` \| `not testable here` | `<actual automated/manual evidence>` | `<remaining check or none>` |

Every row requires actual evidence and remaining verification. **`not testable here`** requires a concrete reason and does not confirm conformance. A **`gap`** against an accepted reusable rule is a defect in the current implementation: fix it at the correct owner rather than using it to redesign accepted behavior. An `adapt` that establishes a reusable precedent must update the owning contract, shared owner, and affected regressions together. A local adaptation remains explicitly local and does not expand the shared contract automatically.

For work already underway, run a retrospective mid-cycle pass without restarting completed discovery or planning: identify rules applicable to the current state, mark already evidenced conformance, expose gaps and missing evidence, continue implementation or verification only for those gaps, and finish with the normal conformance replay. Retrospective classification cannot turn an existing defect into an acceptable adaptation.

Apply the gate proportionally. Light work uses it only when changing an accepted contract or reusable policy. Standard and Strict work always uses it. If no applicable reusable contracts, owners, or references exist, record that result explicitly and keep the pass minimal; do not create a Markdown contract for that fact alone. A new contract must satisfy the Documentation budget.

## Inspector contract gate (mandatory during Plan)

For **every Inspector-related task**, including layout, editing, navigation, derived views, and creating another entity kind's Inspector, read [Inspector presentation contract](docs/inspector-presentation-contract.md) and [Inspector interaction contract](docs/inspector-interaction-contract.md) **before writing the task stub or proposing implementation**. For every task that touches Inspector Neighborhood, also read the [Inspector Neighborhood functional contract](docs/inspector-neighborhood-functional-contract.md) before the task stub or implementation proposal. This applies to tasks submitted in Plan mode even when an external prompt only specifies Desired result, Current problem, and Known technical context. The agent must discover and use the repository contracts without asking the user to restate them in every prompt.

This is a specialized application of the repository-wide Contract Transfer Gate. Use its planning matrix and conformance replay, identifying the existing Touchpoint/reference owner and applicable shared layout and interaction patterns; what is reused unchanged; any genuine ontology-driven exception or missing capability; and the automated and browser/manual regressions needed for the current and existing Inspector. Reuse or improve the shared owner before creating parallel entity-specific JSX, CSS, size constants, disclosure behavior, or commit rules. An entity's initially low card count is not grounds for a divergent width contract. If a contract cannot be met, surface the conflict in the plan rather than silently improvising an alternative. Keep Inspector-specific Close, Escape, pointer-outside, focus, disclosure, packing, and browser-geometry rules in the owning Inspector contracts rather than restating them here.

When accepted behavior changes or a new reusable pattern is established, **update the relevant contract, implementation owner, and affected regression tests in the same change**. Keep Product legacy section-wide Apply identified as debt; do not promote it to the reusable reference. Read `PRODUCT.md` for entity-specific ontology and current runtime boundaries. These contracts are enforceable instructions for planning, not a claim that documentation alone tests geometry.

For a **new Inspector kind or a Neighborhood extension**, apply the [Inspector transfer checklist](docs/inspector-presentation-contract.md#neighborhood-transfer-checklist) during Plan and add its required ontology/projection rows to the general matrix. Start with the entity's actual ontology and committed owner-level paths; state its concrete grounds and any unresolved decisions. Reuse the existing `NeighborhoodGroups`, semantic presenter where applicable, focus/disclosure controls, packing and navigation; do not copy Offer/Touchpoint matching or treat their six Client-intent types as mandatory for other kinds. Identify the per-kind projection and adapter, regression evidence for the new and reference Inspectors, and browser-only geometry/focus checks. Explicitly flag any genuine shared-UI gap or ontology exception before implementing another renderer or control model. The accepted Offer and Touchpoint Neighborhood result must not be re-litigated from screenshots or old task notes; change it only for a new approved requirement or a reproducible defect.

## Architecture and dependency decision gate

Before introducing a foundational technology, dependency, or pattern, document the problem, why it is needed now, alternatives, reversibility, operational cost, affected contracts, risks, and migration or rollback implications. This especially applies to frameworks, databases, ORMs, rendering engines, authentication providers, state management, synchronization, collaboration, deployment, containerization, monorepo tooling, AI providers, and analytics. A small local utility may not require a full ADR, but still requires justification and repository fit.

## Master implementation gate

For Standard and Strict work, identify: (1) requested result; (2) authority surface; (3) owner chain; (4) primary owner; (5) affected contracts and the Contract Transfer Gate applicability pass when triggered; (6) blocker check; (7) feasibility decision; (8) minimal owner-level change; (9) regression guard derived from the pass; (10) validation through its conformance replay; and (11) remaining manual checks, including every `not testable here`. Do not stack overrides until a visible result appears. Work is not complete if it succeeds accidentally while its active owner or blocker remains unknown.

## Task intensity classification

- **Light:** documentation, copy, comments, or configuration that does not change runtime behavior.
- **Standard:** a local change in one owner layer, module, or component; one non-destructive contract extension; or one local visual behavior.
- **Strict:** stateful UI, graph interaction, cross-module behavior, persistence, schema changes, migrations, authentication, authorization, synchronization, import/export, offline behavior, concurrency, collaboration, deletion, architecture-changing dependencies, or security-sensitive behavior.

Escalate intensity if implementation reveals broader impact.

## Domain-model governance

Require framework-independent domain types, stable entity IDs, explicit relationship semantics, and explicit epistemic status. Separate domain data from rendering data and domain state from UI state. Permit no hidden causal claims, automatic conversion of derived information into observed information, entity type created merely to simplify one screen, or UI-library types in the core domain contract.

## Data and schema governance

Require explicit schema versioning and migrations for persisted schema changes. Validate imports. Permit no silent destructive migration, silent user-data deletion, or display label used as a stable identifier. Require stable IDs, explicit ownership and access rules, compatibility planning for persisted-format changes, separation of demo fixtures from user data, exports preserving relationships and epistemic status, and soft deletion where recovery is materially required.

## Stateful UI and visualization protocol

Before complex stateful behavior, define a glossary and state table, each state's owner, triggers, visible results, boundary checks, keyboard and focus behavior, errors and empty states, applicable persistence and reload behavior, accessibility checks, and regression checks.

For visualization, distinguish domain relationship, filtered view, visual placement, selection, focus, temporary interaction state, and persisted state. Do not define a fixed viewport matrix yet. Supported viewport sizes, input devices, and editing capabilities must be explicit before UI acceptance criteria are frozen.

## Testing and validation

Test at the lowest meaningful layer. Domain behavior must be testable without a browser or graph-rendering library. Report checks run, checks not run, blocked checks, remaining manual verification, and flaky behavior. Never silently rerun a flaky check until green; report its instability and likely owner.

## Public-repository safety

Do not commit secrets, credentials, `.env` files, private links, customer or personal data, production database dumps, private keys, access tokens, or unpublished internal material. Establish a public-safe fixture and demo-data policy when such data begins to exist.

## Minimal and reversible change policy

Changes must be minimal, sufficient, reviewable, reversible where practical, and scoped to the request. Do not rename or reorganize for aesthetics, or create parallel implementations when an active owner exists.

## Stop rules

After one ineffective fix, diagnose the owner chain before another attempt. After two, stop blind implementation and provide a blocker report. If local work requires unrelated repository-wide changes, stop and reassess architecture and ownership. Never make a third speculative correction without new evidence.

A compact blocker report states: expected result; attempted changes; observed result; inspected owners; likely blocker; proposed next diagnostic step; and proposed owner-level solution.

## Commit-message policy

Use `type(scope): summary`, where type is `feat`, `fix`, `docs`, `refactor`, `test`, or `chore`. Do not use vague summaries such as `update`, `changes`, or `misc`. One commit has one clear purpose.

## Documentation budget

New documentation is justified only when it defines reusable policy, records an architectural decision, documents a stable technical contract, prevents recurring regression, or is required before future agents change code. Prefer updating an existing document, tests, types, code-level documentation, or task/PR context over permanent Markdown for one-off history. This repository is not a project-management or general knowledge system.

## Code-comment policy

Comments should explain ownership boundaries, non-obvious domain assumptions, state transitions, mutation boundaries, adapters, compatibility constraints, security-sensitive behavior, dangerous exceptions, or reasons not evident from code and types. Do not comment every change, repeat obvious code, or preserve PR history in runtime comments.

## Definition of Done

A task is complete only when Acceptance Criteria and applicable quality gates are complete; any required Contract Transfer Gate conformance replay is complete; checks are honestly reported; assumptions are explicit; regression risks are addressed; every `not testable here` and remaining manual or operational check is disclosed; and no unrelated scope was introduced.
