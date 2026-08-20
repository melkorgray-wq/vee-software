# VEE Software Product Contract

## Product purpose

VEE Software is intended to help people map a Value Exchange Ecosystem as a system of entities, relationships, context, and exchanges of value. It is a working environment for describing what is believed and what available support establishes while preserving source, uncertainty, and time.

## Public conceptual background

The [Value Exchange Ecosystem article](https://thequietorbit.com/value-exchange-ecosystem/) is the public conceptual origin and broader explanation of VEE. The current product boundary recognizes that client context is subjective, that exchanges can involve repeated interactions rather than only a linear funnel, and that an ecosystem can be mapped without claiming its causal mechanisms are proven.

That article is conceptual background, not a software specification. This document defines the narrower current product boundary and committed trajectory for Software Alpha. Its metaphors, analogies, and broader concepts do not automatically become features, entities, relationships, geometry, metrics, or a finalized ontology.

## Current stage and runtime

The project is in solution discovery and Software Alpha design. The repository contains a runnable in-memory domain and interaction spike, not a functional Alpha. It tests separation between entity, typed relationship, epistemic annotation, view, placement, rendering, and UI state. The runtime implements the five accepted root-createable Client-side kinds, Related Job Desired Outcome ownership, optional Core Functional Job context for Emotional and Social Jobs, Offer-level Financial Desired Outcome intent, and contextual Repulsor authoring. Its implemented cross-side semantics are Job-centered Product intent, Offer selection of that intent, Touchpoint inheritance through linked Offers, direct Job fallback and Desired Outcome or Financial Desired Outcome → Touchpoint intent projections, Repulsor relevance and authored Touchpoint mitigation, and the derived Repulsor → Touchpoint relevance projection. The spike does not implement Evidence, contextual support, Value Realization, persistence, derived forces, or 3D visualization.

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

Its contextual, normally non-root entities are **Related Job**, **Desired Outcome**, and **Repulsor**. Current authored-map interactions distinguish canonical Child authoring from contextual resistance-relation authoring.

The canonical contextual Child grammar is:

- Core Functional Job → Related Job, Desired Outcome;
- Related Job → Desired Outcome; and
- Consumption Chain Job → Desired Outcome.

Repulsor is not a Child entity. **Add Repulsor** may be invoked contextually from Core Functional Job, Related Job, Consumption Chain Job, Emotional Job, Social Job, or Financial Desired Outcome. That command creates `Repulsor ──repulsor_resists──→ selected target`; it creates no parenthood, ownership, or containment. Placement near the selected target is view/layout behavior only.

A Related Job is semantically relative to a Core Functional Job and should not normally be a free root. A generic Desired Outcome is an outcome of a Functional Job or Consumption Chain Job and should not normally be a free root. Once created, it remains a full graph entity because it may accumulate its own Evidence, relationships, and analytical significance.

Social Job, Emotional Job, Consumption Chain Job, and Financial Desired Outcome may exist as independent Client-side roots. VEE deliberately does not force them into a visual containment hierarchy beneath Core Functional Job. Client-side Jobs may also exist without any Product association; likewise, Products may exist before their relevant Jobs are known. Future authoring should allow selection or creation of a related entity from either side without making that relation mandatory. This supports discovery when demand precedes a Product, a Product precedes understood demand, or research reveals previously unknown Jobs or Repulsors.

Repulsor is the one generic, provisional Client-side negative phenomenon in the current ontology; Risk, Fear, Objection, and similar subclasses are not currently introduced. It may be created contextually from an attraction entity, but that gesture does not establish permanent ownership or containment. In the current runtime, a Repulsor explicitly resists one or more eligible Client-side targets—Core Functional Job, Related Job, Emotional Job, Social Job, Consumption Chain Job, or Financial Desired Outcome—through directed `repulsor_resists` relationships. Financial Desired Outcome remains an independent Client-side outcome owned by Offer intent, not a Job; resistance to it means resistance to achieving that financial result and does not reclassify it as a Job.

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

### Cross-side topology and Job-centered intent

Product owns **Product Job Intent**. Each Product Job Intent associates that Product with one existing Core Functional Job, Related Job, Emotional Job, Social Job, or Consumption Chain Job. For a Core Functional Job, Related Job, or Consumption Chain Job, it may also contain an optional subset of that Job’s existing Desired Outcomes. The authored meaning is “Product intends to address Job X, optionally through Desired Outcomes Y and Z.” Product Job Intent is business intent, not evidence that the Job or outcomes were addressed.

Selecting a Desired Outcome always includes its owning Job. Core Functional Job, Related Job, and Consumption Chain Job may be selected directly with an empty outcome subset, or through a subset of their Desired Outcomes. Emotional and Social Jobs are selected without a Desired Outcome subset. An ordinary Desired Outcome remains owned by its Job through the Client-side `Job → Desired Outcome` relationship and never becomes a standalone Product goal. Creating one during intent authoring creates the Client-side entity and its ordinary owning relationship before selecting it inside Product Job Intent; it creates no direct Product → Desired Outcome relationship. Emotional and Social Jobs may exist without Core Functional Job context; an optional many-to-many `core_functional_job_contextualizes_job` relation supplies non-containing Client context independently of Business intent.

An Offer selects Product Job Intents belonging to its Product. That selection refers to the Job scope, including the Product Job Intent’s authored ordinary Desired Outcome subset; it does not create a direct Offer → Desired Outcome relationship. Separately, Offer owns explicit **Financial Desired Outcome intent**, independently of Product Job Intent and of its linked Product. A new Offer draft initially selects every current Product Job Intent, while allowing the author to deselect any before creation. Existing Offers do not automatically acquire Product Job Intents authored later.

Touchpoint remains the only visible Business/Client encounter boundary. A Touchpoint authors a concrete selection from the intent available through its linked Offers rather than unconditionally inheriting the union of all linked Offer intent. Each Touchpoint selection records the contributing linked Offer through which the selected Job intent or Financial Desired Outcome acts. A selection cannot outlive that contributing path. A newly created Touchpoint may initially select the entire current scope of its linked Offers for compatibility, after which the user may narrow it. Later Product or Offer scope additions do not silently expand an existing Touchpoint selection.

On a Touchpoint linked to multiple Offers, the author must select one or more contributing Offers for a bottom-up selection. The operation expands only those Offers; it must not silently expand every linked Offer. The same effective Job, ordinary Desired Outcome, or Financial Desired Outcome may have multiple contributing paths. Its visible projection is deduplicated and remains while at least one selected valid path remains, although attribution is retained per Touchpoint selection.

Two authoring directions produce the same durable intent structure:

1. **Top-down authoring:** author Product Job Intent, select it in an Offer, then select all or part of that Offer scope in a linked Touchpoint.
2. **Bottom-up authoring:** selecting a Job or ordinary Desired Outcome on a Touchpoint atomically creates any missing Product Job Intent and contributing Offer selection, then creates the attributed Touchpoint selection. On a multi-Offer Touchpoint, this applies only to the contributing Offers explicitly chosen by the user. Selecting a Financial Desired Outcome bottom-up instead expands only the chosen Offer Financial Desired Outcome intent and the attributed Touchpoint selection; it never creates Product Job Intent.

Bottom-up authoring documents upstream business intent; it is not temporary derived inheritance. Once the atomic operation succeeds, every created Product Job Intent and Offer selection is an independently authored record. If any precondition or mutation fails, the whole operation fails without leaving partial upstream or Touchpoint records. The exact transaction and persistence mechanism remains unresolved pending an accepted architecture decision.

Financial Desired Outcome remains Offer-owned intent. A Touchpoint may select one through one or more explicitly contributing Offers. It does not enter Product Job Intent, propagate to Product, become a Job, or receive an ordinary Desired Outcome child without a separate ontology decision.

The authored visible projection is calculated only from valid Touchpoint selections. Where a selected Product Job Intent addresses a non-empty ordinary Desired Outcome subset, the route is:

```text
Job → Desired Outcome → Touchpoint
```

The first edge is the existing Client ontology relationship. The second is a deduplicated cross-side projection from Desired Outcome to Touchpoint. No additional `Job → Touchpoint` edge is shown while the selected outcome subset is non-empty. A directly selected Job with no selected outcomes, including an Emotional or Social Job, produces one `Job → Touchpoint` projection. Product and Offer intent are never rendered as direct cross-side edges. Selected Offer Financial Desired Outcome intent similarly produces one deduplicated `Financial Desired Outcome → Touchpoint` route, with no visible Product/Offer → Financial Desired Outcome edge.

Deletion is intentionally asymmetric because upstream authored intent and Client-side ontology are not disposable view state:

- deleting a Touchpoint or one of its local selections deletes no Product Job Intent, Offer selection, Client-side Job, Desired Outcome, or Client-side relationship;
- deleting Product Job Intent cascades through dependent Offer selections and their dependent Touchpoint selections, but preserves all Client-side entities and relationships;
- removing a Job selection from an Offer requires explicit confirmation and deletes Touchpoint selections attributed to that Offer selection;
- unlinking an Offer from a Touchpoint deletes selections attributed to that Offer after confirmation;
- if the same effective intent remains selected through another contributing Offer, its deduplicated visible projection remains;
- deleting an Offer removes its attributed Touchpoint paths but deletes neither Product Job Intent nor Client-side entities; and
- changing an Offer’s Product removes selections tied to the previous Product, with confirmation and the same dependent Touchpoint cascade, but preserves both Products’ Product Job Intents and all Client-side records.

A Child Touchpoint remains a full Touchpoint with its own attributed selection. At creation it receives a copy of the parent’s then-current effective selection as a starting authored draft, mapped only through Offers also linked to the child. The user must resolve any parent contributor unavailable to the child before creation can succeed. Subsequent edits to parent and child do not synchronize implicitly. Live inheritance is not the current direction; adopting it would first require explicit pruning, override, and conflict states and their persistence semantics.

For Repulsors, `Repulsor ──resists──→ eligible Client-side target` is authored Client-side topology. A Touchpoint’s relevant Repulsors are derived and deduplicated from the Repulsors that resist its selected Jobs or Financial Desired Outcomes. Every relevant Repulsor produces a derived `Repulsor → Touchpoint` cross-side projection, even when no mitigation is authored. This projection records resistance relevance from the existing topology; it is not persisted as another relationship. Financial Desired Outcome remains Offer-owned intent and does not become a Job through this relevance rule.

Separately, an author may state optional Business intent with `Touchpoint ──mitigates──→ Repulsor` only while that Repulsor is relevant. This relation says that the Touchpoint is intended to reduce or compensate for the Repulsor; it does not claim that mitigation succeeds. Mitigation is not a prerequisite for the derived Repulsor resistance projection, and Product and Offer have no direct mitigation relation in this slice.

Domain topology records what interacts; neither the derived Repulsor → Touchpoint projection nor the authored Touchpoint → Repulsor mitigation direction encodes interaction strength. Future Evidence or Factual Support will describe why and how strongly the model is supported, and future derived-force logic will determine strength and the resulting attraction or repulsion dynamics. Evidence may therefore support or weaken both a Repulsor and a Touchpoint mitigation claim without changing authored intent into proof. These authored intent projections remain hypotheses rather than outcome evidence. Environment / Context entities remain future work and are not introduced by these semantics.

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

- **Tab → canonical Child where one exists.** The selected node determines the valid next structural type and known parent relation: Product → Offer, Offer → Touchpoint, Touchpoint → Child Touchpoint, Core Functional Job → Related Job or Desired Outcome, Related Job → Desired Outcome, and Consumption Chain Job → Desired Outcome.
- **Shift+Tab → Add Repulsor** when the selected entity is one of the six eligible targets: the five accepted Job kinds or Financial Desired Outcome. This authors only the directed resistance relationship from the new Repulsor to that target; the Financial Desired Outcome case does not make that outcome a Job.
- **Enter → canonical or same-context sibling** as currently implemented. For Repulsor, the blank sibling inherits the resisted target set without implying a semantic parent.
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

The following state table defines the proposed owner-level effects of those operations. “None” means no mutation in that owner layer; “preserve projection” always depends on another valid, selected contributing path. It specifies product behavior, not a finalized schema, transaction engine, persistence mechanism, or widget design.

| command | preconditions | contributing Offer selection | Product mutation | Offer mutation | Touchpoint mutation | visible projection | confirmation | cascade | preserved records | error state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Select Job on Product | Product and existing eligible Job selected | None | Create Product Job Intent with empty outcome subset | None | None | None until selected at a Touchpoint | No | None | Job and all Client-side relationships | Duplicate intent resolves to existing record; ineligible entity is rejected |
| Select Product Job Intent in Offer | Offer belongs to intent’s Product | That Offer | None | Create Offer selection | None | None until selected at a Touchpoint | No | None | Product intent and Client-side records | Reject intent from another Product or duplicate selection |
| Select all Offer scope for new Touchpoint | New Touchpoint is linked to at least one Offer | Every linked Offer whose scope is copied, attributed separately | None | None | Create selections for each current Job and Financial intent path | Deduplicated Job/outcome/FDO routes | Initial default shown before creation | None | All upstream intent | Reject missing/invalid Offer links; empty scope is allowed and shown |
| Select subset of Jobs for a Touchpoint | Jobs are in selected linked Offer scopes | Explicit Offer per selected Job | None | None | Add/remove attributed local selections to match subset | Only selected effective routes | No, unless removal has dependent local detail | Local dependent Touchpoint detail only | All Product, Offer, and Client-side records | Reject a Job outside chosen Offer scope |
| Select Desired Outcome on Touchpoint | Outcome has an owning eligible Job; at least one linked contributing Offer chosen | One or more explicitly chosen linked Offers | Create/extend owning Job’s Product Job Intent if missing | Select/extend intent only in chosen Offers | Select owning Job and outcome per contributor atomically | `Job → Desired Outcome → Touchpoint`; no direct Job route | Confirm upstream additions in operation preview | Atomic upstream completion, not deletion | Existing Job, outcome, owning relationship, and unrelated intent | Reject orphan outcome, ineligible Job, unavailable Product, or no contributor |
| Select Job bottom-up with no Product intent | Touchpoint has linked Offer(s); eligible Job exists; contributors chosen | One or more explicitly chosen linked Offers | Create Product Job Intent for each distinct contributing Product | Create Offer selection in chosen Offers | Create attributed Job selections | One deduplicated `Job → Touchpoint` route | Confirm upstream additions | Atomic creation across owners | Job and Client-side relationships | Roll back all new records if any chosen path is invalid or mutation fails |
| Select Desired Outcome bottom-up with no Product intent | Outcome and owning eligible Job exist; Touchpoint and contributors are valid | One or more explicitly chosen linked Offers | Create Job intent with selected outcome for each distinct Product | Create Offer selection in chosen Offers | Create attributed Job/outcome selections | One deduplicated outcome route; no direct Job route | Confirm upstream additions | Atomic creation across owners | Job, outcome, owning relationship, unrelated intent | Roll back all new records on orphan outcome, invalid contributor, or failure |
| Select intent on multi-Offer Touchpoint | Two or more Offers linked; selected intent is available or can validly be authored upstream | User must choose one or more; never all implicitly | Create/extend only Product intents required by chosen paths | Create/extend only chosen Offer selections | Create one attributed selection per chosen path | Deduplicate equal effective routes | Yes, contributor picker/preview | Atomic only across chosen paths | Unchosen Offer scopes and existing selections | Reject no contributor, unlinked Offer, or incompatible Product path |
| Select FDO on Touchpoint | FDO exists; one or more linked contributing Offers chosen | Chosen Offers only | None | Add FDO to each chosen Offer Financial Intent if missing | Create attributed FDO selections | One deduplicated `FDO → Touchpoint` route | Confirm upstream Offer additions | Atomic Offer + Touchpoint completion | Products, Product Job Intents, and all Client-side records | Reject no contributor/unlinked Offer; roll back on failure |
| Delete Touchpoint | Touchpoint exists | All its attributed paths | None | None | Delete Touchpoint, its selections, and local authored relations | Remove its projections | Yes | Touchpoint-local records only | Product intents, Offer intents/selections, Client-side entities/relationships | Reject missing target or unauthorized deletion |
| Delete Touchpoint selection | Selection exists | The attributed Offer path for that selection | None | None | Delete only selected local path | Remove route unless another effective path remains | No; confirm if local dependent detail exists | Touchpoint-local dependent detail only | Touchpoint, upstream intent, Client-side records, other contributor paths | Reject missing selection; disclose preserved duplicate projection |
| Delete Offer selection | Offer Job selection exists | That Offer | None | Delete Offer selection | Delete dependent selections attributed to it | Remove routes unless another effective path remains | Yes, with affected Touchpoints preview | Dependent Touchpoint selections | Product Job Intent, Offer, Client-side records, other paths | Reject cancellation, missing selection, or unauthorized mutation |
| Delete Product Job Intent | Product Job Intent exists | Every Offer selection of it | Delete Product Job Intent | Delete all dependent Offer selections | Delete all dependent attributed selections | Remove routes unless another valid intent/path supplies the same effective route | Yes, with full cascade preview | Offer and Touchpoint selections | Jobs, Desired Outcomes, Client-side relationships, Products, Offers, Touchpoints | Reject cancellation or unauthorized mutation; no partial cascade |
| Unlink one Offer from multi-Offer Touchpoint | Offer is linked; at least one other Offer remains linked | Unlinked Offer only | None | None | Remove link and selections attributed to it | Preserve equal routes supplied by remaining Offers; remove others | Yes, with path preview | Attributed Touchpoint selections | Offer intent, Product intent, Client-side records, remaining links/paths | Reject if Child/link invariants would fail; no partial unlink |
| Change Product on Offer | New Product exists; invalidated selections are known | The changed Offer | None | Remove old-Product Job selections; optionally initialize new scope as an explicit draft | Delete dependent selections attributed to removed selections | Preserve routes through other Offers; new scope is not projected until selected | Yes, with old-path cascade and new-scope preview | Product Job Intents on both Products, FDO intent, Client-side records | Reject cancellation/incompatible state; apply no partial change |
| Delete one of several contributing paths | Same effective intent has at least two valid attributed paths | Path selected for deletion | None | Delete Offer selection only if that is the invoked command; otherwise none | Delete selection for removed path | Keep deduplicated projection through remaining path | According to invoked upstream/local delete command | Only dependants of removed path | Remaining contributor attribution and all unrelated records | Reject ambiguous path; require explicit contributor |
| Create then refine Child Touchpoint | Parent exists; child has at least one linked Offer capable of copied paths | Parent paths mapped to Offers linked to child | None | None | Create independent child with copied draft; later edit only child selection | Initially mirrors copy, then reflects child’s own effective selection | Confirm unresolved/unavailable contributor mappings | None after creation; no live sync | Parent selection and all upstream/Client-side records | Block creation until unavailable mappings are removed or remapped |

Selection commands must expose empty scope, invalid contributors, and atomic failure rather than imply success. Keyboard and focus details, the final contributor picker, supported input devices and viewports, persistence/reload behavior, permissions, and accessibility acceptance checks remain to be specified before implementation. Any future live Child Touchpoint inheritance requires a new state table covering pruning, local override precedence, parent/child concurrent edits, conflicts, and unlink/delete behavior.

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

- What is the exact contextual / Actual Life Context ontology, and does context carry polarity or modify other forces?
- How should support confidence, provenance, diversity, recency, repeatability, and aggregation work?
- What storage/schema mechanics should represent Evidence, Factual Support, role bindings, epistemic standing, Product Job Intent, Offer selection, attributed Touchpoint selection, and atomic bottom-up authoring?
- Which detailed Touchpoint ↔ Client phenomenon relationship types and epistemic statuses are required?
- What are the creation, confirmation, threshold, and cardinality rules for Value Realization?
- How should Buyer’s Journey classifications, filters, and suggested relationships be used?
- How should future emergent forces be calculated and explained without turning derived state into asserted fact?
- What future 3D rendering architecture, dependencies, and interaction model are appropriate?
- What exact drag-to-reparent and cross-side authoring UI mechanics preserve valid Product / Offer / Touchpoint semantics, especially for Touchpoints linked to multiple Offers?
- What final authored-map visual scale and auto-layout behavior best preserve readability without turning rendering choices into domain meaning?
- What persistence and model-history architecture best preserves evolutionary discovery without prematurely fixing a technical pattern?
- What editing permissions, collaboration, offline behavior, viewport support, input devices, and mobile editing capabilities are required?
