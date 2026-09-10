import { useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Background, Controls, Handle, Position, ReactFlow, type Node, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CLIENT_ROOT_ENTITY_KINDS, addEntity, addProductJobIntent, addTouchpointContainer, authorTouchpointIntentBottomUp, commitTouchpointIntentPathPlan, createEmptyMapDocument, duplicateEntity, getOfferIntentChangeImpact, getProductIntentChangeImpact, getTouchpointLinkedOfferChangeImpact, isClientRootEntityKind, isContextualClientEntityKind, isRepulsorTargetKind, movePlacement, planTouchpointIntentPathChange, resistanceImpactForOffer, resistanceImpactForProduct, removeProductJobIntent, setContextualCoreFunctionalJobs, setOfferFinancialIntents, setOfferJobSelections, updateEntity, updateProductJobIntent, updateRepulsorTargets, type BottomUpTouchpointResult, type ContextualClientEntityKind, type Entity, type MapDocument, type ProvisionalEntityKind, type Relationship, type TouchpointIntentPathPlan } from '@vee/domain';
import { deriveMapEdges, deriveMapNodes, KIND_LABELS, layoutForEntity, MAP_EDGE_TYPE, type MapNodeData } from '../map-adapter';
import { MapEdge } from '../map-edge';
import { contextMenuPoint, disclosureOverlayPoint, linkedOfferIds, matchesWorkspaceShortcut, overlayPoint, parentTouchpointOptions, revealViewport, siblingDraft, siblingPlacement, workspaceShortcutAction, type Point, type WorkspaceShortcutState } from '../map-interaction';
import { focusedRelationTarget, inactiveRelationsMode, reduceRelationsMode, relationEdgeClassName, type RelationsMode } from '../map-relations-mode';
import { relationGroupsForEntity } from '../map-relation-projection';
import { deriveRelationLensTrace } from '../map-relation-lens';
import { emptyInspectorHistory, inspectorHistoryReducer, traverseInspectorHistory } from '../inspector-navigation';
import { findFreePlacement, findPlacementNearPoint, findRelatedPlacement, reconsiderPlacementAfterRelationCommit, type ProposedPlacementRelation } from '../map-placement';
import { nearestSpatialCandidate, spatialDirectionForKey } from '../map-spatial-navigation';
import { enterMoveMode, inactiveMoveMode, moveInMode, moveVectorForKey, type MoveMode } from '../map-move-mode';
import { Link } from '../router';
import { CONNECTION_PICKER_KINDS, applyTouchpointEditDraft, commitTouchpointBusinessProperty, commitTouchpointLinkedOffers, commitTouchpointParent, createTouchpointIntentDraft, entityTitle, equalTouchpointIntentDraft, globalIntentDiscovery, touchpointClientScope, touchpointUpstreamSources, validateTouchpointIntentDraft, type ConnectionPickerKind, type TouchpointIntentDraft, type UpstreamLeaf } from './touchpoint-edit';
import { commitSemanticOperation, semanticCommitState } from './semantic-commit-policy';
import { deriveTouchpointBusinessStructure } from '../touchpoint-business-structure';

const VIEW_ID = 'spike-view';
const INITIAL_DOCUMENT = createEmptyMapDocument({
  mapId: 'spike-map',
  title: 'Untitled validation map',
  viewId: VIEW_ID,
  viewTitle: 'Working view',
});
type Side = 'business' | 'client';
type WorkspaceView = 'map' | 'inspector';
type PostCreateContinuation = WorkspaceView;
type OperationFeedback = { text: string; kind: 'success' | 'error' };
type LocationDraft = { kind: 'none' } | { kind: 'existing'; containerId: string } | { kind: 'new'; title: string };
type EditDraft = {
  title: string;
  side: Side;
  kind: ProvisionalEntityKind;
  linkedProductId: string;
  linkedOfferIds: string[];
  selectedIntentIds: string[];
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
  | { mode: 'impact'; owner: 'touchpoint'; pending?: () => void; immediateCommit?: () => void; returnFocus: HTMLElement | null; impact: ReturnType<typeof getTouchpointLinkedOfferChangeImpact> };
type ClientScopeEditor = { mode: 'upstream' | 'global-search' | 'current-contributor-choice' | 'ancestor-contributor-choice' | 'invalid'; query: string; kind?: ConnectionPickerKind | undefined; target?: { leaf: UpstreamLeaf; jobId?: string }; contributorOfferIds: string[]; ancestorContributingOfferIds: Record<string, string>; unresolved?: Extract<BottomUpTouchpointResult, { status: 'unresolved' | 'invalid' }> };
const draft = (kind: ProvisionalEntityKind = 'product'): EditDraft => ({
  title: '',
  side: isClientRootEntityKind(kind) || isContextualClientEntityKind(kind) || kind === 'repulsor' ? 'client' : 'business',
  kind,
  linkedProductId: '',
  linkedOfferIds: [],
  selectedIntentIds: [],
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
function InlineTitleEditor({ title, onCommit, onCancel, className = 'inline-node-title nodrag nopan', accessibleLabel = `Edit title for ${title}`, stopPointerEvents = true }: { title: string; onCommit: (title: string) => boolean | void; onCancel: () => void; className?: string; accessibleLabel?: string; stopPointerEvents?: boolean }) {
  const [draftTitle, setDraftTitle] = useState(() => title);
  const completedRef = useRef(false);
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
      className={className}
      aria-label={accessibleLabel}
      rows={2}
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
  const parentPickerButtonRef = useRef<HTMLButtonElement>(null);
  const offersPickerButtonRef = useRef<HTMLButtonElement>(null);
  const [businessInlineEdit, setBusinessInlineEdit] = useState<{ property: 'url'; value: string; error?: string } | { property: 'located-in'; query: string; error?: string } | null>(null);
  const [productExpanded, setProductExpanded] = useState<Record<string, boolean>>({});
  const [offerExpanded, setOfferExpanded] = useState<Record<string, boolean>>({});
  const [connectionPicker, setConnectionPicker] = useState<ClientScopeEditor | null>(null);
  const [localRemoval, setLocalRemoval] = useState<{ plan: TouchpointIntentPathPlan; returnFocusId: string } | null>(null);
  const connectionPickerButtonRef = useRef<HTMLButtonElement>(null);
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
  function closeProductConfirmation() {
    const target = productConfirmation?.returnFocus;
    setProductConfirmation(null);
    requestAnimationFrame(() => target?.focus());
  }
  function restoreTouchpointApplyFocus(target?: HTMLElement | null) {
    requestAnimationFrame(() => {
      if (target?.isConnected && !target.matches(':disabled')) target.focus();
      else (globalThis.document.querySelector<HTMLElement>('#inspector-workspace-panel form input[required], #inspector-workspace-panel form select[required], #inspector-workspace-panel form input:not([type="hidden"]):not(:disabled), #inspector-workspace-panel form select:not(:disabled), #inspector-workspace-panel form textarea:not(:disabled)') ?? inspectorTitleButtonRef.current)?.focus();
    });
  }

  function draftFor(entity: Entity, source = document): EditDraft {
    const result = draft(entity.kind);
    result.title = entity.title;
    if (entity.kind === 'product') for (const intent of source.productJobIntents.filter((candidate) => candidate.productId === entity.id)) result.productIntentOutcomes[intent.jobId] = [...intent.addressedDesiredOutcomeIds];
    if (entity.kind === 'offer') {
      result.financialOutcomeIds = source.offerFinancialIntents.filter((intent) => intent.offerId === entity.id).map((intent) => intent.financialDesiredOutcomeId);
      result.linkedProductId = source.relationships.find((r): r is Extract<Relationship, { kind: 'product_packaged_as_offer' }> => r.kind === 'product_packaged_as_offer' && r.offerId === entity.id)?.productId ?? '';
      result.selectedIntentIds = source.offerJobSelections.filter((selection) => selection.offerId === entity.id).map((selection) => selection.productJobIntentId);
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
    setParentPicker(null);
    publishSuccess('Parent Touchpoint updated.');
    requestAnimationFrame(() => parentPickerButtonRef.current?.focus());
  }
  function applyTouchpointChanges(pending = pendingAfterApplyRef.current, returnFocus?: HTMLElement | null, confirmed = false): boolean {
    const durable = documentRef.current;
    const entity = durable.entities.find(candidate => candidate.id === selectedRef.current);
    const currentDraft = editDraft;
    if (entity?.kind !== 'touchpoint' || !currentDraft?.touchpointIntent) return false;
    try {
      const impact = getTouchpointLinkedOfferChangeImpact(durable, { touchpointId: entity.id, linkedOfferIds: currentDraft.linkedOfferIds });
      if (!confirmed && impact.length) {
        setProductConfirmation({ mode: 'impact', owner: 'touchpoint', impact, ...(pending ? { pending } : {}), returnFocus: returnFocus ?? globalThis.document.activeElement as HTMLElement | null });
        return false;
      }
      const postConfirmationDraft = confirmed ? {
        ...currentDraft.touchpointIntent,
        jobLeaves: currentDraft.touchpointIntent.jobLeaves.map(leaf => ({ ...leaf, contributorOfferIds: leaf.contributorOfferIds.filter(id => currentDraft.linkedOfferIds.includes(id)) })),
        financialLeaves: currentDraft.touchpointIntent.financialLeaves.map(leaf => ({ ...leaf, contributorOfferIds: leaf.contributorOfferIds.filter(id => currentDraft.linkedOfferIds.includes(id)) })),
      } : currentDraft.touchpointIntent;
      const committed = applyTouchpointEditDraft(durable, {
        touchpointId: entity.id,
        draft: { ...currentDraft, touchpointIntent: postConfirmationDraft },
        newId: () => crypto.randomUUID(),
      });
      const next = reconsiderPlacementAfterRelationCommit(durable, committed, VIEW_ID, entity.id);
      setDocument(next);
      setEditDraft(draftFor(next.entities.find(candidate => candidate.id === entity.id)!, next));
      publishSuccess('Changes applied.');
      pendingAfterApplyRef.current = null;
      pending?.();
      restoreTouchpointApplyFocus(returnFocus);
      return true;
    } catch (error) {
      publishError(error instanceof Error ? error.message : 'Changes could not be applied.');
      return false;
    }
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
    return Boolean(entity && (entity.kind === 'product' || entity.kind === 'offer' || entity.kind === 'touchpoint') && inspectorDirty);
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
  function select(id: string | null) {
    if (id === selectedRef.current) {
      if (relationsModeRef.current.state !== 'inactive') setRelationsMode(inactiveRelationsMode());
      return;
    }
    if (guardsDirtySession(selected)) {
      setProductConfirmation({ mode: 'dirty', pending: () => performSelect(id), returnFocus: globalThis.document.activeElement as HTMLElement | null });
      return;
    }
    performSelect(id);
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
    select(id);
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
    const entityCommands: EntityContextCommand[] = [{ id: 'inspector', label: 'Open in Entity Inspector', action: () => { select(entity.id); setActiveWorkspaceView('inspector'); } }];
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
      const created = next.entities.find((e) => e.id === id)!;
      setEditDraft(draftFor(created, next));
      setQuick(null);
      setMode('idle');
      setActiveWorkspaceView(continuation);
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
      setEditDraft(draftFor(next.entities.find((entity) => entity.id === targetId)!, next));
      setMode('idle');
      setActiveWorkspaceView('inspector');
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
          performSelect(relationTarget);
          activateWorkspaceView('inspector');
          requestAnimationFrame(() => globalThis.document.getElementById('inspector-workspace-tab')?.focus());
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
          performSelect(result.followedTargetId);
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
          performSelect(target.id);
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
  function activateWorkspaceView(view: WorkspaceView) {
    setMoveMode(inactiveMoveMode());
    setActiveWorkspaceView(view);
    if (view === 'inspector' && selectedRef.current) dispatchInspectorHistory({ type: 'push', entityId: selectedRef.current });
    if (view === 'map' && pendingInspectorRevealRef.current) {
      const ids = pendingInspectorRevealRef.current;
      pendingInspectorRevealRef.current = null;
      requestAnimationFrame(() => revealEntities(documentRef.current, ids));
    }
  }
  function performRootCreation() {
    setInspectorTitleEdit(null);
    setMode('create');
    setOffersPicker(null);
    setParentPicker(null);
    setConnectionPicker(null);
    setCreateDraft(draft());
    resetProductSession(undefined);
    setActiveWorkspaceView('inspector');
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
            <p>This Touchpoint will start with an empty effective scope. After Create, explicitly choose which valid Offer intent it expresses. Incomplete Client Jobs are unavailable until they have a Desired Outcome.</p>
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
    const sources = touchpointUpstreamSources(document, selected.id);
    const discovery = connectionPicker ? globalIntentDiscovery(document, connectionPicker) : { jobGroups: [], directLeaves: [] };
    const jobIdForLeaf = (leaf: UpstreamLeaf) => leaf.kind === 'desired-outcome'
      ? document.relationships.find((relation): relation is Extract<Relationship, { kind: 'job_has_desired_outcome' }> => relation.kind === 'job_has_desired_outcome' && relation.desiredOutcomeId === leaf.semanticId)?.jobId
      : leaf.semanticId;
    const closePicker = () => {
      setConnectionPicker(null);
      requestAnimationFrame(() => connectionPickerButtonRef.current?.focus());
    };
    const finishLocal = (nextDocument: MapDocument, focusId?: string) => {
      const next = reconsiderPlacementAfterRelationCommit(documentRef.current, nextDocument, VIEW_ID, selected.id);
      setDocument(next);
      setEditDraft({ ...editDraft, touchpointIntent: createTouchpointIntentDraft(next, selected.id) });
      publishSuccess('Client scope updated.');
      if (focusId) requestAnimationFrame(() => globalThis.document.getElementById(focusId)?.focus());
    };
    const toggleLeaf = (leaf: UpstreamLeaf, checked: boolean) => {
      if (!leaf.available) return;
      if (!leaf.contributorOfferId) {
        if (checked) { chooseDiscovery(leaf); return; }
        const sole = leaf.checkedContributorOfferIds?.length === 1 ? leaf.checkedContributorOfferIds[0] : undefined;
        if (!sole) return;
        const jobSelection = documentRef.current.touchpointJobSelections.find(item => item.touchpointId === selected.id && item.offerId === sole && documentRef.current.productJobIntents.find(intent => intent.id === item.productJobIntentId)?.jobId === jobIdForLeaf(leaf));
        const financialSelection = documentRef.current.touchpointFinancialSelections.find(item => item.touchpointId === selected.id && item.offerId === sole && item.financialDesiredOutcomeId === leaf.semanticId);
        toggleLeaf({ ...leaf, contributorOfferId: sole, ...(jobSelection ? { productJobIntentId: jobSelection.productJobIntentId } : {}), ...(financialSelection ? { offerFinancialIntentId: financialSelection.offerFinancialIntentId } : {}) }, false);
        return;
      }
      try {
        const target = leaf.kind === 'financial'
          ? { kind: 'financial' as const, touchpointId: selected.id, offerId: leaf.contributorOfferId, offerFinancialIntentId: leaf.offerFinancialIntentId!, semanticLeafId: leaf.semanticId }
          : { kind: 'job' as const, touchpointId: selected.id, offerId: leaf.contributorOfferId, productJobIntentId: leaf.productJobIntentId!, semanticLeafId: leaf.semanticId };
        const plan = planTouchpointIntentPathChange(documentRef.current, { target, checked, ...(checked ? { newSelectionId: crypto.randomUUID() } : {}) });
        if (!checked && plan.impact.mitigationRelationshipIds.length) { setLocalRemoval({ plan, returnFocusId: leaf.checkboxId }); return; }
        finishLocal(commitTouchpointIntentPathPlan(documentRef.current, plan), leaf.checkboxId);
      } catch (error) { publishError(error instanceof Error ? error.message : 'Client scope could not be changed.'); }
    };
    const selectAll = (blocks: typeof sources) => {
      try {
        let next = documentRef.current;
        for (const leaf of blocks.flatMap(source => [...source.jobGroups.flatMap(group => group.leaves), ...source.financialLeaves]).filter(leaf => leaf.available && !leaf.checked)) {
          const target = leaf.kind === 'financial' ? { kind: 'financial' as const, touchpointId: selected.id, offerId: leaf.contributorOfferId, offerFinancialIntentId: leaf.offerFinancialIntentId!, semanticLeafId: leaf.semanticId } : { kind: 'job' as const, touchpointId: selected.id, offerId: leaf.contributorOfferId, productJobIntentId: leaf.productJobIntentId!, semanticLeafId: leaf.semanticId };
          next = commitTouchpointIntentPathPlan(next, planTouchpointIntentPathChange(next, { target, checked: true, newSelectionId: crypto.randomUUID() }));
        }
        finishLocal(next);
      } catch (error) { publishError(error instanceof Error ? error.message : 'Client scope could not be changed.'); }
    };
    const runBottomUp = (leaf: UpstreamLeaf, jobId: string | undefined, contributors: string[], ancestors: Record<string, string>) => {
      try {
        const result = authorTouchpointIntentBottomUp(documentRef.current, leaf.kind === 'financial'
          ? { touchpointId: selected.id, contributingOfferIds: contributors, ancestorContributingOfferIds: ancestors, financialDesiredOutcomeId: leaf.semanticId, newId: () => crypto.randomUUID() }
          : { touchpointId: selected.id, contributingOfferIds: contributors, ancestorContributingOfferIds: ancestors, jobId: jobId ?? leaf.semanticId, addressedDesiredOutcomeIds: leaf.kind === 'desired-outcome' ? [leaf.semanticId] : [], newId: () => crypto.randomUUID() });
        if (result.status === 'complete') { finishLocal(result.document); setConnectionPicker(null); return; }
        setConnectionPicker(current => current && ({ ...current, mode: result.status === 'unresolved' ? 'ancestor-contributor-choice' : 'invalid', target: { leaf, ...(jobId ? { jobId } : {}) }, contributorOfferIds: contributors, ancestorContributingOfferIds: ancestors, unresolved: result }));
      } catch (error) { publishError(error instanceof Error ? error.message : 'Client intent could not be authored.'); }
    };
    const chooseDiscovery = (leaf: UpstreamLeaf, jobId?: string) => {
      const candidates = leaf.childContributorOfferIds ?? offers.filter(offerId => leaf.kind === 'financial' || document.relationships.some(relation => relation.kind === 'product_packaged_as_offer' && relation.offerId === offerId));
      if (!candidates.length) { setConnectionPicker(current => current && ({ ...current, mode: 'invalid', target: { leaf, ...(jobId ? { jobId } : {}) }, contributorOfferIds: [], unresolved: { status: 'invalid', reason: 'no_ancestor_contributor_path', touchpointId: selected.id } })); return; }
      if (candidates.length === 1) runBottomUp(leaf, jobId, candidates, {});
      else setConnectionPicker(current => current && ({ ...current, mode: 'current-contributor-choice', target: { leaf, ...(jobId ? { jobId } : {}) }, contributorOfferIds: [], ancestorContributingOfferIds: {} }));
    };
    const removeParentContributor = (leaf: UpstreamLeaf, offerId: string) => {
      const owningJobId = jobIdForLeaf(leaf);
      const jobSelection = document.touchpointJobSelections.find(item => item.touchpointId === selected.id && item.offerId === offerId && document.productJobIntents.find(intent => intent.id === item.productJobIntentId)?.jobId === owningJobId);
      const financialSelection = document.touchpointFinancialSelections.find(item => item.touchpointId === selected.id && item.offerId === offerId && item.financialDesiredOutcomeId === leaf.semanticId);
      toggleLeaf({ ...leaf, contributorOfferId: offerId, ...(jobSelection ? { productJobIntentId: jobSelection.productJobIntentId } : {}), ...(financialSelection ? { offerFinancialIntentId: financialSelection.offerFinancialIntentId } : {}) }, false);
    };
    return <section className="touchpoint-client-scope" aria-labelledby="touchpoint-client-scope-heading">
      <div className="touchpoint-client-scope-heading"><h4 id="touchpoint-client-scope-heading">Client scope</h4><button ref={connectionPickerButtonRef} type="button" className="business-structure-edit-value" aria-label="Add Client-side connection" disabled={!offers.length} onClick={() => setConnectionPicker({ mode: 'upstream', query: '', kind: undefined, contributorOfferIds: [], ancestorContributingOfferIds: {} })}><span className="business-structure-edit-affordance" aria-hidden="true">✎</span></button></div>
      {scope.jobGroups.length || scope.financialLeaves.length ? <div className="touchpoint-client-scope-content">
        {scope.jobGroups.map(group => <div className={`touchpoint-client-job ${group.desiredOutcomes.length ? 'has-outcomes' : 'direct-job'}`} key={group.job.id}>
          <small>{KIND_LABELS[group.job.kind]}</small>
          <button type="button" onClick={() => navigateInspector(group.job.id)}>{group.job.title}</button>
          {group.desiredOutcomes.length > 0 && <ul>{group.desiredOutcomes.map(outcome => <li key={outcome.semanticLeafId}><button type="button" onClick={() => navigateInspector(outcome.entity.id)}>{outcome.entity.title}</button></li>)}</ul>}
        </div>)}
        {scope.financialLeaves.map(leaf => <div className="touchpoint-client-financial" key={leaf.semanticLeafId}><small>{KIND_LABELS[leaf.entity.kind]}</small><button type="button" onClick={() => navigateInspector(leaf.entity.id)}>{leaf.entity.title}</button></div>)}
      </div> : <p className="touchpoint-client-scope-empty">No Client-side connections yet.</p>}
      {connectionPicker && <section className="connection-picker" aria-labelledby="connection-picker-heading" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (connectionPicker.mode !== 'upstream') setConnectionPicker({ mode: 'upstream', query: '', kind: undefined, contributorOfferIds: [], ancestorContributingOfferIds: {} }); else closePicker(); } }}>
        <h4 id="connection-picker-heading">Upstream Client intent</h4>
        {sources.map(source => <section className="intent-source-block" aria-label={`${source.sourceKind === 'offer' ? 'Offer' : 'Parent'} ${source.source.title}`} key={`${source.sourceKind}:${source.source.id}`}>
          <div className="intent-source-heading"><button type="button" onClick={() => navigateInspector(source.source.id)}>{source.sourceKind === 'offer' ? 'Offer' : 'Parent'} · {source.source.title}</button><button type="button" className="text-action" onClick={() => selectAll([source])}>Select all</button></div>
          {source.jobGroups.map(group => <div className="intent-job-branch" key={`${source.source.id}:${group.job.id}`}><button type="button" onClick={() => navigateInspector(group.job.id)}><small>{KIND_LABELS[group.job.kind]}</small>{group.job.title}</button><div className="intent-leaves">{group.leaves.map(leaf => <div key={leaf.checkboxId}><label className={`intent-checkbox${leaf.available ? '' : ' unavailable'}`}><input id={leaf.checkboxId} type="checkbox" disabled={!leaf.available} checked={leaf.checked} onChange={event => toggleLeaf(leaf, event.target.checked)} /><span>{leaf.entity.title}</span>{!leaf.available && <small>No valid Child contributor path</small>}</label>{source.sourceKind === 'parent' && Boolean(leaf.checkedContributorOfferIds?.length) && <div className="parent-contributor-paths">{leaf.checkedContributorOfferIds!.map(offerId => <label className="intent-checkbox" key={offerId}><input type="checkbox" checked onChange={() => removeParentContributor(leaf, offerId)} /><span>via {entityTitle(document, offerId)}</span></label>)}</div>}</div>)}</div></div>)}
          {source.financialLeaves.map(leaf => <div key={leaf.checkboxId}><label className={`intent-checkbox${leaf.available ? '' : ' unavailable'}`}><input id={leaf.checkboxId} type="checkbox" disabled={!leaf.available} checked={leaf.checked} onChange={event => toggleLeaf(leaf, event.target.checked)} /><span><small>{KIND_LABELS.financial_desired_outcome}</small>{leaf.entity.title}</span></label>{source.sourceKind === 'parent' && <div className="parent-contributor-paths">{leaf.checkedContributorOfferIds?.map(offerId => <label className="intent-checkbox" key={offerId}><input type="checkbox" checked onChange={() => removeParentContributor(leaf, offerId)} /><span>via {entityTitle(document, offerId)}</span></label>)}</div>}</div>)}
        </section>)}
        {sources.filter(source => source.sourceKind === 'offer').length > 1 && <button type="button" className="text-action" onClick={() => selectAll(sources.filter(source => source.sourceKind === 'offer'))}>Select all from all Offers</button>}
        <details className="global-intent-discovery" open={connectionPicker.mode !== 'upstream'} onToggle={event => { if ((event.currentTarget as HTMLDetailsElement).open && connectionPicker.mode === 'upstream') setConnectionPicker({ ...connectionPicker, mode: 'global-search' }); }}><summary>Find Client intent elsewhere</summary>
          <label>Search by title<input type="search" value={connectionPicker.query} onChange={event => setConnectionPicker({ ...connectionPicker, mode: 'global-search', query: event.target.value })} /></label>
          <label>Entity kind<select aria-label="Entity kind" value={connectionPicker.kind ?? ''} onChange={event => setConnectionPicker({ ...connectionPicker, mode: 'global-search', kind: (event.target.value || undefined) as ConnectionPickerKind | undefined })}><option value="">All kinds</option>{CONNECTION_PICKER_KINDS.map(kind => <option value={kind} key={kind}>{KIND_LABELS[kind]}</option>)}</select></label>
          <div className="global-intent-results">{discovery.jobGroups.map(group => <div className="intent-job-branch" key={group.job.id}><strong><small>{KIND_LABELS[group.job.kind]}</small>{group.job.title}</strong>{group.leaves.map(leaf => <button type="button" className="intent-discovery-leaf" key={leaf.checkboxId} onClick={() => chooseDiscovery(leaf, group.job.id)}>{leaf.entity.title}</button>)}</div>)}{discovery.directLeaves.map(leaf => <button type="button" className="intent-discovery-leaf" key={leaf.checkboxId} onClick={() => chooseDiscovery(leaf)}><small>{KIND_LABELS[leaf.entity.kind]}</small>{leaf.entity.title}</button>)}</div>
          {connectionPicker.mode === 'current-contributor-choice' && connectionPicker.target && <fieldset className="contributor-chooser"><legend>Which linked Offers contribute here?</legend>{offers.map(offerId => <label className="checkbox" key={offerId}><input type="checkbox" checked={connectionPicker.contributorOfferIds.includes(offerId)} onChange={event => setConnectionPicker({ ...connectionPicker, contributorOfferIds: event.target.checked ? [...connectionPicker.contributorOfferIds, offerId] : connectionPicker.contributorOfferIds.filter(id => id !== offerId) })} />{entityTitle(document, offerId)}</label>)}<button type="button" disabled={!connectionPicker.contributorOfferIds.length} onClick={() => runBottomUp(connectionPicker.target!.leaf, connectionPicker.target!.jobId, connectionPicker.contributorOfferIds, connectionPicker.ancestorContributingOfferIds)}>Continue</button></fieldset>}
          {connectionPicker.mode === 'ancestor-contributor-choice' && connectionPicker.unresolved?.status === 'unresolved' && connectionPicker.target && <fieldset className="contributor-chooser"><legend>Contributor for {entityTitle(document, connectionPicker.unresolved.touchpointId)}</legend>{connectionPicker.unresolved.candidateOfferIds.map(offerId => <button type="button" key={offerId} onClick={() => { const ancestors = { ...connectionPicker.ancestorContributingOfferIds, [connectionPicker.unresolved!.touchpointId]: offerId }; runBottomUp(connectionPicker.target!.leaf, connectionPicker.target!.jobId, connectionPicker.contributorOfferIds, ancestors); }}>{entityTitle(document, offerId)}</button>)}</fieldset>}
          {connectionPicker.mode === 'invalid' && connectionPicker.unresolved?.status === 'invalid' && <p role="alert">No contributor path exists for {entityTitle(document, connectionPicker.unresolved.touchpointId)} ({connectionPicker.unresolved.touchpointId}).</p>}
        </details>
        <button type="button" onClick={closePicker}>Cancel</button>
      </section>}
      {localRemoval && <div role="dialog" aria-modal="true" aria-labelledby="local-removal-heading" className="confirmation-dialog"><h4 id="local-removal-heading">Remove this local Client path?</h4><p>This also removes {localRemoval.plan.impact.mitigationRelationshipIds.length} dependent mitigation record(s).</p><div className="choice-row"><button type="button" className="danger" onClick={() => { const pending = localRemoval; setLocalRemoval(null); finishLocal(commitTouchpointIntentPathPlan(documentRef.current, pending.plan), pending.returnFocusId); }}>Remove</button><button type="button" onClick={() => { const id = localRemoval.returnFocusId; setLocalRemoval(null); requestAnimationFrame(() => globalThis.document.getElementById(id)?.focus()); }}>Cancel</button></div></div>}
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
      return <div className={`intent-job ${selected ? 'selected' : ''}`} key={intent.id}>
        <div className="intent-job-heading">
          {bearsOutcomes ? <button type="button" className="disclosure" aria-label={`${offerExpanded[intent.id] ? 'Collapse' : 'Expand'} ${job.title}`} aria-expanded={Boolean(offerExpanded[intent.id])} onClick={() => setOfferExpanded(current => ({ ...current, [intent.id]: !current[intent.id] }))}>{offerExpanded[intent.id] ? '▾' : '▸'}</button> : <span className="disclosure-placeholder" />}
          <label className="intent-selection"><input type="checkbox" checked={selected} onChange={event => setter({ ...d, selectedIntentIds: event.target.checked ? [...d.selectedIntentIds, intent.id] : d.selectedIntentIds.filter(id => id !== intent.id) })} /><span><strong>{job.title}</strong><small>{KIND_LABELS[job.kind]}</small>{relatedTitle && <small className="related-context">Related to: {relatedTitle}</small>}</span></label>
        </div>
        {bearsOutcomes && offerExpanded[intent.id] && <div className="intent-branches">
          {outcomes.map(outcome => <span className="intent-outcome readonly-outcome" key={outcome.id}>• {outcome.title}</span>)}
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
    return <section className="touchpoint-business-structure" aria-label="Business structure">
      <div className="business-structure-primary">
        <div className="business-structure-regions">
          <section className="business-structure-region business-structure-placement" aria-labelledby="business-placement-heading">
            <h5 id="business-placement-heading">Placement</h5>
            <div className="business-structure-property" role="group" aria-label="Offers property"><h5>Offers</h5>
              {offersPicker ? (() => {
                const query = offersPicker.query.trim().toLocaleLowerCase();
                const offers = document.entities.filter(entity => entity.kind === 'offer' && (!query || entity.title.toLocaleLowerCase().includes(query)));
                const linked = new Set(structure.offers.map(offer => offer.id));
                return <div className="business-structure-offers-picker" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setOffersPicker(null); requestAnimationFrame(() => offersPickerButtonRef.current?.focus()); } }}>
                  <label htmlFor="linked-offers-search">Search Offers</label>
                  <input autoFocus id="linked-offers-search" type="search" value={offersPicker.query} onChange={event => setOffersPicker({ query: event.target.value })} />
                  <div className="business-structure-offers-results" aria-live="polite">
                    {offers.length ? offers.map(offer => <label className="business-structure-offer-choice" key={offer.id}><input type="checkbox" checked={linked.has(offer.id)} onChange={event => requestLinkedOffersCommit(event.target.checked ? [...linked, offer.id] : [...linked].filter(id => id !== offer.id), event.currentTarget)} /><span>{offer.title}</span></label>) : <p>No matching Offers.</p>}
                  </div>
                  <button type="button" onClick={() => { setOffersPicker(null); requestAnimationFrame(() => offersPickerButtonRef.current?.focus()); }}>Cancel</button>
                </div>;
              })() : <div className="business-structure-offers-value">{navigationList(structure.offers)}<button ref={offersPickerButtonRef} type="button" className="business-structure-edit-relations" aria-label="Edit linked Offers" onClick={() => setOffersPicker({ query: '' })}><span className="business-structure-edit-affordance" aria-hidden="true">✎</span></button></div>}
            </div>
            <div className="business-structure-property" role="group" aria-label="Located in property"><h5>Located in</h5>{businessInlineEdit?.property === 'located-in' ? (() => {
              const trimmedQuery = businessInlineEdit.query.trim();
              const normalized = trimmedQuery.toLocaleLowerCase();
              const matches = document.touchpointContainers.filter(container => container.title.toLocaleLowerCase().includes(normalized));
              const exact = document.touchpointContainers.find(container => container.title.trim().toLocaleLowerCase() === normalized);
              const commitQuery = () => {
                if (exact) commitInlineLocation({ kind: 'existing', containerId: exact.id });
                else if (trimmedQuery) commitInlineLocation({ kind: 'new', title: trimmedQuery });
              };
              return <div className="combobox business-structure-editor" onPointerDown={event => event.stopPropagation()}>
                <input autoFocus role="combobox" aria-label="Edit Located in" aria-expanded="true" aria-controls="business-location-options" value={businessInlineEdit.query} onChange={event => setBusinessInlineEdit({ property: 'located-in', query: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commitQuery(); } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setBusinessInlineEdit(null); } }} />
                <div id="business-location-options" role="listbox">
                  <button type="button" role="option" aria-selected={!structure.container} onClick={() => commitInlineLocation({ kind: 'none' })}>{structure.container ? 'Clear location' : 'No location'}</button>
                  {matches.map(container => <button type="button" role="option" aria-selected={structure.container?.id === container.id} key={container.id} onClick={() => commitInlineLocation({ kind: 'existing', containerId: container.id })}>{container.title}</button>)}
                  {trimmedQuery && !exact && <button type="button" role="option" aria-selected="false" onClick={commitQuery}>Create &quot;{trimmedQuery}&quot;</button>}
                </div>
                {businessInlineEdit.error && <p className="error-message" role="alert">{businessInlineEdit.error}</p>}
              </div>;
            })() : <button type="button" className={`business-structure-edit-value${structure.container ? '' : ' business-structure-edit-empty'}`} onClick={() => setBusinessInlineEdit({ property: 'located-in', query: structure.container?.title ?? '' })} aria-label={`Edit Located in${structure.container ? `, ${structure.container.title}` : ''}`}><span>{structure.container?.title ?? 'Add location'}</span><span className="business-structure-edit-affordance" aria-hidden="true">✎</span></button>}</div>
            <div className="business-structure-property business-structure-url" role="group" aria-label="Web address property"><h5>URL</h5>{businessInlineEdit?.property === 'url' ? <div className="business-structure-editor"><input autoFocus aria-label="Edit web address" value={businessInlineEdit.value} onChange={event => setBusinessInlineEdit({ property: 'url', value: event.target.value })} onBlur={event => commitInlineUrl(event.currentTarget.value)} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); commitInlineUrl(event.currentTarget.value); } else if (event.key === 'Escape') { event.preventDefault(); setBusinessInlineEdit(null); } }} />{businessInlineEdit.error && <p className="error-message" role="alert">{businessInlineEdit.error}</p>}</div> : <div className="business-structure-editable-value"><button type="button" className={`business-structure-edit-value${structure.touchpoint.url ? '' : ' business-structure-edit-empty'}`} onClick={() => setBusinessInlineEdit({ property: 'url', value: structure.touchpoint.url ?? '' })} aria-label={`Edit web address${structure.touchpoint.url ? `, ${structure.touchpoint.url}` : ''}`}><span>{structure.touchpoint.url ?? 'Add URL'}</span><span className="business-structure-edit-affordance" aria-hidden="true">✎</span></button>{safeUrl(structure.touchpoint.url) && <a className="business-structure-external-link" href={safeUrl(structure.touchpoint.url)} target="_blank" rel="noreferrer" aria-label={structure.touchpoint.url}>↗</a>}</div>}</div>
          </section>
          <section className="business-structure-region business-structure-containment" aria-labelledby="business-containment-heading">
            <h5 id="business-containment-heading">Containment</h5>
            <div className="business-structure-property" role="group" aria-label="Parent property"><h5>Parent</h5>
              {parentPicker ? (() => {
                const query = parentPicker.query.trim().toLocaleLowerCase();
                const options = parentTouchpointOptions(documentRef.current, structure.touchpoint.id).filter(option => !query || option.title.toLocaleLowerCase().includes(query));
                return <div className="business-structure-parent-picker" onKeyDown={event => {
                  if (event.key === 'Escape') {
                    event.preventDefault(); event.stopPropagation(); setParentPicker(null);
                    requestAnimationFrame(() => parentPickerButtonRef.current?.focus());
                  }
                }}>
                  <label htmlFor="parent-touchpoint-search">Search Touchpoints</label>
                  <input autoFocus id="parent-touchpoint-search" type="search" value={parentPicker.query} onChange={event => setParentPicker({ query: event.target.value })} />
                  <div className="business-structure-parent-results" role="listbox" aria-label="Parent Touchpoint options" aria-live="polite">
                    {options.length ? options.map(option => <button type="button" role="option" aria-selected={structure.parent?.id === option.id} key={option.id} onClick={() => commitParentImmediately(structure.touchpoint.id, option.id)}>{option.title}</button>) : <p role="status">No matching Touchpoints.</p>}
                  </div>
                  <div className="business-structure-parent-actions">
                    {structure.parent && <button type="button" onClick={() => commitParentImmediately(structure.touchpoint.id, '')}>Clear parent</button>}
                    <button type="button" onClick={() => { setParentPicker(null); requestAnimationFrame(() => parentPickerButtonRef.current?.focus()); }}>Cancel</button>
                  </div>
                </div>;
              })() : <div className="business-structure-parent-value">
                {structure.parent ? navigationList([structure.parent]) : <span className="business-structure-edit-empty">Add parent</span>}
                <button ref={parentPickerButtonRef} type="button" className="business-structure-edit-relations" aria-label="Edit parent Touchpoint" onClick={() => setParentPicker({ query: '' })}><span className="business-structure-edit-affordance" aria-hidden="true">✎</span></button>
              </div>}
            </div>
            <div className="business-structure-property" role="group" aria-label="Children property"><h5>Children</h5>{navigationList(structure.children)}</div>
          </section>
        </div>
      </div>
      <div className="business-structure-derived">
        <div className="derived-heading"><h5>Neighborhood</h5><span>Derived</span></div>
        <div className="derived-neighborhood-slices">
          {structure.otherTouchpointsByOffer.map(group => <div className="business-structure-property derived-neighborhood-slice" role="group" aria-label={`Other Touchpoints for ${group.offer.title}`} key={group.offer.id}>
            <h5>Other Touchpoints for {group.offer.title}</h5>{navigationList(group.touchpoints)}
          </div>)}
          {structure.container && <div className="business-structure-property derived-neighborhood-slice" role="group" aria-label={`More in ${structure.container.title}`}><h5>More in {structure.container.title}</h5>{navigationList(structure.otherTouchpointsInContainer)}</div>}
        </div>
      </div>
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
              select(null);
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
              if (!node.data.satellite || node.data.satellite.child) { if (!node.data.satellite) select(node.id); return; }
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
              select(node.id);
              setActiveWorkspaceView('inspector');
            }}
            onNodeContextMenu={(e, node) => {
              e.preventDefault();
              menuOwnerRef.current = e.currentTarget as HTMLElement;
              const client = { x: e.clientX, y: e.clientY };
              const panel = panelRef.current;
              if (!panel) return;
              if (selectedRef.current !== node.id) select(node.id);
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
                ? <InlineTitleEditor title={inspectorTitleEdit.title} onCommit={title => finishInspectorTitleEdit(title)} onCancel={() => finishInspectorTitleEdit(false)} className="inline-inspector-title" accessibleLabel={`Edit title, ${inspectorTitleEdit.title}`} stopPointerEvents={false} />
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
                  applyTouchpointChanges();
                  return;
                }
                try {
                  if (selected.kind === 'product') {
                    const impact = getProductIntentChangeImpact(document, { productId: selected.id, intents: Object.entries(editDraft.productIntentOutcomes).filter(([jobId]) => !editDraft.stagedClientEntities.some(entity => entity.id === jobId && !entity.title.trim())).map(([jobId, addressedDesiredOutcomeIds]) => ({ jobId, addressedDesiredOutcomeIds })) });
                    if (!productApplyBypassRef.current && (impact.offerJobSelectionIds.length || impact.touchpointJobSelectionIds.length || impact.narrowedTouchpointSelections.length)) {
                      setProductConfirmation({ mode: 'impact', owner: 'product', impact, returnFocus: globalThis.document.activeElement as HTMLElement | null });
                      return;
                    }
                    productApplyBypassRef.current = false;
                  }
                  if (selected.kind === 'offer') {
                    const impact = getOfferIntentChangeImpact(document, { offerId: selected.id, productId: editDraft.linkedProductId, productJobIntentIds: editDraft.selectedIntentIds, financialDesiredOutcomeIds: editDraft.financialOutcomeIds });
                    if (!productApplyBypassRef.current && (impact.touchpointJobSelectionIds.length || impact.touchpointFinancialSelectionIds.length)) {
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
                      productJobIntentIds: editDraft.selectedIntentIds,
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
              {productIntentFields(editDraft, setEditDraft)}
              {offerIntentFields(editDraft, setEditDraft)}
              {resistanceImpactFields(selected)}
              {semanticParentField(editDraft, setEditDraft)}
              {contextualJobFields(editDraft, setEditDraft)}
              {repulsorTargetsField(editDraft, setEditDraft)}
              {touchFields(editDraft, setEditDraft, true, false)}
              {selected.kind === 'touchpoint' && touchpointIntentFields()}
              {selected.kind === 'touchpoint' && safeUrl(editDraft.url) && (
                <a href={safeUrl(editDraft.url)} target="_blank" rel="noreferrer">
                  Open {editDraft.title}
                </a>
              )}
              <div className={`apply-footer ${inspectorDirty ? 'dirty' : ''}`}>
                {inspectorDirty && <span>Unsaved changes</span>}
                <button className="primary" disabled={!inspectorDirty || Boolean(editDraft.touchpointIntent && validateTouchpointIntentDraft(editDraft.touchpointIntent, editDraft.linkedOfferIds))}>Apply changes</button>
              </div>
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
                <button type="button" onClick={() => setActiveWorkspaceView('map')}>Go to Map</button>
              </div>
            </div>
          )}
        </section>
      </div>
      {productConfirmation && (
        <div className="confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeProductConfirmation(); }}>
          <div ref={confirmationRef} role="dialog" aria-modal="true" aria-labelledby="product-confirmation-title" className="confirmation-dialog" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeProductConfirmation(); } }}>
            <h2 id="product-confirmation-title">{productConfirmation.mode === 'dirty' ? `Unsaved ${selected?.kind === 'offer' ? 'Offer' : selected?.kind === 'touchpoint' ? 'Touchpoint' : 'Product'} changes` : 'This change affects downstream intent'}</h2>
            {productConfirmation.mode === 'impact' && productConfirmation.owner === 'product' && (
              <div className="impact-list">
                {productConfirmation.impact.offerJobSelectionIds.map(id => { const selection = document.offerJobSelections.find(item => item.id === id); const offer = document.entities.find(entity => entity.id === selection?.offerId); const intent = document.productJobIntents.find(item => item.id === selection?.productJobIntentId); const job = document.entities.find(entity => entity.id === intent?.jobId); return <p key={id}><strong>{offer?.title}</strong><span>loses {job?.title}</span></p>; })}
                {productConfirmation.impact.touchpointJobSelectionIds.map(id => { const selection = document.touchpointJobSelections.find(item => item.id === id); const touchpoint = document.entities.find(entity => entity.id === selection?.touchpointId); const intent = document.productJobIntents.find(item => item.id === selection?.productJobIntentId); const job = document.entities.find(entity => entity.id === intent?.jobId); return <p key={id}><strong>{touchpoint?.title}</strong><span>loses {job?.title}</span></p>; })}
                {productConfirmation.impact.narrowedTouchpointSelections.map(item => { const selection = document.touchpointJobSelections.find(candidate => candidate.id === item.touchpointJobSelectionId); const touchpoint = document.entities.find(entity => entity.id === selection?.touchpointId); return <p key={item.touchpointJobSelectionId}><strong>{touchpoint?.title}</strong><span>loses {item.removedDesiredOutcomeIds.map(id => document.entities.find(entity => entity.id === id)?.title).join(', ')}</span></p>; })}
              </div>
            )}
            {productConfirmation.mode === 'impact' && productConfirmation.owner === 'offer' && (
              <div className="impact-list">
                {productConfirmation.impact.touchpointJobSelectionIds.map(id => { const selection = document.touchpointJobSelections.find(item => item.id === id); const touchpoint = document.entities.find(entity => entity.id === selection?.touchpointId); const intent = document.productJobIntents.find(item => item.id === selection?.productJobIntentId); const job = document.entities.find(entity => entity.id === intent?.jobId); return <p key={id}><strong>{touchpoint?.title}</strong><span>loses {job?.title}</span></p>; })}
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
                <button type="button" className="primary" disabled={selected?.kind === 'touchpoint' && Boolean(editDraft?.touchpointIntent && validateTouchpointIntentDraft(editDraft.touchpointIntent, editDraft.linkedOfferIds))} onClick={() => { const pending = productConfirmation.pending; const returnFocus = productConfirmation.returnFocus; setProductConfirmation(null); if (selected?.kind === 'touchpoint') applyTouchpointChanges(pending, returnFocus); else { pendingAfterApplyRef.current = pending; globalThis.document.querySelector<HTMLFormElement>('.inspector > form')?.requestSubmit(); } }}>Apply</button>
                <button type="button" onClick={() => discardDirtySession(productConfirmation.pending)}>Discard</button>
                <button type="button" onClick={closeProductConfirmation}>Keep editing</button>
              </> : <>
                <button type="button" onClick={closeProductConfirmation}>Cancel</button>
                <button type="button" className="primary" onClick={() => { const confirmation = productConfirmation; setProductConfirmation(null); if (confirmation.owner === 'touchpoint' && confirmation.immediateCommit) confirmation.immediateCommit(); else if (confirmation.owner === 'touchpoint') applyTouchpointChanges(confirmation.pending, confirmation.returnFocus, true); else { productApplyBypassRef.current = true; globalThis.document.querySelector<HTMLFormElement>('.inspector > form')?.requestSubmit(); } }}>Apply changes</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
