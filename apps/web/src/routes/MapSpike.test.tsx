import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapSpike } from './MapSpike';

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, onNodeClick, onPaneClick, onNodeDragStop }: { nodes: Array<{ id: string; data: { title: string; kindLabel: string } }>; edges: Array<{ id: string; label: string }>; onNodeClick: (event: unknown, node: unknown) => void; onPaneClick: () => void; onNodeDragStop: (event: unknown, node: unknown) => void }) =>
    <div aria-label="Map canvas"><button onClick={onPaneClick}>Clear selection</button>{nodes.map(node => <div key={node.id}><button onClick={() => onNodeClick({}, node)}>{node.data.title}</button><span>{node.data.kindLabel}</span><button onClick={() => onNodeDragStop({}, { ...node, position: { x: 100, y: 200 } })}>Drag {node.data.title}</button></div>)}{edges.map(edge => <span key={edge.id}>{edge.label}</span>)}</div>,
  Background: () => null, Controls: () => null,
  Handle: () => null, MarkerType: { ArrowClosed: 'arrowclosed' }, Position: { Left: 'left', Right: 'right' },
}));
vi.mock('../router', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a> }));

async function openCreate(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getAllByRole('button', { name: 'Add element' })[0]!); }
async function createProduct(user: ReturnType<typeof userEvent.setup>, title = 'Orbit') {
  await openCreate(user); await user.click(screen.getByRole('button', { name: 'Business side' })); await user.click(screen.getByRole('button', { name: 'Product' }));
  await user.type(screen.getByLabelText('Title'), title); await user.click(screen.getByRole('button', { name: 'Create element' }));
}
async function createOffer(user: ReturnType<typeof userEvent.setup>) {
  await openCreate(user); await user.click(screen.getByRole('button', { name: 'Business side' })); await user.click(screen.getByRole('button', { name: 'Offer' }));
  await user.type(screen.getByLabelText('Title'), 'Subscription'); await user.selectOptions(screen.getByLabelText('Linked Product'), screen.getByRole('option', { name: 'Orbit' }));
  await user.click(screen.getByRole('button', { name: 'Create element' }));
}

describe('side-aware map workflow', () => {
  beforeEach(() => { let id = 0; vi.stubGlobal('crypto', { randomUUID: () => `id-${++id}` }); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it('shows the new empty state and cancels without mutation', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    expect(screen.getByText('Begin by adding a business-side or client-side element.')).toBeInTheDocument(); await openCreate(user);
    await user.click(screen.getByRole('button', { name: 'Business side' })); await user.click(screen.getByRole('button', { name: 'Product' })); await user.type(screen.getByLabelText('Title'), 'Draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' })); expect(screen.queryByText('Draft')).not.toBeInTheDocument();
  });
  it('creates a Product independently and renders a node without epistemic controls', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await createProduct(user);
    expect(screen.getByRole('button', { name: 'Orbit' })).toBeInTheDocument(); expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Epistemic status/i)).not.toBeInTheDocument(); expect(screen.queryByLabelText(/Source note/i)).not.toBeInTheDocument();
  });
  it('explains dependencies and disables unavailable business types', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await openCreate(user); await user.click(screen.getByRole('button', { name: 'Business side' })); await user.click(screen.getByRole('button', { name: 'Offer' }));
    expect(screen.getByText('Create a Product before adding an Offer.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Create element' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Touchpoint' })); expect(screen.getByText('Create an Offer before adding a Touchpoint.')).toBeInTheDocument();
  });
  it('creates an Offer and a Touchpoint linked to one Offer, then edits their governed fields', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await createProduct(user); await createOffer(user);
    await openCreate(user); await user.click(screen.getByRole('button', { name: 'Business side' })); await user.click(screen.getByRole('button', { name: 'Touchpoint' }));
    await user.type(screen.getByLabelText('Title'), 'Checkout'); await user.click(screen.getByLabelText('Subscription')); await user.type(screen.getByLabelText('Located in'), 'The Quiet Orbit website');
    await user.click(screen.getByRole('button', { name: 'Create element' }));
    expect(screen.getByText('packaged as')).toBeInTheDocument(); expect(screen.getByText('presented at')).toBeInTheDocument();
    const inspector = screen.getByRole('complementary'); expect(within(inspector).getByText(/type and side cannot be changed/)).toBeInTheDocument();
    expect(within(inspector).queryByRole('button', { name: 'Client side' })).not.toBeInTheDocument();
    await user.clear(within(inspector).getByLabelText('Title')); await user.type(within(inspector).getByLabelText('Title'), 'Payment page');
    await user.clear(within(inspector).getByLabelText('Located in')); await user.type(within(inspector).getByLabelText('Located in'), 'Sales presentation'); await user.click(within(inspector).getByRole('button', { name: 'Apply changes' }));
    expect(screen.getByText('Changes applied.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Payment page' })).toBeInTheDocument();
  });
  it('creates Customer phenomenon through Client side without business fields', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await openCreate(user); await user.click(screen.getByRole('button', { name: 'Client side' }));
    expect(screen.getByText(/only currently available client-side type/)).toBeInTheDocument(); expect(screen.queryByLabelText('Linked Product')).not.toBeInTheDocument(); expect(screen.queryByLabelText('Located in')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Title'), 'A need'); await user.click(screen.getByRole('button', { name: 'Create element' })); expect(screen.getByRole('button', { name: 'A need' })).toBeInTheDocument();
  });
  it('preserves selection, deselection, dragging, and editing cancellation behavior', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await createProduct(user); await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByText('Select an element on the map to inspect and edit it.')).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Orbit' })); expect(screen.getByDisplayValue('Orbit')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Drag Orbit' })); await openCreate(user); await user.click(screen.getByRole('button', { name: 'Cancel' })); expect(screen.getByRole('button', { name: 'Orbit' })).toBeInTheDocument();
  });
});
