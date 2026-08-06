import { useQuery } from '@tanstack/react-query';
import { HEALTH_PATH, type HealthResponse } from '@vee/contracts';
import { Link } from '../router';

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(HEALTH_PATH);
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return response.json() as Promise<HealthResponse>;
}

export function Home() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, retry: false });
  return (
    <main>
      <p>VEE Software</p>
      <h1>Technical architecture spike</h1>
      <p>No functional Software Alpha exists yet. This page only validates browser and API tooling integration.</p>
      <section aria-labelledby="api-status">
        <h2 id="api-status">API status</h2>
        {health.isPending && <p role="status">Checking the API…</p>}
        {health.isError && <p role="alert">The API is unavailable. Start the API development server and try again.</p>}
        {health.data && <p role="status">Healthy: {health.data.service} ({health.data.apiVersion})</p>}
      </section>
      <Link to="/map">Open the domain and interaction spike</Link>
    </main>
  );
}
