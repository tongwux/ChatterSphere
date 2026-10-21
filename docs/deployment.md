# Deployment: Render + MongoDB Atlas

This version needs a long-running Node process and MongoDB. Express serves the built React client, HTTP API and Socket.io from one HTTPS origin. Deploy one service instance.

## Current deployment — verified 2026-10-21

- Public app: **https://chattersphere-tongwux.onrender.com/**
- Render service: `chattersphere-tongwux`, Node 24.19.0, Free, Oregon; manually created from the public repository, automatic deploys off.
- Application commit verified online: `198cc0f6bda7209cb603b269462b2f73f89fb66f` on `codex/chattersphere-rebuild`.
- Blue glass UI release: `069df826ce4ea84a1ad9ce56a1314cd9178e4d31`, subsequently deployed and verified at the same URL. The original winter background, blue branding, translucent surfaces and backdrop blur are restored; backend logic is unchanged. [Release CI](https://github.com/tongwux/ChatterSphere/actions/runs/39657087582) passed all checks.
- MongoDB Atlas: Free `ChatterSphere` cluster, AWS Oregon. The service user has only `readWrite` on the `chattersphere` database and is scoped to this cluster.
- Atlas allows only Render's two displayed Oregon outbound ranges, `74.220.48.0/24` and `74.220.56.0/24`. These are shared regional ranges, not dedicated service IPs. No current-device IP or `0.0.0.0/0` rule was added.
- All six production environment variables are stored in Render. Database/session secrets were not committed or written to local files.
- Live acceptance passed: health JSON, signed-out access denial, secure session cookies, registration, two authenticated socket clients exchanging messages, retry deduplication, logout revocation, browser message sending, and login/history after a service restart.
- Three explicitly named launch-check accounts were created for acceptance. Their randomly generated credentials were kept in process memory and discarded after testing; they are not published demo logins.

The `render.yaml` below remains a reusable template; the live service was configured through Render's manual service form. Do not create a second Blueprint service just to update this existing deployment. After the PR is merged, change the existing service's branch to `main` and deploy that reviewed version manually.

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
