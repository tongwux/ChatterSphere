# ChatterSphere — Real-Time Chat Learning Project

A MERN-stack learning project combining account login, persisted one-to-one messages, online-user presence, and Socket.io delivery.

**Current status:** code for a local learning/demo setup. Production security, scalability, and deployment reliability have not been established. Group discussions are not implemented.

## Implemented in source

- Signup/login/logout controllers, bcrypt password hashing, and JWT cookies.
- Protected HTTP routes for users and message history.
- MongoDB/Mongoose user, message, and conversation models.
- One-to-one message creation/history and Socket.io notifications to connected recipients.
- Online-user presence, conversation selection, search UI, and notification behavior.
- React Context for session/socket state and Zustand for selected conversation state.

These are source-level implementations, not recorded end-to-end test results.

## Demo boundaries and limitations

| Area | Current behavior |
| --- | --- |
| Data | Uses MongoDB when configured; messages are not just static frontend fixtures. |
| Socket identity | Trusts a client-supplied `userId` without socket authentication. Fix this before exposing private messaging to real users. |
| Presence | One socket per user in process memory; multi-device use, reconnects, and multiple servers require stronger handling. |
| History | Loads a conversation's messages without pagination. |
| Persistence | Saves conversation and message in parallel without a transaction; failure consistency and concurrent creation need review. |
| Group chat / scale | Group conversations, distributed delivery, and load-tested scalability are not implemented. |

## Architecture

The application lives in `Downloads/ChatterSphere/mern-chat-app-master/`.

```text
backend/
  controllers/    Account and message handlers
  middleware/     HTTP route authentication
  models/         Mongoose data models
  routes/         API routes
  socket/         Socket.io and online-user mapping
frontend/src/
  components/     Chat and sidebar UI
  hooks/          API and message-event hooks
  context/        Auth and socket state
  zustand/        Conversation selection
```

Express handles HTTP requests, MongoDB persists records, and Socket.io delivers events to connected clients. This separation is useful for studying stored state versus live notifications; it does not by itself establish delivery guarantees or production scalability.

## Local setup

Use Node.js/npm compatible with the committed dependencies and a development MongoDB instance. A tested runtime version is not yet recorded.

```sh
git clone https://github.com/tongwux/ChatterSphere.git
cd ChatterSphere/Downloads/ChatterSphere/mern-chat-app-master
npm install
npm install --prefix frontend
```

Create an uncommitted `.env` in that application directory:

```dotenv
PORT=5000
MONGO_DB_URI=mongodb://127.0.0.1:27017/chattersphere_dev
JWT_SECRET=replace_with_a_long_random_local_secret
NODE_ENV=development
```

Start the backend, then the frontend in a second terminal from the same directory:

```sh
npm run server
```

```sh
npm run dev --prefix frontend
```

Vite uses `http://localhost:3000` and proxies API calls to port 5000. Socket/CORS settings contain local URLs and need review for other environments. Use development-only accounts while socket authentication is unresolved.

`npm run build` and `npm start` are also defined. No clean build, database session, or deployment was exercised during this documentation review. No business test suite or CI workflow is committed.

## Planned — not implemented

- Authenticate sockets and derive identity from verified sessions.
- Test cross-user access denial, reconnects, and multi-device presence.
- Add pagination, input validation, and request limits.
- Review atomic persistence and duplicate conversations.
- Add CI and a reproducible deployment configuration.

## Attribution and portfolio scope

The nested source retains a tutorial-style `chat-app-yt` package name and an [MIT license crediting Burak (2024)](Downloads/ChatterSphere/mern-chat-app-master/LICENSE). That attribution is preserved. An itemized contribution beyond the base is not currently documented; this repository is presented as a learning project, without claiming independent authorship of the entire architecture.

Future implementation notes should link specific original changes and their design/testing decisions. This README does not relicense third-party code or assets.
