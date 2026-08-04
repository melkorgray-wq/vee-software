import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router';
import { Home } from './routes/Home';
import { RendererSpike } from './routes/RendererSpike';

const rootRoute = createRootRoute({ component: () => <Outlet /> });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home });
const rendererRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/renderer',
  component: RendererSpike,
});

const routeTree = rootRoute.addChildren([indexRoute, rendererRoute]);
export const router = createRouter({ routeTree });
export { Link };

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
