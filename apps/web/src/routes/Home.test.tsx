import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { router } from '../router';

vi.mock('./RendererSpike', () => ({
  RendererSpike: () => <h1>Read-only renderer check</h1>,
}));

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  router.update({ history: createMemoryHistory({ initialEntries: ['/'] }) });
  return render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe('home route', () => {
  it('shows the spike, loading and healthy states, and renderer navigation', async () => {
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Technical architecture spike' })).toBeInTheDocument();
    expect(screen.getByText('Checking the API…')).toBeInTheDocument();
    resolveFetch(new Response(JSON.stringify({ status: 'ok', service: 'vee-api', apiVersion: 'v1' })));
    expect(await screen.findByText('Healthy: vee-api (v1)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Open the renderer spike' }));
    expect(await screen.findByRole('heading', { name: 'Read-only renderer check' })).toBeInTheDocument();
  });

  it('shows an explicit unavailable state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent('The API is unavailable');
  });
});
