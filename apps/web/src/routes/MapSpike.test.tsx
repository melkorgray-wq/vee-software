import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, type MouseEvent, type ReactNode } from 'react';
import { MapNode, MapSpike } from './MapSpike';

type MockNode = { id: string; position: { x: number; y: number }; data: { title: string; kindLabel: string } };
type MockEdge = { id: string; source: string; target: string; type?: string; markerEnd?: { type: string }; label?: string };
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, edgeTypes, nodeTypes, tabIndex, onInit, onNodeClick, onNodeDoubleClick, onNodeContextMenu, onPaneClick, onPaneContextMenu }: { nodes: MockNode[]; edges: MockEdge[]; edgeTypes?: Record<string, unknown>; nodeTypes?: Record<string, (props: { data: MockNode['data'] }) => ReactNode>; tabIndex?: number; onInit: (instance: object) => void; onNodeClick: (event: object, node: MockNode) => void; onNodeDoubleClick: (event: { preventDefault(): void; stopPropagation(): void }, node: MockNode) => void; onNodeContextMenu: (event: MouseEvent, node: MockNode) => void; onPaneClick: () => void; onPaneContextMenu: (event: MouseEvent) => void }) => { useEffect(() => onInit({ screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x: x - 10, y: y - 20 }), flowToScreenPosition: ({ x, y }: { x: number; y: number }) => ({ x: x + 10, y: y + 20 }) }), [onInit]); const NodeComponent = nodeTypes?.mapNode; return <div aria-label="Map canvas" data-edge-types={Object.keys(edgeTypes ?? {}).join(',')} tabIndex={tabIndex} onContextMenu={onPaneContextMenu}><button onClick={onPaneClick}>Clear selection</button>{nodes.map(node => <div key={node.id}><button aria-label={node.data.title} data-node-id={node.id} data-x={node.position.x} data-y={node.position.y} onClick={() => onNodeClick({}, node)} onDoubleClick={event => onNodeDoubleClick(event, node)} onContextMenu={e => { e.stopPropagation(); onNodeContextMenu(e, node); }}>{NodeComponent ? <NodeComponent data={node.data} /> : node.data.title}</button>{!NodeComponent && <span>{node.data.kindLabel}</span>}</div>)}{edges.map(edge => <span key={edge.id} data-source={edge.source} data-target={edge.target} data-marker={edge.markerEnd?.type} data-edge-type={edge.type}>{edge.label}</span>)}</div>; },
  BaseEdge: () => null, useInternalNode: () => undefined, useStore: () => [], Background: () => null, Controls: () => null, Handle: () => null, MarkerType: { ArrowClosed: 'arrowclosed' }, Position: { Left: 'left', Right: 'right' },
}));
vi.mock('../router', () => ({ Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a> }));

async function globalProduct(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.type(screen.getByLabelText('Title'), 'Orbit'); await user.click(screen.getByRole('button', { name: 'Create element' })); }
function contextualEditor(name: string) { return within(screen.getByRole('heading', { name }).closest('form')!); }
async function openInspector(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('tab', { name: 'Entity Inspector' })); return within(screen.getByRole('tabpanel', { name: 'Entity Inspector' })); }
async function openMap(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('tab', { name: 'Map' })); }
async function quickOffer(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Offer' })); const editor = contextualEditor('Add Offer'); await user.type(editor.getByLabelText('Title'), 'Subscription'); await user.click(editor.getByRole('button', { name: 'Create' })); }

describe('map-first authoring interactions', () => {
  it('edits authored Business and Client titles inline with commit, cancel, and keyboard ownership', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user);
    const product = screen.getByRole('button', { name: 'Orbit' }); await user.click(product); expect(screen.queryByRole('textbox', { name: /Edit title/ })).not.toBeInTheDocument();
    await user.dblClick(product); let editor = screen.getByRole('textbox', { name: 'Edit title for Orbit' }); expect(editor).toHaveFocus();
    (editor as HTMLTextAreaElement).setSelectionRange(0, 0); await user.type(editor, 'New ', { skipClick: true }); expect(editor).toHaveValue('New Orbit'); expect((editor as HTMLTextAreaElement).selectionStart).toBe(4);
    (editor as HTMLTextAreaElement).setSelectionRange(4, 9); await user.type(editor, 'Path', { skipClick: true }); expect(editor).toHaveValue('New Path'); expect(screen.getByRole('button', { name: 'Orbit' })).toBeInTheDocument();
    await user.clear(editor); await user.type(editor, 'Orbit renamed\nline'); expect(editor).toHaveValue('Orbit renamed line');
    fireEvent.keyDown(editor, { key: 'Tab' }); expect(screen.queryByRole('heading', { name: 'Add Offer' })).not.toBeInTheDocument(); fireEvent.keyDown(editor, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Orbit renamed line' })).toHaveFocus(); expect((await openInspector(user)).getByLabelText('Title')).toHaveValue('Orbit renamed line'); await openMap(user);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.type(screen.getByLabelText('Title'), 'Client job'); await user.click(screen.getByRole('button', { name: 'Create element' }));
    const client = screen.getByRole('button', { name: 'Client job' }); await user.dblClick(client); editor = screen.getByRole('textbox', { name: 'Edit title for Client job' }); await user.clear(editor); await user.type(editor, 'Cancelled'); fireEvent.keyDown(editor, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Client job' })).toHaveFocus(); expect(screen.queryByRole('button', { name: 'Cancelled' })).not.toBeInTheDocument();
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
  it('uses accessible peer workspace tabs with Map as the default and a neutral Inspector empty state', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    const map = screen.getByRole('tab', { name: 'Map' });
    const inspector = screen.getByRole('tab', { name: 'Entity Inspector' });
    expect(map).toHaveAttribute('aria-selected', 'true'); expect(inspector).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel', { name: 'Map' })).toBeVisible();
    await user.click(inspector); expect(inspector).toHaveAttribute('aria-selected', 'true'); expect(screen.getByText('Select an entity on the Map to inspect it.')).toBeInTheDocument();
    await user.click(map); expect(map).toHaveAttribute('aria-selected', 'true');
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
    await user.click(screen.getByRole('button', { name: 'Create & open Inspector' }));
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Inspect immediately');
    await openMap(user);
    expect(screen.getByRole('button', { name: 'Inspect immediately' })).toBeInTheDocument();
    await openInspector(user);
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Inspect immediately');
  });
  it('does not create or change workspace when root creation is invalid or cancelled', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' }));
    await user.click(screen.getByRole('button', { name: 'Create & open Inspector' }));
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
  it('opens a lightweight Touchpoint in Inspector through the shared continuation', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user);
    await user.click(screen.getByRole('button', { name: 'Subscription' })); fireEvent.keyDown(window, { key: 'Tab' });
    await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); const editor = contextualEditor('Add Touchpoint'); await user.type(editor.getByLabelText('Title'), 'Immediate touchpoint');
    await user.click(editor.getByRole('button', { name: 'Create & open Inspector' }));
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    const inspector = screen.getByRole('tabpanel', { name: 'Entity Inspector' }); expect(inspector).toHaveTextContent('Immediate touchpoint');
    expect(within(inspector).getByLabelText('Located in')).toHaveValue(''); expect(within(inspector).getByLabelText(/URL/)).toHaveValue('');
    expect(within(inspector).getByRole('group', { name: 'Which Client intent does this concrete Touchpoint work with?' })).toBeInTheDocument();
  });
  it('opens the context-menu target in Entity Inspector and replaces the prior selection', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user);
    await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.contextMenu(screen.getByRole('button', { name: 'Subscription' }));
    await user.click(screen.getByRole('menuitem', { name: 'Open in Entity Inspector' }));
    expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Subscription');
    await openMap(user); fireEvent.contextMenu(screen.getByRole('button', { name: 'Subscription' })); expect(screen.getByRole('menuitem', { name: 'Open in Entity Inspector' })).toBeInTheDocument();
  });
  it('toggles workspaces with layout-independent Windows/Linux and macOS shortcuts while preserving selection', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await user.click(screen.getByRole('button', { name: 'Orbit' }));
    fireEvent.keyDown(window, { code: 'Space', key: ' ', ctrlKey: true, shiftKey: true }); expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Entity Inspector' })).toHaveTextContent('Orbit');
    fireEvent.keyDown(window, { code: 'Space', key: ' ', ctrlKey: true, shiftKey: true }); expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    fireEvent.keyDown(window, { code: 'Space', key: ' ', metaKey: true, shiftKey: true }); expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true');
  });
  it('does not let the workspace shortcut steal editable or menu-owned keyboard input', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await user.click(screen.getByRole('tab', { name: 'Entity Inspector' }));
    const textarea = document.createElement('textarea'); document.body.append(textarea); textarea.focus(); fireEvent.keyDown(textarea, { code: 'Space', ctrlKey: true, shiftKey: true }); expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true'); textarea.remove();
    const editable = document.createElement('div'); editable.contentEditable = 'true'; document.body.append(editable); editable.focus(); fireEvent.keyDown(editable, { code: 'Space', ctrlKey: true, shiftKey: true }); expect(screen.getByRole('tab', { name: 'Entity Inspector' })).toHaveAttribute('aria-selected', 'true'); editable.remove();
    await openMap(user); fireEvent.contextMenu(screen.getByLabelText('Map canvas')); fireEvent.keyDown(window, { code: 'Space', ctrlKey: true, shiftKey: true }); expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true'); expect(screen.getByRole('menu')).toBeInTheDocument();
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
    fireEvent.contextMenu(node); const child = screen.getByRole('menuitem', { name: 'Add' }); expect(child).toHaveFocus();
    fireEvent.keyDown(child, { key: 'ArrowDown' }); expect(screen.getByRole('menuitem', { name: 'Add sibling' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Home' }); fireEvent.keyDown(document.activeElement!, { key: 'Enter' }); await user.click(screen.getByRole('menuitem', { name: 'Offer' })); expect(contextualEditor('Add Offer').getByLabelText('Title')).toHaveFocus();
    fireEvent.contextMenu(node); fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Add' }), { key: 'Escape' }); expect(node).toHaveFocus();
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
    for (const [kind, title] of [['core_functional_job', 'Progress'], ['social_job', 'Belong']] as const) { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.selectOptions(screen.getByLabelText('Client element type'), kind); await user.type(screen.getByLabelText('Title'), title); await user.click(screen.getByRole('button', { name: 'Create element' })); }
    await user.click(screen.getByRole('button', { name: 'Progress' })); fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    const quick = contextualEditor('Add Repulsor'); expect(quick.getByText('Resists: Progress')).toBeInTheDocument(); await user.type(quick.getByLabelText('Title'), 'Fear delay'); await user.click(quick.getByRole('button', { name: 'Create' }));
    const inspector = await openInspector(user); const resists = within(inspector.getByRole('group', { name: 'Resists' }));
    expect(resists.getAllByRole('checkbox')).toHaveLength(2); expect(resists.getByLabelText(/Progress/)).toBeChecked(); expect(resists.getByLabelText(/Belong/)).not.toBeChecked();
    await user.click(resists.getByLabelText(/Belong/)); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); expect(screen.getByText('Changes applied.')).toBeInTheDocument();
    await user.click(resists.getByLabelText(/Progress/)); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); expect(screen.getByText('Changes applied.')).toBeInTheDocument();
    await user.click(within(inspector.getByRole('group', { name: 'Resists' })).getByLabelText(/Belong/)); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); expect(screen.getByRole('status')).toHaveTextContent('at least one'); await user.click(within(inspector.getByRole('group', { name: 'Resists' })).getByLabelText(/Progress/));
    await openMap(user); fireEvent.keyDown(window, { key: 'Enter' }); expect(contextualEditor('Add Repulsor').getByText('Resists: Belong')).toBeInTheDocument(); await user.click(contextualEditor('Add Repulsor').getByRole('button', { name: 'Cancel' }));
    const reverseTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); fireEvent(window, reverseTab); expect(reverseTab.defaultPrevented).toBe(false); fireEvent.contextMenu(screen.getByRole('button', { name: 'Fear delay' })); expect(screen.queryByRole('menuitem', { name: 'Add' })).not.toBeInTheDocument(); expect(screen.queryByRole('menuitem', { name: 'Add Repulsor' })).not.toBeInTheDocument(); await user.click(screen.getByRole('menuitem', { name: 'Duplicate' })); expect(screen.getAllByRole('button', { name: 'Fear delay' })).toHaveLength(2);
  });
  it('uses the same canonical Core Functional Job child flow for Tab and Add child', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.type(screen.getByLabelText('Title'), 'Make progress'); await user.click(screen.getByRole('button', { name: 'Create element' }));
    await user.click(screen.getByRole('button', { name: 'Make progress' })); fireEvent.keyDown(window, { key: 'Tab' });
    const chooser = screen.getByRole('menu', { name: 'Add' }); expect(within(chooser).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Related Job', 'Desired Outcome', 'Repulsor', 'Cancel']);
    const related = within(chooser).getByRole('menuitem', { name: 'Related Job' }); const outcome = within(chooser).getByRole('menuitem', { name: 'Desired Outcome' }); const resistance = within(chooser).getByRole('menuitem', { name: 'Repulsor' }); const cancel = within(chooser).getByRole('menuitem', { name: 'Cancel' }); expect(related).toHaveFocus();
    fireEvent.keyDown(related, { key: 'ArrowDown' }); expect(outcome).toHaveFocus(); fireEvent.keyDown(outcome, { key: 'ArrowDown' }); expect(resistance).toHaveFocus(); fireEvent.keyDown(resistance, { key: 'ArrowDown' }); expect(cancel).toHaveFocus(); fireEvent.keyDown(cancel, { key: 'ArrowDown' }); expect(related).toHaveFocus();
    fireEvent.keyDown(related, { key: 'ArrowUp' }); expect(cancel).toHaveFocus(); fireEvent.keyDown(cancel, { key: 'End' }); expect(cancel).toHaveFocus(); fireEvent.keyDown(cancel, { key: 'Home' }); expect(related).toHaveFocus(); fireEvent.keyDown(related, { key: 'Enter' });
    const editor = contextualEditor('Add Related Job'); await user.type(editor.getByLabelText('Title'), 'Coordinate team'); await user.click(editor.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('button', { name: 'Coordinate team' })).toBeInTheDocument(); expect(screen.queryByText('related job of')).not.toBeInTheDocument();
    const reverseTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); fireEvent(window, reverseTab); expect(reverseTab.defaultPrevented).toBe(true); expect(contextualEditor('Add Repulsor').getByText('Resists: Coordinate team')).toBeInTheDocument(); await user.click(contextualEditor('Add Repulsor').getByRole('button', { name: 'Cancel' }));
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Coordinate team' })); await user.click(screen.getByRole('menuitem', { name: 'Add Repulsor' })); const repulsor = contextualEditor('Add Repulsor'); await user.type(repulsor.getByLabelText('Title'), 'Fear coordination'); await user.click(repulsor.getByRole('button', { name: 'Create' })); expect(screen.getByRole('button', { name: 'Fear coordination' })).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Make progress' })); expect(screen.getByRole('menuitem', { name: 'Add Repulsor' })).toBeInTheDocument(); await user.click(screen.getByRole('menuitem', { name: 'Add' })); expect(screen.getByRole('menu', { name: 'Add' })).toBeInTheDocument();
  });
  it('keeps context-menu and Shift+Tab Repulsor targets aligned across Client roots', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    for (const [kind, title] of [['consumption_chain_job', 'Acquire'], ['emotional_job', 'Feel'], ['social_job', 'Belong'], ['financial_desired_outcome', 'Save']] as const) { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.selectOptions(screen.getByLabelText('Client element type'), kind); await user.type(screen.getByLabelText('Title'), title); await user.click(screen.getByRole('button', { name: 'Create element' })); }
    await user.click(screen.getByRole('button', { name: 'Acquire' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Desired Outcome' })); expect(contextualEditor('Add Desired Outcome').getByLabelText('Title')).toHaveValue(''); await user.click(contextualEditor('Add Desired Outcome').getByRole('button', { name: 'Cancel' }));
    for (const title of ['Acquire', 'Feel', 'Belong']) {
      await user.click(screen.getByRole('button', { name: title }));
      const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }); fireEvent(window, tab);
      expect(tab.defaultPrevented).toBe(true); await user.click(screen.getByRole('menuitem', { name: 'Cancel' }));
      const reverseTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); fireEvent(window, reverseTab); expect(reverseTab.defaultPrevented).toBe(true); expect(contextualEditor('Add Repulsor').getByText(`Resists: ${title}`)).toBeInTheDocument(); await user.click(contextualEditor('Add Repulsor').getByRole('button', { name: 'Cancel' }));
      fireEvent.contextMenu(screen.getByRole('button', { name: title })); expect(screen.getByRole('menuitem', { name: 'Add Repulsor' })).toHaveAttribute('aria-keyshortcuts', 'Shift+Tab'); expect(screen.getByRole('menuitem', { name: 'Add' })).toBeInTheDocument(); await user.click(screen.getByRole('menuitem', { name: 'Add Repulsor' })); expect(contextualEditor('Add Repulsor').getByText(`Resists: ${title}`)).toBeInTheDocument(); await user.click(contextualEditor('Add Repulsor').getByRole('button', { name: 'Cancel' }));
    }
    const financial = screen.getByRole('button', { name: 'Save' });
    fireEvent.contextMenu(financial); expect(screen.getByRole('menuitem', { name: 'Add Repulsor' })).toHaveAttribute('aria-keyshortcuts', 'Shift+Tab'); await user.click(screen.getByRole('menuitem', { name: 'Add Repulsor' }));
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
    for (const title of ['Core A', 'Core B']) { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.type(screen.getByLabelText('Title'), title); await user.click(screen.getByRole('button', { name: 'Create element' })); }
    await user.click(screen.getByRole('button', { name: 'Core A' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Desired Outcome' })); let editor = contextualEditor('Add Desired Outcome'); await user.type(editor.getByLabelText('Title'), 'Faster'); await user.click(editor.getByRole('button', { name: 'Create' }));
    fireEvent.keyDown(window, { key: 'Enter' }); editor = contextualEditor('Add Desired Outcome'); expect(editor.getByLabelText('Title')).toHaveValue(''); await user.type(editor.getByLabelText('Title'), 'Safer'); await user.click(editor.getByRole('button', { name: 'Create' }));
    const inspector = await openInspector(user); expect(inspector.getByLabelText('Semantic parent')).not.toHaveValue(''); await user.selectOptions(inspector.getByLabelText('Semantic parent'), within(inspector.getByLabelText('Semantic parent')).getByRole('option', { name: 'Core B' })); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); expect(screen.getByText('Changes applied.')).toBeInTheDocument();
    await openMap(user); fireEvent.contextMenu(screen.getByRole('button', { name: 'Safer' })); expect(screen.queryByRole('menuitem', { name: 'Add' })).not.toBeInTheDocument(); expect(screen.queryByRole('menuitem', { name: 'Add Repulsor' })).not.toBeInTheDocument(); await user.click(screen.getByRole('menuitem', { name: 'Duplicate' })); expect(screen.getAllByRole('button', { name: 'Safer' })).toHaveLength(2);
  });
  it('creates same-kind Client-side siblings and duplicates without inventing a Tab child', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' }));
    await user.click(screen.getByRole('button', { name: 'Client side' }));
    await user.selectOptions(screen.getByLabelText('Client element type'), 'emotional_job');
    await user.type(screen.getByLabelText('Title'), 'Feel confident');
    await user.click(screen.getByRole('button', { name: 'Create element' }));
    expect(screen.getByText('Emotional Job')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Feel confident' }));
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }); fireEvent(window, tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(screen.getByRole('menuitem', { name: 'Repulsor' })).toBeInTheDocument(); fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Repulsor' }), { key: 'Escape' });
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Feel confident' }));
    expect(screen.getByRole('menuitem', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add Repulsor' })).toBeInTheDocument();
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
    const inspector = await openInspector(user); expect(inspector.getByRole('heading', { name: 'Orbit' })).toBeInTheDocument(); expect(inspector.getByRole('group', { name: 'Which Client Jobs does this Product intend to address?' })).toBeInTheDocument();
    bounds.mockRestore();
  });
  it('creates an Offer structurally without initializing semantic intent', async () => {
    const user = userEvent.setup(); const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce('Make progress').mockReturnValueOnce('Finish faster'); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.selectOptions(screen.getByLabelText('Client element type'), 'financial_desired_outcome'); await user.type(screen.getByLabelText('Title'), 'Stay affordable'); await user.click(screen.getByRole('button', { name: 'Create element' }));
    await globalProduct(user); const inspector = await openInspector(user); await user.click(inspector.getByRole('button', { name: 'Add Core Functional Job' }));
    const jobs = inspector.getByRole('group', { name: 'Which Client Jobs does this Product intend to address?' }); expect(within(jobs).getByLabelText(/Make progress/)).toBeChecked(); await user.click(within(jobs).getByRole('button', { name: 'Add Desired Outcome' })); expect(within(jobs).getByLabelText('Finish faster')).toBeChecked(); await user.click(inspector.getByRole('button', { name: 'Apply changes' }));
    await openMap(user); await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Offer' })); let offer = contextualEditor('Add Offer');
    expect(offer.getByLabelText('Title')).toBeInTheDocument(); expect(offer.getByRole('button', { name: 'Create' })).toBeInTheDocument(); expect(offer.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(offer.queryByText('Which parts of this Product’s Client intent does this Offer carry?')).not.toBeInTheDocument(); expect(offer.queryByText('Which financial criteria does this Offer address?')).not.toBeInTheDocument(); expect(offer.queryByLabelText('Linked Product')).not.toBeInTheDocument(); expect(offer.queryByText(/Touchpoint distribution/i)).not.toBeInTheDocument();
    const initialEdgeCount = document.querySelectorAll('[data-edge-type="mapEdge"]').length; await user.type(offer.getByLabelText('Title'), 'Cancelled'); expect(screen.queryByRole('button', { name: 'Cancelled' })).not.toBeInTheDocument(); expect(document.querySelectorAll('[data-edge-type="mapEdge"]')).toHaveLength(initialEdgeCount); await user.click(offer.getByRole('button', { name: 'Cancel' })); expect(screen.queryByRole('button', { name: 'Cancelled' })).not.toBeInTheDocument(); expect(document.querySelectorAll('[data-edge-type="mapEdge"]')).toHaveLength(initialEdgeCount);
    fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('menuitem', { name: 'Offer' })); offer = contextualEditor('Add Offer'); await user.type(offer.getByLabelText('Title'), 'Subscription'); await user.click(offer.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true'); expect(screen.getByRole('button', { name: 'Subscription' })).toBeInTheDocument(); expect(document.querySelectorAll('[data-edge-type="mapEdge"]')).toHaveLength(initialEdgeCount + 1);
    const offerInspector = await openInspector(user); expect(offerInspector.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument(); const offerJobs = offerInspector.getByRole('group', { name: 'Which parts of this Product’s Client intent does this Offer carry?' }); expect(within(offerJobs).getByLabelText('Make progress')).not.toBeChecked(); const financial = offerInspector.getByRole('group', { name: 'Which financial criteria does this Offer address?' }); expect(within(financial).getByLabelText('Stay affordable')).not.toBeChecked(); expect(offerInspector.getByRole('button', { name: 'Apply changes' })).toBeInTheDocument(); prompt.mockRestore();
  });
  it('uses Product + Tab for contextual Offer creation while Tab in inputs stays native', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); expect(screen.queryByText('packaged as')).not.toBeInTheDocument(); const title = (await openInspector(user)).getByLabelText('Title'); title.focus(); const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }); title.dispatchEvent(event); expect(event.defaultPrevented).toBe(false); const reverse = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); title.dispatchEvent(reverse); expect(reverse.defaultPrevented).toBe(false); });
  it('uses Enter for an empty sibling editor but preserves Enter in forms', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Enter' }); const editor = contextualEditor('Add Product'); const title = editor.getByLabelText('Title'); expect(title).toHaveFocus(); expect(title).toHaveValue(''); await user.type(title, 'Nova{Enter}'); expect(screen.getByRole('button', { name: 'Nova' })).toBeInTheDocument(); expect(screen.queryByRole('heading', { name: 'Add Product' })).not.toBeInTheDocument(); const inspectorTitle = (await openInspector(user)).getByLabelText('Title'); inspectorTitle.focus(); const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }); inspectorTitle.dispatchEvent(event); expect(event.defaultPrevented).toBe(false); expect(screen.queryByRole('heading', { name: 'Add Product' })).not.toBeInTheDocument(); });
  it('offers the same sibling flow from the node context menu', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); fireEvent.contextMenu(screen.getByRole('button', { name: 'Orbit' })); await user.click(screen.getByRole('menuitem', { name: 'Add sibling' })); const editor = contextualEditor('Add Product'); expect(editor.getByLabelText('Title')).toHaveValue(''); await user.type(editor.getByLabelText('Title'), 'Nova'); await user.click(editor.getByRole('button', { name: 'Create' })); expect(screen.getByRole('button', { name: 'Nova' })).toHaveAttribute('data-x', '80'); expect(screen.getByRole('button', { name: 'Nova' })).toHaveAttribute('data-y', '205'); });
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
  it('rejects incomplete Core Functional Job intent at the Touchpoint boundary', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.type(screen.getByLabelText('Title'), 'Make progress'); await user.click(screen.getByRole('button', { name: 'Create element' }));
    const jobId = screen.getByRole('button', { name: 'Make progress' }).getAttribute('data-node-id');
    await globalProduct(user); await quickOffer(user); await user.click(screen.getByRole('button', { name: 'Subscription' })); fireEvent.keyDown(window, { key: 'Tab' });
    await user.click(screen.getByRole('menuitem', { name: 'Touchpoint' })); const creator = contextualEditor('Add Touchpoint'); await user.type(creator.getByLabelText('Title'), 'Checkout'); await user.click(creator.getByRole('button', { name: 'Create' }));
    const touchpointId = screen.getByRole('button', { name: 'Checkout' }).getAttribute('data-node-id'); const inspector = await openInspector(user);
    await user.click(inspector.getByRole('button', { name: 'Add client intent' })); const editor = within(inspector.getByRole('dialog', { name: 'Add client intent' }));
    await user.click(editor.getByLabelText(/Make progress/)); expect(editor.getByText(/Contributing Offer:/)).toBeInTheDocument(); expect(within(editor.getByRole('region', { name: 'Change preview' })).getByText('The Product will record this Client intent.')).toBeInTheDocument();
    expect(editor.getByRole('button', { name: 'Confirm client intent' })).toBeDisabled();
    expect(within(inspector.getByRole('group', { name: 'Which Client intent does this concrete Touchpoint work with?' })).queryByLabelText('Make progress')).not.toBeInTheDocument(); expect(document.querySelector(`[data-source="${jobId}"][data-target="${touchpointId}"]`)).not.toBeInTheDocument();
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
});

it('renders an accessible peripheral link only for a safe Touchpoint URL', () => {
  const layout = { diameter: 96, titleFontSize: 14, kindFontSize: 12, contentWidth: 65, compactTitle: false };
  const { rerender } = render(<MapNode data={{ title: 'Front Page', kindLabel: 'Touchpoint', url: '/front', layout }} />);
  expect(screen.getByRole('link', { name: 'Open Front Page' })).toHaveClass('node-link', 'nodrag', 'nopan');
  rerender(<MapNode data={{ title: 'Unsafe', kindLabel: 'Touchpoint', url: 'javascript:alert(1)', layout }} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
