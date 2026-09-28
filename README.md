# Tram Tracker web backend

Express and Socket.IO service for two tram positions. The service stores the latest location of each tram in Redis and broadcasts updates to connected clients. It listens on port 8080 by default.

## Local development

Requires Node.js 18, npm, and Redis.

```sh
npm ci
REDIS_HOST=127.0.0.1 npm run dev
```

`GET /health` reports service and Redis status. The Socket.IO endpoint is `/socket.io/`. The complete local stack is available from the sibling `tram-tracker` workspace root with `docker compose --profile mock up -d --build`.

## Location interface

The publisher sends the Socket.IO event `update-tram-data`:

```json
{
  "tramId": "tram_1",
  "data": {
    "c": { "lat": 13.612214, "lon": 100.836749, "t": "2026-09-27T12:00:00.000Z" },
    "p": { "lat": 13.612210, "lon": 100.836745, "t": "2026-09-27T11:59:59.500Z" },
    "s": "active"
  }
}
```

Accepted tram IDs are `tram_1` and `tram_2`. The backend writes each update to Redis and emits `tram-data-update`. Clients can request current positions with `request-tram-data` or `request-all-trams`. The current write interface has no authentication and should be reviewed before public exposure.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP and Socket.IO port |
| `REDIS_HOST` | `127.0.0.1` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_DB` | `0` | Redis database |
| `REDIS_PASSWORD` | unset | Optional Redis password |
| `FRONTEND_URL` | `http://localhost:5173` | Additional allowed Socket.IO origin |

## Production image

```sh
docker build -t tram-tracker-backend:local .
```

Pushing to `main` builds and publishes `ghcr.io/au-journey/au-journey-web-backend` with a moving `:main` tag and a commit-specific `:sha-<commit>` tag. The workflow only publishes the image; deployment remains manual. GHCR package visibility is configured separately after the first publication.
