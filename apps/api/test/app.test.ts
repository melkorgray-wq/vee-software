import { API_VERSION, HEALTH_PATH, type HealthResponse } from '@vee/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe('API contract', () => {
  it('returns the deterministic health response using injection', async () => {
    const app = await buildApp();
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: HEALTH_PATH });
    expect(response.statusCode).toBe(200);
    expect(response.json<HealthResponse>()).toEqual({ status: 'ok', service: 'vee-api', apiVersion: API_VERSION });
  });

  it('publishes the health route in OpenAPI', async () => {
    const app = await buildApp();
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ paths: Record<string, unknown> }>().paths).toHaveProperty(HEALTH_PATH);
  });
});
