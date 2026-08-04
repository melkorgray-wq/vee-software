# ADR 0001: Platform Architecture

Status: Proposed
Date: 2026-08-04

## Context

The public [Value Exchange Ecosystem background](https://thequietorbit.com/value-exchange-ecosystem/) provides the conceptual origin of VEE. The narrower Alpha product contract requires mapping entities, repeated interactions, context, and exchanges while keeping observation separate from causal proof. Technology is not derived from the article's metaphors or scientific analogies.

The product requires browser access first, future desktop and mobile clients, a shared domain model and backend, explicit persistence, and separation between domain meaning and visualization.

## Decision

Propose a TypeScript, pnpm-workspace architecture with shared framework-independent packages, explicit HTTP contracts, platform-appropriate clients, and PostgreSQL persistence. This is not accepted yet: it must be tested against an initial domain model and interaction prototype before acceptance.

## Validation status

The executable technical spike validates pnpm workspace operation; the Node.js and TypeScript toolchain; the React and Vite build; TanStack Router integration; TanStack Query API access; read-only React Flow rendering; a Fastify API; OpenAPI generation; shared transport-contract consumption; and automated quality gates.

It does not validate the VEE domain model, editing interactions, persistence, PostgreSQL, Drizzle, Supabase, authentication or authorization, Tauri, Expo or React Native, offline behavior, realtime collaboration, deployment, production performance, or accessibility of a real graph editor. This limited tooling evidence is not sufficient to accept this ADR.

## Platform trajectory

Begin with a browser application. Later support Windows, macOS, and Linux desktop clients and Android and iOS mobile clients. All clients share identity, persisted data, domain and validation rules, API and permission contracts, import/export semantics, and schema versions. Shared contracts do not require identical interfaces or full mobile graph-editor parity.

## Selected technologies

- Language and workspace: TypeScript and pnpm workspaces.
- Web: React, Vite, TanStack Router, TanStack Query, and React Flow.
- Desktop: Tauri 2 and the shared React/Vite frontend where appropriate.
- Mobile: Expo, React Native, and Expo Router.
- Backend: Node.js, TypeScript, Fastify, a versioned HTTP API, and OpenAPI.
- Persistence: PostgreSQL and Drizzle ORM, with Supabase initially providing managed PostgreSQL, authentication, and file storage.
- Testing: Vitest for domain/unit tests and Playwright for browser end-to-end tests; mobile tools remain unselected.

## Shared architecture

The repository is expected to evolve into a workspace separating applications from packages for the VEE domain, domain commands and operations, validation, API contracts, API-client behavior, design tokens, and reusable test fixtures. This is a responsibility model, not an irreversible directory tree.

The domain package must run without React, React Flow, Tauri, Expo, Supabase, PostgreSQL, or a browser. Contracts and validation are shared across clients; tokens and fixtures are shared where appropriate.

## Platform-specific architecture

Web uses React and Vite. React Flow is only a rendering and interaction adapter; it does not own ontology, persistence, relationship meaning, epistemic status, validation, permissions, or interchange contracts.

Desktop uses Tauri with the web frontend where appropriate. Rust is limited initially to justified native or performance needs such as filesystem and OS integration, menus, local-storage integration, background work, or measured critical operations; domain logic does not move to Rust by default.

Mobile uses Expo and React Native with device-appropriate interaction. A future graph surface could be embedded web content, dedicated native UI, or a hybrid; no option is selected. Mobile can share domain, validation, contracts, API client, and practical design tokens without duplicating the complete desktop editor.

## Data and API boundaries

Every client uses an explicit, versioned HTTP API described with OpenAPI rather than framework-internal server actions. PostgreSQL stores explicit entities and typed relationships through Drizzle; a graph-shaped interface alone does not justify a graph database.

Supabase is managed infrastructure, not the domain owner. Domain rules and API contracts remain independent of provider-specific client behavior where practical. Entities, relationships, epistemic status, views, and placements are separate concepts. A domain entity can have different placements in different views; React Flow node/edge arrays are not the persisted product model.

## Alternatives considered

- **Next.js as unified frontend/backend:** productive for some products, but its server conventions could blur the explicit cross-client API boundary needed here.
- **Expo Universal as the primary web/mobile base:** promising reuse, but the desktop-scale graph interaction and web library fit must be proven before choosing it as the web foundation.
- **Wrap the unchanged web app for all mobile workflows:** maximizes reuse but may produce unsuitable touch, navigation, capture, and accessibility behavior.
- **Graph database initially:** graph queries may later justify one, but Alpha has not shown requirements beyond explicit entities and typed relationships that PostgreSQL can serve.
- **Electron instead of Tauri:** mature and capable, but Tauri is proposed for a smaller native shell; actual capability and operational costs require validation.
- **Realtime collaboration initially:** valuable if required, but introduces synchronization, concurrency, and conflict semantics before core mapping is proven.
- **Separate repository per client:** reduces workspace coupling but duplicates contracts and makes consistent schema/version changes harder at this stage.
- **Persist React Flow structures:** expedient for a prototype, but couples domain meaning to one renderer and confuses placements with entities.

These alternatives are not universally wrong; they are not currently selected for this product stage.

## Positive consequences

- Shared domain rules and contracts can remain consistent across clients.
- Explicit API and persistence boundaries support non-web clients.
- Rendering can evolve without silently changing domain meaning.
- PostgreSQL and managed infrastructure can support early delivery without premature graph-database operations.
- Platform-appropriate mobile experiences remain possible.

## Negative consequences

- A monorepo/workspace and shared-package release graph add complexity.
- Multiple clients increase implementation and testing effort.
- React web and React Native may duplicate UI behavior.
- An explicit API needs ongoing versioning and maintenance.
- Tauri introduces Rust toolchain and platform operational cost.
- Supabase creates managed-provider dependency even with boundary controls.
- Future offline or realtime support will add synchronization complexity.

## Risks

- Prematurely fixing the ontology before discovery supplies evidence.
- Coupling the domain to React Flow or visual placement.
- Overbuilding desktop and mobile before browser Alpha proves value.
- Allowing Supabase constraints to shape domain meaning.
- Divergent client behavior or contracts.
- Underestimating native build, distribution, API, and future synchronization costs.

## Deferred decisions

- Exact workspace structure and API schemas.
- Authentication flows and authorization model.
- Database table definitions.
- Hosting and deployment.
- Mobile graph implementation.
- Offline architecture, realtime collaboration, and conflict resolution.
- Desktop auto-update and app-store distribution.
- Observability and analytics.
- Billing and AI integration.
- License selection.

Deferred does not mean rejected.

## Revision triggers

Revisit this proposal if the prototype shows React Flow cannot support required interaction; mobile graph editing becomes primary; offline operation becomes mandatory; graph queries exceed practical PostgreSQL capabilities; realtime collaboration becomes an Alpha or Beta requirement; Tauri cannot provide a required platform capability; Supabase-specific constraints begin shaping the domain model; or the domain can no longer remain framework-independent.
