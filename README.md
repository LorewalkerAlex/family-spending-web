# Family Spending Web

Independent Desktop Web client for Family Spending. The Backend remains the sole owner of household data and financial behavior; this project consumes `/api/v1` only.

The implemented workspaces are Mapping Review and the Transaction Ledger:

```text
load unclassified descriptions
  -> prefill the Backend recommendation
  -> allow an explicit user adjustment
  -> preview the affected transactions
  -> confirm and apply the Mapping
  -> reload the queue and runtime status
```

Recommendations never apply themselves. Changing Merchant or Category invalidates the current preview token.

After a Mapping is applied, the success action opens the Transaction Ledger with an exact
description filter. The Backend performs that query, so the verification path does not rely on
loading a bounded client-side snapshot. The ledger also provides Backend-owned type,
classification, category and sort filters, offset pagination, and a separately loaded transaction
detail with its current Enrichment.

Client navigation uses stable hash routes:

```text
#mapping-review
#transactions
#transactions?description=<exact source description>
```

## Development

Requirements:

- Node.js 24 or newer;
- Family Spending Backend running on `127.0.0.1:8000`.

```powershell
npm install
npm run api:generate
npm run dev
```

Vite listens on `127.0.0.1:5173` and proxies `/api` to the local Backend. Override the development target with `VITE_API_TARGET` when necessary.

## Contract workflow

`src/api/schema.d.ts` is generated from the live Backend OpenAPI document:

```powershell
npm run api:generate
```

Commit the generated diff together with any compatible Web changes. Do not edit the generated file manually and do not maintain parallel handwritten transport DTOs.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

Tests focus on the API workflow and deterministic presentation behavior. Backend financial behavior is not reimplemented or retested here.

## Deployment

The production image serves static assets and the SPA fallback on port 80. The independent Caddy gateway routes `/api/*` to the Backend and all other paths to this Web container. The Web image contains no Backend credentials or household data.
