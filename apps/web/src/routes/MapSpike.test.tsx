import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, type MouseEvent, type ReactNode } from 'react';
import { MapNode, MapSpike } from './MapSpike';
import { applyTouchpointIntentDraft, type MapDocument } from '@vee/domain';

type MockNode = { id: string; position: { x: number; y: number }; selected?: boolean; data: { title: string; kindLabel: string } };
type MockEdge = { id: string; source: string; target: string; type?: string; markerEnd?: { type: string }; label?: string };
const { setViewportSpy } = vi.hoisted(() => ({ setViewportSpy: vi.fn(() => Promise.resolve(true)) }));
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, edgeTypes, nodeTypes, tabIndex, disableKeyboardA11y, onInit, onNodeClick, onNodeDoubleClick, onNodeContextMenu, onPaneClick, onPaneContextMenu }: { nodes: MockNode[]; edges: MockEdge[]; edgeTypes?: Record<string, unknown>; nodeTypes?: Record<string, (props: { data: MockNode['data'] }) => ReactNode>; tabIndex?: number; disableKeyboardA11y?: boolean; onInit: (instance: object) => void; onNodeClick: (event: object, node: MockNode) => void; onNodeDoubleClick: (event: { preventDefault(): void; stopPropagation(): void }, node: MockNode) => void; onNodeContextMenu: (event: MouseEvent, node: MockNode) => void; onPaneClick: () => void; onPaneContextMenu: (event: MouseEvent) => void }) => { useEffect(() => onInit({ screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x: x - 10, y: y - 20 }), flowToScreenPosition: ({ x, y }: { x: number; y: number }) => ({ x: x + 10, y: y + 20 }), getViewport: () => ({ x: 0, y: 0, zoom: 1 }), setViewport: setViewportSpy }), [onInit]); const NodeComponent = nodeTypes?.mapNode; const geometry = (edge: MockEdge) => { const source = nodes.find(node => node.id === edge.source)!; const target = nodes.find(node => node.id === edge.target)!; return `${source.position.x},${source.position.y}:${target.position.x},${target.position.y}`; }; return <div aria-label="Map canvas" data-edge-types={Object.keys(edgeTypes ?? {}).join(',')} data-disable-keyboard-a11y={String(Boolean(disableKeyboardA11y))} tabIndex={tabIndex} onContextMenu={onPaneContextMenu}><button onClick={onPaneClick}>Clear selection</button>{nodes.map(node => <div key={node.id}><button aria-label={node.data.title} data-node-id={node.id} data-selected={String(Boolean(node.selected))} data-x={node.position.x} data-y={node.position.y} onClick={() => onNodeClick({}, node)} onDoubleClick={event => onNodeDoubleClick(event, node)} onContextMenu={e => { e.stopPropagation(); onNodeContextMenu(e, node); }}>{NodeComponent ? <NodeComponent data={node.data} /> : node.data.title}</button>{!NodeComponent && <span>{node.data.kindLabel}</span>}</div>)}{edges.map(edge => <span key={edge.id} data-source={edge.source} data-target={edge.target} data-geometry={geometry(edge)} data-marker={edge.markerEnd?.type} data-edge-type={edge.type}>{edge.label}</span>)}</div>; },
  BaseEdge: () => null, useInternalNode: () => undefined, useStore: () => [], Background: () => null, Controls: () => null, Handle: () => null, MarkerType: { ArrowClosed: 'arrowclosed' }, Position: { Left: 'left', Right: 'right' },
}));
vi.mock('../router', () => ({ Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a> }));

async function globalProduct(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.type(screen.getByLabelText('Title'), 'Orbit'); await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user); }
function contextualEditor(name: string) { return within(screen.getByRole('heading', { name }).closest('form')!); }
async function openInspector(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('tab', { name: 'Entity Inspector' })); return within(screen.getByRole('tabpanel', { name: 'Entity Inspector' })); }
async function openMap(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('tab', { name: 'Map' })); }
async function quickOffer(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Offer' })); const editor = contextualEditor('Add Offer'); await user.type(editor.getByLabelText('Title'), 'Subscription'); await user.click(editor.getByRole('button', { name: 'Create' })); }
function nodePoint(name: string) { const node = screen.getByRole('button', { name }); return { x: Number(node.getAttribute('data-x')), y: Number(node.getAttribute('data-y')) }; }
function nodesOverlap(a: { x: number; y: number }, aDiameter: number, b: { x: number; y: number }, bDiameter: number) { return a.x < b.x + bDiameter && a.x + aDiameter > b.x && a.y < b.y + bDiameter && a.y + aDiameter > b.y; }

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
    const title = screen.getByRole('textbox', { name: 'Title' });
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
    expect(screen.getByRole('button', { name: 'Orbit renamed line' })).toHaveFocus(); expect((await openInspector(user)).getByLabelText('Title')).toHaveValue('Orbit renamed line'); await openMap(user);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.type(screen.getByLabelText('Title'), 'Client job'); await user.click(screen.getByRole('button', { name: 'Create' })); await openMap(user);
    const client = screen.getByRole('button', { name: 'Client job' }); await user.dblClick(client.querySelector('.node-title')!); editor = screen.getByRole('textbox', { name: 'Edit title for Client job' }); await user.clear(editor); await user.type(editor, 'Cancelled'); fireEvent.keyDown(editor, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Client job' })).toHaveFocus(); expect(screen.queryByRole('button', { name: 'Cancelled' })).not.toBeInTheDocument();
  });
  it('long node title is clamped and exposes its exact title on hover and focus', () => {
    const title = 'AnExactUnbrokenTitleThatIsFarLongerThanTheRoleSizedNodeCanContain';
    render(<MapNode data={{ title, kindLabel: 'Product', layout: { diameter: 96, titleFontSize: 14, kindFontSize: 12, contentWidth: 65, compactTitle: true } }} />);
    const target = screen.getByLabelText(title);
    expect(target).toHaveClass('node-title');
    fireEvent.mouseEnter(target); expect(screen.getByRole('tooltip')).toHaveTextContent(title);
    fireEvent.mouseLeave(target); fireEvent.focus(target); expect(screen.getByRole('tooltip')).toHaveTextContent(title);
    fireEvent.blur(target); expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('renders relation groups in the default unfocused map', () => {
    render(<MapSpike initialDocument={touchpointInspectorDocument()} />);
    const group = screen.getByRole('button', { name: 'Desired Outcome group (2)' });
    expect(group).toHaveAttribute('data-node-id', 'satellite:job:desired_outcome');
    expect(within(group).getByText('2')).toHaveAccessibleName('2 targets');
    expect(screen.getAllByRole('button', { name: /Desired Outcome group/ })).toHaveLength(1);
  });

  it('traverses Relations mode by exact accessible names and follows or inspects the concrete target', async () => {
    const user = userEvent.setup(); render(<MapSpike initialDocument={touchpointInspectorDocument()} />);
    await user.click(screen.getByRole('button', { name: 'Make progress' }));
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    const targets = screen.getByRole('listbox', { name: 'Desired Outcome relation targets' });
    expect(within(targets).getByRole('option', { name: 'Finish faster', selected: true })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Finish faster' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Make progress' }));
    fireEvent.keyDown(window, { key: 'r' }); fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { code: 'Space', key: ' ', ctrlKey: true, shiftKey: true });
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Finish faster');
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
    fireEvent.focus(screen.getByLabelText('Desired Outcome: A very long concrete target title, Another concrete target title'));
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
    expect((await openInspector(user)).getByLabelText('Title')).toHaveValue('Tab title');
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
    expect(screen.getByRole('group', { name: 'Linked Offers' })).toBeInTheDocument();
  });
  it('uses one optional searchable and creatable Located in combobox for Touchpoint root creation', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); await openInspector(user);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint');
    const location = screen.getByRole('combobox', { name: 'Located in' });
    expect(location).toHaveValue('');
    for (const text of ['Where does this Touchpoint exist?', 'No location selected', 'Choose an existing location', 'Create new location']) expect(screen.queryByText(text)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/URL/)).not.toBeRequired();
    await user.type(screen.getByLabelText('Title'), 'Unplaced consultation'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' })); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Unplaced consultation' })).toBeInTheDocument(); expect(screen.getByLabelText('Located in')).toHaveValue(''); expect(screen.getByLabelText(/URL/)).toHaveValue('');
  });
  it('keeps a new root location as a draft until Touchpoint creation commits it atomically', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); await openInspector(user);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint'); await user.type(screen.getByLabelText('Title'), 'Service page'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' }));
    const location = screen.getByRole('combobox', { name: 'Located in' }); await user.type(location, 'Website'); await user.click(screen.getByRole('option', { name: 'Create "Website"' }));
    expect(location).toHaveValue('Website');
    fireEvent.focus(location); expect(screen.getAllByRole('option', { name: 'Create "Website"' })).toHaveLength(1);
    await user.type(screen.getByLabelText(/URL/), 'https://example.test/service'); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Service page' })).toBeInTheDocument(); expect(screen.getByLabelText('Located in')).toHaveValue('Website'); expect(screen.getByLabelText(/URL/)).toHaveValue('https://example.test/service');

    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint'); await user.type(screen.getByLabelText('Title'), 'Existing location page'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' }));
    const existingLocation = screen.getByRole('combobox', { name: 'Located in' }); await user.type(existingLocation, 'Web'); await user.click(screen.getByRole('option', { name: 'Website' })); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Existing location page' })).toBeInTheDocument(); expect(screen.getByLabelText('Located in')).toHaveValue('Website');
  });
  it('abandons new root location drafts on switching, clearing, cancellation, and validation failure', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); await openInspector(user);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint'); await user.type(screen.getByLabelText('Title'), 'Located seed'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' })); const seedLocation = screen.getByRole('combobox', { name: 'Located in' }); await user.type(seedLocation, 'Website'); await user.click(screen.getByRole('option', { name: 'Create "Website"' })); await user.click(screen.getByRole('button', { name: 'Create' }));
    const begin = async (title: string) => { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.selectOptions(screen.getByLabelText('Business element type'), 'touchpoint'); await user.type(screen.getByLabelText('Title'), title); };

    await begin('Cancelled point'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' })); let location = screen.getByRole('combobox', { name: 'Located in' }); await user.type(location, 'Abandoned location'); await user.click(screen.getByRole('option', { name: 'Create "Abandoned location"' })); await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await begin('Cleared point'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' })); location = screen.getByRole('combobox', { name: 'Located in' }); await user.type(location, 'Stale location'); await user.click(screen.getByRole('option', { name: 'Create "Stale location"' })); await user.clear(location); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Cleared point' })).toBeInTheDocument(); expect(screen.getByLabelText('Located in')).toHaveValue('');

    await begin('Switched point'); await user.selectOptions(screen.getByLabelText('Existing Offer'), screen.getByRole('option', { name: 'Subscription' })); location = screen.getByRole('combobox', { name: 'Located in' }); await user.type(location, 'Discard me'); await user.click(screen.getByRole('option', { name: 'Create "Discard me"' })); await user.clear(location); await user.type(location, 'Web'); await user.click(screen.getByRole('option', { name: 'Website' })); await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { name: 'Switched point' })).toBeInTheDocument(); expect(screen.getByLabelText('Located in')).toHaveValue('Website');

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
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' }).querySelector('form')).toContainElement(screen.getByLabelText('Title'));
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
    const title = inspector.getByLabelText('Title'); await user.clear(title); await user.type(title, 'Orbit edited'); await user.click(inspector.getByRole('button', { name: 'Apply changes' }));
    await openMap(user); expect(screen.getByRole('button', { name: 'Orbit edited' })).toBeInTheDocument(); expect(screen.getByLabelText('Map canvas')).toBe(mapCanvas);
    await openInspector(user); expect(inspector.getByLabelText('Title')).toHaveValue('Orbit edited');
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
    const inspector = renderTouchpointInspector(document); const linkedOffers = within(inspector.getByRole('group', { name: 'Linked Offers' }));
    await user.click(linkedOffers.getByRole('checkbox', { name: 'Subscription' })); await user.click(inspector.getByRole('button', { name: 'Apply changes' }));
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
    await user.click(within(offerJobs).getByRole('button', { name: 'Expand Make progress' })); expect(jobSelection).not.toBeChecked(); expect(within(offerJobs).getByText('• Finish faster')).toBeInTheDocument(); expect(within(offerJobs).queryByRole('checkbox', { name: 'Finish faster' })).not.toBeInTheDocument();
    const financial = offerInspector.getByRole('group', { name: 'Financial intent' }); expect(within(financial).getByRole('checkbox', { name: /^Stay affordable\s*Financial Desired Outcome$/ })).not.toBeChecked(); expect(offerInspector.getByRole('button', { name: 'Apply changes' })).toBeInTheDocument();
  });
  it('uses Product + Tab for contextual Offer creation while Tab in inputs stays native', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); expect(screen.queryByText('packaged as')).not.toBeInTheDocument(); const title = (await openInspector(user)).getByLabelText('Title'); title.focus(); const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }); title.dispatchEvent(event); expect(event.defaultPrevented).toBe(false); const reverse = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); title.dispatchEvent(reverse); expect(reverse.defaultPrevented).toBe(false); });
  it('uses Enter for an empty sibling editor but preserves Enter in forms', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Enter' }); const editor = contextualEditor('Add Product'); const title = editor.getByLabelText('Title'); expect(title).toHaveFocus(); expect(title).toHaveValue(''); await user.type(title, 'Nova{Enter}'); expect(screen.getByRole('button', { name: 'Nova' })).toBeInTheDocument(); expect(screen.queryByRole('heading', { name: 'Add Product' })).not.toBeInTheDocument(); const inspectorTitle = (await openInspector(user)).getByLabelText('Title'); inspectorTitle.focus(); const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }); inspectorTitle.dispatchEvent(event); expect(event.defaultPrevented).toBe(false); expect(screen.queryByRole('heading', { name: 'Add Product' })).not.toBeInTheDocument(); });
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
    const inspector = await openInspector(user); expect((inspector.getByLabelText('Parent Touchpoint') as HTMLSelectElement).value).toMatch(/^id-/);
    expect(inspector.getByLabelText('Located in')).toBeInTheDocument(); expect(inspector.getByLabelText(/URL/)).toBeInTheDocument();
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
    const inspector = await openInspector(user); const title = inspector.getByLabelText('Title'); await user.clear(title); await user.type(title, 'Services'); await user.click(inspector.getByRole('button', { name: 'Apply changes' }));
    await openMap(user); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); editor = contextualEditor('Add Touchpoint'); await user.type(editor.getByLabelText('Title'), 'Notion Example'); await user.click(editor.getByRole('button', { name: 'Create' }));
    await openInspector(user); expect((inspector.getByLabelText('Parent Touchpoint') as HTMLSelectElement).value).toMatch(/^id-/); expect(within(inspector.getByLabelText('Parent Touchpoint')).getByRole('option', { name: 'Services' })).toBeInTheDocument();
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
  it('guards abandonment of a dirty Product draft while workspace switching preserves it', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); const inspector = await openInspector(user);
    const title = inspector.getByLabelText('Title'); await user.clear(title); await user.type(title, 'Orbit draft');
    await openMap(user); expect(screen.queryByRole('dialog', { name: 'Unsaved Product changes' })).not.toBeInTheDocument(); await openInspector(user); expect(inspector.getByLabelText('Title')).toHaveValue('Orbit draft');
    await user.click(screen.getByRole('button', { name: 'Add element' })); const guard = screen.getByRole('dialog', { name: 'Unsaved Product changes' }); expect(guard).toBeInTheDocument();
    await user.click(within(guard).getByRole('button', { name: 'Keep editing' })); expect(inspector.getByLabelText('Title')).toHaveValue('Orbit draft');
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(within(screen.getByRole('dialog', { name: 'Unsaved Product changes' })).getByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('heading', { name: 'Add an element' })).toBeInTheDocument(); await openMap(user); expect(screen.getByRole('button', { name: 'Orbit' })).toBeInTheDocument();
  });
  it('dirty navigation offers Apply, Discard, and Keep editing', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user);
    await user.click(screen.getByRole('button', { name: 'Subscription' })); fireEvent.keyDown(window, { key: 'Tab' });
    await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); const creator = contextualEditor('Add Touchpoint');
    await user.type(creator.getByLabelText('Title'), 'Checkout'); await user.click(creator.getByRole('button', { name: 'Create & open Inspector' }));

    const inspector = within(screen.getByRole('tabpanel', { name: 'Entity Inspector' }));
    const title = inspector.getByLabelText('Title'); await user.clear(title); await user.type(title, 'Checkout draft');
    await openMap(user); expect(screen.queryByRole('dialog', { name: 'Unsaved Touchpoint changes' })).not.toBeInTheDocument();
    await openInspector(user); expect(inspector.getByLabelText('Title')).toHaveValue('Checkout draft');

    await user.click(screen.getByRole('button', { name: 'Add element' })); let guard = screen.getByRole('dialog', { name: 'Unsaved Touchpoint changes' });
    await user.click(within(guard).getByRole('button', { name: 'Keep editing' }));
    expect(inspector.getByLabelText('Title')).toHaveValue('Checkout draft'); expect(screen.queryByRole('heading', { name: 'Add an element' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add element' })); guard = screen.getByRole('dialog', { name: 'Unsaved Touchpoint changes' });
    await user.click(within(guard).getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('heading', { name: 'Add an element' })).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Cancel' })); await openMap(user);
    expect(screen.getByRole('button', { name: 'Checkout draft' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Checkout draft' })); await openInspector(user);
    await user.clear(inspector.getByLabelText('Title')); await user.type(inspector.getByLabelText('Title'), 'Discarded title');
    await user.click(screen.getByRole('button', { name: 'Add element' })); guard = screen.getByRole('dialog', { name: 'Unsaved Touchpoint changes' });
    await user.click(within(guard).getByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('heading', { name: 'Add an element' })).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Cancel' })); await openMap(user);
    expect(screen.getByRole('button', { name: 'Checkout draft' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Discarded title' })).not.toBeInTheDocument();
  });
});

it('renders an accessible peripheral link only for a safe Touchpoint URL', () => {
  const layout = { diameter: 96, titleFontSize: 14, kindFontSize: 12, contentWidth: 65, compactTitle: false };
  const { rerender } = render(<MapNode data={{ title: 'Front Page', kindLabel: 'Touchpoint', url: '/front', layout }} />);
  expect(screen.getByRole('link', { name: 'Open Front Page' })).toHaveClass('node-link', 'nodrag', 'nopan');
  rerender(<MapNode data={{ title: 'Unsafe', kindLabel: 'Touchpoint', url: 'javascript:alert(1)', layout }} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

describe('searchable Touchpoint connection picker', () => {
  afterEach(() => cleanup());
  it('Add connection searches by title and browses all Core Functional Jobs', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    expect(inspector.queryByText('Reduce errors')).not.toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Add connection' }));
    await user.selectOptions(inspector.getByLabelText('Entity kind'), 'core_functional_job');
    expect(inspector.getByRole('button', { name: /Finish faster/ })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: /Reduce errors/ })).toBeInTheDocument();
    await user.type(inspector.getByRole('searchbox', { name: 'Search by title' }), 'errors');
    expect(inspector.queryByRole('button', { name: /Finish faster/ })).not.toBeInTheDocument();
    expect(inspector.getByRole('button', { name: /Reduce errors/ })).toBeInTheDocument();
  });

  it('selecting a DO commits its owner-aware relation under Connected', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(inspector.getByRole('button', { name: 'Add connection' }));
    await user.click(inspector.getByRole('button', { name: /Finish faster/ }));
    await user.click(inspector.getByRole('button', { name: 'Add selected connection' }));
    expect(within(inspector.getByRole('region', { name: 'Connected' })).getByRole('button', { name: 'Make progress' })).toBeInTheDocument();
    expect(within(inspector.getByRole('region', { name: 'Connected' })).getByRole('button', { name: 'Finish faster' })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
  });

  it('repositions only the Touchpoint after its represented intent route commits', async () => {
    const document = touchpointInspectorDocument();
    document.placements = document.placements.map(placement => placement.entityId === 'touch' ? { ...placement, x: 1200, y: 300 } : placement);
    const before = new Map(document.placements.map(placement => [placement.entityId, { x: placement.x, y: placement.y }]));
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Add connection' }));
    await user.click(inspector.getByRole('button', { name: /Finish faster/ }));
    await user.click(inspector.getByRole('button', { name: 'Add selected connection' }));
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
    await user.click(inspector.getByRole('button', { name: 'Add connection' }));
    await user.click(inspector.getByRole('button', { name: /Finish faster/ }));
    await user.click(inspector.getByRole('button', { name: 'Cancel' }));
    expect(document).toEqual(snapshot); expect(inspector.getByRole('region', { name: 'Connected' })).toHaveTextContent('No connections yet.');
  });

  it('with multiple Offers contributor is not guessed and commit is blocked', async () => {
    const user = userEvent.setup(); const document = touchpointInspectorDocument(true); const snapshot = structuredClone(document); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Add connection' }));
    await user.click(inspector.getByRole('button', { name: /Finish faster/ }));
    const contributors = within(inspector.getByRole('group', { name: 'Contributing Offers' }));
    expect(contributors.getByRole('checkbox', { name: 'Subscription' })).not.toBeChecked();
    expect(contributors.getByRole('checkbox', { name: 'Consulting' })).not.toBeChecked();
    expect(inspector.getByRole('button', { name: 'Add selected connection' })).toBeDisabled();
    expect(document).toEqual(snapshot);
  });

  it('direct Job to Touchpoint selection is unavailable', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(); await user.click(inspector.getByRole('button', { name: 'Add connection' }));
    expect(inspector.queryByRole('button', { name: /^Make progress$/ })).not.toBeInTheDocument();
  });

  it('selecting one DO activates its parent visually without selecting its sibling', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector(); await user.click(inspector.getByRole('button', { name: 'Add connection' }));
    const selected = inspector.getByRole('button', { name: /Finish faster/ }); const sibling = inspector.getByRole('button', { name: /Reduce errors/ }); await user.click(selected);
    expect(selected).toHaveAttribute('aria-pressed', 'true'); expect(sibling).toHaveAttribute('aria-pressed', 'false'); expect(selected).toHaveAccessibleName(/Make progress/);
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
    const inspector = renderTouchpointInspector(document); const linkedOffers = within(inspector.getByRole('group', { name: 'Linked Offers' }));
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

  it('retained bulk action is draft-only and does not create upstream intent', async () => {
    const user = userEvent.setup(); const document = touchpointInspectorDocument(); const inspector = renderTouchpointInspector(document);
    await user.click(inspector.getByRole('button', { name: 'Select all current Offer intent' }));
    expect(document.productJobIntents).toEqual([]); expect(document.offerJobSelections).toEqual([]);
  });

  it('unlink review supports Cancel and Confirm with alternate contributors', async () => {
    const user = userEvent.setup(); let document = touchpointInspectorDocument(true);
    document = applyTouchpointIntentDraft(document, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a', 'offer-b'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: (() => { let id = 0; return () => `seed-${++id}`; })() });
    const inspector = renderTouchpointInspector(document); const linkedOffers = within(inspector.getByRole('group', { name: 'Linked Offers' }));
    await user.click(linkedOffers.getByRole('checkbox', { name: 'Subscription' })); await user.click(inspector.getByRole('button', { name: 'Apply changes' }));
    let review = screen.getByRole('dialog', { name: 'This change affects downstream intent' });
    expect(within(review).getByText('path to Make progress → Finish faster will be removed; alternative: Consulting')).toBeInTheDocument();
    const originalApply = inspector.getByRole('button', { name: 'Apply changes' });
    await user.click(within(review).getByRole('button', { name: 'Cancel' })); expect(review).not.toBeInTheDocument();
    await vi.waitFor(() => expect(originalApply).toHaveFocus());
    expect(linkedOffers.getByRole('checkbox', { name: 'Subscription' })).not.toBeChecked();
    expect(document.relationships).toContainEqual(expect.objectContaining({ kind: 'offer_presented_at_touchpoint', offerId: 'offer-a', touchpointId: 'touch' }));
    expect(document.touchpointJobSelections).toEqual(expect.arrayContaining([
      expect.objectContaining({ touchpointId: 'touch', offerId: 'offer-a' }),
      expect.objectContaining({ touchpointId: 'touch', offerId: 'offer-b' }),
    ]));
    await user.click(inspector.getByRole('button', { name: 'Apply changes' })); review = screen.getByRole('dialog', { name: 'This change affects downstream intent' });
    await user.click(within(review).getByRole('button', { name: 'Apply changes' }));
    expect(linkedOffers.getByRole('checkbox', { name: 'Subscription' })).not.toBeChecked(); expect(linkedOffers.getByRole('checkbox', { name: 'Consulting' })).toBeChecked();
    await vi.waitFor(() => expect(inspector.getByRole('textbox', { name: 'Title' })).toHaveFocus());
    await user.click(screen.getByRole('tab', { name: 'Map' }));
    const map = screen.getByLabelText('Map canvas');
    expect(map.querySelector('[data-source="offer-a"][data-target="touch"]')).not.toBeInTheDocument();
    expect(map.querySelector('[data-source="offer-b"][data-target="touch"]')).toBeInTheDocument();
  });

  it.skip('legacy: touchpoint unlink confirmation commits once after a prior cancel', async () => {
    const user = userEvent.setup(); let document = touchpointInspectorDocument(true);
    document = applyTouchpointIntentDraft(document, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a', 'offer-b'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: (() => { let id = 0; return () => `seed-${++id}`; })() });
    const inspector = renderTouchpointInspector(document); const linkedOffers = within(inspector.getByRole('group', { name: 'Linked Offers' }));
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

  it('touchpoint unlink confirmation failure preserves the complete durable document', async () => {
    const user = userEvent.setup(); let document = touchpointInspectorDocument(true);
    document = applyTouchpointIntentDraft(document, { touchpointId: 'touch', draft: { jobLeaves: [{ jobId: 'job', semanticLeafId: 'do-a', desiredOutcomeId: 'do-a', contributorOfferIds: ['offer-a', 'offer-b'] }], financialLeaves: [], pendingJobLeafIds: [], pendingFinancialLeafIds: [] }, newId: (() => { let id = 0; return () => `seed-${++id}`; })() });
    const inspector = renderTouchpointInspector(document); const linkedOffers = within(inspector.getByRole('group', { name: 'Linked Offers' }));
    await user.click(linkedOffers.getByRole('checkbox', { name: 'Subscription' })); await user.click(inspector.getByRole('button', { name: 'Apply changes' }));
    vi.stubGlobal('crypto', { randomUUID: () => 'seed-1' });
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply changes' }));
    expect(screen.getByRole('status')).toHaveTextContent(/record ID|already exists/i);
    expect(inspector.getByRole('button', { name: 'Apply changes' })).not.toBeDisabled();
    await user.click(screen.getByRole('tab', { name: 'Map' })); const map = screen.getByLabelText('Map canvas');
    expect(map.querySelector('[data-source="offer-a"][data-target="touch"]')).toBeInTheDocument();
    expect(map.querySelector('[data-source="offer-b"][data-target="touch"]')).toBeInTheDocument();
  });

  it('Map to Inspector round trip preserves Touchpoint draft without a prompt', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(screen.getByRole('tab', { name: 'Entity Inspector' })); const title = inspector.getByRole('textbox', { name: 'Title' }); await user.clear(title); await user.type(title, 'Checkout draft');
    await user.click(screen.getByRole('tab', { name: 'Map' })); expect(screen.queryByRole('dialog', { name: 'Unsaved Touchpoint changes' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Entity Inspector' })); expect(inspector.getByRole('textbox', { name: 'Title' })).toHaveValue('Checkout draft');
  });

  it('existing Product and Offer Inspector interaction tests continue to pass', () => {
    const inspector = renderTouchpointInspector();
    expect(within(inspector.getByRole('group', { name: 'Linked Offers' })).getByRole('checkbox', { name: 'Subscription' })).toBeChecked();
    expect(inspector.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
  });

  it('connected entity titles navigate directly between Inspectors', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(within(inspector.getByRole('group', { name: 'Linked Offers' })).getByRole('button', { name: 'Subscription' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Orbit' }));
    expect(inspector.getByRole('heading', { name: 'Orbit' })).toBeInTheDocument();
  });

  it('Inspector Back and Forward preserve shared Map selection', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.click(within(inspector.getByRole('group', { name: 'Linked Offers' })).getByRole('button', { name: 'Subscription' }));
    await user.click(inspector.getByRole('button', { name: 'Inspector Back' }));
    expect(inspector.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    await user.click(inspector.getByRole('button', { name: 'Inspector Forward' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    await openMap(user); await openInspector(user);
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
  });

  it('dirty Inspector navigation uses the existing abandonment guard', async () => {
    const user = userEvent.setup(); const inspector = renderTouchpointInspector();
    await user.clear(inspector.getByRole('textbox', { name: 'Title' })); await user.type(inspector.getByRole('textbox', { name: 'Title' }), 'Checkout draft');
    await user.click(within(inspector.getByRole('group', { name: 'Linked Offers' })).getByRole('button', { name: 'Subscription' }));
    const guard = screen.getByRole('dialog', { name: 'Unsaved Touchpoint changes' });
    await user.click(within(guard).getByRole('button', { name: 'Keep editing' }));
    expect(inspector.getByRole('textbox', { name: 'Title' })).toHaveValue('Checkout draft');
    await user.click(within(inspector.getByRole('group', { name: 'Linked Offers' })).getByRole('button', { name: 'Subscription' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Unsaved Touchpoint changes' })).getByRole('button', { name: 'Discard' }));
    expect(inspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
  });

  it('history controls expose exact accessible names', () => {
    const inspector = renderTouchpointInspector();
    expect(inspector.getByRole('button', { name: 'Inspector Back' })).toBeDisabled();
    expect(inspector.getByRole('button', { name: 'Inspector Forward' })).toBeDisabled();
  });
});
