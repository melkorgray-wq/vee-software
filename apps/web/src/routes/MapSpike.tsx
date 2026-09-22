import { useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Background, Controls, Handle, Position, ReactFlow, type Node, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CLIENT_ROOT_ENTITY_KINDS, addEntity, addProductJobIntent, addTouchpointContainer, authorTouchpointIntentBottomUp, commitTouchpointIntentPathPlan, createEmptyMapDocument, duplicateEntity, effectiveOfferDesiredOutcomeIds, getOfferIntentChangeImpact, getProductIntentChangeImpact, getTouchpointLinkedOfferChangeImpact, isClientRootEntityKind, isContextualClientEntityKind, isRepulsorTargetKind, movePlacement, planTouchpointIntentPathChange, planTouchpointStructuralChange, relevantRepulsorsForTouchpoint, resistanceImpactForOffer, resistanceImpactForProduct, removeProductJobIntent, setContextualCoreFunctionalJobs, setOfferFinancialIntents, setOfferJobSelections, updateEntity, updateProductJobIntent, updateRepulsorTargets, type BottomUpTouchpointResult, type ContextualClientEntityKind, type Entity, type MapDocument, type ProvisionalEntityKind, type Relationship, type TouchpointIntentPathPlan, type TouchpointStructuralCommand } from '@vee/domain';
import { deriveMapEdges, deriveMapNodes, KIND_LABELS, layoutForEntity, MAP_EDGE_TYPE, type MapNodeData } from '../map-adapter';
import { MapEdge } from '../map-edge';
import { contextMenuPoint, disclosureOverlayPoint, linkedOfferIds, matchesWorkspaceShortcut, overlayPoint, parentTouchpointOptions, revealViewport, siblingDraft, siblingPlacement, workspaceShortcutAction, type Point, type WorkspaceShortcutState } from '../map-interaction';
import { focusedRelationTarget, inactiveRelationsMode, reduceRelationsMode, relationEdgeClassName, type RelationsMode } from '../map-relations-mode';
import { relationGroupsForEntity } from '../map-relation-projection';
import { deriveRelationLensTrace } from '../map-relation-lens';
import { emptyInspectorHistory, inspectorHistoryReducer, traverseInspectorHistory } from '../inspector-navigation';
import { registerDevMapBridge } from '../dev-map-bridge';
import { findFreePlacement, findPlacementNearPoint, findRelatedPlacement, reconsiderPlacementAfterRelationCommit, type ProposedPlacementRelation } from '../map-placement';
import { nearestSpatialCandidate, spatialDirectionForKey } from '../map-spatial-navigation';
import { enterMoveMode, inactiveMoveMode, moveInMode, moveVectorForKey, type MoveMode } from '../map-move-mode';
import { Link } from '../router';
import { commitTouchpointBusinessProperty, commitTouchpointLinkedOffers, commitTouchpointMitigation, commitTouchpointParent, createTouchpointIntentDraft, entityTitle, equalTouchpointIntentDraft, globalIntentDiscovery, touchpointClientScope, touchpointUpstreamSources, validateTouchpointIntentDraft, type ConnectionPickerKind, type TouchpointIntentDraft, type UpstreamLeaf } from './touchpoint-edit';
import { commitSemanticOperation, semanticCommitState } from './semantic-commit-policy';
import { deriveTouchpointBusinessStructure, deriveTouchpointChildrenCandidates, deriveTouchpointReassignTargets } from '../touchpoint-business-structure';
import { initialCompactOverviewExpandedGroupIds } from '../compact-overview-presentation';
import { useClientScopePackedLayout, usePackedPanelLayout } from '../client-scope-packed-layout';
import { deriveOfferClientIntentNeighborhood, type OfferClientIntentGround, type OfferClientIntentJobComparison, type OfferClientIntentGroundTypeId } from '../offer-client-intent-neighborhood';
import { deriveTouchpointClientIntentNeighborhood, type TouchpointClientIntentFinancialDesiredOutcomeGround, type TouchpointClientIntentJobComparison, type TouchpointClientIntentJobGround } from '../touchpoint-client-intent-neighborhood';

const VIEW_ID = 'spike-view';
export const RELATION_EDITOR_SEARCH_THRESHOLD = 7;
const INITIAL_DOCUMENT = createEmptyMapDocument({
  mapId: 'spike-map',
  title: 'Untitled validation map',
  viewId: VIEW_ID,
  viewTitle: 'Working view',
});
type Side = 'business' | 'client';
type WorkspaceView = 'map' | 'inspector';
type PostCreateContinuation = WorkspaceView;
const CLIENT_SCOPE_KIND_ORDER = ['core_functional_job', 'related_job', 'consumption_chain_job', 'emotional_job', 'social_job', 'financial_desired_outcome'] as const;
type ClientScopePanelKind = (typeof CLIENT_SCOPE_KIND_ORDER)[number];
type OperationFeedback = { text: string; kind: 'success' | 'error' };
type LocationDraft = { kind: 'none' } | { kind: 'existing'; containerId: string } | { kind: 'new'; title: string };
type EditDraft = {
  title: string;
  side: Side;
  kind: ProvisionalEntityKind;
  linkedProductId: string;
  linkedOfferIds: string[];
  selectedIntentIds: string[];
  offerIntentOutcomes: Record<string, string[]>;
  productIntentOutcomes: Record<string, string[]>;
  stagedClientEntities: { id: string; kind: 'core_functional_job' | 'emotional_job' | 'social_job' | 'consumption_chain_job' | 'desired_outcome'; title: string; parentEntityId?: string }[];
  locatedInId: string;
  locatedInQuery: string;
  locationDraft: LocationDraft;
  parentTouchpointId: string;
  parentEntityId: string;
  resistedTargetIds: string[];
  mitigatedRepulsorIds: string[];
  contextualCoreJobIds: string[];
  financialOutcomeIds: string[];
  url: string;
  productPrerequisite: 'existing' | 'new';
  newProductTitle: string;
  offerPrerequisite: 'existing' | 'new';
  newOfferTitle: string;
  touchpointIntent?: TouchpointIntentDraft;
};
type Menu =
  | {
      type: 'canvas';
      client: Point;
      overlay: Point;
      flow: Point;
      positioned: boolean;
    }
  | {
      type: 'node';
      invocation: 'keyboard' | 'pointer';
      client: Point;
      overlay: Point;
      entityId: string;
      positioned: boolean;
    };
type Quick = {
  draft: EditDraft;
  anchor: Point;
  overlay: Point;
  flow: Point;
  positioned: boolean;
};
type EntityContextCommandId = 'related-job' | 'desired-outcome' | 'canonical-child' | 'repulsor' | 'sibling' | 'duplicate' | 'inspector' | 'open-link' | 'cancel';
type EntityContextCommand = { id: EntityContextCommandId; label: string; shortcut?: string; href?: string; action: () => void };
type EntityContextCommandGroup = { id: string; heading: string; commands: EntityContextCommand[] };
type ProductConfirmation =
  | { mode: 'dirty'; pending: () => void; returnFocus: HTMLElement | null }
  | { mode: 'impact'; owner: 'product'; pending?: () => void; returnFocus: HTMLElement | null; impact: ReturnType<typeof getProductIntentChangeImpact> }
  | { mode: 'impact'; owner: 'offer'; pending?: () => void; returnFocus: HTMLElement | null; impact: ReturnType<typeof getOfferIntentChangeImpact> }
  | { mode: 'impact'; owner: 'touchpoint'; immediateCommit: () => void; returnFocus: HTMLElement | null; impact: ReturnType<typeof getTouchpointLinkedOfferChangeImpact> };
type ClientScopeEditor = { mode: 'upstream' | 'global-search' | 'current-contributor-choice' | 'ancestor-contributor-choice' | 'invalid'; actionOrigin?: 'parent-source' | 'global-discovery'; query: string; kind?: ConnectionPickerKind | undefined; target?: { leaf: UpstreamLeaf } | undefined; currentContributorCandidateIds?: string[]; contributorOfferIds: string[]; ancestorContributingOfferIds: Record<string, string>; unresolved?: Extract<BottomUpTouchpointResult, { status: 'unresolved' | 'invalid' }> };
type ChildrenEditor =
  | { mode: 'list'; query: string; error?: string }
  | { mode: 'reassign-one' | 'reassign-all'; query: string; childTouchpointIds: string[]; error?: string }
  | { mode: 'resolve-contributor'; query: string; command: TouchpointStructuralCommand; choices: Record<string, string>; obligationKey: string; touchpointId: string; candidateOfferIds: string[]; returnMode: 'list' | 'reassign-one' | 'reassign-all'; error?: string }
  | { mode: 'create-child'; query: string; title: string; offerId: string; error?: string };
function previousChildrenEditorLevel(editor: ChildrenEditor): ChildrenEditor {
  if (editor.mode !== 'resolve-contributor' || editor.returnMode === 'list') return { mode: 'list', query: '' };
  return { mode: editor.returnMode, query: '', childTouchpointIds: [...editor.command.childTouchpointIds] };
}
const draft = (kind: ProvisionalEntityKind = 'product'): EditDraft => ({
  title: '',
  side: isClientRootEntityKind(kind) || isContextualClientEntityKind(kind) || kind === 'repulsor' ? 'client' : 'business',
  kind,
  linkedProductId: '',
  linkedOfferIds: [],
  selectedIntentIds: [],
  offerIntentOutcomes: {},
  productIntentOutcomes: {},
  stagedClientEntities: [],
  locatedInId: '',
  locatedInQuery: '',
  locationDraft: { kind: 'none' },
  parentTouchpointId: '',
  parentEntityId: '',
  resistedTargetIds: [],
  mitigatedRepulsorIds: [],
  contextualCoreJobIds: [],
  financialOutcomeIds: [],
  url: '',
  productPrerequisite: 'existing',
  newProductTitle: '',
  offerPrerequisite: 'existing',
  newOfferTitle: '',
});
const isEditableControl = (target: EventTarget | null) => target instanceof HTMLElement && (target.contentEditable === 'true' || Boolean(target.closest('input, textarea, select, [role="textbox"], [role="combobox"], [contenteditable]')));
const isKeyboardOwnedControl = (target: EventTarget | null) => target instanceof HTMLElement && !target.closest('[data-node-id], .react-flow__node[data-id]') && Boolean(target.closest('button, form, [role="dialog"], [role="menu"], [role="listbox"], [popover], .contextual-editor'));
const hasCanonicalChild = (entity: Entity) => entity.kind === 'product' || entity.kind === 'offer' || entity.kind === 'touchpoint' || entity.kind === 'core_functional_job' || entity.kind === 'consumption_chain_job' || entity.kind === 'related_job';
const safeUrl = (url?: string) => (url && !/^\s*(javascript|data):/i.test(url) ? url : undefined);
const normalizeTitleLineBreaks = (value: string) => value.replace(/[\r\n\u2028\u2029]+/g, ' ');
function resizeAutoGrowingField(field: HTMLTextAreaElement) {
  field.style.height = 'auto';
  field.style.height = `${field.scrollHeight}px`;
}
export function isRenderedTitleTruncated(title: HTMLElement) {
  // CSSOM exposes these dimensions as rounded CSS pixels. A one-pixel height
  // difference can therefore describe the same visible line box; another
  // clamped line exceeds this margin by approximately one full line height.
  // `overflow-wrap: anywhere` makes extra lines, rather than horizontal
  // overflow, the title box's content-hiding boundary.
  return title.scrollHeight - title.clientHeight > 1;
}
function AutoGrowingTitleField({ value, onChange, autoFocus = false }: { value: string; onChange: (value: string) => void; autoFocus?: boolean }) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const focusedForOpeningRef = useRef(false);
  useLayoutEffect(() => {
    if (fieldRef.current) resizeAutoGrowingField(fieldRef.current);
  }, [value]);
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!autoFocus || !field || focusedForOpeningRef.current) return;
    const unrelatedDialog = Array.from(globalThis.document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"]')).find(
      (dialog) => !dialog.contains(field) && !dialog.closest('[hidden], [aria-hidden="true"]'),
    );
    if (unrelatedDialog) return;
    field.focus();
    focusedForOpeningRef.current = true;
  }, [autoFocus]);
  return (
    <label>
      Title
      <textarea
        ref={fieldRef}
        className="auto-growing-title"
        rows={1}
        required
        value={value}
        onChange={(event) => onChange(normalizeTitleLineBreaks(event.target.value))}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }}
      />
    </label>
  );
}
function ProductPrerequisiteFields({ draftValue, setDraftValue, document }: { draftValue: EditDraft; setDraftValue: (value: EditDraft) => void; document: MapDocument }) {
  return (
    <fieldset>
      <legend>Which Product does this Offer package?</legend>
      <label className="checkbox"><input type="radio" name="product-prerequisite" checked={draftValue.productPrerequisite === 'existing'} onChange={() => setDraftValue({ ...draftValue, productPrerequisite: 'existing', linkedProductId: '' })} />Choose an existing Product</label>
      {draftValue.productPrerequisite === 'existing' && <select aria-label="Existing Product" required value={draftValue.linkedProductId} onChange={(event) => setDraftValue({ ...draftValue, linkedProductId: event.target.value })}><option value="">Choose a Product</option>{document.entities.filter((entity) => entity.kind === 'product').map((entity) => <option key={entity.id} value={entity.id}>{entity.title}</option>)}</select>}
      <label className="checkbox"><input type="radio" name="product-prerequisite" checked={draftValue.productPrerequisite === 'new'} onChange={() => setDraftValue({ ...draftValue, productPrerequisite: 'new', linkedProductId: '' })} />Create new Product</label>
      {draftValue.productPrerequisite === 'new' && <label>New Product title<input required value={draftValue.newProductTitle} onChange={(event) => setDraftValue({ ...draftValue, newProductTitle: event.target.value })} /></label>}
    </fieldset>
  );
}
function ContainerCombobox({ value, query, document, onChange }: { value: string; query: string; document: MapDocument; onChange: (selection: LocationDraft, query: string) => void }) {
  const [open, setOpen] = useState(false);
  const normalized = query.trim().toLocaleLowerCase();
  const matches = document.touchpointContainers.filter((c) => c.title.toLocaleLowerCase().includes(normalized));
  const exact = document.touchpointContainers.find((c) => c.title.trim().toLocaleLowerCase() === normalized);
  return (
    <div className="combobox">
      <label>
        Located in
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls="container-options"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setOpen(true);
            onChange({ kind: 'none' }, e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && open) {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        />
      </label>
      {open && (
        <div id="container-options" role="listbox">
          {matches.map((c) => (
            <button
              type="button"
              role="option"
              aria-selected={value === c.id}
              key={c.id}
              onClick={() => {
                onChange({ kind: 'existing', containerId: c.id }, c.title);
                setOpen(false);
              }}
            >
              {c.title}
            </button>
          ))}
          {normalized && !exact && (
            <button
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onChange({ kind: 'new', title: query.trim() }, query.trim());
                setOpen(false);
              }}
            >
              Create &quot;{query.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
function InlineTitleEditor({ title, onCommit, onCancel, className = 'inline-node-title nodrag nopan', accessibleLabel = `Edit title for ${title}`, stopPointerEvents = true, autoSize = false }: { title: string; onCommit: (title: string) => boolean | void; onCancel: () => void; className?: string; accessibleLabel?: string; stopPointerEvents?: boolean; autoSize?: boolean }) {
  const [draftTitle, setDraftTitle] = useState(() => title);
  const completedRef = useRef(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!autoSize || !field) return;
    field.style.height = 'auto';
    if (field.scrollHeight) field.style.height = `${field.scrollHeight}px`;
  }, [autoSize, draftTitle]);
  const commit = (field: HTMLTextAreaElement) => {
    if (completedRef.current) return;
    if (!draftTitle.trim()) {
      requestAnimationFrame(() => field.focus());
      return;
    }
    const committed = onCommit(draftTitle);
    if (committed === false) {
      requestAnimationFrame(() => field.focus());
      return;
    }
    completedRef.current = true;
  };
  return (
    <textarea
      ref={fieldRef}
      className={className}
      aria-label={accessibleLabel}
      rows={autoSize ? 1 : 2}
      value={draftTitle}
      autoFocus
      onChange={(event) => setDraftTitle(normalizeTitleLineBreaks(event.target.value))}
      onPointerDown={stopPointerEvents ? (event) => event.stopPropagation() : undefined}
      onDoubleClick={stopPointerEvents ? (event) => event.stopPropagation() : undefined}
      onBlur={(event) => commit(event.currentTarget)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          commit(event.currentTarget);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          completedRef.current = true;
          onCancel();
        }
      }}
    />
  );
}
function ClientScopePackedGroups({ panelIds, children }: { panelIds: readonly string[]; children: React.ReactElement<{ className?: string; style?: CSSProperties }>[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const packedLayout = useClientScopePackedLayout(containerRef, panelIds);
  return <div ref={containerRef} className={`client-scope-view-groups${packedLayout.packed ? ' is-packed' : ''}`} style={packedLayout.containerStyle}>
    {children.map((child, index) => {
      const id = panelIds[index]!;
      return <section {...child.props} key={id} data-client-scope-panel-id={id} className={child.props.className} style={packedLayout.panelStyle(id)} />;
    })}
  </div>;
}

type NeighborhoodPresentationGroup = {
  id: string;
  label: string;
  groundTypeId: string;
  groundTypeLabel: string;
  count: number;
  linkedEntities: { id: string; title: string }[];
  basisKind: string;
  basisId: string;
  renderExpandedContent?: (onNavigate: (entityId: string) => void) => React.ReactNode;
};

type NeighborhoodSemanticEntity = { id: string; title: string };
type NeighborhoodSemanticContributorGroup = { label: string; offers: NeighborhoodSemanticEntity[] };
type NeighborhoodSemanticOutcome = { entity: NeighborhoodSemanticEntity; provenance?: NeighborhoodSemanticContributorGroup[] };
type NeighborhoodSemanticCategory = { label: string; outcomes: NeighborhoodSemanticOutcome[] };
type NeighborhoodSemanticNeighborBlock = {
  entity: NeighborhoodSemanticEntity;
  contributorGroups?: NeighborhoodSemanticContributorGroup[];
  outcomeCategories?: NeighborhoodSemanticCategory[];
};
type NeighborhoodSemanticViewModel = {
  basisLabel: string;
  basisEntity: NeighborhoodSemanticEntity;
  explanation?: string;
  contributorGroups?: NeighborhoodSemanticContributorGroup[];
  neighbors: NeighborhoodSemanticNeighborBlock[];
};

const CLIENT_INTENT_GROUND_TYPE_LABELS: Record<OfferClientIntentGroundTypeId, string> = {
  core_functional_job: 'Core Functional Job',
  related_job: 'Related Job',
  consumption_chain_job: 'Consumption Chain Job',
  emotional_job: 'Emotional Job',
  social_job: 'Social Job',
  financial_desired_outcome: 'Financial Desired Outcome',
};

function SemanticNeighborhoodContent({ model, onNavigate }: { model: NeighborhoodSemanticViewModel; onNavigate: (entityId: string) => void }) {
  const link = (entity: NeighborhoodSemanticEntity) => <button type="button" onClick={() => onNavigate(entity.id)}>{entity.title}</button>;
  const contributors = (groups: readonly NeighborhoodSemanticContributorGroup[] | undefined) => groups?.map(group => <div className="semantic-neighborhood-provenance" key={group.label}>
    <span>{group.label}</span>
    <ul>{group.offers.map(offer => <li key={offer.id}>{link(offer)}</li>)}</ul>
  </div>);
  return <div className="semantic-neighborhood-content">
    <div className="semantic-neighborhood-basis"><span>{model.basisLabel}</span>{link(model.basisEntity)}</div>
    {model.explanation && <p className="semantic-neighborhood-explanation">{model.explanation}</p>}
    {contributors(model.contributorGroups)}
    {model.neighbors.map(neighbor => <section className="semantic-neighborhood-neighbor-block" key={neighbor.entity.id} aria-label={neighbor.outcomeCategories ? `Desired Outcome comparison with ${neighbor.entity.title}` : `Neighbor ${neighbor.entity.title}`}>
      <div className="semantic-neighborhood-neighbor">{link(neighbor.entity)}</div>
      {contributors(neighbor.contributorGroups)}
      {neighbor.outcomeCategories && <div className="semantic-neighborhood-job-outcome-branch">{neighbor.outcomeCategories.map(category => <div className="semantic-neighborhood-comparison-category" key={category.label}>
        <span className="semantic-neighborhood-category-label">{category.label}</span>
        {category.outcomes.length ? <ul>{category.outcomes.map(outcome => <li key={outcome.entity.id}><div className="semantic-neighborhood-outcome">{link(outcome.entity)}{contributors(outcome.provenance)}</div></li>)}</ul> : <span className="semantic-neighborhood-empty">None</span>}
      </div>)}</div>}
    </section>)}
  </div>;
}

function NeighborhoodGroups({ groups, entityNoun, inspectedOwnerId, expansionSnapshot, onToggle, emptyStateText, onNavigate, className = '', ariaLabel, contentIdPrefix }: {
  groups: readonly NeighborhoodPresentationGroup[];
  entityNoun: 'Offers' | 'Touchpoints';
  inspectedOwnerId: string;
  expansionSnapshot: Readonly<Record<string, boolean>> | undefined;
  onToggle: (groupId: string) => void;
  emptyStateText: string;
  onNavigate: (entityId: string) => void;
  className?: string;
  ariaLabel: string;
  contentIdPrefix: string;
}) {
  type FocusMode = 'dim' | 'hide';
  type FocusState = { ownerId: string; selectedGroundTypeIds: Set<string>; focusMode: FocusMode };
  const [storedFocusState, setStoredFocusState] = useState<FocusState>(() => ({ ownerId: inspectedOwnerId, selectedGroundTypeIds: new Set(), focusMode: 'dim' }));
  const availableTypes = groups.reduce<{ id: string; label: string }[]>((types, group) => {
    if (!types.some(type => type.id === group.groundTypeId)) types.push({ id: group.groundTypeId, label: group.groundTypeLabel });
    return types;
  }, []);
  const availableTypeIds = new Set(availableTypes.map(type => type.id));
  const ownerFocusState = storedFocusState.ownerId === inspectedOwnerId
    ? storedFocusState
    : { ownerId: inspectedOwnerId, selectedGroundTypeIds: new Set<string>(), focusMode: 'dim' as const };
  const selectedGroundTypeIds = new Set([...ownerFocusState.selectedGroundTypeIds].filter(id => availableTypeIds.has(id)));
  const focusMode = ownerFocusState.focusMode;
  const hasSelection = selectedGroundTypeIds.size > 0;
  const initialExpansion = initialCompactOverviewExpandedGroupIds(groups);
  const isExpanded = (groupId: string) => expansionSnapshot?.[groupId] ?? (expansionSnapshot ? false : initialExpansion.has(groupId));
  const orderedGroups = [...groups].sort((left, right) => Number(isExpanded(right.id)) - Number(isExpanded(left.id)));
  const displayedGroups = hasSelection && focusMode === 'hide'
    ? orderedGroups.filter(group => selectedGroundTypeIds.has(group.groundTypeId))
    : orderedGroups;
  const containerRef = useRef<HTMLDivElement>(null);
  const packedLayout = usePackedPanelLayout(containerRef, displayedGroups.map(group => group.id), {
    panelSelector: ':scope > .derived-neighborhood-slice',
    panelIdAttribute: 'data-packed-panel-id',
    minPanelWidthRem: 14,
    maxPanelWidthRem: 20,
    gapRem: .65,
  });
  const updateFocusState = (selected: Set<string>, mode: FocusMode = focusMode) => {
    setStoredFocusState({ ownerId: inspectedOwnerId, selectedGroundTypeIds: selected, focusMode: mode });
  };
  return <section className={`business-structure-derived neighborhood-groups ${className}`.trim()} aria-label={ariaLabel}>
    <div className="derived-heading"><h5>Neighborhood</h5><span>Derived</span></div>
    <div className="derived-neighborhood-focus-controls" aria-label="Neighborhood focus controls">
      <fieldset className="derived-neighborhood-type-overview">
        <legend>Ground types</legend>
        <div className="derived-neighborhood-type-options">{availableTypes.map(type => <label className="derived-neighborhood-type-chip" key={type.id}>
          <input type="checkbox" checked={selectedGroundTypeIds.has(type.id)} onChange={event => {
            event.currentTarget.focus();
            const next = new Set(selectedGroundTypeIds);
            if (event.currentTarget.checked) next.add(type.id); else next.delete(type.id);
            updateFocusState(next);
          }} />
          <span>{type.label}</span>
        </label>)}</div>
      </fieldset>
      <fieldset className="derived-neighborhood-mode-controls">
        <legend>Focus mode</legend>
        <label><input type="radio" name={`${contentIdPrefix}-${inspectedOwnerId}-focus-mode`} value="dim" checked={focusMode === 'dim'} onChange={event => { event.currentTarget.focus(); updateFocusState(selectedGroundTypeIds, 'dim'); }} />Dim</label>
        <label><input type="radio" name={`${contentIdPrefix}-${inspectedOwnerId}-focus-mode`} value="hide" checked={focusMode === 'hide'} onChange={event => { event.currentTarget.focus(); updateFocusState(selectedGroundTypeIds, 'hide'); }} />Hide</label>
      </fieldset>
      <button type="button" className="derived-neighborhood-reset" disabled={!hasSelection} onClick={event => { event.currentTarget.focus(); updateFocusState(new Set()); }}>Reset ground type filters</button>
    </div>
    <div ref={containerRef} className={`derived-neighborhood-slices${packedLayout.packed ? ' is-packed' : ''}`} style={packedLayout.containerStyle}>
      {displayedGroups.map(group => {
        const expanded = isExpanded(group.id);
        const dimmed = hasSelection && focusMode === 'dim' && !selectedGroundTypeIds.has(group.groundTypeId);
        const contentId = `${contentIdPrefix}-${encodeURIComponent(inspectedOwnerId)}-${encodeURIComponent(group.id)}`;
        return <div className={`business-structure-property derived-neighborhood-slice${dimmed ? ' is-dimmed' : ''}`} role="group" aria-label={group.label} data-ground-type-id={group.groundTypeId} data-basis-kind={group.basisKind} data-basis-id={group.basisId} data-packed-panel-id={group.id} style={packedLayout.panelStyle(group.id)} key={group.id}>
          <button type="button" className="derived-neighborhood-disclosure" aria-expanded={expanded} aria-controls={contentId} aria-label={`${group.label}, ${group.count} ${entityNoun}`} onClick={() => onToggle(group.id)}>
            <span className="derived-neighborhood-chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
            <span className="derived-neighborhood-label">{group.label}</span>
            <span className="derived-neighborhood-count">{group.count}</span>
          </button>
          <div className="derived-neighborhood-content" id={contentId} hidden={!expanded}>
            {expanded && (group.renderExpandedContent ? group.renderExpandedContent(onNavigate) : group.linkedEntities.length
              ? <ul className="business-structure-links">{group.linkedEntities.map(entity => <li key={entity.id}><button type="button" onClick={() => onNavigate(entity.id)}>{entity.title}</button></li>)}</ul>
              : <p className="business-structure-empty">{emptyStateText}</p>)}
          </div>
        </div>;
      })}
    </div>
  </section>;
}

export function MapNode({ data }: { data: MapNodeData }) {
  const url = safeUrl(data.url);
  const nodeContentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLElement>(null);
  const disclosureRef = useRef<HTMLDivElement>(null);
  const relationOverlayRef = useRef<HTMLDivElement>(null);
  const [titleHovered, setTitleHovered] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const [disclosureHovered, setDisclosureHovered] = useState(false);
  const [titleTruncated, setTitleTruncated] = useState(false);
  const [disclosure, setDisclosure] = useState<{ owner: HTMLElement; x: number; y: number } | null>(null);
  const [relationOverlay, setRelationOverlay] = useState<{ owner: HTMLElement; x: number; y: number } | null>(null);
  const disclosed = data.inlineTitle === undefined && titleTruncated && (titleHovered || titleFocused || disclosureHovered);
  const measureTitle = (title: HTMLElement | null) => setTitleTruncated(Boolean(title && isRenderedTitleTruncated(title)));
  useLayoutEffect(() => {
    const title = titleRef.current;
    measureTitle(title);
    if (!title || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measureTitle(title));
    observer.observe(title);
    return () => observer.disconnect();
  }, [data.inlineTitle, data.kindLabel, data.layout.contentWidth, data.layout.titleFontSize, data.title]);
  useLayoutEffect(() => {
    setTitleHovered(false);
    setTitleFocused(false);
    setDisclosureHovered(false);
    setDisclosure(null);
  }, [data.inlineTitle, data.title]);
  useLayoutEffect(() => {
    const title = titleRef.current;
    const panel = title?.closest<HTMLElement>('#map-workspace-panel');
    const owner = panel?.querySelector<HTMLElement>('[data-map-disclosure-layer]') ?? panel ?? globalThis.document.body;
    const overlay = disclosureRef.current;
    if (!disclosed || !title || !owner || !overlay) return;
    const point = disclosureOverlayPoint(title.getBoundingClientRect(), owner.getBoundingClientRect(), overlay.getBoundingClientRect());
    setDisclosure({ owner, ...point });
  }, [disclosed, data.title]);
  useLayoutEffect(() => {
    const satellite = nodeContentRef.current;
    const panel = satellite?.closest<HTMLElement>('#map-workspace-panel');
    const owner = panel?.querySelector<HTMLElement>('[data-map-disclosure-layer]') ?? panel ?? globalThis.document.body;
    const overlay = relationOverlayRef.current;
    if (!data.satellite?.focused || !satellite || !owner || !overlay) return;
    const point = disclosureOverlayPoint(satellite.getBoundingClientRect(), owner.getBoundingClientRect(), overlay.getBoundingClientRect());
    setRelationOverlay({ owner, ...point });
  }, [data.satellite?.focused, data.satellite?.focusedTargetId, data.satellite?.titles]);
  const style = {
    '--node-title-size': `${data.layout.titleFontSize}px`,
    '--node-kind-size': `${data.layout.kindFontSize}px`,
    '--node-content-width': `${data.layout.contentWidth}px`,
  } as CSSProperties;
  if (data.satellite?.child) return (
    <div className="node-content satellite-content satellite-child-content" style={style}>
      <strong className="node-title satellite-title" aria-label={data.title}>{data.title}</strong>
      <span>{data.kindLabel}</span>
    </div>
  );
  if (data.satellite) return (
    <div ref={nodeContentRef} className={`node-content satellite-content${data.satellite.focused ? ' relation-focused' : ''}`} style={style}>
      <strong ref={titleRef} className="node-title satellite-title" tabIndex={0} aria-label={`${data.kindLabel}: ${data.satellite.titles.join(', ')}`} onMouseEnter={(event) => { measureTitle(event.currentTarget); setTitleHovered(true); }} onMouseLeave={() => setTitleHovered(false)} onFocus={(event) => { measureTitle(event.currentTarget); setTitleFocused(true); }} onBlur={() => setTitleFocused(false)}>{data.kindLabel}</strong>
      <span aria-label={`${data.satellite.targetIds.length} targets`}>{data.satellite.targetIds.length}</span>
      {data.satellite.focused && createPortal(<div ref={relationOverlayRef} className="relation-target-overlay" role="listbox" aria-label={`${data.kindLabel} relation targets`} style={{ left: relationOverlay?.x ?? 8, top: relationOverlay?.y ?? 8, visibility: relationOverlay ? 'visible' : 'hidden' }}>{data.satellite.titles.map((title, index) => <div role="option" tabIndex={0} aria-selected={data.satellite?.targetIds[index] === data.satellite?.focusedTargetId} key={data.satellite?.targetIds[index]} onClick={(event) => { event.stopPropagation(); data.satellite?.onTargetClick?.(index); }}>{title}</div>)}</div>, relationOverlay?.owner ?? nodeContentRef.current?.closest<HTMLElement>('#map-workspace-panel')?.querySelector<HTMLElement>('[data-map-disclosure-layer]') ?? globalThis.document.body)}
      {disclosed && createPortal(<div ref={disclosureRef} role="tooltip" className="title-disclosure satellite-disclosure" style={{ left: disclosure?.x ?? 8, top: disclosure?.y ?? 8, visibility: disclosure ? 'visible' : 'hidden' }} onMouseEnter={() => setDisclosureHovered(true)} onMouseLeave={() => setDisclosureHovered(false)}>{data.satellite.titles.join(', ')}</div>, disclosure?.owner ?? titleRef.current?.closest<HTMLElement>('#map-workspace-panel') ?? globalThis.document.body)}
    </div>
  );
  return (
    <div className={`node-content${data.layout.compactTitle ? ' compact-title' : ''}`} style={style}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {data.inlineTitle === undefined ? <strong ref={titleRef} className="node-title" tabIndex={0} aria-label={data.title} onMouseEnter={(event) => { measureTitle(event.currentTarget); setTitleHovered(true); }} onMouseLeave={() => setTitleHovered(false)} onFocus={(event) => { measureTitle(event.currentTarget); setTitleFocused(true); }} onBlur={() => setTitleFocused(false)} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); data.onTitleDoubleClick?.(); }}>{data.title}</strong> : (
        <InlineTitleEditor title={data.inlineTitle} onCommit={(title) => data.onInlineTitleCommit?.(title)} onCancel={() => data.onInlineTitleCancel?.()} />
      )}
      <span>{data.kindLabel}</span>
      {url && (
        <a className="node-link nodrag nopan" href={url} target="_blank" rel="noreferrer" aria-label={`Open ${data.title}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          ↗
        </a>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} />
      {disclosed && createPortal(<div ref={disclosureRef} role="tooltip" className="title-disclosure" style={{ left: disclosure?.x ?? 8, top: disclosure?.y ?? 8, visibility: disclosure ? 'visible' : 'hidden' }} onMouseEnter={() => setDisclosureHovered(true)} onMouseLeave={() => setDisclosureHovered(false)}>{data.title}</div>, disclosure?.owner ?? titleRef.current?.closest<HTMLElement>('#map-workspace-panel') ?? globalThis.document.body)}
    </div>
  );
}

export function MapSpike({ initialDocument = INITIAL_DOCUMENT }: { initialDocument?: MapDocument } = {}) {
  const panelRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuOwnerRef = useRef<HTMLElement | null>(null);
  const contextualEditorRef = useRef<HTMLElement>(null);
  const flowRef = useRef<ReactFlowInstance<Node<MapNodeData>> | null>(null);
  const pendingInspectorRevealRef = useRef<string[] | null>(null);
  const [document, setDocument] = useState<MapDocument>(initialDocument);
  const documentRef = useRef(document);
  documentRef.current = document;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [relationsMode, setRelationsMode] = useState<RelationsMode>(inactiveRelationsMode);
  const relationsModeRef = useRef(relationsMode);
  relationsModeRef.current = relationsMode;
  const [moveMode, setMoveMode] = useState<MoveMode>(inactiveMoveMode);
  const moveModeRef = useRef(moveMode);
  moveModeRef.current = moveMode;
  const [inspectorHistory, dispatchInspectorHistory] = useReducer(inspectorHistoryReducer, undefined, emptyInspectorHistory);
  const inspectorHistoryRef = useRef(inspectorHistory);
  inspectorHistoryRef.current = inspectorHistory;
  const [activeWorkspaceView, setActiveWorkspaceView] = useState<WorkspaceView>('map');
  const activeWorkspaceViewRef = useRef(activeWorkspaceView);
  activeWorkspaceViewRef.current = activeWorkspaceView;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const [mode, setMode] = useState<'idle' | 'create'>('idle');
  const [createDraft, setCreateDraft] = useState<EditDraft>(draft());
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [offersPicker, setOffersPicker] = useState<{ query: string } | null>(null);
  const [parentPicker, setParentPicker] = useState<{ query: string } | null>(null);
  const [childrenEditor, setChildrenEditor] = useState<ChildrenEditor | null>(null);
  const relationEditorRef = useRef<HTMLDivElement>(null);
  const childrenEditorRef = useRef<HTMLDivElement>(null);
  const childrenEditorButtonRef = useRef<HTMLButtonElement>(null);
  const discardChildCreationRef = useRef(false);
  const parentPickerButtonRef = useRef<HTMLButtonElement>(null);
  const locatedInEditButtonRef = useRef<HTMLButtonElement>(null);
  const urlEditButtonRef = useRef<HTMLButtonElement>(null);
  const offersPickerButtonRef = useRef<HTMLButtonElement>(null);
  const [businessInlineEdit, setBusinessInlineEdit] = useState<{ property: 'url'; value: string; error?: string } | { property: 'located-in'; query: string; error?: string } | null>(null);
  const [productExpanded, setProductExpanded] = useState<Record<string, boolean>>({});
  const [offerExpanded, setOfferExpanded] = useState<Record<string, boolean>>({});
  const [neighborhoodExpanded, setNeighborhoodExpanded] = useState<Record<string, Record<string, boolean>>>({});
  const [offerNeighborhoodExpanded, setOfferNeighborhoodExpanded] = useState<Record<string, Record<string, boolean>>>({});
  const [connectionPicker, setConnectionPicker] = useState<ClientScopeEditor | null>(null);
  const [expandedClientSources, setExpandedClientSources] = useState<Record<string, boolean>>({});
  const [expandedClientScopePanels, setExpandedClientScopePanels] = useState<Record<string, Partial<Record<ClientScopePanelKind, boolean>>>>({});
  const [localRemoval, setLocalRemoval] = useState<{ plans: TouchpointIntentPathPlan[]; mitigationRelationshipIds: string[]; cancelFocusId: string; commitFocusIds: string[] } | null>(null);
  const pendingLocalFocusIdsRef = useRef<string[]>([]);
  const connectionPickerButtonRef = useRef<HTMLButtonElement>(null);
  const clientScopeEditorRef = useRef<HTMLElement>(null);
  const [offerIntentSectionIds, setOfferIntentSectionIds] = useState<Record<string, string[]>>({});
  const [offerSelectionMemory, setOfferSelectionMemory] = useState<Record<string, string[]>>({});
  const [productIntentSectionIds, setProductIntentSectionIds] = useState<string[]>([]);
  const [rememberedProductOutcomes, setRememberedProductOutcomes] = useState<Record<string, string[]>>({});
  const rememberedProductOutcomesRef = useRef<Record<string, string[]>>({});
  const [productConfirmation, setProductConfirmation] = useState<ProductConfirmation | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const productApplyBypassRef = useRef(false);
  const pendingAfterApplyRef = useRef<(() => void) | null>(null);
  const [productAddingKind, setProductAddingKind] = useState(false);
  const [productInline, setProductInline] = useState<{ kind: 'job'; entityKind: 'core_functional_job' | 'emotional_job' | 'social_job' | 'consumption_chain_job' } | { kind: 'outcome'; jobId: string } | null>(null);
  const [productInlineTitle, setProductInlineTitle] = useState('');
  const [menu, setMenu] = useState<Menu | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ entityId: string; title: string } | null>(null);
  const [inspectorTitleEdit, setInspectorTitleEdit] = useState<{ entityId: string; title: string } | null>(null);
  const inspectorTitleButtonRef = useRef<HTMLButtonElement>(null);
  const [quick, setQuick] = useState<Quick | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedRef = useRef(copiedId);
  copiedRef.current = copiedId;
  const [message, setMessage] = useState<OperationFeedback | null>(null);
  const publishSuccess = (text: string) => setMessage({ text, kind: 'success' });
  const publishError = (text: string) => setMessage({ text, kind: 'error' });
  const clearMessage = () => setMessage(null);
  const focusedGroup = relationsMode.state === 'inactive' ? undefined : relationsMode.groups[relationsMode.groupIndex];
  const relationTargetId = focusedRelationTarget(relationsMode);
  const relationLens = relationsMode.state !== 'inactive' && relationTargetId ? deriveRelationLensTrace(document, relationsMode.sourceId, relationTargetId) : undefined;
  const lensEntityIds = relationLens ? new Set(relationLens.entityIds) : null;
  const activeSatelliteId = relationsMode.state === 'inactive' ? undefined : `satellite:${relationsMode.sourceId}:${focusedGroup?.satelliteKind}`;
  const nodes = deriveMapNodes(document, VIEW_ID, selectedId, relationsMode.state !== 'inactive' && relationTargetId ? { sourceId: relationsMode.sourceId, targetId: relationTargetId } : undefined).map((node) => ({
    ...node,
    className: `${node.className ?? ''}${moveMode.state === 'moving' && moveMode.entityId === node.id ? ' move-mode-node' : ''}${relationLens && !(node.data.satellite ? node.id === activeSatelliteId || (node.data.satellite.child && node.data.satellite.targetIds.some(id => lensEntityIds!.has(id))) : lensEntityIds!.has(node.id)) ? ' relation-lens-dimmed' : ''}`.trim(),
    type: 'mapNode',
    draggable: node.data.satellite ? false : inlineEdit?.entityId !== node.id,
    data: inlineEdit?.entityId === node.id ? {
      ...node.data,
      inlineTitle: inlineEdit.title,
      onInlineTitleCommit: (title: string) => finishInlineTitleEdit(title),
      onInlineTitleCancel: () => finishInlineTitleEdit(false),
    } : { ...node.data, ...(node.data.satellite ? { satellite: { ...node.data.satellite, focused: !node.data.satellite.child && node.id === activeSatelliteId, ...(relationTargetId && !node.data.satellite.child ? { focusedTargetId: relationTargetId } : {}), ...(!node.data.satellite.child && node.id === activeSatelliteId ? { onTargetClick: (targetIndex: number) => setRelationsMode(current => reduceRelationsMode(current, { type: 'choose-target', targetIndex }).mode) } : {}) } } : { onTitleDoubleClick: () => startInlineTitleEdit(node.id) }) },
  }));
  const relevantEdgeIds = relationLens ? new Set(relationLens.edgeIds) : null;
  const edges = deriveMapEdges(document).map(edge => ({ ...edge, className: relationEdgeClassName(edge.className, edge.id, relevantEdgeIds) }));
  const selected = document.entities.find((e) => e.id === selectedId);
  const touchpointBusinessStructure = selected?.kind === 'touchpoint'
    ? deriveTouchpointBusinessStructure(document, selected.id)
    : undefined;
  const inspectorDirty = Boolean(selected && editDraft && (() => { const baseline = draftFor(selected); return JSON.stringify({ ...editDraft, touchpointIntent: undefined }) !== JSON.stringify({ ...baseline, touchpointIntent: undefined }) || Boolean(editDraft.touchpointIntent && baseline.touchpointIntent && !equalTouchpointIntentDraft(editDraft.touchpointIntent, baseline.touchpointIntent)); })());

  function resetDocumentInteractionState() {
    setSelectedId(null);
    selectedRef.current = null;
    setEditDraft(null);
    setInspectorTitleEdit(null);
    setInlineEdit(null);
    dispatchInspectorHistory({ type: 'replace', history: emptyInspectorHistory() });
    setMenu(null);
    setQuick(null);
    setMode('idle');
    setCreateDraft(draft());
    setOffersPicker(null);
    setParentPicker(null);
    setChildrenEditor(null);
    setBusinessInlineEdit(null);
    setConnectionPicker(null);
    setExpandedClientSources({});
    setExpandedClientScopePanels({});
    setLocalRemoval(null);
    const neutralRelationsMode = inactiveRelationsMode();
    setRelationsMode(neutralRelationsMode);
    relationsModeRef.current = neutralRelationsMode;
    const neutralMoveMode = inactiveMoveMode();
    setMoveMode(neutralMoveMode);
    moveModeRef.current = neutralMoveMode;
    setProductConfirmation(null);
    setProductAddingKind(false);
    setProductInline(null);
    setProductInlineTitle('');
    setProductExpanded({});
    setOfferExpanded({});
    setNeighborhoodExpanded({});
    setOfferNeighborhoodExpanded({});
    setOfferIntentSectionIds({});
    setOfferSelectionMemory({});
    setProductIntentSectionIds([]);
    setRememberedProductOutcomes({});
    rememberedProductOutcomesRef.current = {};
    pendingInspectorRevealRef.current = null;
    pendingAfterApplyRef.current = null;
    productApplyBypassRef.current = false;
    setCopiedId(null);
    copiedRef.current = null;
    setMessage(null);
  }

  useEffect(() => registerDevMapBridge(import.meta.env.DEV, () => documentRef.current, nextDocument => {
    resetDocumentInteractionState();
    documentRef.current = nextDocument;
    setDocument(nextDocument);
  }), []);

  useEffect(() => {
    if (message?.kind !== 'success') return;
    const currentMessage = message;
    const timeout = window.setTimeout(() => {
      setMessage(existing => existing === currentMessage ? null : existing);
    }, 2500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (selectedId && !selected) {
      setMoveMode(inactiveMoveMode());
      setSelectedId(null);
      setEditDraft(null);
      setInspectorTitleEdit(null);
      setOffersPicker(null);
      setParentPicker(null);
      setChildrenEditor(null);
      setConnectionPicker(null);
    }
  }, [selected, selectedId]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const element = menuRef.current;
    if (!menu || !panel || !element || menu.positioned) return;
    const bounds = element.getBoundingClientRect();
    const overlay = contextMenuPoint(menu.client, panel.getBoundingClientRect(), { width: bounds.width, height: bounds.height });
    setMenu({ ...menu, overlay, positioned: true });
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu?.positioned) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [menu?.positioned]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const element = contextualEditorRef.current;
    if (!panel || !element || !quick) return;
    const bounds = element.getBoundingClientRect();
    const anchor = quick.anchor;
    const overlay = contextMenuPoint(anchor, panel.getBoundingClientRect(), {
      width: bounds.width,
      height: bounds.height,
    });
    setQuick((current) => (current && (current.overlay.x !== overlay.x || current.overlay.y !== overlay.y || !current.positioned) ? { ...current, overlay, positioned: true } : current));
  });

  useLayoutEffect(() => {
    if (!productConfirmation) return;
    confirmationRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [productConfirmation]);
  useLayoutEffect(() => {
    if (!pendingLocalFocusIdsRef.current.length) return;
    const focused = pendingLocalFocusIdsRef.current.some(id => {
      const target = globalThis.document.getElementById(id);
      if (!target) return false;
      target.focus();
      return true;
    });
    if (focused) pendingLocalFocusIdsRef.current = [];
  });
  function closeProductConfirmation() {
    const target = productConfirmation?.returnFocus;
    setProductConfirmation(null);
    requestAnimationFrame(() => target?.focus());
  }
  type RelationEditorCloseReason = 'explicit' | 'commit' | 'pointer' | 'switch-editor';
  function closeRelationEditor(reason: RelationEditorCloseReason) {
    const focusTarget = offersPicker ? offersPickerButtonRef : parentPicker ? parentPickerButtonRef : null;
    setOffersPicker(null);
    setParentPicker(null);
    if (reason === 'explicit' || reason === 'commit') requestAnimationFrame(() => focusTarget?.current?.focus());
  }
  type ClientScopeEditorCloseReason = 'explicit' | 'pointer' | 'switch-editor';
  function closeClientScopeEditor(reason: ClientScopeEditorCloseReason) {
    if (localRemoval) return false;
    setConnectionPicker(null);
    setExpandedClientSources({});
    if (reason === 'explicit') requestAnimationFrame(() => connectionPickerButtonRef.current?.focus());
    return true;
  }
  function cancelLocalRemoval() {
    if (!localRemoval) return;
    pendingLocalFocusIdsRef.current = [localRemoval.cancelFocusId];
    setLocalRemoval(null);
  }
  function openOffersEditor() {
    setChildrenEditor(null);
    closeRelationEditor('switch-editor');
    if (!closeClientScopeEditor('switch-editor')) return;
    setBusinessInlineEdit(null);
    setOffersPicker({ query: '' });
  }
  function openParentEditor() {
    setChildrenEditor(null);
    closeRelationEditor('switch-editor');
    if (!closeClientScopeEditor('switch-editor')) return;
    setBusinessInlineEdit(null);
    setParentPicker({ query: '' });
  }
  function openLocatedInEditor(containerTitle: string) {
    closeRelationEditor('switch-editor');
    closeChildrenEditor('switch-editor');
    if (!closeClientScopeEditor('switch-editor')) return;
    setBusinessInlineEdit({ property: 'located-in', query: containerTitle });
  }
  function openUrlEditor(storedUrl: string) {
    closeRelationEditor('switch-editor');
    closeChildrenEditor('switch-editor');
    if (!closeClientScopeEditor('switch-editor')) return;
    setBusinessInlineEdit({ property: 'url', value: storedUrl });
  }
  function closeChildrenEditor(reason: 'explicit' | 'pointer' | 'switch-editor') {
    setChildrenEditor(null);
    if (reason === 'explicit') requestAnimationFrame(() => childrenEditorButtonRef.current?.focus());
  }
  function openChildrenEditor() {
    closeRelationEditor('switch-editor');
    if (!closeClientScopeEditor('switch-editor')) return;
    setBusinessInlineEdit(null);
    setChildrenEditor({ mode: 'list', query: '' });
  }
  useEffect(() => {
    if (!childrenEditor) return;
    const pointer = (event: PointerEvent) => { if (event.target instanceof globalThis.Node && !childrenEditorRef.current?.contains(event.target)) { if (childrenEditor.mode === 'create-child') discardChildCreationRef.current = true; closeChildrenEditor('pointer'); } };
    const keyboard = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (childrenEditor.mode === 'create-child') discardChildCreationRef.current = true;
      if (childrenEditor.mode === 'list') closeChildrenEditor('explicit');
      else setChildrenEditor(previousChildrenEditorLevel(childrenEditor));
    };
    globalThis.document.addEventListener('pointerdown', pointer); globalThis.document.addEventListener('keydown', keyboard);
    return () => { globalThis.document.removeEventListener('pointerdown', pointer); globalThis.document.removeEventListener('keydown', keyboard); };
  }, [childrenEditor]);
  useEffect(() => {
    if (!offersPicker && !parentPicker) return;
    const dismissOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof globalThis.Node) || relationEditorRef.current?.contains(target) || confirmationRef.current?.contains(target)) return;
      closeRelationEditor('pointer');
    };
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || productConfirmation) return;
      event.preventDefault();
      closeRelationEditor('explicit');
    };
    globalThis.document.addEventListener('pointerdown', dismissOnPointerDown);
    globalThis.document.addEventListener('keydown', dismissOnEscape);
    return () => {
      globalThis.document.removeEventListener('pointerdown', dismissOnPointerDown);
      globalThis.document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [offersPicker, parentPicker, productConfirmation]);
  useEffect(() => {
    if (!connectionPicker) return;
    const dismissOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (localRemoval || !(target instanceof globalThis.Node) || clientScopeEditorRef.current?.contains(target)) return;
      closeClientScopeEditor('pointer');
    };
    globalThis.document.addEventListener('pointerdown', dismissOnPointerDown);
    return () => globalThis.document.removeEventListener('pointerdown', dismissOnPointerDown);
  }, [connectionPicker, localRemoval]);
  useEffect(() => {
    if (!localRemoval) return;
    const cancelOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      cancelLocalRemoval();
    };
    globalThis.document.addEventListener('keydown', cancelOnEscape);
    return () => globalThis.document.removeEventListener('keydown', cancelOnEscape);
  }, [localRemoval]);
  function draftFor(entity: Entity, source = document): EditDraft {
    const result = draft(entity.kind);
    result.title = entity.title;
    if (entity.kind === 'product') for (const intent of source.productJobIntents.filter((candidate) => candidate.productId === entity.id)) result.productIntentOutcomes[intent.jobId] = [...intent.addressedDesiredOutcomeIds];
    if (entity.kind === 'offer') {
      result.financialOutcomeIds = source.offerFinancialIntents.filter((intent) => intent.offerId === entity.id).map((intent) => intent.financialDesiredOutcomeId);
      result.linkedProductId = source.relationships.find((r): r is Extract<Relationship, { kind: 'product_packaged_as_offer' }> => r.kind === 'product_packaged_as_offer' && r.offerId === entity.id)?.productId ?? '';
      for (const selection of source.offerJobSelections.filter((selection) => selection.offerId === entity.id)) {
        result.selectedIntentIds.push(selection.productJobIntentId);
        result.offerIntentOutcomes[selection.productJobIntentId] = effectiveOfferDesiredOutcomeIds(source, selection);
      }
    }
    if (entity.kind === 'touchpoint') {
      result.linkedOfferIds = linkedOfferIds(source, entity.id);
      result.parentTouchpointId = source.relationships.find((r): r is Extract<Relationship, { kind: 'touchpoint_contains_touchpoint' }> => r.kind === 'touchpoint_contains_touchpoint' && r.childTouchpointId === entity.id)?.parentTouchpointId ?? '';
      result.locatedInId = entity.locatedInId ?? '';
      result.locatedInQuery = source.touchpointContainers.find((c) => c.id === entity.locatedInId)?.title ?? '';
      result.locationDraft = entity.locatedInId ? { kind: 'existing', containerId: entity.locatedInId } : { kind: 'none' };
      result.url = entity.url ?? '';
      result.mitigatedRepulsorIds = source.relationships.flatMap((relation) => (relation.kind === 'touchpoint_mitigates_repulsor' && relation.touchpointId === entity.id ? [relation.repulsorId] : []));
      result.touchpointIntent = createTouchpointIntentDraft(source, entity.id);
    }
    if (entity.kind === 'emotional_job' || entity.kind === 'social_job') result.contextualCoreJobIds = source.relationships.flatMap((r) => (r.kind === 'core_functional_job_contextualizes_job' && r.contextualJobId === entity.id ? [r.coreFunctionalJobId] : []));
    if (entity.kind === 'related_job') result.parentEntityId = source.relationships.find((r): r is Extract<Relationship, { kind: 'core_functional_job_has_related_job' }> => r.kind === 'core_functional_job_has_related_job' && r.relatedJobId === entity.id)?.coreFunctionalJobId ?? '';
    if (entity.kind === 'desired_outcome') result.parentEntityId = source.relationships.find((r): r is Extract<Relationship, { kind: 'job_has_desired_outcome' }> => r.kind === 'job_has_desired_outcome' && r.desiredOutcomeId === entity.id)?.jobId ?? '';
    if (entity.kind === 'repulsor') result.resistedTargetIds = source.relationships.filter((r): r is Extract<Relationship, { kind: 'repulsor_resists' }> => r.kind === 'repulsor_resists' && r.repulsorId === entity.id).map((r) => r.targetEntityId);
    return result;
  }
  function updateDurableEntityTitle(source: MapDocument, entityId: string, title: string): MapDocument {
    const entity = source.entities.find(candidate => candidate.id === entityId);
    if (!entity) throw new Error('Entity does not exist.');
    const current = draftFor(entity, source);
    const parentRelationship = source.relationships.find(relation => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === entity.id);
    return updateEntity(source, {
      entityId: entity.id,
      title,
      ...(current.locatedInId ? { locatedInId: current.locatedInId } : {}),
      ...(current.url ? { url: current.url } : {}),
      ...(current.linkedProductId ? { linkedProductId: current.linkedProductId } : {}),
      linkedOfferIds: current.linkedOfferIds,
      relationshipIds: source.relationships.flatMap(relation => relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === entity.id ? [relation.id] : []),
      ...(current.parentTouchpointId ? { parentTouchpointId: current.parentTouchpointId } : {}),
      ...(current.parentEntityId ? { parentEntityId: current.parentEntityId } : {}),
      ...(parentRelationship ? { parentRelationshipId: parentRelationship.id } : {}),
    });
  }
  function commitInlineUrl(value: string) {
    if (selected?.kind !== 'touchpoint') return;
    const touchpointId = selected.id;
    const result = commitSemanticOperation(documentRef.current, semanticCommitState({ semanticallyComplete: true, valid: true }), durable =>
      commitTouchpointBusinessProperty(durable, { touchpointId, property: 'url', url: value }));
    if (result.state.status === 'failed') {
      setBusinessInlineEdit({ property: 'url', value, error: result.state.message });
      return;
    }
    setDocument(result.document);
    const committedUrl = result.document.entities.find((entity): entity is Extract<Entity, { kind: 'touchpoint' }> => entity.id === touchpointId && entity.kind === 'touchpoint')?.url ?? '';
    setEditDraft(current => current ? { ...current, url: committedUrl } : current);
    setBusinessInlineEdit(null);
  }
  function commitInlineLocation(location: { kind: 'none' } | { kind: 'existing'; containerId: string } | { kind: 'new'; title: string }) {
    if (selected?.kind !== 'touchpoint') return;
    const touchpointId = selected.id;
    const operation = location.kind === 'new'
      ? { ...location, id: crypto.randomUUID() }
      : location;
    const result = commitSemanticOperation(documentRef.current, semanticCommitState({ semanticallyComplete: true, valid: true }), durable =>
      commitTouchpointBusinessProperty(durable, { touchpointId, property: 'located-in', location: operation }));
    if (result.state.status === 'failed') {
      setBusinessInlineEdit({ property: 'located-in', query: businessInlineEdit?.property === 'located-in' ? businessInlineEdit.query : '', error: result.state.message });
      return;
    }
    setDocument(result.document);
    const touchpoint = result.document.entities.find((entity): entity is Extract<Entity, { kind: 'touchpoint' }> => entity.id === touchpointId && entity.kind === 'touchpoint');
    const container = result.document.touchpointContainers.find(candidate => candidate.id === touchpoint?.locatedInId);
    setEditDraft(current => current ? {
      ...current,
      locatedInId: container?.id ?? '',
      locatedInQuery: container?.title ?? '',
      locationDraft: container ? { kind: 'existing', containerId: container.id } : { kind: 'none' },
    } : current);
    setBusinessInlineEdit(null);
  }
  function commitLinkedOffersImmediately(touchpointId: string, targetOfferIds: string[], confirmedRemoval = false) {
    const durable = documentRef.current;
    try {
      const committed = commitTouchpointLinkedOffers(durable, { touchpointId, linkedOfferIds: targetOfferIds, confirmedRemoval, newId: () => crypto.randomUUID() });
      const next = reconsiderPlacementAfterRelationCommit(durable, committed, VIEW_ID, touchpointId);
      setDocument(next);
      const saved = next.entities.find(entity => entity.id === touchpointId);
      const synchronized = saved ? draftFor(saved, next) : null;
      setEditDraft(current => current && synchronized?.touchpointIntent ? { ...current, linkedOfferIds: synchronized.linkedOfferIds, touchpointIntent: synchronized.touchpointIntent } : current);
      publishSuccess('Linked Offers updated.');
    } catch (error) {
      publishError(error instanceof Error ? error.message : 'Linked Offers could not be updated.');
    }
  }
  function requestLinkedOffersCommit(targetOfferIds: string[], returnFocus: HTMLElement | null) {
    if (selected?.kind !== 'touchpoint') return;
    const touchpointId = selected.id;
    const impact = getTouchpointLinkedOfferChangeImpact(documentRef.current, { touchpointId, linkedOfferIds: targetOfferIds });
    if (impact.length) {
      setProductConfirmation({ mode: 'impact', owner: 'touchpoint', impact, returnFocus, immediateCommit: () => commitLinkedOffersImmediately(touchpointId, targetOfferIds, true) });
      return;
    }
    commitLinkedOffersImmediately(touchpointId, targetOfferIds);
  }
  function commitParentImmediately(touchpointId: string, parentTouchpointId: string) {
    const before = documentRef.current;
    const currentParentId = before.relationships.find((relation): relation is Extract<Relationship, { kind: 'touchpoint_contains_touchpoint' }> => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === touchpointId)?.parentTouchpointId ?? '';
    if (currentParentId === parentTouchpointId) {
      closeRelationEditor('commit');
      return;
    }
    const result = commitSemanticOperation(before, semanticCommitState({ semanticallyComplete: true, valid: true }), durable =>
      commitTouchpointParent(durable, { touchpointId, parentTouchpointId, newId: () => crypto.randomUUID() }));
    if (result.state.status === 'failed') {
      publishError(result.state.message);
      return;
    }
    const committed = reconsiderPlacementAfterRelationCommit(before, result.document, VIEW_ID, touchpointId);
    setDocument(committed);
    const durableParentId = committed.relationships.find((relation): relation is Extract<MapDocument['relationships'][number], { kind: 'touchpoint_contains_touchpoint' }> => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === touchpointId)?.parentTouchpointId ?? '';
    setEditDraft(current => current ? { ...current, parentTouchpointId: durableParentId } : current);
    closeRelationEditor('commit');
    publishSuccess('Parent Touchpoint updated.');
  }
  function resetProductSession(entity: Entity | undefined, source = document) {
    setProductExpanded({});
    rememberedProductOutcomesRef.current = {};
    setRememberedProductOutcomes({});
    setProductAddingKind(false);
    setProductInline(null);
    setProductInlineTitle('');
    setProductIntentSectionIds(entity?.kind === 'product' ? source.productJobIntents.filter(intent => intent.productId === entity.id).map(intent => intent.jobId) : []);
    setOfferExpanded({});
    if (entity?.kind === 'offer') {
      const productId = source.relationships.find((relation): relation is Extract<Relationship, { kind: 'product_packaged_as_offer' }> => relation.kind === 'product_packaged_as_offer' && relation.offerId === entity.id)?.productId ?? '';
      const selectedIds = source.offerJobSelections.filter(selection => selection.offerId === entity.id).map(selection => selection.productJobIntentId);
      setOfferIntentSectionIds({ [productId]: selectedIds });
      setOfferSelectionMemory({ [productId]: selectedIds });
    } else {
      setOfferIntentSectionIds({});
      setOfferSelectionMemory({});
    }
  }
  function guardsDirtySession(entity: Entity | undefined): boolean {
    return Boolean(entity && (entity.kind === 'product' || entity.kind === 'offer') && inspectorDirty);
  }
  function discardDirtySession(pending: () => void) {
    const durable = documentRef.current;
    const entity = durable.entities.find(candidate => candidate.id === selectedRef.current);
    setProductConfirmation(null);
    setEditDraft(entity ? draftFor(entity, durable) : null);
    resetProductSession(entity, durable);
    pending();
  }
  function performSelect(id: string | null) {
    setRelationsMode(inactiveRelationsMode());
    setMoveMode(inactiveMoveMode());
    setSelectedId(id);
    selectedRef.current = id;
    setMode('idle');
    setQuick(null);
    setMenu(null);
    clearMessage();
    setBusinessInlineEdit(null);
    setOffersPicker(null);
    setParentPicker(null);
    setConnectionPicker(null);
    setInspectorTitleEdit(null);
    const entity = documentRef.current.entities.find((e) => e.id === id);
    setEditDraft(entity ? draftFor(entity, documentRef.current) : null);
    resetProductSession(entity, documentRef.current);
  }
  function selectFromMap(id: string | null, continuation?: () => void) {
    if (id === selectedRef.current) {
      if (relationsModeRef.current.state !== 'inactive') setRelationsMode(inactiveRelationsMode());
      continuation?.();
      return;
    }
    const pending = () => {
      performSelect(id);
      dispatchInspectorHistory({ type: 'start', entityId: id });
      continuation?.();
    };
    if (guardsDirtySession(selected)) {
      setProductConfirmation({ mode: 'dirty', pending, returnFocus: globalThis.document.activeElement as HTMLElement | null });
      return;
    }
    pending();
  }
  function performInspectorNavigation(id: string, history = inspectorHistory, push = true) {
    if (!documentRef.current.entities.some(entity => entity.id === id)) return;
    performSelect(id);
    if (push) dispatchInspectorHistory({ type: 'push', entityId: id });
    else dispatchInspectorHistory({ type: 'replace', history });
  }
  function navigateInspector(id: string) {
    if (id === selectedRef.current) return;
    const pending = () => performInspectorNavigation(id);
    if (guardsDirtySession(selected)) {
      setProductConfirmation({ mode: 'dirty', pending, returnFocus: globalThis.document.activeElement as HTMLElement | null });
      return;
    }
    pending();
  }
  function traverseInspector(direction: 'back' | 'forward') {
    const result = traverseInspectorHistory(inspectorHistory, direction, id => documentRef.current.entities.some(entity => entity.id === id));
    if (!result) return;
    const pending = () => performInspectorNavigation(result.targetId, result.history, false);
    if (guardsDirtySession(selected)) {
      setProductConfirmation({ mode: 'dirty', pending, returnFocus: globalThis.document.activeElement as HTMLElement | null });
      return;
    }
    pending();
  }
  function focusEntity(id: string) {
    const escaped = CSS.escape(id);
    const node = globalThis.document.querySelector<HTMLElement>(`[data-node-id="${escaped}"], .react-flow__node[data-id="${escaped}"]`);
    (node ?? panelRef.current?.querySelector<HTMLElement>('[aria-label="Map canvas"]'))?.focus();
  }
  function startInlineTitleEdit(id: string) {
    const entity = documentRef.current.entities.find((candidate) => candidate.id === id);
    if (!entity) return;
    selectFromMap(id);
    setInlineEdit({ entityId: id, title: entity.title });
  }
  function finishInlineTitleEdit(commitTitle: string | false): boolean {
    const edit = inlineEdit;
    if (!edit) return false;
    if (commitTitle !== false) {
      const entity = documentRef.current.entities.find((candidate) => candidate.id === edit.entityId);
      if (!entity) return false;
      try {
        const next = updateDurableEntityTitle(documentRef.current, entity.id, commitTitle);
        setDocument(next);
        setEditDraft(draftFor(next.entities.find((candidate) => candidate.id === entity.id)!, next));
        publishSuccess('Title updated.');
      } catch (error) {
        publishError(error instanceof Error ? error.message : 'Title could not be updated.');
        return false;
      }
    }
    setInlineEdit(null);
    focusEntity(edit.entityId);
    return true;
  }
  function startInspectorTitleEdit() {
    if (!selectedRef.current) return;
    const entity = documentRef.current.entities.find(candidate => candidate.id === selectedRef.current);
    if (entity) setInspectorTitleEdit({ entityId: entity.id, title: entity.title });
  }
  function finishInspectorTitleEdit(commitTitle: string | false): boolean {
    const edit = inspectorTitleEdit;
    if (!edit) return false;
    if (commitTitle !== false) {
      const entity = documentRef.current.entities.find(candidate => candidate.id === edit.entityId);
      if (!entity) return false;
      try {
        const next = updateDurableEntityTitle(documentRef.current, entity.id, commitTitle);
        setDocument(next);
        setEditDraft(currentDraft => currentDraft ? { ...currentDraft, title: next.entities.find(candidate => candidate.id === entity.id)!.title } : currentDraft);
        publishSuccess('Title updated.');
      } catch (error) {
        publishError(error instanceof Error ? error.message : 'Title could not be updated.');
        return false;
      }
    }
    setInspectorTitleEdit(null);
    requestAnimationFrame(() => inspectorTitleButtonRef.current?.focus());
    return true;
  }
  function childDraft(entity: Entity, contextualKind?: ContextualClientEntityKind): EditDraft | null {
    if (contextualKind) {
      const d = draft(contextualKind);
      d.parentEntityId = entity.id;
      return d;
    }
    if (entity.kind === 'consumption_chain_job' || entity.kind === 'related_job') {
      const d = draft('desired_outcome');
      d.parentEntityId = entity.id;
      return d;
    }
    if (isClientRootEntityKind(entity.kind) || isContextualClientEntityKind(entity.kind) || entity.kind === 'repulsor') return null;
    if (entity.kind === 'product') {
      const d = draft('offer');
      d.linkedProductId = entity.id;
      return d;
    }
    if (entity.kind === 'offer') {
      const d = draft('touchpoint');
      d.linkedOfferIds = [entity.id];
      return d;
    }
    if (entity.kind !== 'touchpoint') return null;
    const d = draft('touchpoint');
    d.parentTouchpointId = entity.id;
    d.linkedOfferIds = linkedOfferIds(documentRef.current, entity.id);
    return d;
  }
  function screenForFlow(point: Point): Point {
    return flowRef.current?.flowToScreenPosition(point) ?? point;
  }
  function entityScreenAnchor(id: string): Point | null {
    const source = documentRef.current;
    const placement = source.placements.find((p) => p.entityId === id && p.viewId === VIEW_ID);
    const entity = source.entities.find((candidate) => candidate.id === id);
    if (!placement || !entity) return null;
    const layout = layoutForEntity(entity);
    return screenForFlow({ x: placement.x + layout.diameter, y: placement.y + layout.diameter / 2 });
  }
  function immediateNeighbors(source: MapDocument, id: string): string[] {
    return source.relationships.flatMap((relationship) => {
      const values = Object.entries(relationship).filter(([key, value]) => key !== 'id' && key !== 'kind' && typeof value === 'string').map(([, value]) => value as string);
      return values.includes(id) ? values.filter((value) => value !== id && source.entities.some((entity) => entity.id === value)) : [];
    });
  }
  function revealEntities(source: MapDocument, ids: string[]) {
    const panel = panelRef.current; const instance = flowRef.current;
    if (!panel || !instance || panel.hidden) return;
    const rects = [...new Set(ids)].flatMap((id) => {
      const placement = source.placements.find((candidate) => candidate.entityId === id && candidate.viewId === VIEW_ID);
      const entity = source.entities.find((candidate) => candidate.id === id);
      if (!placement || !entity) return [];
      const diameter = layoutForEntity(entity).diameter;
      return [{ left: placement.x, top: placement.y, right: placement.x + diameter, bottom: placement.y + diameter }];
    });
    if (!rects.length) return;
    const bounds = rects.reduce((result, rect) => ({ left: Math.min(result.left, rect.left), top: Math.min(result.top, rect.top), right: Math.max(result.right, rect.right), bottom: Math.max(result.bottom, rect.bottom) }), rects[0]!);
    const panelBounds = panel.getBoundingClientRect();
    const next = revealViewport(bounds, panelBounds, instance.getViewport());
    if (next) void instance.setViewport(next, { duration: 180 });
  }
  function relatedPlacement(id: string) {
    const source = documentRef.current;
    const placement = source.placements.find((p) => p.entityId === id && p.viewId === VIEW_ID)!;
    const related = source.relationships.filter((r) => (r.kind === 'product_packaged_as_offer' && r.productId === id) || (r.kind === 'offer_presented_at_touchpoint' && r.offerId === id) || (r.kind === 'touchpoint_contains_touchpoint' && r.parentTouchpointId === id) || (r.kind === 'core_functional_job_has_related_job' && r.coreFunctionalJobId === id) || (r.kind === 'job_has_desired_outcome' && r.jobId === id) || (r.kind === 'repulsor_resists' && r.targetEntityId === id)).length;
    return { x: placement.x + 190, y: placement.y + related * 125 };
  }
  function automaticPlacement(d: EditDraft, preferredPoint?: Point, source = documentRef.current): Point {
    const anchors: string[] = [];
    const relations: ProposedPlacementRelation[] = [];
    const addAnchor = (id: string, newNodeIsSource = false) => {
      if (!id) return;
      anchors.push(id);
      relations.push(newNodeIsSource ? { sourceId: '__new__', targetId: id } : { sourceId: id, targetId: '__new__' });
    };
    if (d.kind === 'offer') addAnchor(d.linkedProductId);
    if (d.kind === 'touchpoint') {
      d.linkedOfferIds.forEach((id) => addAnchor(id));
      addAnchor(d.parentTouchpointId);
    }
    if (isContextualClientEntityKind(d.kind)) addAnchor(d.parentEntityId);
    if (d.kind === 'repulsor') d.resistedTargetIds.forEach((id) => addAnchor(id, true));
    const nodeLayout = layoutForEntity(d);
    if (anchors.length) return findRelatedPlacement(source, VIEW_ID, nodeLayout, anchors, relations);
    if (preferredPoint) return findPlacementNearPoint(source, VIEW_ID, nodeLayout, preferredPoint);
    return findFreePlacement(source, VIEW_ID, nodeLayout);
  }
  function startChild(id: string, contextualKind?: ContextualClientEntityKind) {
    const entity = documentRef.current.entities.find((e) => e.id === id);
    if (!entity || !hasCanonicalChild(entity)) return;
    const flow = relatedPlacement(id);
    const anchor = entityScreenAnchor(id);
    const overlay = { x: 0, y: 0 };
    const d = childDraft(entity, contextualKind);
    if (!d || !anchor) return;
    setQuick({ draft: d, flow, anchor, overlay, positioned: false });
    setMenu(null);
    clearMessage();
  }
  function startRepulsor(targetId: string) {
    const target = documentRef.current.entities.find((entity) => entity.id === targetId);
    if (!target || !isRepulsorTargetKind(target.kind)) return;
    const d = draft('repulsor');
    d.resistedTargetIds = [targetId];
    const flow = relatedPlacement(targetId);
    setQuick({
      draft: d,
      flow,
      anchor: entityScreenAnchor(targetId) ?? screenForFlow(flow),
      overlay: { x: 0, y: 0 },
      positioned: false,
    });
    setMenu(null);
    clearMessage();
  }
  function startSibling(id: string) {
    const source = documentRef.current;
    const context = siblingDraft(source, id);
    const flow = siblingPlacement(source, id, VIEW_ID);
    if (!context || !flow) return;
    setQuick({
      draft: { ...draft(context.kind), ...context },
      flow,
      anchor: entityScreenAnchor(id) ?? screenForFlow(flow),
      overlay: { x: 0, y: 0 },
      positioned: false,
    });
    setMenu(null);
    clearMessage();
  }
  function entityContextCommandGroups(entity: Entity): EntityContextCommandGroup[] {
    const children: EntityContextCommand[] = entity.kind === 'core_functional_job'
      ? [
          { id: 'related-job', label: 'Related Job', action: () => startChild(entity.id, 'related_job') },
          { id: 'desired-outcome', label: 'Desired Outcome', action: () => startChild(entity.id, 'desired_outcome') },
        ]
      : hasCanonicalChild(entity)
        ? [{ id: 'canonical-child', label: KIND_LABELS[entity.kind === 'product' ? 'offer' : entity.kind === 'offer' || entity.kind === 'touchpoint' ? 'touchpoint' : 'desired_outcome'], action: () => startChild(entity.id) }]
        : [];
    const groups: EntityContextCommandGroup[] = [];
    if (children.length) groups.push({ id: 'children', heading: 'Child entities', commands: children });
    if (isRepulsorTargetKind(entity.kind)) groups.push({ id: 'resistance', heading: 'Resistance', commands: [{ id: 'repulsor', label: 'Repulsor', shortcut: 'Shift+Tab', action: () => startRepulsor(entity.id) }] });
    groups.push({ id: 'structure', heading: 'Structure', commands: [
      { id: 'sibling', label: 'Add sibling', action: () => startSibling(entity.id) },
      { id: 'duplicate', label: 'Duplicate', action: () => duplicate(entity.id) },
    ] });
    const entityCommands: EntityContextCommand[] = [{ id: 'inspector', label: 'Open in Entity Inspector', action: () => selectFromMap(entity.id, () => activateWorkspaceView('inspector', entity.id)) }];
    const url = entity.kind === 'touchpoint' ? safeUrl(entity.url) : undefined;
    if (url) entityCommands.push({ id: 'open-link', label: 'Open link', href: url, action: () => undefined });
    groups.push({ id: 'entity', heading: 'Entity', commands: entityCommands });
    groups.push({ id: 'actions', heading: 'Actions', commands: [{ id: 'cancel', label: 'Cancel', action: closeMenuAndRestoreFocus }] });
    return groups;
  }
  function openEntityContextMenu(entityId: string) {
    const entity = documentRef.current.entities.find((candidate) => candidate.id === entityId);
    if (!entity) return;
    const client = entityScreenAnchor(entityId);
    if (!client) return;
    menuOwnerRef.current = globalThis.document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(entityId)}"]`);
    setMenu({ type: 'node', invocation: 'keyboard', entityId, client, overlay: { x: 0, y: 0 }, positioned: false });
    clearMessage();
  }
  function applyProductIntentDraft(current: MapDocument, productId: string, values: Record<string, string[]>) {
    let next = current;
    for (const intent of current.productJobIntents.filter((candidate) => candidate.productId === productId)) if (!(intent.jobId in values)) next = removeProductJobIntent(next, intent.id);
    for (const [jobId, addressedDesiredOutcomeIds] of Object.entries(values)) {
      const existing = next.productJobIntents.find((intent) => intent.productId === productId && intent.jobId === jobId);
      next = existing
        ? updateProductJobIntent(next, {
            ...existing,
            addressedDesiredOutcomeIds,
          })
        : addProductJobIntent(next, {
            id: crypto.randomUUID(),
            productId,
            jobId,
            addressedDesiredOutcomeIds,
          });
    }
    return next;
  }
  function createFrom(d: EditDraft, x: number, y: number): [MapDocument, string] {
    const current = document;
    const entityId = crypto.randomUUID();
    const common = { entityId, title: d.title, viewId: VIEW_ID, x, y };
    const next =
      d.kind === 'offer'
        ? addEntity(current, {
            ...common,
            kind: 'offer',
            linkedProductId: d.linkedProductId,
            relationshipId: crypto.randomUUID(),
          })
        : d.kind === 'touchpoint'
          ? addEntity(current, {
              ...common,
              kind: 'touchpoint',
              linkedOfferIds: d.linkedOfferIds,
              relationshipIds: d.linkedOfferIds.map(() => crypto.randomUUID()),
              ...(d.parentTouchpointId
                ? {
                    parentTouchpointId: d.parentTouchpointId,
                    parentRelationshipId: crypto.randomUUID(),
                  }
                : {}),
            })
          : isContextualClientEntityKind(d.kind)
            ? addEntity(current, {
                ...common,
                kind: d.kind,
                parentEntityId: d.parentEntityId,
                relationshipId: crypto.randomUUID(),
              })
            : d.kind === 'repulsor'
              ? addEntity(current, {
                  ...common,
                  kind: 'repulsor',
                  resistedTargetIds: d.resistedTargetIds,
                  relationshipIds: d.resistedTargetIds.map(() => crypto.randomUUID()),
                })
              : addEntity(current, { ...common, kind: d.kind });
    if (d.kind === 'touchpoint') {
      /* Creation records an explicit empty local scope; downward distribution is a separate authoring choice. */
    }
    return [next, entityId];
  }
  function commit(d: EditDraft, x: number, y: number, continuation: PostCreateContinuation = 'map') {
    try {
      const [next, id] = createFrom(d, x, y);
      setDocument(next);
      setSelectedId(id);
      selectedRef.current = id;
      dispatchInspectorHistory({ type: 'start', entityId: id });
      const created = next.entities.find((e) => e.id === id)!;
      setEditDraft(draftFor(created, next));
      setQuick(null);
      setMode('idle');
      activateWorkspaceView(continuation, id);
      if (continuation === 'map') requestAnimationFrame(() => revealEntities(next, [id, ...immediateNeighbors(next, id)]));
      else pendingInspectorRevealRef.current = [id, ...immediateNeighbors(next, id)];
      publishSuccess('Element created.');
    } catch (error) {
      publishError(error instanceof Error ? error.message : 'Element could not be created.');
    }
  }
  function commitInspectorRoot(d: EditDraft) {
    try {
      let next = document;
      let productId = d.linkedProductId;
      let offerId = d.linkedOfferIds[0] ?? '';
      const revealIds: string[] = [];
      const addProduct = (title: string) => {
        const entityId = crypto.randomUUID();
        const placement = findFreePlacement(next, VIEW_ID, layoutForEntity({ kind: 'product', title }));
        next = addEntity(next, { entityId, title, kind: 'product', viewId: VIEW_ID, ...placement });
        revealIds.push(entityId);
        return entityId;
      };
      const addOffer = (title: string, anchorProductId: string) => {
        const entityId = crypto.randomUUID();
        const placement = findRelatedPlacement(next, VIEW_ID, layoutForEntity({ kind: 'offer', title }), [anchorProductId], [{ sourceId: anchorProductId, targetId: '__new__' }]);
        next = addEntity(next, { entityId, title, kind: 'offer', viewId: VIEW_ID, ...placement, linkedProductId: anchorProductId, relationshipId: crypto.randomUUID() });
        revealIds.push(entityId);
        return entityId;
      };

      if (d.kind === 'offer' || (d.kind === 'touchpoint' && d.offerPrerequisite === 'new')) {
        if (d.productPrerequisite === 'new') {
          if (!d.newProductTitle.trim()) throw new Error('A new Product title is required.');
          productId = addProduct(d.newProductTitle);
        }
        if (!productId) throw new Error('Choose or create the Product this Offer packages.');
      }
      if (d.kind === 'touchpoint' && d.offerPrerequisite === 'new') {
        if (!d.newOfferTitle.trim()) throw new Error('A new Offer title is required.');
        offerId = addOffer(d.newOfferTitle, productId);
      }
      if (d.kind === 'touchpoint' && !offerId) throw new Error('Choose or create the Offer presented at this Touchpoint.');

      let locatedInId = d.locationDraft.kind === 'existing' ? d.locationDraft.containerId : '';
      if (d.kind === 'touchpoint' && d.locationDraft.kind === 'new') {
        locatedInId = crypto.randomUUID();
        next = addTouchpointContainer(next, { id: locatedInId, title: d.locationDraft.title });
      }

      const targetDraft = { ...d, linkedProductId: productId, linkedOfferIds: offerId ? [offerId] : [] };
      const placement = automaticPlacement(targetDraft, undefined, next);
      const targetId = crypto.randomUUID();
      const common = { entityId: targetId, title: d.title, viewId: VIEW_ID, ...placement };
      next = d.kind === 'offer'
        ? addEntity(next, { ...common, kind: 'offer', linkedProductId: productId, relationshipId: crypto.randomUUID() })
        : d.kind === 'touchpoint'
          ? addEntity(next, { ...common, kind: 'touchpoint', linkedOfferIds: [offerId], relationshipIds: [crypto.randomUUID()], ...(locatedInId ? { locatedInId } : {}), ...(d.url.trim() ? { url: d.url } : {}) })
          : addEntity(next, { ...common, kind: 'product' });
      setDocument(next);
      setSelectedId(targetId);
      selectedRef.current = targetId;
      dispatchInspectorHistory({ type: 'start', entityId: targetId });
      setEditDraft(draftFor(next.entities.find((entity) => entity.id === targetId)!, next));
      setMode('idle');
      activateWorkspaceView('inspector', targetId);
      revealIds.push(targetId);
      if (d.kind === 'offer' && !revealIds.includes(productId)) revealIds.unshift(productId);
      if (d.kind === 'touchpoint' && !revealIds.includes(offerId)) revealIds.unshift(offerId);
      if (d.kind === 'touchpoint' && productId && !revealIds.includes(productId) && d.offerPrerequisite === 'new') revealIds.unshift(productId);
      pendingInspectorRevealRef.current = revealIds;
      publishSuccess('Element created.');
    } catch (error) {
      publishError(error instanceof Error ? error.message : 'Element could not be created.');
    }
  }
  function postCreateContinuation(event: FormEvent<HTMLFormElement>): PostCreateContinuation {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    return submitter?.value === 'inspector' ? 'inspector' : 'map';
  }
  function duplicate(id: string) {
    const source = documentRef.current;
    const placement = source.placements.find((p) => p.entityId === id && p.viewId === VIEW_ID);
    if (!placement || !source.entities.some((e) => e.id === id)) return;
    const entityId = crypto.randomUUID();
    try {
      const next = duplicateEntity(source, {
        sourceEntityId: id,
        entityId,
        viewId: VIEW_ID,
        x: placement.x + 40,
        y: placement.y + 40,
        relationshipIds: Array.from({ length: source.relationships.length + 2 }, () => crypto.randomUUID()),
      });
      const created = next.entities.find((e) => e.id === entityId)!;
      setDocument(next);
      setSelectedId(entityId);
      selectedRef.current = entityId;
      dispatchInspectorHistory({ type: 'start', entityId });
      setEditDraft(draftFor(created, next));
      setMenu(null);
      publishSuccess('Element duplicated.');
      requestAnimationFrame(() => revealEntities(next, [entityId, id]));
    } catch (error) {
      publishError(error instanceof Error ? error.message : 'Element could not be duplicated.');
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (moveModeRef.current.state === 'moving') {
          event.preventDefault();
          setMoveMode(inactiveMoveMode());
          return;
        }
        if (relationsModeRef.current.state !== 'inactive') {
          event.preventDefault();
          const previous = relationsModeRef.current;
          const next = reduceRelationsMode(previous, { type: 'escape' }).mode;
          setRelationsMode(next);
          if (next.state === 'inactive') requestAnimationFrame(() => {
            const escaped = CSS.escape(previous.sourceId);
            globalThis.document.querySelector<HTMLElement>(`.react-flow__node[data-id="${escaped}"], [data-node-id="${escaped}"]`)?.focus();
          });
          return;
        }
        setMenu(null);
        setQuick(null);
        return;
      }
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      if (matchesWorkspaceShortcut(event, isMac)) {
        const relationTarget = focusedRelationTarget(relationsModeRef.current);
        if (relationTarget && activeWorkspaceViewRef.current === 'map') {
          event.preventDefault();
          setRelationsMode(inactiveRelationsMode());
          selectFromMap(relationTarget, () => {
            activateWorkspaceView('inspector');
            requestAnimationFrame(() => globalThis.document.getElementById('inspector-workspace-tab')?.focus());
          });
          return;
        }
        const shortcutState: WorkspaceShortcutState = productConfirmation?.mode === 'impact'
          ? 'impact-confirmation'
          : quick || inlineEdit || productInline || productAddingKind ? 'inline-edit'
            : mode === 'create' ? 'create-draft'
              : guardsDirtySession(selected) ? 'dirty-inspector'
                : menu ? 'dismissible-menu' : 'node';
        const action = workspaceShortcutAction(shortcutState, isEditableControl(event.target));
        if (action === 'ignore') return;
        event.preventDefault();
        const destination = activeWorkspaceViewRef.current === 'map' ? 'inspector' : 'map';
        const switchWorkspace = () => {
          activateWorkspaceView(destination);
          requestAnimationFrame(() => globalThis.document.getElementById(`${destination}-workspace-tab`)?.focus());
        };
        if (action === 'dismiss-and-switch') setMenu(null);
        if (action === 'confirm') {
          setProductConfirmation({ mode: 'dirty', pending: switchWorkspace, returnFocus: globalThis.document.activeElement as HTMLElement | null });
        } else {
          switchWorkspace();
        }
        return;
      }
      if (isEditableControl(event.target) || isKeyboardOwnedControl(event.target)) return;
      const modifier = event.ctrlKey || event.metaKey;
      const relationMode = relationsModeRef.current;
      const movementVector = moveVectorForKey(event);
      if (!modifier && !event.altKey && moveModeRef.current.state === 'moving' && movementVector) {
        event.preventDefault();
        const next = moveInMode(documentRef.current, VIEW_ID, moveModeRef.current, event);
        setDocument(next);
      } else if (!modifier && relationMode.state !== 'inactive' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) {
        event.preventDefault();
        const type = event.key === 'ArrowLeft' ? 'previous-group' : event.key === 'ArrowRight' ? 'next-group' : event.key === 'ArrowUp' ? 'previous-target' : event.key === 'ArrowDown' ? 'next-target' : 'follow-target';
        const result = reduceRelationsMode(relationMode, { type });
        setRelationsMode(result.mode);
        if (result.followedTargetId) {
          selectFromMap(result.followedTargetId);
          requestAnimationFrame(() => revealEntities(documentRef.current, [result.followedTargetId!]));
        }
      } else if (!modifier && !event.altKey && relationMode.state === 'inactive' && selectedRef.current && activeWorkspaceViewRef.current === 'map' && spatialDirectionForKey(event)) {
        // VEE owns directional keys in Map mode even when the authored geometry has
        // no destination. Consuming the empty-sector case also prevents browser
        // scrolling; React Flow's own node keyboard movement is disabled below.
        event.preventDefault();
        const source = documentRef.current;
        const centers = source.placements.flatMap(placement => {
          if (placement.viewId !== VIEW_ID) return [];
          const entity = source.entities.find(candidate => candidate.id === placement.entityId);
          if (!entity) return [];
          const radius = layoutForEntity(entity).diameter / 2;
          return [{ id: entity.id, x: placement.x + radius, y: placement.y + radius }];
        });
        const current = centers.find(candidate => candidate.id === selectedRef.current);
        const target = current && nearestSpatialCandidate(current, centers, spatialDirectionForKey(event)!);
        if (target) {
          selectFromMap(target.id);
          requestAnimationFrame(() => {
            revealEntities(documentRef.current, [target.id]);
            const escaped = CSS.escape(target.id);
            globalThis.document.querySelector<HTMLElement>(`[data-node-id="${escaped}"], .react-flow__node[data-id="${escaped}"]`)?.focus();
          });
        }
      } else if (!modifier && event.key.toLowerCase() === 'm' && relationMode.state === 'inactive' && selectedRef.current && activeWorkspaceViewRef.current === 'map') {
        event.preventDefault();
        setMoveMode(enterMoveMode(selectedRef.current, false));
      } else if (!modifier && event.key.toLowerCase() === 'r' && moveModeRef.current.state === 'inactive' && selectedRef.current && activeWorkspaceViewRef.current === 'map') {
        const groups = relationGroupsForEntity(documentRef.current, selectedRef.current);
        if (groups.length) {
          event.preventDefault();
          setRelationsMode(reduceRelationsMode(relationMode, { type: 'enter', sourceId: selectedRef.current, groups }).mode);
        }
      } else if (modifier && event.key.toLowerCase() === 'c' && selectedRef.current) {
        event.preventDefault();
        setCopiedId(selectedRef.current);
      } else if (modifier && event.key.toLowerCase() === 'v' && copiedRef.current) {
        event.preventDefault();
        duplicate(copiedRef.current);
      } else if (!modifier && event.key === 'Tab' && selectedRef.current) {
        const entity = documentRef.current.entities.find((e) => e.id === selectedRef.current);
        if (entity && event.shiftKey && isRepulsorTargetKind(entity.kind)) {
          event.preventDefault();
          startRepulsor(entity.id);
        } else if (entity && !event.shiftKey) {
          event.preventDefault();
          openEntityContextMenu(entity.id);
        }
      } else if (!modifier && event.key === 'Enter' && selectedRef.current) {
        event.preventDefault();
        startSibling(selectedRef.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  function performWorkspaceTransition(view: WorkspaceView, inspectorRootId: string | null = selectedRef.current) {
    if (view === activeWorkspaceViewRef.current) return;
    setMoveMode(inactiveMoveMode());
    setActiveWorkspaceView(view);
    activeWorkspaceViewRef.current = view;
    if (view === 'inspector' && inspectorHistoryRef.current.entries.length === 0 && inspectorRootId !== null) {
      dispatchInspectorHistory({ type: 'start', entityId: inspectorRootId });
    }
    if (view === 'map' && pendingInspectorRevealRef.current) {
      const ids = pendingInspectorRevealRef.current;
      pendingInspectorRevealRef.current = null;
      requestAnimationFrame(() => revealEntities(documentRef.current, ids));
    }
  }
  function activateWorkspaceView(view: WorkspaceView, inspectorRootId: string | null = selectedRef.current) {
    if (view === activeWorkspaceViewRef.current) return;
    const pending = () => performWorkspaceTransition(view, inspectorRootId);
    if (activeWorkspaceViewRef.current === 'inspector' && view === 'map' && guardsDirtySession(selected)) {
      setProductConfirmation({ mode: 'dirty', pending, returnFocus: globalThis.document.activeElement as HTMLElement | null });
      return;
    }
    pending();
  }
  function performRootCreation() {
    setInspectorTitleEdit(null);
    setMode('create');
    setOffersPicker(null);
    setParentPicker(null);
    setConnectionPicker(null);
    setCreateDraft(draft());
    resetProductSession(undefined);
    // Creation is an Inspector-owned empty draft, not an entity-history session.
    dispatchInspectorHistory({ type: 'start', entityId: null });
    performWorkspaceTransition('inspector', null);
  }
  function startRootCreation() {
    if (guardsDirtySession(selected)) {
      setProductConfirmation({ mode: 'dirty', pending: performRootCreation, returnFocus: globalThis.document.activeElement as HTMLElement | null });
      return;
    }
    performRootCreation();
  }
  function handleTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const view: WorkspaceView = event.key === 'ArrowLeft' || event.key === 'Home' ? 'map' : 'inspector';
    activateWorkspaceView(view);
    globalThis.document.getElementById(`${view}-workspace-tab`)?.focus();
  }
  function containerChange(setter: (d: EditDraft) => void, d: EditDraft, selection: LocationDraft, query: string) {
    const existing = selection.kind === 'new' ? document.touchpointContainers.find((c) => c.title.trim().toLocaleLowerCase() === query.toLocaleLowerCase()) : undefined;
    setter(existing
      ? { ...d, locatedInId: existing.id, locatedInQuery: existing.title, locationDraft: { kind: 'existing', containerId: existing.id } }
      : { ...d, locatedInId: selection.kind === 'existing' ? selection.containerId : '', locatedInQuery: query, locationDraft: selection });
  }
  function touchFields(d: EditDraft, setter: (d: EditDraft) => void, inspector = false, showLocation = true) {
    if (d.kind !== 'touchpoint') return null;
    return (
      <>
        {showLocation && <ContainerCombobox value={d.locationDraft.kind === 'existing' ? d.locationDraft.containerId : d.locatedInId} query={d.locatedInQuery} document={document} onChange={(selection, q) => containerChange(setter, d, selection, q)} />}
        {!inspector && <label>
          URL <span>(optional)</span>
          <input value={d.url} onChange={(e) => setter({ ...d, url: e.target.value })} />
        </label>}
        {!inspector && d.linkedOfferIds.length > 0 && (
          <section aria-label="Initial Client-intent scope" className="nested-options">
            <strong>Initial Client-intent scope</strong>
            <p>This Touchpoint will start with an empty effective scope. After Create, explicitly choose its Job membership and any Desired Outcomes it represents. A DO-bearing route appears only after a Desired Outcome is selected.</p>
          </section>
        )}
      </>
    );
  }
  function rootTouchpointContextFields(d: EditDraft, setter: (d: EditDraft) => void) {
    return (
      <>
        <ContainerCombobox
          value={d.locationDraft.kind === 'existing' ? d.locationDraft.containerId : ''}
          query={d.locatedInQuery}
          document={document}
          onChange={(locationDraft, locatedInQuery) => setter({ ...d, locationDraft, locatedInQuery })}
        />
        <label>
          URL <span>(optional)</span>
          <input value={d.url} onChange={(event) => setter({ ...d, url: event.target.value })} />
        </label>
      </>
    );
  }
  function resistanceImpactFields(entity: Entity) {
    if (entity.kind === 'offer') {
      const impacts = resistanceImpactForOffer(document, entity.id);
      return (
        <section aria-label="Resistance affecting this Offer">
          <h4>Resistance affecting this Offer</h4>
          {impacts.length ? (
            impacts.map((impact) => (
              <div key={impact.repulsor.id}>
                <strong>{impact.repulsor.title}</strong>
                <ul>
                  {impact.touchpointIds.map((id) => (
                    <li key={id}>via {document.entities.find((item) => item.id === id)?.title}</li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p>No derived resistance affects this Offer.</p>
          )}
        </section>
      );
    }
    if (entity.kind === 'product') {
      const impacts = resistanceImpactForProduct(document, entity.id);
      return (
        <section aria-label="Resistance affecting this Product">
          <h4>Resistance affecting this Product</h4>
          {impacts.length ? (
            impacts.map((impact) => (
              <div key={impact.repulsor.id}>
                <strong>{impact.repulsor.title}</strong>
                <ul>
                  {impact.paths.map((path) => (
                    <li key={`${path.offerId}:${path.touchpointId}`}>
                      {document.entities.find((item) => item.id === path.offerId)?.title} → {document.entities.find((item) => item.id === path.touchpointId)?.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p>No derived resistance affects this Product.</p>
          )}
        </section>
      );
    }
    return null;
  }
  function repulsorTargetsField(d: EditDraft, setter: (d: EditDraft) => void) {
    if (d.kind !== 'repulsor') return null;
    return (
      <fieldset>
        <legend>Resists</legend>
        {document.entities
          .filter((entity) => isRepulsorTargetKind(entity.kind))
          .map((entity) => (
            <label className="checkbox" key={entity.id}>
              <input
                type="checkbox"
                checked={d.resistedTargetIds.includes(entity.id)}
                onChange={(event) =>
                  setter({
                    ...d,
                    resistedTargetIds: event.target.checked ? [...d.resistedTargetIds, entity.id] : d.resistedTargetIds.filter((id) => id !== entity.id),
                  })
                }
              />
              {entity.title} · {KIND_LABELS[entity.kind]}
            </label>
          ))}
      </fieldset>
    );
  }
  function touchpointIntentFields() {
    if (!editDraft?.touchpointIntent) return null;
    return validateTouchpointIntentDraft(editDraft.touchpointIntent) ? <p role="alert">{validateTouchpointIntentDraft(editDraft.touchpointIntent)}</p> : null;
  }
  function touchpointClientScopeSection() {
    if (selected?.kind !== 'touchpoint' || !editDraft?.touchpointIntent) return null;
    const scope = touchpointClientScope(document, selected.id);
    const offers = editDraft.linkedOfferIds;
    const allSources = touchpointUpstreamSources(document, selected.id);
    const parentSource = allSources.find(source => source.sourceKind === 'parent');
    const sources = (parentSource ? [parentSource] : allSources.filter(source => source.sourceKind === 'offer'))
      .filter(source => source.jobGroups.length || source.financialLeaves.length);
    const discovery = connectionPicker ? globalIntentDiscovery(document, { ...connectionPicker, touchpointId: selected.id }) : { jobGroups: [], directLeaves: [], titleMatches: { jobGroups: [], directLeaves: [] }, kindShortcutMatches: [] };
    const jobIdForLeaf = (leaf: UpstreamLeaf) => leaf.kind === 'desired-outcome' ? leaf.owningJobId : leaf.kind === 'job' ? leaf.semanticId : undefined;
    const finishLocal = (nextDocument: MapDocument, focusIds: string[] = []) => {
      const next = reconsiderPlacementAfterRelationCommit(documentRef.current, nextDocument, VIEW_ID, selected.id);
      pendingLocalFocusIdsRef.current = focusIds;
      setDocument(next);
      setEditDraft({ ...editDraft, touchpointIntent: createTouchpointIntentDraft(next, selected.id) });
      publishSuccess('Client scope updated.');
    };
    const concreteParentLeaf = (leaf: UpstreamLeaf, offerId: string, durable: MapDocument): UpstreamLeaf | undefined => {
      const jobSelection = durable.touchpointJobSelections.find(item => item.touchpointId === selected.id && item.offerId === offerId && durable.productJobIntents.find(intent => intent.id === item.productJobIntentId)?.jobId === jobIdForLeaf(leaf));
      const financialSelection = durable.touchpointFinancialSelections.find(item => item.touchpointId === selected.id && item.offerId === offerId && item.financialDesiredOutcomeId === leaf.semanticId);
      if (!jobSelection && !financialSelection) return undefined;
      return { ...leaf, contributorOfferId: offerId, ...(jobSelection ? { productJobIntentId: jobSelection.productJobIntentId } : {}), ...(financialSelection ? { offerFinancialIntentId: financialSelection.offerFinancialIntentId } : {}) };
    };
    const toggleLeaf = (leaf: UpstreamLeaf, checked: boolean) => {
      if (!leaf.available) return;
      if (!leaf.contributorOfferId) {
        if (checked) { chooseDiscovery(leaf); return; }
        let plannedDocument = documentRef.current; const plans: TouchpointIntentPathPlan[] = [];
        for (const offerId of leaf.checkedContributorOfferIds ?? []) {
          const concrete = concreteParentLeaf(leaf, offerId, plannedDocument); if (!concrete) continue;
          const target = concrete.kind === 'financial'
            ? { kind: 'financial' as const, touchpointId: selected.id, offerId, offerFinancialIntentId: concrete.offerFinancialIntentId!, semanticLeafId: leaf.semanticId }
            : { kind: 'job' as const, touchpointId: selected.id, offerId, productJobIntentId: concrete.productJobIntentId!, semanticLeafId: leaf.semanticId };
          const plan = planTouchpointIntentPathChange(plannedDocument, { target, checked: false }); plans.push(plan);
          plannedDocument = commitTouchpointIntentPathPlan(plannedDocument, plan);
        }
        const impacts = [...new Set(plans.flatMap(plan => plan.impact.mitigationRelationshipIds))];
        if (impacts.length) setLocalRemoval({ plans, mitigationRelationshipIds: impacts, cancelFocusId: leaf.checkboxId, commitFocusIds: [leaf.checkboxId] });
        else finishLocal(plannedDocument, [leaf.checkboxId]);
        return;
      }
      try {
        const target = leaf.kind === 'financial'
          ? { kind: 'financial' as const, touchpointId: selected.id, offerId: leaf.contributorOfferId, offerFinancialIntentId: leaf.offerFinancialIntentId!, semanticLeafId: leaf.semanticId }
          : { kind: 'job' as const, touchpointId: selected.id, offerId: leaf.contributorOfferId, productJobIntentId: leaf.productJobIntentId!, semanticLeafId: leaf.semanticId };
        const plan = planTouchpointIntentPathChange(documentRef.current, { target, checked, ...(checked ? { newSelectionId: crypto.randomUUID() } : {}) });
        if (!checked && plan.impact.mitigationRelationshipIds.length) { setLocalRemoval({ plans: [plan], mitigationRelationshipIds: plan.impact.mitigationRelationshipIds, cancelFocusId: leaf.checkboxId, commitFocusIds: [leaf.checkboxId] }); return; }
        finishLocal(commitTouchpointIntentPathPlan(documentRef.current, plan), [leaf.checkboxId]);
      } catch (error) { publishError(error instanceof Error ? error.message : 'Client scope could not be changed.'); }
    };
    const authorOne = (durable: MapDocument, leaf: UpstreamLeaf, contributors: string[], ancestors: Record<string, string>, newId?: () => string) => authorTouchpointIntentBottomUp(durable, leaf.kind === 'financial'
      ? { touchpointId: selected.id, contributingOfferIds: contributors, ancestorContributingOfferIds: ancestors, financialDesiredOutcomeId: leaf.semanticId, ...(newId ? { newId } : {}) }
      : { touchpointId: selected.id, contributingOfferIds: contributors, ancestorContributingOfferIds: ancestors, jobId: jobIdForLeaf(leaf)!, addressedDesiredOutcomeIds: leaf.kind === 'desired-outcome' ? [leaf.semanticId] : [], ...(newId ? { newId } : {}) });
    const runBottomUp = (leaf: UpstreamLeaf, contributors: string[], ancestors: Record<string, string>, actionOrigin: 'parent-source' | 'global-discovery') => {
      try {
        const result = authorOne(documentRef.current, leaf, contributors, ancestors, () => crypto.randomUUID());
        if (result.status === 'complete') {
          finishLocal(result.document, [leaf.checkboxId]);
          setConnectionPicker(current => current ? { mode: current.query ? 'global-search' : 'upstream', query: current.query, kind: current.kind, contributorOfferIds: [], ancestorContributingOfferIds: {} } : current);
          return;
        }
        setConnectionPicker(current => current && ({ ...current, mode: result.status === 'unresolved' ? 'ancestor-contributor-choice' : 'invalid', actionOrigin, target: { leaf }, currentContributorCandidateIds: contributors, contributorOfferIds: contributors, ancestorContributingOfferIds: ancestors, unresolved: result }));
      } catch (error) { publishError(error instanceof Error ? error.message : 'Client intent could not be authored.'); }
    };
    const chooseDiscovery = (leaf: UpstreamLeaf) => {
      const candidates = leaf.childContributorOfferIds ?? offers.filter(offerId => leaf.kind === 'financial' || document.relationships.some(relation => relation.kind === 'product_packaged_as_offer' && relation.offerId === offerId));
      const actionOrigin = leaf.sourceId === 'global' ? 'global-discovery' as const : 'parent-source' as const;
      if (!candidates.length) { setConnectionPicker(current => current && ({ ...current, mode: 'invalid', actionOrigin, target: { leaf }, currentContributorCandidateIds: [], contributorOfferIds: [], unresolved: { status: 'invalid', reason: 'no_ancestor_contributor_path', touchpointId: selected.id } })); return; }
      if (candidates.length === 1) runBottomUp(leaf, candidates, {}, actionOrigin);
      else setConnectionPicker(current => current && ({ ...current, mode: 'current-contributor-choice', actionOrigin, target: { leaf }, currentContributorCandidateIds: candidates, contributorOfferIds: [], ancestorContributingOfferIds: {} }));
    };
    const removeContributor = (leaf: UpstreamLeaf, offerId: string) => {
      const owningJobId = jobIdForLeaf(leaf);
      const jobSelection = document.touchpointJobSelections.find(item => item.touchpointId === selected.id && item.offerId === offerId && document.productJobIntents.find(intent => intent.id === item.productJobIntentId)?.jobId === owningJobId);
      const financialSelection = document.touchpointFinancialSelections.find(item => item.touchpointId === selected.id && item.offerId === offerId && item.financialDesiredOutcomeId === leaf.semanticId);
      const contributorButtonId = `${leaf.checkboxId}-contributor-${offerId}`;
      const commitFocusIds = (leaf.checkedContributorOfferIds ?? []).filter(id => id !== offerId).map(id => `${leaf.checkboxId}-contributor-${id}`).concat(leaf.checkboxId);
      const concrete = { ...leaf, contributorOfferId: offerId, ...(jobSelection ? { productJobIntentId: jobSelection.productJobIntentId } : {}), ...(financialSelection ? { offerFinancialIntentId: financialSelection.offerFinancialIntentId } : {}) };
      const target = concrete.kind === 'financial'
        ? { kind: 'financial' as const, touchpointId: selected.id, offerId, offerFinancialIntentId: concrete.offerFinancialIntentId!, semanticLeafId: concrete.semanticId }
        : { kind: 'job' as const, touchpointId: selected.id, offerId, productJobIntentId: concrete.productJobIntentId!, semanticLeafId: concrete.semanticId };
      try {
        const plan = planTouchpointIntentPathChange(documentRef.current, { target, checked: false });
        if (plan.impact.mitigationRelationshipIds.length) {
          setLocalRemoval({ plans: [plan], mitigationRelationshipIds: plan.impact.mitigationRelationshipIds, cancelFocusId: contributorButtonId, commitFocusIds });
          return;
        }
        finishLocal(commitTouchpointIntentPathPlan(documentRef.current, plan), commitFocusIds);
      } catch (error) { publishError(error instanceof Error ? error.message : 'Client scope could not be changed.'); }
    };
    const editing = Boolean(connectionPicker);
    type ClientScopePanel = { id: string; count: number } & (
      | { kind: Exclude<ClientScopePanelKind, 'financial_desired_outcome'>; jobGroups: typeof scope.jobGroups }
      | { kind: 'financial_desired_outcome'; financialLeaves: typeof scope.financialLeaves }
    );
    const renderedClientScopePanels: ClientScopePanel[] = editing ? [] : CLIENT_SCOPE_KIND_ORDER.flatMap<ClientScopePanel>(kind => {
      if (kind === 'financial_desired_outcome') return scope.financialLeaves.length ? [{ id: `client-kind:${kind}`, kind, count: scope.financialLeaves.length, financialLeaves: scope.financialLeaves }] : [];
      const jobGroups = scope.jobGroups.filter(group => group.job.kind === kind);
      return jobGroups.length ? [{ id: `client-kind:${kind}`, kind, count: jobGroups.length, jobGroups }] : [];
    });
    const initialClientScopeExpansion = initialCompactOverviewExpandedGroupIds(renderedClientScopePanels);
    const storedClientScopeExpansion = expandedClientScopePanels[selected.id];
    const isClientScopePanelExpanded = (panel: ClientScopePanel) =>
      storedClientScopeExpansion?.[panel.kind] ?? (storedClientScopeExpansion ? false : initialClientScopeExpansion.has(panel.id));
    const clientScopePanels = [...renderedClientScopePanels].sort((left, right) =>
      Number(isClientScopePanelExpanded(right)) - Number(isClientScopePanelExpanded(left)),
    );
    const toggleClientScopePanel = (kind: ClientScopePanelKind) => setExpandedClientScopePanels(current => {
      const existing = current[selected.id];
      const snapshot = existing ?? Object.fromEntries(renderedClientScopePanels.map(panel => [panel.kind, initialClientScopeExpansion.has(panel.id)]));
      return { ...current, [selected.id]: { ...snapshot, [kind]: !(snapshot[kind] ?? false) } };
    });
    const backFromResolver = () => {
      const focusId = connectionPicker?.target?.leaf.checkboxId;
      if (focusId) globalThis.document.getElementById(focusId)?.focus();
      setConnectionPicker(current => current ? { mode: current.query || current.kind ? 'global-search' : 'upstream', query: current.query, kind: current.kind, contributorOfferIds: [], ancestorContributingOfferIds: {} } : current);
    };
    const activeResolverFor = (leaf: UpstreamLeaf) => {
      if (!connectionPicker?.target || !['current-contributor-choice', 'ancestor-contributor-choice', 'invalid'].includes(connectionPicker.mode)) return false;
      const target = connectionPicker.target.leaf;
      return target.checkboxId === leaf.checkboxId && target.semanticId === leaf.semanticId && target.owningJobId === leaf.owningJobId;
    };
    const renderResolver = (leaf: UpstreamLeaf) => {
      if (!activeResolverFor(leaf) || !connectionPicker) return null;
      if (connectionPicker.mode === 'current-contributor-choice') return <fieldset className="contributor-chooser"><legend>Which linked Offers contribute here?</legend>{(connectionPicker.currentContributorCandidateIds ?? []).map(offerId => <label className="checkbox" key={offerId}><input type="checkbox" checked={connectionPicker.contributorOfferIds.includes(offerId)} onChange={event => setConnectionPicker({ ...connectionPicker, contributorOfferIds: event.target.checked ? [...connectionPicker.contributorOfferIds, offerId] : connectionPicker.contributorOfferIds.filter(id => id !== offerId) })} />{entityTitle(document, offerId)}</label>)}<div className="choice-row"><button type="button" disabled={!connectionPicker.contributorOfferIds.length} onClick={() => runBottomUp(leaf, connectionPicker.contributorOfferIds, connectionPicker.ancestorContributingOfferIds, connectionPicker.actionOrigin!)}>Continue</button><button type="button" onClick={backFromResolver}>Back</button></div></fieldset>;
      if (connectionPicker.mode === 'ancestor-contributor-choice' && connectionPicker.unresolved?.status === 'unresolved') return <fieldset className="contributor-chooser"><legend>Contributor for {entityTitle(document, connectionPicker.unresolved.touchpointId)}</legend>{connectionPicker.unresolved.candidateOfferIds.map(offerId => <button type="button" key={offerId} onClick={() => { const ancestors = { ...connectionPicker.ancestorContributingOfferIds, [connectionPicker.unresolved!.touchpointId]: offerId }; runBottomUp(leaf, connectionPicker.contributorOfferIds, ancestors, connectionPicker.actionOrigin!); }}>{entityTitle(document, offerId)}</button>)}<button type="button" onClick={backFromResolver}>Back</button></fieldset>;
      if (connectionPicker.mode === 'invalid' && connectionPicker.unresolved?.status === 'invalid') return <fieldset className="contributor-chooser"><legend>Contributor unavailable</legend><p role="alert">No contributor path exists for {entityTitle(document, connectionPicker.unresolved.touchpointId)} ({connectionPicker.unresolved.touchpointId}).</p><button type="button" onClick={backFromResolver}>Back</button></fieldset>;
      return null;
    };
    const renderSelectableRow = (leaf: UpstreamLeaf, options?: { provenance?: boolean; showContributorPaths?: boolean }) => {
      const contributorOfferIds = leaf.checkedContributorOfferIds ?? [];
      const contributorCount = contributorOfferIds.length;
      return <div className="intent-path-row" key={leaf.checkboxId}>
        <div className={`intent-checkbox${leaf.available ? '' : ' unavailable'}`}>
          <label className="intent-selection-surface">
            <input id={leaf.checkboxId} type="checkbox" disabled={!leaf.available} checked={leaf.checked} onChange={event => toggleLeaf(leaf, event.target.checked)} />
            <span className="intent-selection-title">{leaf.entity.title}</span>
          </label>
          {options?.provenance && <small>Parent provenance{leaf.provenanceOfferIds?.length ? ` · ${leaf.provenanceOfferIds.map(id => entityTitle(document, id)).join(', ')}` : ''}</small>}
          {!leaf.available && <small>No valid Child contributor path</small>}
        </div>
        {options?.showContributorPaths && contributorCount > 0 && <div className="contributor-attributions">{contributorOfferIds.map(offerId => {
          const offerTitle = entityTitle(document, offerId);
          return <div className="contributor-attribution" key={offerId}><span>via {offerTitle}</span>{contributorCount > 1 && <button id={`${leaf.checkboxId}-contributor-${offerId}`} type="button" aria-label={`Remove ${offerTitle} contributor`} onClick={() => removeContributor(leaf, offerId)}><span aria-hidden="true">×</span></button>}</div>;
        })}</div>}
        {renderResolver(leaf)}
      </div>;
    };
    const renderJobGroup = (group: (typeof discovery.titleMatches.jobGroups)[number], options?: { provenance?: boolean }) => {
      const jobLeaf = group.leaves.find(leaf => leaf.kind === 'job');
      const outcomes = group.leaves.filter(leaf => leaf.kind === 'desired-outcome');
      return <div className={`touchpoint-client-job ${outcomes.length ? 'has-outcomes' : 'direct-job'}`} key={group.job.id}>
        <small>{KIND_LABELS[group.job.kind]}</small>
        {jobLeaf && <div className="intent-semantic-leaf job-membership-row">{renderSelectableRow(jobLeaf, { ...(options?.provenance ? { provenance: true } : {}), showContributorPaths: true })}</div>}
        {outcomes.length > 0 && <div className="intent-leaves desired-outcome-rows">{outcomes.map(leaf => <div className="intent-semantic-leaf" key={leaf.checkboxId}>{renderSelectableRow(leaf, { ...(options?.provenance ? { provenance: true } : {}), showContributorPaths: true })}</div>)}</div>}
      </div>;
    };
    const renderDiscoveryMatches = (matches: typeof discovery.titleMatches) => <div className="global-intent-results">{matches.jobGroups.map(group => renderJobGroup(group))}{matches.directLeaves.map(leaf => <div className="intent-discovery-leaf" key={leaf.checkboxId}><small>{KIND_LABELS[leaf.entity.kind]}</small>{renderSelectableRow(leaf, { showContributorPaths: true })}</div>)}</div>;
    return <section ref={clientScopeEditorRef} className={`touchpoint-client-scope${editing ? ' is-editing' : ''}`} aria-labelledby="touchpoint-client-scope-heading" onKeyDown={event => { if (event.key !== 'Escape' || !connectionPicker || localRemoval) return; event.preventDefault(); event.stopPropagation(); if (['current-contributor-choice', 'ancestor-contributor-choice', 'invalid'].includes(connectionPicker.mode)) backFromResolver(); else closeClientScopeEditor('explicit'); }}>
      <div className="touchpoint-client-scope-heading">{editing ? <><h4 id="touchpoint-client-scope-heading">Client scope</h4><button type="button" className="inspector-secondary-action" aria-label="Close Client scope authoring" onClick={() => closeClientScopeEditor('explicit')}>Close</button></> : <h4 id="touchpoint-client-scope-heading" aria-label="Client scope"><button ref={connectionPickerButtonRef} data-touchpoint-editor-affordance type="button" className="inspector-property-heading-action" aria-label="Edit Client scope" disabled={!offers.length} onClick={() => { closeRelationEditor('switch-editor'); closeChildrenEditor('switch-editor'); setBusinessInlineEdit(null); setConnectionPicker({ mode: 'upstream', query: '', kind: undefined, contributorOfferIds: [], ancestorContributingOfferIds: {} }); }}>Client scope<span className="inspector-property-heading-hint" aria-hidden="true">Click to edit</span></button></h4>}</div>
      {!editing && clientScopePanels.length ? <ClientScopePackedGroups panelIds={clientScopePanels.map(panel => panel.id)}>
        {clientScopePanels.map(panel => {
          const expanded = isClientScopePanelExpanded(panel);
          const contentId = `client-scope-${encodeURIComponent(selected.id)}-${panel.kind}`;
          return <section className="client-scope-view-panel" key={panel.id}>
            <button type="button" className="client-scope-view-disclosure" aria-expanded={expanded} aria-controls={contentId} aria-label={`${KIND_LABELS[panel.kind]}, ${panel.count}`} onClick={() => toggleClientScopePanel(panel.kind)}>
              <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
              <span>{KIND_LABELS[panel.kind]}</span>
              <span className="client-scope-view-count">{panel.count}</span>
            </button>
            {expanded && <div className="client-scope-view-content" id={contentId}>
              {'jobGroups' in panel && panel.jobGroups.map(group => <div className={`touchpoint-client-job ${group.desiredOutcomes.length ? 'has-outcomes' : 'direct-job'}`} key={group.job.id}>
                <button type="button" onClick={() => navigateInspector(group.job.id)}>{group.job.title}</button>
                {group.desiredOutcomes.length > 0 && <ul>{group.desiredOutcomes.map(outcome => <li key={outcome.semanticLeafId}><button type="button" onClick={() => navigateInspector(outcome.entity.id)}>{outcome.entity.title}</button></li>)}</ul>}
              </div>)}
              {'financialLeaves' in panel && panel.financialLeaves.map(leaf => <div className="touchpoint-client-financial" key={leaf.semanticLeafId}><button type="button" onClick={() => navigateInspector(leaf.entity.id)}>{leaf.entity.title}</button></div>)}
            </div>}
          </section>;
        })}
      </ClientScopePackedGroups> : !editing && <p className="touchpoint-client-scope-empty">No Client-side connections yet.</p>}
      {connectionPicker && <div className="touchpoint-client-scope-content inline-intent-editor">
        <section className="global-intent-discovery" aria-label="Find Client intent"><label>Search Client intent<input autoFocus type="search" value={connectionPicker.query} onChange={event => setConnectionPicker({ ...connectionPicker, mode: event.target.value ? 'global-search' : 'upstream', query: event.target.value, kind: undefined })} /></label>
          {connectionPicker.kind ? <><div className="kind-shortcut-heading"><button type="button" className="text-action" onClick={() => setConnectionPicker({ ...connectionPicker, kind: undefined })}>Back to results for “{connectionPicker.query}”</button><strong>{KIND_LABELS[connectionPicker.kind]}</strong></div>{renderDiscoveryMatches({ jobGroups: discovery.jobGroups, directLeaves: discovery.directLeaves })}</> : connectionPicker.query && <><div className="kind-shortcut-results" aria-label="Kind shortcuts">{discovery.kindShortcutMatches.map(shortcut => <button type="button" key={shortcut.kind} onClick={() => setConnectionPicker({ ...connectionPicker, mode: 'global-search', kind: shortcut.kind })}>Browse {shortcut.label}</button>)}</div>{renderDiscoveryMatches(discovery.titleMatches)}</>}
        </section>
        <div className="intent-source-list">{sources.map(source => {
          const disclosureId = `client-source-${encodeURIComponent(selected.id)}-${encodeURIComponent(source.source.id)}`;
          const expanded = Boolean(expandedClientSources[disclosureId]);
          return <section className="intent-source-disclosure" key={`${source.sourceKind}:${source.source.id}`}><button type="button" className="intent-source-toggle" aria-expanded={expanded} aria-controls={disclosureId} onClick={() => setExpandedClientSources(current => ({ ...current, [disclosureId]: !expanded }))}><span aria-hidden="true">{expanded ? '▾' : '▸'}</span>{source.sourceKind === 'parent' ? 'Parent' : 'Offer'} · {source.source.title}</button>{expanded && <div id={disclosureId} className="intent-source-dendrite">{source.jobGroups.map(group => renderJobGroup(group, { provenance: source.sourceKind === 'parent' }))}{source.financialLeaves.map(leaf => <div className="touchpoint-client-financial" key={leaf.checkboxId}><small>{KIND_LABELS[leaf.entity.kind]}</small>{renderSelectableRow(leaf, { provenance: source.sourceKind === 'parent', showContributorPaths: source.sourceKind === 'parent' })}</div>)}</div>}</section>;
        })}{!sources.length && <p className="touchpoint-client-scope-empty">No upstream Client intent available.</p>}</div>
      </div>}
      {localRemoval && <div role="dialog" aria-modal="true" aria-labelledby="local-removal-heading" className="confirmation-dialog" onKeyDown={event => { if (event.key !== 'Escape') return; event.preventDefault(); event.stopPropagation(); cancelLocalRemoval(); }}><h4 id="local-removal-heading">Remove this local Client path?</h4><p>This also removes {localRemoval.mitigationRelationshipIds.length} dependent mitigation record(s).</p>{localRemoval.mitigationRelationshipIds.map(id => <p key={id}><strong>{id}</strong></p>)}<div className="choice-row"><button type="button" className="danger" onClick={() => { const pending = localRemoval; setLocalRemoval(null); finishLocal(pending.plans.reduce((next, plan) => commitTouchpointIntentPathPlan(next, plan), documentRef.current), pending.commitFocusIds); }}>Remove</button><button type="button" onClick={cancelLocalRemoval}>Cancel</button></div></div>}
    </section>;
  }
  function semanticParentField(d: EditDraft, setter: (d: EditDraft) => void) {
    if (!isContextualClientEntityKind(d.kind)) return null;
    const validKinds = d.kind === 'related_job' ? ['core_functional_job'] : ['core_functional_job', 'related_job', 'consumption_chain_job'];
    return (
      <label>
        Semantic parent
        <select required value={d.parentEntityId} onChange={(e) => setter({ ...d, parentEntityId: e.target.value })}>
          {document.entities
            .filter((entity) => validKinds.includes(entity.kind))
            .map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.title}
              </option>
            ))}
        </select>
      </label>
    );
  }
  function contextualJobFields(d: EditDraft, setter: (d: EditDraft) => void) {
    if (d.kind !== 'emotional_job' && d.kind !== 'social_job') return null;
    return (
      <fieldset>
        <legend>Core Functional Job context</legend>
        {document.entities
          .filter((entity) => entity.kind === 'core_functional_job')
          .map((job) => (
            <label className="checkbox" key={job.id}>
              <input
                type="checkbox"
                checked={d.contextualCoreJobIds.includes(job.id)}
                onChange={(event) =>
                  setter({
                    ...d,
                    contextualCoreJobIds: event.target.checked ? [...d.contextualCoreJobIds, job.id] : d.contextualCoreJobIds.filter((id) => id !== job.id),
                  })
                }
              />
              {job.title}
            </label>
          ))}
      </fieldset>
    );
  }
  function productIntentFields(d: EditDraft, setter: (d: EditDraft) => void) {
    if (d.kind !== 'product') return null;
    const expanded = productExpanded, setExpanded = setProductExpanded;
    const addingKind = productAddingKind, setAddingKind = setProductAddingKind;
    const inline = productInline, setInline = setProductInline;
    const inlineTitle = productInlineTitle, setInlineTitle = setProductInlineTitle;
    const staged = d.stagedClientEntities;
    const jobs = [...document.entities, ...staged].filter((entity) => ['core_functional_job', 'related_job', 'emotional_job', 'social_job', 'consumption_chain_job'].includes(entity.kind));
    const update = (values: Record<string, string[]>, stagedClientEntities = staged) => setter({ ...d, productIntentOutcomes: values, stagedClientEntities });
    const toggleJob = (jobId: string, checked: boolean) => {
      const values = { ...d.productIntentOutcomes };
      const isStaged = staged.some(entity => entity.id === jobId);
      if (checked) values[jobId] = isStaged ? (values[jobId] ?? []) : (rememberedProductOutcomesRef.current[jobId] ?? rememberedProductOutcomes[jobId] ?? values[jobId] ?? []);
      else {
        if (!isStaged) {
          const remembered = [...(values[jobId] ?? [])];
          rememberedProductOutcomesRef.current = { ...rememberedProductOutcomesRef.current, [jobId]: remembered };
          setRememberedProductOutcomes(current => ({ ...current, [jobId]: remembered }));
        }
        delete values[jobId];
      }
      update(values, checked ? staged : staged.filter(entity => entity.id !== jobId && entity.parentEntityId !== jobId));
    };
    const toggleOutcome = (jobId: string, outcomeId: string, checked: boolean) => {
      const values = { ...d.productIntentOutcomes };
      const current = values[jobId] ?? [];
      values[jobId] = checked ? [...new Set([...current, outcomeId])] : current.filter(id => id !== outcomeId);
      update(values, checked ? staged : staged.filter(entity => entity.id !== outcomeId));
    };
    const finishInline = () => {
      const title = inlineTitle.trim();
      if (!inline || !title) return;
      const id = crypto.randomUUID();
      if (inline.kind === 'job') update({ ...d.productIntentOutcomes, [id]: [] }, [...staged, { id, kind: inline.entityKind, title }]);
      else update({ ...d.productIntentOutcomes, [inline.jobId]: [...new Set([...(d.productIntentOutcomes[inline.jobId] ?? []), id])] }, [...staged, { id, kind: 'desired_outcome', title, parentEntityId: inline.jobId }]);
      setExpanded(current => inline.kind === 'outcome' ? { ...current, [inline.jobId]: true } : current);
      setInline(null); setInlineTitle(''); setAddingKind(false);
    };
    const renderJob = (job: (typeof jobs)[number]) => {
      const selected = job.id in d.productIntentOutcomes;
      const bearsOutcomes = job.kind === 'core_functional_job' || job.kind === 'related_job' || job.kind === 'consumption_chain_job';
      const outcomes = bearsOutcomes ? [...document.relationships.flatMap(relation => relation.kind === 'job_has_desired_outcome' && relation.jobId === job.id ? document.entities.filter(entity => entity.id === relation.desiredOutcomeId) : []), ...staged.filter(entity => entity.kind === 'desired_outcome' && entity.parentEntityId === job.id)] : [];
      const relatedParent = job.kind === 'related_job' ? document.relationships.find((relation): relation is Extract<Relationship, { kind: 'core_functional_job_has_related_job' }> => relation.kind === 'core_functional_job_has_related_job' && relation.relatedJobId === job.id) : undefined;
      const relatedParentTitle = document.entities.find(entity => entity.id === relatedParent?.coreFunctionalJobId)?.title;
      return <div className={`intent-job ${selected ? 'selected' : ''}`} key={job.id}>
        <div className="intent-job-heading">
          {bearsOutcomes ? <button type="button" className="disclosure" aria-label={`${expanded[job.id] ? 'Collapse' : 'Expand'} ${job.title}`} aria-expanded={Boolean(expanded[job.id])} onClick={() => setExpanded(current => ({ ...current, [job.id]: !current[job.id] }))}>{expanded[job.id] ? '▾' : '▸'}</button> : <span className="disclosure-placeholder" />}
          <label className="intent-selection"><input type="checkbox" checked={selected} onChange={event => toggleJob(job.id, event.target.checked)} /><span><strong>{job.title}</strong><small>{KIND_LABELS[job.kind]}</small>{relatedParentTitle && <small className="related-context">Related to: {relatedParentTitle}</small>}</span></label>
        </div>
        {bearsOutcomes && expanded[job.id] && <div className="intent-branches">
          {outcomes.map(outcome => <label className="checkbox intent-outcome" key={outcome.id}><input type="checkbox" checked={(d.productIntentOutcomes[job.id] ?? []).includes(outcome.id)} onChange={event => toggleOutcome(job.id, outcome.id, event.target.checked)} />{outcome.title}</label>)}
          {selected && !(d.productIntentOutcomes[job.id]?.length) && <span className="unfinished-branch">Desired Outcome not described yet</span>}
          {inline?.kind === 'outcome' && inline.jobId === job.id ? <input autoFocus aria-label="New Desired Outcome title" value={inlineTitle} onChange={event => setInlineTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); finishInline(); } if (event.key === 'Escape') { event.preventDefault(); setInline(null); setInlineTitle(''); } }} /> : <button type="button" className="text-action" onClick={() => { setInline({ kind: 'outcome', jobId: job.id }); setInlineTitle(''); }}>+ Add Desired Outcome</button>}
        </div>}
      </div>;
    };
    const selectedJobs = jobs.filter(job => productIntentSectionIds.includes(job.id) || staged.some(entity => entity.id === job.id));
    const availableJobs = jobs.filter(job => !productIntentSectionIds.includes(job.id) && !staged.some(entity => entity.id === job.id));
    return <fieldset className="client-intent"><legend>Client intent</legend>
      <h4>Product intent</h4>{selectedJobs.length ? selectedJobs.map(renderJob) : <p className="immutable-note">No Client Jobs selected.</p>}
      <h4>Other Client Jobs</h4>{availableJobs.map(renderJob)}
      {inline?.kind === 'job' ? <input autoFocus aria-label="New Client Job title" value={inlineTitle} onChange={event => setInlineTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); finishInline(); } if (event.key === 'Escape') { event.preventDefault(); setInline(null); setInlineTitle(''); } }} /> : addingKind ? <div className="choice-row" role="group" aria-label="Client Job kind">{(['core_functional_job','emotional_job','social_job','consumption_chain_job'] as const).map(kind => <button type="button" key={kind} onClick={() => { setInline({ kind: 'job', entityKind: kind }); setInlineTitle(''); }}>{KIND_LABELS[kind]}</button>)}<button type="button" onClick={() => setAddingKind(false)}>Cancel</button></div> : <button type="button" className="text-action" onClick={() => setAddingKind(true)}>+ Add Client Job</button>}
    </fieldset>;
  }
  function offerIntentFields(d: EditDraft, setter: (d: EditDraft) => void) {
    if (d.kind !== 'offer' || !d.linkedProductId) return null;
    const intents = document.productJobIntents.filter((intent) => intent.productId === d.linkedProductId);
    const sectionIds = offerIntentSectionIds[d.linkedProductId] ?? [];
    const renderIntent = (intent: (typeof intents)[number]) => {
      const job = document.entities.find((entity) => entity.id === intent.jobId)!;
      const bearsOutcomes = job.kind === 'core_functional_job' || job.kind === 'related_job' || job.kind === 'consumption_chain_job';
      const outcomes = intent.addressedDesiredOutcomeIds.flatMap(id => document.entities.filter(entity => entity.id === id));
      const related = job.kind === 'related_job' ? document.relationships.find((relation): relation is Extract<Relationship, { kind: 'core_functional_job_has_related_job' }> => relation.kind === 'core_functional_job_has_related_job' && relation.relatedJobId === job.id) : undefined;
      const relatedTitle = related && document.entities.find(entity => entity.id === related.coreFunctionalJobId)?.title;
      const selected = d.selectedIntentIds.includes(intent.id);
      const selectedOutcomes = d.offerIntentOutcomes[intent.id] ?? [];
      const setJobSelected = (checked: boolean) => setter({
        ...d,
        selectedIntentIds: checked ? [...new Set([...d.selectedIntentIds, intent.id])] : d.selectedIntentIds.filter(id => id !== intent.id),
        offerIntentOutcomes: { ...d.offerIntentOutcomes, [intent.id]: checked ? selectedOutcomes : [] },
      });
      const setOutcomeSelected = (outcomeId: string, checked: boolean) => setter({
        ...d,
        selectedIntentIds: [...new Set([...d.selectedIntentIds, intent.id])],
        offerIntentOutcomes: { ...d.offerIntentOutcomes, [intent.id]: checked ? [...new Set([...selectedOutcomes, outcomeId])] : selectedOutcomes.filter(id => id !== outcomeId) },
      });
      return <div className={`intent-job ${selected ? 'selected' : ''}`} key={intent.id}>
        <div className="intent-job-heading">
          {bearsOutcomes ? <button type="button" className="disclosure" aria-label={`${offerExpanded[intent.id] ? 'Collapse' : 'Expand'} ${job.title}`} aria-expanded={Boolean(offerExpanded[intent.id])} onClick={() => setOfferExpanded(current => ({ ...current, [intent.id]: !current[intent.id] }))}>{offerExpanded[intent.id] ? '▾' : '▸'}</button> : <span className="disclosure-placeholder" />}
          <label className="intent-selection"><input type="checkbox" checked={selected} onChange={event => setJobSelected(event.target.checked)} /><span><strong>{job.title}</strong><small>{KIND_LABELS[job.kind]}</small>{relatedTitle && <small className="related-context">Related to: {relatedTitle}</small>}</span></label>
        </div>
        {bearsOutcomes && offerExpanded[intent.id] && <div className="intent-branches">
          {outcomes.map(outcome => <label className="intent-outcome" key={outcome.id}><input type="checkbox" checked={selected && selectedOutcomes.includes(outcome.id)} onChange={event => setOutcomeSelected(outcome.id, event.target.checked)} />{outcome.title}</label>)}
          {!outcomes.length && <span className="unfinished-branch">Desired Outcome not described yet</span>}
        </div>}
      </div>;
    };
    const offered = intents.filter(intent => sectionIds.includes(intent.id));
    const other = intents.filter(intent => !sectionIds.includes(intent.id));
    return (
      <>
        <fieldset className="client-intent">
          <legend>Client intent</legend>
          <h4>Offer intent</h4>{offered.length ? offered.map(renderIntent) : <p className="immutable-note">No Product intent selected.</p>}
          <h4>Other Product intent</h4>{other.length ? other.map(renderIntent) : <p className="immutable-note">No other Product intent.</p>}
        </fieldset>
        <fieldset>
          <legend>Financial intent</legend>
          {document.entities
            .filter((entity) => entity.kind === 'financial_desired_outcome')
            .map((outcome) => (
              <label className="intent-selection financial-intent" key={outcome.id}>
                <input
                  type="checkbox"
                  checked={d.financialOutcomeIds.includes(outcome.id)}
                  onChange={(event) =>
                    setter({
                      ...d,
                      financialOutcomeIds: event.target.checked ? [...d.financialOutcomeIds, outcome.id] : d.financialOutcomeIds.filter((id) => id !== outcome.id),
                    })
                  }
                />
                <span><strong>{outcome.title}</strong><small>Financial Desired Outcome</small></span>
              </label>
            ))}
        </fieldset>
      </>
    );
  }
  function closeMenuAndRestoreFocus() {
    const owner = menuOwnerRef.current;
    const entityId = menu?.type === 'node' ? menu.entityId : undefined;
    setMenu(null);
    if (entityId) focusEntity(entityId);
    else owner?.focus();
  }
  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
    const current = items.indexOf(globalThis.document.activeElement as HTMLElement);
    let target: number;
    if (event.key === 'ArrowDown') target = current < 0 ? 0 : (current + 1) % items.length;
    else if (event.key === 'ArrowUp') target = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = items.length - 1;
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenuAndRestoreFocus();
      return;
    } else if ((event.key === 'Enter' || event.key === ' ') && current >= 0) {
      event.preventDefault();
      items[current]?.click();
      return;
    } else return;
    event.preventDefault();
    items[target]?.focus();
  }
  function touchpointBusinessStructureSection() {
    const structure = touchpointBusinessStructure;
    if (!structure) return null;
    const navigationList = (entities: { id: string; title: string }[]) => entities.length
      ? <ul className="business-structure-links">{entities.map(entity => <li key={entity.id}><button type="button" onClick={() => navigateInspector(entity.id)}>{entity.title}</button></li>)}</ul>
      : <p className="business-structure-empty" aria-label="None">—</p>;
    const entitiesById = new Map(document.entities.map(entity => [entity.id, entity]));
    const semanticProjection = deriveTouchpointClientIntentNeighborhood(document, structure.touchpoint.id);
    const resolveSemanticEntity = (id: string) => {
      const entity = entitiesById.get(id);
      if (!entity) throw new Error(`Touchpoint Client-intent Neighborhood projection references missing entity ${id}`);
      return entity;
    };
    const offers = (ids: readonly string[]) => ids.map(id => {
      const entity = resolveSemanticEntity(id);
      if (entity.kind !== 'offer') throw new Error(`Touchpoint Client-intent Neighborhood contributor ${id} is not an Offer`);
      return entity;
    });
    const touchpoint = (id: string) => {
      const entity = resolveSemanticEntity(id);
      if (entity.kind !== 'touchpoint') throw new Error(`Touchpoint Client-intent Neighborhood endpoint ${id} is not a Touchpoint`);
      return entity;
    };
    const outcome = (id: string) => {
      const entity = resolveSemanticEntity(id);
      if (entity.kind !== 'desired_outcome') throw new Error(`Touchpoint Client-intent Neighborhood outcome ${id} is not an ordinary Desired Outcome`);
      return entity;
    };
    const contributorGroup = (label: string, ids: readonly string[]): NeighborhoodSemanticContributorGroup => ({ label, offers: offers(ids) });
    const touchpointJobModel = (ground: TouchpointClientIntentJobGround): NeighborhoodSemanticViewModel => {
      const basisEntity = resolveSemanticEntity(ground.basisId);
      if (basisEntity.kind !== ground.jobKind) throw new Error(`Touchpoint Client-intent Neighborhood basis ${ground.basisId} is not a ${ground.jobKind} Job`);
      const comparesOutcomes = ['core_functional_job', 'related_job', 'consumption_chain_job'].includes(ground.jobKind);
      const outcomeModel = (id: string, provenance: NeighborhoodSemanticContributorGroup[]): NeighborhoodSemanticOutcome => ({ entity: outcome(id), provenance });
      const comparisonModel = (comparison: TouchpointClientIntentJobComparison): NeighborhoodSemanticNeighborBlock => {
        const neighbor = touchpoint(comparison.touchpointId);
        if (!comparesOutcomes) return { entity: neighbor, contributorGroups: [contributorGroup(`${neighbor.title} via`, comparison.contributorOfferIds)] };
        const inspectedContributors = (id: string) => ground.inspectedDesiredOutcomes.find(detail => detail.desiredOutcomeId === id)?.contributorOfferIds ?? [];
        const neighborContributors = (id: string) => comparison.desiredOutcomes.find(detail => detail.desiredOutcomeId === id)?.contributorOfferIds ?? [];
        return {
          entity: neighbor,
          outcomeCategories: [
            { label: 'Shared selected outcomes', outcomes: comparison.commonDesiredOutcomeIds.map(id => outcomeModel(id, [contributorGroup('Here via', inspectedContributors(id)), contributorGroup(`${neighbor.title} via`, neighborContributors(id))])) },
            { label: `Only ${structure.touchpoint.title}`, outcomes: comparison.inspectedOnlyDesiredOutcomeIds.map(id => outcomeModel(id, [contributorGroup('Here via', inspectedContributors(id))])) },
            { label: `Only ${neighbor.title}`, outcomes: comparison.neighborOnlyDesiredOutcomeIds.map(id => outcomeModel(id, [contributorGroup(`${neighbor.title} via`, neighborContributors(id))])) },
          ],
        };
      };
      return {
        basisLabel: 'Job basis',
        basisEntity,
        ...(comparesOutcomes ? { explanation: 'This ground exists because these Touchpoints share a locally materialized Job. Outcome rows compare only their local Touchpoint subsets.' } : { contributorGroups: [contributorGroup('Here via', ground.inspectedContributorOfferIds)] }),
        neighbors: ground.neighborComparisons.map(comparisonModel),
      };
    };
    const touchpointFinancialModel = (ground: TouchpointClientIntentFinancialDesiredOutcomeGround): NeighborhoodSemanticViewModel => {
      const basisEntity = resolveSemanticEntity(ground.basisId);
      if (basisEntity.kind !== 'financial_desired_outcome') throw new Error(`Touchpoint Client-intent Neighborhood basis ${ground.basisId} is not a Financial Desired Outcome`);
      return {
        basisLabel: 'Financial Desired Outcome',
        basisEntity,
        contributorGroups: [contributorGroup('Here via', ground.inspectedContributorOfferIds)],
        neighbors: ground.neighborComparisons.map(comparison => {
          const neighbor = touchpoint(comparison.touchpointId);
          return { entity: neighbor, contributorGroups: [contributorGroup(`${neighbor.title} via`, comparison.contributorOfferIds)] };
        }),
      };
    };
    const semanticGroups: NeighborhoodPresentationGroup[] = (semanticProjection?.grounds ?? []).map(ground => ({
      id: ground.id,
      groundTypeId: ground.groundTypeId,
      groundTypeLabel: CLIENT_INTENT_GROUND_TYPE_LABELS[ground.groundTypeId],
      basisKind: ground.basisKind,
      basisId: ground.basisId,
      label: resolveSemanticEntity(ground.basisId).title,
      linkedEntities: ground.neighborTouchpointIds.map(touchpoint),
      count: ground.count,
      renderExpandedContent: onNavigate => <SemanticNeighborhoodContent model={ground.basisKind === 'job' ? touchpointJobModel(ground) : touchpointFinancialModel(ground)} onNavigate={onNavigate} />,
    }));
    const neighborhoodGroups: NeighborhoodPresentationGroup[] = [
      ...structure.otherTouchpointsByOffer.map((group) => ({
        id: `offer:${group.offer.id}`,
        groundTypeId: 'offer',
        groundTypeLabel: 'Offer',
        basisKind: 'offer' as const,
        basisId: group.offer.id,
        label: `Other Touchpoints for ${group.offer.title}`,
        linkedEntities: group.touchpoints,
        count: group.touchpoints.length,
      })),
      ...(structure.container && structure.otherTouchpointsInContainer.length > 0 ? [{
        id: `container:${structure.container.id}`,
        groundTypeId: 'container',
        groundTypeLabel: 'Located in',
        basisKind: 'container' as const,
        basisId: structure.container.id,
        label: `More in ${structure.container.title}`,
        linkedEntities: structure.otherTouchpointsInContainer,
        count: structure.otherTouchpointsInContainer.length,
      }] : []),
      ...semanticGroups,
    ];
    const storedExpansion = neighborhoodExpanded[structure.touchpoint.id];
    const initialExpansion = initialCompactOverviewExpandedGroupIds(neighborhoodGroups);
    const toggleNeighborhoodGroup = (groupId: string) => setNeighborhoodExpanded((current) => {
      const existing = current[structure.touchpoint.id];
      const snapshot = existing ?? Object.fromEntries(neighborhoodGroups.map((group) => [group.id, initialExpansion.has(group.id)]));
      return { ...current, [structure.touchpoint.id]: { ...snapshot, [groupId]: !(snapshot[groupId] ?? false) } };
    });
    const runChildrenCommand = (command: TouchpointStructuralCommand, choices: Record<string, string> = {}, returnMode: 'list' | 'reassign-one' | 'reassign-all' = 'list') => {
      try {
        const result = planTouchpointStructuralChange(documentRef.current, { command, ancestorContributorChoices: choices, newId: () => crypto.randomUUID() });
        if (result.status === 'complete') {
          let committed = result.document;
          command.childTouchpointIds.forEach(id => { committed = reconsiderPlacementAfterRelationCommit(documentRef.current, committed, VIEW_ID, id); });
          setDocument(committed); setChildrenEditor({ mode: 'list', query: '' });
          if (result.affectedAncestorTouchpointIds.length) {
            const titles = result.affectedAncestorTouchpointIds.map(id => committed.entities.find(entity => entity.id === id)?.title).filter(Boolean);
            publishSuccess(titles.length === 1 ? `Client scope also updated on ${titles[0]}.` : `Client scope also updated on ${titles.length} ancestor Touchpoints.`);
          }
        } else if (result.status === 'unresolved') setChildrenEditor({ mode: 'resolve-contributor', query: '', command, choices, obligationKey: result.obligationKey, touchpointId: result.touchpointId, candidateOfferIds: result.candidateOfferIds, returnMode });
        else setChildrenEditor(current => current ? { ...current, error: result.reason === 'no_ancestor_contributor_path' ? `No contributor path is available for ${entityTitle(documentRef.current, result.touchpointId)}.` : 'That structural change is not valid.' } : current);
      } catch (error) { setChildrenEditor(current => current ? { ...current, error: error instanceof Error ? error.message : 'Children could not be updated.' } : current); }
    };
    const createChild = (title: string, offerId: string) => {
      if (!title.trim() || !offerId) return;
      try {
        const entityId = crypto.randomUUID();
        const placement = findRelatedPlacement(documentRef.current, VIEW_ID, layoutForEntity({ kind: 'touchpoint', title }), [structure.touchpoint.id], [{ sourceId: structure.touchpoint.id, targetId: entityId }]);
        const next = addEntity(documentRef.current, { entityId, kind: 'touchpoint', title, viewId: VIEW_ID, x: placement.x, y: placement.y, linkedOfferIds: [offerId], relationshipIds: [crypto.randomUUID()], parentTouchpointId: structure.touchpoint.id, parentRelationshipId: crypto.randomUUID() });
        setDocument(next); setChildrenEditor({ mode: 'list', query: '' });
      } catch (error) { setChildrenEditor(current => current?.mode === 'create-child' ? { ...current, error: error instanceof Error ? error.message : 'Child could not be created.' } : current); }
    };
    const renderChildrenEditor = () => {
      if (!childrenEditor) return null;
      const candidateModel = deriveTouchpointChildrenCandidates(document, structure.touchpoint.id);
      if (childrenEditor.mode === 'resolve-contributor') return <div ref={childrenEditorRef} className="inspector-relation-editor" aria-label="Children contributor resolver"><fieldset><legend>Choose contributor for {entityTitle(document, childrenEditor.touchpointId)}</legend>{childrenEditor.candidateOfferIds.map(offerId => <label className="inspector-relation-row inspector-relation-row-radio" key={offerId}><input type="radio" name="children-contributor" onChange={() => runChildrenCommand(childrenEditor.command, { ...childrenEditor.choices, [childrenEditor.obligationKey]: offerId }, childrenEditor.returnMode)} /><span className="inspector-relation-indicator" aria-hidden="true"/><span>{entityTitle(document, offerId)}</span></label>)}</fieldset><button type="button" onClick={() => setChildrenEditor(previousChildrenEditorLevel(childrenEditor))}>Back</button></div>;
      if (childrenEditor.mode === 'create-child') {
        const offerIds = structure.offers.map(offer => offer.id); const chosen = offerIds.length === 1 ? offerIds[0]! : childrenEditor.offerId;
        return <div ref={childrenEditorRef} className="inspector-relation-editor" aria-label="Create child"><div className="inspector-relation-editor-header"><strong>Create child</strong><button type="button" data-discard-child-creation onPointerDown={() => { discardChildCreationRef.current = true; }} onClick={() => setChildrenEditor({ mode: 'list', query: '' })}>Back</button></div>{!offerIds.length ? <p role="alert">Link an Offer to this Touchpoint before creating a child.</p> : <><label>Title<input autoFocus value={childrenEditor.title} onChange={event => setChildrenEditor({ ...childrenEditor, title: event.target.value })} onBlur={event => { const movingToDiscard = event.relatedTarget instanceof HTMLElement && Boolean(event.relatedTarget.closest('[data-discard-child-creation]')); if (!discardChildCreationRef.current && !movingToDiscard) createChild(event.currentTarget.value, chosen); discardChildCreationRef.current = false; }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); createChild(event.currentTarget.value, chosen); } }} /></label>{offerIds.length > 1 && <fieldset><legend>Initial Offer</legend>{structure.offers.map(offer => <label className="inspector-relation-row inspector-relation-row-radio" key={offer.id}><input type="radio" name="child-offer" checked={childrenEditor.offerId === offer.id} onChange={() => { const next = { ...childrenEditor, offerId: offer.id }; setChildrenEditor(next); createChild(next.title, offer.id); }} /><span className="inspector-relation-indicator" aria-hidden="true"/><span>{offer.title}</span></label>)}</fieldset>}</>}{childrenEditor.error && <p role="alert">{childrenEditor.error}</p>}</div>;
      }
      if (childrenEditor.mode === 'reassign-one' || childrenEditor.mode === 'reassign-all') {
        const allTargets = deriveTouchpointReassignTargets(document, childrenEditor.childTouchpointIds, structure.touchpoint.id);
        const targets = allTargets.filter(item => !childrenEditor.query || item.title.toLocaleLowerCase().includes(childrenEditor.query.toLocaleLowerCase()));
        const searchable = allTargets.length >= RELATION_EDITOR_SEARCH_THRESHOLD;
        return <div ref={childrenEditorRef} className="inspector-relation-editor" aria-label="Reassign children"><div className="inspector-relation-editor-header"><strong>Choose new parent</strong><button type="button" onClick={() => setChildrenEditor({ mode: 'list', query: '' })}>Back</button></div>{searchable && <label>Search Touchpoints<input type="search" value={childrenEditor.query} onChange={event => setChildrenEditor({ ...childrenEditor, query: event.target.value })}/></label>}<div role="radiogroup">{targets.map(target => <label className="inspector-relation-row inspector-relation-row-radio" key={target.id}><input type="radio" name="children-target" onChange={() => runChildrenCommand({ kind: 'reassign', childTouchpointIds: childrenEditor.childTouchpointIds, targetParentTouchpointId: target.id }, {}, childrenEditor.mode)} /><span className="inspector-relation-indicator" aria-hidden="true"/><span>{target.title}</span></label>)}</div>{childrenEditor.error && <p role="alert">{childrenEditor.error}</p>}</div>;
      }
      const all = [...candidateModel.currentChildren, ...candidateModel.standaloneBranches.map(item => item.touchpoint), ...candidateModel.standaloneLeaves.map(item => item.touchpoint)];
      const searchable = all.length >= RELATION_EDITOR_SEARCH_THRESHOLD; const query = childrenEditor.query.toLocaleLowerCase();
      const row = (touchpoint: Extract<Entity, { kind: 'touchpoint' }>, checked: boolean, childCount = 0) => <div className="children-relation-row" key={touchpoint.id}><label className="inspector-relation-row inspector-relation-row-checkbox"><input type="checkbox" checked={checked} onChange={event => runChildrenCommand(event.target.checked ? { kind: 'attach', childTouchpointIds: [touchpoint.id], targetParentTouchpointId: structure.touchpoint.id } : { kind: 'detach', childTouchpointIds: [touchpoint.id] })}/><span className="inspector-relation-indicator" aria-hidden="true"/><span>{touchpoint.title}{childCount > 0 && <small>{childCount} {childCount === 1 ? 'child' : 'children'}</small>}</span></label>{checked && <button type="button" className="inspector-secondary-action" onClick={() => setChildrenEditor({ mode: 'reassign-one', query: '', childTouchpointIds: [touchpoint.id] })}>Reassign…</button>}</div>;
      const filter = <T extends { touchpoint: { title: string } }>(items: T[]) => items.filter(item => !query || item.touchpoint.title.toLocaleLowerCase().includes(query));
      return <div ref={childrenEditorRef} className="inspector-relation-editor" aria-label="Children editor">
        <div className="inspector-relation-editor-header children-editor-header">
          <div className="children-editor-heading"><strong>Children</strong><button type="button" onClick={() => { discardChildCreationRef.current = false; setChildrenEditor({ mode: 'create-child', query: '', title: '', offerId: '' }); }}>Create child</button></div>
          <button type="button" className="inspector-secondary-action" onClick={() => closeChildrenEditor('explicit')}>Close</button>
        </div>
        {searchable && <label className="inspector-relation-editor-search">Search Touchpoints<input type="search" value={childrenEditor.query} onChange={event => setChildrenEditor({ ...childrenEditor, query: event.target.value })}/></label>}
        <div className="children-current-heading">
          <h6>Current children</h6>
          {candidateModel.currentChildren.length > 0 && <div className="children-current-actions"><button type="button" className="inspector-secondary-action" onClick={() => setChildrenEditor({ mode: 'reassign-all', query: '', childTouchpointIds: candidateModel.currentChildren.map(item => item.id) })}>Reassign all…</button><button type="button" className="inspector-secondary-action" onClick={() => runChildrenCommand({ kind: 'detach', childTouchpointIds: candidateModel.currentChildren.map(item => item.id) })}>Detach all</button></div>}
        </div>
        {candidateModel.currentChildren.filter(item => !query || item.title.toLocaleLowerCase().includes(query)).map(item => row(item, true))}
        <h6>Available standalone branches</h6>{filter(candidateModel.standaloneBranches).map(item => row(item.touchpoint, false, item.childCount))}
        <h6>Available standalone leaves</h6>{filter(candidateModel.standaloneLeaves).map(item => row(item.touchpoint, false))}
        {childrenEditor.error && <p role="alert">{childrenEditor.error}</p>}
      </div>;
    };
    return <>
      <section className="touchpoint-business-structure" aria-label="Business structure">
      <div className="business-structure-primary">
        <div className="business-structure-regions">
          <section className="business-structure-region business-structure-placement" aria-labelledby="business-placement-heading">
            <h5 id="business-placement-heading">Placement</h5>
            <div className="business-structure-property" role="group" aria-label="Offers property">
              {offersPicker ? (() => {
                const query = offersPicker.query.trim().toLocaleLowerCase();
                const allOffers = document.entities.filter(entity => entity.kind === 'offer');
                const offers = allOffers.filter(entity => !query || entity.title.toLocaleLowerCase().includes(query));
                const linked = new Set(structure.offers.map(offer => offer.id));
                const searchable = allOffers.length >= RELATION_EDITOR_SEARCH_THRESHOLD;
                return <div ref={relationEditorRef} className="inspector-relation-editor" aria-label="Linked Offers editor">
                  <div className="inspector-relation-editor-header"><strong>Linked Offers</strong><button type="button" className="inspector-secondary-action" onClick={() => closeRelationEditor('explicit')}>Close</button></div>
                  {searchable && <label className="inspector-relation-editor-search" htmlFor="linked-offers-search">Search Offers<input autoFocus id="linked-offers-search" type="search" value={offersPicker.query} onChange={event => setOffersPicker({ query: event.target.value })} /></label>}
                  <div className="inspector-relation-candidates" aria-live="polite">
                    {offers.length ? offers.map((offer, index) => <label className="inspector-relation-row inspector-relation-row-checkbox" key={offer.id}><input autoFocus={!searchable && index === 0} type="checkbox" checked={linked.has(offer.id)} onChange={event => requestLinkedOffersCommit(event.target.checked ? [...linked, offer.id] : [...linked].filter(id => id !== offer.id), event.currentTarget)} /><span className="inspector-relation-indicator" aria-hidden="true" /><span>{offer.title}</span></label>) : <p>No matching Offers.</p>}
                  </div>
                </div>;
              })() : <><h5 aria-label="Offers"><button ref={offersPickerButtonRef} data-touchpoint-editor-affordance type="button" className="inspector-property-heading-action" aria-label="Edit linked Offers" onClick={openOffersEditor}>Offers<span className="inspector-property-heading-hint" aria-hidden="true">Click to edit</span></button></h5>{navigationList(structure.offers)}</>}
            </div>
            <div className="business-structure-property" role="group" aria-label="Located in property">{businessInlineEdit?.property === 'located-in' ? <h5>Located in</h5> : <h5 aria-label="Located in"><button ref={locatedInEditButtonRef} data-touchpoint-editor-affordance type="button" className="inspector-property-heading-action" aria-label="Edit Located in" onClick={() => openLocatedInEditor(structure.container?.title ?? '')}>Located in<span className="inspector-property-heading-hint" aria-hidden="true">Click to edit</span></button></h5>}{businessInlineEdit?.property === 'located-in' ? (() => {
              const trimmedQuery = businessInlineEdit.query.trim();
              const normalized = trimmedQuery.toLocaleLowerCase();
              const matches = document.touchpointContainers.filter(container => container.title.toLocaleLowerCase().includes(normalized));
              const exact = document.touchpointContainers.find(container => container.title.trim().toLocaleLowerCase() === normalized);
              const commitQuery = () => {
                if (exact) commitInlineLocation({ kind: 'existing', containerId: exact.id });
                else if (trimmedQuery) commitInlineLocation({ kind: 'new', title: trimmedQuery });
              };
              return <div className="combobox business-structure-editor" onPointerDown={event => event.stopPropagation()}>
                <input autoFocus role="combobox" aria-label="Edit Located in" aria-expanded="true" aria-controls="business-location-options" value={businessInlineEdit.query} onChange={event => setBusinessInlineEdit({ property: 'located-in', query: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commitQuery(); } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setBusinessInlineEdit(null); requestAnimationFrame(() => locatedInEditButtonRef.current?.focus()); } }} />
                <div id="business-location-options" role="listbox">
                  <button type="button" role="option" aria-selected={!structure.container} onClick={() => commitInlineLocation({ kind: 'none' })}>{structure.container ? 'Clear location' : 'No location'}</button>
                  {matches.map(container => <button type="button" role="option" aria-selected={structure.container?.id === container.id} key={container.id} onClick={() => commitInlineLocation({ kind: 'existing', containerId: container.id })}>{container.title}</button>)}
                  {trimmedQuery && !exact && <button type="button" role="option" aria-selected="false" onClick={commitQuery}>Create &quot;{trimmedQuery}&quot;</button>}
                </div>
                {businessInlineEdit.error && <p className="error-message" role="alert">{businessInlineEdit.error}</p>}
              </div>;
            })() : <button data-touchpoint-editor-affordance type="button" className={`business-structure-edit-value${structure.container ? '' : ' business-structure-edit-empty'}`} onClick={() => openLocatedInEditor(structure.container?.title ?? '')} aria-label={structure.container ? `Edit Located in, ${structure.container.title}` : 'Add location'}>{structure.container?.title ?? 'Add location'}</button>}</div>
            <div className="business-structure-property business-structure-url" role="group" aria-label="Web address property">{businessInlineEdit?.property === 'url' ? <h5>URL</h5> : <h5 aria-label="URL"><button ref={urlEditButtonRef} data-touchpoint-editor-affordance type="button" className="inspector-property-heading-action" aria-label="Edit web address" onClick={() => openUrlEditor(structure.touchpoint.url ?? '')}>URL<span className="inspector-property-heading-hint" aria-hidden="true">Click to edit</span></button></h5>}{businessInlineEdit?.property === 'url' ? <div className="business-structure-editor"><input autoFocus aria-label="Edit web address" value={businessInlineEdit.value} onChange={event => setBusinessInlineEdit({ property: 'url', value: event.target.value })} onBlur={event => commitInlineUrl(event.currentTarget.value)} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); commitInlineUrl(event.currentTarget.value); } else if (event.key === 'Escape') { event.preventDefault(); setBusinessInlineEdit(null); requestAnimationFrame(() => urlEditButtonRef.current?.focus()); } }} />{businessInlineEdit.error && <p className="error-message" role="alert">{businessInlineEdit.error}</p>}</div> : (() => {
              const storedUrl = structure.touchpoint.url;
              const destination = safeUrl(storedUrl);
              if (destination) return <a className="business-structure-external-link" href={destination} target="_blank" rel="noreferrer">{storedUrl}</a>;
              if (storedUrl) return <span>{storedUrl}</span>;
              return <button data-touchpoint-editor-affordance type="button" className="business-structure-edit-value business-structure-edit-empty" onClick={() => openUrlEditor('')}>Add URL</button>;
            })()}</div>
          </section>
          <section className="business-structure-region business-structure-containment" aria-labelledby="business-containment-heading">
            <h5 id="business-containment-heading">Containment</h5>
            <div className="business-structure-property" role="group" aria-label="Parent property">{parentPicker ? <h5>Parent</h5> : <h5 aria-label="Parent"><button ref={parentPickerButtonRef} data-touchpoint-editor-affordance type="button" className="inspector-property-heading-action" aria-label="Edit parent Touchpoint" onClick={openParentEditor}>Parent<span className="inspector-property-heading-hint" aria-hidden="true">Click to edit</span></button></h5>}
              {parentPicker ? (() => {
                const query = parentPicker.query.trim().toLocaleLowerCase();
                const allOptions = parentTouchpointOptions(documentRef.current, structure.touchpoint.id);
                const options = allOptions.filter(option => !query || option.title.toLocaleLowerCase().includes(query));
                const searchable = allOptions.length >= RELATION_EDITOR_SEARCH_THRESHOLD;
                const selectedParentId = structure.parent?.id ?? '';
                return <div ref={relationEditorRef} className="inspector-relation-editor" aria-label="Parent Touchpoint editor">
                  <div className="inspector-relation-editor-header"><strong>Parent Touchpoint</strong><div className="inspector-relation-editor-actions">{structure.parent && <button type="button" className="inspector-secondary-action" onClick={() => commitParentImmediately(structure.touchpoint.id, '')}>Clear parent</button>}<button type="button" className="inspector-secondary-action" onClick={() => closeRelationEditor('explicit')}>Close</button></div></div>
                  {searchable && <label className="inspector-relation-editor-search" htmlFor="parent-touchpoint-search">Search Touchpoints<input autoFocus id="parent-touchpoint-search" type="search" value={parentPicker.query} onChange={event => setParentPicker({ query: event.target.value })} /></label>}
                  <div className="inspector-relation-candidates" role="radiogroup" aria-label="Parent Touchpoint options" aria-live="polite">
                    {options.length ? options.map((option, index) => <label className="inspector-relation-row inspector-relation-row-radio" key={option.id}><input autoFocus={!searchable && index === 0} type="radio" name="parent-touchpoint" checked={selectedParentId === option.id} onChange={() => undefined} onClick={() => commitParentImmediately(structure.touchpoint.id, option.id)} /><span className="inspector-relation-indicator" aria-hidden="true" /><span>{option.title}</span></label>) : <p role="status">No matching Touchpoints.</p>}
                  </div>
                </div>;
              })() : structure.parent ? navigationList([structure.parent]) : <button data-touchpoint-editor-affordance type="button" className="business-structure-edit-value business-structure-edit-empty" onClick={openParentEditor}>Add parent</button>}
            </div>
            <div className="business-structure-property" role="group" aria-label="Children property">{childrenEditor ? renderChildrenEditor() : <><h5 aria-label="Children"><button ref={childrenEditorButtonRef} data-touchpoint-editor-affordance type="button" className="inspector-property-heading-action" aria-label="Edit Children" onClick={openChildrenEditor}>Children<span className="inspector-property-heading-hint" aria-hidden="true">Click to edit</span></button></h5>{navigationList(structure.children)}</>}</div>
          </section>
        </div>
      </div>
      </section>
      {neighborhoodGroups.length > 0 && <NeighborhoodGroups groups={neighborhoodGroups} entityNoun="Touchpoints" inspectedOwnerId={structure.touchpoint.id} expansionSnapshot={storedExpansion} onToggle={toggleNeighborhoodGroup} emptyStateText="No related Touchpoints" onNavigate={navigateInspector} ariaLabel="Touchpoint neighborhood" contentIdPrefix="neighborhood" />}
    </>;
  }
  function offerNeighborhoodSection() {
    if (selected?.kind !== 'offer') return null;
    type OfferEntity = Extract<Entity, { kind: 'offer' }>;
    type OfferNeighborhoodGroup = { id: string; label: string; groundTypeId: 'product' | 'touchpoint'; groundTypeLabel: 'Product' | 'Touchpoint'; offers: OfferEntity[]; basisKind: 'product' | 'touchpoint'; basisId: string };
    const entitiesById = new Map(document.entities.map(entity => [entity.id, entity]));
    const offerSort = (left: OfferEntity, right: OfferEntity) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
    const groups: OfferNeighborhoodGroup[] = [];

    const product = document.relationships.flatMap(relation => {
      if (relation.kind !== 'product_packaged_as_offer' || relation.offerId !== selected.id) return [];
      const candidate = entitiesById.get(relation.productId);
      return candidate?.kind === 'product' ? [candidate] : [];
    })[0];
    if (product) {
      const siblingIds = new Set(document.relationships.flatMap(relation =>
        relation.kind === 'product_packaged_as_offer' && relation.productId === product.id && relation.offerId !== selected.id
          ? [relation.offerId]
          : [],
      ));
      const offers = [...siblingIds].flatMap(id => {
        const entity = entitiesById.get(id);
        return entity?.kind === 'offer' ? [entity] : [];
      }).sort(offerSort);
      if (offers.length) groups.push({ id: `product:${product.id}`, label: `Other Offers for ${product.title}`, groundTypeId: 'product', groundTypeLabel: 'Product', offers, basisKind: 'product', basisId: product.id });
    }

    const touchpoints = [...new Set(document.relationships.flatMap(relation =>
      relation.kind === 'offer_presented_at_touchpoint' && relation.offerId === selected.id ? [relation.touchpointId] : [],
    ))].flatMap(id => {
      const entity = entitiesById.get(id);
      return entity?.kind === 'touchpoint' ? [entity] : [];
    }).sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id));
    for (const touchpoint of touchpoints) {
      const neighborIds = new Set(document.relationships.flatMap(relation =>
        relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === touchpoint.id && relation.offerId !== selected.id
          ? [relation.offerId]
          : [],
      ));
      const offers = [...neighborIds].flatMap(id => {
        const entity = entitiesById.get(id);
        return entity?.kind === 'offer' ? [entity] : [];
      }).sort(offerSort);
      if (offers.length) groups.push({ id: `touchpoint:${touchpoint.id}`, label: `Other Offers on ${touchpoint.title}`, groundTypeId: 'touchpoint', groundTypeLabel: 'Touchpoint', offers, basisKind: 'touchpoint', basisId: touchpoint.id });
    }
    const semanticProjection = deriveOfferClientIntentNeighborhood(document, selected.id);
    const resolveProjectionEntity = (id: string) => {
      const entity = entitiesById.get(id);
      if (!entity) throw new Error(`Offer Client-intent Neighborhood projection references missing entity ${id}`);
      return entity;
    };
    const offerSemanticModel = (ground: OfferClientIntentGround): NeighborhoodSemanticViewModel => {
      const basisEntity = resolveProjectionEntity(ground.basisId);
      if (ground.basisKind === 'financial_desired_outcome') {
        if (basisEntity.kind !== 'financial_desired_outcome') throw new Error(`Offer Client-intent Neighborhood basis ${ground.basisId} is not a Financial Desired Outcome`);
        return {
          basisLabel: 'Financial Desired Outcome',
          basisEntity,
          neighbors: ground.neighborOfferIds.map(id => {
            const entity = resolveProjectionEntity(id);
            if (entity.kind !== 'offer') throw new Error(`Offer Client-intent Neighborhood projection endpoint ${id} is not an Offer`);
            return { entity };
          }),
        };
      }
      if (basisEntity.kind !== ground.jobKind) throw new Error(`Offer Client-intent Neighborhood basis ${ground.basisId} is not a ${ground.jobKind} Job`);
      const comparisonModel = (comparison: OfferClientIntentJobComparison): NeighborhoodSemanticNeighborBlock => {
        const neighbor = resolveProjectionEntity(comparison.offerId);
        if (neighbor.kind !== 'offer') throw new Error(`Offer Client-intent Neighborhood projection endpoint ${comparison.offerId} is not an Offer`);
        const outcomes = (ids: readonly string[]): NeighborhoodSemanticOutcome[] => ids.map(id => {
          const entity = resolveProjectionEntity(id);
          if (entity.kind !== 'desired_outcome') throw new Error(`Offer Client-intent Neighborhood outcome ${id} is not an ordinary Desired Outcome`);
          return { entity };
        });
        return {
          entity: neighbor,
          outcomeCategories: [
            { label: 'Shared selected outcomes', outcomes: outcomes(comparison.commonDesiredOutcomeIds) },
            { label: `Only ${selected.title}`, outcomes: outcomes(comparison.inspectedOnlyDesiredOutcomeIds) },
            { label: `Only ${neighbor.title}`, outcomes: outcomes(comparison.neighborOnlyDesiredOutcomeIds) },
          ],
        };
      };
      const comparesOutcomes = ['core_functional_job', 'related_job', 'consumption_chain_job'].includes(ground.jobKind);
      return {
        basisLabel: 'Job basis',
        basisEntity,
        ...(comparesOutcomes ? { explanation: 'This ground exists because these Offers select the same Job. Outcome rows compare only their local Offer subsets.' } : {}),
        neighbors: comparesOutcomes ? ground.neighborComparisons.map(comparisonModel) : ground.neighborOfferIds.map(id => {
          const entity = resolveProjectionEntity(id);
          if (entity.kind !== 'offer') throw new Error(`Offer Client-intent Neighborhood projection endpoint ${id} is not an Offer`);
          return { entity };
        }),
      };
    };
    const structuralGroups: NeighborhoodPresentationGroup[] = groups.map(group => ({ id: group.id, label: group.label, groundTypeId: group.groundTypeId, groundTypeLabel: group.groundTypeLabel, count: group.offers.length, linkedEntities: group.offers, basisKind: group.basisKind, basisId: group.basisId }));
    const semanticGroups: NeighborhoodPresentationGroup[] = (semanticProjection?.grounds ?? []).map(ground => ({
      id: ground.id,
      label: resolveProjectionEntity(ground.basisId).title,
      groundTypeId: ground.groundTypeId,
      groundTypeLabel: CLIENT_INTENT_GROUND_TYPE_LABELS[ground.groundTypeId],
      count: ground.count,
      linkedEntities: ground.neighborOfferIds.map(id => {
        const entity = resolveProjectionEntity(id);
        if (entity.kind !== 'offer') throw new Error(`Offer Client-intent Neighborhood projection endpoint ${id} is not an Offer`);
        return entity;
      }),
      basisKind: ground.basisKind,
      basisId: ground.basisId,
      renderExpandedContent: (onNavigate) => <SemanticNeighborhoodContent model={offerSemanticModel(ground)} onNavigate={onNavigate} />,
    }));
    const presentationGroups = [...structuralGroups, ...semanticGroups];
    if (!presentationGroups.length) return null;
    const storedExpansion = offerNeighborhoodExpanded[selected.id];
    const initialExpansion = initialCompactOverviewExpandedGroupIds(presentationGroups);
    const toggleGroup = (groupId: string) => setOfferNeighborhoodExpanded(current => {
      const existing = current[selected.id];
      const snapshot = existing ?? Object.fromEntries(presentationGroups.map(group => [group.id, initialExpansion.has(group.id)]));
      return { ...current, [selected.id]: { ...snapshot, [groupId]: !(snapshot[groupId] ?? false) } };
    });
    return <NeighborhoodGroups groups={presentationGroups} entityNoun="Offers" inspectedOwnerId={selected.id} expansionSnapshot={storedExpansion} onToggle={toggleGroup} emptyStateText="No other Offers" onNavigate={navigateInspector} className="offer-neighborhood" ariaLabel="Offer neighborhood" contentIdPrefix="offer-neighborhood" />;
  }
  function touchpointResistanceSection() {
    if (selected?.kind !== 'touchpoint') return null;
    const repulsors = relevantRepulsorsForTouchpoint(document, selected.id);
    const mitigated = new Set(document.relationships.flatMap(relation => relation.kind === 'touchpoint_mitigates_repulsor' && relation.touchpointId === selected.id ? [relation.repulsorId] : []));
    const commitMitigation = (repulsorId: string, checked: boolean) => {
      const result = commitSemanticOperation(documentRef.current, semanticCommitState({ semanticallyComplete: true, valid: true }), durable =>
        commitTouchpointMitigation(durable, { touchpointId: selected.id, repulsorId, mitigated: checked, newId: () => crypto.randomUUID() }));
      if (result.state.status === 'failed') {
        publishError(result.state.message);
        return;
      }
      documentRef.current = result.document;
      setDocument(result.document);
      const durableIds = result.document.relationships.flatMap(relation => relation.kind === 'touchpoint_mitigates_repulsor' && relation.touchpointId === selected.id ? [relation.repulsorId] : []);
      setEditDraft(current => current ? { ...current, mitigatedRepulsorIds: durableIds } : current);
      publishSuccess(checked ? 'Mitigation added.' : 'Mitigation removed.');
    };
    return <section className="touchpoint-resistance" aria-labelledby="touchpoint-resistance-heading">
      <h4 id="touchpoint-resistance-heading">Resistance</h4>
      {repulsors.length ? <ul>{repulsors.map(repulsor => <li key={repulsor.id}>
        <button type="button" className="inspector-entity-navigation" onClick={() => navigateInspector(repulsor.id)}>{repulsor.title}</button>
        <small className="touchpoint-resistance-derived">Derived</small>
        <label className="touchpoint-resistance-mitigation"><input type="checkbox" aria-label={`${repulsor.title}: Mitigated here`} checked={mitigated.has(repulsor.id)} onChange={event => commitMitigation(repulsor.id, event.target.checked)} />Mitigated here</label>
      </li>)}</ul> : <p className="touchpoint-resistance-empty">No relevant Repulsors.</p>}
    </section>;
  }
  function quickForm(q: Quick) {
    return (
      <form
        ref={(element) => {
          contextualEditorRef.current = element;
        }}
        className="contextual-editor"
        style={{
          left: q.overlay.x,
          top: q.overlay.y,
          visibility: q.positioned ? 'visible' : 'hidden',
        }}
        onSubmit={(e) => {
          e.preventDefault();
          const placement = automaticPlacement(q.draft, q.flow);
          commit(q.draft, placement.x, placement.y, postCreateContinuation(e));
        }}
        onKeyDown={(e: ReactKeyboardEvent) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setQuick(null);
          }
        }}
      >
        <h3>Add {KIND_LABELS[q.draft.kind]}</h3>
        <AutoGrowingTitleField autoFocus={q.positioned} value={q.draft.title} onChange={(title) => setQuick({ ...q, draft: { ...q.draft, title } })} />
        {q.draft.kind === 'repulsor' && <p>Resists: {q.draft.resistedTargetIds.map((id) => document.entities.find((entity) => entity.id === id)?.title).join(', ')}</p>}
        <div className="actions">
          <button className="primary" name="continuation" value="map">Create</button>
          <button name="continuation" value="inspector">Create &amp; open Inspector</button>
          <button type="button" onClick={() => setQuick(null)}>
            Cancel
          </button>
        </div>
        {message && (
          <p className={message.kind === 'error' ? 'error-message' : 'status-message'} role={message.kind === 'error' ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}
      </form>
    );
  }

  return (
    <main className="map-page">
      <header className="map-header">
        <div>
          <Link to="/">VEE Software</Link>
          <h1>Map-first authoring spike</h1>
          <p>In-memory authored 2D map. Select a node and press Tab or right click to open its Entity Context Menu.</p>
        </div>
        <button
          className="primary"
          onClick={startRootCreation}
        >
          Add element
        </button>
      </header>
      <div className="workspace-tabs" role="tablist" aria-label="Workspace views">
        <button id="map-workspace-tab" role="tab" aria-selected={activeWorkspaceView === 'map'} aria-controls="map-workspace-panel" tabIndex={activeWorkspaceView === 'map' ? 0 : -1} onClick={() => activateWorkspaceView('map')} onKeyDown={handleTabKeyDown}>Map</button>
        <button id="inspector-workspace-tab" role="tab" aria-selected={activeWorkspaceView === 'inspector'} aria-controls="inspector-workspace-panel" tabIndex={activeWorkspaceView === 'inspector' ? 0 : -1} onClick={() => activateWorkspaceView('inspector')} onKeyDown={handleTabKeyDown}>Entity Inspector</button>
      </div>
      <div className="workspace-panels">
        <section id="map-workspace-panel" role="tabpanel" aria-labelledby="map-workspace-tab" ref={panelRef} className="canvas-panel" aria-label="In-memory VEE map editor" hidden={activeWorkspaceView !== 'map'}>
          <div className="map-disclosure-layer" data-map-disclosure-layer />
          {moveMode.state === 'moving' && <div className="move-mode-indicator" role="status">Move mode · arrows or numpad move the selected node · Escape exits</div>}
          {!document.entities.length && (
            <div className="empty-state">
              <h2>Start an empty map</h2>
              <p>Right-click the canvas or add an element.</p>
            </div>
          )}
          <ReactFlow<Node<MapNodeData>>
            aria-label="Map canvas"
            tabIndex={0}
            nodes={nodes}
            edges={edges}
            nodeTypes={{ mapNode: MapNode }}
            edgeTypes={{ [MAP_EDGE_TYPE]: MapEdge }}
            fitView
            fitViewOptions={{ maxZoom: 1 }}
            nodesConnectable={false}
            edgesFocusable={false}
            disableKeyboardA11y
            deleteKeyCode={null}
            multiSelectionKeyCode={null}
            onInit={(instance) => {
              flowRef.current = instance;
            }}
            onPaneClick={() => {
              selectFromMap(null);
              setMenu(null);
            }}
            onPaneContextMenu={(e) => {
              e.preventDefault();
              menuOwnerRef.current = e.currentTarget as HTMLElement;
              const client = { x: e.clientX, y: e.clientY };
              const panel = panelRef.current;
              const instance = flowRef.current;
              if (!panel || !instance) return;
              setMenu({
                type: 'canvas',
                client,
                overlay: overlayPoint(client, panel.getBoundingClientRect()),
                flow: instance.screenToFlowPosition(client),
                positioned: false,
              });
            }}
            onNodeClick={(_, node) => {
              if (!node.data.satellite || node.data.satellite.child) { if (!node.data.satellite) selectFromMap(node.id); return; }
              const ownerId = node.id.split(':')[1];
              if (!ownerId) return;
              const groups = relationGroupsForEntity(documentRef.current, ownerId);
              const groupIndex = groups.findIndex(group => group.satelliteKind === node.data.satellite?.kind);
              const current = relationsModeRef.current;
              if (current.state !== 'inactive' && current.sourceId === ownerId && current.groupIndex === groupIndex) setRelationsMode(inactiveRelationsMode());
              else setRelationsMode(reduceRelationsMode(current, { type: 'enter-group', sourceId: ownerId, groups, groupIndex }).mode);
            }}
            onNodeDoubleClick={(event, node) => {
              event.preventDefault();
              event.stopPropagation();
              if (node.data.satellite) return;
              selectFromMap(node.id, () => activateWorkspaceView('inspector', node.id));
            }}
            onNodeContextMenu={(e, node) => {
              e.preventDefault();
              menuOwnerRef.current = e.currentTarget as HTMLElement;
              const client = { x: e.clientX, y: e.clientY };
              const panel = panelRef.current;
              if (!panel) return;
              if (selectedRef.current !== node.id) selectFromMap(node.id);
              setMenu({
                type: 'node',
                invocation: 'pointer',
                client,
                overlay: overlayPoint(client, panel.getBoundingClientRect()),
                entityId: node.id,
                positioned: false,
              });
            }}
            onNodeDragStop={(_, node) =>
              setDocument((current) =>
                movePlacement(current, {
                  entityId: node.id,
                  viewId: VIEW_ID,
                  x: node.position.x,
                  y: node.position.y,
                }),
              )
            }
          >
            <Background color="rgba(255,255,255,.12)" />
            <Controls showInteractive={false} />
          </ReactFlow>
          {menu && (
            <div
              ref={menuRef}
              className="context-menu"
              role="menu"
              aria-label={menu.type === 'node' ? 'Entity context menu' : 'Add entity'}
              data-invocation={menu.type === 'node' ? menu.invocation : 'pointer'}
              data-anchor-x={menu.client.x}
              data-anchor-y={menu.client.y}
              onKeyDown={handleMenuKeyDown}
              style={{
                left: menu.overlay.x,
                top: menu.overlay.y,
                visibility: menu.positioned ? 'visible' : 'hidden',
              }}
            >
              {menu.type === 'canvas' ? (
                <>
                  <span>Business side</span>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setQuick({
                        draft: draft('product'),
                        anchor: menu.client,
                        overlay: { x: 0, y: 0 },
                        flow: menu.flow,
                        positioned: false,
                      });
                      setMenu(null);
                    }}
                  >
                    Product
                  </button>
                  <span>Client side</span>
                  {CLIENT_ROOT_ENTITY_KINDS.map((kind) => (
                    <button
                      key={kind}
                      role="menuitem"
                      onClick={() => {
                        setQuick({
                          draft: draft(kind),
                          anchor: menu.client,
                          overlay: { x: 0, y: 0 },
                          flow: menu.flow,
                          positioned: false,
                        });
                        setMenu(null);
                      }}
                    >
                      {KIND_LABELS[kind]}
                    </button>
                  ))}
                </>
              ) : (
                (() => {
                  const entity = document.entities.find((e) => e.id === menu.entityId);
                  if (!entity) return null;
                  return (
                    <>
                      <h3>Add</h3>
                      {entityContextCommandGroups(entity).map((group) => (
                        <div className="context-menu-group" key={group.id}>
                          <span>{group.heading}</span>
                          {group.commands.map((command) => command.href ? (
                            <a key={command.id} role="menuitem" href={command.href} target="_blank" rel="noreferrer" onClick={() => setMenu(null)}>{command.label}</a>
                          ) : (
                            <button key={command.id} type="button" role="menuitem" {...(command.shortcut ? { 'aria-keyshortcuts': command.shortcut } : {})} onClick={command.action}>{command.label}</button>
                          ))}
                        </div>
                      ))}
                    </>
                  );
                })()
              )}
            </div>
          )}
          {quick && quickForm(quick)}
        </section>
        <section id="inspector-workspace-panel" role="tabpanel" aria-labelledby="inspector-workspace-tab" className="inspector" hidden={activeWorkspaceView !== 'inspector'}>
          <header className="inspector-header">
            <h2 id="inspector-title" className="visually-hidden">Entity Inspector</h2>
            {mode !== 'create' && selected && editDraft && <div className="inspector-identity">
              <h3 aria-label={selected.title}>{inspectorTitleEdit?.entityId === selected.id
                ? <InlineTitleEditor title={inspectorTitleEdit.title} onCommit={title => finishInspectorTitleEdit(title)} onCancel={() => finishInspectorTitleEdit(false)} className="inline-inspector-title" accessibleLabel={`Edit title, ${inspectorTitleEdit.title}`} stopPointerEvents={false} autoSize />
                : <button ref={inspectorTitleButtonRef} type="button" className="inspector-title-button" aria-label={`Edit title, ${selected.title}`} onClick={startInspectorTitleEdit}>{selected.title}</button>}
              </h3>
              <p>{KIND_LABELS[selected.kind]} · {editDraft.side === 'business' ? 'Business side' : 'Client side'} <span className="immutable-note">(type and side cannot be changed)</span></p>
              {selected.kind === 'touchpoint' && touchpointBusinessStructure?.ancestryBranches.length ? <ul className="inspector-business-lineage" aria-label="Business lineage">
                {touchpointBusinessStructure.ancestryBranches.map(branch => <li aria-label={`${branch.product.title} to ${branch.offer.title}`} key={`${branch.product.id}:${branch.offer.id}`}>
                  <button type="button" onClick={() => navigateInspector(branch.product.id)}>{branch.product.title}</button>
                  <span aria-hidden="true">→</span>
                  <button type="button" onClick={() => navigateInspector(branch.offer.id)}>{branch.offer.title}</button>
                </li>)}
              </ul> : null}
            </div>}
            <nav className="inspector-history" aria-label="Inspector history">
              <button type="button" aria-label="Inspector Back" disabled={!traverseInspectorHistory(inspectorHistory, 'back', id => document.entities.some(entity => entity.id === id))} onClick={() => traverseInspector('back')}>Back</button>
              <button type="button" aria-label="Inspector Forward" disabled={!traverseInspectorHistory(inspectorHistory, 'forward', id => document.entities.some(entity => entity.id === id))} onClick={() => traverseInspector('forward')}>Forward</button>
            </nav>
          </header>
          {message && !quick && (
            <p className={message.kind === 'error' ? 'status-message error-message' : 'status-message'} role="status" aria-live={message.kind === 'error' ? 'assertive' : 'polite'}>
              {message.text}
            </p>
          )}
          {mode === 'create' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (createDraft.side === 'business') commitInspectorRoot(createDraft);
                else {
                  const placement = findFreePlacement(document, VIEW_ID, layoutForEntity(createDraft));
                  commit(createDraft, placement.x, placement.y, 'inspector');
                }
              }}
            >
              <h3>Add an element</h3>
              <fieldset>
                <legend>Choose a side</legend>
                <div className="choice-row">
                  <button type="button" aria-pressed={createDraft.side === 'business'} onClick={() => setCreateDraft(draft('product'))}>
                    Business side
                  </button>
                  <button type="button" aria-pressed={createDraft.side === 'client'} onClick={() => setCreateDraft(draft('core_functional_job'))}>
                    Client side
                  </button>
                </div>
              </fieldset>
              {createDraft.side === 'business' ? (
                <label>
                  Business element type
                  <select value={createDraft.kind} onChange={(e) => setCreateDraft(draft(e.target.value as ProvisionalEntityKind))}>
                    <option value="product">Product</option>
                    <option value="offer">Offer</option>
                    <option value="touchpoint">Touchpoint</option>
                  </select>
                </label>
              ) : (
                <label>
                  Client element type
                  <select value={createDraft.kind} onChange={(e) => setCreateDraft(draft(e.target.value as ProvisionalEntityKind))}>
                    {CLIENT_ROOT_ENTITY_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {KIND_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <AutoGrowingTitleField autoFocus value={createDraft.title} onChange={(title) => setCreateDraft({ ...createDraft, title })} />
              {createDraft.kind === 'offer' && (
                <ProductPrerequisiteFields draftValue={createDraft} setDraftValue={setCreateDraft} document={document} />
              )}
              {createDraft.kind === 'touchpoint' && (
                <>
                  <fieldset>
                    <legend>Which Offer is presented at this Touchpoint?</legend>
                    <label className="checkbox"><input type="radio" name="offer-prerequisite" checked={createDraft.offerPrerequisite === 'existing'} onChange={() => setCreateDraft({ ...createDraft, offerPrerequisite: 'existing', linkedOfferIds: [] })} />Choose an existing Offer</label>
                    {createDraft.offerPrerequisite === 'existing' && <select aria-label="Existing Offer" required value={createDraft.linkedOfferIds[0] ?? ''} onChange={(e) => setCreateDraft({ ...createDraft, linkedOfferIds: e.target.value ? [e.target.value] : [] })}><option value="">Choose an Offer</option>{document.entities.filter((entity) => entity.kind === 'offer').map((entity) => <option key={entity.id} value={entity.id}>{entity.title}</option>)}</select>}
                    <label className="checkbox"><input type="radio" name="offer-prerequisite" checked={createDraft.offerPrerequisite === 'new'} onChange={() => setCreateDraft({ ...createDraft, offerPrerequisite: 'new', linkedOfferIds: [], productPrerequisite: 'existing', linkedProductId: '' })} />Create new Offer</label>
                    {createDraft.offerPrerequisite === 'new' && <label>New Offer title<input required value={createDraft.newOfferTitle} onChange={(e) => setCreateDraft({ ...createDraft, newOfferTitle: e.target.value })} /></label>}
                  </fieldset>
                  {createDraft.offerPrerequisite === 'new' && <ProductPrerequisiteFields draftValue={createDraft} setDraftValue={setCreateDraft} document={document} />}
                  {rootTouchpointContextFields(createDraft, setCreateDraft)}
                </>
              )}
              <div className="actions">
                <button className="primary">Create</button>
                <button type="button" onClick={() => setMode('idle')}>
                  Cancel
                </button>
              </div>
            </form>
          ) : selected && editDraft ? (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (selected.kind === 'touchpoint') {
                  return;
                }
                try {
                  if (selected.kind === 'product') {
                    const impact = getProductIntentChangeImpact(document, { productId: selected.id, intents: Object.entries(editDraft.productIntentOutcomes).filter(([jobId]) => !editDraft.stagedClientEntities.some(entity => entity.id === jobId && !entity.title.trim())).map(([jobId, addressedDesiredOutcomeIds]) => ({ jobId, addressedDesiredOutcomeIds })) });
                    if (!productApplyBypassRef.current && (impact.offerJobSelectionIds.length || impact.touchpointJobSelectionIds.length || impact.narrowedOfferSelections.length || impact.narrowedTouchpointSelections.length)) {
                      setProductConfirmation({ mode: 'impact', owner: 'product', impact, returnFocus: globalThis.document.activeElement as HTMLElement | null });
                      return;
                    }
                    productApplyBypassRef.current = false;
                  }
                  if (selected.kind === 'offer') {
                    const offerSelections = editDraft.selectedIntentIds.map(productJobIntentId => ({ productJobIntentId, addressedDesiredOutcomeIds: editDraft.offerIntentOutcomes[productJobIntentId] ?? [] }));
                    const impact = getOfferIntentChangeImpact(document, { offerId: selected.id, productId: editDraft.linkedProductId, selections: offerSelections, financialDesiredOutcomeIds: editDraft.financialOutcomeIds });
                    if (!productApplyBypassRef.current && (impact.touchpointJobSelectionIds.length || impact.narrowedTouchpointSelections.length || impact.touchpointFinancialSelectionIds.length)) {
                      setProductConfirmation({ mode: 'impact', owner: 'offer', impact, returnFocus: globalThis.document.activeElement as HTMLElement | null });
                      return;
                    }
                    productApplyBypassRef.current = false;
                  }
                  const old = document.relationships.filter((r) => r.kind === 'offer_presented_at_touchpoint' && r.touchpointId === selected.id);
                  const parent = document.relationships.find((r) => r.kind === 'touchpoint_contains_touchpoint' && r.childTouchpointId === selected.id);
                  let next = updateEntity(document, {
                    entityId: selected.id,
                    title: editDraft.title,
                    linkedProductId: editDraft.linkedProductId,
                    locatedInId: editDraft.locatedInId,
                    url: editDraft.url,
                    linkedOfferIds: editDraft.linkedOfferIds,
                    relationshipIds: editDraft.linkedOfferIds.map((_, i) => old[i]?.id ?? crypto.randomUUID()),
                    parentEntityId: editDraft.parentEntityId,
                    ...(editDraft.parentTouchpointId
                      ? {
                          parentTouchpointId: editDraft.parentTouchpointId,
                          parentRelationshipId: parent?.id ?? crypto.randomUUID(),
                        }
                      : {}),
                  });
                  if (selected.kind === 'repulsor') {
                    const existingTargetIds = document.relationships.flatMap((r) => (r.kind === 'repulsor_resists' && r.repulsorId === selected.id ? [r.targetEntityId] : []));
                    const addedCount = editDraft.resistedTargetIds.filter((id) => !existingTargetIds.includes(id)).length;
                    next = updateRepulsorTargets(next, {
                      repulsorId: selected.id,
                      targetEntityIds: editDraft.resistedTargetIds,
                      newRelationshipIds: Array.from({ length: addedCount }, () => crypto.randomUUID()),
                    });
                  }
                  if (selected.kind === 'emotional_job' || selected.kind === 'social_job') {
                    const retained = next.relationships.flatMap((r) => (r.kind === 'core_functional_job_contextualizes_job' && r.contextualJobId === selected.id ? [r.coreFunctionalJobId] : []));
                    next = setContextualCoreFunctionalJobs(next, {
                      contextualJobId: selected.id,
                      coreFunctionalJobIds: editDraft.contextualCoreJobIds,
                      newRelationshipIds: editDraft.contextualCoreJobIds.filter((id) => !retained.includes(id)).map(() => crypto.randomUUID()),
                    });
                  }
                  if (selected.kind === 'product') {
                    for (const stagedEntity of editDraft.stagedClientEntities) {
                      if (stagedEntity.kind === 'desired_outcome' && !(editDraft.productIntentOutcomes[stagedEntity.parentEntityId ?? ''] ?? []).includes(stagedEntity.id)) continue;
                      if (stagedEntity.kind !== 'desired_outcome' && !(stagedEntity.id in editDraft.productIntentOutcomes)) continue;
                      const placement = stagedEntity.kind === 'desired_outcome'
                        ? findRelatedPlacement(next, VIEW_ID, layoutForEntity(stagedEntity), [stagedEntity.parentEntityId!], [{ sourceId: stagedEntity.parentEntityId!, targetId: '__new__' }])
                        : findFreePlacement(next, VIEW_ID, layoutForEntity(stagedEntity));
                      next = stagedEntity.kind === 'desired_outcome'
                        ? addEntity(next, { entityId: stagedEntity.id, title: stagedEntity.title, kind: stagedEntity.kind, parentEntityId: stagedEntity.parentEntityId!, relationshipId: crypto.randomUUID(), viewId: VIEW_ID, ...placement })
                        : addEntity(next, { entityId: stagedEntity.id, title: stagedEntity.title, kind: stagedEntity.kind, viewId: VIEW_ID, ...placement });
                    }
                    next = applyProductIntentDraft(next, selected.id, editDraft.productIntentOutcomes);
                  }
                  if (selected.kind === 'offer') {
                    const retained = next.offerJobSelections.filter((selection) => selection.offerId === selected.id).map((selection) => selection.productJobIntentId);
                    const additions = editDraft.selectedIntentIds.filter((id) => !retained.includes(id));
                    next = setOfferJobSelections(next, {
                      offerId: selected.id,
                      selections: editDraft.selectedIntentIds.map(productJobIntentId => ({ productJobIntentId, addressedDesiredOutcomeIds: editDraft.offerIntentOutcomes[productJobIntentId] ?? [] })),
                      newSelectionIds: additions.map(() => crypto.randomUUID()),
                    });
                    const retainedFinancial = next.offerFinancialIntents.filter((intent) => intent.offerId === selected.id).map((intent) => intent.financialDesiredOutcomeId);
                    next = setOfferFinancialIntents(next, {
                      offerId: selected.id,
                      financialDesiredOutcomeIds: editDraft.financialOutcomeIds,
                      newIntentIds: editDraft.financialOutcomeIds.filter((id) => !retainedFinancial.includes(id)).map(() => crypto.randomUUID()),
                    });
                  }
                  next = reconsiderPlacementAfterRelationCommit(document, next, VIEW_ID, selected.id);
                  setDocument(next);
                  const appliedEntity = next.entities.find(entity => entity.id === selected.id)!;
                  setEditDraft(draftFor(appliedEntity, next));
                  resetProductSession(appliedEntity, next);
                  publishSuccess('Changes applied.');
                  const pending = pendingAfterApplyRef.current;
                  pendingAfterApplyRef.current = null;
                  pending?.();
                } catch (error) {
                  publishError(error instanceof Error ? error.message : 'Changes could not be applied.');
                }
              }}
            >
              {touchpointBusinessStructureSection()}
              {touchpointClientScopeSection()}
              {touchpointResistanceSection()}
              {selected.kind === 'offer' && (
                <div className="connected-field">
                <label>
                  Linked Product
                  <select
                    value={editDraft.linkedProductId}
                    onChange={(e) => {
                      const linkedProductId = e.target.value;
                      const memory = { ...offerSelectionMemory, [editDraft.linkedProductId]: editDraft.selectedIntentIds };
                      setOfferSelectionMemory(memory);
                      setOfferIntentSectionIds(current => current[linkedProductId] ? current : { ...current, [linkedProductId]: [] });
                      setEditDraft({
                        ...editDraft,
                        linkedProductId,
                        selectedIntentIds: memory[linkedProductId] ?? [],
                      });
                    }}
                  >
                    {document.entities
                      .filter((e) => e.kind === 'product')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                  </select>
                </label>
                {document.entities.find(entity => entity.id === editDraft.linkedProductId) && <button type="button" className="connected-title" onClick={() => navigateInspector(editDraft.linkedProductId)}>{entityTitle(document, editDraft.linkedProductId)}</button>}
                </div>
              )}
              {offerNeighborhoodSection()}
              {productIntentFields(editDraft, setEditDraft)}
              {offerIntentFields(editDraft, setEditDraft)}
              {resistanceImpactFields(selected)}
              {semanticParentField(editDraft, setEditDraft)}
              {contextualJobFields(editDraft, setEditDraft)}
              {repulsorTargetsField(editDraft, setEditDraft)}
              {touchFields(editDraft, setEditDraft, true, false)}
              {selected.kind === 'touchpoint' && touchpointIntentFields()}
              {selected.kind !== 'touchpoint' && connectionPicker === null && <div className={`apply-footer ${inspectorDirty ? 'dirty' : ''}`}>
                {inspectorDirty && <span>Unsaved changes</span>}
                <button className="primary" disabled={!inspectorDirty || Boolean(editDraft.touchpointIntent && validateTouchpointIntentDraft(editDraft.touchpointIntent, editDraft.linkedOfferIds))}>Apply changes</button>
              </div>}
            </form>
          ) : (
            <div className="inspector-empty-state">
              {document.entities.length === 0 ? (
                <p>This map does not contain any entities yet.</p>
              ) : (
                <p>Select an entity on the Map to inspect it.</p>
              )}
              <div className="actions">
                {document.entities.length === 0 && (
                  <button className="primary" type="button" onClick={startRootCreation}>Add first element</button>
                )}
                <button type="button" onClick={() => activateWorkspaceView('map')}>Go to Map</button>
              </div>
            </div>
          )}
        </section>
      </div>
      {productConfirmation && (
        <div className="confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeProductConfirmation(); }}>
          <div ref={confirmationRef} role="dialog" aria-modal="true" aria-labelledby="product-confirmation-title" className="confirmation-dialog" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeProductConfirmation(); } }}>
            <h2 id="product-confirmation-title">{productConfirmation.mode === 'dirty' ? `Unsaved ${selected?.kind === 'offer' ? 'Offer' : 'Product'} changes` : 'This change affects downstream intent'}</h2>
            {productConfirmation.mode === 'impact' && productConfirmation.owner === 'product' && (
              <div className="impact-list">
                {productConfirmation.impact.offerJobSelectionIds.map(id => { const selection = document.offerJobSelections.find(item => item.id === id); const offer = document.entities.find(entity => entity.id === selection?.offerId); const intent = document.productJobIntents.find(item => item.id === selection?.productJobIntentId); const job = document.entities.find(entity => entity.id === intent?.jobId); return <p key={id}><strong>{offer?.title}</strong><span>loses {job?.title}</span></p>; })}
                {productConfirmation.impact.narrowedOfferSelections.map(item => { const selection = document.offerJobSelections.find(candidate => candidate.id === item.offerJobSelectionId); const offer = document.entities.find(entity => entity.id === selection?.offerId); return <p key={item.offerJobSelectionId}><strong>{offer?.title}</strong><span>loses {item.removedDesiredOutcomeIds.map(id => document.entities.find(entity => entity.id === id)?.title).join(', ')}</span></p>; })}
                {productConfirmation.impact.touchpointJobSelectionIds.map(id => { const selection = document.touchpointJobSelections.find(item => item.id === id); const touchpoint = document.entities.find(entity => entity.id === selection?.touchpointId); const intent = document.productJobIntents.find(item => item.id === selection?.productJobIntentId); const job = document.entities.find(entity => entity.id === intent?.jobId); return <p key={id}><strong>{touchpoint?.title}</strong><span>loses {job?.title}</span></p>; })}
                {productConfirmation.impact.narrowedTouchpointSelections.map(item => { const selection = document.touchpointJobSelections.find(candidate => candidate.id === item.touchpointJobSelectionId); const touchpoint = document.entities.find(entity => entity.id === selection?.touchpointId); return <p key={item.touchpointJobSelectionId}><strong>{touchpoint?.title}</strong><span>loses {item.removedDesiredOutcomeIds.map(id => document.entities.find(entity => entity.id === id)?.title).join(', ')}</span></p>; })}
              </div>
            )}
            {productConfirmation.mode === 'impact' && productConfirmation.owner === 'offer' && (
              <div className="impact-list">
                {productConfirmation.impact.touchpointJobSelectionIds.map(id => { const selection = document.touchpointJobSelections.find(item => item.id === id); const touchpoint = document.entities.find(entity => entity.id === selection?.touchpointId); const intent = document.productJobIntents.find(item => item.id === selection?.productJobIntentId); const job = document.entities.find(entity => entity.id === intent?.jobId); return <p key={id}><strong>{touchpoint?.title}</strong><span>loses {job?.title}</span></p>; })}
                {productConfirmation.impact.narrowedTouchpointSelections.map(item => { const selection = document.touchpointJobSelections.find(candidate => candidate.id === item.touchpointJobSelectionId); const touchpoint = document.entities.find(entity => entity.id === selection?.touchpointId); return <p key={item.touchpointJobSelectionId}><strong>{touchpoint?.title}</strong><span>loses {item.removedDesiredOutcomeIds.map(id => document.entities.find(entity => entity.id === id)?.title).join(', ')}</span></p>; })}
                {productConfirmation.impact.touchpointFinancialSelectionIds.map(id => { const selection = document.touchpointFinancialSelections.find(item => item.id === id); const touchpoint = document.entities.find(entity => entity.id === selection?.touchpointId); const outcome = document.entities.find(entity => entity.id === selection?.financialDesiredOutcomeId); return <p key={id}><strong>{touchpoint?.title}</strong><span>loses {outcome?.title}</span></p>; })}
              </div>
            )}
            {productConfirmation.mode === 'impact' && productConfirmation.owner === 'touchpoint' && (
              <div className="impact-list">
                {productConfirmation.impact.map((path) => { const offer = document.entities.find(entity => entity.id === path.offerId); const alternatives = path.alternativeContributingOfferIds.map(id => document.entities.find(entity => entity.id === id)?.title).filter(Boolean).join(', '); return <p key={`${path.kind}:${path.offerId}:${path.touchpointSelectionIds.join(':')}:${path.kind === 'job' ? path.desiredOutcomeIds.join(':') : path.financialDesiredOutcomeId}`}><strong>{offer?.title}</strong><span>path to {path.kind === 'job' ? [document.entities.find(entity => entity.id === path.jobId)?.title, ...path.desiredOutcomeIds.map(id => document.entities.find(entity => entity.id === id)?.title)].filter(Boolean).join(' → ') : document.entities.find(entity => entity.id === path.financialDesiredOutcomeId)?.title} will be removed{alternatives ? `; alternative: ${alternatives}` : ''}</span></p>; })}
              </div>
            )}
            <div className="actions">
              {productConfirmation.mode === 'dirty' ? <>
                <button type="button" className="primary" onClick={() => { const pending = productConfirmation.pending; setProductConfirmation(null); pendingAfterApplyRef.current = pending; globalThis.document.querySelector<HTMLFormElement>('.inspector > form')?.requestSubmit(); }}>Apply</button>
                <button type="button" onClick={() => discardDirtySession(productConfirmation.pending)}>Discard</button>
                <button type="button" onClick={closeProductConfirmation}>Keep editing</button>
              </> : <>
                <button type="button" onClick={closeProductConfirmation}>Cancel</button>
                <button type="button" className="primary" onClick={() => { const confirmation = productConfirmation; setProductConfirmation(null); if (confirmation.owner === 'touchpoint') { confirmation.immediateCommit(); requestAnimationFrame(() => confirmation.returnFocus?.focus()); } else { productApplyBypassRef.current = true; globalThis.document.querySelector<HTMLFormElement>('.inspector > form')?.requestSubmit(); } }}>{productConfirmation.owner === 'touchpoint' ? 'Confirm removal' : 'Apply changes'}</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
