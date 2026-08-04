export const API_VERSION = 'v1' as const;
export const HEALTH_PATH = `/api/${API_VERSION}/health` as const;

export interface HealthResponse {
  status: 'ok';
  service: 'vee-api';
  apiVersion: typeof API_VERSION;
}

export const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'service', 'apiVersion'],
  properties: {
    status: { type: 'string', const: 'ok' },
    service: { type: 'string', const: 'vee-api' },
    apiVersion: { type: 'string', const: API_VERSION },
  },
} as const;
