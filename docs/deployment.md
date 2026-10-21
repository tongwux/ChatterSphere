# Deployment: Render + MongoDB Atlas

This version needs a long-running Node process and MongoDB. Express serves the built React client, HTTP API and Socket.io from one HTTPS origin. Deploy one service instance.

## Before deployment

1. Sign in to Render and MongoDB Atlas. Use an existing account/project if available.
2. Create or select a dedicated showcase MongoDB database. Create a database user with `readWrite` access only to `chattersphere`. Generate its password in Atlas, not in a repository or chat message.
3. Add the Render service region's outbound IP ranges to Atlas Network Access. Obtain them from the service's **Connect → Outbound** panel. Do not default to a public `0.0.0.0/0` allowlist. If the service must be created first, save it without deploying until networking is ready.
4. Copy the Atlas driver connection string into Render's secret `MONGO_DB_URI` field, with the database name `/chattersphere` and URL-encoded credentials. Never paste it into an issue, PR, README or chat.

## Render Blueprint

Open **New → Blueprint**, select `tongwux/ChatterSphere`, and select `codex/chattersphere-rebuild` for the initial reviewed deployment. The repository's `render.yaml` creates a Node web service with the build/start/health commands and an automatically generated session secret. The free service plan is declared; do not enable paid upgrades without an explicit budget.

Set these values in Render:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24.19.0` |
| `TRUST_PROXY` | `1` (Render's trusted reverse proxy) |
| `JWT_SECRET` | Blueprint-generated random value; at least 32 characters |
| `MONGO_DB_URI` | Atlas connection string for the showcase database |
| `APP_ORIGIN` | Exact assigned HTTPS URL, e.g. `https://chattersphere-xxxx.onrender.com`, without a path |

`PORT` is supplied by Render. The server listens on `0.0.0.0`. If the assigned URL is unknown during Blueprint creation, save configuration first, obtain the assigned URL, update `APP_ORIGIN`, and then deploy. The repository does not contain any live database credentials.

Manual service alternative:

- Repository: `https://github.com/tongwux/ChatterSphere`
- Branch: `codex/chattersphere-rebuild` (switch to `main` after PR merge)
- Root directory: leave empty
- Runtime: Node
- Build: `npm ci --include=dev && npm ci --prefix frontend --include=dev && npm run build`
- Start: `npm start`
- Health check: `/api/health`
- Auto deploy: Off until the first deployment and acceptance checks are complete

## Acceptance checks on the actual HTTPS URL

1. `/api/health` returns `200` with `{"status":"ok"}`.
2. A signed-out request to `/api/users` returns `401`.
3. Register two disposable showcase accounts in separate browser profiles. Confirm login cookies are HttpOnly, Secure, SameSite=Strict.
4. Find the other account in People. Confirm online status, exchange messages in both directions, then refresh and confirm history.
5. Open a second device/tab for one account; closing one tab should not remove that user's online status while another is connected.
6. Sign out. Confirm the session's socket disconnects and private APIs reject that session.
7. Restart/redeploy the service. Sign in and confirm persisted messages survive (Atlas, not the ephemeral test DB).
8. Check phone layout and connection recovery after toggling offline/online.

Record the deployed URL and smoke-check results only after those checks succeed. The free service can sleep after inactivity; allow for cold starts and test reconnection. For reliable always-on demos, choose a suitable paid plan only after the owner approves its cost.

## Other hosts

`Dockerfile` builds the frontend in a separate stage, installs production backend dependencies, and runs as the `node` user. Supply the same secrets and HTTPS origin; terminate TLS at the host/reverse proxy. Set `TRUST_PROXY=1` only when there is exactly one trusted reverse proxy. Persist MongoDB outside the app container. The Docker image has not been locally executed unless explicitly recorded in `verification.md`.

## Rollback and maintenance

Keep automatic deployment off during review. Roll back to a verified v2 version in Render if needed; do not expose the old unauthenticated Socket.io tutorial server as a rollback. Back up Atlas data before any schema migration. Rotating `JWT_SECRET` invalidates all existing sessions; users must sign in again.

References: [Render Blueprints](https://render.com/docs/blueprint-spec), [Render WebSockets](https://render.com/docs/websocket), [Atlas connection setup](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).
