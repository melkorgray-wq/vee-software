import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router';
import { Home } from './routes/Home';
import { MapSpike } from './routes/MapSpike';

const rootRoute = createRootRoute({ component: () => <Outlet /> });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home });
const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/map',
  component: MapSpike,
});

const routeTree = rootRoute.addChildren([indexRoute, mapRoute]);
export const router = createRouter({ routeTree });
export { Link };

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
