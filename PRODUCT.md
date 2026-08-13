# VEE Software Product Contract

## Product purpose

VEE Software is intended to help people map a Value Exchange Ecosystem as a system of entities, relationships, context, and exchanges of value. It is a working environment for describing what is believed and what available support establishes while preserving source, uncertainty, and time.

## Public conceptual background

The [Value Exchange Ecosystem article](https://thequietorbit.com/value-exchange-ecosystem/) is the public conceptual origin and broader explanation of VEE. The current product boundary recognizes that client context is subjective, that exchanges can involve repeated interactions rather than only a linear funnel, and that an ecosystem can be mapped without claiming its causal mechanisms are proven.

That article is conceptual background, not a software specification. This document defines the narrower current product boundary and committed trajectory for Software Alpha. Its metaphors, analogies, and broader concepts do not automatically become features, entities, relationships, geometry, metrics, or a finalized ontology.

## Current stage and runtime

The project is in solution discovery and Software Alpha design. The repository contains a runnable in-memory domain and interaction spike, not a functional Alpha. It tests separation between entity, typed relationship, epistemic annotation, view, placement, rendering, and UI state. The runtime's Customer phenomenon is only a placeholder; it is not the intended Client-side ontology. The spike does not implement Client-side attraction or repulsion entities, Evidence, contextual support, Value Realization, persistence, derived forces, or 3D visualization.

The technical architecture remains **Proposed**. The conceptual ontology below is accepted product direction for the next Alpha slice, while its implementation schema and the specifically identified relationship mechanics remain provisional. Current runtime behavior, committed product direction, provisional future mechanics, and open research questions must not be conflated.

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

Client-side demand is represented through concrete client phenomena, not a separate Demand node. The accepted conceptual Client-side ontology for the next Alpha slice has these root-createable attraction entities:

- **Core Functional Job**
- **Emotional Job**
- **Social Job**
- **Consumption Chain Job**
- **Financial Desired Outcome**

Its contextual, normally non-root entities are **Related Job**, **Desired Outcome**, and **Repulsor**. The accepted child-creation grammar is:

- Core Functional Job → Related Job, Desired Outcome, Repulsor;
- Consumption Chain Job → Desired Outcome, Repulsor;
- Emotional Job → Repulsor;
- Social Job → Repulsor; and
- Financial Desired Outcome → Repulsor.

A Related Job is semantically relative to a Core Functional Job and should not normally be a free root. A generic Desired Outcome is an outcome of a Functional Job or Consumption Chain Job and should not normally be a free root. Once created, it remains a full graph entity because it may accumulate its own Evidence, relationships, and analytical significance.

Social Job, Emotional Job, Consumption Chain Job, and Financial Desired Outcome may exist as independent Client-side roots. VEE deliberately does not force them into a visual containment hierarchy beneath Core Functional Job. Client-side Jobs may also exist without any Product association; likewise, Products may exist before their relevant Jobs are known. Future authoring should allow selection or creation of a related entity from either side without making that relation mandatory. This supports discovery when demand precedes a Product, a Product precedes understood demand, or research reveals previously unknown Jobs or Repulsors.

Repulsor is the one generic, provisional Client-side negative phenomenon in the current ontology; Risk, Fear, Objection, and similar subclasses are not currently introduced. It may be created contextually from an attraction entity, but that gesture does not establish permanent ownership or containment. The longer-term semantic model must permit one Repulsor to relate to multiple Client-side phenomena. Its detailed relationship semantics remain open.

Attraction and repulsion are not necessarily a generic entity taxonomy. Product, Offer, and Touchpoint are intrinsically Business-side attraction-oriented. Whether contextual phenomena have intrinsic polarity or instead affect other forces through typed relationships remains unresolved.

### Customer roles

Customer roles are metadata or reference configuration, not mandatory visible Actor or persona nodes. The accepted vocabulary is **Core Job Executor**, **Product Lifecycle Support Team**, and **Purchase Decision Maker**. These roles may refer to the same real actor or different actors, and the future model must remain compatible with explicit “same actor as” grouping.

The default conceptual bindings are:

- Core Functional Job, Related Job, Emotional Job, and Social Job → Core Job Executor;
- Consumption Chain Job → Product Lifecycle Support Team; and
- Financial Desired Outcome → Purchase Decision Maker.

Bindings must remain editable because roles may overlap in practice. The final implementation schema is not yet prescribed.

### Domain semantics and epistemic standing

An entity's domain type and its epistemic standing are separate. Authoring a Core Functional Job records what the user currently believes the entity to be; it does not establish that research has validated either the formulation or the type. The map is partly a research model, not only a repository of established facts.

VEE must support hypothesized and provisional formulations that later Evidence can support, refine, split, reinterpret or retype where appropriate, or reject. Unsupported and weakly supported areas remain useful analytical information because they can identify where further research or evidence-gathering should be designed. Domain semantics must therefore never implicitly confer epistemic confirmation.

### Context / Actual Life Context

Actual Life Context is a contextual layer, not a single required mega-node. It can include client, business, market, social, economic, technological, legal, competitive, historical, and other conditions. Contextual factors may change the salience or strength of attraction and repulsion phenomena over time. The exact context ontology, including entity boundaries and relationship semantics, remains open.

### Knowledge and support

The product trajectory requires a knowledge layer capable of supporting entities, relationships, contextual factors, and eventually Value Realization. Shared support infrastructure must preserve provenance or source, uncertainty or confidence, and time. Quantitative and qualitative support may apply at any level; neither is prescribed for only one entity type.

The accepted working knowledge-layer terms have different epistemic roles:

- **Evidence** primarily supports observed interactions, relationships, behavior, usage, responses, purchases, outcomes, Value Realization, and similar claims.
- **Factual Support** supports externally verifiable contextual or environmental facts such as market prices, regulation, macroeconomic conditions, or technology availability.

The future system must distinguish these roles while allowing shared infrastructure for provenance or source, confidence or reliability, and time. **Proof** is rejected as the primary term because it implies a stronger or more final level of demonstration than intended. This terminology is accepted product direction; exact storage and schema mechanics remain future work. Creating a domain entity does not automatically create support or an epistemic annotation.

### Cross-side topology and semantic scope

The authored graph is constrained by VEE semantics rather than permitting arbitrary cross-side relations. Touchpoint is the only authored encounter boundary at which a visible Client-side ↔ Business-side graph connection appears. Visible direct Job ↔ Product and Job ↔ Offer edges are not part of the model.

Product and Offer may instead hold authored semantic scope or references describing the Client-side phenomena the business believes they address. Product or Offer ↔ Client phenomenon is semantic scope; Touchpoint ↔ Client phenomenon is the actual authored cross-side graph connection. Neither records proof that the relationship works: each expresses business intent or hypothesized correspondence until Evidence supports or weakens it.

Client semantic scope follows the Business-side structure:

```text
Product client scope
→ an Offer selects or addresses an applicable subset
→ Touchpoints presenting that Offer expose or inherit those Client-side connections
```

A Product may reference Client-side Jobs before an Offer or Touchpoint exists, producing semantic documentation but no visible cross-side bridge. An Offer may similarly reference Client-side phenomena. Default inheritance to its current and future Touchpoints is accepted Alpha direction; more granular Touchpoint-level narrowing may be explored later if real maps demonstrate the need.

Reverse editing must preserve consistency: assigning a Client phenomenon to an Offer must keep its parent Product's scope compatible, while explicitly connecting one to a Touchpoint must keep the owning Offer and Product scopes compatible. The storage representation, synchronization commands, multi-Offer edge cases, and detailed inheritance mechanics remain open implementation questions.

### Value Realization

Value Realization is a committed future synthetic cross-side concept, not a finalized entity or current runtime capability. It arises when sufficient support establishes meaningful realized value between one or more Products and one or more Client-side Jobs or phenomena:

```text
Client-side Job(s) ──┐
                     ├── Value Realization
Product(s) ──────────┘
```

Its creation, confirmation, thresholds, and cardinality rules remain open. Individual purchases, renewals, usage periods, client cases, interviews, measured outcomes, and similar observations may later support it; no Exchange Episode graph entity is required. This direction does not introduce a separate Demand entity.

Value Realization is evolutionary rather than terminal. The longer-term direction is:

```text
authored or hypothesized system
→ exchange
→ Evidence / Factual Support
→ supported understanding / Value Realization
→ new understanding of the system
→ new or refined Jobs, Repulsors, Context Factors, Product hypotheses, Offers, or Touchpoints
→ subsequent exchange cycle
```

A Value Realization may therefore become an origin point for a subsequent cycle of mapping and discovery. Future persistence and model history must remain compatible with this evolution, without prescribing event sourcing or another technical architecture.

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

### 2D authored-map interaction direction

Authoring in 2D is map-first rather than form-first. The interaction model should follow established mind-map conventions where they fit VEE semantics, while domain rules determine what each structural action actually means.

Committed interaction direction:

- **Tab → canonical child.** The selected node determines the valid next structural type and known parent relation: Product → Offer, Offer → Touchpoint, Touchpoint → Child Touchpoint.
- **Enter → canonical sibling** is the intended next keyboard convention, subject to runtime validation before it is treated as implemented behavior.
- **Right click on empty canvas → valid root creation** for a new independent authored branch.
- **Right click on a node → contextual structural actions** such as Add child, Add sibling, Duplicate, Open link, Delete, and later domain-specific actions.
- **Ctrl/Cmd+C and Ctrl/Cmd+V → structural duplicate** of authored entity data and applicable authored relationships. Duplication must never copy epistemic annotations, Evidence, observations, or future analytical state.
- **Drag on free canvas → view Placement change.** Dragging onto a valid structural parent is a committed interaction direction for topology-aware reparenting with a visible preview, but exact rules must respect domain cardinality and remain explicit rather than inferred from proximity alone.
- **Inspector → deep editing surface.** Detailed properties and relationships belong in the Inspector even when common structural operations are available directly on the canvas.
- **Collapse / expand descendants** and explicit branch layout/reset are expected authored-map capabilities for larger maps, not analytical force behavior.

The canvas should infer what the graph context already establishes instead of repeatedly asking the user to select known type, side, or parent values. Quick creation may use a compact contextual editor, while detailed editing remains in the Inspector.

Canvas and Inspector are two interfaces to the same domain operations: an operation must produce the same model regardless of where it begins. Future cross-side canvas gestures must not become generic edge drawing. A gesture toward an invalid direct relation should instead be treated as intent to complete valid VEE structure. For example:

- dragging a Job toward a Product must not create a Job ↔ Product edge; a future UI may guide selection or creation of the relevant Offer and eventual Touchpoint;
- dragging a Job toward an Offer may assign it to the Offer's semantic scope and synchronize scope upward to Product, without creating a visible Job ↔ Offer edge; and
- dragging a Job to a valid Touchpoint may create the actual cross-side connection and synchronize semantic scope upward.

The final modal, popover, or other interaction mechanics remain open. The governing principle is that allowed operations encode the VEE model: VEE is not a generic free-form graph editor.

### Methodological complexity and guidance

VEE models complex systems for serious systems-level work by senior product, marketing, operations, strategy, and management practitioners, including top management and C-level users where applicable. Meaningful methodological complexity is deliberate product direction, not a defect to eliminate; the UX should reduce unnecessary friction without erasing that complexity.

Future authoring should include contextual learning and help. For concepts such as Core Functional Job, concise help may explain what the concept means, how it is used, where a user may discover it, and how it may be researched or validated. The help system and its final interaction design are not part of the current runtime slice.

### 2D visual hierarchy and layout

Authored 2D node size should be stable by semantic role / structural level rather than grow whenever deeper descendants are added. Descendant-driven resizing is not the target interaction model because adding content deep in a branch should not unexpectedly resize ancestor nodes and shift the map.

The current visual direction is therefore role/level-driven hierarchy, for example Product larger than Offer and Offer larger than Touchpoint. Nested Touchpoints may remain at the Touchpoint base size or use a modestly smaller structural-level size after visual calibration. Exact pixel values are prototype/view concerns rather than domain semantics.

Node size remains a derived rendering property. It must never encode Evidence, confidence, popularity, conversion, or future attraction/repulsion force in the authored 2D view.

The authored map should use a simple structural layout rather than a force layout: newly created canonical children should receive predictable readable placement and sibling spacing, while explicit manual dragging remains a local override. Existing manually positioned branches should not be unexpectedly rearranged without a user action such as Layout branch / Reset layout.

Touchpoint URL/link affordances should remain peripheral to the node's primary content rather than overlap title text. The map is for quick opening and structural work; the Inspector remains the editing surface for the locator itself.

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

- What are the detailed relationship semantics for Repulsor, including how a Repulsor relates to multiple Client-side phenomena?
- What is the exact contextual / Actual Life Context ontology, and does context carry polarity or modify other forces?
- How should support confidence, provenance, diversity, recency, repeatability, and aggregation work?
- What storage/schema mechanics should represent Evidence, Factual Support, role bindings, epistemic standing, semantic scope, inheritance, and reverse synchronization?
- Which detailed Touchpoint ↔ Client phenomenon relationship types and epistemic statuses are required?
- What are the creation, confirmation, threshold, and cardinality rules for Value Realization?
- How should Buyer’s Journey classifications, filters, and suggested relationships be used?
- How should future emergent forces be calculated and explained without turning derived state into asserted fact?
- What future 3D rendering architecture, dependencies, and interaction model are appropriate?
- What exact drag-to-reparent and cross-side authoring UI mechanics preserve valid Product / Offer / Touchpoint semantics, especially for Touchpoints linked to multiple Offers?
- What final authored-map visual scale and auto-layout behavior best preserve readability without turning rendering choices into domain meaning?
- What persistence and model-history architecture best preserves evolutionary discovery without prematurely fixing a technical pattern?
- What editing permissions, collaboration, offline behavior, viewport support, input devices, and mobile editing capabilities are required?
