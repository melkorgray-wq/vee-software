import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { router } from '../router';

vi.mock('./MapSpike', () => ({
  MapSpike: () => <h1>Domain and interaction spike</h1>,
}));

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  router.update({ history: createMemoryHistory({ initialEntries: ['/'] }) });
  return render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe('home route', () => {
  it('shows the spike, loading and healthy states, and map navigation', async () => {
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Technical architecture spike' })).toBeInTheDocument();
    expect(screen.getByText('Checking the API…')).toBeInTheDocument();
    resolveFetch(new Response(JSON.stringify({ status: 'ok', service: 'vee-api', apiVersion: 'v1' })));
    expect(await screen.findByText('Healthy: vee-api (v1)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Open the domain and interaction spike' }));
    expect(await screen.findByRole('heading', { name: 'Domain and interaction spike' })).toBeInTheDocument();
  });

  it('shows an explicit unavailable state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent('The API is unavailable');
  });
});
