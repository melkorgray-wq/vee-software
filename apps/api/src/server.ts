import { buildApp } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const app = await buildApp();

await app.listen({ host: '127.0.0.1', port });
