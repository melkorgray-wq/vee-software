import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapSpike } from './MapSpike';

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, onNodeClick, onPaneClick }: { nodes: Array<{ id: string; data: { title: string } }>; onNodeClick: (event: unknown, node: unknown) => void; onPaneClick: () => void }) =>
    <div aria-label="Map canvas"><button onClick={onPaneClick}>Clear selection</button>{nodes.map(node => <button key={node.id} onClick={() => onNodeClick({}, node)}>{node.data.title}</button>)}</div>,
  Background: () => null, Controls: () => null,
}));
vi.mock('../router', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a> }));

describe('map interaction spike', () => {
  beforeEach(() => { let id = 0; vi.stubGlobal('crypto', { randomUUID: () => `id-${++id}` }); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it('shows empty state and cancels an unfinished create without mutation', async () => {
    const user = userEvent.setup(); render(<MapSpike />);
    expect(screen.getByRole('heading', { name: 'Start an empty map' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Add element' })[0]!);
    expect(screen.getByRole('heading', { name: 'Add an element' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Title'), 'Draft'); await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Draft')).not.toBeInTheDocument(); expect(screen.getByText('Add an element to open its properties here.')).toBeInTheDocument();
  });
  it('requires fields, creates and selects, then edits every property and supports no selection', async () => {
    const user = userEvent.setup(); render(<MapSpike />); await user.click(screen.getAllByRole('button', { name: 'Add element' })[0]!);
    expect(screen.getByLabelText('Title')).toBeRequired();
    expect(screen.getByLabelText('Provisional entity kind')).toBeInvalid();
    expect(screen.getByLabelText('Epistemic status')).toBeInvalid();
    await user.type(screen.getByLabelText('Title'), 'Checkout');
    await user.selectOptions(screen.getByLabelText('Provisional entity kind'), 'touchpoint');
    await user.selectOptions(screen.getByLabelText('Epistemic status'), 'observed'); await user.type(screen.getByLabelText(/Source note/), 'Interview');
    await user.click(screen.getByRole('button', { name: 'Create element' }));
    const inspector = screen.getByRole('complementary'); expect(within(inspector).getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    const title = within(inspector).getByLabelText('Title'); await user.clear(title); await user.type(title, 'Payment page');
    await user.selectOptions(within(inspector).getByLabelText('Provisional entity kind'), 'offer');
    await user.selectOptions(within(inspector).getByLabelText('Epistemic status'), 'hypothesis');
    await user.clear(within(inspector).getByLabelText(/Source note/)); await user.click(within(inspector).getByRole('button', { name: 'Apply changes' }));
    expect(screen.getByText('Changes applied.')).toBeInTheDocument(); expect(screen.getAllByText('Payment page').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(within(inspector).getByText('Select an element on the map to inspect and edit it.')).toBeInTheDocument(); expect(within(inspector).queryByDisplayValue('Payment page')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Payment page' })); expect(within(inspector).getByDisplayValue('Payment page')).toBeInTheDocument();
  });
});
