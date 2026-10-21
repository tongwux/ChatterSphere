# Verification record

Verified locally on 2026-10-21 using Node 24.19.0 on Windows, a real disposable MongoDB process, and Chromium. No production database is used.

- Clean `npm ci` installs for both lockfiles: passed.
- Production frontend build: passed (approximately 71 kB compressed JavaScript).
- Backend integration suite: **12 passed**.
- Real-browser suite: **2 passed**, including separate accounts, live two-way messaging, stored history, a lost-send-acknowledgement retry, offline/reconnect recovery, modal keyboard dismissal, mobile layout and sign-out/sign-in.
- Dependency audit during clean installs: **zero known vulnerabilities** in both lockfiles.
- Desktop login, empty workspace, real conversation and 390px mobile screenshots reviewed.
- `git diff --check`: passed.

The integration suite covers protected HTTP/socket access, invalid credentials and tokens, origin checks, forged identities, bounded input, message persistence, sender identity binding, delivery to two recipient devices, recipient isolation, idempotency conflicts, pagination, production Secure cookies, session expiration, logout/replay denial, rate limits and health/security headers. Browser tests also confirm that HTML payloads render as text rather than executing.

Known verification limits: container execution and public HTTPS deployment are not yet verified. A Render login and an Atlas database/secret/network configuration are required before hosted acceptance checks. Local success does not establish a deployed production service. GitHub Actions results are linked from the PR after it is created.
