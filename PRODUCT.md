# VEE Software Product Contract

## Product purpose

VEE Software is intended to help people map a Value Exchange Ecosystem as a system of entities, relationships, context, and exchanges of value. It is a working environment for describing what is believed and what available support establishes while preserving source, uncertainty, and time.

## Public conceptual background

The [Value Exchange Ecosystem article](https://thequietorbit.com/value-exchange-ecosystem/) is the public conceptual origin and broader explanation of VEE. The current product boundary recognizes that client context is subjective, that exchanges can involve repeated interactions rather than only a linear funnel, and that an ecosystem can be mapped without claiming its causal mechanisms are proven.

That article is conceptual background, not a software specification. This document defines the narrower current product boundary and committed trajectory for Software Alpha. Its metaphors, analogies, and broader concepts do not automatically become features, entities, relationships, geometry, metrics, or a finalized ontology.

## Current stage and runtime

The project is in solution discovery and Software Alpha design. The repository contains a runnable in-memory domain and interaction spike, not a functional Alpha. It tests separation between entity, typed relationship, epistemic annotation, view, placement, rendering, and UI state. The runtime's Customer phenomenon is only a placeholder; it is not the intended Client-side ontology. The spike does not implement Client-side attraction or repulsion entities, Evidence, contextual support, Value Realization, persistence, derived forces, or 3D visualization.

The technical architecture remains **Proposed**, and the ontology remains provisional. Current runtime behavior, committed product direction, provisional ontology candidates, and open research questions must not be conflated.

## Software Alpha boundary

Alpha first maps the system as currently understood. It must preserve uncertainty and distinguish at least observed information, participant-reported information, business intent, hypothesis, interpretation, and confirmed outcome. These statuses are not interchangeable.

Alpha must not automatically:

- diagnose a business or recommend interventions;
- prove causality;
- claim that a Job was resolved or a client advanced through a journey;
- claim that a Touchpoint caused conversion; or
- treat business intent as evidence of an outcome.

Claims about effects require appropriate support and epistemic status. The future capabilities described below are product direction, not claims about the current implementation slice.

## Domain direction

### Business-side architecture

The established working structural chain is:

`Product — packaged as → Offer — presented at → Touchpoint`

Product, Offer, and Touchpoint form the Business-side architecture through which a business creates intended points of attraction:

- **Product:** the good, service, or experience involved in a potential or actual value exchange.
- **Offer:** a business proposition that packages Product and is presented for an exchange; its intent is not outcome evidence.
- **Touchpoint:** a concrete interaction surface at which an Offer is presented. Touchpoints may structurally contain Child Touchpoints, which remain full Touchpoints linked to at least one Offer. **Located in** references a reusable, user-extensible registry of infrastructure, environment, or media containers; those references are not graph entities. A Touchpoint may also carry an optional authored locator or URL, which is not its identity.

These types are attraction-oriented by what they already mean; there is no generic Attraction Point entity above them. A weak or ineffective Touchpoint remains a weak attraction point, not a repulsion point. Business-side repulsion points are not part of the product direction.

### Client-side attraction and repulsion

Client-side demand is expected to be represented through concrete client phenomena, not a separate Demand node. Jobs To Be Done entities or classifications are the primary current candidate for Client-side attraction semantics, including Core Functional Job, Emotional Job, Social Job, Consumption Chain Job, Desired Outcomes, and related concepts. It remains open which JTBD concepts become entity kinds and which become classifications or properties.

Client-side repulsion is also committed ontology direction. Candidate phenomena include objections, fears, risks, undesired states, negative prior experiences, counter-outcomes, and similar concepts. Their exact entity and relationship semantics remain provisional.

Attraction and repulsion are not necessarily a generic entity taxonomy. Product, Offer, and Touchpoint are intrinsically Business-side attraction-oriented; JTBD-style client Jobs are expected to carry Client-side attraction semantics; and Client-side objection, risk, or undesired-state entities may carry repulsion semantics. Whether contextual phenomena have intrinsic polarity or instead affect other forces through typed relationships is unresolved.

### Context / Actual Life Context

Actual Life Context is a contextual layer, not a single required mega-node. It can include client, business, market, social, economic, technological, legal, competitive, historical, and other conditions. Contextual factors may change the salience or strength of attraction and repulsion phenomena over time. The exact context ontology, including entity boundaries and relationship semantics, remains open.

### Knowledge and support

The product trajectory requires a knowledge layer capable of supporting entities, relationships, contextual factors, and eventually Value Realization. Shared support infrastructure must preserve provenance or source, uncertainty or confidence, and time. Quantitative and qualitative support may apply at any level; neither is prescribed for only one entity type.

Not all support has the same epistemic role:

- **Relational / behavioral evidence** primarily supports claims that interactions, relationships, usage, responses, outcomes, or value exchange occur.
- **Factual / contextual support** establishes externally observable environmental conditions such as market prices, regulation, macroeconomic conditions, or technology availability.

The system must eventually distinguish these roles while allowing them to share provenance, confidence, and time infrastructure. Whether **Proof**, factual contextual support, or another term and domain representation should name the second role remains an open ontology question. Creating a domain entity does not automatically create support or an epistemic annotation.

### Value Realization

Value Realization is a committed research direction, not a finalized entity or current runtime capability. The current candidate is the synthetic cross-side point where sufficient support establishes that one or more Products are actually realizing value relative to one or more Client-side Jobs or attraction points:

```text
Client-side Job(s) ──┐
                     ├── Value Realization
Product(s) ──────────┘
```

Its creation, confirmation, and cardinality rules remain open. Individual purchases, renewals, usage periods, client cases, interviews, measured outcomes, and similar observations may later support it; no Exchange Episode graph entity is required. This direction does not introduce a separate Demand entity.

### Buyer’s Journey

Buyer’s Journey remains a descriptive lens rather than mandatory topology. Awareness, Consideration, and Decision may later classify phenomena, filter views, or suggest possible relationships. They are not required graph nodes or geometry.

## Product and view architecture

The product trajectory must remain compatible with:

```text
domain graph
+ knowledge/support layer
+ derived analytical state
+ multiple views/renderers
```

The domain graph owns entity and relationship meaning. The knowledge layer owns support, provenance, and epistemic standing. Derived analytical state must remain distinguishable from observed or authored information. Views select and organize shared domain information, and renderers present those views without redefining it. Placement and coordinates belong to views or rendering state, never to Entity itself; rendering remains separate from domain meaning.

The **2D view** is an authored working map of what the user currently believes or understands exists. The future **3D view** is an evidence-derived, emergent analytical view of what available support says is actually interacting. Both use the same domain information rather than separate ontologies.

Authoring in 2D is map-first rather than form-first: contextual creation infers entity kind and canonical parent relationships already established by the selected node, while the Inspector remains the deep-editing surface. Duplication copies an entity's authored fields and applicable structural relationships, but never copies its epistemic annotations, Evidence, observations, or future analytical state. Circular node size may encode authored structural depth as a view-derived representation; it is not intrinsic domain meaning, evidence strength, popularity, or analytical force.

3D visualization is a committed future capability but remains outside the current implementation slice. Its direction is an emergent force-based view in which supported relationships can create attraction, repulsion semantics can resist or separate structures, and contextual factors can recalibrate the field. No fixed semantic meaning is assigned to a Z axis. Force formulas, explainability mechanics, rendering technology and dependencies, coordinates, interactions, pinning behavior, and renderer architecture remain unresolved implementation and research questions.

## Multi-client trajectory

Alpha is browser-first, not web-only. Future desktop clients are expected for Windows, macOS, and Linux, and future mobile clients for Android and iOS. Clients should share one backend and authentication identity, persisted data, domain model, validation, API contracts, permissions, import/export semantics, and schema versioning.

Web and desktop may share much of an interface. Mobile should use platform-appropriate interactions and may initially emphasize viewing, search, inspection, editing, support capture, quick input, comments, and notifications rather than complete desktop graph-editing parity.

## Outside the current implementation slice

The following remain outside the current implementation slice, without being rejected where identified as trajectory above:

- automatic diagnosis, automatic causal claims, and AI-generated recommendations;
- unrestricted AI generation of domain data;
- persistence, realtime collaborative editing, and offline-first synchronization;
- graph analytics and derived force calculation;
- 3D visualization and full mobile graph editing;
- billing and unrestricted public registration; and
- final desktop packaging and mobile architecture.

## Open product questions

- What is the exact Client-side JTBD ontology, including which concepts are entity kinds versus classifications or properties?
- Which types have intrinsic attraction or repulsion semantics, and where is explicit polarity needed?
- What is the exact Client-side Repulsion Point ontology, including its relationship semantics?
- What is the exact contextual / Actual Life Context ontology, and does context carry polarity or modify other forces?
- What distinction, terminology, and representation should separate relational / behavioral evidence from Proof / factual contextual support?
- How should support confidence, provenance, diversity, recency, repeatability, and aggregation work?
- Which cross-side relationship types and epistemic statuses are required?
- What are the creation and confirmation rules and cardinality for Value Realization?
- How should Buyer’s Journey classifications, filters, and suggested relationships be used?
- How should future emergent forces be calculated and explained without turning derived state into asserted fact?
- What future 3D rendering architecture, dependencies, and interaction model are appropriate?
- What editing permissions, collaboration, offline behavior, viewport support, input devices, and mobile editing capabilities are required?
