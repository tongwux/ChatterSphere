# Verification record

Verified locally on 2026-10-21 using Node 24.19.0 on Windows, a real disposable MongoDB process, and Chromium. No production database is used.

- Clean `npm ci` installs for both lockfiles: passed.
- Production frontend build: passed (approximately 71 kB compressed JavaScript).
- Backend integration suite: **12 passed**.
- Real-browser suite: **2 passed**, including separate accounts, live two-way messaging, stored history, a lost-send-acknowledgement retry, offline/reconnect recovery, modal keyboard dismissal, mobile layout and sign-out/sign-in.
- Dependency audit during clean installs: **zero known vulnerabilities** in both lockfiles.
- Desktop login, empty workspace, real conversation and 390px mobile screenshots reviewed.
- `git diff --check`: passed.

UI identity update: compared the original login/home source and background asset, restored blue branding, translucent glass surfaces and backdrop blur, and retained the v2 functionality and security logic. The production frontend build and both Chromium regression scenarios passed after this styling update. Desktop sign-in, desktop conversation and mobile screenshots were visually reviewed and refreshed in `docs/images/`. Backend files were unchanged.

The blue glass release `069df826ce4ea84a1ad9ce56a1314cd9178e4d31` also passed [the complete GitHub Actions suite](https://github.com/tongwux/ChatterSphere/actions/runs/39657087582). Render confirmed this release live. The actual HTTPS page was refreshed and visually checked; DOM-backed style inspection confirmed blue `#3185f5` branding, translucent panel borders, `blur(22px)` backdrop filtering and the restored background asset. The hosted health endpoint returned 200 JSON after the update.

The integration suite covers protected HTTP/socket access, invalid credentials and tokens, origin checks, forged identities, bounded input, message persistence, sender identity binding, delivery to two recipient devices, recipient isolation, idempotency conflicts, pagination, production Secure cookies, session expiration, logout/replay denial, rate limits and health/security headers. Browser tests also confirm that HTML payloads render as text rather than executing.

## Public HTTPS acceptance — passed 2026-10-21

URL: https://chattersphere-tongwux.onrender.com/

Render served application commit `198cc0f6bda7209cb603b269462b2f73f89fb66f`. Actual hosted checks passed for `/api/health` (200 JSON), signed-out API access (401), Secure/HttpOnly/SameSite cookies, account creation, two independent authenticated WebSocket clients, two-way real-time delivery, idempotent retries, stored history and revoked-session denial after logout. The browser independently registered, searched users, sent a real message, signed out, and signed in again after a Render service restart; the sent message was still present in Atlas-backed history.

The first automated post-restart probe encountered Render's transient HTML loading page before the instance was ready. That probe was not counted as a pass. Health was then confirmed as 200 JSON and the post-restart login/history check was completed through the actual browser. Three launch-check accounts and their test messages remain as acceptance data; credentials were discarded.

GitHub Actions [verification run](https://github.com/tongwux/ChatterSphere/actions/runs/39560638278) passed clean installs, audits, build, integration tests and Chromium browser tests on Ubuntu. Container execution remains unverified. This is a single-instance portfolio showcase, not a load-tested or end-to-end encrypted messaging service.
