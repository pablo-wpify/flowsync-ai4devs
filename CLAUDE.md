# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

Two independent npm projects with **no workspace root** — there is no root `package.json`. Every command runs from inside `backend/` or `frontend/`.

- `backend/` — AdonisJS 7 REST API, `http://localhost:3333`
- `frontend/` — React 19 + Vite, `http://localhost:5173`

Also at the root:

- `docs/` — product and verification documents, in Spanish: `prd/` (PRD of the "registro de estado técnico" MVP), `backlog/` (user stories and tickets, with ticket status and technical decisions), `verificaciones/` (dated verification reports).
- `openspec/` — OpenSpec (spec-driven changes, see **Claude Code harness**): `specs/` holds the current specs (today only `aislamiento-de-tests`), `changes/archive/` the completed changes (today `2026-10-25-aislar-base-de-tests`, i.e. ticket T-01). No change is active.

Course practice repo (FlowSync, team task management). `s1/start` is the course starting point; `origin/s1/end` and `origin/s2/start` point to the same commit (the course's end of module 1 / start of module 2). The work in this clone is on local branches stacked on `s1/start`: `feat/auth-login` (auth frontend), `docs/clase-2-prd-backlog` (PRD, stories, tickets) and `chore/clase-3-tests-aislados` (OpenSpec integration and T-01).

## Node version — read this first

The backend requires **Node >= 24**: both `@adonisjs/core` and `@poppinss/ts-exec` declare `engines.node: ">=24.0.0"`. AdonisJS 7 executes TypeScript directly via Node's native type stripping, with no build step in dev.

The default shell Node on this machine is **v20.20.2** (nvm shadowing asdf in `PATH`), under which *every* `node ace ...` command fails:

```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for .../backend/bin/console.ts
```

asdf has 24.8.0 installed and set as global. Activate Node 24 before any backend work (e.g. prefix `PATH="$HOME/.asdf/shims:$PATH"`); verify with `node -v` before concluding an ace command is broken.

The frontend now needs **Node >= 22.22** too (`react-router@8` declares `>=22.22.0`, `cn` declares `>=22`). Use Node 24 for both projects, including `npm install` — npm 11.6.0 ships with it.

## Commands

### backend/

| | |
|---|---|
| `npm run dev` | `node ace serve --hmr` |
| `npm run build` | `node ace build` |
| `npm test` | `node ace test` |
| `npm run lint` | eslint |
| `npm run format` | prettier --write |
| `npm run typecheck` | `tsc --noEmit` |
| `node ace migration:run` | run migrations **and regenerate `database/schema.ts`** |
| `node ace generate:key` | fill `APP_KEY` in `.env` |

Test filtering (Japa) — suites are positional, filters are flags:

```bash
node ace test unit                    # one suite
node ace test --files=user            # by filename
node ace test --tests="creates user"  # by test title
node ace test --groups="Signup"       # by group title
node ace test --failed --watch
```

**Tests run against their own database**, never the dev one (spec: `openspec/specs/aislamiento-de-tests/spec.md`; design and evidence: `openspec/changes/archive/2026-10-25-aislar-base-de-tests/`):

- `config/database.ts` uses `tmp/db.test.sqlite3` when `app.inTest` (set by `bin/test.ts`), `tmp/db.sqlite3` otherwise.
- `runnerHooks.setup` in `tests/bootstrap.ts` runs, in order: the safety check (`tests/support/test_database_guard.ts`), a single-run lock (`tmp/db.test.sqlite3.lock`, `tests/support/test_database_lock.ts`), deletion of the previous test database and its SQLite auxiliary files, and `testUtils.db().migrate()` (which does **not** regenerate `database/schema.ts`). Teardown rolls the migrations back, closes the connections and only then releases the lock; the test database file is kept. A lock left by a dead process is replaced automatically, inside a `tmp/db.test.sqlite3.lock.reap` directory that acts as a critical section.
- **Abandoned `.lock.reap` — manual recovery, not automatic.** If a run dies inside that critical section, the directory stays and every later run aborts with `Another test run is replacing the abandoned lock…` without touching any database. To recover: (1) confirm that every test run has finished. `pgrep -af 'ace test'` showing nothing and `kill -0 <pid>` failing for the PID in `tmp/db.test.sqlite3.lock` are aids, **not proof**: runs started another way or by another user may not show up. **If you cannot confirm that all runs have finished, do not remove `.lock.reap`**; (2) `rmdir backend/tmp/db.test.sqlite3.lock.reap` (`rmdir` only removes an empty directory); (3) run the tests again — an abandoned `.lock` is then replaced automatically. Limitation: the `.reap` directory records no owner, so the code cannot tell a live replacement from a dead one and never removes it on its own.
- The lock is covered by `tests/unit/test_database_lock_concurrency.spec.ts`: real processes, synchronized with an IPC start barrier and FIFO pause points (no sleeps), check that only one process acquires the lock and only one enters the abandoned-lock replacement at a time. Scope of that evidence: local Linux file system, six processes per scenario, coordinated (forced) interleavings, and two detected mutations (no critical section, non-atomic creation). It does not prove behavior under heavier load, on network file systems or on other operating systems.
- The safety check aborts before any database is opened, deleted or migrated if the configured file is not exactly `tmp/db.test.sqlite3`, resolves to the dev database (path, symlink or same inode), is a symlink, or the connection is already open. A second concurrent run aborts on the lock without deleting anything.
- Functional groups isolate each test with `group.each.setup(() => testUtils.db().withGlobalTransaction())`; HTTP requests made by the api client share that transaction.
- To verify that a test run leaves the dev database untouched, stop every process connected to `tmp/db.sqlite3` (the dev server writes to it on its own) and compare its checksum, and any `-journal`/`-wal`/`-shm` files, before and after `node ace test`. A matching checksum shows the file was **not modified**, not that it was **not opened**; the requirement is that it is never opened.
- **Evidence for the test-database safeguard, by kind.** *Automated:* the unit and functional tests above. *Reported observation* (manual runs, artifacts not kept): the dev-database integrity check, and the traced verification in [`docs/verificaciones/2026-10-25-salvaguarda-base-de-tests.md`](docs/verificaciones/2026-10-25-salvaguarda-base-de-tests.md) — a dangerous config aborted before any operation or test, and in two runs the protected (witness) database got only metadata calls, never an open. *Code inspection:* hook order in `tests/bootstrap.ts` and that Japa/Lucid boot opens no connection before the safeguard. That report also records an **incident**: the run rewrote `backend/node_modules/.cache/@japa/runner/summary.json` through a symlinked `node_modules`; its previous content is unknown and was not restored.
- **Disposable copies for verification: a symlinked dependency is not read-only.** Tools write caches into it (Japa writes `node_modules/.cache/`). Either isolate effectively (own dependencies, or a read-only mount) or redirect known writes into the copy, and check **every** write destination in the trace after resolving symlinks and directory descriptors, not just by path prefix. `HEAD` and `git status` unchanged do not mean the environment is unchanged: ignored files (caches, `tmp/`) do not show there.

HMR only covers `app/controllers/**` and `app/middleware/*` (`hotHook.boundaries`); edits anywhere else full-restart the server.

### frontend/

`npm run dev` · `npm run build` (`tsc -b && vite build`) · `npm run lint` (**oxlint**, not eslint) · `npm run preview` · `npm run format` (Prettier over the whole frontend). There is no test runner. Prettier config is `.prettierrc.json` (`semi: false`, `singleQuote: true`, matching the existing code); a Claude Code hook formats each frontend file Claude edits (see **Claude Code harness**).

`npm run lint` reports one expected warning: `only-export-components` in `src/components/ui/button.tsx` (shadcn exports `buttonVariants` alongside the component).

**shadcn/ui** (CLI 4.22.1, style `radix-nova`, Tailwind v4 via `@tailwindcss/vite`, config in `components.json`). Add components from *outside* the project so npx uses its own install:

```bash
cd /tmp && npx shadcn@4.22.1 add <component> --cwd <repo>/frontend
```

Running it from inside `frontend/` resolves the local `shadcn` devDependency, whose `recast` needs `tslib`; after incremental installs npm 11 can leave `node_modules/tslib` missing even though the lockfile has it (it also breaks `vite build` via `radix-ui` → `react-remove-scroll`). `npm ci` fixes the tree without touching the lockfile. CLI-written files bypass the format hook — run `npx prettier --write` on them.

## Architecture: three codegen loops

This is the part that isn't discoverable from any single file. Three generators run automatically, **their output is committed to git**, and hand-edits get overwritten.

**1. Lucid schema generation → `database/schema.ts`**

Migrations are the source of truth for columns. Models do **not** declare columns — they extend the generated `*Schema` class:

```ts
export default class User extends compose(UserSchema, withAuthFinder(hash))
```

Adding a field means: write a migration → `node ace migration:run` → `schema.ts` regenerates → the model inherits it. Configured by `schemaGeneration` in `config/database.ts`; per-column overrides go in `database/schema_rules.ts` (currently empty). Models are for behavior only — relations, mixins, computed getters (`User.initials`).

**2. Entity indexing → `.adonisjs/server/controllers.ts`**

The `indexEntities()` hook in `adonisrc.ts` indexes controllers/events/listeners. Routes bind controllers through the generated registry rather than lazy-import strings:

```ts
import { controllers } from '#generated/controllers'
router.post('signup', [controllers.NewAccount, 'store'])
```

**3. Tuyau registry → `.adonisjs/client/`**

The `generateRegistry()` hook emits a typed route registry. `backend/package.json` `exports` publishes `./data` and `./registry` — this is the intended channel for the frontend to consume backend route and response types end-to-end. `tests/bootstrap.ts` already uses it, augmenting Japa's `RoutesRegistry` with the generated `Registry` so the api client is typed per route. Nothing in `frontend/` consumes it yet: `frontend/src/lib/api.ts` declares its types by hand.

## API response convention

`providers/api_provider.ts` installs a custom `ApiSerializer` onto every `HttpContext` as `serialize`. Controllers destructure it off the ctx and return through it, which wraps the payload in `{ data: ... }`. **Not every route follows this yet**: `POST /api/v1/account/logout` and `GET /` return plain objects without `serialize`.

```ts
async store({ request, serialize }: HttpContext) {
  return serialize({ user: UserTransformer.transform(user), token: ... })
}
```

`serialize.withoutWrapping()` opts out. Paginated results have their metadata validated against Lucid's `SimplePaginatorMetaKeys` and throw if it doesn't match (no endpoint paginates yet).

Which fields leave the API is decided by **transformers, not models** — `UserTransformer.toObject()` picks an explicit whitelist, including computed getters like `initials`. Add a field to the response by adding it there, not by changing serialization on the model.

## Auth

`config/auth.ts` defines two guards; default is `api` — opaque DB access tokens via `DbAccessTokensProvider.forModel(User)`. A `web` session guard is configured but no route uses it. Global `silent_auth_middleware` populates `auth` when a token is present; named `middleware.auth()` enforces.

Routes (`start/routes.ts`, all under `/api/v1`): `auth/signup`, `auth/login` public; `account/profile`, `account/logout` behind `middleware.auth()`.

## Conventions

- Import via the subpath aliases in `package.json` `imports` (`#models/user`, `#validators/user`, `#transformers/*`, `#generated/*`, `#start/*`), not relative paths.
- Validation is VineJS in `app/validators/`, applied with `request.validateUsing(validator)`. Rules are composed from small shared factories (`email()`, `password()`). `start/validator.ts` globally transforms every validated date to a Luxon `DateTime`, so validated dates drop straight into Lucid models.

## Current state

Backend has the auth slice only: `User` model, 3 controllers, 2 migrations. Tests exist only for the test infrastructure itself: `tests/unit/` covers the test-database safety check, bounded deletion and lock against disposable files, and `tests/functional/` checks the exclusive connection, a login + protected-route example and per-test isolation. There are no tests for product features yet.

Frontend has the auth slice (signup, login, protected profile; **no logout, no Tuyau** — the API client is hand-written):

- `src/lib/api.ts` — `fetch` against `VITE_API_URL` (no Vite proxy; relies on dev CORS). Unwraps `{ data }`, throws `ApiError` with `kind` `network` | `http` | `config`, `status` and the backend's `errors[]`.
- `src/lib/errors.ts` — maps backend errors to Spanish UI text: 422 per field by VineJS `rule` (`required`, `email`, `database.unique`, `minLength`, `maxLength`, `sameAs`), 400 → bad credentials, network / 5xx → general message.
- `src/lib/session.ts` — token in **sessionStorage** under `flowsync.token` (per tab, survives reload).
- `src/auth/` — `AuthProvider` loads `GET /account/profile` whenever there is a token. **Only a 401 clears the session**; network errors and 5xx keep the token and show "Reintentar". Status: `anonymous` | `loading` | `authenticated` | `error`. `ProtectedRoute` guards `/profile`; `PublicOnlyRoute` sends `authenticated`/`loading` users from `/login`/`/signup` to `/profile` but lets `error` through so the user can sign in with another account.
- Routes: `/login`, `/signup`, `/profile`; anything else → `/profile`. Signup sends `fullName: null` (the backend validator requires the key), does not keep the signup token, and redirects to `/login` with a one-shot success notice and the email prefilled.
- Imports use the `@/` alias (`tsconfig*.json` `paths` + `vite.config.ts`). UI and error text are in Spanish.

Observed backend contract (curl, synthetic users): signup/login success → **200** `{ data: { user, token } }`; validation → 422 `{ errors: [{ message, rule, field, meta? }] }`; bad credentials → 400 `{ errors: [{ message }] }`; profile without/invalid token → 401.

`npm audit` still reports the pre-existing `vite` 8.0.0–8.1.5 advisory (installed 8.1.4).

## Local setup

- SQLite at `backend/tmp/db.sqlite3` for development and `backend/tmp/db.test.sqlite3` for tests; `tmp/*` is gitignored. The test file is selected by environment in `config/database.ts` and guarded in `tests/bootstrap.ts` (see **Commands › backend/**).
- `backend/.env` is required and validated at boot by `start/env.ts` — `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL`, `APP_KEY`, `APP_URL`, `SESSION_DRIVER` are all mandatory, so a missing one fails startup rather than degrading. Copy `.env.example` and run `node ace generate:key`.
- `.env.test` overrides `SESSION_DRIVER=memory`.
- CORS is `origin: true` in dev, empty allowlist in prod (`config/cors.ts`), with `credentials: true`.
- `frontend/.env.local` (gitignored via `*.local`) must set `VITE_API_URL` — copy `frontend/.env.example`. Without it every request fails with a "falta VITE_API_URL" message.

## Claude Code harness

- `.claude/settings.json` — `PostToolUse` hook on `Write|Edit` runs `.claude/hooks/format-frontend.sh`: Prettier on the edited file if it resolves inside `frontend/`, nothing otherwise. It needs `jq` and `frontend/node_modules` installed. On failure (missing Prettier, syntax error, etc.) it exits 2 and Claude sees the error; the edit itself is already applied. Files changed through Bash are not covered.
- `.claude/agents/adversarial-reviewer.md` — read-only reviewer (`Read`, `Grep`, `Glob`; no Bash). It cannot run git, so pass it the `git diff` and the list of new untracked files in the prompt. Its description targets uncommitted changes, but it has also reviewed a committed change (`6f2827d`) when the prompt stated that scope explicitly and included the commit's diff and the relevant files; that is a per-request use, not a change to the agent.
- **OpenSpec** (CLI 1.15.0, installed globally with the asdf Node; not a project dependency). Run every `openspec` command with `OPENSPEC_TELEMETRY=0`: the CLI collects anonymous usage stats by default.
  - `openspec/config.yaml`: schema `spec-driven`; artifacts written in Spanish, keeping OpenSpec's structural headings and `SHALL`/`MUST` keywords in English.
  - `.claude/skills/openspec-{explore,propose,apply-change,update-change,sync-specs,archive-change}/` and `.claude/commands/opsx/{explore,propose,apply,update,sync,archive}.md` — generated by `openspec init --tools claude`; regenerate with `openspec update`, do not hand-edit.
  - Flow used for T-01: `openspec new change <name>` → write proposal, delta specs, design and tasks (`openspec instructions <artifact> --change <name>`) → `openspec validate <name> --strict` → apply tasks → `openspec archive <name>`, which merges the deltas into `openspec/specs/` and moves the change to `openspec/changes/archive/`. The archive is historical: do not edit it afterwards.
  - OpenSpec is not required for every task; it was used for T-01 as practice.
