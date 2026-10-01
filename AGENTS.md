# Agent Guide

Read this file first, then `README.md`, before changing the project.

## Product boundary

- This repository owns the Desktop Web client only.
- `family-spending-backend` owns household data, financial rules, persistence, and API semantics.
- The Web communicates with the Backend only through the versioned HTTP API.
- Do not copy backend domain rules into UI code or depend on backend files directly.

## Authorities

- Backend OpenAPI is the authority for request and response shapes.
- `src/api/schema.d.ts` is generated from that contract and must not be edited by hand.
- Component state owns only presentation and in-progress user input.
- A Mapping Recommendation is a disposable prefill, never an applied decision.
- Mapping changes require Preview followed by explicit Apply.

## Change discipline

- Work from current repository evidence and preserve unrelated user changes.
- Prefer the smallest coherent feature slice over speculative shared abstractions.
- Keep API access in `src/api`; components must not call `fetch` directly.
- Keep deterministic display and draft logic outside React components when it improves clarity.
- Do not introduce a state framework, component library, or runtime schema library without a demonstrated need.
- Never commit credentials, household data, generated build output, or local environment files.

## Verification

Use the least verification that proves the changed responsibility. Before a release baseline, run:

```text
npm run typecheck
npm test
npm run build
```

When the Backend contract changes, regenerate API types first and review the resulting diff.

