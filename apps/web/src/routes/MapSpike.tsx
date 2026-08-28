import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Background, Controls, Handle, Position, ReactFlow, type Node, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CLIENT_ROOT_ENTITY_KINDS, addEntity, addProductJobIntent, addTouchpointContainer, authorTouchpointIntentBottomUp, createEmptyMapDocument, duplicateEntity, getProductIntentChangeImpact, isClientRootEntityKind, isContextualClientEntityKind, isRepulsorTargetKind, movePlacement, relevantRepulsorsForTouchpoint, resistanceImpactForOffer, resistanceImpactForProduct, removeProductJobIntent, selectAllLinkedOfferIntentsForTouchpoint, setContextualCoreFunctionalJobs, setOfferFinancialIntents, setOfferJobSelections, setTouchpointIntentSelections, setTouchpointMitigations, updateEntity, updateProductJobIntent, updateRepulsorTargets, type BottomUpTouchpointInput, type ContextualClientEntityKind, type Entity, type MapDocument, type ProvisionalEntityKind, type Relationship, type TouchpointTopDownSelection } from '@vee/domain';
import { deriveMapEdges, deriveMapNodes, KIND_LABELS, layoutForEntity, MAP_EDGE_TYPE, type MapNodeData } from '../map-adapter';
import { MapEdge } from '../map-edge';
import { contextMenuPoint, linkedOfferIds, overlayPoint, parentTouchpointOptions, revealViewport, siblingDraft, siblingPlacement, type Point } from '../map-interaction';
import { findFreePlacement, findPlacementNearPoint, findRelatedPlacement, type ProposedPlacementRelation } from '../map-placement';
import { Link } from '../router';

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
type LocationDraft = { kind: 'none' } | { kind: 'existing'; containerId: string } | { kind: 'new'; title: string };
type Draft = {
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
  draft: Draft;
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
  | { mode: 'impact'; pending?: () => void; returnFocus: HTMLElement | null; impact: ReturnType<typeof getProductIntentChangeImpact> };
type BottomUpDraft = {
  targetId: string;
  outcomeMode: 'direct' | 'outcomes';
  outcomeIds: string[];
  offerIds: string[];
  error: string;
};
const draft = (kind: ProvisionalEntityKind = 'product'): Draft => ({
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
const isControl = (target: EventTarget | null) => target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, button, [role="combobox"], [contenteditable], form, [role="dialog"], [role="menu"], [role="listbox"], [popover], .contextual-editor'));
const hasCanonicalChild = (entity: Entity) => entity.kind === 'product' || entity.kind === 'offer' || entity.kind === 'touchpoint' || entity.kind === 'core_functional_job' || entity.kind === 'consumption_chain_job' || entity.kind === 'related_job';
const safeUrl = (url?: string) => (url && !/^\s*(javascript|data):/i.test(url) ? url : undefined);
const normalizeTitleLineBreaks = (value: string) => value.replace(/[\r\n\u2028\u2029]+/g, ' ');
function resizeAutoGrowingField(field: HTMLTextAreaElement) {
  field.style.height = 'auto';
  field.style.height = `${field.scrollHeight}px`;
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
function ProductPrerequisiteFields({ draftValue, setDraftValue, document }: { draftValue: Draft; setDraftValue: (value: Draft) => void; document: MapDocument }) {
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
function InlineTitleEditor({ title, onCommit, onCancel }: { title: string; onCommit: (title: string) => void; onCancel: () => void }) {
  const [draftTitle, setDraftTitle] = useState(() => title);
  return (
    <textarea
      className="inline-node-title nodrag nopan"
      aria-label={`Edit title for ${title}`}
      rows={2}
      value={draftTitle}
      autoFocus
      onChange={(event) => setDraftTitle(normalizeTitleLineBreaks(event.target.value))}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit(draftTitle);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    />
  );
}
export function MapNode({ data }: { data: MapNodeData }) {
  const url = safeUrl(data.url);
  const style = {
    '--node-title-size': `${data.layout.titleFontSize}px`,
    '--node-kind-size': `${data.layout.kindFontSize}px`,
    '--node-content-width': `${data.layout.contentWidth}px`,
  } as CSSProperties;
  return (
    <div className={`node-content${data.layout.compactTitle ? ' compact-title' : ''}`} style={style}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {data.inlineTitle === undefined ? <strong>{data.title}</strong> : (
        <InlineTitleEditor title={data.inlineTitle} onCommit={(title) => data.onInlineTitleCommit?.(title)} onCancel={() => data.onInlineTitleCancel?.()} />
      )}
      <span>{data.kindLabel}</span>
      {url && (
        <a className="node-link nodrag nopan" href={url} target="_blank" rel="noreferrer" aria-label={`Open ${data.title}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          ↗
        </a>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

export function MapSpike() {
  const panelRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuOwnerRef = useRef<HTMLElement | null>(null);
  const contextualEditorRef = useRef<HTMLElement>(null);
  const flowRef = useRef<ReactFlowInstance<Node<MapNodeData>> | null>(null);
  const pendingInspectorRevealRef = useRef<string[] | null>(null);
  const [document, setDocument] = useState<MapDocument>(INITIAL_DOCUMENT);
  const documentRef = useRef(document);
  documentRef.current = document;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeWorkspaceView, setActiveWorkspaceView] = useState<WorkspaceView>('map');
  const activeWorkspaceViewRef = useRef(activeWorkspaceView);
  activeWorkspaceViewRef.current = activeWorkspaceView;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const [mode, setMode] = useState<'idle' | 'create'>('idle');
  const [createDraft, setCreateDraft] = useState<Draft>(draft());
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [productExpanded, setProductExpanded] = useState<Record<string, boolean>>({});
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
  const [quick, setQuick] = useState<Quick | null>(null);
  const [bottomUp, setBottomUp] = useState<BottomUpDraft | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedRef = useRef(copiedId);
  copiedRef.current = copiedId;
  const [message, setMessage] = useState('');
  const nodes = deriveMapNodes(document, VIEW_ID, selectedId).map((node) => ({
    ...node,
    type: 'mapNode',
    draggable: inlineEdit?.entityId !== node.id,
    data: inlineEdit?.entityId === node.id ? {
      ...node.data,
      inlineTitle: inlineEdit.title,
      onInlineTitleCommit: (title: string) => finishInlineTitleEdit(title),
      onInlineTitleCancel: () => finishInlineTitleEdit(false),
    } : node.data,
  }));
  const edges = deriveMapEdges(document);
  const selected = document.entities.find((e) => e.id === selectedId);
  const inspectorDirty = Boolean(selected && editDraft && JSON.stringify(editDraft) !== JSON.stringify(draftFor(selected)));

  useEffect(() => {
    if (selectedId && !selected) {
      setSelectedId(null);
      setEditDraft(null);
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

  function draftFor(entity: Entity, source = document): Draft {
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
      result.url = entity.url ?? '';
      result.mitigatedRepulsorIds = source.relationships.flatMap((relation) => (relation.kind === 'touchpoint_mitigates_repulsor' && relation.touchpointId === entity.id ? [relation.repulsorId] : []));
    }
    if (entity.kind === 'emotional_job' || entity.kind === 'social_job') result.contextualCoreJobIds = source.relationships.flatMap((r) => (r.kind === 'core_functional_job_contextualizes_job' && r.contextualJobId === entity.id ? [r.coreFunctionalJobId] : []));
    if (entity.kind === 'related_job') result.parentEntityId = source.relationships.find((r): r is Extract<Relationship, { kind: 'core_functional_job_has_related_job' }> => r.kind === 'core_functional_job_has_related_job' && r.relatedJobId === entity.id)?.coreFunctionalJobId ?? '';
    if (entity.kind === 'desired_outcome') result.parentEntityId = source.relationships.find((r): r is Extract<Relationship, { kind: 'job_has_desired_outcome' }> => r.kind === 'job_has_desired_outcome' && r.desiredOutcomeId === entity.id)?.jobId ?? '';
    if (entity.kind === 'repulsor') result.resistedTargetIds = source.relationships.filter((r): r is Extract<Relationship, { kind: 'repulsor_resists' }> => r.kind === 'repulsor_resists' && r.repulsorId === entity.id).map((r) => r.targetEntityId);
    return result;
  }
  function resetProductSession(entity: Entity | undefined, source = document) {
    setProductExpanded({});
    rememberedProductOutcomesRef.current = {};
    setRememberedProductOutcomes({});
    setProductAddingKind(false);
    setProductInline(null);
    setProductInlineTitle('');
    setProductIntentSectionIds(entity?.kind === 'product' ? source.productJobIntents.filter(intent => intent.productId === entity.id).map(intent => intent.jobId) : []);
  }
  function performSelect(id: string | null) {
    setSelectedId(id);
    setMode('idle');
    setQuick(null);
    setBottomUp(null);
    setMenu(null);
    setMessage('');
    const entity = documentRef.current.entities.find((e) => e.id === id);
    setEditDraft(entity ? draftFor(entity, documentRef.current) : null);
    resetProductSession(entity, documentRef.current);
  }
  function select(id: string | null) {
    if (id === selectedRef.current) return;
    if (selected?.kind === 'product' && inspectorDirty) {
      setProductConfirmation({ mode: 'dirty', pending: () => performSelect(id), returnFocus: globalThis.document.activeElement as HTMLElement | null });
      return;
    }
    performSelect(id);
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
  function finishInlineTitleEdit(commitTitle: string | false) {
    const edit = inlineEdit;
    if (!edit) return;
    if (commitTitle !== false) {
      const entity = documentRef.current.entities.find((candidate) => candidate.id === edit.entityId);
      if (!entity) return;
      const current = draftFor(entity, documentRef.current);
      try {
        const next = updateEntity(documentRef.current, {
          entityId: entity.id,
          title: commitTitle,
          ...(current.locatedInId ? { locatedInId: current.locatedInId } : {}),
          ...(current.url ? { url: current.url } : {}),
          ...(current.linkedProductId ? { linkedProductId: current.linkedProductId } : {}),
          linkedOfferIds: current.linkedOfferIds,
          relationshipIds: documentRef.current.relationships.flatMap((relation) => relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === entity.id ? [relation.id] : []),
          ...(current.parentTouchpointId ? { parentTouchpointId: current.parentTouchpointId } : {}),
          ...(current.parentEntityId ? { parentEntityId: current.parentEntityId } : {}),
          ...(documentRef.current.relationships.find((relation) => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === entity.id)?.id ? { parentRelationshipId: documentRef.current.relationships.find((relation) => relation.kind === 'touchpoint_contains_touchpoint' && relation.childTouchpointId === entity.id)!.id } : {}),
        });
        setDocument(next);
        setEditDraft(draftFor(next.entities.find((candidate) => candidate.id === entity.id)!, next));
        setMessage('Title updated.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Title could not be updated.');
        return;
      }
    }
    setInlineEdit(null);
    focusEntity(edit.entityId);
  }
  function childDraft(entity: Entity, contextualKind?: ContextualClientEntityKind): Draft | null {
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
  function automaticPlacement(d: Draft, preferredPoint?: Point, source = documentRef.current): Point {
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
    setMessage('');
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
    setMessage('');
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
    setMessage('');
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
    setMessage('');
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
  function createFrom(d: Draft, x: number, y: number): [MapDocument, string] {
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
  function commit(d: Draft, x: number, y: number, continuation: PostCreateContinuation = 'map') {
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
      setMessage('Element created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Element could not be created.');
    }
  }
  function commitInspectorRoot(d: Draft) {
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
      setMessage('Element created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Element could not be created.');
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
      setMessage('Element duplicated.');
      requestAnimationFrame(() => revealEntities(next, [entityId, id]));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Element could not be duplicated.');
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(null);
        setQuick(null);
        return;
      }
      if (isControl(event.target)) return;
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const workspaceModifier = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      const interactionOwnsKeyboard = Boolean(menu || quick || bottomUp || inlineEdit || mode === 'create');
      if (event.code === 'Space' && event.shiftKey && workspaceModifier && !event.altKey && !interactionOwnsKeyboard) {
        event.preventDefault();
        activateWorkspaceView(activeWorkspaceViewRef.current === 'map' ? 'inspector' : 'map');
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'c' && selectedRef.current) {
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
    setActiveWorkspaceView(view);
    if (view === 'map' && pendingInspectorRevealRef.current) {
      const ids = pendingInspectorRevealRef.current;
      pendingInspectorRevealRef.current = null;
      requestAnimationFrame(() => revealEntities(documentRef.current, ids));
    }
  }
  function performRootCreation() {
    setMode('create');
    setCreateDraft(draft());
    resetProductSession(undefined);
    setActiveWorkspaceView('inspector');
  }
  function startRootCreation() {
    if (selected?.kind === 'product' && inspectorDirty) {
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
  function containerChange(setter: (d: Draft) => void, d: Draft, selection: LocationDraft, query: string) {
    if (selection.kind === 'new') {
      const existing = document.touchpointContainers.find((c) => c.title.trim().toLocaleLowerCase() === query.toLocaleLowerCase());
      if (existing) setter({ ...d, locatedInId: existing.id, locatedInQuery: existing.title });
      else {
        const id = crypto.randomUUID();
        setDocument((current) => addTouchpointContainer(current, { id, title: query }));
        setter({ ...d, locatedInId: id, locatedInQuery: query });
      }
    } else setter({ ...d, locatedInId: selection.kind === 'existing' ? selection.containerId : '', locatedInQuery: query });
  }
  function touchFields(d: Draft, setter: (d: Draft) => void, inspector = false) {
    if (d.kind !== 'touchpoint') return null;
    const touchpoints = parentTouchpointOptions(document, inspector ? (selectedId ?? undefined) : undefined);
    return (
      <>
        <ContainerCombobox value={d.locatedInId} query={d.locatedInQuery} document={document} onChange={(selection, q) => containerChange(setter, d, selection, q)} />
        <label>
          URL <span>(optional)</span>
          <input value={d.url} onChange={(e) => setter({ ...d, url: e.target.value })} />
        </label>
        {!inspector && d.linkedOfferIds.length > 0 && (
          <section aria-label="Initial Client-intent scope" className="nested-options">
            <strong>Initial Client-intent scope</strong>
            <p>This Touchpoint will start with an empty effective scope. After Create, explicitly choose which valid Offer intent it expresses. Incomplete Client Jobs are unavailable until they have a Desired Outcome.</p>
          </section>
        )}
        {inspector && (
          <>
            <fieldset>
              <legend>Linked Offers</legend>
              {document.entities
                .filter((e) => e.kind === 'offer')
                .map((o) => (
                  <label className="checkbox" key={o.id}>
                    <input
                      type="checkbox"
                      checked={d.linkedOfferIds.includes(o.id)}
                      onChange={(e) =>
                        setter({
                          ...d,
                          linkedOfferIds: e.target.checked ? [...d.linkedOfferIds, o.id] : d.linkedOfferIds.filter((id) => id !== o.id),
                        })
                      }
                    />
                    {o.title}
                  </label>
                ))}
            </fieldset>
            <fieldset>
              <legend>Relevant Repulsors (derived)</legend>
              {selectedId &&
                relevantRepulsorsForTouchpoint(document, selectedId).map((repulsor) => (
                  <label className="checkbox" key={repulsor.id}>
                    <input
                      type="checkbox"
                      checked={d.mitigatedRepulsorIds.includes(repulsor.id)}
                      onChange={(event) =>
                        setter({
                          ...d,
                          mitigatedRepulsorIds: event.target.checked ? [...d.mitigatedRepulsorIds, repulsor.id] : d.mitigatedRepulsorIds.filter((id) => id !== repulsor.id),
                        })
                      }
                    />
                    {repulsor.title} · Touchpoint intends to mitigate Repulsor
                  </label>
                ))}
            </fieldset>
            <label>
              Parent Touchpoint
              <select value={d.parentTouchpointId} onChange={(e) => setter({ ...d, parentTouchpointId: e.target.value })}>
                <option value="">No parent</option>
                {touchpoints.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </>
    );
  }
  function rootTouchpointContextFields(d: Draft, setter: (d: Draft) => void) {
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
  function repulsorTargetsField(d: Draft, setter: (d: Draft) => void) {
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
  function bottomUpEditor(touchpointId: string, offers: string[]) {
    if (!bottomUp) return null;
    const targets = document.entities.filter((entity) => ['core_functional_job', 'related_job', 'emotional_job', 'social_job', 'consumption_chain_job', 'financial_desired_outcome'].includes(entity.kind));
    const target = targets.find((entity) => entity.id === bottomUp.targetId);
    const hasOutcomeScope = target?.kind === 'core_functional_job' || target?.kind === 'related_job' || target?.kind === 'consumption_chain_job';
    const outcomes = hasOutcomeScope ? document.relationships.flatMap((relation) => (relation.kind === 'job_has_desired_outcome' && relation.jobId === target.id ? document.entities.filter((entity) => entity.id === relation.desiredOutcomeId) : [])) : [];
    const selectedOutcomes = hasOutcomeScope ? bottomUp.outcomeIds : [];
    const productIdFor = (offerId: string) => document.relationships.find((relation): relation is Extract<Relationship, { kind: 'product_packaged_as_offer' }> => relation.kind === 'product_packaged_as_offer' && relation.offerId === offerId)?.productId;
    const preview = bottomUp.offerIds.map((offerId) => {
      const offer = document.entities.find((entity) => entity.id === offerId)!;
      const productId = productIdFor(offerId);
      if (target?.kind === 'financial_desired_outcome') {
        const intent = document.offerFinancialIntents.find((candidate) => candidate.offerId === offerId && candidate.financialDesiredOutcomeId === target.id);
        const selection = intent && document.touchpointFinancialSelections.some((candidate) => candidate.touchpointId === touchpointId && candidate.offerFinancialIntentId === intent.id);
        return {
          offer,
          changes: [intent ? 'This Offer already records this financial criterion.' : 'This Offer will record this Financial Desired Outcome.', selection ? 'This Touchpoint already expresses this intent; its local selection will be refreshed.' : 'This Touchpoint will express this intent.'],
        };
      }
      const intent = target && productId ? document.productJobIntents.find((candidate) => candidate.productId === productId && candidate.jobId === target.id) : undefined;
      const offerSelection = intent && document.offerJobSelections.find((candidate) => candidate.offerId === offerId && candidate.productJobIntentId === intent.id);
      const touchSelection = offerSelection && document.touchpointJobSelections.some((candidate) => candidate.touchpointId === touchpointId && candidate.offerId === offerId && candidate.productJobIntentId === intent!.id);
      const missingOutcomes = intent ? selectedOutcomes.filter((id) => !intent.addressedDesiredOutcomeIds.includes(id)) : selectedOutcomes;
      return {
        offer,
        changes: [intent ? (missingOutcomes.length ? `The Product will also record these Desired Outcomes: ${missingOutcomes.map((id) => document.entities.find((entity) => entity.id === id)?.title).join(', ')}.` : 'The Product already records this Client intent.') : 'The Product will record this Client intent.', offerSelection ? 'This Offer already carries this Client intent.' : 'This Offer will carry this Client intent.', touchSelection ? 'This Touchpoint already expresses this intent; its local selection will be refreshed.' : 'This Touchpoint will express this intent.'],
      };
    });
    const chooseTarget = (targetId: string) =>
      setBottomUp({
        ...bottomUp,
        targetId,
        outcomeMode: 'outcomes',
        outcomeIds: [],
        error: '',
      });
    const confirm = () => {
      if (!target) return;
      try {
        const touchpointSelectionIds = bottomUp.offerIds.map(() => crypto.randomUUID());
        let input: BottomUpTouchpointInput;
        if (target.kind === 'financial_desired_outcome') {
          const missing = bottomUp.offerIds.filter((offerId) => !document.offerFinancialIntents.some((intent) => intent.offerId === offerId && intent.financialDesiredOutcomeId === target.id));
          input = {
            touchpointId,
            contributingOfferIds: bottomUp.offerIds,
            financialDesiredOutcomeId: target.id,
            offerFinancialIntentIds: missing.map(() => crypto.randomUUID()),
            touchpointSelectionIds,
          };
        } else {
          const products = [...new Set(bottomUp.offerIds.map(productIdFor).filter((id): id is string => Boolean(id)))];
          const missingProducts = products.filter((productId) => !document.productJobIntents.some((intent) => intent.productId === productId && intent.jobId === target.id));
          const missingOffers = bottomUp.offerIds.filter((offerId) => {
            const productId = productIdFor(offerId);
            const intent = document.productJobIntents.find((candidate) => candidate.productId === productId && candidate.jobId === target.id);
            return !intent || !document.offerJobSelections.some((selection) => selection.offerId === offerId && selection.productJobIntentId === intent.id);
          });
          input = {
            touchpointId,
            contributingOfferIds: bottomUp.offerIds,
            jobId: target.id,
            addressedDesiredOutcomeIds: selectedOutcomes,
            productJobIntentIds: missingProducts.map(() => crypto.randomUUID()),
            offerJobSelectionIds: missingOffers.map(() => crypto.randomUUID()),
            touchpointSelectionIds,
          };
        }
        const next = authorTouchpointIntentBottomUp(document, input);
        setDocument(next);
        setEditDraft(draftFor(next.entities.find((entity) => entity.id === touchpointId)!, next));
        setBottomUp(null);
        setMessage('Client intent added to the Touchpoint.');
      } catch (error) {
        setBottomUp({
          ...bottomUp,
          error: error instanceof Error ? error.message : 'Client intent could not be added.',
        });
      }
    };
    const disabled = !target || !bottomUp.offerIds.length || (hasOutcomeScope && !bottomUp.outcomeIds.length);
    return (
      <div role="dialog" aria-label="Add client intent" className="nested-options">
        <h4>Add client intent</h4>
        <fieldset>
          <legend>Client intent</legend>
          {targets.map((entity) => (
            <label className="checkbox" key={entity.id}>
              <input type="radio" name="bottom-up-target" checked={bottomUp.targetId === entity.id} onChange={() => chooseTarget(entity.id)} />
              {entity.title} · {KIND_LABELS[entity.kind]}
            </label>
          ))}
        </fieldset>
        {hasOutcomeScope && (
          <fieldset>
            <legend>Desired Outcomes</legend>
            {outcomes.length ? (
              outcomes.map((outcome) => (
                <label className="checkbox" key={outcome.id}>
                  <input
                    type="checkbox"
                    checked={bottomUp.outcomeIds.includes(outcome.id)}
                    onChange={(event) =>
                      setBottomUp({
                        ...bottomUp,
                        outcomeMode: 'outcomes',
                        outcomeIds: event.target.checked ? [...bottomUp.outcomeIds, outcome.id] : bottomUp.outcomeIds.filter((id) => id !== outcome.id),
                        error: '',
                      })
                    }
                  />
                  {outcome.title}
                </label>
              ))
            ) : (
              <p>This Client Job has no Desired Outcomes yet. Create a Desired Outcome before confirming a Touchpoint encounter.</p>
            )}
          </fieldset>
        )}
        {offers.length === 1 ? (
          <p>
            <strong>Contributing Offer:</strong> {document.entities.find((entity) => entity.id === offers[0])?.title}
          </p>
        ) : (
          <fieldset>
            <legend>Contributing Offers</legend>
            {offers.length ? (
              offers.map((offerId) => (
                <label className="checkbox" key={offerId}>
                  <input
                    type="checkbox"
                    checked={bottomUp.offerIds.includes(offerId)}
                    onChange={(event) =>
                      setBottomUp({
                        ...bottomUp,
                        offerIds: event.target.checked ? [...bottomUp.offerIds, offerId] : bottomUp.offerIds.filter((id) => id !== offerId),
                        error: '',
                      })
                    }
                  />
                  {document.entities.find((entity) => entity.id === offerId)?.title}
                </label>
              ))
            ) : (
              <p>No Offers are linked to this Touchpoint. Link the Touchpoint to an Offer before adding client intent.</p>
            )}
          </fieldset>
        )}
        {target && bottomUp.offerIds.length > 0 && (
          <section aria-label="Change preview">
            <h5>Change preview</h5>
            {preview.map((item) => (
              <div key={item.offer.id}>
                <strong>{item.offer.title}</strong>
                <ul>
                  {item.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
        {bottomUp.error && <p role="alert">{bottomUp.error}</p>}
        <div className="actions">
          <button type="button" className="primary" disabled={disabled} onClick={confirm}>
            Confirm client intent
          </button>
          <button type="button" onClick={() => setBottomUp(null)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }
  function touchpointIntentFields(touchpointId: string) {
    const offers = linkedOfferIds(document, touchpointId);
    const allCurrent = (): TouchpointTopDownSelection[] => [
      ...document.touchpointJobSelections.filter((s) => s.touchpointId === touchpointId).map((s) => ({ ...s, kind: 'job' as const })),
      ...document.touchpointFinancialSelections
        .filter((s) => s.touchpointId === touchpointId)
        .map((s) => ({
          id: s.id,
          kind: 'financial' as const,
          offerId: s.offerId,
          offerFinancialIntentId: s.offerFinancialIntentId,
        })),
    ];
    const apply = (selections: TouchpointTopDownSelection[]) =>
      setDocument(
        setTouchpointIntentSelections(document, {
          touchpointId,
          selections: selections.map((selection) => ({
            ...selection,
            id: crypto.randomUUID(),
          })),
        }),
      );
    return (
      <fieldset>
        <legend>Which Client intent does this concrete Touchpoint work with?</legend>
        <div className="actions">
          <button
            type="button"
            onClick={() => {
              const jobs = document.offerJobSelections.filter((s) => offers.includes(s.offerId)).length;
              const financial = document.offerFinancialIntents.filter((i) => offers.includes(i.offerId)).length;
              setDocument(
                selectAllLinkedOfferIntentsForTouchpoint(document, {
                  touchpointId,
                  jobSelectionIds: Array.from({ length: jobs }, () => crypto.randomUUID()),
                  financialSelectionIds: Array.from({ length: financial }, () => crypto.randomUUID()),
                }),
              );
            }}
          >
            All intents from linked Offers
          </button>
          <button
            type="button"
            onClick={() =>
              setBottomUp({
                targetId: '',
                outcomeMode: 'direct',
                outcomeIds: [],
                offerIds: offers.length === 1 ? [offers[0]!] : [],
                error: '',
              })
            }
          >
            Add client intent
          </button>
        </div>
        {bottomUpEditor(touchpointId, offers)}
        {offers.map((offerId) => (
          <div className="nested-options" key={offerId}>
            <strong>{document.entities.find((e) => e.id === offerId)?.title}</strong>
            {document.offerJobSelections
              .filter((s) => s.offerId === offerId)
              .map((os) => {
                const intent = document.productJobIntents.find((i) => i.id === os.productJobIntentId)!;
                const job = document.entities.find((e) => e.id === intent.jobId)!;
                const path = document.touchpointJobSelections.find((s) => s.touchpointId === touchpointId && s.offerId === offerId && s.productJobIntentId === intent.id);
                return (
                  <div key={os.id}>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(path)}
                        onChange={(event) =>
                          apply(
                            event.target.checked
                              ? [
                                  ...allCurrent(),
                                  {
                                    id: '',
                                    kind: 'job',
                                    offerId,
                                    productJobIntentId: intent.id,
                                    addressedDesiredOutcomeIds: [],
                                  },
                                ]
                              : allCurrent().filter((s) => !(s.kind === 'job' && s.offerId === offerId && s.productJobIntentId === intent.id)),
                          )
                        }
                      />
                      {job.title}
                    </label>
                    {path &&
                      intent.addressedDesiredOutcomeIds.map((outcomeId) => (
                        <label className="checkbox" key={outcomeId}>
                          <input
                            type="checkbox"
                            checked={path.addressedDesiredOutcomeIds.includes(outcomeId)}
                            onChange={(event) =>
                              apply(
                                allCurrent().map((s) =>
                                  s.kind === 'job' && s.offerId === offerId && s.productJobIntentId === intent.id
                                    ? {
                                        ...s,
                                        addressedDesiredOutcomeIds: event.target.checked ? [...s.addressedDesiredOutcomeIds, outcomeId] : s.addressedDesiredOutcomeIds.filter((id) => id !== outcomeId),
                                      }
                                    : s,
                                ),
                              )
                            }
                          />
                          {document.entities.find((e) => e.id === outcomeId)?.title}
                        </label>
                      ))}
                  </div>
                );
              })}
            <strong>Financial Desired Outcomes</strong>
            {document.offerFinancialIntents
              .filter((i) => i.offerId === offerId)
              .map((intent) => (
                <label className="checkbox" key={intent.id}>
                  <input
                    type="checkbox"
                    checked={document.touchpointFinancialSelections.some((s) => s.touchpointId === touchpointId && s.offerFinancialIntentId === intent.id)}
                    onChange={(event) =>
                      apply(
                        event.target.checked
                          ? [
                              ...allCurrent(),
                              {
                                id: '',
                                kind: 'financial',
                                offerId,
                                offerFinancialIntentId: intent.id,
                              },
                            ]
                          : allCurrent().filter((s) => !(s.kind === 'financial' && s.offerFinancialIntentId === intent.id)),
                      )
                    }
                  />
                  {document.entities.find((e) => e.id === intent.financialDesiredOutcomeId)?.title}
                </label>
              ))}
          </div>
        ))}
      </fieldset>
    );
  }
  function semanticParentField(d: Draft, setter: (d: Draft) => void) {
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
  function contextualJobFields(d: Draft, setter: (d: Draft) => void) {
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
  function productIntentFields(d: Draft, setter: (d: Draft) => void) {
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
  function offerIntentFields(d: Draft, setter: (d: Draft) => void) {
    if (d.kind !== 'offer' || !d.linkedProductId) return null;
    const intents = document.productJobIntents.filter((intent) => intent.productId === d.linkedProductId);
    return (
      <>
        <fieldset>
          <legend>Which parts of this Product’s Client intent does this Offer carry?</legend>
          {intents.map((intent) => {
            const job = document.entities.find((entity) => entity.id === intent.jobId)!;
            return (
              <label className="checkbox" key={intent.id}>
                <input
                  type="checkbox"
                  checked={d.selectedIntentIds.includes(intent.id)}
                  onChange={(event) =>
                    setter({
                      ...d,
                      selectedIntentIds: event.target.checked ? [...d.selectedIntentIds, intent.id] : d.selectedIntentIds.filter((id) => id !== intent.id),
                    })
                  }
                />
                {job.title}
              </label>
            );
          })}
        </fieldset>
        <fieldset>
          <legend>Which financial criteria does this Offer address?</legend>
          {document.entities
            .filter((entity) => entity.kind === 'financial_desired_outcome')
            .map((outcome) => (
              <label className="checkbox" key={outcome.id}>
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
                {outcome.title}
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
          <p className="error-message" role="alert">
            {message}
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
            onNodeClick={(_, node) => select(node.id)}
            onNodeDoubleClick={(event, node) => {
              event.preventDefault();
              event.stopPropagation();
              startInlineTitleEdit(node.id);
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
          <h2 id="inspector-title">Entity Inspector</h2>
          {message && !quick && (
            <p className="status-message" role="status">
              {message}
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
                try {
                  if (selected.kind === 'product') {
                    const impact = getProductIntentChangeImpact(document, { productId: selected.id, intents: Object.entries(editDraft.productIntentOutcomes).filter(([jobId]) => !editDraft.stagedClientEntities.some(entity => entity.id === jobId && !entity.title.trim())).map(([jobId, addressedDesiredOutcomeIds]) => ({ jobId, addressedDesiredOutcomeIds })) });
                    if (!productApplyBypassRef.current && (impact.offerJobSelectionIds.length || impact.touchpointJobSelectionIds.length || impact.narrowedTouchpointSelections.length)) {
                      setProductConfirmation({ mode: 'impact', impact, returnFocus: globalThis.document.activeElement as HTMLElement | null });
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
                  if (selected.kind === 'touchpoint') {
                    const retained = next.relationships.flatMap((relation) => (relation.kind === 'touchpoint_mitigates_repulsor' && relation.touchpointId === selected.id ? [relation.repulsorId] : []));
                    const relevant = new Set(relevantRepulsorsForTouchpoint(next, selected.id).map((repulsor) => repulsor.id));
                    const desired = editDraft.mitigatedRepulsorIds.filter((id) => relevant.has(id));
                    const additions = desired.filter((id) => !retained.includes(id));
                    next = setTouchpointMitigations(next, {
                      touchpointId: selected.id,
                      repulsorIds: desired,
                      newRelationshipIds: additions.map(() => crypto.randomUUID()),
                    });
                  }
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
                  setDocument(next);
                  const appliedEntity = next.entities.find(entity => entity.id === selected.id)!;
                  setEditDraft(draftFor(appliedEntity, next));
                  resetProductSession(appliedEntity, next);
                  setMessage('Changes applied.');
                  const pending = pendingAfterApplyRef.current;
                  pendingAfterApplyRef.current = null;
                  pending?.();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Changes could not be applied.');
                }
              }}
            >
              <h3>{selected.title}</h3>
              <p>
                {editDraft.side === 'business' ? 'Business side' : 'Client side'} · {KIND_LABELS[selected.kind]} <span className="immutable-note">(type and side cannot be changed)</span>
              </p>
              <label>
                Title
                <input required value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
              </label>
              {selected.kind === 'offer' && (
                <label>
                  Linked Product
                  <select
                    value={editDraft.linkedProductId}
                    onChange={(e) => {
                      const linkedProductId = e.target.value;
                      setEditDraft({
                        ...editDraft,
                        linkedProductId,
                        selectedIntentIds: document.productJobIntents.filter((intent) => intent.productId === linkedProductId).map((intent) => intent.id),
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
              )}
              {productIntentFields(editDraft, setEditDraft)}
              {offerIntentFields(editDraft, setEditDraft)}
              {resistanceImpactFields(selected)}
              {semanticParentField(editDraft, setEditDraft)}
              {contextualJobFields(editDraft, setEditDraft)}
              {repulsorTargetsField(editDraft, setEditDraft)}
              {touchFields(editDraft, setEditDraft, true)}
              {selected.kind === 'touchpoint' && touchpointIntentFields(selected.id)}
              {selected.kind === 'touchpoint' && safeUrl(editDraft.url) && (
                <a href={safeUrl(editDraft.url)} target="_blank" rel="noreferrer">
                  Open {editDraft.title}
                </a>
              )}
              <div className={`apply-footer ${inspectorDirty ? 'dirty' : ''}`}>
                {inspectorDirty && <span>Unsaved changes</span>}
                <button className="primary" disabled={!inspectorDirty}>Apply changes</button>
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
            <h2 id="product-confirmation-title">{productConfirmation.mode === 'dirty' ? 'Unsaved Product changes' : 'This change affects downstream intent'}</h2>
            {productConfirmation.mode === 'impact' && (
              <div className="impact-list">
                {productConfirmation.impact.offerJobSelectionIds.map(id => { const selection = document.offerJobSelections.find(item => item.id === id); const offer = document.entities.find(entity => entity.id === selection?.offerId); const intent = document.productJobIntents.find(item => item.id === selection?.productJobIntentId); const job = document.entities.find(entity => entity.id === intent?.jobId); return <p key={id}><strong>{offer?.title}</strong><span>loses {job?.title}</span></p>; })}
                {productConfirmation.impact.touchpointJobSelectionIds.map(id => { const selection = document.touchpointJobSelections.find(item => item.id === id); const touchpoint = document.entities.find(entity => entity.id === selection?.touchpointId); const intent = document.productJobIntents.find(item => item.id === selection?.productJobIntentId); const job = document.entities.find(entity => entity.id === intent?.jobId); return <p key={id}><strong>{touchpoint?.title}</strong><span>loses {job?.title}</span></p>; })}
                {productConfirmation.impact.narrowedTouchpointSelections.map(item => { const selection = document.touchpointJobSelections.find(candidate => candidate.id === item.touchpointJobSelectionId); const touchpoint = document.entities.find(entity => entity.id === selection?.touchpointId); return <p key={item.touchpointJobSelectionId}><strong>{touchpoint?.title}</strong><span>loses {item.removedDesiredOutcomeIds.map(id => document.entities.find(entity => entity.id === id)?.title).join(', ')}</span></p>; })}
              </div>
            )}
            <div className="actions">
              {productConfirmation.mode === 'dirty' ? <>
                <button type="button" className="primary" onClick={() => { pendingAfterApplyRef.current = productConfirmation.pending; setProductConfirmation(null); globalThis.document.querySelector<HTMLFormElement>('.inspector > form')?.requestSubmit(); }}>Apply</button>
                <button type="button" onClick={() => { const pending = productConfirmation.pending; setProductConfirmation(null); setEditDraft(selected ? draftFor(selected) : null); resetProductSession(selected); pending(); }}>Discard</button>
                <button type="button" onClick={closeProductConfirmation}>Keep editing</button>
              </> : <>
                <button type="button" onClick={closeProductConfirmation}>Cancel</button>
                <button type="button" className="primary" onClick={() => { productApplyBypassRef.current = true; setProductConfirmation(null); globalThis.document.querySelector<HTMLFormElement>('.inspector > form')?.requestSubmit(); }}>Apply changes</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
