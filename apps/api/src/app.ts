import swagger from '@fastify/swagger';
import { API_VERSION, HEALTH_PATH, healthResponseSchema, type HealthResponse } from '@vee/contracts';
import Fastify from 'fastify';

export async function buildApp() {
  const app = Fastify();

  await app.register(swagger, {
    openapi: {
      info: { title: 'VEE architecture spike API', version: API_VERSION },
    },
  });

  app.get<{ Reply: HealthResponse }>(HEALTH_PATH, {
    schema: { response: { 200: healthResponseSchema } },
  }, async () => ({ status: 'ok', service: 'vee-api', apiVersion: API_VERSION }));

  app.get('/openapi.json', async () => app.swagger());
  await app.ready();
  return app;
}
