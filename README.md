# VEE Software

VEE Software is intended to be a working environment for mapping a Value Exchange Ecosystem: entities, interactions, customer context, and exchanges of value represented without turning a visual connection into an unsupported causal claim.

The project is in solution discovery and Software Alpha design. This repository contains a runnable technical architecture spike, not a functional Software Alpha. Its technical architecture is **Proposed**, not accepted, and the spike does not validate the product ontology.

## Run the technical spike

Prerequisites are Node.js `>=22.12.0 <23` and pnpm `10.34.5` (also pinned through the repository's `packageManager` field).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The web application is available at <http://localhost:5173> and the API at <http://127.0.0.1:3001>. The home route (`/`) checks the versioned API health endpoint. The renderer route (`/renderer`) displays a neutral, read-only React Flow fixture.

Run every automated quality gate with:

```sh
pnpm check
```

## Project documents

- [Product boundary](PRODUCT.md)
- [Repository governance](AGENTS.md)
- [Proposed platform architecture](docs/decisions/0001-platform-architecture.md)
- [Public VEE conceptual background](https://thequietorbit.com/value-exchange-ecosystem/)
