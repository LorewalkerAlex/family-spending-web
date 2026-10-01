# Web deployment

The Web and Backend are independent release units. Run this container on a loopback-only host port and let the separately managed Caddy gateway route requests:

```text
/api/*  -> 127.0.0.1:8000  (family-spending-backend)
/*      -> 127.0.0.1:8080  (family-spending-web)
```

Build and start:

```bash
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:8080/healthz
```

The image contains only generated static assets and Nginx. It has no household data, Backend filesystem access, or credentials. Browser API calls use same-origin `/api/v1`, so the gateway—not the Web image—owns API routing, HTTPS, and access control.

