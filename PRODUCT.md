# VEE Software Product Contract

## Product purpose

VEE Software is intended to help people map a Value Exchange Ecosystem as a system of entities, relationships, context, and exchanges of value. It is a working environment for describing what is believed and what available support establishes while preserving source, uncertainty, and time.

## Public conceptual background

The [Value Exchange Ecosystem article](https://thequietorbit.com/value-exchange-ecosystem/) is the public conceptual origin and broader explanation of VEE. The current product boundary recognizes that client context is subjective, that exchanges can involve repeated interactions rather than only a linear funnel, and that an ecosystem can be mapped without claiming its causal mechanisms are proven.

That article is conceptual background, not a software specification. This document defines the narrower current product boundary and committed trajectory for Software Alpha. Its metaphors, analogies, and broader concepts do not automatically become features, entities, relationships, geometry, metrics, or a finalized ontology.

## Current stage and runtime

The project is in solution discovery and Software Alpha design. The repository contains a runnable in-memory domain and interaction spike, not a functional Alpha. It tests separation between entity, typed relationship, epistemic annotation, view, placement, rendering, and UI state. The runtime implements the five accepted root-createable Client-side kinds, Related Job Desired Outcome ownership, optional Core Functional Job context for Emotional and Social Jobs, Offer-level Financial Desired Outcome intent, attributed Touchpoint Job/Financial selections, contextual Repulsor authoring, Repulsor relevance, authored Touchpoint mitigation, and the derived Repulsor → Touchpoint relevance projection.

The runtime does not permit a direct Job → Touchpoint fallback when a Touchpoint Job selection has an empty Desired Outcome scope. Core Functional Job, Related Job, and Consumption Chain Job are DO-bearing Jobs and may materialize cross-side only through one or more ordinary Desired Outcomes. Emotional Job and Social Job remain direct Job → Touchpoint routes because ordinary Desired Outcome does not exist for those kinds in the accepted ontology. Financial Desired Outcome remains an Offer-owned outcome-level intent that routes directly to Touchpoint.

The spike does not implement Evidence, contextual support, Value Realization, persistence, derived forces, or 3D visualization.

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

Core Functional Job, Related Job, and Consumption Chain Job are **DO-bearing Jobs**. An ordinary Desired Outcome is the outcome/measurement layer through which one of these Jobs is concretized for Business intent at an encounter. A DO-bearing Job may be recorded before its Desired Outcomes are understood, but that state is incomplete knowledge: it must not create a direct cross-side Job → Touchpoint route. Emotional Job and Social Job do not have an ordinary Desired Outcome layer in the accepted Ulwick-oriented ontology and therefore may route directly to Touchpoint. Financial Desired Outcome is a separate root-like outcome-level Client entity for the Purchase Decision Maker; it is not a Job and not an ordinary Desired Outcome child of another Job.

Repulsor is not a Child entity. **Add Repulsor** may be invoked contextually from Core Functional Job, Related Job, Consumption Chain Job, Emotional Job, Social Job, or Financial Desired Outcome. That command creates `Repulsor ──repulsor_resists──→ selected target`; it creates no parenthood, ownership, or containment. Placement near the selected target is view/layout behavior only.

A Related Job is semantically relative to a Core Functional Job and should not normally be a free root. Its Core Functional Job context remains part of the Client-side topology even when Business intent addresses the Related Job separately. Addressing a Related Job does **not** automatically mean that the Product also addresses its parent Core Functional Job. Context propagation is required; Business-intent propagation to the parent Core Functional Job is not.

A generic Desired Outcome is an outcome of a Core Functional Job, Related Job, or Consumption Chain Job and should not normally be a free root. Once created, it remains a full graph entity because it may accumulate its own Evidence, relationships, and analytical significance.

Social Job, Emotional Job, Consumption Chain Job, and Financial Desired Outcome may exist as independent Client-side roots. VEE deliberately does not force them into a visual containment hierarchy beneath Core Functional Job. Client-side Jobs may also exist without any Product association; likewise, Products may exist before their relevant Jobs are known. Authoring should allow selection or creation of a related entity from either side without pretending that unknown downstream detail is already known. This supports discovery when demand precedes a Product, a Product precedes understood demand, or research reveals previously unknown Jobs or Repulsors.

Repulsor is the one generic, provisional Client-side negative phenomenon in the current ontology; Risk, Fear, Objection, and similar subclasses are not currently introduced. It may be created contextually from an attraction entity, but that gesture does not establish permanent ownership or containment. In the current runtime, a Repulsor explicitly resists one or more eligible Client-side targets—Core Functional Job, Related Job, Emotional Job, Social Job, Consumption Chain Job, or Financial Desired Outcome—through directed `repulsor_resists` relationships. Financial Desired Outcome remains an independent Client-side outcome owned by Offer intent, not a Job; resistance to it does not reclassify it as a Job.

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

Product owns **Product Job Intent**. Each Product Job Intent associates that Product with one existing Core Functional Job, Related Job, Emotional Job, Social Job, or Consumption Chain Job. For a Core Functional Job, Related Job, or Consumption Chain Job, it may also contain a subset of that Job’s existing Desired Outcomes. The authored meaning is “Product intends to address Job X, with the currently known outcome criteria Y and Z where this Job kind has ordinary Desired Outcomes.” Product Job Intent is business intent, not evidence that the Job or outcomes were addressed.

A Product Job Intent for a DO-bearing Job may temporarily have an empty Desired Outcome subset when the user knows the Job is relevant but has not yet described the relevant outcomes. That state is deliberately incomplete and may exist upstream. It must not be interpreted as permission to bypass the Desired Outcome layer at Touchpoint. Before a DO-bearing Job becomes an effective Touchpoint selection, at least one ordinary Desired Outcome must be selected.

Selecting a Desired Outcome always includes its owning Job. Core Functional Job, Related Job, and Consumption Chain Job use ordinary Desired Outcomes; Emotional and Social Jobs do not. An ordinary Desired Outcome remains owned by its Job through the Client-side `Job → Desired Outcome` relationship and never becomes a standalone Product goal. Creating one during intent authoring creates the Client-side entity and its ordinary owning relationship before selecting it inside Product Job Intent; it creates no direct Product → Desired Outcome relationship.

Emotional and Social Jobs may exist without Core Functional Job context; an optional many-to-many `core_functional_job_contextualizes_job` relation supplies non-containing Client context independently of Business intent. A Related Job, by contrast, retains its required semantic Core Functional Job relation. Business intent to the Related Job does not automatically author Business intent to that parent Core Functional Job.

An Offer selects Product Job Intents belonging to its Product. That selection refers to the Job scope and the Product-authored ordinary Desired Outcome availability; it does not create a direct Offer → Desired Outcome relationship. Separately, Offer owns explicit **Financial Desired Outcome intent**, independently of Product Job Intent. A new Offer may be structurally created beneath its Product before its Client intent is understood. Initial creation authors only the Offer and its required Product → Offer relationship: Product Client intent is not silently copied or initialized into the Offer, and Financial Desired Outcome intent is not a creation prerequisite. Offer Client intent and Financial Desired Outcome intent are authored afterward through Entity Inspector or another explicit semantic-authoring operation. Existing Offers likewise do not automatically acquire Product Job Intents authored later.

A Touchpoint may be structurally created beneath an Offer before its detailed properties or Client-intent scope are understood. Initial creation authors only the Touchpoint and its required Offer → Touchpoint relationship. Located in, URL, Client-intent selection, Financial Desired Outcome selection, mitigation, and other deep properties are authored afterward through Entity Inspector or another explicit semantic-authoring operation. A newly created Touchpoint may therefore have empty effective Client intent; creation must not silently materialize Offer intent downward into the Touchpoint.

Touchpoint remains the only visible Business/Client encounter boundary. A Touchpoint authors a concrete selection from the intent available through its linked Offers rather than unconditionally inheriting the union of all linked Offer intent. Each Touchpoint selection records the contributing linked Offer through which the selected Job intent or Financial Desired Outcome acts. A selection cannot outlive that contributing path. Different Touchpoints of the same Offer may have overlapping, disjoint, or otherwise different Client-intent subsets.

For a DO-bearing Job, Touchpoint authoring must select one or more ordinary Desired Outcomes from the allowed upstream scope. If the upstream Product intent is still empty/incomplete, the UI must ask the user to create or select at least one Desired Outcome before the Touchpoint connection can become effective. The system must not create a direct fallback route around that missing layer.

On a Touchpoint linked to multiple Offers, the author must select one or more contributing Offers for a bottom-up selection. The operation expands only those Offers; it must not silently expand every linked Offer. The same effective Job, ordinary Desired Outcome, or Financial Desired Outcome may have multiple contributing paths. Its visible projection is deduplicated and remains while at least one selected valid path remains, although attribution is retained per Touchpoint selection.

Two authoring directions produce the same durable intent structure:

1. **Top-down authoring:** author Product Job Intent, select it in an Offer, then select the relevant subset in a linked Touchpoint. If the Job is CFJ/RJ/CCJ, Touchpoint selection must include at least one ordinary Desired Outcome.
2. **Bottom-up authoring:** begin from a Client entity or Touchpoint and author what is currently known. Required Business scope propagates upward through Touchpoint → Offer → Product. Ambiguous downward propagation is never silent: when upstream intent is added while Offers or Touchpoints already exist, the UI asks which descendants should actually receive it. Selecting a Financial Desired Outcome bottom-up expands only the chosen Offer Financial Desired Outcome intent and the attributed Touchpoint selection; it never creates Product Job Intent.

Bottom-up authoring documents upstream business intent; it is not temporary derived inheritance. Once the atomic operation succeeds, every created Product Job Intent, Offer selection, and Touchpoint selection is an independently authored record. If any precondition or mutation fails, the whole operation fails without leaving partial upstream or Touchpoint records. The exact transaction and persistence mechanism remains unresolved pending an accepted architecture decision.

Financial Desired Outcome remains Offer-owned intent. A Touchpoint may select one through one or more explicitly contributing Offers. It does not enter Product Job Intent, propagate to Product, become a Job, or receive an ordinary Desired Outcome child without a separate ontology decision.

The authored visible projection is calculated only from valid Touchpoint selections.

For Core Functional Job, Related Job, and Consumption Chain Job, the only valid visible route is:

```text
Job → Desired Outcome → Touchpoint
```

The first edge is the existing Client ontology relationship. The second is a deduplicated cross-side projection from Desired Outcome to Touchpoint. At least one Desired Outcome is required. A direct `CFJ/RJ/CCJ → Touchpoint` route is invalid and must not be rendered as fallback.

For Emotional Job and Social Job, which have no ordinary Desired Outcome layer in the accepted ontology, the visible route is direct:

```text
Emotional Job / Social Job → Touchpoint
```

For Financial Desired Outcome, the visible route is:

```text
Financial Desired Outcome → Touchpoint
```

Product and Offer intent are never rendered as direct cross-side edges. For Related Job, the existing Client-side context remains visible as `Core Functional Job → Related Job → Desired Outcome → Touchpoint`; this does not mean the Product automatically addresses the parent Core Functional Job.

Deletion is intentionally asymmetric because upstream authored intent and Client-side ontology are not disposable view state:

- deleting a Touchpoint or one of its local selections deletes no Product Job Intent, Offer selection, Client-side Job, Desired Outcome, or Client-side relationship;
- deleting Product Job Intent cascades through dependent Offer selections and their dependent Touchpoint selections, but preserves all Client-side entities and relationships;
- removing a Job selection from an Offer requires explicit confirmation and deletes Touchpoint selections attributed to that Offer selection;
- unlinking an Offer from a Touchpoint deletes selections attributed to that Offer after confirmation;
- if the same effective intent remains selected through another contributing Offer, its deduplicated visible projection remains;
- deleting an Offer removes its attributed Touchpoint paths but deletes neither Product Job Intent nor Client-side entities; and
- changing an Offer’s Product removes selections tied to the previous Product, with confirmation and the same dependent Touchpoint cascade, but preserves both Products’ Product Job Intents and all Client-side records.

A Child Touchpoint remains a full Touchpoint. Creation preserves only the mandatory structural context required by the accepted Child topology: its parent Touchpoint relation and required links to the parent’s Offers. Client-intent scope and other deep semantic properties are authored afterward and are not silently copied from the parent. Subsequent edits to parent and child do not synchronize implicitly. Live inheritance is not the current direction; adopting it would first require explicit pruning, override, and conflict states and their persistence semantics.

For Repulsors, `Repulsor ──resists──→ eligible Client-side target` is authored Client-side topology. A Touchpoint’s relevant Repulsors are derived and deduplicated from the Repulsors that resist its selected Jobs or Financial Desired Outcomes. Every relevant Repulsor produces a derived `Repulsor → Touchpoint` cross-side projection, even when no mitigation is authored. This projection records resistance relevance from the existing topology; it is not persisted as another relationship. Financial Desired Outcome remains Offer-owned intent and does not become a Job through this relevance rule.

Repulsor impact on an Offer or Product is a derived read-only aggregation through their downstream relevant Touchpoints. Inspector may show that a Repulsor affects an Offer or Product and through which Touchpoints, but this does **not** create authored `Repulsor → Offer` or `Repulsor → Product` graph relationships and does not add new visible edges for those aggregate views.

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

### Primary authored workspace views

Software Alpha uses two peer authored workspace views: `Map` and `Entity Inspector`.

`Map` is the spatial authoring and system-overview surface. `Entity Inspector` is the full-size deep-editing surface for the currently selected entity; it is not a permanent sidebar attached to Map.

Both views operate on the same `MapDocument` and the same workspace-level selected entity. Switching between them changes UI/view state only: it does not author domain state, create a second selection, or copy entity state. Selecting an entity on Map establishes the entity shown by Entity Inspector, and returning to Map preserves that selection. The Map working context should also remain stable across workspace switches, including viewport, pan, and zoom where supported by the current view architecture.

Lightweight contextual creation outside Entity Inspector may support two continuations after the same committed creation operation: Create and remain on Map, or Create & open Inspector to immediately continue deep editing. Creation already taking place inside Entity Inspector instead exposes Create and Cancel; successful Create remains in Entity Inspector, selects the newly created entity, exits creation mode, and immediately shows its normal Inspector. These continuations do not change domain creation semantics or create a separate draft model. This allows users to move between rapid structural authoring and deep entity authoring at whatever level of the map is useful for the current work.

Business root authoring in Entity Inspector may begin from Product, Offer, or Touchpoint while preserving the mandatory upstream topology: Product is required by Offer, and Offer is required by Touchpoint. Offer root creation asks which Product it packages; Touchpoint root creation asks which Offer is presented there. Choosing an existing Offer implies its Product and must not produce a redundant Product question. A missing Product or Offer may instead be created inline as a lightweight prerequisite, with each prerequisite committed as an ordinary durable entity and with all required canonical relationships. The originally requested entity remains selected after the single atomic commit. Root Touchpoint creation requires one initial Offer; the ordinary Inspector continues to support additional Offer associations afterward.

The durable minimum for a Touchpoint is Title plus Offer. **Located in** is an optional but meaningful ecosystem property. Full Entity Inspector root creation exposes one searchable and creatable **Located in** combobox: the same field selects an existing Touchpoint Container or drafts a user-named new container, without a separate mode-selection question, and blank means no location. A container drafted there is committed atomically with the requested Touchpoint and any Product or Offer prerequisites; Cancel or any validation failure creates no orphan container or other partial prerequisite. URL is an optional, non-universal Touchpoint attribute and is never inferred from or required by its location. Map contextual creation remains intentionally lightweight and does not collect location or URL.

Entity Inspector may be activated through its workspace tab, through `Open in Entity Inspector` in an entity context menu, or through the global workspace toggle. The approved bidirectional `Map ↔ Entity Inspector` shortcut is `Ctrl+Shift+Space` on Windows/Linux and `Cmd+Shift+Space` on macOS. It must not activate while keyboard input belongs to an editable control or another active keyboard-owned interaction.

If no entity is selected, Entity Inspector shows an empty state rather than choosing a target automatically. Map and Entity Inspector remain two interfaces to the same domain operations and underlying document.

### 2D authored-map interaction direction

Authoring in 2D is map-first rather than form-first. The interaction model should follow established mind-map conventions where they fit VEE semantics, while domain rules determine what each structural action actually means.

Committed interaction direction:

- **Unanchored entity birth → nearest free local niche.** Existing authored placements remain fixed when a new entity has no spatially relevant relation to an already placed entity. The search begins at the geometric center of the occupied bounds calculated from actual rendered node rectangles, evaluates a finite clockwise-ordered set of candidates in deterministic outward rings, and forbids physical node overlap. A modest soft guard around existing nodes prefers comfortable separation but is not an exclusion zone, and the nearest ring containing a physically valid candidate always wins. Empty maps use one canonical seed. Placement uses map coordinates only; viewport, camera, pan, and zoom do not influence it. This is not global auto-layout. Related-node placement, edge-crossing minimization, and birth-batch placement remain deferred.

- **Double-click authored entity → inline Title editing.** This is a fast Map-level property operation on the existing entity and shared `MapDocument`; deeper entity editing remains Entity Inspector responsibility. The editor owns a local draft while active, so ordinary typing preserves native caret and selection behavior without mutating domain state. Enter commits the draft without adding a newline, Escape discards it, and focus returns predictably to the authored entity.
- **Contextual command menus → immediate keyboard ownership.** Opening a keyboard- or pointer-driven command menu immediately focuses its first actionable item without another pointer action or redundant Tab step. Grouped menus use one wrapping Arrow Up / Arrow Down sequence across every actionable item; explanatory group headings are non-focusable. Home / End reach command boundaries, Enter / Space activate, and Escape closes the menu and returns focus to its source entity or control.
- **Entity Context Menu → one entity-specific contextual action surface.** Every authored Map entity exposes one canonical menu built from the commands currently valid for that entity. Tab and right click invoke the same semantic command set: Tab anchors the menu adjacent to the selected entity, while right click selects the entity when necessary and anchors the menu at the pointer context. Commands may be visually grouped by relationship or action role, including canonical Child entities, Resistance, Structure, Entity, and Actions. Group headings are explanatory UI only—not focusable commands, domain types, graph entities, or relationship kinds—and do not introduce a nested Add submenu. All actionable commands, including Cancel, share one wrapping Arrow Up / Arrow Down sequence across groups, with Home / End reaching its boundaries.
- **Shift+Tab → Add Repulsor** when the selected entity is one of the six eligible targets: the five accepted Job kinds or Financial Desired Outcome. This is an accelerator for the same Repulsor command discoverable in the Entity Context Menu and authors only the directed resistance relationship from the new Repulsor to that target; the Financial Desired Outcome case does not make that outcome a Job.
- **Enter → canonical or same-context sibling** as currently implemented. For Repulsor, the blank sibling inherits the resisted target set without implying a semantic parent.
- **Right click on empty canvas → valid root creation** for a new independent authored branch.
- **Right click on a node → the canonical Entity Context Menu** at the pointer context, rather than a separate structural-action vocabulary.
- **Contextual entity creation → immediate Title focus and vertical growth.** When a lightweight create editor opens, its Title control receives focus immediately so typing can begin without another click. Long titles wrap and grow the control downward rather than widening the editor; Title remains one semantic string without intentional newlines. The transient contextual editor may temporarily overlap graph nodes or edges; that occlusion is acceptable as long as basic viewport safety keeps the editor usable.
- **Ctrl/Cmd+C and Ctrl/Cmd+V → structural duplicate** of authored entity data and applicable authored relationships. Duplication must never copy epistemic annotations, Evidence, observations, or future analytical state.
- **Drag on free canvas → view Placement change.** Dragging onto a valid structural parent is a committed interaction direction for topology-aware reparenting with a visible preview, but exact rules must respect domain cardinality and remain explicit rather than inferred from proximity alone.
- **Entity Inspector → full workspace deep-editing surface.** Detailed properties and relationships belong in the peer Entity Inspector workspace even when common structural operations are available directly on the canvas.
- **Collapse / expand descendants** and explicit branch layout/reset are expected authored-map capabilities for larger maps, not analytical force behavior.

The canvas should infer what the graph context already establishes instead of repeatedly asking the user to select known type, side, or parent values. Quick creation may use a compact contextual editor, while detailed editing remains in the full-size Entity Inspector workspace.

Structural entity creation should remain lightweight where an entity can validly exist before its deeper semantic relationships are understood. Product creation authors only Product. Offer creation infers its known parent Product and authors only Offer plus the required `Product → Offer` structural relation. Touchpoint creation infers its contributing Offer context and authors only Touchpoint plus the required `Offer → Touchpoint` structural relation. Child Touchpoint creation preserves only the mandatory parent relation and required Offer links; it does not silently copy the parent’s Client-intent scope. Related Job, Desired Outcome, Repulsor, and other contextual entities retain only the mandatory authored relations needed to make their contextual creation valid. Deep properties and Client intent are authored afterward through Entity Inspector or another explicit semantic-authoring operation. Creation drafts must not mutate durable domain state before Create, so Cancel leaves the map unchanged. This preserves discovery in both directions and the asymmetric authoring rule: required structural context is inferred or created, while semantic distribution downward is explicit.

Map and Entity Inspector are two interfaces to the same domain operations: an operation must produce the same model regardless of where it begins. Cross-side authoring is **perspective-independent**: a user may begin from Product, Offer, Touchpoint, Job, Desired Outcome, Emotional/Social Job, or Financial Desired Outcome, and the system should mutate the same durable intent structure rather than create parallel relationship concepts.

The authoring communication grammar is asymmetric:

- **upward through Business hierarchy, required scope propagates automatically:** authoring an effective Touchpoint path communicates the necessary scope to its contributing Offer and Product;
- **downward through Business hierarchy, distribution is explicit:** when Product or Offer intent is added while descendant Offers/Touchpoints already exist, VEE asks which descendants should receive it rather than silently assigning it to all;
- **Client hierarchy is preserved rather than flattened:** selecting a Desired Outcome includes its owning Job; selecting/authoring a Related Job preserves its Core Functional Job context without automatically authoring Product intent to that parent CFJ;
- **DO-bearing Jobs cannot bypass Desired Outcome:** CFJ/RJ/CCJ need at least one DO to become an effective Touchpoint path;
- **Touchpoint is the encounter boundary:** Product/Offer scope is visible in Inspector but does not create cross-side edges until a Touchpoint selection exists.

Inspector should expose Client intent in its semantic hierarchy rather than force the user to think in internal record types. DO-bearing Jobs should be shown as expandable mini-dendrites with their Desired Outcomes. Selecting a DO includes the owning Job. Emotional/Social Jobs have no DO selector. FDO appears at Offer/Touchpoint scope, not Product scope. Client-side Inspectors may initiate the same Business-authoring operation as Business-side Inspectors; this is a different perspective on the same domain state, not a second relationship model.

Repulsor authoring remains client-first. Repulsor Inspector authors the resisted Job/FDO. Touchpoint Inspector may author mitigation. Offer and Product Inspectors may show derived/read-only Repulsor impact aggregated through their relevant Touchpoints, including which Touchpoints carry the resistance and which attempt mitigation, without creating authored Repulsor → Offer/Product relationships.

Future cross-side canvas gestures must not become generic edge drawing. A gesture toward an invalid direct relation should instead be treated as intent to complete valid VEE structure. For example:

- dragging a DO-bearing Job toward a Product may create/select Product Job Intent and then prompt for at least one Desired Outcome before the intent can later reach a Touchpoint;
- dragging a Job or Desired Outcome toward an Offer may assign it to the Offer's semantic scope and synchronize required scope upward to Product, without creating a visible Job/DO ↔ Offer edge;
- dragging a Desired Outcome to a valid Touchpoint may create the actual cross-side connection and synchronize semantic scope upward;
- dragging Emotional Job or Social Job to a valid Touchpoint may create their direct cross-side connection and synchronize required scope upward; and
- dragging a DO-bearing Job alone to Touchpoint must not create a direct fallback edge; the UI must first ask the user to select or create one or more Desired Outcomes.

The following state table defines the proposed owner-level effects of those operations. “None” means no mutation in that owner layer; “preserve projection” always depends on another valid, selected contributing path. It specifies product behavior, not a finalized schema, transaction engine, persistence mechanism, or widget design.

| command | preconditions | contributing Offer selection | Product mutation | Offer mutation | Touchpoint mutation | visible projection | confirmation | cascade | preserved records | error state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Select Job on Product | Product and existing eligible Job selected | None | Create Product Job Intent; CFJ/RJ/CCJ may temporarily have empty DO subset as incomplete upstream knowledge | None | None | None | No | None | Job and all Client-side relationships | Duplicate intent resolves to existing record; ineligible entity is rejected |
| Select Product Job Intent in Offer | Offer belongs to intent’s Product | That Offer | None | Create Offer selection | None | None until a valid Touchpoint path exists | No | None | Product intent and Client-side records | Reject intent from another Product or duplicate selection |
| Create Touchpoint structurally | Offer exists and contextual creation identifies the required Offer relation | That Offer | None | None | Create Touchpoint plus required Offer → Touchpoint structural relation; create no Job/FDO selection, mitigation, URL, or Located in value | None | Create / Create & open Inspector share identical domain creation semantics | None | All Offer/Product/Client intent and existing map records | Validation failure leaves draft open and creates no partial state |
| Select subset of intent for a Touchpoint | Intent is in selected linked Offer scopes | Explicit Offer per selected path | None | None | Add/remove attributed local selections; CFJ/RJ/CCJ require ≥1 DO | Only selected effective routes | No, unless removal has dependent local detail | Local dependent Touchpoint detail only | All Product, Offer, and Client-side records | Reject DO-bearing Job with zero selected DO; reject intent outside chosen Offer scope |
| Select Desired Outcome on Touchpoint | Outcome has owning CFJ/RJ/CCJ; at least one linked contributing Offer chosen | One or more explicitly chosen linked Offers | Create/extend owning Job’s Product Job Intent if missing | Select/extend intent only in chosen Offers | Select owning Job and outcome per contributor atomically | `Job → Desired Outcome → Touchpoint`; no direct Job route | Confirm upstream additions in operation preview | Atomic upstream completion, not deletion | Existing Job, outcome, owning relationship, and unrelated intent | Reject orphan outcome, invalid Job, unavailable Product, or no contributor |
| Select Emotional/Social Job bottom-up with no Product intent | Touchpoint has linked Offer(s); EJ/SJ exists; contributors chosen | One or more explicitly chosen linked Offers | Create Product Job Intent for each distinct contributing Product | Create Offer selection in chosen Offers | Create attributed Job selections | One deduplicated direct `EJ/SJ → Touchpoint` route | Confirm upstream additions | Atomic creation across owners | Job and Client-side relationships | Roll back all new records if any chosen path is invalid or mutation fails |
| Select DO-bearing Job bottom-up with no Product intent | CFJ/RJ/CCJ exists and Touchpoint has linked Offer(s) | Contributor(s) chosen after DO resolution | Create/extend Product Job Intent with selected/created DO(s) | Create Offer selection in chosen Offers | Create attributed Job/DO selections | `Job → DO → Touchpoint` only | Yes; UI must select/create ≥1 DO and confirm upstream additions | Atomic creation across owners | Job, existing DOs, owning/context relationships | No direct Job fallback; abort if user does not resolve at least one DO |
| Select Desired Outcome bottom-up with no Product intent | Outcome and owning CFJ/RJ/CCJ exist; Touchpoint and contributors are valid | One or more explicitly chosen linked Offers | Create Job intent with selected outcome for each distinct Product | Create Offer selection in chosen Offers | Create attributed Job/outcome selections | One deduplicated outcome route; no direct Job route | Confirm upstream additions | Atomic creation across owners | Job, outcome, owning relationship, unrelated intent | Roll back all new records on orphan outcome, invalid contributor, or failure |
| Select intent on multi-Offer Touchpoint | Two or more Offers linked; selected intent is available or can validly be authored upstream | User must choose one or more; never all implicitly | Create/extend only Product intents required by chosen paths | Create/extend only chosen Offer selections | Create one attributed selection per chosen path | Deduplicate equal effective routes | Yes, contributor picker/preview | Atomic only across chosen paths | Unchosen Offer scopes and existing selections | Reject no contributor, unlinked Offer, or incompatible Product path |
| Select FDO on Touchpoint | FDO exists; one or more linked contributing Offers chosen | Chosen Offers only | None | Add FDO to each chosen Offer Financial Intent if missing | Create attributed FDO selections | One deduplicated `FDO → Touchpoint` route | Confirm upstream Offer additions | Atomic Offer + Touchpoint completion | Products, Product Job Intents, and all Client-side records | Reject no contributor/unlinked Offer; roll back on failure |
| Delete Touchpoint | Touchpoint exists | All its attributed paths | None | None | Delete Touchpoint, its selections, and local authored relations | Remove its projections | Yes | Touchpoint-local records only | Product intents, Offer intents/selections, Client-side entities/relationships | Reject missing target or unauthorized deletion |
| Delete Touchpoint selection | Selection exists | The attributed Offer path for that selection | None | None | Delete only selected local path | Remove route unless another effective path remains | No; confirm if local dependent detail exists | Touchpoint-local dependent detail only | Touchpoint, upstream intent, Client-side records, other contributor paths | Reject missing selection; disclose preserved duplicate projection |
| Delete Offer selection | Offer Job selection exists | That Offer | None | Delete Offer selection | Delete dependent selections attributed to it | Remove routes unless another effective path remains | Yes, with affected Touchpoints preview | Dependent Touchpoint selections | Product Job Intent, Offer, Client-side records, other paths | Reject cancellation, missing selection, or unauthorized mutation |
| Delete Product Job Intent | Product Job Intent exists | Every Offer selection of it | Delete Product Job Intent | Delete all dependent Offer selections | Delete all dependent attributed selections | Remove routes unless another valid intent/path supplies the same effective route | Yes, with full cascade preview | Offer and Touchpoint selections | Jobs, Desired Outcomes, Client-side relationships, Products, Offers, Touchpoints | Reject cancellation or unauthorized mutation; no partial cascade |
| Unlink one Offer from multi-Offer Touchpoint | Offer is linked; at least one other Offer remains linked | Unlinked Offer only | None | None | Remove link and selections attributed to it | Preserve equal routes supplied by remaining Offers; remove others | Yes, with path preview | Attributed Touchpoint selections | Offer intent, Product intent, Client-side records, remaining links/paths | Reject if Child/link invariants would fail; no partial unlink |
| Change Product on Offer | New Product exists; invalidated selections are known | The changed Offer | None | Remove old-Product Job selections; optionally initialize new scope as an explicit draft | Delete dependent selections attributed to removed selections | Preserve routes through other Offers; new scope is not projected until selected | Yes, with old-path cascade and new-scope preview | Product Job Intents on both Products, FDO intent, Client-side records | Reject cancellation/incompatible state; apply no partial change |
| Delete one of several contributing paths | Same effective intent has at least two valid attributed paths | Path selected for deletion | None | Delete Offer selection only if that is the invoked command; otherwise none | Delete selection for removed path | Keep deduplicated projection through remaining path | According to invoked upstream/local delete command | Only dependants of removed path | Remaining contributor attribution and all unrelated records | Reject ambiguous path; require explicit contributor |
| Create Child Touchpoint structurally | Parent Touchpoint exists and required Offer links can be preserved | Required Offer links inherited only as mandatory structural context | None | None | Create Child Touchpoint, parent relation, and required Offer links; create no copied Client-intent selections or deep properties | None until Client intent is authored explicitly | Create / Create & open Inspector share identical domain semantics | None | Parent selections, all upstream intent, Client-side entities/relationships | Reject invalid parent/cycle/cardinality or impossible required Offer-link state; no partial child creation |

Selection commands must expose empty scope, unresolved DO-bearing intent, invalid contributors, and atomic failure rather than imply success. Keyboard and focus details, the final contributor picker, supported input devices and viewports, persistence/reload behavior, permissions, and accessibility acceptance checks remain to be specified before implementation. Any future live Child Touchpoint inheritance requires a new state table covering pruning, local override precedence, parent/child concurrent edits, conflicts, and unlink/delete behavior.

The final modal, popover, or other interaction mechanics remain open. The governing principle is that allowed operations encode the VEE model: VEE is not a generic free-form graph editor.

### Methodological complexity and guidance

VEE models complex systems for serious systems-level work by senior product, marketing, operations, strategy, and management practitioners, including top management and C-level users where applicable. Meaningful methodological complexity is deliberate product direction, not a defect to eliminate; the UX should reduce unnecessary friction without erasing that complexity.

Future authoring should include contextual learning and help. For concepts such as Core Functional Job, concise help may explain what the concept means, how it is used, where a user may discover it, and how it may be researched or validated. The help system and its final interaction design are not part of the current runtime slice.

### 2D visual hierarchy and layout

Authored 2D node size should be stable by semantic role / structural level rather than grow whenever deeper descendants are added. Descendant-driven resizing is not the target interaction model because adding content deep in a branch should not unexpectedly resize ancestor nodes and shift the map.

The current visual direction is therefore role/level-driven hierarchy, for example Product larger than Offer and Offer larger than Touchpoint. Nested Touchpoints may remain at the Touchpoint base size or use a modestly smaller structural-level size after visual calibration. Exact pixel values are prototype/view concerns rather than domain semantics.

Node size remains a derived rendering property. It must never encode Evidence, confidence, popularity, conversion, or future attraction/repulsion force in the authored 2D view.

The current Software Alpha placement contract treats existing authored placements as fixed during automatic birth placement. An unanchored root searches deterministic outward rings around the occupied-map bounds, while a canvas-created root treats the user's Map click as its preferred top-left birth position and repairs a physical collision locally. A single new entity with one or more already placed relation anchors instead searches outward around the equal-weight anchor region. Relation proximity has priority over eliminating edge crossings, and relationship direction implies no compass direction.

Automatic birth placement forbids physical node overlap using actual rendered node geometry. Within the nearest physically usable ring, the solver prefers fewer proposed-edge crossings, then fewer existing edges through the new node, cleaner soft-guard spacing, and finally deterministic clockwise order beginning at the right / three-o'clock candidate and continuing around the full circle. Right-first is only an equal-quality tie-break, not semantic left/right graph layout. Edge conflicts are approximated with straight center-to-center segments as a local placement heuristic; this is not global graph-planarity optimization and does not change rendered edge geometry.

After Map-side creation, the camera conservatively reveals the new node and its immediate relation neighborhood. It does nothing when that local structure is already inside a safe visible inset, pans minimally while preserving the current zoom when it fits, and zooms out only as much as needed when it does not; it does not automatically zoom in or fit the whole graph. Inspector-side creation leaves the hidden camera alone until Map activation, when the selected entity and, where practical, its immediate relation neighbors receive the same local reveal. Camera response occurs after placement and cannot affect placement coordinates. Context menus and contextual creation editors anchor to their actual entity or pointer interaction source and independently flip and clamp into the visible Map panel; overlay positioning does not predict or determine the new node position. Multi-new-node birth-batch placement remains deferred. Manual dragging remains an authored local override and does not use this collision rule.

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
- Which detailed Touchpoint ↔ Client phenomenon relationship types and epistemic statuses are required beyond the accepted intent-routing semantics?
- What are the creation, confirmation, threshold, and cardinality rules for Value Realization?
- How should Buyer’s Journey classifications, filters, and suggested relationships be used?
- How should future emergent forces be calculated and explained without turning derived state into asserted fact?
- What future 3D rendering architecture, dependencies, and interaction model are appropriate?
- What exact drag-to-reparent and cross-side authoring UI mechanics preserve valid Product / Offer / Touchpoint semantics, especially for Touchpoints linked to multiple Offers?
- What final authored-map visual scale and auto-layout behavior best preserve readability without turning rendering choices into domain meaning?
- What persistence and model-history architecture best preserves evolutionary discovery without prematurely fixing a technical pattern?
- What editing permissions, collaboration, offline behavior, viewport support, input devices, and mobile editing capabilities are required?
