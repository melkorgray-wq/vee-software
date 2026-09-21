import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode, useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { isRenderedTitleTruncated, MapNode, MapSpike, RELATION_EDITOR_SEARCH_THRESHOLD } from './MapSpike';
import { applyTouchpointIntentDraft, type MapDocument } from '@vee/domain';
import { parentTouchpointOptions } from '../map-interaction';

type MockNode = { id: string; position: { x: number; y: number }; selected?: boolean; className?: string; data: { title: string; kindLabel: string } };
type MockEdge = { id: string; source: string; target: string; type?: string; markerEnd?: { type: string }; label?: string };
const { setViewportSpy } = vi.hoisted(() => ({ setViewportSpy: vi.fn(() => Promise.resolve(true)) }));
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, edgeTypes, nodeTypes, tabIndex, disableKeyboardA11y, onInit, onNodeClick, onNodeDoubleClick, onNodeContextMenu, onPaneClick, onPaneContextMenu }: { nodes: MockNode[]; edges: MockEdge[]; edgeTypes?: Record<string, unknown>; nodeTypes?: Record<string, (props: { data: MockNode['data'] }) => ReactNode>; tabIndex?: number; disableKeyboardA11y?: boolean; onInit: (instance: object) => void; onNodeClick: (event: object, node: MockNode) => void; onNodeDoubleClick: (event: { preventDefault(): void; stopPropagation(): void }, node: MockNode) => void; onNodeContextMenu: (event: MouseEvent, node: MockNode) => void; onPaneClick: () => void; onPaneContextMenu: (event: MouseEvent) => void }) => { useEffect(() => onInit({ screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x: x - 10, y: y - 20 }), flowToScreenPosition: ({ x, y }: { x: number, y: number }) => ({ x: x + 10, y: y + 20 }), getViewport: () => ({ x: 0, y: 0, zoom: 1 }), setViewport: setViewportSpy }), [onInit]); const NodeComponent = nodeTypes?.mapNode; const geometry = (edge: MockEdge) => { const source = nodes.find(node => node.id === edge.source); const target = nodes.find(node => node.id === edge.target); return source && target ? `${source.position.x},${source.position.y}:${target.position.x},${target.position.y}` : 'dangling'; }; return <div aria-label="Map canvas" data-edge-types={Object.keys(edgeTypes ?? {}).join(',')} data-disable-keyboard-a11y={String(Boolean(disableKeyboardA11y))} tabIndex={tabIndex} onContextMenu={onPaneContextMenu}><button onClick={onPaneClick}>Clear selection</button>{nodes.map(node => <div key={node.id}><button aria-label={node.data.title} data-node-id={node.id} data-node-class={node.className} data-selected={String(Boolean(node.selected))} data-x={node.position.x} data-y={node.position.y} onClick={() => onNodeClick({}, node)} onDoubleClick={event => onNodeDoubleClick(event, node)} onContextMenu={e => { e.stopPropagation(); onNodeContextMenu(e, node); }}>{NodeComponent ? <NodeComponent data={node.data} /> : node.data.title}</button>{!NodeComponent && <span>{node.data.kindLabel}</span>}</div>)}{edges.map(edge => <span key={edge.id} data-source={edge.source} data-target={edge.target} data-geometry={geometry(edge)} data-marker={edge.markerEnd?.type} data-edge-type={edge.type} data-edge-class={(edge as MockEdge & { className?: string }).className}>{edge.label}</span>)}</div>; },
  BaseEdge: () => null, useInternalNode: () => undefined, useStore: () => [], Background: () => null, Controls: () => null, Handle: () => null, MarkerType: { ArrowClosed: 'arrowclosed' }, Position: { Left: 'left', Right: 'right' },
}));
vi.mock('../router', () => ({ Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a> }));

afterEach(() => {
  cleanup();
  delete window.__VEE_DEV__;
});

async function globalProduct(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.type(screen.getByLabelText('Title'), 'Orbit'); await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user); }
function contextualEditor(name: string) { return within(screen.getByRole('heading', { name }).closest('form')!); }
async function openInspector(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('tab', { name: 'Entity Inspector' })); return within(screen.getByRole('tabpanel', { name: 'Entity Inspector' })); }
async function openMap(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('tab', { name: 'Map' })); }
async function quickOffer(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Offer' })); const editor = contextualEditor('Add Offer'); await user.type(editor.getByLabelText('Title'), 'Subscription'); await user.click(editor.getByRole('button', { name: 'Create' })); }
function nodePoint(name: string) { const node = screen.getByRole('button', { name }); return { x: Number(node.getAttribute('data-x')), y: Number(node.getAttribute('data-y')) }; }
function nodesOverlap(a: { x: number; y: number }, aDiameter: number, b: { x: number; y: number }, bDiameter: number) { return a.x < b.x + bDiameter && a.x + aDiameter > b.x && a.y < b.y + bDiameter && a.y + aDiameter > b.y; }
function setTitleOverflow(title: HTMLElement, truncated: boolean) {
  Object.defineProperties(title, {
    clientHeight: { configurable: true, value: 30 },
    scrollHeight: { configurable: true, value: truncated ? 48 : 30 },
    clientWidth: { configurable: true, value: 65 },
    scrollWidth: { configurable: true, value: 65 },
  });
}
const nodeLayout = { diameter: 96, titleFontSize: 14, kindFontSize: 12, contentWidth: 65, compactTitle: true };
function RenameableMapNode({ initialTitle }: { initialTitle: string }) {
  const [title, setTitle] = useState(initialTitle);
  const [editing, setEditing] = useState(false);
  return <MapNode data={{ title, kindLabel: 'Product', layout: nodeLayout, ...(editing ? { inlineTitle: title, onInlineTitleCommit: (nextTitle: string) => { setTitle(nextTitle); setEditing(false); }, onInlineTitleCancel: () => setEditing(false) } : { onTitleDoubleClick: () => setEditing(true) }) }} />;
}

function touchpointInspectorDocument(twoOffers = false): MapDocument {
  const entities: MapDocument['entities'] = [
    { id: 'product', kind: 'product', title: 'Orbit' },
    { id: 'offer-a', kind: 'offer', title: 'Subscription' },
    ...(twoOffers ? [{ id: 'offer-b', kind: 'offer' as const, title: 'Consulting' }] : []),
    { id: 'touch', kind: 'touchpoint', title: 'Checkout' },
    { id: 'job', kind: 'core_functional_job', title: 'Make progress' },
    { id: 'do-a', kind: 'desired_outcome', title: 'Finish faster' },
    { id: 'do-b', kind: 'desired_outcome', title: 'Reduce errors' },
    { id: 'fdo', kind: 'financial_desired_outcome', title: 'Stay affordable' },
  ];
  const offerIds = twoOffers ? ['offer-a', 'offer-b'] : ['offer-a'];
  return {
    id: 'map', title: 'Map', views: [{ id: 'spike-view', title: 'View' }], entities,
    relationships: [
      { id: 'packages-a', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-a' },
      ...(twoOffers ? [{ id: 'packages-b', kind: 'product_packaged_as_offer' as const, productId: 'product', offerId: 'offer-b' }] : []),
      ...offerIds.map((offerId, index) => ({ id: `presents-${index}`, kind: 'offer_presented_at_touchpoint' as const, offerId, touchpointId: 'touch' })),
      { id: 'owns-a', kind: 'job_has_desired_outcome', jobId: 'job', desiredOutcomeId: 'do-a' },
      { id: 'owns-b', kind: 'job_has_desired_outcome', jobId: 'job', desiredOutcomeId: 'do-b' },
    ],
    productJobIntents: [], offerJobSelections: [], offerFinancialIntents: [], touchpointJobSelections: [], touchpointFinancialSelections: [],
    touchpointContainers: [], epistemicAnnotations: [], placements: entities.map((entity, index) => ({ viewId: 'spike-view', entityId: entity.id, x: index * 140, y: 0 })),
  };
}

function offerNeighborhoodDocument(): MapDocument {
  const document = touchpointInspectorDocument(true);
  document.entities.push(
    { id: 'offer-c', kind: 'offer', title: 'Advisory' },
    { id: 'product-other', kind: 'product', title: 'Other Product' },
    { id: 'offer-other', kind: 'offer', title: 'Unrelated Offer' },
  );
  document.relationships.push(
    { id: 'packages-c', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-c' },
    { id: 'packages-c-duplicate', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'offer-c' },
    { id: 'packages-other', kind: 'product_packaged_as_offer', productId: 'product-other', offerId: 'offer-other' },
  );
  document.placements.push(
    { viewId: 'spike-view', entityId: 'offer-c', x: 1120, y: 0 },
    { viewId: 'spike-view', entityId: 'product-other', x: 1260, y: 0 },
    { viewId: 'spike-view', entityId: 'offer-other', x: 1400, y: 0 },
  );
  return document;
}

function coPresentedOfferNeighborhoodDocument(): MapDocument {
  const document = offerNeighborhoodDocument();
  const addedEntities: MapDocument['entities'] = [
    { id: 'touch-a', kind: 'touchpoint', title: 'Alpha room' },
    { id: 'touch-a-2', kind: 'touchpoint', title: 'Alpha room' },
    { id: 'touch-empty', kind: 'touchpoint', title: 'Empty room' },
    { id: 'touch-parent', kind: 'touchpoint', title: 'Parent room' },
    { id: 'offer-shared', kind: 'offer', title: 'Shared Offer' },
    { id: 'offer-first-b', kind: 'offer', title: 'First Offer' },
    { id: 'offer-first-a', kind: 'offer', title: 'First Offer' },
  ];
  document.entities.push(...addedEntities);
  document.placements.push(...addedEntities.map((entity, index) => ({ viewId: 'spike-view', entityId: entity.id, x: 1540 + index * 140, y: 0 })));
  document.relationships.push(
    { id: 'selected-a', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touch-a' },
    { id: 'selected-a-duplicate', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touch-a' },
    { id: 'selected-a-2', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touch-a-2' },
    { id: 'selected-empty', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touch-empty' },
    { id: 'shared-a', kind: 'offer_presented_at_touchpoint', offerId: 'offer-shared', touchpointId: 'touch-a' },
    { id: 'shared-a-duplicate', kind: 'offer_presented_at_touchpoint', offerId: 'offer-shared', touchpointId: 'touch-a' },
    { id: 'shared-a-2', kind: 'offer_presented_at_touchpoint', offerId: 'offer-shared', touchpointId: 'touch-a-2' },
    { id: 'other-product-a', kind: 'offer_presented_at_touchpoint', offerId: 'offer-other', touchpointId: 'touch-a' },
    { id: 'first-b-a', kind: 'offer_presented_at_touchpoint', offerId: 'offer-first-b', touchpointId: 'touch-a' },
    { id: 'first-a-a', kind: 'offer_presented_at_touchpoint', offerId: 'offer-first-a', touchpointId: 'touch-a' },
    { id: 'dangling-offer', kind: 'offer_presented_at_touchpoint', offerId: 'missing-offer', touchpointId: 'touch-a' },
    { id: 'wrong-offer', kind: 'offer_presented_at_touchpoint', offerId: 'job', touchpointId: 'touch-a' },
    { id: 'dangling-touchpoint', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'missing-touchpoint' },
    { id: 'wrong-touchpoint', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'job' },
    { id: 'contains-only', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'touch-a', childTouchpointId: 'touch-parent' },
    { id: 'parent-neighbor', kind: 'offer_presented_at_touchpoint', offerId: 'offer-c', touchpointId: 'touch-parent' },
  );
  return document;
}

function multiKindClientScopeDocument(): MapDocument {
  const document = touchpointInspectorDocument();
  document.entities.push(
    { id: 'related', kind: 'related_job', title: 'Coordinate delivery' },
    { id: 'related-do', kind: 'desired_outcome', title: 'Avoid handoff delays' },
    { id: 'emotional', kind: 'emotional_job', title: 'Feel confident' },
  );
  document.placements.push(
    { viewId: 'spike-view', entityId: 'related', x: 1120, y: 0 },
    { viewId: 'spike-view', entityId: 'related-do', x: 1260, y: 0 },
    { viewId: 'spike-view', entityId: 'emotional', x: 1400, y: 0 },
  );
  document.relationships.push({ id: 'related-owns', kind: 'job_has_desired_outcome', jobId: 'related', desiredOutcomeId: 'related-do' });
  document.productJobIntents = [
    { id: 'core-intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] },
    { id: 'related-intent', productId: 'product', jobId: 'related', addressedDesiredOutcomeIds: ['related-do'] },
    { id: 'emotional-intent', productId: 'product', jobId: 'emotional', addressedDesiredOutcomeIds: [] },
  ];
  document.offerJobSelections = document.productJobIntents.map((intent, index) => ({ id: `offer-selection-${index}`, offerId: 'offer-a', productJobIntentId: intent.id }));
  document.touchpointJobSelections = [
    { id: 'core-path', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'core-intent', addressedDesiredOutcomeIds: ['do-a', 'do-b'] },
    { id: 'related-path', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'related-intent', addressedDesiredOutcomeIds: ['related-do'] },
    { id: 'emotional-path', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'emotional-intent', addressedDesiredOutcomeIds: [] },
  ];
  document.offerFinancialIntents = [{ id: 'financial-intent', offerId: 'offer-a', financialDesiredOutcomeId: 'fdo' }];
  document.touchpointFinancialSelections = [{ id: 'financial-path', touchpointId: 'touch', offerId: 'offer-a', offerFinancialIntentId: 'financial-intent', financialDesiredOutcomeId: 'fdo' }];
  return document;
}

function emptyCardinalSectorDocument(): MapDocument {
  const entities: MapDocument['entities'] = [
    { id: 'fp', kind: 'touchpoint', title: 'FP' },
    { id: 'team', kind: 'touchpoint', title: 'TEAM Offer' },
    { id: 'diagonal', kind: 'touchpoint', title: 'Diagonal neighbor' },
    { id: 'resistance', kind: 'repulsor', title: 'Repulsor' },
  ];
  return {
    id: 'keyboard-map', title: 'Keyboard map', views: [{ id: 'spike-view', title: 'View' }], entities,
    relationships: [
      { id: 'edge-a', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'fp', childTouchpointId: 'team' },
      { id: 'edge-b', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'fp', childTouchpointId: 'diagonal' },
      { id: 'resists', kind: 'repulsor_resists', repulsorId: 'resistance', targetEntityId: 'fp' },
    ],
    productJobIntents: [], offerJobSelections: [], offerFinancialIntents: [], touchpointJobSelections: [], touchpointFinancialSelections: [],
    touchpointContainers: [], epistemicAnnotations: [], placements: [
      { viewId: 'spike-view', entityId: 'fp', x: 100, y: 200 },
      { viewId: 'spike-view', entityId: 'team', x: 500, y: 200 },
      { viewId: 'spike-view', entityId: 'diagonal', x: 500, y: 400 },
      { viewId: 'spike-view', entityId: 'resistance', x: 700, y: 200 },
    ],
  };
}

function renderTouchpointInspector(document = touchpointInspectorDocument()) {
  render(<MapSpike initialDocument={document} />);
  fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Entity Inspector' }));
  return within(screen.getByRole('tabpanel', { name: 'Entity Inspector' }));
}

function resistanceDocument(): MapDocument {
  const document = touchpointInspectorDocument();
  document.entities.push(
    { id: 'repulsor-job', kind: 'repulsor', title: 'Job resistance' },
    { id: 'fdo', kind: 'financial_desired_outcome', title: 'Stay affordable' },
    { id: 'repulsor-financial', kind: 'repulsor', title: 'Financial resistance' },
  );
  document.relationships.push(
    { id: 'resists-job', kind: 'repulsor_resists', repulsorId: 'repulsor-job', targetEntityId: 'job' },
    { id: 'resists-financial', kind: 'repulsor_resists', repulsorId: 'repulsor-financial', targetEntityId: 'fdo' },
  );
  document.productJobIntents = [{ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a'] }];
  document.offerJobSelections = [{ id: 'offer-job', offerId: 'offer-a', productJobIntentId: 'intent' }];
  document.offerFinancialIntents = [{ id: 'offer-financial', offerId: 'offer-a', financialDesiredOutcomeId: 'fdo' }];
  document.touchpointJobSelections = [{ id: 'touch-job', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] }];
  document.touchpointFinancialSelections = [{ id: 'touch-financial', touchpointId: 'touch', offerId: 'offer-a', offerFinancialIntentId: 'offer-financial', financialDesiredOutcomeId: 'fdo' }];
  document.placements.push(
    { viewId: 'spike-view', entityId: 'repulsor-job', x: 1000, y: 0 },
    { viewId: 'spike-view', entityId: 'fdo', x: 1140, y: 0 },
    { viewId: 'spike-view', entityId: 'repulsor-financial', x: 1280, y: 0 },
  );
  return document;
}

describe('Touchpoint Resistance section', () => {
  afterEach(cleanup);

  it('is always present with a compact empty state and no completion action', () => {
    const inspector = renderTouchpointInspector();
    const resistance = within(inspector.getByRole('region', { name: 'Resistance' }));
    expect(resistance.getByText('No relevant Repulsors.')).toBeInTheDocument();
    expect(resistance.queryByRole('button', { name: /Apply|Save|Done/i })).not.toBeInTheDocument();
  });

  it('shows Job and Financial exposures as Derived and commits each checkbox immediately', async () => {
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector(resistanceDocument());
    const resistance = within(inspector.getByRole('region', { name: 'Resistance' }));
    expect(resistance.getAllByText('Derived')).toHaveLength(2);
    for (const badge of resistance.getAllByText('Derived')) expect(badge).toHaveClass('touchpoint-resistance-derived');
    expect(resistance.getByRole('button', { name: 'Job resistance' })).toHaveClass('inspector-entity-navigation');
    expect(resistance.getByRole('button', { name: 'Financial resistance' })).toBeInTheDocument();
    const checkbox = resistance.getByRole('checkbox', { name: 'Job resistance: Mitigated here' });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(window.__VEE_DEV__!.dump().relationships.filter(relation => relation.kind === 'touchpoint_mitigates_repulsor')).toEqual([
      expect.objectContaining({ touchpointId: 'touch', repulsorId: 'repulsor-job' }),
    ]);
    expect(inspector.queryByRole('button', { name: 'Apply changes' })).not.toBeInTheDocument();
    expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
    await user.click(checkbox);
    expect(window.__VEE_DEV__!.dump().relationships.some(relation => relation.kind === 'touchpoint_mitigates_repulsor')).toBe(false);
  });

  it('renders an existing mitigation checked and keeps title navigation independent', async () => {
    const user = userEvent.setup(); const document = resistanceDocument();
    document.relationships.push({ id: 'mitigates-job', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor-job' });
    const inspector = renderTouchpointInspector(document);
    const resistance = within(inspector.getByRole('region', { name: 'Resistance' }));
    const checkbox = resistance.getByRole('checkbox', { name: 'Job resistance: Mitigated here' });
    expect(checkbox).toBeChecked();
    await user.click(resistance.getByRole('button', { name: 'Job resistance' }));
    expect(checkbox).not.toBeInTheDocument();
    expect(window.__VEE_DEV__!.dump().relationships).toContainEqual(expect.objectContaining({ id: 'mitigates-job' }));
  });
});

function relationLensDocument(multiple = false): MapDocument {
  const document = touchpointInspectorDocument();
  if (multiple) {
    document.entities.push({ id: 'job-2', kind: 'core_functional_job', title: 'Second job' });
    document.placements.push({ viewId: 'spike-view', entityId: 'job-2', x: 900, y: 0 });
  }
  document.productJobIntents = [
    { id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] },
    ...(multiple ? [{ id: 'intent-2', productId: 'product', jobId: 'job-2', addressedDesiredOutcomeIds: [] }] : []),
  ];
  document.offerJobSelections = [{ id: 'offer-selection', offerId: 'offer-a', productJobIntentId: 'intent' }];
  document.touchpointJobSelections = [{ id: 'touch-selection', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] }];
  return document;
}

function replacementDocument(): MapDocument {
  return {
    id: 'replacement-map', title: 'Replacement map',
    entities: [{ id: 'replacement', kind: 'product', title: 'Replacement Product' }],
    relationships: [], productJobIntents: [], offerJobSelections: [], offerFinancialIntents: [],
    touchpointJobSelections: [], touchpointFinancialSelections: [], touchpointContainers: [],
    epistemicAnnotations: [], views: [{ id: 'spike-view', title: 'View' }],
    placements: [{ viewId: 'spike-view', entityId: 'replacement', x: 321, y: 654 }],
  };
}

describe('temporary DEV Map bridge owner integration', () => {
  it('loads visible entities and placements while clearing stale document interaction state', async () => {
    const user = userEvent.setup();
    const initial = touchpointInspectorDocument(true);
    initial.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a'] });
    initial.offerJobSelections.push({ id: 'offer-selection', offerId: 'offer-a', productJobIntentId: 'intent' });
    render(<MapSpike initialDocument={initial} />);
    const checkoutNode = screen.getByRole('button', { name: 'Checkout' });
    await user.click(checkoutNode);
    const inspector = await openInspector(user);
    await user.click(inspector.getByRole('button', { name: 'Edit title, Checkout' }));
    await user.clear(inspector.getByRole('textbox', { name: 'Edit title, Checkout' }));
    await user.type(inspector.getByRole('textbox', { name: 'Edit title, Checkout' }), 'Stale checkout draft');
    await user.click(inspector.getByRole('button', { name: 'Edit linked Offers' }));
    await user.keyboard('{Escape}');
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.click(inspector.getByRole('button', { name: 'Offer · Subscription' }));

    act(() => window.__VEE_DEV__!.load(replacementDocument()));

    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Select an entity on the Map to inspect it.')).toBeInTheDocument();
    expect(screen.queryByText('Stale checkout draft')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Checkout' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await openMap(user);
    expect(screen.getByRole('button', { name: 'Replacement Product' })).toHaveAttribute('data-x', '321');
    expect(screen.getByRole('button', { name: 'Replacement Product' })).toHaveAttribute('data-y', '654');

    act(() => window.__VEE_DEV__!.load(initial));
    await user.click(screen.getByRole('button', { name: 'Checkout' }));
    const reloadedInspector = await openInspector(user);
    await user.click(reloadedInspector.getByRole('button', { name: 'Edit Client scope' }));
    expect(reloadedInspector.getByRole('button', { name: 'Offer · Subscription' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('dumps the latest durable UI document without transient editor state', async () => {
    const user = userEvent.setup();
    render(<MapSpike />);
    await globalProduct(user);
    await user.click(screen.getByRole('button', { name: 'Orbit' }));
    const inspector = await openInspector(user);
    await user.click(inspector.getByRole('button', { name: 'Edit title, Orbit' }));
    await user.type(inspector.getByRole('textbox', { name: 'Edit title, Orbit' }), ' transient');

    const dumped = window.__VEE_DEV__!.dump();
    expect(dumped.entities).toContainEqual(expect.objectContaining({ title: 'Orbit' }));
    expect(dumped.placements.some(placement => placement.entityId === dumped.entities.find(entity => entity.title === 'Orbit')?.id)).toBe(true);
    expect(dumped).not.toHaveProperty('selectedId');
    expect(dumped).not.toHaveProperty('editDraft');
    expect(dumped).not.toHaveProperty('menu');
  });

  it('keeps StrictMode and overlapping mount cleanup ownership-safe', () => {
    const first = render(<StrictMode><MapSpike initialDocument={touchpointInspectorDocument()} /></StrictMode>);
    const firstBridge = window.__VEE_DEV__;
    const second = render(<StrictMode><MapSpike initialDocument={replacementDocument()} /></StrictMode>);
    const secondBridge = window.__VEE_DEV__;
    expect(secondBridge).not.toBe(firstBridge);
    expect(secondBridge!.dump().id).toBe('replacement-map');

    first.unmount();
    expect(window.__VEE_DEV__).toBe(secondBridge);
    second.unmount();
    expect(window.__VEE_DEV__).toBeUndefined();

    const remounted = render(<StrictMode><MapSpike initialDocument={touchpointInspectorDocument()} /></StrictMode>);
    expect(window.__VEE_DEV__!.dump().id).toBe('map');
    remounted.unmount();
    expect(window.__VEE_DEV__).toBeUndefined();
  });
});

describe('clickable satellite Relation Lens', () => {
  afterEach(cleanup);
  it('clicking a single-target primary satellite enters its concrete Relations focus and toggles off without selecting a synthetic ID', async () => {
    const user = userEvent.setup(); render(<MapSpike initialDocument={relationLensDocument()} />);
    const primary = document.querySelector<HTMLElement>('[data-node-id="satellite:product:core_functional_job"]')!;
    await user.click(primary);
    expect(screen.getByRole('listbox', { name: 'Core Functional Job relation targets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stay affordable' })).toHaveAttribute('data-node-class', expect.stringContaining('relation-lens-dimmed'));
    expect(primary).toHaveAttribute('data-selected', 'false');
    expect(document.querySelector('[data-node-id="satellite:job:offer"]')).toHaveAttribute('data-node-class', expect.stringContaining('relation-lens-dimmed'));
    await user.click(primary);
    expect(screen.getByRole('button', { name: 'Stay affordable' })).not.toHaveAttribute('data-node-class', expect.stringContaining('relation-lens-dimmed'));
  });

  it('clicking a multi-target satellite focuses its group without premature lens and pointer selection reuses target state', async () => {
    const user = userEvent.setup(); render(<MapSpike initialDocument={relationLensDocument(true)} />);
    await user.click(document.querySelector<HTMLElement>('[data-node-id="satellite:product:core_functional_job"]')!);
    expect(screen.getByRole('button', { name: 'Stay affordable' })).not.toHaveAttribute('data-node-class', expect.stringContaining('relation-lens-dimmed'));
    await user.click(screen.getByRole('option', { name: 'Make progress' }));
    expect(screen.getByRole('option', { name: 'Make progress' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Stay affordable' })).toHaveAttribute('data-node-class', expect.stringContaining('relation-lens-dimmed'));
    await user.click(screen.getByRole('button', { name: 'Stay affordable' }));
    expect(screen.queryByRole('listbox', { name: 'Core Functional Job relation targets' })).not.toBeInTheDocument();
  });

  it('temporary DO child satellite is not a lens entry point and satellite double-click does not open Inspector', async () => {
    const user = userEvent.setup(); render(<MapSpike initialDocument={relationLensDocument()} />);
    const primary = document.querySelector<HTMLElement>('[data-node-id="satellite:product:core_functional_job"]')!; await user.click(primary);
    const child = document.querySelector<HTMLElement>('[data-node-id="satellite-child:product:job:do-a"]')!; await user.click(child);
    expect(screen.getByRole('listbox', { name: 'Core Functional Job relation targets' })).toBeInTheDocument();
    await user.dblClick(primary);
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Touchpoint Business structure Inspector', () => {
  afterEach(cleanup);
  function structureDocument() {
    const document = touchpointInspectorDocument(true);
    document.touchpointContainers = [{ id: 'web', title: 'Website' }];
    const touch = document.entities.find(entity => entity.id === 'touch')!;
    Object.assign(touch, { locatedInId: 'web', url: 'https://example.com/checkout' });
    document.entities.push(
      { id: 'parent', kind: 'touchpoint', title: 'Front Page', locatedInId: 'web' },
      { id: 'child', kind: 'touchpoint', title: 'FAQ' },
      { id: 'other', kind: 'touchpoint', title: 'About', locatedInId: 'web' },
    );
    document.placements.push(
      { viewId: 'spike-view', entityId: 'parent', x: 1200, y: 0 },
      { viewId: 'spike-view', entityId: 'child', x: 1340, y: 0 },
      { viewId: 'spike-view', entityId: 'other', x: 1480, y: 0 },
    );
    document.relationships.push(
      { id: 'parent-touch', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'parent', childTouchpointId: 'touch' },
      { id: 'touch-child', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'touch', childTouchpointId: 'child' },
      { id: 'other-offer', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'other' },
    );
    return document;
  }
  function oneOfferChildrenDocument() {
    const document = structureDocument();
    document.relationships = document.relationships.filter(relation => !(relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId === 'touch' && relation.offerId === 'offer-b'));
    return document;
  }
  function neighborhoodDocument(counts: number[], duplicateFirstTouchpoint = false) {
    const document = touchpointInspectorDocument();
    document.entities = document.entities.filter(entity => entity.kind !== 'offer' || entity.id === 'offer-a');
    document.relationships = document.relationships.filter(relation => relation.kind !== 'offer_presented_at_touchpoint' && relation.kind !== 'product_packaged_as_offer');
    counts.forEach((count, groupIndex) => {
      const offerId = groupIndex === 0 ? 'offer-a' : `offer-${groupIndex}`;
      if (groupIndex > 0) {
        document.entities.push({ id: offerId, kind: 'offer', title: `Offer ${groupIndex + 1}` });
        document.placements.push({ viewId: 'spike-view', entityId: offerId, x: 900 + groupIndex * 140, y: 140 });
      }
      document.relationships.push({ id: `selected-${offerId}`, kind: 'offer_presented_at_touchpoint', offerId, touchpointId: 'touch' });
      for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
        const touchpointId = duplicateFirstTouchpoint && itemIndex === 0 ? 'shared-neighbor' : `neighbor-${groupIndex}-${itemIndex}`;
        if (!document.entities.some(entity => entity.id === touchpointId)) {
          document.entities.push({ id: touchpointId, kind: 'touchpoint', title: duplicateFirstTouchpoint && itemIndex === 0 ? 'Shared neighbor' : `Neighbor ${groupIndex + 1}.${itemIndex + 1}` });
          document.placements.push({ viewId: 'spike-view', entityId: touchpointId, x: 900 + groupIndex * 140, y: 300 + itemIndex * 140 });
        }
        document.relationships.push({ id: `related-${groupIndex}-${itemIndex}`, kind: 'offer_presented_at_touchpoint', offerId, touchpointId });
      }
    });
    return document;
  }

  it('Touchpoint Inspector renders Business structure before the remaining legacy fields', () => {
    const inspector = renderTouchpointInspector(structureDocument());
    const structure = inspector.getByRole('region', { name: 'Business structure' });
    const identity = inspector.getByRole('heading', { name: 'Checkout' }).closest('.inspector-identity')!;
    const history = inspector.getByRole('navigation', { name: 'Inspector history' });
    expect(inspector.getByRole('heading', { name: 'Entity Inspector' })).toBeInTheDocument();
    expect(identity).toHaveTextContent('Touchpoint · Business side');
    expect(identity.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inspector.getByRole('button', { name: 'Inspector Back' })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Inspector Forward' })).toBeInTheDocument();
    expect(inspector.queryByLabelText('Parent Touchpoint')).not.toBeInTheDocument();
    expect(inspector.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(inspector.queryByRole('textbox', { name: 'URL' })).not.toBeInTheDocument();
    expect(inspector.queryByRole('group', { name: 'Relevant Repulsors (derived)' })).not.toBeInTheDocument();
    expect(inspector.queryByRole('combobox', { name: 'Located in' })).not.toBeInTheDocument();
    expect(within(structure).getByText('Website')).toBeInTheDocument();
    expect(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' })).toBeInTheDocument();
  });

  it('edits the durable Inspector title by pointer and keyboard without a legacy form field', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    expect(inspector.queryByLabelText('Title')).not.toBeInTheDocument();
    const button = inspector.getByRole('button', { name: 'Edit title, Checkout' });
    await user.click(button);
    let editor = inspector.getByRole('textbox', { name: 'Edit title, Checkout' });
    expect(editor).toHaveFocus(); expect(editor).toHaveValue('Checkout');
    await user.clear(editor); await user.type(editor, 'Checkout renamed{Enter}');
    expect(inspector.getByRole('heading', { name: 'Checkout renamed' })).toBeInTheDocument();
    await vi.waitFor(() => expect(inspector.getByRole('button', { name: 'Edit title, Checkout renamed' })).toHaveFocus());
    expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
    await openMap(user); expect(screen.getByRole('button', { name: 'Checkout renamed' })).toBeInTheDocument(); await openInspector(user);

    const keyboardButton = inspector.getByRole('button', { name: 'Edit title, Checkout renamed' });
    keyboardButton.focus(); await user.keyboard(' ');
    editor = inspector.getByRole('textbox', { name: 'Edit title, Checkout renamed' });
    await user.clear(editor); await user.type(editor, 'Cancelled'); fireEvent.keyDown(editor, { key: 'Escape' });
    expect(inspector.getByRole('heading', { name: 'Checkout renamed' })).toBeInTheDocument();
    await vi.waitFor(() => expect(inspector.getByRole('button', { name: 'Edit title, Checkout renamed' })).toHaveFocus());

    await user.click(inspector.getByRole('button', { name: 'Edit title, Checkout renamed' }));
    editor = inspector.getByRole('textbox', { name: 'Edit title, Checkout renamed' }); await user.clear(editor); fireEvent.blur(editor);
    expect(editor).toBeInTheDocument(); await vi.waitFor(() => expect(editor).toHaveFocus());
    await user.type(editor, 'Blur committed'); fireEvent.blur(editor);
    expect(inspector.getByRole('heading', { name: 'Blur committed' })).toBeInTheDocument();
  });

  it('renders upstream ancestry in the Touchpoint header before Placement, Containment, and Neighborhood', () => {
    const inspector = renderTouchpointInspector(structureDocument());
    const identity = inspector.getByRole('heading', { name: 'Checkout' }).closest<HTMLElement>('.inspector-identity')!;
    const lineage = within(identity).getByLabelText('Business lineage');
    const region = inspector.getByRole('region', { name: 'Business structure' });
    const placement = within(region).getByRole('region', { name: 'Placement' });
    const containment = within(region).getByRole('region', { name: 'Containment' });
    const neighborhood = within(region).getByText('Neighborhood').closest<HTMLElement>('.business-structure-derived')!;
    expect(within(region).queryByRole('heading', { name: 'Business structure' })).not.toBeInTheDocument();
    expect(within(lineage).getByLabelText('Orbit to Subscription')).toHaveTextContent('Orbit→Subscription');
    expect(within(lineage).getByLabelText('Orbit to Consulting')).toHaveTextContent('Orbit→Consulting');
    expect(lineage).not.toHaveTextContent('Checkout');
    expect(within(region).queryByText('Business ancestry')).not.toBeInTheDocument();
    expect(within(region).queryByText(/^Structure$/)).not.toBeInTheDocument();
    expect(placement.compareDocumentPosition(containment) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(placement.compareDocumentPosition(neighborhood) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(containment.compareDocumentPosition(neighborhood) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const label of ['Offers', 'Located in', 'URL']) expect(within(placement).getByRole('heading', { name: label })).toBeInTheDocument();
    for (const label of ['Parent', 'Children']) expect(within(containment).getByRole('heading', { name: label })).toBeInTheDocument();
    const offers = within(within(placement).getByRole('group', { name: 'Offers property' }));
    expect(offers.getAllByRole('button').map(button => button.firstChild?.textContent)).toEqual(['Offers', 'Consulting', 'Subscription']);
    expect(offers.getAllByRole('button', { name: 'Edit linked Offers' })).toHaveLength(1);
    expect(within(placement).getByRole('button', { name: 'Edit Located in, Website' })).toBeInTheDocument();
    expect(within(containment).getByRole('button', { name: 'Front Page' })).toBeInTheDocument();
    expect(within(containment).getByRole('button', { name: 'FAQ' })).toBeInTheDocument();
    expect(within(placement).getByRole('button', { name: 'Edit web address' })).toBeInTheDocument();
  });

  it('keeps ancestry branches from different Products distinct', () => {
    const document = structureDocument();
    document.entities.push({ id: 'product-b', kind: 'product', title: 'Website' });
    document.placements.push({ viewId: 'spike-view', entityId: 'product-b', x: 1620, y: 0 });
    const consultingRelation = document.relationships.find(relation => relation.id === 'packages-b');
    if (consultingRelation?.kind === 'product_packaged_as_offer') consultingRelation.productId = 'product-b';
    const lineage = renderTouchpointInspector(document).getByLabelText('Business lineage');
    expect(within(lineage).getByLabelText('Orbit to Subscription')).toBeInTheDocument();
    expect(within(lineage).getByLabelText('Website to Consulting')).toBeInTheDocument();
  });

  it('omits contextual lineage when no complete Product and Offer ancestry exists', () => {
    const document = structureDocument();
    document.relationships = document.relationships.filter(relation => relation.kind !== 'product_packaged_as_offer');
    expect(renderTouchpointInspector(document).queryByLabelText('Business lineage')).not.toBeInTheDocument();
  });

  it('uses compact markers for empty direct and derived Business structure values', () => {
    const document = structureDocument();
    const touch = document.entities.find(entity => entity.id === 'touch')!;
    Object.assign(touch, { locatedInId: undefined, url: undefined });
    document.relationships = document.relationships.filter(relation =>
      relation.kind !== 'touchpoint_contains_touchpoint' &&
      !(relation.kind === 'offer_presented_at_touchpoint' && relation.touchpointId !== 'touch'),
    );
    const structure = within(renderTouchpointInspector(document).getByRole('region', { name: 'Business structure' }));
    expect(structure.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(structure.getByRole('button', { name: 'Add location' })).toBeInTheDocument();
    expect(structure.getByRole('button', { name: 'Add URL' })).toBeInTheDocument();
    expect(structure.queryByText('Not specified')).not.toBeInTheDocument();
    expect(structure.queryByText('None')).not.toBeInTheDocument();
    expect(structure.getByText('Derived')).toBeInTheDocument();
    expect(within(structure.getByRole('group', { name: 'Other Touchpoints for Subscription' })).getByRole('button')).toHaveAccessibleName('Other Touchpoints for Subscription, 0 Touchpoints');
    expect(within(structure.getByRole('group', { name: 'Other Touchpoints for Consulting' })).getByRole('button')).toHaveAccessibleName('Other Touchpoints for Consulting, 0 Touchpoints');
    expect(structure.queryByText(/^More in /)).not.toBeInTheDocument();
  });

  it('Product Offer parent child and derived Touchpoint controls navigate through existing Inspector navigation', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    for (const [name, heading] of [['Orbit', 'Orbit'], ['Subscription', 'Subscription'], ['Front Page', 'Front Page'], ['FAQ', 'FAQ']] as const) {
      await user.click(inspector.getAllByRole('button', { name })[0]!);
      expect(inspector.getByRole('heading', { name: heading })).toBeInTheDocument();
      await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    }
    await user.click(inspector.getByRole('button', { name: 'Other Touchpoints for Subscription, 1 Touchpoints' }));
    await user.click(inspector.getByRole('button', { name: 'About' }));
    expect(inspector.getByRole('heading', { name: 'About' })).toBeInTheDocument();
  });

  it('Located in is displayed as container information, not fake Entity navigation', () => {
    const structure = within(renderTouchpointInspector(structureDocument()).getByRole('region', { name: 'Business structure' }));
    const edit = structure.getByRole('button', { name: 'Edit Located in, Website' });
    expect(edit).toHaveTextContent('Website');
    expect(edit).not.toHaveTextContent('✎');
    expect(structure.getByRole('button', { name: 'Edit Located in' })).not.toBe(edit);
  });

  it('keeps a safe Touchpoint URL in one external-link surface separate from its heading action', async () => {
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector(structureDocument());
    const structure = within(inspector.getByRole('region', { name: 'Business structure' }));
    const edit = structure.getByRole('button', { name: 'Edit web address' });
    const externalLink = inspector.getByRole('link', { name: 'https://example.com/checkout' });
    expect(externalLink).toHaveAttribute('href', 'https://example.com/checkout');
    expect(externalLink).toHaveAttribute('target', '_blank');
    expect(edit).not.toHaveTextContent('✎');
    expect(externalLink).toHaveAttribute('rel', 'noreferrer');
    expect(externalLink).toHaveTextContent('https://example.com/checkout');
    expect(externalLink).not.toHaveTextContent('↗');
    expect(externalLink.parentElement?.querySelector('.business-structure-external-indicator')).not.toBeInTheDocument();
    expect(externalLink.closest('[role="tabpanel"]')?.querySelectorAll('a[href="https://example.com/checkout"]')).toHaveLength(1);
    expect(inspector.queryByRole('link', { name: 'Open Checkout' })).not.toBeInTheDocument();
    expect(inspector.queryByText('Open Checkout')).not.toBeInTheDocument();
    expect(externalLink).not.toHaveClass('inspector-entity-navigation');
    expect(edit).not.toContainElement(externalLink);
    expect(externalLink.closest('button')).toBeNull();
    expect(externalLink).not.toHaveTextContent('✎');

    externalLink.addEventListener('click', event => event.preventDefault(), { once: true });
    await user.click(externalLink);
    expect(inspector.queryByRole('textbox', { name: 'Edit web address' })).not.toBeInTheDocument();
    await user.click(edit);
    expect(structure.getByRole('textbox', { name: 'Edit web address' })).toHaveValue('https://example.com/checkout');
  });

  it('uses the shared heading action for every editable read-state property', () => {
    const structure = within(renderTouchpointInspector(structureDocument()).getByRole('region', { name: 'Business structure' }));
    expect(structure.queryByText('✎')).not.toBeInTheDocument();
    for (const [property, heading, action] of [['Offers', 'Offers', 'Edit linked Offers'], ['Located in', 'Located in', 'Edit Located in'], ['Web address', 'URL', 'Edit web address'], ['Parent', 'Parent', 'Edit parent Touchpoint'], ['Children', 'Children', 'Edit Children']] as const) {
      const group = structure.getByRole('group', { name: `${property} property` });
      const semanticHeading = within(group).getByRole('heading', { name: heading });
      const headingButton = within(group).getByRole('button', { name: action });
      expect(semanticHeading).toContainElement(headingButton);
      expect(headingButton).toHaveClass('inspector-property-heading-action');
      expect(headingButton).not.toHaveTextContent('✎');
    }
    for (const name of ['Subscription', 'Consulting', 'Front Page', 'FAQ']) {
      expect(structure.getAllByRole('button', { name }).every(button => !button.querySelector('.business-structure-edit-affordance'))).toBe(true);
    }
  });

  it('uses one non-interactive edit hint in every read-state heading action', () => {
    const inspector = renderTouchpointInspector(structureDocument());
    const actions = [
      inspector.getByRole('button', { name: 'Edit linked Offers' }),
      inspector.getByRole('button', { name: 'Edit parent Touchpoint' }),
      inspector.getByRole('button', { name: 'Edit Located in' }),
      inspector.getByRole('button', { name: 'Edit web address' }),
      inspector.getByRole('button', { name: 'Edit Children' }),
      inspector.getByRole('button', { name: 'Edit Client scope' }),
    ];

    expect(inspector.queryByRole('button', { name: 'Click to edit' })).not.toBeInTheDocument();
    for (const action of actions) {
      expect(action).toHaveClass('inspector-property-heading-action');
      expect(action).not.toHaveTextContent('✎');
      expect(action).not.toHaveAccessibleName('Click to edit');
      const hints = action.querySelectorAll('.inspector-property-heading-hint');
      expect(hints).toHaveLength(1);
      expect(hints[0]).toHaveTextContent('Click to edit');
      expect(hints[0]).toHaveAttribute('aria-hidden', 'true');
      expect(hints[0]).not.toHaveAttribute('role');
      expect(hints[0]).not.toHaveAttribute('tabindex');
    }
  });

  it('returns focus to Edit linked Offers after the explicit Close button', async () => {
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector(structureDocument());
    const offers = within(inspector.getByRole('group', { name: 'Offers property' }));
    const edit = offers.getByRole('button', { name: 'Edit linked Offers' });
    expect(edit).toHaveTextContent('Offers');
    expect(edit).not.toHaveTextContent('✎');
    expect(edit).toHaveClass('inspector-property-heading-action');

    await user.click(edit);
    expect(offers.queryByRole('searchbox', { name: 'Search Offers' })).not.toBeInTheDocument();
    expect(offers.getByRole('checkbox', { name: 'Subscription' })).toHaveFocus();
    await user.click(offers.getByRole('button', { name: 'Close' }));
    await vi.waitFor(() => expect(offers.getByRole('button', { name: 'Edit linked Offers' })).toHaveFocus());
  });

  it('keeps Offer navigation outside the Offers heading action', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    const offers = inspector.getByRole('group', { name: 'Offers property' });
    const headingAction = within(offers).getByRole('button', { name: 'Edit linked Offers' });
    const subscription = within(offers).getByRole('button', { name: 'Subscription' });
    expect(headingAction).not.toContainElement(subscription);
    await user.click(subscription);
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    expect(inspector.queryByLabelText('Linked Offers editor')).not.toBeInTheDocument();
  });

  it('returns focus to the remounted Offers heading action after Escape', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    const offers = within(inspector.getByRole('group', { name: 'Offers property' }));
    await user.click(offers.getByRole('button', { name: 'Edit linked Offers' }));
    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(offers.getByRole('button', { name: 'Edit linked Offers' })).toHaveFocus());
    expect(offers.queryByLabelText('Linked Offers editor')).not.toBeInTheDocument();
  });

  it('preserves an immediate Offer commit across pointer dismissal without completion actions', async () => {
    const user = userEvent.setup(); const document = structureDocument();
    document.relationships = document.relationships.filter(relation => relation.kind !== 'offer_presented_at_touchpoint' || relation.offerId !== 'offer-b' || relation.touchpointId !== 'touch');
    const inspector = renderTouchpointInspector(document); const offers = within(inspector.getByRole('group', { name: 'Offers property' }));
    await user.click(offers.getByRole('button', { name: 'Edit linked Offers' }));
    const rowLabel = offers.getByText('Consulting').closest('label')!;
    await user.click(rowLabel.querySelector('span:last-child')!);
    expect(offers.getByRole('checkbox', { name: 'Consulting' })).toBeChecked();
    expect(window.__VEE_DEV__!.dump().relationships).toContainEqual(expect.objectContaining({ kind: 'offer_presented_at_touchpoint', offerId: 'offer-b', touchpointId: 'touch' }));
    const editor = offers.getByLabelText('Linked Offers editor');
    for (const name of ['Apply', 'Save', 'Done']) expect(within(editor).queryByRole('button', { name })).not.toBeInTheDocument();
    expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
    await user.click(inspector.getByRole('heading', { name: 'Placement' }));
    expect(offers.queryByLabelText('Linked Offers editor')).not.toBeInTheDocument();
    expect(window.__VEE_DEV__!.dump().relationships).toContainEqual(expect.objectContaining({ kind: 'offer_presented_at_touchpoint', offerId: 'offer-b', touchpointId: 'touch' }));
    expect(offers.getByRole('button', { name: 'Edit linked Offers' })).not.toHaveFocus();
  });

  it('lets an outside focusable control retain focus after pointer dismissal', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    const offers = within(inspector.getByRole('group', { name: 'Offers property' }));
    await user.click(offers.getByRole('button', { name: 'Edit linked Offers' }));
    const outsideButton = screen.getByRole('tab', { name: 'Entity Inspector' });
    await user.click(outsideButton);
    expect(offers.queryByLabelText('Linked Offers editor')).not.toBeInTheDocument();
    expect(outsideButton).toHaveFocus();
    expect(offers.getByRole('button', { name: 'Edit linked Offers' })).not.toHaveFocus();
  });

  it('does not force focus to the old pencil after non-focusable pointer dismissal', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    const offers = within(inspector.getByRole('group', { name: 'Offers property' }));
    await user.click(offers.getByRole('button', { name: 'Edit linked Offers' }));
    fireEvent.pointerDown(inspector.getByRole('heading', { name: 'Placement' }));
    expect(offers.queryByLabelText('Linked Offers editor')).not.toBeInTheDocument();
    expect(offers.getByRole('button', { name: 'Edit linked Offers' })).not.toHaveFocus();
  });

  it('switches from Offers to the Parent candidate flow without focusing the old pencil', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    const offers = within(inspector.getByRole('group', { name: 'Offers property' })); const parent = within(inspector.getByRole('group', { name: 'Parent property' }));
    await user.click(offers.getByRole('button', { name: 'Edit linked Offers' }));
    await user.click(parent.getByRole('button', { name: 'Edit parent Touchpoint' }));
    expect(parent.queryByRole('searchbox', { name: 'Search Touchpoints' })).not.toBeInTheDocument();
    expect(parent.getAllByRole('radio')[0]).toHaveFocus();
    expect(offers.getByRole('button', { name: 'Edit linked Offers' })).not.toHaveFocus();
  });

  it('switches from Parent to a threshold-sized searchable Offers flow without focusing the old pencil', async () => {
    const user = userEvent.setup(); const document = structureDocument();
    const offerCount = document.entities.filter(entity => entity.kind === 'offer').length;
    for (let index = offerCount; index < RELATION_EDITOR_SEARCH_THRESHOLD; index += 1) {
      document.entities.push({ id: `extra-offer-${index}`, kind: 'offer', title: `Extra Offer ${index}` });
    }
    const inspector = renderTouchpointInspector(document);
    const offers = within(inspector.getByRole('group', { name: 'Offers property' })); const parent = within(inspector.getByRole('group', { name: 'Parent property' }));
    await user.click(parent.getByRole('button', { name: 'Edit parent Touchpoint' }));
    await user.click(offers.getByRole('button', { name: 'Edit linked Offers' }));
    expect(parent.queryByLabelText('Parent Touchpoint editor')).not.toBeInTheDocument();
    expect(offers.getByRole('searchbox', { name: 'Search Offers' })).toHaveFocus();
    expect(parent.getByRole('button', { name: 'Edit parent Touchpoint' })).not.toHaveFocus();
    for (const name of ['Apply', 'Save', 'Done', 'Cancel']) expect(within(offers.getByLabelText('Linked Offers editor')).queryByRole('button', { name })).not.toBeInTheDocument();
  });

  it('uses the same Offers heading control with the empty value projection', () => {
    const document = structureDocument();
    document.relationships = document.relationships.filter(relation => relation.kind !== 'offer_presented_at_touchpoint' || relation.touchpointId !== 'touch');
    const offers = within(renderTouchpointInspector(document).getByRole('group', { name: 'Offers property' }));
    expect(offers.getByLabelText('None')).toHaveTextContent('—');
    expect(offers.getAllByRole('button', { name: 'Edit linked Offers' })).toHaveLength(1);
    const heading = offers.getByRole('heading', { name: 'Offers' });
    const action = offers.getByRole('button', { name: 'Edit linked Offers' });
    expect(heading).toContainElement(action);
    expect(action).not.toHaveTextContent('✎');
    expect(action).not.toContainElement(offers.getByLabelText('None'));
  });

  it('authors Parent immediately while keeping navigation, descendants, and focus behavior separate', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    const parent = () => within(inspector.getByRole('group', { name: 'Parent property' }));
    expect(parent().getByRole('button', { name: 'Front Page' })).toBeInTheDocument();
    expect(parent().getAllByRole('button', { name: 'Edit parent Touchpoint' })).toHaveLength(1);
    await user.click(parent().getByRole('button', { name: 'Edit parent Touchpoint' }));
    expect(parent().queryByRole('searchbox', { name: 'Search Touchpoints' })).not.toBeInTheDocument();
    expect(parent().queryByRole('radio', { name: 'Standalone' })).not.toBeInTheDocument();
    expect(parent().queryByText('Standalone')).not.toBeInTheDocument();
    expect(parent().getByRole('radio', { name: 'Front Page' })).toBeChecked();
    const editor = parent().getByLabelText('Parent Touchpoint editor');
    expect(within(editor).getByRole('button', { name: 'Clear parent' })).toBeInTheDocument();
    expect(within(editor).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(within(editor).getAllByRole('button').map(button => button.textContent)).toEqual(['Clear parent', 'Close']);
    expect(parent().queryByRole('radio', { name: 'Checkout' })).not.toBeInTheDocument();
    expect(parent().queryByRole('radio', { name: 'FAQ' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}'); await vi.waitFor(() => expect(parent().getByRole('button', { name: 'Edit parent Touchpoint' })).toHaveFocus());
    await user.click(parent().getByRole('button', { name: 'Front Page' })); expect(inspector.getByRole('heading', { name: 'Front Page' })).toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    await user.click(parent().getByRole('button', { name: 'Edit parent Touchpoint' })); await user.click(parent().getByRole('radio', { name: 'About' }));
    expect(parent().getByRole('button', { name: 'About' })).toBeInTheDocument(); expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(within(inspector.getByRole('group', { name: 'Children property' })).getByRole('button', { name: 'FAQ' })).toBeInTheDocument();
  });

  it('clears Parent immediately without removing either Touchpoint or unrelated relations', async () => {
    const user = userEvent.setup(); const initial = structureDocument();
    const childId = 'touch'; const parentId = 'parent';
    const unrelatedRelationships = initial.relationships.filter(relation => relation.kind !== 'touchpoint_contains_touchpoint' || relation.childTouchpointId !== childId);
    const inspector = renderTouchpointInspector(initial); const parent = within(inspector.getByRole('group', { name: 'Parent property' }));
    await user.click(parent.getByRole('button', { name: 'Edit parent Touchpoint' }));
    const editor = parent.getByLabelText('Parent Touchpoint editor');
    for (const name of ['Apply', 'Save', 'Done', 'Cancel']) expect(within(editor).queryByRole('button', { name })).not.toBeInTheDocument();
    await user.click(within(editor).getByRole('button', { name: 'Clear parent' }));
    const committed = window.__VEE_DEV__!.dump();
    expect(committed.relationships).toEqual(unrelatedRelationships);
    expect(committed.relationships).not.toContainEqual(expect.objectContaining({ kind: 'touchpoint_contains_touchpoint', childTouchpointId: childId }));
    expect(committed.entities.map(entity => entity.id)).toEqual(expect.arrayContaining([childId, parentId]));
    expect(parent.queryByLabelText('Parent Touchpoint editor')).not.toBeInTheDocument();
    expect(parent.getByText('Add parent')).toBeInTheDocument();
    await vi.waitFor(() => expect(parent.getByRole('button', { name: 'Edit parent Touchpoint' })).toHaveFocus());
  });

  it('closes on current Parent selection without changing the document', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument()); const parent = within(inspector.getByRole('group', { name: 'Parent property' }));
    const before = window.__VEE_DEV__!.dump();
    await user.click(parent.getByRole('button', { name: 'Edit parent Touchpoint' }));
    const current = parent.getByRole('radio', { name: 'Front Page' }); expect(current).toBeChecked(); await user.click(current);
    expect(window.__VEE_DEV__!.dump()).toEqual(before);
    expect(parent.queryByLabelText('Parent Touchpoint editor')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(parent.getByRole('button', { name: 'Edit parent Touchpoint' })).toHaveFocus());
  });

  it('progressively discloses Parent search for a large candidate set and Close restores focus', async () => {
    const user = userEvent.setup(); const document = structureDocument();
    document.relationships = document.relationships.filter(relation => relation.kind !== 'touchpoint_contains_touchpoint' || relation.childTouchpointId !== 'touch');
    const baseCandidateCount = parentTouchpointOptions(document, 'touch').length;
    for (let index = 0; index < RELATION_EDITOR_SEARCH_THRESHOLD - baseCandidateCount; index += 1) document.entities.push({ id: `extra-parent-${index}`, kind: 'touchpoint', title: `Extra parent ${index}` });
    const inspector = renderTouchpointInspector(document); const parent = within(inspector.getByRole('group', { name: 'Parent property' }));
    expect(parent.getByText('Add parent')).toBeInTheDocument();
    await user.click(parent.getByRole('button', { name: 'Edit parent Touchpoint' }));
    expect(parent.queryByText('Standalone')).not.toBeInTheDocument();
    expect(parent.queryByRole('button', { name: 'Clear parent' })).not.toBeInTheDocument();
    expect(parent.getByRole('searchbox', { name: 'Search Touchpoints' })).toBeInTheDocument();
    expect(parent.getByRole('radio', { name: 'Front Page' })).toBeInTheDocument();
    expect(parent.getByRole('radio', { name: 'Extra parent 0' })).toBeInTheDocument();
    await user.type(parent.getByRole('searchbox', { name: 'Search Touchpoints' }), 'no match');
    expect(parent.getByRole('status')).toHaveTextContent('No matching Touchpoints.');
    await user.click(parent.getByRole('button', { name: 'Close' }));
    await vi.waitFor(() => expect(parent.getByRole('button', { name: 'Edit parent Touchpoint' })).toHaveFocus());
    expect(parent.getByText('Add parent')).toBeInTheDocument();
  });

  it('keeps every child readable and navigation-capable without edit affordances', async () => {
    const user = userEvent.setup();
    const document = structureDocument();
    const additionalChildren = [['hero', 'Hero'], ['pricing', 'Pricing'], ['form', 'Form'], ['reviews', 'Reviews'], ['footer', 'Footer CTA']] as const;
    for (const [index, [id, title]] of additionalChildren.entries()) {
      document.entities.push({ id, kind: 'touchpoint', title });
      document.relationships.push({ id: `touch-${id}`, kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'touch', childTouchpointId: id });
      document.placements.push({ viewId: 'spike-view', entityId: id, x: 1620 + index * 140, y: 0 });
    }
    const inspector = renderTouchpointInspector(document);
    const children = within(inspector.getByRole('region', { name: 'Containment' })).getByRole('group', { name: 'Children property' });
    const heading = within(children).getByRole('heading', { name: 'Children' });
    const navigation = children.querySelector<HTMLElement>('.business-structure-links')!;
    expect(within(heading).getByRole('button', { name: 'Edit Children' })).toBeInTheDocument();
    expect(heading).not.toContainElement(navigation);
    expect(navigation.parentElement).toBe(children);
    for (const title of ['FAQ', 'Footer CTA', 'Form', 'Hero', 'Pricing', 'Reviews']) {
      const control = within(children).getByRole('button', { name: title });
      expect(control.querySelector('.business-structure-edit-affordance')).not.toBeInTheDocument();
      expect(heading).not.toContainElement(control);
    }
    await user.click(within(children).getByRole('button', { name: 'Footer CTA' }));
    expect(inspector.getByRole('heading', { name: 'Footer CTA' })).toBeInTheDocument();
    expect(inspector.queryByLabelText('Children editor')).not.toBeInTheDocument();
  });

  it('groups main Children editor actions by editor and current-set hierarchy', async () => {
    const user = userEvent.setup(); const document = structureDocument();
    for (let index = 0; index < RELATION_EDITOR_SEARCH_THRESHOLD; index += 1) {
      document.entities.push({ id: `available-child-${index}`, kind: 'touchpoint', title: `Available child with a wrapping-capable title ${index}` });
      document.placements.push({ viewId: 'spike-view', entityId: `available-child-${index}`, x: 1700 + index * 140, y: 0 });
    }
    const inspector = renderTouchpointInspector(document); const children = within(inspector.getByRole('group', { name: 'Children property' }));
    await user.click(children.getByRole('button', { name: 'Edit Children' }));
    const editor = children.getByLabelText('Children editor');
    const header = editor.querySelector<HTMLElement>('.children-editor-header')!;
    const currentHeading = editor.querySelector<HTMLElement>('.children-current-heading')!;
    expect(within(header).getByText('Children')).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Create child' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Close' })).toHaveClass('inspector-secondary-action');
    expect(within(header).queryByRole('button', { name: 'Reassign all…' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('button', { name: 'Detach all' })).not.toBeInTheDocument();
    expect(within(currentHeading).getByRole('heading', { name: 'Current children' })).toBeInTheDocument();
    expect(within(currentHeading).getByRole('button', { name: 'Reassign all…' })).toHaveClass('inspector-secondary-action');
    expect(within(currentHeading).getByRole('button', { name: 'Detach all' })).toHaveClass('inspector-secondary-action');
    const currentRow = within(editor).getByRole('checkbox', { name: 'FAQ' }).closest<HTMLElement>('.children-relation-row')!;
    expect(within(currentRow).getByRole('checkbox', { name: 'FAQ' })).toBeChecked();
    expect(within(currentRow).getByRole('button', { name: 'Reassign…' })).toBeInTheDocument();
    const search = within(editor).getByRole('searchbox', { name: 'Search Touchpoints' });
    const branches = within(editor).getByRole('heading', { name: 'Available standalone branches' });
    const leaves = within(editor).getByRole('heading', { name: 'Available standalone leaves' });
    expect(header.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(search.compareDocumentPosition(currentHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(currentHeading.compareDocumentPosition(currentRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(currentRow.compareDocumentPosition(branches) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(branches.compareDocumentPosition(leaves) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each(['Close', 'Escape'] as const)('%s restores focus to the remounted Children heading action', async exit => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    const children = within(inspector.getByRole('group', { name: 'Children property' }));
    await user.click(children.getByRole('button', { name: 'Edit Children' }));
    if (exit === 'Close') await user.click(children.getByRole('button', { name: 'Close' }));
    else await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(children.getByRole('button', { name: 'Edit Children' })).toHaveFocus());
    expect(children.queryByLabelText('Children editor')).not.toBeInTheDocument();
  });

  it('switches from Children to Offers without restoring focus to the old heading action', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    const offers = within(inspector.getByRole('group', { name: 'Offers property' }));
    const children = within(inspector.getByRole('group', { name: 'Children property' }));
    await user.click(children.getByRole('button', { name: 'Edit Children' }));
    await user.click(offers.getByRole('button', { name: 'Edit linked Offers' }));
    expect(children.queryByLabelText('Children editor')).not.toBeInTheDocument();
    expect(offers.getByLabelText('Linked Offers editor')).toBeInTheDocument();
    expect(offers.getAllByRole('checkbox')[0]).toHaveFocus();
    expect(children.getByRole('button', { name: 'Edit Children' })).not.toHaveFocus();
  });

  it('keeps creation, dismissal, and available candidates when the current Children set is empty', async () => {
    const user = userEvent.setup(); const document = structureDocument();
    document.relationships = document.relationships.filter(relation => relation.kind !== 'touchpoint_contains_touchpoint' || relation.parentTouchpointId !== 'touch');
    const inspector = renderTouchpointInspector(document); const childrenGroup = inspector.getByRole('group', { name: 'Children property' }); const children = within(childrenGroup);
    const readHeading = children.getByRole('heading', { name: 'Children' });
    expect(within(readHeading).getByRole('button', { name: 'Edit Children' })).toBeInTheDocument();
    expect(readHeading).not.toContainElement(childrenGroup.querySelector('.business-structure-empty'));
    await user.click(children.getByRole('button', { name: 'Edit Children' }));
    const editor = within(children.getByLabelText('Children editor'));
    expect(editor.getByRole('button', { name: 'Create child' })).toBeInTheDocument();
    expect(editor.getByRole('button', { name: 'Close' })).toHaveClass('inspector-secondary-action');
    expect(editor.queryByRole('button', { name: 'Reassign all…' })).not.toBeInTheDocument();
    expect(editor.queryByRole('button', { name: 'Detach all' })).not.toBeInTheDocument();
    expect(editor.getByRole('heading', { name: 'Available standalone branches' })).toBeInTheDocument();
    expect(editor.getByRole('heading', { name: 'Available standalone leaves' })).toBeInTheDocument();
    expect(editor.getByRole('checkbox', { name: 'FAQ' })).not.toBeChecked();
  });

  it.each(['Reassign…', 'Reassign all…'] as const)('keeps %s Search visible while its query reduces a large Parent candidate set', async action => {
    const user = userEvent.setup(); const document = structureDocument();
    for (let index = 0; index < RELATION_EDITOR_SEARCH_THRESHOLD; index += 1) {
      document.entities.push({ id: `reassign-parent-${index}`, kind: 'touchpoint', title: index === 0 ? 'Needle Parent' : `Extra Parent ${index}` });
      document.placements.push({ viewId: 'spike-view', entityId: `reassign-parent-${index}`, x: 1700 + index * 140, y: 0 });
    }
    const inspector = renderTouchpointInspector(document);
    const children = within(inspector.getByRole('group', { name: 'Children property' }));
    await user.click(children.getByRole('button', { name: 'Edit Children' }));
    await user.click(children.getByRole('button', { name: action }));
    const editor = within(children.getByLabelText('Reassign children'));
    const search = editor.getByRole('searchbox', { name: 'Search Touchpoints' });
    await user.type(search, 'Needle');
    expect(editor.getByRole('searchbox', { name: 'Search Touchpoints' })).toBe(search);
    expect(search).toHaveFocus();
    expect(editor.getAllByRole('radio')).toHaveLength(1);
    expect(editor.getByRole('radio', { name: 'Needle Parent' })).toBeInTheDocument();
  });

  it.each([
    ['Reassign…', 'Back'], ['Reassign…', 'Escape'], ['Reassign all…', 'Back'], ['Reassign all…', 'Escape'],
  ] as const)('%s contributor resolution uses %s to return to Parent selection', async (action, exit) => {
    const user = userEvent.setup(); const document = structureDocument();
    document.relationships.push(
      { id: 'child-offer', kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'child' },
      { id: 'other-second-offer', kind: 'offer_presented_at_touchpoint', offerId: 'offer-b', touchpointId: 'other' },
    );
    document.productJobIntents = [{ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: [] }];
    document.offerJobSelections = [{ id: 'offer-job', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] }];
    document.touchpointJobSelections = [{ id: 'child-job', touchpointId: 'child', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] }];
    const inspector = renderTouchpointInspector(document);
    const children = within(inspector.getByRole('group', { name: 'Children property' }));
    await user.click(children.getByRole('button', { name: 'Edit Children' }));
    await user.click(children.getByRole('button', { name: action }));
    await user.click(within(children.getByLabelText('Reassign children')).getByRole('radio', { name: 'About' }));
    const resolver = within(children.getByLabelText('Children contributor resolver'));
    if (exit === 'Back') await user.click(resolver.getByRole('button', { name: 'Back' }));
    else await user.keyboard('{Escape}');
    const restored = within(children.getByLabelText('Reassign children'));
    expect(restored.getByText('Choose new parent')).toBeInTheDocument();
    expect(restored.getByRole('radio', { name: 'About' })).toBeInTheDocument();
    expect(children.queryByLabelText('Children contributor resolver')).not.toBeInTheDocument();
    expect(window.__VEE_DEV__!.dump().relationships).toContainEqual(expect.objectContaining({ kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'touch', childTouchpointId: 'child' }));
  });

  it.each(['Back', 'Escape', 'outside'] as const)('%s abandons a non-blank one-Offer child draft without creating an entity', async exit => {
    const user = userEvent.setup(); const document = oneOfferChildrenDocument(); const initialEntityIds = document.entities.map(entity => entity.id);
    const inspector = renderTouchpointInspector(document); const children = within(inspector.getByRole('group', { name: 'Children property' }));
    await user.click(children.getByRole('button', { name: 'Edit Children' }));
    await user.click(children.getByRole('button', { name: 'Create child' }));
    await user.type(children.getByRole('textbox', { name: 'Title' }), 'Discarded child');
    if (exit === 'Back') await user.click(within(children.getByLabelText('Create child')).getByRole('button', { name: 'Back' }));
    else if (exit === 'Escape') await user.keyboard('{Escape}');
    else await user.click(inspector.getByRole('heading', { name: 'Placement' }));
    expect(window.__VEE_DEV__!.dump().entities.map(entity => entity.id)).toEqual(initialEntityIds);
    expect(window.__VEE_DEV__!.dump().entities.some(entity => entity.title === 'Discarded child')).toBe(false);
    expect(children.queryByLabelText('Create child')).not.toBeInTheDocument();
    if (exit === 'outside') expect(children.queryByLabelText('Children editor')).not.toBeInTheDocument();
    else expect(children.getByLabelText('Children editor')).toBeInTheDocument();
  });

  it('naturally completing a one-Offer title still auto-creates exactly one child', async () => {
    const user = userEvent.setup(); const document = oneOfferChildrenDocument();
    const inspector = renderTouchpointInspector(document); const children = within(inspector.getByRole('group', { name: 'Children property' }));
    await user.click(children.getByRole('button', { name: 'Edit Children' }));
    await user.click(children.getByRole('button', { name: 'Create child' }));
    const title = children.getByRole('textbox', { name: 'Title' }); await user.type(title, 'Committed child'); fireEvent.blur(title);
    const committed = window.__VEE_DEV__!.dump(); const created = committed.entities.filter(entity => entity.title === 'Committed child');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ kind: 'touchpoint' });
    expect(committed.relationships).toContainEqual(expect.objectContaining({ kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: created[0]!.id }));
    expect(committed.relationships).toContainEqual(expect.objectContaining({ kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'touch', childTouchpointId: created[0]!.id }));
    expect(committed.placements).toContainEqual(expect.objectContaining({ viewId: 'spike-view', entityId: created[0]!.id }));
    expect(children.getByLabelText('Children editor')).toBeInTheDocument();
    expect(children.getByRole('checkbox', { name: 'Committed child' })).toBeChecked();
  });

  it('choosing the final missing Offer auto-creates a titled child without a completion button', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument()); const children = within(inspector.getByRole('group', { name: 'Children property' }));
    await user.click(children.getByRole('button', { name: 'Edit Children' })); await user.click(children.getByRole('button', { name: 'Create child' }));
    await user.type(children.getByRole('textbox', { name: 'Title' }), 'Offer-completed child');
    await user.click(children.getByRole('radio', { name: 'Consulting' }));
    const committed = window.__VEE_DEV__!.dump(); const created = committed.entities.filter(entity => entity.title === 'Offer-completed child');
    expect(created).toHaveLength(1);
    expect(committed.relationships).toContainEqual(expect.objectContaining({ kind: 'offer_presented_at_touchpoint', offerId: 'offer-b', touchpointId: created[0]!.id }));
    for (const name of ['Create', 'Save', 'Apply', 'Done']) expect(children.queryByRole('button', { name })).not.toBeInTheDocument();
  });

  it('URL Enter commits immediately without a generic Apply', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    await user.click(within(inspector.getByRole('region', { name: 'Business structure' })).getByRole('button', { name: /Edit web address/ }));
    const input = inspector.getByRole('textbox', { name: 'Edit web address' });
    expect(input).toHaveValue('https://example.com/checkout');
    await user.clear(input); await user.type(input, 'https://committed.example{Enter}');
    const structure = within(inspector.getByRole('region', { name: 'Business structure' }));
    expect(structure.getByRole('link', { name: 'https://committed.example' })).toBeInTheDocument();
    expect(inspector.queryByRole('button', { name: 'Apply changes' })).not.toBeInTheDocument();
    expect(window.__VEE_DEV__!.dump().entities.find(entity => entity.id === 'touch')).toEqual(expect.objectContaining({ url: 'https://committed.example' }));
    expect(within(inspector.getByRole('region', { name: 'Business structure' })).getByRole('link', { name: 'https://committed.example' })).toBeInTheDocument();
    for (const name of ['Apply', 'Save', 'Done']) expect(inspector.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('URL blur commits, blank clears, and Escape cancels', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    const region = () => within(inspector.getByRole('region', { name: 'Business structure' }));
    await user.click(region().getByRole('button', { name: /Edit web address/ })); await user.clear(inspector.getByLabelText('Edit web address')); await user.type(inspector.getByLabelText('Edit web address'), 'https://blur.example'); await user.tab();
    expect(region().getByRole('link', { name: 'https://blur.example' })).toBeInTheDocument();
    expect(window.__VEE_DEV__!.dump().entities.find(entity => entity.id === 'touch')).toEqual(expect.objectContaining({ url: 'https://blur.example' }));
    await user.click(region().getByRole('button', { name: /Edit web address/ })); await user.clear(inspector.getByLabelText('Edit web address')); await user.keyboard('{Escape}');
    expect(region().getByRole('link', { name: 'https://blur.example' })).toBeInTheDocument();
    expect(window.__VEE_DEV__!.dump().entities.find(entity => entity.id === 'touch')).toEqual(expect.objectContaining({ url: 'https://blur.example' }));
    await vi.waitFor(() => expect(region().getByRole('button', { name: 'Edit web address' })).toHaveFocus());
    await user.click(region().getByRole('button', { name: /Edit web address/ })); await user.clear(inspector.getByLabelText('Edit web address')); await user.keyboard('{Enter}');
    expect(region().queryByRole('link')).not.toBeInTheDocument(); expect(region().getByRole('button', { name: 'Add URL' })).toBeInTheDocument();
    for (const name of ['Apply', 'Save', 'Done']) expect(inspector.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('keeps empty and unsafe stored URLs readable and editable without external-link semantics', async () => {
    const user = userEvent.setup();
    const emptyDocument = structureDocument();
    const emptyTouchpoint = emptyDocument.entities.find(entity => entity.id === 'touch')!;
    if (emptyTouchpoint.kind === 'touchpoint') delete emptyTouchpoint.url;
    let inspector = renderTouchpointInspector(emptyDocument);
    let region = within(inspector.getByRole('region', { name: 'Business structure' }));
    expect(region.getByText('Add URL')).toBeInTheDocument();
    expect(region.queryByRole('link')).not.toBeInTheDocument();
    expect(region.queryByText('↗')).not.toBeInTheDocument();
    const emptyEdit = region.getByRole('button', { name: 'Edit web address' });
    expect(region.getByRole('button', { name: 'Add URL' })).not.toBe(emptyEdit);
    await user.click(region.getByRole('button', { name: 'Add URL' }));
    expect(region.getByRole('textbox', { name: 'Edit web address' })).toHaveValue('');

    cleanup();
    const unsafeDocument = structureDocument();
    const unsafeTouchpoint = unsafeDocument.entities.find(entity => entity.id === 'touch')!;
    if (unsafeTouchpoint.kind === 'touchpoint') unsafeTouchpoint.url = 'javascript:alert(1)';
    inspector = renderTouchpointInspector(unsafeDocument);
    region = within(inspector.getByRole('region', { name: 'Business structure' }));
    expect(region.getByText('javascript:alert(1)')).toBeInTheDocument();
    expect(region.queryByRole('link')).not.toBeInTheDocument();
    expect(region.queryByText('↗')).not.toBeInTheDocument();
    const unsafeEdit = region.getByRole('button', { name: 'Edit web address' });
    expect(unsafeEdit).not.toHaveTextContent('javascript:alert(1)');
    await user.click(unsafeEdit);
    expect(region.getByRole('textbox', { name: 'Edit web address' })).toHaveValue('javascript:alert(1)');
  });

  it('Located in chooses, creates, reuses, clears, and cancels without global Apply', async () => {
    const user = userEvent.setup(); const document = structureDocument(); document.touchpointContainers.push({ id: 'app', title: 'Mobile app' });
    const inspector = renderTouchpointInspector(document); const region = () => within(inspector.getByRole('region', { name: 'Business structure' }));
    await user.click(region().getByRole('button', { name: 'Edit Located in' }));
    expect(inspector.getByRole('combobox', { name: 'Edit Located in' })).toHaveValue('Website');
    await user.clear(inspector.getByRole('combobox', { name: 'Edit Located in' })); await user.type(inspector.getByRole('combobox', { name: 'Edit Located in' }), 'Mobile'); await user.click(inspector.getByRole('option', { name: 'Mobile app' }));
    expect(region().getByRole('button', { name: 'Edit Located in, Mobile app' })).toBeInTheDocument();
    await user.click(region().getByRole('button', { name: 'Edit Located in' })); await user.clear(inspector.getByRole('combobox', { name: 'Edit Located in' })); await user.type(inspector.getByRole('combobox', { name: 'Edit Located in' }), 'WebSi{Enter}');
    expect(inspector.queryByRole('combobox', { name: 'Edit Located in' })).not.toBeInTheDocument(); expect(region().getByRole('button', { name: 'Edit Located in, WebSi' })).toBeInTheDocument();
    await user.click(region().getByRole('button', { name: 'Edit Located in' })); await user.clear(inspector.getByRole('combobox', { name: 'Edit Located in' })); await user.type(inspector.getByRole('combobox', { name: 'Edit Located in' }), '  website  ');
    expect(inspector.queryByRole('option', { name: /Create.*website/i })).not.toBeInTheDocument(); await user.keyboard('{Enter}');
    expect(region().getByRole('button', { name: 'Edit Located in, Website' })).toBeInTheDocument();
    await user.click(region().getByRole('button', { name: 'Edit Located in' })); await user.clear(inspector.getByRole('combobox', { name: 'Edit Located in' })); await user.keyboard('{Enter}');
    expect(inspector.getByRole('combobox', { name: 'Edit Located in' })).toHaveValue(''); expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
    await user.type(inspector.getByRole('combobox', { name: 'Edit Located in' }), 'Landing pages'); await user.click(inspector.getByRole('option', { name: 'Create "Landing pages"' }));
    expect(region().getByRole('button', { name: 'Edit Located in, Landing pages' })).toBeInTheDocument();
    await user.click(region().getByRole('button', { name: 'Edit Located in' })); await user.keyboard('{Escape}'); expect(region().getByRole('button', { name: 'Edit Located in, Landing pages' })).toBeInTheDocument();
    await vi.waitFor(() => expect(region().getByRole('button', { name: 'Edit Located in' })).toHaveFocus());
    await user.click(region().getByRole('button', { name: 'Edit Located in' })); await user.click(inspector.getByRole('option', { name: 'Clear location' })); expect(region().getByRole('button', { name: 'Add location' })).toBeInTheDocument();
  });

  it('switches local heading editors without restoring focus to the previous heading', async () => {
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector(structureDocument());
    const region = within(inspector.getByRole('region', { name: 'Business structure' }));

    await user.click(region.getByRole('button', { name: 'Edit parent Touchpoint' }));
    expect(region.getByLabelText('Parent Touchpoint editor')).toBeInTheDocument();
    await user.click(region.getByRole('button', { name: 'Edit web address' }));
    expect(region.queryByLabelText('Parent Touchpoint editor')).not.toBeInTheDocument();
    expect(region.getByRole('textbox', { name: 'Edit web address' })).toHaveFocus();

    await user.click(region.getByRole('button', { name: 'Edit Located in' }));
    expect(region.queryByRole('textbox', { name: 'Edit web address' })).not.toBeInTheDocument();
    expect(region.getByRole('combobox', { name: 'Edit Located in' })).toHaveFocus();
    expect(region.getByRole('button', { name: 'Edit web address' })).not.toHaveFocus();
  });

  it('derived neighborhood is visibly distinguished from direct structure', async () => {
    const user = userEvent.setup();
    const structure = renderTouchpointInspector(structureDocument()).getByRole('region', { name: 'Business structure' });
    expect(within(structure).getByText('Derived').closest('.business-structure-derived')).toBeInTheDocument();
    const subscription = within(structure).getByRole('group', { name: 'Other Touchpoints for Subscription' });
    const consulting = within(structure).getByRole('group', { name: 'Other Touchpoints for Consulting' });
    const container = within(structure).getByRole('group', { name: 'More in Website' });
    await user.click(within(subscription).getByRole('button', { name: 'Other Touchpoints for Subscription, 1 Touchpoints' }));
    await user.click(within(consulting).getByRole('button', { name: 'Other Touchpoints for Consulting, 0 Touchpoints' }));
    await user.click(within(container).getByRole('button', { name: 'More in Website, 2 Touchpoints' }));
    expect(within(subscription).getByRole('button', { name: 'About' })).toBeInTheDocument();
    expect(within(consulting).getByText('No related Touchpoints')).toBeInTheDocument();
    expect(within(container).getByRole('button', { name: 'About' })).toBeInTheDocument();
    expect(subscription).not.toBe(container);
  });

  it('every derived neighborhood axis navigates through existing Inspector history', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    for (const groupName of ['Other Touchpoints for Subscription', 'More in Website']) {
      const structure = inspector.getByRole('region', { name: 'Business structure' });
      const group = within(structure).getByRole('group', { name: groupName });
      await user.click(within(group).getByRole('button', { name: new RegExp(`${groupName},`) }));
      await user.click(within(group).getByRole('button', { name: 'About' }));
      expect(inspector.getByRole('heading', { name: 'About' })).toBeInTheDocument();
      await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    }
  });

  it('applies initial density per group and preserves duplicate Touchpoints across two basis panels', () => {
    let inspector = renderTouchpointInspector(neighborhoodDocument([4]));
    expect(inspector.getByRole('button', { name: 'Other Touchpoints for Subscription, 4 Touchpoints' })).toHaveAttribute('aria-expanded', 'true');
    cleanup();

    inspector = renderTouchpointInspector(neighborhoodDocument([2, 4], true));
    const disclosures = inspector.getAllByRole('button', { name: /Touchpoints$/ });
    expect(disclosures).toHaveLength(2);
    expect(disclosures.every(button => button.getAttribute('aria-expanded') === 'true')).toBe(true);
    expect(inspector.getAllByRole('button', { name: 'Shared neighbor' })).toHaveLength(2);
    cleanup();

    inspector = renderTouchpointInspector(neighborhoodDocument([1, 1, 1]));
    expect(inspector.getAllByRole('button', { name: /Touchpoints$/ }).every(button => button.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(inspector.queryByRole('button', { name: 'Neighbor 1.1' })).not.toBeInTheDocument();
  });

  it('keeps disclosure choices independent and orders expanded then collapsed groups stably', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(neighborhoodDocument([1, 1, 1]));
    const neighborhood = inspector.getByText('Neighborhood').closest<HTMLElement>('.business-structure-derived')!;
    const first = inspector.getByRole('button', { name: 'Other Touchpoints for Subscription, 1 Touchpoints' });
    const second = inspector.getByRole('button', { name: 'Other Touchpoints for Offer 2, 1 Touchpoints' });
    const third = inspector.getByRole('button', { name: 'Other Touchpoints for Offer 3, 1 Touchpoints' });
    expect(document.getElementById(first.getAttribute('aria-controls')!)).toHaveAttribute('hidden');
    expect(inspector.queryByRole('button', { name: 'Neighbor 1.1' })).not.toBeInTheDocument();
    second.focus(); await user.keyboard('{Enter}');
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect([...neighborhood.querySelectorAll<HTMLElement>('.derived-neighborhood-slice')].map(panel => panel.getAttribute('aria-label'))).toEqual([
      'Other Touchpoints for Offer 2', 'Other Touchpoints for Offer 3', 'Other Touchpoints for Subscription',
    ]);
    await user.click(third);
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(third).toHaveAttribute('aria-expanded', 'true');
    await user.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'false');
    expect(third).toHaveAttribute('aria-expanded', 'true');
    expect([...neighborhood.querySelectorAll<HTMLElement>('.derived-neighborhood-slice')].map(panel => panel.getAttribute('aria-label'))).toEqual([
      'Other Touchpoints for Offer 3', 'Other Touchpoints for Offer 2', 'Other Touchpoints for Subscription',
    ]);
  });

  it('exposes URL only through the canonical Placement editor', async () => {
    const inspector = renderTouchpointInspector(structureDocument());
    const structure = within(inspector.getByRole('region', { name: 'Business structure' }));
    expect(structure.getByRole('link', { name: 'https://example.com/checkout' })).toBeInTheDocument();
    expect(structure.getByRole('button', { name: 'Edit web address' })).toBeInTheDocument();
    expect(inspector.queryByRole('textbox', { name: 'URL' })).not.toBeInTheDocument();
  });

  it('non-Touchpoint Inspector does not render Touchpoint Business structure', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(structureDocument());
    await user.click(within(inspector.getByRole('region', { name: 'Business structure' })).getAllByRole('button', { name: 'Subscription' })[0]!);
    expect(inspector.queryByRole('region', { name: 'Business structure' })).not.toBeInTheDocument();
  });

  it('keeps successful operation feedback available until its timeout expires', () => {
    vi.useFakeTimers();
    try {
      const inspector = renderTouchpointInspector(structureDocument());
      fireEvent.click(inspector.getByRole('button', { name: 'Edit parent Touchpoint' }));
      fireEvent.click(inspector.getByRole('radio', { name: 'About' }));
      expect(screen.getByRole('status')).toHaveTextContent('Parent Touchpoint updated.');
      act(() => vi.advanceTimersByTime(2499));
      expect(screen.getByRole('status')).toHaveTextContent('Parent Touchpoint updated.');
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByText('Parent Touchpoint updated.')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps operation errors visible beyond the success feedback timeout', () => {
    vi.useFakeTimers();
    try {
      render(<MapSpike initialDocument={touchpointInspectorDocument()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add element' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Duplicate identifier' } });
      vi.stubGlobal('crypto', { randomUUID: () => 'product' });
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
      const error = screen.getByRole('status');
      expect(error).toHaveTextContent(/already exists/i);
      expect(error).toHaveAttribute('aria-live', 'assertive');
      act(() => vi.advanceTimersByTime(5000));
      expect(error).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

describe('Offer Inspector derived neighborhood', () => {
  async function inspectOffer(user: ReturnType<typeof userEvent.setup>, document: MapDocument, offer = 'Subscription') {
    render(<MapSpike initialDocument={document} />);
    await user.click(screen.getByRole('button', { name: offer }));
    return openInspector(user);
  }

  it('derives, deduplicates, sorts, expands, and navigates siblings from the committed Product link', async () => {
    const user = userEvent.setup();
    const document = offerNeighborhoodDocument();
    const snapshot = structuredClone(document);
    let inspector = await inspectOffer(user, document);
    const neighborhoodRegion = inspector.getByRole('region', { name: 'Offer neighborhood' });
    const neighborhood = within(neighborhoodRegion);
    expect(neighborhoodRegion).toHaveClass('offer-neighborhood', 'business-structure-derived', 'offer-neighborhood--multiple');
    expect(neighborhood.getByText('Derived')).toBeInTheDocument();
    const disclosure = neighborhood.getByRole('button', { name: 'Other Offers for Orbit, 2 Offers' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(disclosure).toHaveAttribute('aria-controls', 'offer-neighborhood-offer-a-product%3Aproduct');
    expect(within(disclosure).getByText('2')).toHaveClass('derived-neighborhood-count');
    expect(neighborhoodRegion.querySelector('[id="offer-neighborhood-offer-a-product%3Aproduct"]')).toHaveAttribute('hidden');
    expect(neighborhood.queryByRole('button', { name: 'Advisory' })).not.toBeInTheDocument();

    disclosure.focus();
    await user.keyboard('{Enter}');
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(neighborhoodRegion.querySelector('[id="offer-neighborhood-offer-a-product%3Aproduct"]')).not.toHaveAttribute('hidden');
    expect(neighborhood.getAllByRole('listitem').map(item => item.textContent)).toEqual(['Advisory', 'Consulting']);
    expect(neighborhood.getAllByRole('button', { name: 'Advisory' })).toHaveLength(1);
    expect(neighborhood.queryByRole('button', { name: 'Subscription' })).not.toBeInTheDocument();
    expect(neighborhood.queryByRole('button', { name: 'Unrelated Offer' })).not.toBeInTheDocument();
    expect(document).toEqual(snapshot);
    expect(inspector.getByRole('button', { name: 'Apply changes' })).toBeDisabled();

    await user.click(neighborhood.getByRole('button', { name: 'Advisory' }));
    expect(inspector.getByRole('heading', { name: 'Advisory' })).toBeInTheDocument();
    expect(within(inspector.getByRole('region', { name: 'Offer neighborhood' })).getByRole('button', { name: 'Other Offers for Orbit, 2 Offers' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    inspector = within(screen.getByRole('tabpanel', { name: 'Entity Inspector' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    expect(within(inspector.getByRole('region', { name: 'Offer neighborhood' })).getByRole('button', { name: 'Other Offers for Orbit, 2 Offers' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not apply the Offer-specific modifier to a Touchpoint neighborhood', async () => {
    const inspector = renderTouchpointInspector();
    const neighborhood = within(inspector.getByRole('region', { name: 'Business structure' }))
      .getByText('Neighborhood').closest<HTMLElement>('.business-structure-derived');
    expect(neighborhood).toBeInTheDocument();
    expect(neighborhood).not.toHaveClass('offer-neighborhood');
    expect(neighborhood).not.toHaveClass('offer-neighborhood--multiple');
  });

  it('keeps a resolved zero-sibling group and derives co-presentation without a valid Product link', async () => {
    const user = userEvent.setup();
    const zero = touchpointInspectorDocument();
    let inspector = await inspectOffer(user, zero);
    expect(inspector.getByRole('region', { name: 'Offer neighborhood' })).toHaveClass('offer-neighborhood', 'business-structure-derived');
    expect(inspector.getByRole('region', { name: 'Offer neighborhood' })).not.toHaveClass('offer-neighborhood--multiple');
    const disclosure = within(inspector.getByRole('region', { name: 'Offer neighborhood' })).getByRole('button', { name: 'Other Offers for Orbit, 0 Offers' });
    await user.click(disclosure);
    expect(inspector.getByText('No other Offers')).toBeInTheDocument();

    cleanup();
    const missing = touchpointInspectorDocument(true);
    missing.relationships = missing.relationships.filter(relation => relation.kind !== 'product_packaged_as_offer');
    inspector = await inspectOffer(user, missing);
    expect(within(inspector.getByRole('region', { name: 'Offer neighborhood' })).getByRole('button', { name: 'Other Offers on Checkout, 1 Offers' })).toBeInTheDocument();

    cleanup();
    const invalid = touchpointInspectorDocument(true);
    const packaging = invalid.relationships.find(relation => relation.kind === 'product_packaged_as_offer');
    if (packaging?.kind === 'product_packaged_as_offer') packaging.productId = 'job';
    inspector = await inspectOffer(user, invalid);
    expect(within(inspector.getByRole('region', { name: 'Offer neighborhood' })).getByRole('button', { name: 'Other Offers on Checkout, 1 Offers' })).toBeInTheDocument();
  });

  it('derives exact Touchpoint groups with valid unique endpoints and deterministic ordering', async () => {
    const user = userEvent.setup();
    const document = coPresentedOfferNeighborhoodDocument();
    const snapshot = structuredClone(document);
    const inspector = await inspectOffer(user, document);
    const region = inspector.getByRole('region', { name: 'Offer neighborhood' });
    expect(region).toHaveClass('offer-neighborhood', 'business-structure-derived', 'offer-neighborhood--multiple');
    const groups = [...region.querySelectorAll<HTMLElement>('.derived-neighborhood-slice')];
    expect(groups.map(group => group.getAttribute('aria-label'))).toEqual([
      'Other Offers for Orbit',
      'Other Offers on Alpha room',
      'Other Offers on Alpha room',
      'Other Offers on Checkout',
    ]);
    expect(groups.map(group => group.dataset.basisId)).toEqual(['product', 'touch-a', 'touch-a-2', 'touch']);
    const disclosures = groups.map(group => within(group).getByRole('button', { name: /Offers$/ }));
    expect(disclosures.map(disclosure => disclosure.getAttribute('aria-controls'))).toEqual([
      'offer-neighborhood-offer-a-product%3Aproduct',
      'offer-neighborhood-offer-a-touchpoint%3Atouch-a',
      'offer-neighborhood-offer-a-touchpoint%3Atouch-a-2',
      'offer-neighborhood-offer-a-touchpoint%3Atouch',
    ]);
    expect(new Set(disclosures.map(disclosure => disclosure.getAttribute('aria-controls'))).size).toBe(disclosures.length);
    expect(disclosures.map(disclosure => disclosure.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'false']);
    expect(within(region).queryByRole('button', { name: /Empty room/ })).not.toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: /Parent room/ })).not.toBeInTheDocument();

    const alpha = within(groups[1]!);
    const alphaDisclosure = alpha.getByRole('button', { name: 'Other Offers on Alpha room, 4 Offers' });
    await user.click(alphaDisclosure);
    expect(alpha.getAllByRole('listitem').map(item => item.textContent)).toEqual(['First Offer', 'First Offer', 'Shared Offer', 'Unrelated Offer']);
    expect(alpha.getAllByRole('listitem').slice(0, 2).map(item => item.querySelector('button')?.textContent)).toEqual(['First Offer', 'First Offer']);
    expect(alpha.queryByRole('button', { name: 'Subscription' })).not.toBeInTheDocument();
    expect(alpha.getAllByRole('button', { name: 'Shared Offer' })).toHaveLength(1);
    expect(within(groups[2]!).getByRole('button', { name: 'Other Offers on Alpha room, 1 Offers' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(within(groups[2]!).getByRole('button', { name: 'Other Offers on Alpha room, 1 Offers' }));
    expect(within(groups[2]!).getByRole('button', { name: 'Shared Offer' })).toBeInTheDocument();
    expect(alphaDisclosure).toHaveAttribute('aria-expanded', 'true');
    expect(inspector.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
    expect(document).toEqual(snapshot);
  });

  it('isolates group expansion by inspected Offer and restores it through Inspector Back', async () => {
    const user = userEvent.setup();
    const document = coPresentedOfferNeighborhoodDocument();
    let inspector = await inspectOffer(user, document);
    let neighborhood = within(inspector.getByRole('region', { name: 'Offer neighborhood' }));
    const productDisclosure = neighborhood.getByRole('button', { name: 'Other Offers for Orbit, 2 Offers' });
    const touchDisclosure = neighborhood.getByRole('button', { name: 'Other Offers on Alpha room, 4 Offers' });
    await user.click(productDisclosure);
    expect(touchDisclosure).toHaveAttribute('aria-expanded', 'false');
    await user.click(productDisclosure);
    await user.click(touchDisclosure);
    await user.click(neighborhood.getByRole('button', { name: 'Unrelated Offer' }));
    inspector = within(screen.getByRole('tabpanel', { name: 'Entity Inspector' }));
    neighborhood = within(inspector.getByRole('region', { name: 'Offer neighborhood' }));
    expect(neighborhood.getByRole('button', { name: 'Other Offers for Other Product, 0 Offers' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    inspector = within(screen.getByRole('tabpanel', { name: 'Entity Inspector' }));
    neighborhood = within(inspector.getByRole('region', { name: 'Offer neighborhood' }));
    expect(neighborhood.getByRole('button', { name: 'Other Offers for Orbit, 2 Offers' })).toHaveAttribute('aria-expanded', 'false');
    expect(neighborhood.getByRole('button', { name: 'Other Offers on Alpha room, 4 Offers' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('retains linked-Product draft editing and its dirty navigation guard', async () => {
    const user = userEvent.setup();
    const document = offerNeighborhoodDocument();
    let inspector = await inspectOffer(user, document);
    await user.selectOptions(inspector.getByLabelText('Linked Product'), 'product-other');
    expect(inspector.getByRole('button', { name: 'Apply changes' })).toBeEnabled();
    const neighborhood = within(inspector.getByRole('region', { name: 'Offer neighborhood' }));
    expect(neighborhood.getByRole('button', { name: 'Other Offers for Orbit, 2 Offers' })).toBeInTheDocument();
    await user.click(neighborhood.getByRole('button', { name: 'Other Offers for Orbit, 2 Offers' }));
    await user.click(neighborhood.getByRole('button', { name: 'Advisory' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Discard/ }));
    inspector = within(screen.getByRole('tabpanel', { name: 'Entity Inspector' }));
    expect(inspector.getByRole('heading', { name: 'Advisory' })).toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    expect(inspector.getByLabelText('Linked Product')).toHaveValue('product');
  });
});

describe('map-first authoring interactions', () => {
  it('consumes repeated empty north and south commands without changing selection, authored placement, rendered position, or connected edge geometry', () => {
    render(<MapSpike initialDocument={emptyCardinalSectorDocument()} />);
    const source = screen.getByRole('button', { name: 'FP' });
    fireEvent.click(source);
    source.focus();
    const beforePosition = nodePoint('FP');
    const connectedEdges = Array.from(document.querySelectorAll<HTMLElement>('[data-source="fp"]'));
    expect(connectedEdges).toHaveLength(2);
    const beforeGeometry = connectedEdges.map(edge => edge.dataset.geometry);
    expect(screen.getByLabelText('Map canvas')).toHaveAttribute('data-disable-keyboard-a11y', 'true');

    for (const key of ['ArrowUp', 'ArrowDown'] as const) {
      for (let index = 0; index < 10; index += 1) {
        const event = new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true });
        source.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
    }

    expect(source).toHaveFocus();
    expect(source).toHaveAttribute('data-selected', 'true');
    expect(nodePoint('FP')).toEqual(beforePosition);
    expect(connectedEdges.map(edge => edge.dataset.geometry)).toEqual(beforeGeometry);
  });

  it('consumes equivalent empty-sector Numpad commands while an authored east candidate still navigates normally', async () => {
    render(<MapSpike initialDocument={emptyCardinalSectorDocument()} />);
    const source = screen.getByRole('button', { name: 'FP' });
    fireEvent.click(source);
    source.focus();
    for (const [key, code] of [['8', 'Numpad8'], ['2', 'Numpad2']] as const) {
      for (let index = 0; index < 10; index += 1) {
        const event = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true });
        source.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
    }
    expect(nodePoint('FP')).toEqual({ x: 100, y: 200 });
    fireEvent.keyDown(source, { key: 'ArrowRight', code: 'ArrowRight' });
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'TEAM Offer' })).toHaveFocus());
  });

  it('keeps VEE Move mode authoritative and restores spatial no-op ownership immediately after Escape', async () => {
    render(<MapSpike initialDocument={emptyCardinalSectorDocument()} />);
    const source = screen.getByRole('button', { name: 'FP' });
    fireEvent.click(source);
    fireEvent.keyDown(source, { key: 'm', code: 'KeyM' });
    fireEvent.keyDown(source, { key: 'ArrowUp', code: 'ArrowUp' });
    await vi.waitFor(() => expect(nodePoint('FP')).toEqual({ x: 100, y: 176 }));
    const movedGeometry = Array.from(document.querySelectorAll<HTMLElement>('[data-source="fp"]')).map(edge => edge.dataset.geometry);
    expect(movedGeometry.every(geometry => geometry?.startsWith('100,176:'))).toBe(true);
    fireEvent.keyDown(source, { key: 'Escape', code: 'Escape' });
    const afterEscape = new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true });
    source.dispatchEvent(afterEscape);
    expect(afterEscape.defaultPrevented).toBe(true);
    expect(nodePoint('FP')).toEqual({ x: 100, y: 176 });
  });

  it('arrow navigation focuses and reveals an offscreen node without moving it', async () => {
    const document = touchpointInspectorDocument();
    document.entities = document.entities.slice(0, 2);
    document.relationships = [];
    document.placements = [{ viewId: 'spike-view', entityId: 'product', x: 0, y: 0 }, { viewId: 'spike-view', entityId: 'offer-a', x: 2000, y: 0 }];
    setViewportSpy.mockClear();
    render(<MapSpike initialDocument={document} />);
    const source = screen.getByRole('button', { name: 'Orbit' });
    const target = screen.getByRole('button', { name: 'Subscription' });
    const before = { source: nodePoint('Orbit'), target: nodePoint('Subscription') };
    fireEvent.click(source); fireEvent.keyDown(source, { key: 'ArrowRight', code: 'ArrowRight' });
    await vi.waitFor(() => expect(target).toHaveFocus());
    expect(setViewportSpy).toHaveBeenCalled();
    expect({ source: nodePoint('Orbit'), target: nodePoint('Subscription') }).toEqual(before);
  });

  it('editable controls retain native arrow behavior', () => {
    render(<MapSpike initialDocument={touchpointInspectorDocument()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Entity Inspector' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit title, Checkout' }));
    const title = screen.getByRole('textbox', { name: 'Edit title, Checkout' });
    title.focus();
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true, cancelable: true });
    title.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(title).toHaveFocus();
  });

  it('edits authored Business and Client titles inline with commit, cancel, and keyboard ownership', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user);
    const product = screen.getByRole('button', { name: 'Orbit' }); await user.click(product); expect(screen.queryByRole('textbox', { name: /Edit title/ })).not.toBeInTheDocument();
    await user.dblClick(product.querySelector('.node-title')!); let editor = screen.getByRole('textbox', { name: 'Edit title for Orbit' }); expect(editor).toHaveFocus();
    (editor as HTMLTextAreaElement).setSelectionRange(0, 0); await user.type(editor, 'New ', { skipClick: true }); expect(editor).toHaveValue('New Orbit'); expect((editor as HTMLTextAreaElement).selectionStart).toBe(4);
    (editor as HTMLTextAreaElement).setSelectionRange(4, 9); await user.type(editor, 'Path', { skipClick: true }); expect(editor).toHaveValue('New Path'); expect(screen.getByRole('button', { name: 'Orbit' })).toBeInTheDocument();
    await user.clear(editor); await user.type(editor, 'Orbit renamed\nline'); expect(editor).toHaveValue('Orbit renamed line');
    fireEvent.keyDown(editor, { key: 'Tab' }); expect(screen.queryByRole('heading', { name: 'Add Offer' })).not.toBeInTheDocument(); fireEvent.keyDown(editor, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Orbit renamed line' })).toHaveFocus(); expect((await openInspector(user)).getByRole('heading', { name: 'Orbit renamed line' })).toBeInTheDocument(); await openMap(user);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.type(screen.getByLabelText('Title'), 'Client job'); await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user);
    const client = screen.getByRole('button', { name: 'Client job' }); await user.dblClick(client.querySelector('.node-title')!); editor = screen.getByRole('textbox', { name: 'Edit title for Client job' }); await user.clear(editor); await user.type(editor, 'Cancelled'); fireEvent.keyDown(editor, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Client job' })).toHaveFocus(); expect(screen.queryByRole('button', { name: 'Cancelled' })).not.toBeInTheDocument();
  });
  it('short fitting authored title does not disclose', () => {
    render(<MapNode data={{ title: 'FP', kindLabel: 'Touchpoint', layout: nodeLayout }} />);
    const target = screen.getByLabelText('FP');
    setTitleOverflow(target, false);
    expect(isRenderedTitleTruncated(target)).toBe(false);
    fireEvent.mouseEnter(target); expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.focus(target); expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('visually fitting title ignores rounding-only overflow', () => {
    render(<MapNode data={{ title: 'Team1', kindLabel: 'Offer', layout: nodeLayout }} />);
    const target = screen.getByLabelText('Team1');
    Object.defineProperties(target, {
      clientHeight: { configurable: true, value: 14 },
      scrollHeight: { configurable: true, value: 15 },
      clientWidth: { configurable: true, value: 65 },
      scrollWidth: { configurable: true, value: 65 },
    });
    expect(isRenderedTitleTruncated(target)).toBe(false);
    fireEvent.mouseEnter(target); fireEvent.focus(target);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('genuinely hidden title remains truncated', () => {
    render(<MapNode data={{ title: 'A title hidden beyond the third visible line', kindLabel: 'Offer', layout: nodeLayout }} />);
    const target = screen.getByLabelText('A title hidden beyond the third visible line');
    Object.defineProperties(target, {
      clientHeight: { configurable: true, value: 42 },
      scrollHeight: { configurable: true, value: 56 },
      clientWidth: { configurable: true, value: 65 },
      scrollWidth: { configurable: true, value: 65 },
    });
    expect(isRenderedTitleTruncated(target)).toBe(true);
    fireEvent.mouseEnter(target);
    expect(screen.getByRole('tooltip')).toHaveTextContent('A title hidden beyond the third visible line');
  });
  it('truncated authored title discloses', () => {
    const title = 'AnExactUnbrokenTitleThatIsFarLongerThanTheRoleSizedNodeCanContain';
    render(<section id="map-workspace-panel"><div className="map-disclosure-layer" data-map-disclosure-layer /><MapNode data={{ title, kindLabel: 'Product', layout: nodeLayout }} /></section>);
    const target = screen.getByLabelText(title);
    setTitleOverflow(target, true);
    expect(isRenderedTitleTruncated(target)).toBe(true);
    expect(target).toHaveClass('node-title');
    fireEvent.mouseEnter(target); expect(screen.getByRole('tooltip')).toHaveTextContent(title); expect(screen.getByRole('tooltip').parentElement).toHaveClass('map-disclosure-layer');
    fireEvent.mouseLeave(target); fireEvent.focus(target); expect(screen.getByRole('tooltip')).toHaveTextContent(title);
    fireEvent.blur(target); expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('rename from truncated to fitting clears disclosure', async () => {
    const user = userEvent.setup();
    const longTitle = 'A title that occupies more than the visible title box';
    render(<RenameableMapNode initialTitle={longTitle} />);
    let target = screen.getByLabelText(longTitle); setTitleOverflow(target, true); fireEvent.mouseEnter(target);
    expect(screen.getByRole('tooltip')).toHaveTextContent(longTitle);
    await user.dblClick(target); expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    const editor = screen.getByRole('textbox', { name: `Edit title for ${longTitle}` }); await user.clear(editor); await user.type(editor, 'FP{Enter}');
    target = screen.getByLabelText('FP'); setTitleOverflow(target, false); fireEvent.mouseEnter(target); fireEvent.focus(target);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('rename from fitting to truncated restores eligibility', async () => {
    const user = userEvent.setup();
    const longTitle = 'A renamed title that occupies more than the visible title box';
    render(<RenameableMapNode initialTitle="FP" />);
    let target = screen.getByLabelText('FP'); setTitleOverflow(target, false); await user.dblClick(target);
    const editor = screen.getByRole('textbox', { name: 'Edit title for FP' }); await user.clear(editor); await user.type(editor, `${longTitle}{Enter}`);
    target = screen.getByLabelText(longTitle); setTitleOverflow(target, true); fireEvent.mouseEnter(target);
    expect(screen.getByRole('tooltip')).toHaveTextContent(longTitle);
  });
  it('does not render a redundant Desired Outcome satellite beside its owning Job', () => {
    render(<MapSpike initialDocument={touchpointInspectorDocument()} />);
    expect(screen.queryByRole('button', { name: /Desired Outcome group/ })).not.toBeInTheDocument();
    expect(document.querySelector('[data-node-id="satellite:job:desired_outcome"]')).not.toBeInTheDocument();
  });

  it('does not enter an invisible Relations-mode group for a redundant projection', async () => {
    const user = userEvent.setup();
    render(<MapSpike initialDocument={touchpointInspectorDocument()} />);
    const job = screen.getByRole('button', { name: 'Make progress' });
    await user.click(job);
    fireEvent.keyDown(window, { key: 'r' });
    expect(screen.queryByRole('listbox', { name: 'Desired Outcome relation targets' })).not.toBeInTheDocument();
    expect(job).toHaveAttribute('data-selected', 'true');
  });
  it('workspace shortcut opens single relation target inspector', async () => {
    const user = userEvent.setup();
    const document = touchpointInspectorDocument();
    document.offerFinancialIntents = [{ id: 'offer-fdo', offerId: 'offer-a', financialDesiredOutcomeId: 'fdo' }];
    render(<MapSpike initialDocument={document} />);
    await user.click(screen.getByRole('button', { name: 'Subscription' }));
    fireEvent.keyDown(window, { key: 'r' });
    const targets = screen.getByRole('listbox', { name: 'Financial Desired Outcome relation targets' });
    expect(targets.parentElement).toHaveClass('map-disclosure-layer');
    expect(screen.getByRole('button', { name: 'Financial Desired Outcome group (1)' })).not.toContainElement(targets);
    expect(within(targets).getByRole('option', { name: 'Stay affordable', selected: true })).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'Space', key: ' ', ctrlKey: true, shiftKey: true });
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Stay affordable');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).not.toHaveTextContent('Subscription');
  });
  it('reveals focused Product Job outcome children, removes them on Escape, and keeps follow on the Job', async () => {
    const user = userEvent.setup();
    const document = touchpointInspectorDocument();
    document.productJobIntents = [{ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] }];
    render(<MapSpike initialDocument={document} />);
    expect(globalThis.document.querySelector('[data-node-id^="satellite-child:"]')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Orbit' }));
    fireEvent.keyDown(window, { key: 'r' });
    expect(globalThis.document.querySelector('[data-node-id="satellite-child:product:job:do-a"]')).toBeInTheDocument();
    expect(globalThis.document.querySelector('[data-node-id="satellite-child:product:job:do-b"]')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(globalThis.document.querySelector('[data-node-id^="satellite-child:"]')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.keyDown(window, { code: 'Space', key: ' ', ctrlKey: true, shiftKey: true });
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Make progress');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).not.toHaveTextContent('Finish faster');
  });
  it('portals every relation target with unchanged selected-state semantics', () => {
    render(<section id="map-workspace-panel"><div className="map-disclosure-layer" data-map-disclosure-layer /><div data-node-id="satellite"><MapNode data={{ title: 'Desired Outcome group (2)', kindLabel: 'Desired Outcome', layout: { diameter: 54, titleFontSize: 12, kindFontSize: 10, contentWidth: 42, compactTitle: true }, satellite: { kind: 'desired_outcome', targetIds: ['a', 'b'], titles: ['Finish faster', 'Reduce errors'], focused: true, focusedTargetId: 'b' } }} /></div></section>);
    const targets = screen.getByRole('listbox', { name: 'Desired Outcome relation targets' });
    expect(targets.parentElement).toHaveClass('map-disclosure-layer');
    expect(document.querySelector('[data-node-id="satellite"]')).not.toContainElement(targets);
    expect(within(targets).getAllByRole('option')).toHaveLength(2);
    expect(within(targets).getByRole('option', { name: 'Finish faster', selected: false })).toBeInTheDocument();
    expect(within(targets).getByRole('option', { name: 'Reduce errors', selected: true })).toBeInTheDocument();
    expect(Number.parseFloat(targets.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(targets.style.top)).toBeGreaterThanOrEqual(8);
  });
  it('satellite title disclosure is viewport-aware', () => {
    render(<section id="map-workspace-panel"><div className="map-disclosure-layer" data-map-disclosure-layer /><MapNode data={{ title: 'Desired Outcome group (2)', kindLabel: 'Desired Outcome', layout: { diameter: 54, titleFontSize: 12, kindFontSize: 10, contentWidth: 42, compactTitle: true }, satellite: { kind: 'desired_outcome', targetIds: ['a', 'b'], titles: ['A very long concrete target title', 'Another concrete target title'] } }} /></section>);
    const title = screen.getByLabelText('Desired Outcome: A very long concrete target title, Another concrete target title');
    setTitleOverflow(title, true);
    fireEvent.focus(title);
    const disclosure = screen.getByRole('tooltip');
    expect(disclosure).toHaveTextContent('A very long concrete target title, Another concrete target title');
    expect(disclosure).toHaveClass('satellite-disclosure');
    expect(disclosure.parentElement).toHaveClass('map-disclosure-layer');
    expect(Number.parseFloat(disclosure.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(disclosure.style.top)).toBeGreaterThanOrEqual(8);
  });
  it('double-clicking the title edits while double-clicking the node body opens Inspector', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user);
    const node = screen.getByRole('button', { name: 'Orbit' });
    await user.dblClick(node.querySelector('.node-title')!); expect(screen.getByRole('textbox', { name: 'Edit title for Orbit' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit title for Orbit' }), { key: 'Escape' });
    await user.dblClick(screen.getByRole('button', { name: 'Orbit' }));
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
  });
  it('blank title exit remains in a valid editing state', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user);
    await user.dblClick(screen.getByRole('button', { name: 'Orbit' }).querySelector('.node-title')!);
    const editor = screen.getByRole('textbox', { name: 'Edit title for Orbit' }); await user.clear(editor); fireEvent.blur(editor);
    expect(editor).toBeInTheDocument(); expect(editor).toHaveValue('');
  });
  it('inline title commits on Enter blur and Tab', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user);
    let node = screen.getByRole('button', { name: 'Orbit' }); await user.dblClick(node.querySelector('.node-title')!);
    let editor = screen.getByRole('textbox', { name: 'Edit title for Orbit' }); await user.clear(editor); await user.type(editor, 'Enter title{Enter}');
    node = screen.getByRole('button', { name: 'Enter title' }); await user.dblClick(node.querySelector('.node-title')!);
    editor = screen.getByRole('textbox', { name: 'Edit title for Enter title' }); await user.clear(editor); await user.type(editor, 'Blur title'); fireEvent.blur(editor);
    node = screen.getByRole('button', { name: 'Blur title' }); await user.dblClick(node.querySelector('.node-title')!);
    editor = screen.getByRole('textbox', { name: 'Edit title for Blur title' }); await user.clear(editor); await user.type(editor, 'Tab title'); await user.tab();
    expect(screen.getByRole('button', { name: 'Tab title' })).toBeInTheDocument();
    expect((await openInspector(user)).getByRole('heading', { name: 'Tab title' })).toBeInTheDocument();
  });
  beforeEach(() => { let id = 0; vi.stubGlobal('crypto', { randomUUID: () => `id-${++id}` }); }); afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it('focuses the shared Title once for pointer and keyboard contextual creation and releases it on exit', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    fireEvent.contextMenu(screen.getByLabelText('Map canvas'), { clientX: 140, clientY: 150 });
    await user.click(screen.getByRole('menuitem', { name: 'Product' }));
    let editor = contextualEditor('Add Product'); let title = editor.getByLabelText('Title');
    expect(title).toHaveFocus();
    fireEvent.change(title, { target: { value: 'Orbit' } });
    const cancel = editor.getByRole('button', { name: 'Cancel' }); cancel.focus();
    expect(cancel).toHaveFocus();
    await user.click(editor.getByRole('button', { name: 'Create' }));
    expect(title).not.toHaveFocus(); expect(title).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Orbit' }));
    fireEvent.keyDown(window, { key: 'Tab' });
    await user.click(screen.getByRole('menuitem', { name: 'Offer' })); editor = contextualEditor('Add Offer'); title = editor.getByLabelText('Title');
    expect(title).toHaveFocus();
    await user.type(title, 'Subscription'); await user.click(editor.getByRole('button', { name: 'Create' }));
    expect(title).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Subscription' }));
    fireEvent.keyDown(window, { key: 'Tab' });
    await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); editor = contextualEditor('Add Touchpoint'); title = editor.getByLabelText('Title');
    expect(title).toHaveFocus();
    await user.click(editor.getByRole('button', { name: 'Cancel' }));
    expect(title).not.toBeInTheDocument();
  });
  it('focuses Title when root creation opens and does not refocus it on draft rerenders', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' }));
    const title = screen.getByLabelText('Title'); expect(title).toHaveFocus();
    fireEvent.change(title, { target: { value: 'Root job' } });
    const cancel = screen.getByRole('button', { name: 'Cancel' }); cancel.focus();
    expect(cancel).toHaveFocus();
    await user.click(cancel);
    expect(title).not.toBeInTheDocument();
  });
  it('marks exactly one Inspector root side selected and updates the root choices when switching sides', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' }));
    const business = screen.getByRole('button', { name: 'Business side' });
    const client = screen.getByRole('button', { name: 'Client side' });
    expect(business).toHaveAttribute('aria-pressed', 'true'); expect(client).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Business element type')).toHaveTextContent('Product');
    expect(screen.getByLabelText('Business element type')).toHaveTextContent('Offer');
    expect(screen.getByLabelText('Business element type')).toHaveTextContent('Touchpoint');
    await user.click(client);
    expect(business).toHaveAttribute('aria-pressed', 'false'); expect(client).toHaveAttribute('aria-pressed', 'true');
    await user.click(business);
    expect(business).toHaveAttribute('aria-pressed', 'true'); expect(client).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Business element type')).toHaveValue('product');
  });
  it('requires an Offer root Product and supports existing or inline Product completion', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'offer');
    expect(screen.getByRole('group', { name: 'Which Product does this Offer package?' })).toBeInTheDocument(); expect(screen.queryByText('Linked Product')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Title'), 'Subscription'); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Add an element' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Subscription' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Existing Product'), screen.getByRole('option', { name: 'Orbit' })); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument(); await openMap(user);
    const productId = screen.getByRole('button', { name: 'Orbit' }).getAttribute('data-node-id'); const offerId = screen.getByRole('button', { name: 'Subscription' }).getAttribute('data-node-id'); expect(document.querySelector(`[data-source="${productId}"][data-target="${offerId}"]`)).toBeInTheDocument();

    await openInspector(user); await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'offer'); await user.type(screen.getByLabelText('Title'), 'Bundle'); await user.click(screen.getByLabelText('Create new Product')); expect(screen.getByLabelText('New Product title')).toBeRequired(); await user.type(screen.getByLabelText('New Product title'), 'Nova'); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Bundle' })).toBeInTheDocument(); await openMap(user); expect(screen.getByRole('button', { name: 'Nova' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Bundle' })).toBeInTheDocument();
  });
  it('completes a Touchpoint root from an existing Offer without asking for Product', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); await openInspector(user); await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint');
    expect(screen.getByRole('group', { name: 'Which Offer is presented at this Touchpoint?' })).toBeInTheDocument(); expect(screen.queryByText('Linked Offers')).not.toBeInTheDocument(); expect(screen.queryByText('Which Product does this Offer package?')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Title'), 'Checkout'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' })); await user.click(screen.getByRole('button', { name: 'Create' })); expect(screen.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Linked Offers' })).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Edit linked Offers' })).toBeInTheDocument();
  });
  it('uses one optional searchable and creatable Located in combobox for Touchpoint root creation', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); await openInspector(user);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint');
    const location = screen.getByRole('combobox', { name: 'Located in' });
    expect(location).toHaveValue('');
    for (const text of ['Where does this Touchpoint exist?', 'No location selected', 'Choose an existing location', 'Create new location']) expect(screen.queryByText(text)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/URL/)).not.toBeRequired();
    await user.type(screen.getByLabelText('Title'), 'Unplaced consultation'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' })); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Unplaced consultation' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Edit Located in' })).toBeInTheDocument(); expect(screen.getByText('Add URL')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Add URL' })).toBeInTheDocument();
  });
  it('keeps a new root location as a draft until Touchpoint creation commits it atomically', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); await openInspector(user);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint'); await user.type(screen.getByLabelText('Title'), 'Service page'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' }));
    const location = screen.getByRole('combobox', { name: 'Located in' }); await user.type(location, 'Website'); await user.click(screen.getByRole('option', { name: 'Create "Website"' }));
    expect(location).toHaveValue('Website');
    fireEvent.focus(location); expect(screen.getAllByRole('option', { name: 'Create "Website"' })).toHaveLength(1);
    await user.type(screen.getByLabelText(/URL/), 'https://example.test/service'); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Service page' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Edit Located in, Website' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Edit web address' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint'); await user.type(screen.getByLabelText('Title'), 'Existing location page'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' }));
    const existingLocation = screen.getByRole('combobox', { name: 'Located in' }); await user.type(existingLocation, 'Web'); await user.click(screen.getByRole('option', { name: 'Website' })); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Existing location page' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Edit Located in, Website' })).toBeInTheDocument();
  });
  it('abandons new root location drafts on switching, clearing, cancellation, and validation failure', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); await openInspector(user);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint'); await user.type(screen.getByLabelText('Title'), 'Located seed'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' })); const seedLocation = screen.getByRole('combobox', { name: 'Located in' }); await user.type(seedLocation, 'Website'); await user.click(screen.getByRole('option', { name: 'Create "Website"' })); await user.click(screen.getByRole('button', { name: 'Create' }));
    const begin = async (title: string) => { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint'); await user.type(screen.getByLabelText('Title'), title); };

    await begin('Cancelled point'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' })); let location = screen.getByRole('combobox', { name: 'Located in' }); await user.type(location, 'Abandoned location'); await user.click(screen.getByRole('option', { name: 'Create "Abandoned location"' })); await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await begin('Cleared point'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' })); location = screen.getByRole('combobox', { name: 'Located in' }); await user.type(location, 'Stale location'); await user.click(screen.getByRole('option', { name: 'Create "Stale location"' })); await user.clear(location); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Cleared point' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Edit Located in' })).toBeInTheDocument();

    await begin('Switched point'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' })); location = screen.getByRole('combobox', { name: 'Located in' }); await user.type(location, 'Discard me'); await user.click(screen.getByRole('option', { name: 'Create "Discard me"' })); await user.clear(location); await user.type(location, 'Web'); await user.click(screen.getByRole('option', { name: 'Website' })); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Switched point' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Edit Located in, Website' })).toBeInTheDocument();

    await begin('Invalid chain'); await user.click(screen.getByLabelText('Create new Offer')); await user.type(screen.getByLabelText('New Offer title'), 'Uncommitted offer'); await user.click(screen.getByLabelText('Create new Product')); await user.type(screen.getByLabelText('New Product title'), 'Uncommitted product'); location = screen.getByRole('combobox', { name: 'Located in' }); await user.type(location, 'Uncommitted location'); await user.click(screen.getByRole('option', { name: 'Create "Uncommitted location"' })); await user.clear(screen.getByLabelText('New Offer title')); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Add an element' })).toBeInTheDocument(); fireEvent.focus(location); expect(screen.getByRole('option', { name: 'Create "Uncommitted location"' })).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Cancel' })); await openMap(user);
    for (const name of ['Cancelled point', 'Invalid chain', 'Uncommitted offer', 'Uncommitted product']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  });
  it('atomically chains inline Product and Offer prerequisites for a Touchpoint and ignores stale hidden drafts', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint'); await user.type(screen.getByLabelText('Title'), 'Checkout');
    await user.click(screen.getByLabelText('Create new Offer')); expect(screen.getByLabelText('New Offer title')).toBeRequired(); expect(screen.getByRole('group', { name: 'Which Product does this Offer package?' })).toBeInTheDocument(); await user.type(screen.getByLabelText('New Offer title'), 'Inline Offer'); await user.click(screen.getByLabelText('Create new Product')); await user.type(screen.getByLabelText('New Product title'), 'Inline Product');
    await user.clear(screen.getByLabelText('New Offer title')); await user.click(screen.getByRole('button', { name: 'Create' })); expect(screen.queryByRole('button', { name: 'Inline Product' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('New Offer title'), 'Inline Offer'); await user.click(screen.getByRole('button', { name: 'Create' })); expect(screen.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument(); await openMap(user);
    const product = screen.getByRole('button', { name: 'Inline Product' }); const offer = screen.getByRole('button', { name: 'Inline Offer' }); const touchpoint = screen.getByRole('button', { name: 'Checkout' }); expect(document.querySelector(`[data-source="${product.getAttribute('data-node-id')}"][data-target="${offer.getAttribute('data-node-id')}"]`)).toBeInTheDocument(); expect(document.querySelector(`[data-source="${offer.getAttribute('data-node-id')}"][data-target="${touchpoint.getAttribute('data-node-id')}"]`)).toBeInTheDocument();
    const productPoint = nodePoint('Inline Product'); const offerPoint = nodePoint('Inline Offer'); const touchpointPoint = nodePoint('Checkout');
    expect(nodesOverlap(productPoint, 136, offerPoint, 116)).toBe(false); expect(nodesOverlap(productPoint, 136, touchpointPoint, 96)).toBe(false); expect(nodesOverlap(offerPoint, 116, touchpointPoint, 96)).toBe(false);
    expect(offerPoint.x).toBeGreaterThan(productPoint.x); expect(touchpointPoint.x).toBeGreaterThan(offerPoint.x);
  });
  it('self-constructs a mixed existing Product, new Offer, and new Touchpoint without moving the anchor', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); const before = nodePoint('Orbit'); await openInspector(user);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint'); await user.type(screen.getByLabelText('Title'), 'Mixed Touchpoint'); await user.click(screen.getByLabelText('Create new Offer')); await user.type(screen.getByLabelText('New Offer title'), 'Mixed Offer'); await user.selectOptions(screen.getByLabelText('Existing Product'), screen.getByRole('option', { name: 'Orbit' })); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Mixed Touchpoint' })).toBeInTheDocument(); await openMap(user);
    const product = nodePoint('Orbit'); const offer = nodePoint('Mixed Offer'); const touchpoint = nodePoint('Mixed Touchpoint');
    expect(product).toEqual(before); expect(nodesOverlap(product, 136, offer, 116)).toBe(false); expect(nodesOverlap(product, 136, touchpoint, 96)).toBe(false); expect(nodesOverlap(offer, 116, touchpoint, 96)).toBe(false);
  });
  it('keeps Inspector birth-batch geometry independent of generated UUID values', async () => {
    const createBatch = async (uuid: () => string) => {
      vi.stubGlobal('crypto', { randomUUID: uuid }); const user = userEvent.setup(); render(<MapSpike />); await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint'); await user.type(screen.getByLabelText('Title'), 'Deterministic Touchpoint'); await user.click(screen.getByLabelText('Create new Offer')); await user.type(screen.getByLabelText('New Offer title'), 'Deterministic Offer'); await user.click(screen.getByLabelText('Create new Product')); await user.type(screen.getByLabelText('New Product title'), 'Deterministic Product'); await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user);
      const result = [nodePoint('Deterministic Product'), nodePoint('Deterministic Offer'), nodePoint('Deterministic Touchpoint')]; cleanup(); return result;
    };
    let ascending = 0; const first = await createBatch(() => `ascending-${++ascending}`); let descending = 100; const second = await createBatch(() => `descending-${--descending}`);
    expect(second).toEqual(first);
  });
  it('auto-grows contextual titles for typing and paste while committing a single-line title', async () => {
    vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLTextAreaElement) { return this.value.length > 35 ? 76 : 38; });
    const user = userEvent.setup(); render(<MapSpike />);
    fireEvent.contextMenu(screen.getByLabelText('Map canvas'), { clientX: 140, clientY: 150 }); await user.click(screen.getByRole('menuitem', { name: 'Product' }));
    let editor = contextualEditor('Add Product'); let title = editor.getByLabelText('Title');
    expect(title).toHaveAttribute('rows', '1'); expect(title).toHaveStyle({ height: '38px' });
    await user.type(title, 'A sufficiently long contextual entity title that wraps'); expect(title).toHaveStyle({ height: '76px' });
    await user.click(editor.getByRole('button', { name: 'Cancel' })); expect(screen.queryByRole('heading', { name: 'Add Product' })).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByLabelText('Map canvas'), { clientX: 140, clientY: 150 }); await user.click(screen.getByRole('menuitem', { name: 'Product' }));
    editor = contextualEditor('Add Product'); title = editor.getByLabelText('Title'); await user.click(title); await user.paste('A pasted title that is long enough to wrap\nwithout storing a line break');
    expect(title).toHaveStyle({ height: '76px' }); expect(title).toHaveValue('A pasted title that is long enough to wrap without storing a line break');
    await user.click(editor.getByRole('button', { name: 'Create' })); expect(screen.getByRole('button', { name: 'A pasted title that is long enough to wrap without storing a line break' })).toBeInTheDocument();
  });
  it('uses the shared auto-growing Title field across contextual Product, Offer, Touchpoint, and Client-side creation', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    fireEvent.contextMenu(screen.getByLabelText('Map canvas'), { clientX: 140, clientY: 150 }); await user.click(screen.getByRole('menuitem', { name: 'Product' }));
    let editor = contextualEditor('Add Product'); expect(editor.getByLabelText('Title')).toHaveClass('auto-growing-title'); await user.type(editor.getByLabelText('Title'), 'Orbit'); await user.click(editor.getByRole('button', { name: 'Create' }));
    await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Offer' })); editor = contextualEditor('Add Offer'); expect(editor.getByLabelText('Title')).toHaveClass('auto-growing-title'); await user.type(editor.getByLabelText('Title'), 'Subscription'); await user.click(editor.getByRole('button', { name: 'Create' }));
    await user.click(screen.getByRole('button', { name: 'Subscription' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); editor = contextualEditor('Add Touchpoint'); expect(editor.getByLabelText('Title')).toHaveClass('auto-growing-title'); await user.click(editor.getByRole('button', { name: 'Cancel' }));
    fireEvent.contextMenu(screen.getByLabelText('Map canvas'), { clientX: 300, clientY: 200 }); await user.click(screen.getByRole('menuitem', { name: 'Core Functional Job' })); editor = contextualEditor('Add Core Functional Job'); expect(editor.getByLabelText('Title')).toHaveClass('auto-growing-title'); await user.click(editor.getByRole('button', { name: 'Cancel' }));
  });
  it('registers the custom edge renderer while preserving relationship direction', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user);
    expect(screen.getByLabelText('Map canvas')).toHaveAttribute('data-edge-types', 'mapEdge');
    const edge = document.querySelector('[data-edge-type="mapEdge"]');
    expect(edge).toHaveAttribute('data-source', expect.stringMatching(/^id-/));
    expect(edge).toHaveAttribute('data-target', expect.stringMatching(/^id-/));
    expect(edge).toHaveAttribute('data-marker', 'arrowclosed');
  });
  it('uses accessible peer workspace tabs and starts an empty map through the existing Inspector creation flow', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    const map = screen.getByRole('tab', { name: 'Map' });
    const inspector = screen.getByRole('tab', { name: 'Entity Inspector' });
    expect(map).toHaveAttribute('aria-selected', 'true'); expect(inspector).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel', { name: 'Map' })).toBeVisible();
    await user.click(inspector); expect(inspector).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('This map does not contain any entities yet.')).toBeInTheDocument();
    expect(screen.queryByText('Select an entity on the Map to inspect it.')).not.toBeInTheDocument();
    const emptyMapActions = screen.getByRole('button', { name: 'Add first element' }).closest<HTMLElement>('.actions');
    expect(emptyMapActions).not.toBeNull();
    expect(within(emptyMapActions!).getAllByRole('button')).toEqual([
      screen.getByRole('button', { name: 'Add first element' }),
      screen.getByRole('button', { name: 'Go to Map' }),
    ]);
    await user.click(screen.getByRole('button', { name: 'Add first element' }));
    expect(screen.getByRole('heading', { name: 'Add an element' })).toBeInTheDocument();
    const creationActions = screen.getByRole('heading', { name: 'Add an element' }).closest('form')!.querySelector('.actions')!;
    expect(within(creationActions as HTMLElement).getAllByRole('button').map((button) => button.textContent)).toEqual(['Create', 'Cancel']);
    expect(within(creationActions as HTMLElement).queryByRole('button', { name: 'Create & open Inspector' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Title'), 'First entity');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(inspector).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('First entity');
    expect(within(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).queryByLabelText('Title')).not.toBeInTheDocument();
  });
  it('shows the selection prompt for a non-empty map and Go to Map preserves the document', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user);
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    const inspector = await openInspector(user);
    expect(inspector.getByText('Select an entity on the Map to inspect it.')).toBeInTheDocument();
    expect(inspector.queryByRole('button', { name: 'Add first element' })).not.toBeInTheDocument();
    const actions = inspector.getByRole('button', { name: 'Go to Map' }).closest<HTMLElement>('.actions');
    expect(actions).not.toBeNull();
    expect(within(actions!).getAllByRole('button')).toEqual([inspector.getByRole('button', { name: 'Go to Map' })]);
    await user.click(inspector.getByRole('button', { name: 'Go to Map' }));
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Orbit' })).toBeInTheDocument();
  });
  it('shares selection and document edits between the Map and full Entity Inspector workspace', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user);
    const mapCanvas = screen.getByLabelText('Map canvas'); await user.click(screen.getByRole('button', { name: 'Orbit' }));
    const inspector = await openInspector(user); expect(inspector.getByRole('heading', { name: 'Orbit' })).toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Edit title, Orbit' })); const title = inspector.getByRole('textbox', { name: 'Edit title, Orbit' }); await user.clear(title); await user.type(title, 'Orbit edited{Enter}');
    await openMap(user); expect(screen.getByRole('button', { name: 'Orbit edited' })).toBeInTheDocument(); expect(screen.getByLabelText('Map canvas')).toBe(mapCanvas);
    await openInspector(user); expect(inspector.getByRole('heading', { name: 'Orbit edited' })).toBeInTheDocument();
  });
  it('creates a root through the shared Inspector continuation and preserves its selection on Map', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' }));
    await user.type(screen.getByLabelText('Title'), 'Inspect immediately');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Inspect immediately');
    await openMap(user);
    expect(screen.getByRole('button', { name: 'Inspect immediately' })).toBeInTheDocument();
    await openInspector(user);
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Inspect immediately');
  });
  it('places a standalone Inspector root in a free niche without moving authored nodes', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user);
    const product = screen.getByRole('button', { name: 'Orbit' });
    expect(product).toHaveAttribute('data-x', '80'); expect(product).toHaveAttribute('data-y', '80');
    await user.click(screen.getByRole('button', { name: 'Add element' }));
    await user.click(screen.getByRole('button', { name: 'Client side' }));
    await user.type(screen.getByLabelText('Title'), 'Standalone need');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await openMap(user);
    expect(screen.getByRole('button', { name: 'Standalone need' })).toHaveAttribute('data-x', '240');
    expect(screen.getByRole('button', { name: 'Standalone need' })).toHaveAttribute('data-y', '90');
    expect(product).toHaveAttribute('data-x', '80'); expect(product).toHaveAttribute('data-y', '80');
  });
  it('does not create or change workspace when root creation is invalid or cancelled', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByLabelText('Map canvas')).not.toBeVisible();
    await user.type(screen.getByLabelText('Title'), 'Cancelled');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    await openMap(user);
    expect(screen.queryByRole('button', { name: 'Cancelled' })).not.toBeInTheDocument();
  });
  it('uses the same contextual Offer creation semantics before opening the created entity in Inspector', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user);
    await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Tab' });
    await user.click(screen.getByRole('menuitem', { name: 'Offer' })); const editor = contextualEditor('Add Offer'); await user.type(editor.getByLabelText('Title'), 'Immediate offer');
    await user.click(editor.getByRole('button', { name: 'Create & open Inspector' }));
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Immediate offer');
    await openMap(user);
    const offerId = screen.getByRole('button', { name: 'Immediate offer' }).getAttribute('data-node-id');
    const productId = screen.getByRole('button', { name: 'Orbit' }).getAttribute('data-node-id');
    expect(document.querySelector(`[data-source="${productId}"][data-target="${offerId}"]`)).toBeInTheDocument();
  });
  it.skip('legacy: opens a lightweight Touchpoint in Inspector through the shared continuation', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user);
    await user.click(screen.getByRole('button', { name: 'Subscription' })); fireEvent.keyDown(window, { key: 'Tab' });
    await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); const editor = contextualEditor('Add Touchpoint'); await user.type(editor.getByLabelText('Title'), 'Immediate touchpoint');
    await user.click(editor.getByRole('button', { name: 'Create & open Inspector' }));
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    const inspector = screen.getByRole('tabpanel', { name: 'Entity Inspector' }); expect(inspector).toHaveTextContent('Immediate touchpoint');
    expect(within(inspector).getByLabelText('Located in')).toHaveValue(''); expect(within(inspector).getByLabelText(/URL/)).toHaveValue('');
    expect(within(inspector).getByRole('group', { name: 'Client intent' })).toBeInTheDocument();
    expect(within(inspector).getByRole('group', { name: 'Financial intent' })).toBeInTheDocument();
  });
  it('opens the context-menu target in Entity Inspector and replaces the prior selection', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user);
    await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.contextMenu(screen.getByRole('button', { name: 'Subscription' }));
    await user.click(screen.getByRole('menuitem', { name: 'Open in Entity Inspector' }));
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Subscription');
    await openMap(user); fireEvent.contextMenu(screen.getByRole('button', { name: 'Subscription' })); expect(screen.getByRole('menuitem', { name: 'Open in Entity Inspector' })).toBeInTheDocument();
  });
  it('workspace shortcut preserves the selected entity in both directions', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await user.click(screen.getByRole('button', { name: 'Orbit' }));
    fireEvent.keyDown(window, { code: 'Space', key: ' ', ctrlKey: true, shiftKey: true }); expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Orbit');
    fireEvent.keyDown(window, { code: 'Space', key: ' ', ctrlKey: true, shiftKey: true }); expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
    const platform = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    fireEvent.keyDown(window, { code: 'Space', key: ' ', metaKey: true, shiftKey: true }); expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    platform.mockRestore();
  });
  it('workspace shortcut dismisses an entity menu and opens the selected Inspector', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); const node = screen.getByRole('button', { name: 'Orbit' }); await user.click(node);
    fireEvent.keyDown(window, { key: 'Tab' }); expect(screen.getByRole('menu', { name: 'Entity context menu' })).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'Space', key: ' ', ctrlKey: true, shiftKey: true });
    expect(screen.queryByRole('menu', { name: 'Entity context menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Orbit');
  });
  it('workspace shortcut does not steal editable input', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await user.click(screen.getByRole('tab', { name: 'Entity Inspector' }));
    const textarea = document.createElement('textarea'); document.body.append(textarea); textarea.focus(); fireEvent.keyDown(textarea, { code: 'Space', ctrlKey: true, shiftKey: true }); expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true'); textarea.remove();
    const editable = document.createElement('div'); editable.contentEditable = 'true'; document.body.append(editable); editable.focus(); fireEvent.keyDown(editable, { code: 'Space', ctrlKey: true, shiftKey: true }); expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true'); editable.remove();
  });
  it('workspace shortcut cannot bypass impact confirmation', async () => {
    const user = userEvent.setup(); let document = touchpointInspectorDocument(true);
    let id = 0; document = applyTouchpointIntentDraft(document, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a', 'offer-b'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: () => `seed-${++id}` });
    const inspector = renderTouchpointInspector(document); await user.click(inspector.getByRole('button', { name: 'Edit linked Offers' })); const linkedOffers = within(inspector.getByRole('group', { name: 'Offers property' }));
    await user.click(linkedOffers.getByRole('checkbox', { name: 'Subscription' }));
    const dialog = screen.getByRole('dialog', { name: 'This change affects downstream intent' });
    fireEvent.keyDown(window, { code: 'Space', key: ' ', ctrlKey: true, shiftKey: true });
    expect(dialog).toBeInTheDocument(); expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
  });
  it('focuses and navigates the canvas menu, activates an item, and restores canvas focus on Escape', () => {
    render(<MapSpike />); const canvas = screen.getByLabelText('Map canvas');
    fireEvent.contextMenu(canvas, { clientX: 40, clientY: 50 });
    const product = screen.getByRole('menuitem', { name: 'Product' }); expect(product).toHaveFocus(); expect(screen.queryByRole('menuitem', { name: 'Offer' })).not.toBeInTheDocument();
    fireEvent.keyDown(product, { key: 'End' }); const financial = screen.getByRole('menuitem', { name: 'Financial Desired Outcome' }); expect(financial).toHaveFocus();
    fireEvent.keyDown(financial, { key: 'ArrowDown' }); expect(product).toHaveFocus(); fireEvent.keyDown(product, { key: 'ArrowUp' }); expect(financial).toHaveFocus();
    fireEvent.keyDown(financial, { key: 'Home' }); expect(product).toHaveFocus(); fireEvent.keyDown(product, { key: ' ' }); expect(contextualEditor('Add Product').getByLabelText('Title')).toHaveFocus();
    fireEvent.contextMenu(canvas, { clientX: 40, clientY: 50 }); const reopenedProduct = screen.getByRole('menuitem', { name: 'Product' }); expect(reopenedProduct).toHaveFocus(); fireEvent.keyDown(reopenedProduct, { key: 'Escape' }); expect(screen.queryByRole('menu')).not.toBeInTheDocument(); expect(canvas).toHaveFocus();
  });
  it('returns focus to the source node after navigating and closing its menu', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); const node = screen.getByRole('button', { name: 'Orbit' });
    fireEvent.contextMenu(node); const child = screen.getByRole('menuitem', { name: 'Offer' }); expect(child).toHaveFocus();
    fireEvent.keyDown(child, { key: 'ArrowDown' }); expect(screen.getByRole('menuitem', { name: 'Add sibling' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Home' }); fireEvent.keyDown(document.activeElement!, { key: 'Enter' }); expect(contextualEditor('Add Offer').getByLabelText('Title')).toHaveFocus();
    fireEvent.contextMenu(node); fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Offer' }), { key: 'Escape' }); expect(node).toHaveFocus();
  });
  it('offers all concrete Client-side roots and no generic placeholder', () => {
    render(<MapSpike />);
    fireEvent.contextMenu(screen.getByLabelText('Map canvas'), { clientX: 40, clientY: 50 });
    for (const name of ['Core Functional Job', 'Emotional Job', 'Social Job', 'Consumption Chain Job', 'Financial Desired Outcome']) expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Related Job' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Desired Outcome' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Repulsor' })).not.toBeInTheDocument();
    expect(screen.queryByText('Customer phenomenon')).not.toBeInTheDocument();
  });
  it('creates, edits, siblings, and duplicates one many-target Repulsor through domain-backed UI', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    for (const [kind, title] of [['core_functional_job', 'Progress'], ['social_job', 'Belong']] as const) { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.selectOptions(screen.getByLabelText('Client element type'), kind); await user.type(screen.getByLabelText('Title'), title); await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user); }
    await user.click(screen.getByRole('button', { name: 'Progress' })); fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    const quick = contextualEditor('Add Repulsor'); expect(quick.getByText('Resists: Progress')).toBeInTheDocument(); await user.type(quick.getByLabelText('Title'), 'Fear delay'); await user.click(quick.getByRole('button', { name: 'Create' }));
    const inspector = await openInspector(user); const resists = within(inspector.getByRole('group', { name: 'Resists' }));
    expect(resists.getAllByRole('checkbox')).toHaveLength(2); expect(resists.getByLabelText(/Progress/)).toBeChecked(); expect(resists.getByLabelText(/Belong/)).not.toBeChecked();
    await user.click(resists.getByLabelText(/Belong/)); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); expect(screen.getByText('Changes applied.')).toBeInTheDocument();
    await user.click(resists.getByLabelText(/Progress/)); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); expect(screen.getByText('Changes applied.')).toBeInTheDocument();
    await user.click(within(inspector.getByRole('group', { name: 'Resists' })).getByLabelText(/Belong/)); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); expect(screen.getByRole('status')).toHaveTextContent('at least one'); await user.click(within(inspector.getByRole('group', { name: 'Resists' })).getByLabelText(/Progress/));
    await openMap(user); fireEvent.keyDown(window, { key: 'Enter' }); expect(contextualEditor('Add Repulsor').getByText('Resists: Belong')).toBeInTheDocument(); await user.click(contextualEditor('Add Repulsor').getByRole('button', { name: 'Cancel' }));
    const reverseTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); fireEvent(window, reverseTab); expect(reverseTab.defaultPrevented).toBe(false); fireEvent.contextMenu(screen.getByRole('button', { name: 'Fear delay' })); expect(screen.queryByRole('menuitem', { name: 'Add' })).not.toBeInTheDocument(); expect(screen.queryByRole('menuitem', { name: 'Repulsor' })).not.toBeInTheDocument(); await user.click(screen.getByRole('menuitem', { name: 'Duplicate' })); expect(screen.getAllByRole('button', { name: 'Fear delay' })).toHaveLength(2);
  });
  it('uses one canonical grouped Core Functional Job menu for Tab and right click', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.type(screen.getByLabelText('Title'), 'Make progress'); await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user);
    const node = screen.getByRole('button', { name: 'Make progress' }); await user.click(node); fireEvent.keyDown(window, { key: 'Tab' });
    let menu = screen.getByRole('menu', { name: 'Entity context menu' });
    const expected = ['Related Job', 'Desired Outcome', 'Repulsor', 'Add sibling', 'Duplicate', 'Open in Entity Inspector', 'Cancel'];
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(expected);
    expect(menu).toHaveAttribute('data-invocation', 'keyboard'); expect(menu).toHaveAttribute('data-anchor-x', '206'); expect(menu).toHaveAttribute('data-anchor-y', '158');
    for (const heading of ['Child entities', 'Resistance', 'Structure', 'Entity', 'Actions']) expect(within(menu).getByText(heading)).not.toHaveAttribute('role', 'menuitem');
    const related = within(menu).getByRole('menuitem', { name: 'Related Job' }); const outcome = within(menu).getByRole('menuitem', { name: 'Desired Outcome' }); const resistance = within(menu).getByRole('menuitem', { name: 'Repulsor' }); const sibling = within(menu).getByRole('menuitem', { name: 'Add sibling' }); const cancel = within(menu).getByRole('menuitem', { name: 'Cancel' });
    expect(related).toHaveFocus(); fireEvent.keyDown(related, { key: 'ArrowDown' }); expect(outcome).toHaveFocus(); fireEvent.keyDown(outcome, { key: 'ArrowDown' }); expect(resistance).toHaveFocus(); fireEvent.keyDown(resistance, { key: 'ArrowDown' }); expect(sibling).toHaveFocus(); fireEvent.keyDown(sibling, { key: 'ArrowUp' }); expect(resistance).toHaveFocus();
    fireEvent.keyDown(resistance, { key: 'End' }); expect(cancel).toHaveFocus(); fireEvent.keyDown(cancel, { key: 'ArrowDown' }); expect(related).toHaveFocus(); fireEvent.keyDown(related, { key: 'ArrowUp' }); expect(cancel).toHaveFocus(); fireEvent.keyDown(cancel, { key: 'Home' }); expect(related).toHaveFocus();
    fireEvent.keyDown(related, { key: 'Escape' }); expect(node).toHaveFocus();
    fireEvent.contextMenu(node, { clientX: 320, clientY: 180 }); menu = screen.getByRole('menu', { name: 'Entity context menu' });
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(expected); expect(menu).toHaveAttribute('data-invocation', 'pointer'); expect(menu).toHaveAttribute('data-anchor-x', '320'); expect(menu).toHaveAttribute('data-anchor-y', '180'); expect(within(menu).queryByRole('menuitem', { name: 'Add' })).not.toBeInTheDocument();
    fireEvent.keyDown(within(menu).getByRole('menuitem', { name: 'Related Job' }), { key: ' ' });
    const editor = contextualEditor('Add Related Job'); await user.type(editor.getByLabelText('Title'), 'Coordinate team'); await user.click(editor.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('button', { name: 'Coordinate team' })).toBeInTheDocument();
  });
  it('keeps context-menu and Shift+Tab Repulsor targets aligned across Client roots', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    for (const [kind, title] of [['consumption_chain_job', 'Acquire'], ['emotional_job', 'Feel'], ['social_job', 'Belong'], ['financial_desired_outcome', 'Save']] as const) { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.selectOptions(screen.getByLabelText('Client element type'), kind); await user.type(screen.getByLabelText('Title'), title); await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user); }
    await user.click(screen.getByRole('button', { name: 'Acquire' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Desired Outcome' })); expect(contextualEditor('Add Desired Outcome').getByLabelText('Title')).toHaveValue(''); await user.click(contextualEditor('Add Desired Outcome').getByRole('button', { name: 'Cancel' }));
    for (const title of ['Acquire', 'Feel', 'Belong']) {
      await user.click(screen.getByRole('button', { name: title }));
      const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }); fireEvent(window, tab);
      expect(tab.defaultPrevented).toBe(true); await user.click(screen.getByRole('menuitem', { name: 'Cancel' }));
      const reverseTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); fireEvent(window, reverseTab); expect(reverseTab.defaultPrevented).toBe(true); expect(contextualEditor('Add Repulsor').getByText(`Resists: ${title}`)).toBeInTheDocument(); await user.click(contextualEditor('Add Repulsor').getByRole('button', { name: 'Cancel' }));
      fireEvent.contextMenu(screen.getByRole('button', { name: title })); expect(screen.getByRole('menuitem', { name: 'Repulsor' })).toHaveAttribute('aria-keyshortcuts', 'Shift+Tab'); expect(screen.queryByRole('menuitem', { name: 'Add' })).not.toBeInTheDocument(); await user.click(screen.getByRole('menuitem', { name: 'Repulsor' })); expect(contextualEditor('Add Repulsor').getByText(`Resists: ${title}`)).toBeInTheDocument(); await user.click(contextualEditor('Add Repulsor').getByRole('button', { name: 'Cancel' }));
    }
    const financial = screen.getByRole('button', { name: 'Save' });
    fireEvent.contextMenu(financial); expect(screen.getByRole('menuitem', { name: 'Repulsor' })).toHaveAttribute('aria-keyshortcuts', 'Shift+Tab'); await user.click(screen.getByRole('menuitem', { name: 'Repulsor' }));
    let editor = contextualEditor('Add Repulsor'); expect(editor.getByText('Resists: Save')).toBeInTheDocument(); await user.type(editor.getByLabelText('Title'), 'Budget concern'); await user.click(editor.getByRole('button', { name: 'Create' }));
    const financialId = financial.getAttribute('data-node-id'); const menuRepulsorId = screen.getByRole('button', { name: 'Budget concern' }).getAttribute('data-node-id');
    expect(document.querySelector(`[data-source="${menuRepulsorId}"][data-target="${financialId}"]`)).toHaveAttribute('data-marker', 'arrowclosed');
    await user.click(screen.getByRole('button', { name: 'Save' })); const financialShortcut = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); fireEvent(window, financialShortcut); expect(financialShortcut.defaultPrevented).toBe(true);
    editor = contextualEditor('Add Repulsor'); expect(editor.getByText('Resists: Save')).toBeInTheDocument(); await user.type(editor.getByLabelText('Title'), 'Margin concern'); await user.click(editor.getByRole('button', { name: 'Create' }));
    const shortcutRepulsorId = screen.getByRole('button', { name: 'Margin concern' }).getAttribute('data-node-id');
    expect(document.querySelector(`[data-source="${shortcutRepulsorId}"][data-target="${financialId}"]`)).toHaveAttribute('data-marker', 'arrowclosed');
  });
  it('creates blank contextual siblings under the same parent and edits the semantic parent in Inspector', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    for (const title of ['Core A', 'Core B']) { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.type(screen.getByLabelText('Title'), title); await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user); }
    await user.click(screen.getByRole('button', { name: 'Core A' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Desired Outcome' })); let editor = contextualEditor('Add Desired Outcome'); await user.type(editor.getByLabelText('Title'), 'Faster'); await user.click(editor.getByRole('button', { name: 'Create' }));
    fireEvent.keyDown(window, { key: 'Enter' }); editor = contextualEditor('Add Desired Outcome'); expect(editor.getByLabelText('Title')).toHaveValue(''); await user.type(editor.getByLabelText('Title'), 'Safer'); await user.click(editor.getByRole('button', { name: 'Create' }));
    const inspector = await openInspector(user); expect(inspector.getByLabelText('Semantic parent')).not.toHaveValue(''); await user.selectOptions(inspector.getByLabelText('Semantic parent'), within(inspector.getByLabelText('Semantic parent')).getByRole('option', { name: 'Core B' })); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); expect(screen.getByText('Changes applied.')).toBeInTheDocument();
    await openMap(user); fireEvent.contextMenu(screen.getByRole('button', { name: 'Safer' })); expect(screen.queryByRole('menuitem', { name: 'Add' })).not.toBeInTheDocument(); expect(screen.queryByRole('menuitem', { name: 'Repulsor' })).not.toBeInTheDocument(); await user.click(screen.getByRole('menuitem', { name: 'Duplicate' })); expect(screen.getAllByRole('button', { name: 'Safer' })).toHaveLength(2);
  });
  it('creates same-kind Client-side siblings and duplicates without inventing a Tab child', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' }));
    await user.click(screen.getByRole('button', { name: 'Client side' }));
    await user.selectOptions(screen.getByLabelText('Client element type'), 'emotional_job');
    await user.type(screen.getByLabelText('Title'), 'Feel confident');
    await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user);
    expect(screen.getByText('Emotional Job')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Feel confident' }));
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }); fireEvent(window, tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(screen.getByRole('menuitem', { name: 'Repulsor' })).toBeInTheDocument(); fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Repulsor' }), { key: 'Escape' });
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Feel confident' }));
    expect(screen.queryByRole('menuitem', { name: 'Add' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Repulsor' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Add sibling' }));
    expect(contextualEditor('Add Emotional Job').getByLabelText('Title')).toHaveValue('');
    await user.click(contextualEditor('Add Emotional Job').getByRole('button', { name: 'Cancel' }));

    fireEvent.keyDown(window, { key: 'c', ctrlKey: true }); fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    expect(screen.getAllByRole('button', { name: 'Feel confident' })).toHaveLength(2);
    expect(screen.getAllByText('Emotional Job')).toHaveLength(2);
  });
  it('keeps overlay and flow coordinates separate for contextual canvas creation', async () => { const user = userEvent.setup(); render(<MapSpike />); fireEvent.contextMenu(screen.getByLabelText('Map canvas'), { clientX: 140, clientY: 150 }); await user.click(screen.getByRole('menuitem', { name: 'Product' })); const editor = contextualEditor('Add Product'); await user.type(editor.getByLabelText('Title'), 'Placed'); await user.click(editor.getByRole('button', { name: 'Create' })); expect(screen.getByRole('button', { name: 'Placed' })).toHaveAttribute('data-x', '130'); expect(screen.getByRole('button', { name: 'Placed' })).toHaveAttribute('data-y', '130'); });
  it('keeps Product creation compact and draft-only until Create', async () => {
    const user = userEvent.setup();
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('canvas-panel')) return DOMRect.fromRect({ x: 0, y: 0, width: 600, height: 400 });
      if (this.classList.contains('context-menu')) return DOMRect.fromRect({ width: 160, height: 180 });
      if (this.classList.contains('contextual-editor')) return DOMRect.fromRect({ width: 304, height: 180 });
      return DOMRect.fromRect();
    });
    render(<MapSpike />); fireEvent.contextMenu(screen.getByLabelText('Map canvas'), { clientX: 580, clientY: 380 }); await user.click(screen.getByRole('menuitem', { name: 'Product' }));
    let editor = contextualEditor('Add Product'); expect(editor.getByLabelText('Title')).toBeInTheDocument(); expect(editor.getByRole('button', { name: 'Create' })).toBeInTheDocument(); expect(editor.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    for (const control of ['Which Client Jobs does this Product intend to address?', 'Add Core Functional Job', 'Add Emotional Job', 'Add Social Job', 'Add Consumption Chain Job', 'Add Desired Outcome']) expect(editor.queryByText(control)).not.toBeInTheDocument();
    expect(screen.queryAllByText(/Product|Client|Desired Outcome/).filter((element) => element.closest('[aria-label="Map canvas"]'))).toHaveLength(0);
    await user.type(editor.getByLabelText('Title'), 'Cancelled Product'); expect(screen.queryByRole('button', { name: 'Cancelled Product' })).not.toBeInTheDocument(); await user.click(editor.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Cancelled Product' })).not.toBeInTheDocument(); expect(document.querySelector('[data-source], [data-target]')).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByLabelText('Map canvas'), { clientX: 580, clientY: 380 }); await user.click(screen.getByRole('menuitem', { name: 'Product' })); editor = contextualEditor('Add Product'); await user.type(editor.getByLabelText('Title'), 'Orbit'); await user.click(editor.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true'); expect(screen.getByRole('button', { name: 'Orbit' })).toBeInTheDocument(); expect(document.querySelector('[data-source], [data-target]')).not.toBeInTheDocument();
    const inspector = await openInspector(user); expect(inspector.getByRole('heading', { name: 'Orbit' })).toBeInTheDocument(); expect(inspector.getByRole('group', { name: 'Client intent' })).toBeInTheDocument();
    bounds.mockRestore();
  });
  it('creates an Offer structurally without initializing semantic intent', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.selectOptions(screen.getByLabelText('Client element type'), 'financial_desired_outcome'); await user.type(screen.getByLabelText('Title'), 'Stay affordable'); await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user);
    await globalProduct(user); const inspector = await openInspector(user); const jobs = inspector.getByRole('group', { name: 'Client intent' }); await user.click(within(jobs).getByRole('button', { name: '+ Add Client Job' })); await user.click(within(jobs).getByRole('button', { name: 'Core Functional Job' })); await user.type(within(jobs).getByLabelText('New Client Job title'), 'Make progress{Enter}');
    expect(within(jobs).getByRole('checkbox', { name: /^Make progress\s*Core Functional Job$/ })).toBeChecked(); await user.click(within(jobs).getByRole('button', { name: 'Expand Make progress' })); await user.click(within(jobs).getByRole('button', { name: '+ Add Desired Outcome' })); await user.type(within(jobs).getByLabelText('New Desired Outcome title'), 'Finish faster{Enter}'); expect(within(jobs).getByLabelText('Finish faster')).toBeChecked(); await user.click(inspector.getByRole('button', { name: 'Apply changes' }));
    await openMap(user); await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Offer' })); let offer = contextualEditor('Add Offer');
    expect(offer.getByLabelText('Title')).toBeInTheDocument(); expect(offer.getByRole('button', { name: 'Create' })).toBeInTheDocument(); expect(offer.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(offer.queryByText('Which parts of this Product’s Client intent does this Offer carry?')).not.toBeInTheDocument(); expect(offer.queryByText('Which financial criteria does this Offer address?')).not.toBeInTheDocument(); expect(offer.queryByLabelText('Linked Product')).not.toBeInTheDocument(); expect(offer.queryByText(/Touchpoint distribution/i)).not.toBeInTheDocument();
    const initialEdgeCount = document.querySelectorAll('[data-edge-type="mapEdge"]').length; await user.type(offer.getByLabelText('Title'), 'Cancelled'); expect(screen.queryByRole('button', { name: 'Cancelled' })).not.toBeInTheDocument(); expect(document.querySelectorAll('[data-edge-type="mapEdge"]')).toHaveLength(initialEdgeCount); await user.click(offer.getByRole('button', { name: 'Cancel' })); expect(screen.queryByRole('button', { name: 'Cancelled' })).not.toBeInTheDocument(); expect(document.querySelectorAll('[data-edge-type="mapEdge"]')).toHaveLength(initialEdgeCount);
    fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Offer' })); offer = contextualEditor('Add Offer'); await user.type(offer.getByLabelText('Title'), 'Subscription'); await user.click(offer.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true'); expect(screen.getByRole('button', { name: 'Subscription' })).toBeInTheDocument(); expect(document.querySelectorAll('[data-edge-type="mapEdge"]')).toHaveLength(initialEdgeCount + 1);
    const offerInspector = await openInspector(user); expect(offerInspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument(); const offerJobs = offerInspector.getByRole('group', { name: 'Client intent' }); const jobSelection = within(offerJobs).getByRole('checkbox', { name: /^Make progress\s*Core Functional Job$/ }); expect(jobSelection).not.toBeChecked();
    await user.click(within(offerJobs).getByRole('button', { name: 'Expand Make progress' })); expect(jobSelection).not.toBeChecked(); expect(within(offerJobs).getByRole('checkbox', { name: 'Finish faster' })).not.toBeChecked();
    const financial = offerInspector.getByRole('group', { name: 'Financial intent' }); expect(within(financial).getByRole('checkbox', { name: /^Stay affordable\s*Financial Desired Outcome$/ })).not.toBeChecked(); expect(offerInspector.getByRole('button', { name: 'Apply changes' })).toBeInTheDocument();
  });
  it('uses Product + Tab for contextual Offer creation while Tab in inputs stays native', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); expect(screen.queryByText('packaged as')).not.toBeInTheDocument(); const inspector = await openInspector(user); await user.click(inspector.getByRole('button', { name: 'Edit title, Subscription' })); const title = inspector.getByRole('textbox', { name: 'Edit title, Subscription' }); title.focus(); const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }); title.dispatchEvent(event); expect(event.defaultPrevented).toBe(false); const reverse = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); title.dispatchEvent(reverse); expect(reverse.defaultPrevented).toBe(false); });
  it('uses Enter for an empty sibling editor and activates the Inspector title button', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Enter' }); const editor = contextualEditor('Add Product'); const title = editor.getByLabelText('Title'); expect(title).toHaveFocus(); expect(title).toHaveValue(''); await user.type(title, 'Nova{Enter}'); expect(screen.getByRole('button', { name: 'Nova' })).toBeInTheDocument(); expect(screen.queryByRole('heading', { name: 'Add Product' })).not.toBeInTheDocument(); const inspector = await openInspector(user); const inspectorTitle = inspector.getByRole('button', { name: 'Edit title, Nova' }); inspectorTitle.focus(); await user.keyboard('{Enter}'); expect(inspector.getByRole('textbox', { name: 'Edit title, Nova' })).toHaveFocus(); expect(screen.queryByRole('heading', { name: 'Add Product' })).not.toBeInTheDocument(); });
  it('offers the same sibling flow from the node context menu without overlapping the selected root', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); const original = screen.getByRole('button', { name: 'Orbit' }); const before = { x: original.getAttribute('data-x'), y: original.getAttribute('data-y') }; fireEvent.contextMenu(original); await user.click(screen.getByRole('menuitem', { name: 'Add sibling' })); const editor = contextualEditor('Add Product'); expect(editor.getByLabelText('Title')).toHaveValue(''); await user.type(editor.getByLabelText('Title'), 'Nova'); await user.click(editor.getByRole('button', { name: 'Create' })); const sibling = screen.getByRole('button', { name: 'Nova' }); const dx = Number(sibling.getAttribute('data-x')) - Number(before.x); const dy = Number(sibling.getAttribute('data-y')) - Number(before.y); expect(Math.abs(dx) >= 136 || Math.abs(dy) >= 136).toBe(true); expect(original).toHaveAttribute('data-x', before.x); expect(original).toHaveAttribute('data-y', before.y); });
  it('keeps clipboard duplication distinct from empty sibling creation', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'c', ctrlKey: true }); fireEvent.keyDown(window, { key: 'v', ctrlKey: true }); expect(screen.getAllByRole('button', { name: 'Orbit' })).toHaveLength(2); });
  it('creates Touchpoint and Child Touchpoint through the compact structural form', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user);
    await user.click(screen.getByRole('button', { name: 'Subscription' })); fireEvent.keyDown(window, { key: 'Tab' });
    await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); let editor = contextualEditor('Add Touchpoint');
    expect(editor.getByLabelText('Title')).toBeInTheDocument();
    expect(editor.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(editor.getByRole('button', { name: 'Create & open Inspector' })).toBeInTheDocument();
    expect(editor.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    for (const label of ['Located in', 'URL', 'Initial Client-intent scope']) expect(editor.queryByLabelText(label)).not.toBeInTheDocument();
    expect(editor.queryByText(/Desired Outcome|Financial|mitigat/i)).not.toBeInTheDocument();
    await user.type(editor.getByLabelText('Title'), 'Checkout'); await user.click(editor.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: 'Checkout' })); fireEvent.keyDown(window, { key: 'Tab' });
    await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); editor = contextualEditor('Add Touchpoint'); expect(editor.queryByLabelText('Located in')).not.toBeInTheDocument();
    await user.type(editor.getByLabelText('Title'), 'Payment'); await user.click(editor.getByRole('button', { name: 'Create' }));
    const inspector = await openInspector(user); expect(within(inspector.getByRole('group', { name: 'Parent property' })).getByRole('button', { name: 'Checkout' })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Edit Located in' })).toBeInTheDocument(); expect(inspector.queryByRole('combobox', { name: 'Located in' })).not.toBeInTheDocument(); expect(inspector.getByRole('button', { name: 'Edit web address' })).toBeInTheDocument(); expect(inspector.queryByRole('textbox', { name: 'URL' })).not.toBeInTheDocument();
  });
  it.skip('legacy: shows an incomplete DO-bearing Job as a disclosure-only unfinished branch', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.type(screen.getByLabelText('Title'), 'Make progress'); await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user);
    await globalProduct(user); await quickOffer(user); await user.click(screen.getByRole('button', { name: 'Subscription' })); fireEvent.keyDown(window, { key: 'Tab' });
    await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); const creator = contextualEditor('Add Touchpoint'); await user.type(creator.getByLabelText('Title'), 'Checkout'); await user.click(creator.getByRole('button', { name: 'Create' }));
    const inspector = await openInspector(user); const intent = within(inspector.getByRole('group', { name: 'Client intent' }));
    expect(intent.getByRole('heading', { name: 'Touchpoint intent' })).toBeInTheDocument(); expect(intent.getByRole('heading', { name: 'Other Client intent' })).toBeInTheDocument();
    expect(intent.queryByRole('checkbox', { name: /Make progress/ })).not.toBeInTheDocument();
    await user.click(intent.getByRole('button', { name: 'Expand Make progress' })); expect(intent.getByText('Desired Outcome not described yet')).toBeInTheDocument();
    for (const removed of ['Add client intent', 'Confirm client intent', 'Change preview']) expect(inspector.queryByText(removed)).not.toBeInTheDocument();
  });
  it('cancels a minimal Touchpoint draft without mutating the map', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user);
    const edgeCount = document.querySelectorAll('[data-edge-type="mapEdge"]').length;
    await user.click(screen.getByRole('button', { name: 'Subscription' })); fireEvent.keyDown(window, { key: 'Tab' });
    await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); const editor = contextualEditor('Add Touchpoint'); await user.type(editor.getByLabelText('Title'), 'Checkout');
    expect(screen.queryByRole('button', { name: 'Checkout' })).not.toBeInTheDocument(); await user.click(editor.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Checkout' })).not.toBeInTheDocument(); expect(document.querySelectorAll('[data-edge-type="mapEdge"]')).toHaveLength(edgeCount);
  });
  it('duplicates through node context action and exposes safe URL editing/opening', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); fireEvent.contextMenu(screen.getByRole('button', { name: 'Orbit' })); await user.click(screen.getByRole('menuitem', { name: 'Duplicate' })); expect(screen.getAllByRole('button', { name: 'Orbit' })).toHaveLength(2); expect(screen.getByText('Element duplicated.')).toBeInTheDocument(); });
  it('uses a duplicated Touchpoint as the selected structural parent', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user);
    await user.click(screen.getByRole('button', { name: 'Subscription' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); let editor = contextualEditor('Add Touchpoint');
    await user.type(editor.getByLabelText('Title'), 'Front Page'); await user.click(editor.getByRole('button', { name: 'Create' }));
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Front Page' })); await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    const inspector = await openInspector(user); await user.click(inspector.getByRole('button', { name: /Edit title, Front Page/ })); const title = inspector.getByRole('textbox', { name: /Edit title, Front Page/ }); await user.clear(title); await user.type(title, 'Services{Enter}');
    await openMap(user); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); editor = contextualEditor('Add Touchpoint'); await user.type(editor.getByLabelText('Title'), 'Notion Example'); await user.click(editor.getByRole('button', { name: 'Create' }));
    await openInspector(user); expect(within(inspector.getByRole('group', { name: 'Parent property' })).getByRole('button', { name: 'Services' })).toBeInTheDocument(); expect(inspector.queryByLabelText('Parent Touchpoint')).not.toBeInTheDocument();
  });
  it('cancels a contextual draft without inserting an entity', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Offer' })); await user.type(contextualEditor('Add Offer').getByLabelText('Title'), 'Draft offer'); fireEvent.keyDown(window, { key: 'Escape' }); expect(screen.queryByText('Draft offer')).not.toBeInTheDocument(); expect(screen.queryByText('packaged as')).not.toBeInTheDocument(); });
  it('keeps durable Product branches stable, restores draft outcome scope, and rebuilds sections after Apply', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.type(screen.getByLabelText('Title'), 'Make progress'); await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user);
    await user.click(screen.getByRole('button', { name: 'Make progress' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Desired Outcome' })); const outcomeEditor = contextualEditor('Add Desired Outcome'); await user.type(outcomeEditor.getByLabelText('Title'), 'Finish faster'); await user.click(outcomeEditor.getByRole('button', { name: 'Create' }));
    await globalProduct(user); const inspector = await openInspector(user); const intent = inspector.getByRole('group', { name: 'Client intent' });
    const otherHeading = within(intent).getByRole('heading', { name: 'Other Client Jobs' });
    await user.click(within(intent).getByRole('button', { name: 'Expand Make progress' }));
    expect(otherHeading.compareDocumentPosition(within(intent).getByText('Make progress')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(within(intent).getByRole('checkbox', { name: /^Make progress\s*Core Functional Job$/ }));
    expect(otherHeading.compareDocumentPosition(within(intent).getByText('Make progress')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(within(intent).getByLabelText('Finish faster'));
    await user.click(within(intent).getByRole('checkbox', { name: /^Make progress\s*Core Functional Job$/ })); expect(within(intent).getByLabelText('Finish faster')).not.toBeChecked();
    await user.click(within(intent).getByRole('checkbox', { name: /^Make progress\s*Core Functional Job$/ })); expect(within(intent).getByLabelText('Finish faster')).toBeChecked();
    await user.click(inspector.getByRole('button', { name: 'Apply changes' }));
    expect(within(intent).getByRole('heading', { name: 'Product intent' }).compareDocumentPosition(within(intent).getByText('Make progress')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('does not treat an immediate Inspector title commit as an Apply-owned dirty change', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); const inspector = await openInspector(user);
    await user.click(inspector.getByRole('button', { name: 'Edit title, Orbit' })); const editor = inspector.getByRole('textbox', { name: 'Edit title, Orbit' }); await user.clear(editor); await user.type(editor, 'Orbit durable{Enter}');
    expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add element' })); expect(screen.queryByRole('dialog', { name: 'Unsaved Product changes' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add an element' })).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Cancel' })); await openMap(user); expect(screen.getByRole('button', { name: 'Orbit durable' })).toBeInTheDocument();
  });

});

it('renders an accessible peripheral link only for a safe Touchpoint URL', () => {
  const layout = { diameter: 96, titleFontSize: 14, kindFontSize: 12, contentWidth: 65, compactTitle: false };
  const { rerender } = render(<MapNode data={{ title: 'Front Page', kindLabel: 'Touchpoint', url: '/front', layout }} />);
  const mapLink = screen.getByRole('link', { name: 'Open Front Page' });
  expect(mapLink).toHaveClass('node-link', 'nodrag', 'nopan');
  expect(mapLink).toHaveTextContent('↗');
  rerender(<MapNode data={{ title: 'Unsafe', kindLabel: 'Touchpoint', url: 'javascript:alert(1)', layout }} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

describe('searchable Touchpoint connection picker', () => {
  afterEach(() => cleanup());
  it('renders only non-empty Offer sources as independently closed disclosures', async () => {
    const document = touchpointInspectorDocument(true);
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a'] });
    document.offerJobSelections.push({ id: 'offer-selection', offerId: 'offer-a', productJobIntentId: 'intent' });
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    const subscription = within(scope).getByRole('button', { name: 'Offer · Subscription' });
    expect(subscription).toHaveAttribute('aria-expanded', 'false');
    expect(subscription).toHaveAttribute('aria-controls');
    expect(within(scope).queryByRole('button', { name: 'Offer · Consulting' })).not.toBeInTheDocument();
    expect(within(scope).queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(subscription);
    expect(within(scope).getByRole('checkbox', { name: 'Finish faster' })).toBeInTheDocument();
    expect(within(scope).queryByText('Consulting')).not.toBeInTheDocument();
  });
  it('expands and narrows one durable Offer path through sibling DO checkboxes', async () => {
    const document = touchpointInspectorDocument();
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] });
    document.offerJobSelections.push({ id: 'offer-selection', offerId: 'offer-a', productJobIntentId: 'intent' });
    document.touchpointJobSelections.push({ id: 'touch-selection', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] });
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    expect(within(scope).queryByRole('heading', { name: 'Upstream Client intent' })).not.toBeInTheDocument();
    const source = within(scope).getByRole('button', { name: 'Offer · Subscription' });
    expect(source).toHaveAttribute('aria-expanded', 'false');
    expect(within(scope).queryByRole('checkbox', { name: 'Finish faster' })).not.toBeInTheDocument();
    await user.click(source);
    expect(source).toHaveAttribute('aria-expanded', 'true');
    expect(within(scope).getByRole('checkbox', { name: 'Finish faster' })).toBeChecked();
    await user.click(within(scope).getByRole('checkbox', { name: 'Reduce errors' }));
    expect(within(scope).getByRole('checkbox', { name: 'Finish faster' })).toBeChecked();
    expect(within(scope).getByRole('checkbox', { name: 'Reduce errors' })).toBeChecked();
    await user.click(within(scope).getByRole('checkbox', { name: 'Finish faster' }));
    expect(within(scope).getByRole('checkbox', { name: 'Finish faster' })).not.toBeChecked();
    expect(document.productJobIntents[0]?.addressedDesiredOutcomeIds).toEqual(['do-a', 'do-b']);
    expect(document.offerJobSelections).toEqual([{ id: 'offer-selection', offerId: 'offer-a', productJobIntentId: 'intent' }]);
  });
  it('keeps Parent-source editing open and uses the projected owning Job and Child contributor', async () => {
    const document = touchpointInspectorDocument();
    document.entities.push({ id: 'parent-offer', kind: 'offer', title: 'Parent provenance' }, { id: 'parent', kind: 'touchpoint', title: 'Parent' });
    document.relationships.push(
      { id: 'package-parent', kind: 'product_packaged_as_offer', productId: 'product', offerId: 'parent-offer' },
      { id: 'present-parent', kind: 'offer_presented_at_touchpoint', offerId: 'parent-offer', touchpointId: 'parent' },
      { id: 'contains-child', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'parent', childTouchpointId: 'touch' },
    );
    document.productJobIntents.push({ id: 'parent-intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a'] });
    document.offerJobSelections.push({ id: 'parent-offer-intent', offerId: 'parent-offer', productJobIntentId: 'parent-intent' });
    document.touchpointJobSelections.push({ id: 'parent-path', touchpointId: 'parent', offerId: 'parent-offer', productJobIntentId: 'parent-intent', addressedDesiredOutcomeIds: ['do-a'] });
    document.placements.push({ viewId: 'spike-view', entityId: 'parent-offer', x: 1120, y: 0 }, { viewId: 'spike-view', entityId: 'parent', x: 1260, y: 0 });
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    expect(within(scope).queryByRole('button', { name: 'Offer · Subscription' })).not.toBeInTheDocument();
    await user.click(within(scope).getByRole('button', { name: 'Parent · Parent' }));
    await user.click(within(scope).getByRole('checkbox', { name: 'Finish faster' }));
    expect(within(scope).getByRole('button', { name: 'Close Client scope authoring' })).not.toHaveAttribute('aria-pressed');
    expect(within(scope).getByRole('checkbox', { name: 'Finish faster' })).toBeChecked();
    expect(within(scope).getAllByText('via Subscription')).toHaveLength(2);
    expect(within(scope).queryByRole('checkbox', { name: 'via Subscription' })).not.toBeInTheDocument();
    expect(within(scope).queryByRole('button', { name: 'Remove Subscription contributor' })).not.toBeInTheDocument();
    expect(scope).toHaveTextContent('Parent provenance · Parent provenance');
    expect(document.relationships.some(relation => relation.kind === 'offer_presented_at_touchpoint' && relation.offerId === 'parent-offer' && relation.touchpointId === 'touch')).toBe(false);
  });
  it('places the Client scope action inside its semantic heading', () => {
    const inspector = renderTouchpointInspector();
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    const heading = within(scope).getByRole('heading', { name: 'Client scope' });
    const action = within(scope).getByRole('button', { name: 'Edit Client scope' });
    const headingRow = heading.closest('.touchpoint-client-scope-heading');

    expect(headingRow).toContainElement(heading);
    expect(heading).toContainElement(action);
    expect(action).toHaveTextContent('Client scope');
    expect(action).not.toHaveTextContent('✎');
    expect(action).toHaveClass('inspector-property-heading-action');
  });

  it('keeps Client scope authoring as discovery followed by semantic source disclosures', async () => {
    const document = touchpointInspectorDocument();
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a'] });
    document.offerJobSelections.push({ id: 'offer-selection', offerId: 'offer-a', productJobIntentId: 'intent' });
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    const scope = inspector.getByRole('region', { name: 'Client scope' });

    expect(scope.querySelectorAll('.global-intent-discovery')).toHaveLength(1);
    const sourceList = scope.querySelector<HTMLElement>('.intent-source-list');
    expect(sourceList).toBeInTheDocument();
    const sources = sourceList!.querySelectorAll<HTMLElement>('.intent-source-disclosure');
    expect(sources.length).toBeGreaterThan(0);
    sources.forEach(source => {
      expect(source.parentElement).toBe(sourceList);
      expect(source.tagName).toBe('SECTION');
    });

    const toggle = sources[0]!.querySelector<HTMLButtonElement>('.intent-source-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls');
    await user.click(toggle!);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const disclosureId = toggle!.getAttribute('aria-controls')!;
    expect(scope.ownerDocument.getElementById(disclosureId)).toHaveClass('intent-source-dendrite');
    expect(within(scope).queryByRole('button', { name: /done|save|apply/i })).not.toBeInTheDocument();
  });

  it('uses a dismiss control without presenting Client scope as a completion step', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    const headingAction = within(scope).getByRole('button', { name: 'Edit Client scope' });
    expect(headingAction).toHaveTextContent('Client scope');
    expect(headingAction).not.toHaveTextContent('✎');
    expect(headingAction).not.toHaveAttribute('aria-pressed');

    await user.click(headingAction);

    const close = within(scope).getByRole('button', { name: 'Close Client scope authoring' });
    expect(close).toHaveTextContent('Close');
    expect(close).not.toHaveAttribute('aria-pressed');
    expect(close).not.toHaveTextContent('×');
    expect(close).not.toHaveTextContent('Done');
    expect(close).not.toHaveTextContent('Save');
    expect(close).not.toHaveTextContent('Apply');
    expect(scope).not.toHaveTextContent('Changes apply immediately');
    expect(inspector.queryByRole('button', { name: 'Apply changes' })).not.toBeInTheDocument();
    expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();

    expect(window.__VEE_DEV__!.dump().touchpointJobSelections).toEqual([]);
    await user.type(within(scope).getByRole('searchbox', { name: 'Search Client intent' }), 'Finish faster');
    await user.click(within(scope).getByRole('checkbox', { name: 'Finish faster' }));
    const committed = structuredClone(window.__VEE_DEV__!.dump());
    expect(committed.touchpointJobSelections).toEqual([expect.objectContaining({ touchpointId: 'touch', addressedDesiredOutcomeIds: ['do-a'] })]);

    await user.click(close);
    await act(() => new Promise(resolve => requestAnimationFrame(resolve)));

    expect(window.__VEE_DEV__!.dump()).toEqual(committed);
    expect(within(scope).queryByRole('searchbox', { name: 'Search Client intent' })).not.toBeInTheDocument();
    expect(within(scope).getByRole('button', { name: 'Edit Client scope' })).toHaveFocus();
    expect(within(scope).getByRole('button', { name: 'Core Functional Job, 1' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(scope).getByRole('button', { name: 'Finish faster' })).toBeInTheDocument();
    expect(within(scope).getByRole('button', { name: 'Edit Client scope' })).toHaveTextContent('Client scope');
    expect(inspector.queryByRole('button', { name: 'Apply changes' })).not.toBeInTheDocument();
    expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('closes Client scope without creating a durable staged draft or footer', async () => {
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector();
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    const beforeClose = structuredClone(window.__VEE_DEV__!.dump());
    await user.click(inspector.getByRole('button', { name: 'Close Client scope authoring' }));
    expect(window.__VEE_DEV__!.dump()).toEqual(beforeClose);
    expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(inspector.queryByRole('button', { name: 'Apply changes' })).not.toBeInTheDocument();
  });

  it('Escape closes Client scope without creating a durable staged draft or footer', async () => {
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector();
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    const beforeEscape = structuredClone(window.__VEE_DEV__!.dump());
    fireEvent.keyDown(scope, { key: 'Escape' });
    await act(() => new Promise(resolve => requestAnimationFrame(resolve)));
    expect(window.__VEE_DEV__!.dump()).toEqual(beforeEscape);
    expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(inspector.queryByRole('button', { name: 'Apply changes' })).not.toBeInTheDocument();
    expect(within(scope).getByRole('button', { name: 'Edit Client scope' })).toHaveFocus();
  });

  it('closes non-empty and kind-filtered discovery with one Escape', async () => {
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector();
    const scope = inspector.getByRole('region', { name: 'Client scope' });

    await user.click(within(scope).getByRole('button', { name: 'Edit Client scope' }));
    await user.type(within(scope).getByRole('searchbox', { name: 'Search Client intent' }), 'errors');
    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(within(scope).getByRole('button', { name: 'Edit Client scope' })).toHaveFocus());
    expect(within(scope).queryByRole('searchbox', { name: 'Search Client intent' })).not.toBeInTheDocument();

    await user.click(within(scope).getByRole('button', { name: 'Edit Client scope' }));
    await user.type(within(scope).getByRole('searchbox', { name: 'Search Client intent' }), 'Core Functional Job');
    await user.click(within(scope).getByRole('button', { name: 'Browse Core Functional Job' }));
    fireEvent.keyDown(scope, { key: 'Escape' });
    await vi.waitFor(() => expect(within(scope).getByRole('button', { name: 'Edit Client scope' })).toHaveFocus());
    expect(within(scope).queryByRole('searchbox', { name: 'Search Client intent' })).not.toBeInTheDocument();
  });

  it('dismisses on outside pointers without restoring focus to the Client scope pencil', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    await user.click(within(scope).getByRole('button', { name: 'Edit Client scope' }));
    const offersEdit = inspector.getByRole('button', { name: 'Edit linked Offers' });
    await user.click(offersEdit);
    expect(within(scope).queryByRole('searchbox', { name: 'Search Client intent' })).not.toBeInTheDocument();
    expect(inspector.getByLabelText('Linked Offers editor')).toBeInTheDocument();
    expect(within(scope).getByRole('button', { name: 'Edit Client scope' })).not.toHaveFocus();

    await user.click(within(scope).getByRole('button', { name: 'Edit Client scope' }));
    fireEvent.pointerDown(inspector.getByRole('heading', { name: 'Placement' }));
    expect(within(scope).queryByRole('searchbox', { name: 'Search Client intent' })).not.toBeInTheDocument();
    expect(within(scope).getByRole('button', { name: 'Edit Client scope' })).not.toHaveFocus();
  });

  it('keeps the complete Client scope authoring surface inside pointer dismissal', async () => {
    const document = touchpointInspectorDocument();
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a'] });
    document.offerJobSelections.push({ id: 'offer-selection', offerId: 'offer-a', productJobIntentId: 'intent' });
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    await user.click(within(scope).getByRole('button', { name: 'Edit Client scope' }));
    const search = within(scope).getByRole('searchbox', { name: 'Search Client intent' });
    await user.click(search); await user.type(search, 'Finish faster');
    expect(within(scope).getByRole('button', { name: 'Close Client scope authoring' })).toBeInTheDocument();
    await user.click(within(scope).getByRole('checkbox', { name: 'Finish faster' }));
    expect(within(scope).getByRole('button', { name: 'Close Client scope authoring' })).toBeInTheDocument();
    await user.clear(search);
    await user.click(within(scope).getByRole('button', { name: 'Offer · Subscription' }));
    expect(within(scope).getByRole('checkbox', { name: 'Finish faster' })).toBeInTheDocument();
    expect(within(scope).getByRole('button', { name: 'Close Client scope authoring' })).toBeInTheDocument();
  });

  it('uses the same accessible heading action for empty, populated, and unavailable Client scope', () => {
    const emptyInspector = renderTouchpointInspector();
    let scope = emptyInspector.getByRole('region', { name: 'Client scope' });
    let headingAction = within(scope).getByRole('button', { name: 'Edit Client scope' });
    expect(headingAction).toHaveTextContent('Client scope');
    expect(headingAction).not.toHaveTextContent('✎');
    expect(within(scope).getByRole('heading', { name: 'Client scope' })).toContainElement(headingAction);
    expect(within(scope).queryByText('Add connection')).not.toBeInTheDocument();
    cleanup();

    let populated = touchpointInspectorDocument();
    let populatedId = 0;
    populated = applyTouchpointIntentDraft(populated, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: () => `populated-selection-${++populatedId}` });
    scope = renderTouchpointInspector(populated).getByRole('region', { name: 'Client scope' });
    expect(within(scope).getByRole('button', { name: 'Edit Client scope' })).toBeEnabled();
    cleanup();

    const unavailable = touchpointInspectorDocument();
    unavailable.relationships = unavailable.relationships.filter(relation => relation.kind !== 'offer_presented_at_touchpoint');
    scope = renderTouchpointInspector(unavailable).getByRole('region', { name: 'Client scope' });
    headingAction = within(scope).getByRole('button', { name: 'Edit Client scope' });
    expect(headingAction).toBeDisabled();
    expect(within(scope).getByRole('heading', { name: 'Client scope' })).toHaveAccessibleName('Client scope');
  });

  it('opens the same Client scope section and Escape restores focus to the remounted heading action', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    await user.click(within(scope).getByRole('button', { name: 'Edit Client scope' }));
    expect(within(scope).getByRole('button', { name: 'Close Client scope authoring' })).toBeInTheDocument();
    expect(within(scope).queryByText('Upstream Client intent')).not.toBeInTheDocument();
    const search = within(scope).getByRole('searchbox', { name: 'Search Client intent' });
    expect(search.compareDocumentPosition(scope.querySelector('.intent-source-list')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.type(search, 'finish');
    const beforeEscape = structuredClone(window.__VEE_DEV__!.dump());
    fireEvent.keyDown(scope, { key: 'Escape' });
    await act(() => new Promise(resolve => requestAnimationFrame(resolve)));
    expect(window.__VEE_DEV__!.dump()).toEqual(beforeEscape);
    expect(within(scope).queryByRole('button', { name: 'Close Client scope authoring' })).not.toBeInTheDocument();
    expect(within(scope).getByRole('button', { name: 'Edit Client scope' })).toHaveFocus();
    expect(inspector.queryByRole('button', { name: 'Apply changes' })).not.toBeInTheDocument();
    expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('places durable Client scope after Neighborhood and before authoring controls with an owner-nested DO', async () => {
    let document = touchpointInspectorDocument();
    let id = 0;
    document = applyTouchpointIntentDraft(document, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: () => `seed-client-scope-${++id}` });
    const inspector = renderTouchpointInspector(document);
    const neighborhood = inspector.getByText('Neighborhood').closest<HTMLElement>('.business-structure-derived')!;
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    const addConnection = within(scope).getByRole('button', { name: 'Edit Client scope' });
    expect(neighborhood.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(scope).toContainElement(addConnection);
    expect(inspector.queryByRole('button', { name: 'Select all current Offer intent' })).not.toBeInTheDocument();
    expect(within(scope).getByRole('button', { name: 'Core Functional Job, 1' })).toHaveAttribute('aria-expanded', 'true');
    const jobGroup = within(scope).getByRole('button', { name: 'Make progress' }).closest<HTMLElement>('.touchpoint-client-job')!;
    expect(within(jobGroup).getByRole('button', { name: 'Finish faster' })).toBeInTheDocument();
    expect(inspector.queryByRole('region', { name: 'Connected' })).not.toBeInTheDocument();
  });

  it('keeps seeded Job and Desired Outcome titles as separate read-state navigation buttons', async () => {
    let document = touchpointInspectorDocument();
    let id = 0;
    document = applyTouchpointIntentDraft(document, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: () => `read-navigation-${++id}` });
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    expect(within(scope).getByRole('button', { name: 'Core Functional Job, 1' })).toHaveAttribute('aria-expanded', 'true');

    const job = within(scope).getByRole('button', { name: 'Make progress' });
    const outcome = within(scope).getByRole('button', { name: 'Finish faster' });
    expect(job).toHaveAttribute('type', 'button');
    expect(outcome).toHaveAttribute('type', 'button');
    expect(within(scope).getByRole('heading', { name: 'Client scope' })).not.toContainElement(job);
    expect(within(scope).getByRole('heading', { name: 'Client scope' })).not.toContainElement(outcome);
    expect(within(scope).queryByRole('checkbox')).not.toBeInTheDocument();

    await user.click(job);
    expect(inspector.getByRole('heading', { name: 'Make progress' })).toBeInTheDocument();
    expect(inspector.queryByRole('searchbox', { name: 'Search Client intent' })).not.toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    await user.click(within(inspector.getByRole('region', { name: 'Client scope' })).getByRole('button', { name: 'Finish faster' }));
    expect(inspector.getByRole('heading', { name: 'Finish faster' })).toBeInTheDocument();
  });

  it('applies compact initial disclosure density to one, two, and three Client scope kinds', () => {
    let oneKind = touchpointInspectorDocument();
    let id = 0;
    oneKind = applyTouchpointIntentDraft(oneKind, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: () => `density-one-${++id}` });
    let scope = renderTouchpointInspector(oneKind).getByRole('region', { name: 'Client scope' });
    expect(within(scope).getByRole('button', { name: 'Core Functional Job, 1' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(scope).getByRole('button', { name: 'Make progress' })).toBeInTheDocument();
    cleanup();

    const twoKinds = multiKindClientScopeDocument();
    twoKinds.touchpointJobSelections = twoKinds.touchpointJobSelections.filter(selection => selection.id !== 'emotional-path');
    twoKinds.touchpointFinancialSelections = [];
    scope = renderTouchpointInspector(twoKinds).getByRole('region', { name: 'Client scope' });
    expect(within(scope).getByRole('button', { name: 'Core Functional Job, 1' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(scope).getByRole('button', { name: 'Related Job, 1' })).toHaveAttribute('aria-expanded', 'true');
    cleanup();

    const threeKinds = multiKindClientScopeDocument();
    threeKinds.touchpointFinancialSelections = [];
    scope = renderTouchpointInspector(threeKinds).getByRole('region', { name: 'Client scope' });
    expect(within(scope).getAllByRole('button', { name: /, 1$/ }).every(button => button.getAttribute('aria-expanded') === 'false')).toBe(true);
  });

  it('snapshots an initially expanded Client scope choice through authoring mode', async () => {
    let document = touchpointInspectorDocument();
    let id = 0;
    document = applyTouchpointIntentDraft(document, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: () => `snapshot-${++id}` });
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector(document);
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    const disclosure = within(scope).getByRole('button', { name: 'Core Functional Job, 1' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await user.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await user.click(within(scope).getByRole('button', { name: 'Edit Client scope' }));
    await user.click(within(scope).getByRole('button', { name: 'Close Client scope authoring' }));
    expect(within(scope).getByRole('button', { name: 'Core Functional Job, 1' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('packs measured Client scope panels while preserving disclosure identity, focus, and logical order', async () => {
    const observers: { callback: ResizeObserverCallback; observed: Set<Element> }[] = [];
    class ControllableResizeObserver implements ResizeObserver {
      readonly observed = new Set<Element>();
      constructor(readonly callback: ResizeObserverCallback) { observers.push(this); }
      observe(target: Element) { this.observed.add(target); }
      unobserve(target: Element) { this.observed.delete(target); }
      disconnect() { this.observed.clear(); }
    }
    vi.stubGlobal('ResizeObserver', ControllableResizeObserver);
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector(multiKindClientScopeDocument());
    const groups = inspector.getByRole('region', { name: 'Client scope' }).querySelector<HTMLElement>('.client-scope-view-groups')!;
    groups.getBoundingClientRect = () => ({ width: 960, height: 0, x: 0, y: 0, top: 0, right: 960, bottom: 0, left: 0, toJSON: () => ({}) });
    const panels = [...groups.querySelectorAll<HTMLElement>('.client-scope-view-panel')];
    panels.forEach(panel => { panel.getBoundingClientRect = () => {
      const height = panel.querySelector('[aria-expanded="true"]') ? 140 : panel.dataset.clientScopePanelId === 'client-kind:core_functional_job' ? 80 : 40;
      return { width: 288, height, x: 0, y: 0, top: 0, right: 288, bottom: height, left: 0, toJSON: () => ({}) };
    }; });
    act(() => observers.forEach(observer => observer.callback([], observer as unknown as ResizeObserver)));

    expect(groups).toHaveClass('is-packed');
    expect(panels).toHaveLength(4);
    expect(new Set(panels.map(panel => panel.dataset.clientScopePanelId)).size).toBe(4);
    const disclosure = within(groups).getByRole('button', { name: 'Related Job, 1' });
    disclosure.focus();
    await user.click(disclosure);
    act(() => observers.forEach(observer => observer.callback([], observer as unknown as ResizeObserver)));

    expect(disclosure).toHaveFocus();
    expect(within(groups).getByRole('button', { name: 'Related Job, 1' })).toBe(disclosure);
    expect([...groups.querySelectorAll('.client-scope-view-disclosure')].map(button => button.getAttribute('aria-label'))).toEqual([
      'Related Job, 1', 'Core Functional Job, 1', 'Emotional Job, 1', 'Financial Desired Outcome, 1',
    ]);
    expect(groups.querySelectorAll('[data-client-scope-panel-id="client-kind:related_job"]')).toHaveLength(1);

    const relatedPanel = disclosure.closest<HTMLElement>('.client-scope-view-panel')!;
    const compactedPanel = groups.querySelector<HTMLElement>('[data-client-scope-panel-id="client-kind:financial_desired_outcome"]')!;
    const coordinates = (panel: HTMLElement): [number, number] => {
      const match = panel.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)!;
      return [Number(match[1]), Number(match[2])];
    };
    expect(coordinates(relatedPanel)).toEqual([0, 0]);
    expect(coordinates(compactedPanel)[0]).toBeGreaterThan(0);
    expect(coordinates(compactedPanel)[1]).toBeGreaterThan(40);
    expect(Number.parseFloat(groups.style.height)).toBeGreaterThanOrEqual(140);

    groups.getBoundingClientRect = () => ({ width: 280, height: 190, x: 0, y: 0, top: 0, right: 280, bottom: 190, left: 0, toJSON: () => ({}) });
    act(() => observers.forEach(observer => observer.callback([], observer as unknown as ResizeObserver)));

    const narrowPanels = [...groups.querySelectorAll<HTMLElement>('.client-scope-view-panel')];
    const narrowCoordinates = narrowPanels.map(coordinates);
    expect(narrowCoordinates.every(([x]) => x === 0)).toBe(true);
    expect(narrowCoordinates.map(([, y]) => y)).toEqual([...narrowCoordinates.map(([, y]) => y)].sort((left, right) => left - right));
    expect(narrowPanels.every(panel => Number.parseFloat(panel.style.width) <= 280)).toBe(true);
    expect(Number.parseFloat(groups.style.height)).toBeGreaterThan(narrowCoordinates.at(-1)![1]);
    expect(disclosure).toHaveFocus();
    expect(within(groups).getByRole('button', { name: 'Related Job, 1' })).toBe(disclosure);
  });

  it('groups read-only Client scope by kind with independent prioritized disclosures and preserved navigation state', async () => {
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector(multiKindClientScopeDocument());
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    const groups = scope.querySelector<HTMLElement>('.client-scope-view-groups')!;
    const panelNames = () => [...groups.querySelectorAll<HTMLButtonElement>('.client-scope-view-disclosure')].map(button => button.getAttribute('aria-label'));

    expect(panelNames()).toEqual(['Core Functional Job, 1', 'Related Job, 1', 'Emotional Job, 1', 'Financial Desired Outcome, 1']);
    for (const button of within(groups).getAllByRole('button')) expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(within(scope).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(scope).queryByRole('searchbox', { name: 'Search Client intent' })).not.toBeInTheDocument();
    expect(within(scope).queryByText('Finish faster')).not.toBeInTheDocument();

    const relatedDisclosure = within(groups).getByRole('button', { name: 'Related Job, 1' });
    await user.click(relatedDisclosure);
    expect(panelNames()).toEqual(['Related Job, 1', 'Core Functional Job, 1', 'Emotional Job, 1', 'Financial Desired Outcome, 1']);
    expect(relatedDisclosure).toHaveFocus();
    expect(within(groups).getByRole('button', { name: 'Coordinate delivery' })).toBeInTheDocument();
    expect(within(groups).getByRole('button', { name: 'Avoid handoff delays' })).toBeInTheDocument();

    const coreDisclosure = within(groups).getByRole('button', { name: 'Core Functional Job, 1' });
    await user.click(coreDisclosure);
    expect(panelNames()).toEqual(['Core Functional Job, 1', 'Related Job, 1', 'Emotional Job, 1', 'Financial Desired Outcome, 1']);
    expect(coreDisclosure).toHaveFocus();
    expect(relatedDisclosure).toHaveAttribute('aria-expanded', 'true');
    expect(within(groups).getByRole('button', { name: 'Make progress' })).toBeInTheDocument();
    expect(within(groups).getByRole('button', { name: 'Finish faster' })).toBeInTheDocument();
    expect(within(groups).getByRole('button', { name: 'Reduce errors' })).toBeInTheDocument();

    const financialDisclosure = within(groups).getByRole('button', { name: 'Financial Desired Outcome, 1' });
    await user.click(financialDisclosure);
    expect(financialDisclosure).toHaveAttribute('aria-expanded', 'true');
    expect(coreDisclosure).toHaveAttribute('aria-expanded', 'true');
    expect(within(groups).getByRole('button', { name: 'Stay affordable' })).toBeInTheDocument();
    await user.click(relatedDisclosure);
    expect(coreDisclosure).toHaveAttribute('aria-expanded', 'true');
    expect(financialDisclosure).toHaveAttribute('aria-expanded', 'true');

    await user.click(within(groups).getByRole('button', { name: 'Make progress' }));
    expect(inspector.getByRole('heading', { name: 'Make progress' })).toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    const restoredScope = inspector.getByRole('region', { name: 'Client scope' });
    expect(within(restoredScope).getByRole('button', { name: 'Core Functional Job, 1' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(restoredScope).getByRole('button', { name: 'Financial Desired Outcome, 1' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(within(restoredScope).getByRole('button', { name: 'Stay affordable' }));
    expect(inspector.getByRole('heading', { name: 'Stay affordable' })).toBeInTheDocument();
  });

  it('restores read disclosures after authoring and keeps Resistance outside the panel grid', async () => {
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector(multiKindClientScopeDocument());
    let scope = inspector.getByRole('region', { name: 'Client scope' });
    await user.click(within(scope).getByRole('button', { name: 'Core Functional Job, 1' }));
    await user.click(within(scope).getByRole('button', { name: 'Financial Desired Outcome, 1' }));
    await user.click(within(scope).getByRole('button', { name: 'Edit Client scope' }));
    expect(scope.querySelector('.client-scope-view-groups')).not.toBeInTheDocument();
    await user.type(within(scope).getByRole('searchbox', { name: 'Search Client intent' }), 'Feel confident');
    await user.click(within(scope).getByRole('checkbox', { name: 'Feel confident' }));
    await user.click(within(scope).getByRole('button', { name: 'Close Client scope authoring' }));

    scope = inspector.getByRole('region', { name: 'Client scope' });
    expect(within(scope).queryByRole('button', { name: 'Emotional Job, 1' })).not.toBeInTheDocument();
    expect(within(scope).getByRole('button', { name: 'Core Functional Job, 1' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(scope).getByRole('button', { name: 'Financial Desired Outcome, 1' })).toHaveAttribute('aria-expanded', 'true');
    const resistance = inspector.getByRole('region', { name: 'Resistance' });
    expect(scope.compareDocumentPosition(resistance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(scope.querySelector('.client-scope-view-groups')).not.toContainElement(resistance);
  });

  it('searches by title and uses a temporary kind shortcut without a permanent select', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    expect(inspector.queryByText('Reduce errors')).not.toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    const search = inspector.getByRole('searchbox', { name: 'Search Client intent' });
    expect(inspector.queryByLabelText('Entity kind')).not.toBeInTheDocument();
    await user.type(search, 'Core Functional Job');
    await user.click(inspector.getByRole('button', { name: 'Browse Core Functional Job' }));
    expect(inspector.getByRole('checkbox', { name: /Finish faster/ })).toBeInTheDocument();
    expect(inspector.getByRole('checkbox', { name: /Reduce errors/ })).toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: /Back to results/ }));
    await user.clear(search); await user.type(search, 'errors');
    expect(inspector.queryByRole('checkbox', { name: /Finish faster/ })).not.toBeInTheDocument();
    expect(inspector.getByRole('checkbox', { name: /Reduce errors/ })).toBeInTheDocument();
  });

  it('omits contributor attribution for an unchecked discovery result', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Finish faster');
    const checkbox = within(inspector.getByRole('region', { name: 'Find Client intent' })).getByRole('checkbox', { name: 'Finish faster' });
    const row = checkbox.closest<HTMLElement>('.intent-path-row')!;

    expect(checkbox).not.toBeChecked();
    expect(row.querySelector('.contributor-attributions')).not.toBeInTheDocument();
    expect(within(row).queryByText(/^via /)).not.toBeInTheDocument();
  });

  it('renders an already-authored semantic result checked before any search action', async () => {
    const document = touchpointInspectorDocument();
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a'] });
    document.offerJobSelections.push({ id: 'offer-selection', offerId: 'offer-a', productJobIntentId: 'intent' });
    document.touchpointJobSelections.push({ id: 'touch-selection', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] });
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);

    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Finish faster');

    const discovery = inspector.getByRole('region', { name: 'Find Client intent' });
    expect(within(discovery).getByRole('checkbox', { name: 'Finish faster' })).toBeChecked();
    const outcomeRow = within(discovery).getByRole('checkbox', { name: 'Finish faster' }).closest<HTMLElement>('.intent-semantic-leaf')!;
    expect(within(outcomeRow).getByText('via Subscription')).toBeInTheDocument();
    expect(within(outcomeRow).queryByRole('checkbox', { name: 'via Subscription' })).not.toBeInTheDocument();
    expect(within(outcomeRow).queryByRole('button', { name: 'Remove Subscription contributor' })).not.toBeInTheDocument();
    expect(within(outcomeRow).getByRole('checkbox', { name: 'Finish faster' })).toBeEnabled();
  });

  it('semantic DO uncheck preserves stable Job paths without changing Product or Offer scope', async () => {
    const document = touchpointInspectorDocument(true);
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a'] });
    document.offerJobSelections.push(
      { id: 'offer-selection-a', offerId: 'offer-a', productJobIntentId: 'intent' },
      { id: 'offer-selection-b', offerId: 'offer-b', productJobIntentId: 'intent' },
    );
    document.touchpointJobSelections.push(
      { id: 'touch-selection-a', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
      { id: 'touch-selection-b', touchpointId: 'touch', offerId: 'offer-b', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
    );
    const upstream = { product: structuredClone(document.productJobIntents), offer: structuredClone(document.offerJobSelections) };
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Finish faster');
    const discovery = inspector.getByRole('region', { name: 'Find Client intent' });

    await user.click(within(discovery).getByRole('checkbox', { name: 'Finish faster' }));

    expect(within(discovery).getByRole('checkbox', { name: 'Finish faster' })).not.toBeChecked();
    const durable = window.__VEE_DEV__!.dump();
    expect(durable.touchpointJobSelections.filter(selection => selection.touchpointId === 'touch')).toEqual([
      expect.objectContaining({ id: 'touch-selection-a', addressedDesiredOutcomeIds: [] }),
      expect.objectContaining({ id: 'touch-selection-b', addressedDesiredOutcomeIds: [] }),
    ]);
    expect(durable.productJobIntents).toEqual(upstream.product);
    expect(durable.offerJobSelections).toEqual(upstream.offer);
  });

  it('semantic Job uncheck removes every local contributor path and its DO subset', async () => {
    const document = touchpointInspectorDocument(true);
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a'] });
    document.offerJobSelections.push(
      { id: 'offer-selection-a', offerId: 'offer-a', productJobIntentId: 'intent' },
      { id: 'offer-selection-b', offerId: 'offer-b', productJobIntentId: 'intent' },
    );
    document.touchpointJobSelections.push(
      { id: 'touch-selection-a', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
      { id: 'touch-selection-b', touchpointId: 'touch', offerId: 'offer-b', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] },
    );
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Make progress');
    await user.click(within(inspector.getByRole('region', { name: 'Find Client intent' })).getByRole('checkbox', { name: 'Make progress' }));
    expect(window.__VEE_DEV__!.dump().touchpointJobSelections).toEqual([]);
  });

  it('removes one discovery contributor path while semantic membership remains checked', async () => {
    const document = touchpointInspectorDocument(true);
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a'] });
    document.offerJobSelections.push(
      { id: 'offer-selection-a', offerId: 'offer-a', productJobIntentId: 'intent' },
      { id: 'offer-selection-b', offerId: 'offer-b', productJobIntentId: 'intent' },
    );
    document.touchpointJobSelections.push(
      { id: 'touch-selection-a', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
      { id: 'touch-selection-b', touchpointId: 'touch', offerId: 'offer-b', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] },
    );
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Finish faster');
    const discovery = inspector.getByRole('region', { name: 'Find Client intent' });

    const outcomeRow = within(discovery).getByRole('checkbox', { name: 'Finish faster' }).closest<HTMLElement>('.intent-semantic-leaf')!;
    const subscriptionRemove = within(outcomeRow).getByRole('button', { name: 'Remove Subscription contributor' });
    const consultingRemove = within(outcomeRow).getByRole('button', { name: 'Remove Consulting contributor' });
    expect(subscriptionRemove).not.toBe(consultingRemove);
    await user.click(subscriptionRemove);

    expect(within(discovery).getByRole('checkbox', { name: 'Finish faster' })).toBeChecked();
    expect(within(outcomeRow).queryByText('via Subscription')).not.toBeInTheDocument();
    expect(within(outcomeRow).getByText('via Consulting')).toBeInTheDocument();
    expect(within(outcomeRow).queryByRole('checkbox', { name: /via (Subscription|Consulting)/ })).not.toBeInTheDocument();
    expect(within(outcomeRow).queryByRole('button', { name: 'Remove Consulting contributor' })).not.toBeInTheDocument();
    expect(within(discovery).getByRole('checkbox', { name: 'Finish faster' })).toHaveFocus();
    expect(window.__VEE_DEV__!.dump().touchpointJobSelections.filter(selection => selection.touchpointId === 'touch')).toEqual([
      expect.objectContaining({ id: 'touch-selection-a', offerId: 'offer-a', addressedDesiredOutcomeIds: [] }),
      expect.objectContaining({ offerId: 'offer-b', addressedDesiredOutcomeIds: ['do-a'] }),
    ]);

    await user.click(within(discovery).getByRole('checkbox', { name: 'Finish faster' }));
    expect(within(discovery).getByRole('checkbox', { name: 'Finish faster' })).not.toBeChecked();
    expect(within(outcomeRow).queryByText(/via (Subscription|Consulting)/)).not.toBeInTheDocument();
    expect(within(discovery).getByRole('checkbox', { name: 'Finish faster' })).toHaveFocus();
    expect(window.__VEE_DEV__!.dump().touchpointJobSelections.map(selection => selection.addressedDesiredOutcomeIds)).toEqual([[], []]);
  });

  it('preserves dependency impact confirmation after a multi-contributor path becomes single', async () => {
    const document = touchpointInspectorDocument(true);
    document.entities.push(
      { id: 'direct-job', kind: 'emotional_job', title: 'Feel confident' },
      { id: 'repulsor', kind: 'repulsor', title: 'Delay concern' },
    );
    document.placements.push(
      { viewId: 'spike-view', entityId: 'direct-job', x: 980, y: 0 },
      { viewId: 'spike-view', entityId: 'repulsor', x: 1120, y: 0 },
    );
    document.relationships.push(
      { id: 'resists-job', kind: 'repulsor_resists', repulsorId: 'repulsor', targetEntityId: 'direct-job' },
      { id: 'mitigates-delay', kind: 'touchpoint_mitigates_repulsor', touchpointId: 'touch', repulsorId: 'repulsor' },
    );
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'direct-job', addressedDesiredOutcomeIds: [] });
    document.offerJobSelections.push(
      { id: 'offer-selection-a', offerId: 'offer-a', productJobIntentId: 'intent' },
      { id: 'offer-selection-b', offerId: 'offer-b', productJobIntentId: 'intent' },
    );
    document.touchpointJobSelections.push(
      { id: 'touch-selection-a', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] },
      { id: 'touch-selection-b', touchpointId: 'touch', offerId: 'offer-b', productJobIntentId: 'intent', addressedDesiredOutcomeIds: [] },
    );
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Feel confident');
    const discovery = inspector.getByRole('region', { name: 'Find Client intent' });
    let checkbox = within(discovery).getByRole('checkbox', { name: 'Feel confident' });
    const row = checkbox.closest<HTMLElement>('.intent-path-row')!;
    const remove = within(row).getByRole('button', { name: 'Remove Subscription contributor' });

    await user.click(remove);
    expect(checkbox).toBeChecked();
    expect(within(row).getByText('via Consulting')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Remove Consulting contributor' })).not.toBeInTheDocument();
    await user.click(checkbox);
    expect(screen.getByRole('dialog', { name: 'Remove this local Client path?' })).toBeInTheDocument();
    expect(checkbox).toBeChecked();
    expect(window.__VEE_DEV__!.dump().relationships).toContainEqual(expect.objectContaining({ id: 'mitigates-delay' }));
    fireEvent.pointerDown(inspector.getByRole('heading', { name: 'Placement' }));
    expect(screen.getByRole('dialog', { name: 'Remove this local Client path?' })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Close Client scope authoring' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Remove this local Client path?' })).not.toBeInTheDocument();
    expect(checkbox).toHaveFocus();
    expect(checkbox).toBeChecked();
    expect(window.__VEE_DEV__!.dump().relationships).toContainEqual(expect.objectContaining({ id: 'mitigates-delay' }));
    expect(inspector.getByRole('button', { name: 'Close Client scope authoring' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(inspector.getByRole('button', { name: 'Edit Client scope' })).toHaveFocus());
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Feel confident');
    checkbox = within(inspector.getByRole('region', { name: 'Find Client intent' })).getByRole('checkbox', { name: 'Feel confident' });

    await user.click(checkbox);
    const confirmation = screen.getByRole('dialog', { name: 'Remove this local Client path?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Remove' }));
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveFocus();
    expect(inspector.getByRole('button', { name: 'Close Client scope authoring' })).not.toHaveAttribute('aria-pressed');
    expect(window.__VEE_DEV__!.dump().relationships).not.toContainEqual(expect.objectContaining({ id: 'mitigates-delay' }));
  });

  it('uses the visible editing title as the checkbox surface without navigating', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Finish faster');
    const discovery = within(inspector.getByRole('region', { name: 'Find Client intent' }));
    const checkbox = discovery.getByRole('checkbox', { name: 'Finish faster' });
    const title = discovery.getByText('Finish faster', { selector: '.intent-selection-title' });

    expect(discovery.queryByRole('button', { name: 'Finish faster' })).not.toBeInTheDocument();
    await user.click(title);

    expect(checkbox).toBeChecked();
    expect(window.__VEE_DEV__!.dump().touchpointJobSelections).toEqual([expect.objectContaining({ addressedDesiredOutcomeIds: ['do-a'] })]);
    expect(inspector.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(window.__VEE_DEV__!.dump().touchpointJobSelections).toEqual([expect.objectContaining({ addressedDesiredOutcomeIds: [] })]);
    expect(inspector.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
  });

  it('selecting a DO commits its owner-aware relation under Client scope', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Finish faster');
    await user.click(inspector.getByRole('checkbox', { name: 'Finish faster' }));
    await user.click(within(inspector.getByRole('region', { name: 'Client scope' })).getByRole('button', { name: 'Offer · Subscription' }));
    expect(within(inspector.getByRole('region', { name: 'Client scope' })).getAllByRole('checkbox', { name: 'Make progress' })).not.toHaveLength(0);
    for (const checkbox of within(inspector.getByRole('region', { name: 'Client scope' })).getAllByRole('checkbox', { name: 'Finish faster' })) expect(checkbox).toBeChecked();
    expect(inspector.queryByRole('region', { name: 'Connected' })).not.toBeInTheDocument();
    expect(inspector.queryByRole('button', { name: 'Apply changes' })).not.toBeInTheDocument();
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    expect(within(scope).getByRole('button', { name: 'Close Client scope authoring' })).toBeInTheDocument();
  });

  it('repositions only the Touchpoint after its represented intent route commits', async () => {
    const document = touchpointInspectorDocument();
    document.placements = document.placements.map(placement => placement.entityId === 'touch' ? { ...placement, x: 1200, y: 300 } : placement);
    const before = new Map(document.placements.map(placement => [placement.entityId, { x: placement.x, y: placement.y }]));
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Finish faster');
    await user.click(inspector.getByRole('checkbox', { name: 'Finish faster' }));
    await user.click(screen.getByRole('tab', { name: 'Map' }));
    expect(nodePoint('Checkout')).not.toEqual(before.get('touch'));
    for (const [entityId, point] of before) {
      if (entityId === 'touch') continue;
      const title = document.entities.find(entity => entity.id === entityId)!.title;
      expect(nodePoint(title)).toEqual(point);
    }
  });

  it('cancelled picker leaves the durable document unchanged', async () => {
    const user = userEvent.setup(); const document = touchpointInspectorDocument(); const snapshot = structuredClone(document); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.click(inspector.getByRole('button', { name: 'Close Client scope authoring' }));
    expect(document).toEqual(snapshot); expect(inspector.getByRole('region', { name: 'Client scope' })).toHaveTextContent('No Client-side connections yet.');
  });

  it('with multiple Offers contributor is not guessed and commit is blocked', async () => {
    const user = userEvent.setup(); const document = touchpointInspectorDocument(true); const snapshot = structuredClone(document); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Finish faster');
    await user.click(inspector.getByRole('checkbox', { name: 'Finish faster' }));
    const contributorGroup = inspector.getByRole('group', { name: 'Which linked Offers contribute here?' });
    const contributors = within(contributorGroup);
    expect(contributors.getByRole('checkbox', { name: 'Subscription' })).not.toBeChecked();
    expect(contributors.getByRole('checkbox', { name: 'Consulting' })).not.toBeChecked();
    expect(contributors.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(document).toEqual(snapshot);
    const initiatingCheckbox = inspector.getByRole('checkbox', { name: 'Finish faster' });
    expect(initiatingCheckbox.closest('.intent-path-row')).toContainElement(contributorGroup);
    expect(contributorGroup.closest('.inline-intent-editor')!.querySelector('.intent-source-list')).not.toContainElement(contributorGroup);
    await user.click(contributors.getByRole('button', { name: 'Back' }));
    expect(document).toEqual(snapshot);
    expect(inspector.getByRole('searchbox', { name: 'Search Client intent' })).toHaveValue('Finish faster');
    expect(inspector.getByRole('button', { name: 'Close Client scope authoring' })).not.toHaveAttribute('aria-pressed');
    expect(initiatingCheckbox).toHaveFocus();
  });

  it('uses progressive Escape for a row-local contributor resolver, then closes authoring', async () => {
    const user = userEvent.setup(); const document = touchpointInspectorDocument(true); const snapshot = structuredClone(document); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    const search = inspector.getByRole('searchbox', { name: 'Search Client intent' });
    await user.type(search, 'Finish faster');
    const initiatingCheckbox = inspector.getByRole('checkbox', { name: 'Finish faster' });
    await user.click(initiatingCheckbox);
    expect(inspector.getByRole('group', { name: 'Which linked Offers contribute here?' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(inspector.queryByRole('group', { name: 'Which linked Offers contribute here?' })).not.toBeInTheDocument();
    expect(document).toEqual(snapshot);
    expect(search).toHaveValue('Finish faster');
    expect(inspector.getByRole('button', { name: 'Close Client scope authoring' })).not.toHaveAttribute('aria-pressed');
    expect(initiatingCheckbox).toHaveFocus();

    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(inspector.getByRole('button', { name: 'Edit Client scope' })).toHaveFocus());
    expect(inspector.queryByRole('searchbox', { name: 'Search Client intent' })).not.toBeInTheDocument();
    expect(document).toEqual(snapshot);
  });

  it('selecting a DO-bearing Job alone creates checked Job membership without a route', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(); await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Make progress');
    const discovery = inspector.getByRole('region', { name: 'Find Client intent' });
    expect(within(discovery).queryByRole('button', { name: 'Make progress' })).not.toBeInTheDocument();
    const job = within(discovery).getByRole('checkbox', { name: 'Make progress' });
    await user.click(job);
    expect(job).toBeChecked();
    expect(within(discovery).getByRole('checkbox', { name: 'Finish faster' })).not.toBeChecked();
    expect(window.__VEE_DEV__!.dump().touchpointJobSelections).toEqual([expect.objectContaining({ addressedDesiredOutcomeIds: [] })]);
    expect(document.querySelector('[data-id="intent-route:job->touch"]')).not.toBeInTheDocument();
  });

  it('selecting one DO activates its parent visually without selecting its sibling', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(); await user.click(inspector.getByRole('button', { name: 'Edit Client scope' }));
    await user.type(inspector.getByRole('searchbox', { name: 'Search Client intent' }), 'Make progress');
    const selected = inspector.getByRole('checkbox', { name: 'Finish faster' }); expect(inspector.getByRole('checkbox', { name: 'Reduce errors' })).toBeInTheDocument(); await user.click(selected);
    const scope = inspector.getByRole('region', { name: 'Client scope' });
    await user.click(within(scope).getByRole('button', { name: 'Offer · Subscription' }));
    expect(within(scope).getAllByRole('checkbox', { name: 'Make progress' })).not.toHaveLength(0);
    const durable = scope.querySelector<HTMLElement>('.intent-source-list')!;
    expect(within(durable).getByRole('checkbox', { name: 'Finish faster' })).toBeChecked();
    expect(within(durable).queryByRole('checkbox', { name: 'Reduce errors' })).not.toBeInTheDocument();
  });
});

describe('focused Touchpoint Inspector intent scenarios', () => {
  afterEach(cleanup);
  it.skip('legacy: disclosure DO-bearing Job does not select the Job', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    const clientIntent = within(inspector.getByRole('group', { name: 'Client intent' }));
    expect(clientIntent.queryByRole('checkbox', { name: 'Make progress' })).not.toBeInTheDocument();
    await user.click(clientIntent.getByRole('button', { name: 'Expand Make progress' }));
    expect(clientIntent.getByRole('checkbox', { name: 'Finish faster' })).not.toBeChecked();
  });

  it.skip('legacy: direct Job to Touchpoint selection is unavailable', () => {
    const inspector = renderTouchpointInspector();
    const clientIntent = within(inspector.getByRole('group', { name: 'Client intent' }));
    expect(clientIntent.queryByRole('checkbox', { name: 'Make progress' })).not.toBeInTheDocument();
  });

  it.skip('legacy: selecting one DO activates its parent visually without selecting its sibling', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    const clientIntent = within(inspector.getByRole('group', { name: 'Client intent' }));
    await user.click(clientIntent.getByRole('button', { name: 'Expand Make progress' }));
    await user.click(clientIntent.getByRole('checkbox', { name: 'Finish faster' }));
    expect(clientIntent.getByText('Core Functional Job · partial')).toBeInTheDocument();
    expect(clientIntent.getByRole('checkbox', { name: 'Reduce errors' })).not.toBeChecked();
  });

  it.skip('legacy: one linked Offer is assigned automatically', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    const clientIntent = within(inspector.getByRole('group', { name: 'Client intent' }));
    await user.click(clientIntent.getByRole('button', { name: 'Expand Make progress' }));
    await user.click(clientIntent.getByRole('checkbox', { name: 'Finish faster' }));
    expect(clientIntent.getByText('via Subscription')).toBeInTheDocument();
  });

  it.skip('legacy: with multiple Offers contributor is not guessed and Apply is blocked', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(touchpointInspectorDocument(true));
    const clientIntent = within(inspector.getByRole('group', { name: 'Client intent' }));
    await user.click(clientIntent.getByRole('button', { name: 'Expand Make progress' }));
    await user.click(clientIntent.getByRole('checkbox', { name: 'Finish faster' }));
    const contributors = within(clientIntent.getByRole('group', { name: 'Contributors for Finish faster' }));
    expect(contributors.getByRole('checkbox', { name: 'Subscription' })).not.toBeChecked();
    expect(contributors.getByRole('checkbox', { name: 'Consulting' })).not.toBeChecked();
    expect(inspector.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
  });

  it.skip('legacy: different DOs retain different Offers', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(touchpointInspectorDocument(true));
    const clientIntent = within(inspector.getByRole('group', { name: 'Client intent' }));
    await user.click(clientIntent.getByRole('button', { name: 'Expand Make progress' }));
    await user.click(clientIntent.getByRole('checkbox', { name: 'Finish faster' }));
    await user.click(within(clientIntent.getByRole('group', { name: 'Contributors for Finish faster' })).getByRole('checkbox', { name: 'Subscription' }));
    await user.click(clientIntent.getByRole('checkbox', { name: 'Reduce errors' }));
    await user.click(within(clientIntent.getByRole('group', { name: 'Contributors for Reduce errors' })).getByRole('checkbox', { name: 'Consulting' }));
    expect(within(clientIntent.getByRole('group', { name: 'Contributors for Finish faster' })).getByRole('checkbox', { name: 'Consulting' })).not.toBeChecked();
    expect(within(clientIntent.getByRole('group', { name: 'Contributors for Reduce errors' })).getByRole('checkbox', { name: 'Subscription' })).not.toBeChecked();
  });

  it.skip('legacy: one DO retains multiple Offers', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(touchpointInspectorDocument(true));
    const clientIntent = within(inspector.getByRole('group', { name: 'Client intent' }));
    await user.click(clientIntent.getByRole('button', { name: 'Expand Make progress' })); await user.click(clientIntent.getByRole('checkbox', { name: 'Finish faster' }));
    const contributors = within(clientIntent.getByRole('group', { name: 'Contributors for Finish faster' }));
    await user.click(contributors.getByRole('checkbox', { name: 'Subscription' })); await user.click(contributors.getByRole('checkbox', { name: 'Consulting' }));
    expect(contributors.getByRole('checkbox', { name: 'Subscription' })).toBeChecked(); expect(contributors.getByRole('checkbox', { name: 'Consulting' })).toBeChecked();
  });

  it('bottom-up Apply creates missing Product and Offer scope', () => {
    const document = touchpointInspectorDocument();
    const next = applyTouchpointIntentDraft(document, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: (() => { let id = 0; return () => `new-${++id}`; })() });
    expect(next.productJobIntents).toHaveLength(1); expect(next.offerJobSelections).toHaveLength(1); expect(next.touchpointJobSelections).toHaveLength(1);
  });

  it('FDO does not create Product intent', () => {
    const document = touchpointInspectorDocument();
    const next = applyTouchpointIntentDraft(document, { touchpointId: 'touch', draft: { jobLeaves: [], financialLeaves: [{ financialDesiredOutcomeId: 'fdo', contributorOfferIds: ['offer-a'] }], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: (() => { let id = 0; return () => `new-${++id}`; })() });
    expect(next.productJobIntents).toEqual([]); expect(next.offerFinancialIntents).toHaveLength(1); expect(next.touchpointFinancialSelections).toHaveLength(1);
  });

  it.skip('legacy: adding an Offer neither selects nor reattributes intent', async () => {
    const user = userEvent.setup(); const document = touchpointInspectorDocument(true); document.relationships = document.relationships.filter(r => !(r.kind === 'offer_presented_at_touchpoint' && r.offerId === 'offer-b'));
    const inspector = renderTouchpointInspector(document); await user.click(inspector.getByRole('button', { name: 'Edit linked Offers' })); const linkedOffers = within(inspector.getByRole('group', { name: 'Offers property' }));
    await user.click(linkedOffers.getByRole('checkbox', { name: 'Consulting' }));
    const clientIntent = within(inspector.getByRole('group', { name: 'Client intent' })); await user.click(clientIntent.getByRole('button', { name: 'Expand Make progress' }));
    expect(clientIntent.getByRole('checkbox', { name: 'Finish faster' })).not.toBeChecked();
  });

  it('old wizard is absent', () => {
    const inspector = renderTouchpointInspector();
    expect(inspector.queryByRole('button', { name: 'Add client intent' })).not.toBeInTheDocument();
    expect(inspector.queryByRole('button', { name: 'Confirm client intent' })).not.toBeInTheDocument();
  });

  it.skip('legacy: semantic editing does not change durable MapDocument before Apply', async () => {
    const user = userEvent.setup(); const document = touchpointInspectorDocument(); const snapshot = structuredClone(document);
    const inspector = renderTouchpointInspector(document); const clientIntent = within(inspector.getByRole('group', { name: 'Client intent' }));
    await user.click(clientIntent.getByRole('button', { name: 'Expand Make progress' })); await user.click(clientIntent.getByRole('checkbox', { name: 'Finish faster' }));
    expect(document).toEqual(snapshot);
  });

  it('does not retain the removed draft-only bulk action', () => {
    const document = touchpointInspectorDocument(); const inspector = renderTouchpointInspector(document);
    expect(inspector.queryByRole('button', { name: 'Select all current Offer intent' })).not.toBeInTheDocument();
    expect(document.productJobIntents).toEqual([]); expect(document.offerJobSelections).toEqual([]);
  });

  it('unlink review supports Cancel and Confirm with alternate contributors', async () => {
    const user = userEvent.setup(); let document = touchpointInspectorDocument(true);
    document = applyTouchpointIntentDraft(document, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a', 'offer-b'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: (() => { let id = 0; return () => `seed-${++id}`; })() });
    const inspector = renderTouchpointInspector(document); await user.click(inspector.getByRole('button', { name: 'Edit linked Offers' })); const linkedOffers = within(inspector.getByRole('group', { name: 'Offers property' }));
    await user.click(linkedOffers.getByRole('checkbox', { name: 'Subscription' }));
    let review = screen.getByRole('dialog', { name: 'This change affects downstream intent' });
    expect(within(review).getByRole('button', { name: 'Confirm removal' })).toBeInTheDocument();
    expect(within(review).queryByRole('button', { name: 'Apply changes' })).not.toBeInTheDocument();
    expect(within(review).getByText('path to Make progress → Finish faster will be removed; alternative: Consulting')).toBeInTheDocument();
    await user.click(within(review).getByRole('button', { name: 'Cancel' })); expect(review).not.toBeInTheDocument();
    expect(linkedOffers.getByRole('checkbox', { name: 'Subscription' })).toBeChecked();
    expect(document.relationships).toContainEqual(expect.objectContaining({ kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touch' }));
    expect(document.touchpointJobSelections).toEqual(expect.arrayContaining([
      expect.objectContaining({ touchpointId: 'touch', offerId: 'offer-a' }),
      expect.objectContaining({ touchpointId: 'touch', offerId: 'offer-b' }),
    ]));
    const affectedCheckbox = linkedOffers.getByRole('checkbox', { name: 'Subscription' });
    await user.click(affectedCheckbox); review = screen.getByRole('dialog', { name: 'This change affects downstream intent' });
    await user.click(within(review).getByRole('button', { name: 'Confirm removal' }));
    const committedCheckbox = linkedOffers.getByRole('checkbox', { name: 'Subscription' });
    expect(committedCheckbox).toBe(affectedCheckbox); expect(committedCheckbox.isConnected).toBe(true);
    expect(committedCheckbox).not.toBeChecked(); expect(linkedOffers.getByRole('checkbox', { name: 'Consulting' })).toBeChecked();
    await vi.waitFor(() => expect(committedCheckbox).toHaveFocus());
    await user.click(screen.getByRole('tab', { name: 'Map' }));
    const map = screen.getByLabelText('Map canvas');
    expect(map.querySelector('[data-source="offer-a"][data-target="touch"]')).not.toBeInTheDocument();
    expect(map.querySelector('[data-source="offer-b"][data-target="touch"]')).toBeInTheDocument();
  });

  it.skip('legacy: touchpoint unlink confirmation commits once after a prior cancel', async () => {
    const user = userEvent.setup(); let document = touchpointInspectorDocument(true);
    document = applyTouchpointIntentDraft(document, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a', 'offer-b'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: (() => { let id = 0; return () => `seed-${++id}`; })() });
    const inspector = renderTouchpointInspector(document); await user.click(inspector.getByRole('button', { name: 'Edit linked Offers' })); const linkedOffers = within(inspector.getByRole('group', { name: 'Offers property' }));
    await user.click(linkedOffers.getByRole('checkbox', { name: 'Subscription' }));
    const apply = inspector.getByRole('button', { name: 'Apply changes' }); await user.click(apply);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await user.click(apply); await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply changes' }));
    expect(screen.getByRole('status')).toHaveTextContent('Changes applied.');
    expect(apply).toBeDisabled();
    expect(linkedOffers.getByRole('checkbox', { name: 'Subscription' })).not.toBeChecked();
    const clientIntent = within(inspector.getByRole('group', { name: 'Client intent' })); await user.click(clientIntent.getByRole('button', { name: 'Expand Make progress' }));
    const retainedLeaf = clientIntent.getByText('Finish faster').closest<HTMLElement>('.intent-leaf')!;
    expect(within(retainedLeaf).getByText('via Consulting')).toBeInTheDocument();
    expect(within(retainedLeaf).queryByText(/Subscription/)).not.toBeInTheDocument();
  });

  it.skip('legacy: touchpoint unlink confirmation failure preserves the complete durable document', async () => {
    const user = userEvent.setup(); let document = touchpointInspectorDocument(true);
    document = applyTouchpointIntentDraft(document, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a', 'offer-b'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: (() => { let id = 0; return () => `seed-${++id}`; })() });
    const inspector = renderTouchpointInspector(document); await user.click(inspector.getByRole('button', { name: 'Edit linked Offers' })); const linkedOffers = within(inspector.getByRole('group', { name: 'Offers property' }));
    await user.click(linkedOffers.getByRole('checkbox', { name: 'Subscription' })); await user.click(inspector.getByRole('button', { name: 'Apply changes' }));
    vi.stubGlobal('crypto', { randomUUID: () => 'seed-1' });
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply changes' }));
    expect(screen.getByRole('status')).toHaveTextContent(/record ID|already exists/i);
    expect(inspector.getByRole('button', { name: 'Apply changes' })).not.toBeDisabled();
    await user.click(screen.getByRole('tab', { name: 'Map' })); const map = screen.getByLabelText('Map canvas');
    expect(map.querySelector('[data-source="offer-a"][data-target="touch"]')).toBeInTheDocument();
    expect(map.querySelector('[data-source="offer-b"][data-target="touch"]')).toBeInTheDocument();
  });

  it('does not show the staged footer in the Touchpoint Inspector', () => {
    const inspector = renderTouchpointInspector();
    expect(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' })).toBeInTheDocument();
    expect(inspector.queryByRole('button', { name: 'Apply changes' })).not.toBeInTheDocument();
    expect(inspector.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('navigates from an unchanged Touchpoint without an unsaved-changes dialog', async () => {
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector();
    await user.click(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Unsaved .* changes/ })).not.toBeInTheDocument();
  });

  it('navigates after a local Touchpoint commit without a false unsaved-changes dialog', async () => {
    const user = userEvent.setup();
    const inspector = renderTouchpointInspector(touchpointInspectorDocument());
    await user.click(within(inspector.getByRole('region', { name: 'Business structure' })).getByRole('button', { name: /Edit web address/ }));
    const input = inspector.getByRole('textbox', { name: 'Edit web address' });
    await user.clear(input);
    await user.type(input, 'https://durable.example{Enter}');
    expect(window.__VEE_DEV__!.dump().entities.find(entity => entity.id === 'touch')).toEqual(expect.objectContaining({ url: 'https://durable.example' }));
    await user.click(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Unsaved .* changes/ })).not.toBeInTheDocument();
  });

  it('preserves an explicit narrowed Offer subset across an unrelated Offer Apply', async () => {
    const document = touchpointInspectorDocument();
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] });
    document.offerJobSelections.push({ id: 'offer-selection', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] });
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' }));
    await user.click(within(inspector.getByRole('group', { name: 'Financial intent' })).getByRole('checkbox', { name: /^Stay affordable/ }));
    await user.click(inspector.getByRole('button', { name: 'Apply changes' }));
    expect(window.__VEE_DEV__!.dump().offerJobSelections).toEqual([{ id: 'offer-selection', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a'] }]);
  });

  it('reviews Offer subset narrowing before preserving the downstream Job path', async () => {
    const document = touchpointInspectorDocument();
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] });
    document.offerJobSelections.push({ id: 'offer-selection', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-a', 'do-b'] });
    document.touchpointJobSelections.push({ id: 'touch-selection', touchpointId: 'touch', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-b'] });
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' }));
    const intent = inspector.getByRole('group', { name: 'Client intent' });
    await user.click(within(intent).getByRole('button', { name: 'Expand Make progress' }));
    await user.click(within(intent).getByRole('checkbox', { name: 'Reduce errors' }));
    await user.click(inspector.getByRole('button', { name: 'Apply changes' }));
    const review = screen.getByRole('dialog', { name: 'This change affects downstream intent' });
    expect(within(review).getByRole('button', { name: 'Apply changes' })).toBeInTheDocument();
    expect(within(review).getByText('loses Reduce errors')).toBeInTheDocument();
    await user.click(within(review).getByRole('button', { name: 'Apply changes' }));
    expect(window.__VEE_DEV__!.dump().touchpointJobSelections).toEqual([expect.objectContaining({ id: 'touch-selection', addressedDesiredOutcomeIds: [] })]);
  });

  it('reviews Product narrowing when it narrows an Offer even without Touchpoint DO use', async () => {
    const document = touchpointInspectorDocument();
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a', 'do-b'] });
    document.offerJobSelections.push({ id: 'offer-selection', offerId: 'offer-a', productJobIntentId: 'intent', addressedDesiredOutcomeIds: ['do-b'] });
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' }));
    await user.click(inspector.getByRole('button', { name: 'Orbit' }));
    const intent = inspector.getByRole('group', { name: 'Client intent' });
    await user.click(within(intent).getByRole('button', { name: 'Expand Make progress' }));
    await user.click(within(intent).getByRole('checkbox', { name: 'Reduce errors' }));
    await user.click(inspector.getByRole('button', { name: 'Apply changes' }));
    const review = screen.getByRole('dialog', { name: 'This change affects downstream intent' });
    expect(within(review).getByRole('button', { name: 'Apply changes' })).toBeInTheDocument();
    expect(within(review).getByText('loses Reduce errors')).toBeInTheDocument();
  });

  it('connected entity titles navigate directly between Inspectors', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Orbit' }));
    expect(inspector.getByRole('heading', { name: 'Orbit' })).toBeInTheDocument();
  });

  it('Inspector Back and Forward preserve shared Map selection', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' }));
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    expect(inspector.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Inspector Forward' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    await openMap(user); await openInspector(user);
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
  });

  it('starts an independent Inspector history after returning to Map and changing selection', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' }));
    await user.click(inspector.getByRole('button', { name: 'Orbit' }));
    expect(inspector.getByRole('heading', { name: 'Orbit' })).toBeInTheDocument();

    await openMap(user);
    await user.click(screen.getByRole('button', { name: 'Subscription' }));
    await openInspector(user);
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Inspector Back' })).toBeDisabled();
    expect(inspector.getByRole('button', { name: 'Inspector Forward' })).toBeDisabled();

    await user.click(inspector.getByRole('button', { name: 'Orbit' }));
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Inspector Back' })).toBeDisabled();
  });

  it('preserves Inspector history and its forward position across Map round trips and repeated Map selection', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' }));
    await user.click(inspector.getByRole('button', { name: 'Orbit' }));
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    await openMap(user);
    await user.click(screen.getByRole('button', { name: 'Subscription' }));
    await openInspector(user);
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Inspector Back' })).toBeEnabled();
    expect(inspector.getByRole('button', { name: 'Inspector Forward' })).toBeEnabled();
    await user.click(inspector.getByRole('button', { name: 'Inspector Forward' }));
    expect(inspector.getByRole('heading', { name: 'Orbit' })).toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    expect(inspector.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
  });

  it.each([
    ['double-click', async (user: ReturnType<typeof userEvent.setup>) => user.dblClick(screen.getByRole('button', { name: 'Subscription' }))],
    ['context-menu Inspector action', async (user: ReturnType<typeof userEvent.setup>) => { fireEvent.contextMenu(screen.getByRole('button', { name: 'Subscription' })); await user.click(screen.getByRole('menuitem', { name: 'Open in Entity Inspector' })); }],
  ])('starts a new Inspector root after Map %s selection', async (_, choose) => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' }));
    await user.click(inspector.getByRole('button', { name: 'Orbit' }));
    await openMap(user);
    await choose(user);
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Inspector Back' })).toBeDisabled();
    expect(inspector.getByRole('button', { name: 'Inspector Forward' })).toBeDisabled();
    await user.click(inspector.getByRole('button', { name: 'Orbit' }));
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
  });

  it('starts a new Inspector root after Map keyboard navigation', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' }));
    await openMap(user);
    screen.getByRole('button', { name: 'Subscription' }).focus();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await openInspector(user);
    expect(inspector.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Inspector Back' })).toBeDisabled();
    expect(inspector.getByRole('button', { name: 'Inspector Forward' })).toBeDisabled();
  });

  it('does not reset selection or Inspector history when dirty confirmation rejects a Map selection', async () => {
    const document = touchpointInspectorDocument();
    document.productJobIntents.push({ id: 'intent', productId: 'product', jobId: 'job', addressedDesiredOutcomeIds: ['do-a'] });
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(within(inspector.getByRole('group', { name: 'Offers property' })).getByRole('button', { name: 'Subscription' }));
    await user.click(inspector.getByRole('button', { name: 'Orbit' }));
    const intent = inspector.getByRole('group', { name: 'Client intent' });
    await user.click(within(intent).getByRole('button', { name: 'Expand Make progress' }));
    await user.click(within(intent).getByLabelText('Finish faster'));
    fireEvent.click(globalThis.document.querySelector<HTMLElement>('[data-node-id="offer-a"]')!);
    const confirmation = screen.getByRole('dialog', { name: 'Unsaved Product changes' });
    await user.click(within(confirmation).getByRole('button', { name: 'Keep editing' }));
    expect(inspector.getByRole('heading', { name: 'Orbit' })).toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Unsaved Product changes' })).getByRole('button', { name: 'Discard' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Inspector Back' })).toBeEnabled();
  });

  it('history controls expose exact accessible names', () => {
    const inspector = renderTouchpointInspector();
    expect(inspector.getByRole('button', { name: 'Inspector Back' })).toBeDisabled();
    expect(inspector.getByRole('button', { name: 'Inspector Forward' })).toBeDisabled();
  });
});
