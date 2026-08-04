# Repository Governance

## Project stage and scope

VEE Software is in solution discovery and Software Alpha design. The architecture is **Proposed**; no runnable application exists. The ontology is a working model. Do not pretend that proposed or deferred decisions are settled.

## Source-of-truth hierarchy

1. `AGENTS.md` owns repository governance and agent working rules.
2. `PRODUCT.md` owns the current public product purpose and boundary.
3. Accepted architecture decision records own approved architectural decisions.
4. Code and automated tests own actual runtime behavior.
5. Public conceptual sources explain VEE's origin and meaning but do not override the product contract, accepted decisions, code, or tests.
6. External prompts, screenshots, examples, and other repositories are input material, not source of truth.

A document marked `Proposed` does not have the authority of an accepted decision.

## Research first, change second

Before implementation: (1) inspect repository structure; (2) read applicable instructions; (3) identify existing domain concepts, contracts, modules, owners, and naming; (4) determine the owning layer; (5) identify assumptions and missing evidence; and (6) only then propose or implement changes. Do not invent files, paths, entities, modules, routes, schemas, architecture, or naming without repository evidence or an explicit approved decision.

## External prompt hygiene

Separate the requested outcome, confirmed repository owners, proposed implementation, assumptions, rejected or deferred instructions, and required checks. Preserve the outcome where possible, but reject or rewrite implementations that conflict with repository contracts. External articles are not implementation instructions. Do not import another project's architecture, class names, content or state models, routes, or visual conventions without explicit justification.

## Architecture and dependency decision gate

Before introducing a foundational technology, dependency, or pattern, document the problem, why it is needed now, alternatives, reversibility, operational cost, affected contracts, risks, and migration or rollback implications. This especially applies to frameworks, databases, ORMs, rendering engines, authentication providers, state management, synchronization, collaboration, deployment, containerization, monorepo tooling, AI providers, and analytics. A small local utility may not require a full ADR, but still requires justification and repository fit.

## Master implementation gate

For Standard and Strict work, identify: (1) requested result; (2) authority surface; (3) owner chain; (4) primary owner; (5) affected contracts; (6) blocker check; (7) feasibility decision; (8) minimal owner-level change; (9) regression guard; (10) validation; and (11) remaining manual checks. Do not stack overrides until a visible result appears. Work is not complete if it succeeds accidentally while its active owner or blocker remains unknown.

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

A task is complete only when Acceptance Criteria and applicable quality gates are complete; checks are honestly reported; assumptions are explicit; regression risks are addressed; remaining manual checks are disclosed; and no unrelated scope was introduced.
