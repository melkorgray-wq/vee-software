import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, type MouseEvent, type ReactNode } from 'react';
import { MapNode, MapSpike } from './MapSpike';

type MockNode = { id: string; position: { x: number; y: number }; data: { title: string; kindLabel: string } };
type MockEdge = { id: string; source: string; target: string; markerEnd?: { type: string }; label?: string };
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, onInit, onNodeClick, onNodeContextMenu, onPaneClick, onPaneContextMenu }: { nodes: MockNode[]; edges: MockEdge[]; onInit: (instance: object) => void; onNodeClick: (event: object, node: MockNode) => void; onNodeContextMenu: (event: MouseEvent, node: MockNode) => void; onPaneClick: () => void; onPaneContextMenu: (event: MouseEvent) => void }) => { useEffect(() => onInit({ screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x: x - 10, y: y - 20 }), flowToScreenPosition: ({ x, y }: { x: number; y: number }) => ({ x: x + 10, y: y + 20 }) }), [onInit]); return <div aria-label="Map canvas" onContextMenu={onPaneContextMenu}><button onClick={onPaneClick}>Clear selection</button>{nodes.map(node => <div key={node.id}><button data-x={node.position.x} data-y={node.position.y} onClick={() => onNodeClick({}, node)} onContextMenu={e => { e.stopPropagation(); onNodeContextMenu(e, node); }}>{node.data.title}</button><span>{node.data.kindLabel}</span></div>)}{edges.map(edge => <span key={edge.id} data-source={edge.source} data-target={edge.target} data-marker={edge.markerEnd?.type}>{edge.label}</span>)}</div>; },
  Background: () => null, Controls: () => null, Handle: () => null, MarkerType: { ArrowClosed: 'arrowclosed' }, Position: { Left: 'left', Right: 'right' },
}));
vi.mock('../router', () => ({ Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a> }));

async function globalProduct(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.type(screen.getByLabelText('Title'), 'Orbit'); await user.click(screen.getByRole('button', { name: 'Create element' })); }
function contextualEditor(name: string) { return within(screen.getByRole('heading', { name }).closest('form')!); }
async function quickOffer(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Tab' }); const editor = contextualEditor('Add Offer'); await user.type(editor.getByLabelText('Title'), 'Subscription'); await user.click(editor.getByRole('button', { name: 'Create' })); }

describe('map-first authoring interactions', () => {
  beforeEach(() => { let id = 0; vi.stubGlobal('crypto', { randomUUID: () => `id-${++id}` }); }); afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it('opens valid root choices on canvas context menu and cancels with Escape', async () => { render(<MapSpike />); fireEvent.contextMenu(screen.getByLabelText('Map canvas'), { clientX: 40, clientY: 50 }); expect(screen.getByRole('menuitem', { name: 'Product' })).toBeInTheDocument(); expect(screen.queryByRole('menuitem', { name: 'Offer' })).not.toBeInTheDocument(); fireEvent.keyDown(window, { key: 'Escape' }); expect(screen.queryByRole('menu')).not.toBeInTheDocument(); });
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
    const inspector = within(screen.getByRole('complementary')); const resists = within(inspector.getByRole('group', { name: 'Resists' }));
    expect(resists.getAllByRole('checkbox')).toHaveLength(2); expect(resists.getByLabelText(/Progress/)).toBeChecked(); expect(resists.getByLabelText(/Belong/)).not.toBeChecked();
    await user.click(resists.getByLabelText(/Belong/)); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); expect(screen.getByText('Changes applied.')).toBeInTheDocument();
    await user.click(resists.getByLabelText(/Progress/)); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); expect(screen.getByText('Changes applied.')).toBeInTheDocument();
    await user.click(within(inspector.getByRole('group', { name: 'Resists' })).getByLabelText(/Belong/)); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); expect(screen.getByRole('status')).toHaveTextContent('at least one'); await user.click(within(inspector.getByRole('group', { name: 'Resists' })).getByLabelText(/Progress/));
    fireEvent.keyDown(window, { key: 'Enter' }); expect(contextualEditor('Add Repulsor').getByText('Resists: Belong')).toBeInTheDocument(); await user.click(contextualEditor('Add Repulsor').getByRole('button', { name: 'Cancel' }));
    const reverseTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); fireEvent(window, reverseTab); expect(reverseTab.defaultPrevented).toBe(false); fireEvent.contextMenu(screen.getByRole('button', { name: 'Fear delay' })); expect(screen.queryByRole('menuitem', { name: 'Add child' })).not.toBeInTheDocument(); expect(screen.queryByRole('menuitem', { name: 'Add Repulsor' })).not.toBeInTheDocument(); await user.click(screen.getByRole('menuitem', { name: 'Duplicate' })); expect(screen.getAllByRole('button', { name: 'Fear delay' })).toHaveLength(2);
  });
  it('uses the same canonical Core Functional Job child flow for Tab and Add child', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.type(screen.getByLabelText('Title'), 'Make progress'); await user.click(screen.getByRole('button', { name: 'Create element' }));
    await user.click(screen.getByRole('button', { name: 'Make progress' })); fireEvent.keyDown(window, { key: 'Tab' });
    const chooser = screen.getByRole('dialog', { name: 'Choose child type' }); expect(within(chooser).getAllByRole('button').map(button => button.textContent)).toEqual(['Related Job', 'Desired Outcome', 'Cancel']);
    await user.click(within(chooser).getByRole('button', { name: 'Related Job' })); const editor = contextualEditor('Add Related Job'); await user.type(editor.getByLabelText('Title'), 'Coordinate team'); await user.click(editor.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('button', { name: 'Coordinate team' })).toBeInTheDocument(); expect(screen.queryByText('related job of')).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Make progress' })); expect(screen.getByRole('menuitem', { name: 'Add Repulsor' })).toBeInTheDocument(); await user.click(screen.getByRole('menuitem', { name: 'Add child' })); expect(screen.getByRole('dialog', { name: 'Choose child type' })).toBeInTheDocument();
  });
  it('separates canonical Child and contextual Add Repulsor across Client roots', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    for (const [kind, title] of [['consumption_chain_job', 'Acquire'], ['emotional_job', 'Feel'], ['social_job', 'Belong'], ['financial_desired_outcome', 'Save']] as const) { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.selectOptions(screen.getByLabelText('Client element type'), kind); await user.type(screen.getByLabelText('Title'), title); await user.click(screen.getByRole('button', { name: 'Create element' })); }
    await user.click(screen.getByRole('button', { name: 'Acquire' })); fireEvent.keyDown(window, { key: 'Tab' }); expect(contextualEditor('Add Desired Outcome').getByLabelText('Title')).toHaveValue(''); await user.click(contextualEditor('Add Desired Outcome').getByRole('button', { name: 'Cancel' }));
    for (const title of ['Acquire', 'Feel', 'Belong']) {
      await user.click(screen.getByRole('button', { name: title }));
      const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }); fireEvent(window, tab);
      if (title === 'Acquire') { expect(tab.defaultPrevented).toBe(true); await user.click(contextualEditor('Add Desired Outcome').getByRole('button', { name: 'Cancel' })); } else { expect(tab.defaultPrevented).toBe(false); expect(screen.queryByRole('heading', { name: 'Add Repulsor' })).not.toBeInTheDocument(); }
      const reverseTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); fireEvent(window, reverseTab); expect(reverseTab.defaultPrevented).toBe(true); expect(contextualEditor('Add Repulsor').getByText(`Resists: ${title}`)).toBeInTheDocument(); await user.click(contextualEditor('Add Repulsor').getByRole('button', { name: 'Cancel' }));
      fireEvent.contextMenu(screen.getByRole('button', { name: title })); expect(screen.getByRole('menuitem', { name: 'Add Repulsor' })).toHaveAttribute('aria-keyshortcuts', 'Shift+Tab'); expect(screen.queryByRole('menuitem', { name: 'Add child' }) !== null).toBe(title === 'Acquire'); await user.click(screen.getByRole('menuitem', { name: 'Add Repulsor' })); expect(contextualEditor('Add Repulsor').getByText(`Resists: ${title}`)).toBeInTheDocument(); await user.click(contextualEditor('Add Repulsor').getByRole('button', { name: 'Cancel' }));
    }
  });
  it('creates blank contextual siblings under the same parent and edits the semantic parent in Inspector', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    for (const title of ['Core A', 'Core B']) { await user.click(screen.getByRole('button', { name: 'Add element' })); await user.click(screen.getByRole('button', { name: 'Client side' })); await user.type(screen.getByLabelText('Title'), title); await user.click(screen.getByRole('button', { name: 'Create element' })); }
    await user.click(screen.getByRole('button', { name: 'Core A' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.click(screen.getByRole('button', { name: 'Desired Outcome' })); let editor = contextualEditor('Add Desired Outcome'); await user.type(editor.getByLabelText('Title'), 'Faster'); await user.click(editor.getByRole('button', { name: 'Create' }));
    fireEvent.keyDown(window, { key: 'Enter' }); editor = contextualEditor('Add Desired Outcome'); expect(editor.getByLabelText('Title')).toHaveValue(''); await user.type(editor.getByLabelText('Title'), 'Safer'); await user.click(editor.getByRole('button', { name: 'Create' }));
    const inspector = within(screen.getByRole('complementary')); expect(inspector.getByLabelText('Semantic parent')).not.toHaveValue(''); await user.selectOptions(inspector.getByLabelText('Semantic parent'), within(inspector.getByLabelText('Semantic parent')).getByRole('option', { name: 'Core B' })); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); expect(screen.getByText('Changes applied.')).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Safer' })); expect(screen.queryByRole('menuitem', { name: 'Add child' })).not.toBeInTheDocument(); expect(screen.queryByRole('menuitem', { name: 'Add Repulsor' })).not.toBeInTheDocument(); await user.click(screen.getByRole('menuitem', { name: 'Duplicate' })); expect(screen.getAllByRole('button', { name: 'Safer' })).toHaveLength(2);
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
    expect(tab.defaultPrevented).toBe(false);
    expect(screen.queryByRole('heading', { name: 'Add Repulsor' })).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Feel confident' }));
    expect(screen.queryByRole('menuitem', { name: 'Add child' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add Repulsor' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Add sibling' }));
    expect(contextualEditor('Add Emotional Job').getByLabelText('Title')).toHaveValue('');
    await user.click(contextualEditor('Add Emotional Job').getByRole('button', { name: 'Cancel' }));

    fireEvent.keyDown(window, { key: 'c', ctrlKey: true }); fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    expect(screen.getAllByRole('button', { name: 'Feel confident' })).toHaveLength(2);
    expect(screen.getAllByText('Emotional Job')).toHaveLength(2);
  });
  it('keeps overlay and flow coordinates separate for contextual canvas creation', async () => { const user = userEvent.setup(); render(<MapSpike />); fireEvent.contextMenu(screen.getByLabelText('Map canvas'), { clientX: 140, clientY: 150 }); await user.click(screen.getByRole('menuitem', { name: 'Product' })); const editor = contextualEditor('Add Product'); await user.type(editor.getByLabelText('Title'), 'Placed'); await user.click(editor.getByRole('button', { name: 'Create' })); expect(screen.getByRole('button', { name: 'Placed' })).toHaveAttribute('data-x', '130'); expect(screen.getByRole('button', { name: 'Placed' })).toHaveAttribute('data-y', '130'); });
  it('remeasures a growing Product editor near the lower edge while keeping actions reachable', async () => {
    const user = userEvent.setup(); let editorHeight = 180;
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('canvas-panel')) return DOMRect.fromRect({ x: 0, y: 0, width: 600, height: 400 });
      if (this.classList.contains('context-menu')) return DOMRect.fromRect({ width: 160, height: 180 });
      if (this.classList.contains('contextual-editor')) return DOMRect.fromRect({ width: 304, height: editorHeight });
      return DOMRect.fromRect();
    });
    const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce('Progress').mockReturnValueOnce('Faster').mockReturnValueOnce('Confidence').mockReturnValueOnce('Belonging');
    render(<MapSpike />); fireEvent.contextMenu(screen.getByLabelText('Map canvas'), { clientX: 580, clientY: 380 }); await user.click(screen.getByRole('menuitem', { name: 'Product' }));
    const editor = contextualEditor('Add Product'); expect(editor.getByRole('button', { name: 'Create' })).toBeInTheDocument(); expect(editor.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    editorHeight = 520; await user.click(editor.getByRole('button', { name: 'Add Core Functional Job' }));
    expect(editor.getByRole('button', { name: 'Add Desired Outcome' })).toBeInTheDocument(); await user.click(editor.getByRole('button', { name: 'Add Desired Outcome' }));
    await user.click(editor.getByRole('button', { name: 'Add Emotional Job' })); await user.click(editor.getByRole('button', { name: 'Add Social Job' }));
    expect(screen.getByRole('heading', { name: 'Add Product' }).closest('form')).toHaveStyle({ left: '276px', top: '8px' }); expect(editor.getByRole('button', { name: 'Create' })).toBeInTheDocument(); expect(editor.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    prompt.mockRestore(); bounds.mockRestore();
  });
  it('authors Product Jobs with nested Desired Outcomes and preselects them in a new Offer draft', async () => {
    const user = userEvent.setup(); const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce('Make progress').mockReturnValueOnce('Finish faster'); render(<MapSpike />);
    await user.click(screen.getByRole('button', { name: 'Add element' })); await user.type(screen.getByLabelText('Title'), 'Orbit'); await user.click(screen.getByRole('button', { name: 'Add Core Functional Job' }));
    const jobs = screen.getByRole('group', { name: 'Client Jobs addressed' }); expect(within(jobs).getByLabelText(/Make progress/)).toBeChecked(); await user.click(within(jobs).getByRole('button', { name: 'Add Desired Outcome' })); expect(within(jobs).getByLabelText('Finish faster')).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Create element' })); expect(screen.getByRole('button', { name: 'Make progress' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Finish faster' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Tab' }); const offer = contextualEditor('Add Offer'); expect(within(offer.getByRole('group', { name: 'Product Job Intents' })).getByLabelText('Make progress')).toBeChecked(); prompt.mockRestore();
  });
  it('uses Product + Tab for contextual Offer creation while Tab in inputs stays native', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); expect(screen.queryByText('packaged as')).not.toBeInTheDocument(); const title = within(screen.getByRole('complementary')).getByLabelText('Title'); title.focus(); const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }); title.dispatchEvent(event); expect(event.defaultPrevented).toBe(false); const reverse = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); title.dispatchEvent(reverse); expect(reverse.defaultPrevented).toBe(false); });
  it('uses Enter for an empty sibling editor but preserves Enter in forms', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Enter' }); const editor = contextualEditor('Add Product'); const title = editor.getByLabelText('Title'); expect(title).toHaveFocus(); expect(title).toHaveValue(''); await user.type(title, 'Nova{Enter}'); expect(screen.getByRole('button', { name: 'Nova' })).toBeInTheDocument(); expect(screen.queryByRole('heading', { name: 'Add Product' })).not.toBeInTheDocument(); const inspectorTitle = within(screen.getByRole('complementary')).getByLabelText('Title'); inspectorTitle.focus(); const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }); inspectorTitle.dispatchEvent(event); expect(event.defaultPrevented).toBe(false); expect(screen.queryByRole('heading', { name: 'Add Product' })).not.toBeInTheDocument(); });
  it('offers the same sibling flow from the node context menu', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); fireEvent.contextMenu(screen.getByRole('button', { name: 'Orbit' })); await user.click(screen.getByRole('menuitem', { name: 'Add sibling' })); const editor = contextualEditor('Add Product'); expect(editor.getByLabelText('Title')).toHaveValue(''); await user.type(editor.getByLabelText('Title'), 'Nova'); await user.click(editor.getByRole('button', { name: 'Create' })); expect(screen.getByRole('button', { name: 'Nova' })).toHaveAttribute('data-x', '80'); expect(screen.getByRole('button', { name: 'Nova' })).toHaveAttribute('data-y', '205'); });
  it('keeps clipboard duplication distinct from empty sibling creation', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'c', ctrlKey: true }); fireEvent.keyDown(window, { key: 'v', ctrlKey: true }); expect(screen.getAllByRole('button', { name: 'Orbit' })).toHaveLength(2); });
  it('creates Touchpoint and Child Touchpoint with inherited context and no structural labels', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); await user.click(screen.getByRole('button', { name: 'Subscription' })); fireEvent.keyDown(window, { key: 'Tab' }); let editor = contextualEditor('Add Touchpoint'); await user.type(editor.getByLabelText('Title'), 'Checkout'); await user.type(editor.getByLabelText('Located in'), 'Website'); await user.click(editor.getByRole('button', { name: 'Create "Website"' })); await user.type(editor.getByLabelText(/URL/), '/checkout'); await user.click(editor.getByRole('button', { name: 'Create' })); expect(screen.queryByText('presented at')).not.toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Checkout' })); fireEvent.keyDown(window, { key: 'Tab' }); editor = contextualEditor('Add Touchpoint'); expect(editor.getByDisplayValue('Website')).toBeInTheDocument(); await user.type(editor.getByLabelText('Title'), 'Payment'); await user.click(editor.getByRole('button', { name: 'Create' })); expect(screen.queryByText('contains')).not.toBeInTheDocument(); });
  it('duplicates through node context action and exposes safe URL editing/opening', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); fireEvent.contextMenu(screen.getByRole('button', { name: 'Orbit' })); await user.click(screen.getByRole('menuitem', { name: 'Duplicate' })); expect(screen.getAllByRole('button', { name: 'Orbit' })).toHaveLength(2); expect(screen.getByText('Element duplicated.')).toBeInTheDocument(); });
  it('uses a duplicated Touchpoint as the selected Tab parent with inherited authored context', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await quickOffer(user); await user.click(screen.getByRole('button', { name: 'Subscription' })); fireEvent.keyDown(window, { key: 'Tab' }); let editor = contextualEditor('Add Touchpoint'); await user.type(editor.getByLabelText('Title'), 'Front Page'); await user.type(editor.getByLabelText('Located in'), 'Website'); await user.click(editor.getByRole('button', { name: 'Create "Website"' })); await user.click(editor.getByRole('button', { name: 'Create' })); fireEvent.contextMenu(screen.getByRole('button', { name: 'Front Page' })); await user.click(screen.getByRole('menuitem', { name: 'Duplicate' })); const inspector = within(screen.getByRole('complementary')); const title = inspector.getByLabelText('Title'); await user.clear(title); await user.type(title, 'Services'); await user.click(inspector.getByRole('button', { name: 'Apply changes' })); fireEvent.keyDown(window, { key: 'Tab' }); editor = contextualEditor('Add Touchpoint'); expect(editor.getByDisplayValue('Website')).toBeInTheDocument(); await user.type(editor.getByLabelText('Title'), 'Notion Example'); await user.click(editor.getByRole('button', { name: 'Create' })); expect(screen.queryByText('contains')).not.toBeInTheDocument(); expect((inspector.getByLabelText('Parent Touchpoint') as HTMLSelectElement).value).toMatch(/^id-/); expect(within(inspector.getByLabelText('Parent Touchpoint')).getByRole('option', { name: 'Services' })).toBeInTheDocument(); });
  it('cancels a contextual draft without inserting an entity', async () => { const user = userEvent.setup(); render(<MapSpike />); await globalProduct(user); await user.click(screen.getByRole('button', { name: 'Orbit' })); fireEvent.keyDown(window, { key: 'Tab' }); await user.type(contextualEditor('Add Offer').getByLabelText('Title'), 'Draft offer'); fireEvent.keyDown(window, { key: 'Escape' }); expect(screen.queryByText('Draft offer')).not.toBeInTheDocument(); expect(screen.queryByText('packaged as')).not.toBeInTheDocument(); });
});

it('renders an accessible peripheral link only for a safe Touchpoint URL', () => {
  const layout = { diameter: 96, titleFontSize: 14, kindFontSize: 12, contentWidth: 65, compactTitle: false };
  const { rerender } = render(<MapNode data={{ title: 'Front Page', kindLabel: 'Touchpoint', url: '/front', layout }} />);
  expect(screen.getByRole('link', { name: 'Open Front Page' })).toHaveClass('node-link', 'nodrag', 'nopan');
  rerender(<MapNode data={{ title: 'Unsafe', kindLabel: 'Touchpoint', url: 'javascript:alert(1)', layout }} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
