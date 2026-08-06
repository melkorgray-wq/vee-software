# VEE Software Product Contract

## Product purpose

VEE Software is intended to help people map a Value Exchange Ecosystem as a system of entities, interactions, context, and exchanges of value. It is a working environment for describing what is known while preserving where that knowledge came from and how certain it is.

## Public conceptual background

The [Value Exchange Ecosystem article](https://thequietorbit.com/value-exchange-ecosystem/) is the public conceptual origin and broader explanation of VEE. The current product boundary recognizes that customer context is subjective, that exchanges can involve repeated interactions rather than only a linear funnel, and that an ecosystem can be mapped without claiming its causal mechanisms are proven.

That article is conceptual background, not a software specification. This document defines the narrower current product boundary for Software Alpha. Its metaphors, analogies, and broader concepts do not automatically become features, entities, relationships, geometry, metrics, or a finalized ontology.

## Current stage

The project is in solution discovery and Software Alpha design. The repository contains a runnable in-memory domain and interaction spike, not a functional Alpha. It tests separation between entity, typed relationship, epistemic annotation, view, placement, rendering, and UI state. It does not validate the final ontology or implement persistence. The technical architecture remains **Proposed**, and the ontology is evolving.

## Software Alpha boundary

Alpha first maps the observed system. The model must preserve uncertainty and distinguish at least observed information, participant-reported information, business intent, hypothesis, interpretation, and confirmed outcome. These statuses are not interchangeable.

Alpha must not automatically:

- diagnose a business or recommend interventions;
- prove causality;
- claim that a Job was resolved or a customer advanced through a journey;
- claim that a touchpoint caused conversion; or
- treat business intent as evidence of an outcome.

Customer Journey and Jobs To Be Done may be descriptive lenses or metadata. They are not required permanent geometry or the only interpretation of customer behavior. Claims about effects require explicit evidence and an appropriate epistemic status.

## Current working concepts

The current provisional Business side chain is:

`Product — packaged as → Offer — presented at → Touchpoint`

It is a working model, not a fixed ontology:

- **Customer phenomenon:** the only currently exposed provisional Client side type. The complete Client side ontology remains open.
- **Touchpoint:** a concrete interaction surface. Its required **Located in** property names the Asset or environment containing it; Asset is not a graph entity.
- **Offer:** a business-side proposition presented for an exchange; intent associated with an offer is not outcome evidence.
- **Product:** the good, service, or experience involved in a potential or actual value exchange.
- **Relationship:** an explicit typed association between domain entities. Rendering one does not prove causality.
- **Epistemic status:** the kind or standing of a claim, including the minimum distinctions listed above.
- **View:** a selected perspective on domain information, potentially filtered or arranged for a purpose.
- **Placement:** view-specific visual information for an entity or relationship; it is not an intrinsic property of the entity.

Epistemic annotations remain separate knowledge-layer records for claims, evidence, provenance, and knowledge assertions. Creating an entity does not automatically create an epistemic annotation.

No comprehensive property schema is established here.

## Product layers

- The **domain model** owns entity and relationship meaning.
- The **knowledge layer** owns provenance and epistemic status.
- **Views** select and organize domain information without redefining it.
- **Rendering** presents a view; position, direction, size, color, proximity, hierarchy, elevation, or edges carry no unstated domain meaning.
- The **client interface** owns interaction and transient UI state.

Domain entities, relationships, statuses, views, placements, rendered representation, and UI state remain conceptually separate. An entity can appear in several views with different placements.

## Multi-client trajectory

Alpha is browser-first, not web-only. Future desktop clients are expected for Windows, macOS, and Linux, and future mobile clients for Android and iOS. Clients should share one backend and authentication identity, persisted data, domain model, validation, API contracts, permissions, import/export semantics, and schema versioning.

Web and desktop may share much of an interface. Mobile should use platform-appropriate interactions and may initially emphasize viewing, search, inspection, editing, evidence capture, quick input, comments, and notifications rather than complete desktop graph-editing parity.

## Deferred capabilities

The following are deferred, not rejected:

- automatic diagnosis and automatic causal claims;
- AI-generated recommendations and unrestricted AI generation of domain data;
- realtime collaborative editing;
- offline-first synchronization and conflict-resolution architecture;
- graph analytics;
- treating automated graph layouts as product semantics;
- 3D visualization;
- full mobile graph editing;
- billing and unrestricted public registration;
- final desktop packaging; and
- final mobile architecture.

## Open product questions

- What is the exact ontology, including the semantics of the client landscape and business-side dimension?
- Which relationship types and epistemic statuses are required?
- What editing permissions and collaboration capabilities are required?
- What offline behavior is required?
- Which viewport sizes, input devices, and editing capabilities are supported?
- Should mobile eventually support full graph editing?
- What evidence must accompany diagnostic or causal claims in later versions?
- How should broader ecosystem concepts in the public background map, if at all, to the narrower Alpha model?
