# IONOS Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-ruby:subagent-driven-development (recommended) or superpowers-ruby:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the Gestão app for a guarded IONOS deployment with a GHCR image, persistent PostgreSQL, daily host backups, and operational runbooks.

**Architecture:** Build the React frontend and FastAPI backend into one multi-stage image. Run that image beside a private PostgreSQL Compose service, with an explicit production environment file and optional Alembic startup migration. Publish images from GitHub Actions only; a separate SSH script performs a dry run by default and requires `--apply` for an authorized release.

**Tech Stack:** Docker, Docker Compose, Node 20, Python 3.12, FastAPI/Uvicorn, PostgreSQL 16, GitHub Actions, systemd timers, POSIX shell.

---

### Task 1: Container image and local production Compose

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `ops/entrypoint.sh`
- Create: `docker-compose.ionos.yml`
- Create: `.env.ionos.example`

- [ ] **Step 1: Add the multi-stage Dockerfile and ignore local state**

  Build with `npm ci` from the checked-in lockfile, install backend requirements in a Python 3.12 slim runtime, copy only the built frontend/backend, and exclude `.env`, `*.db`, backups, Git metadata, and dependency directories from the build context.

- [ ] **Step 2: Add guarded startup and healthcheck**

  `ops/entrypoint.sh` runs `python -m alembic -c /app/backend/alembic.ini upgrade head` only when `RUN_MIGRATIONS=1` and `/app/backend/alembic/` exists, then `exec`s Uvicorn. The Docker healthcheck calls `/api/health` with Python's standard library.

- [ ] **Step 3: Define app and database Compose services**

  Use `APP_IMAGE`, `DATABASE_URL`, `SECRET_KEY`, and PostgreSQL variables from `.env.ionos`. Persist PostgreSQL at `postgres_data`, do not publish its port, expose app only on `127.0.0.1:8000`, and gate app startup on `pg_isready`.

- [ ] **Step 4: Validate the image definition**

  Run `git diff --check`, `docker compose -f docker-compose.ionos.yml config` with a temporary non-secret env file, and `docker build --check .` where supported. Expected: no Compose interpolation errors and no ignored secret/database files in the context.

### Task 2: GHCR image pipeline

**Files:**
- Create: `.github/workflows/ionos-image.yml`

- [ ] **Step 1: Define least-privilege workflow permissions and triggers**

  Trigger on `main` pushes and manual dispatch; grant `contents: read` and `packages: write`; do not add SSH keys, deploy secrets, or a production deploy step.

- [ ] **Step 2: Build and publish immutable and moving tags**

  Use official checkout, login, metadata, and build-push actions to publish `ghcr.io/karellima/gestao:sha-<shortsha>` and `:main` from the repository Dockerfile, with GitHub Actions cache enabled.

- [ ] **Step 3: Validate workflow YAML and image naming**

  Parse the YAML with Ruby/Python available locally and inspect that no Render URL or secret value is embedded. Expected: valid workflow with no deployment command.

### Task 3: Guarded deploy and backup operations

**Files:**
- Create: `ops/deploy-ionos.sh`
- Create: `ops/backup.sh`
- Create: `ops/restore.sh`
- Create: `ops/systemd/gestao-backup.service`
- Create: `ops/systemd/gestao-backup.timer`

- [ ] **Step 1: Implement simulation-first deploy**

  Default to printing the SSH target, image, and remote Compose commands. Require `--apply` before opening SSH; use `git pull --ff-only`, `docker compose pull app`, `up -d`, and a retrying `/api/health` check. Support `--host`, `--dir`, and `--image` overrides without printing secrets.

- [ ] **Step 2: Implement atomic PostgreSQL dump and retention**

  Run `pg_dump -Fc` inside the database container, write to a temporary file under `BACKUP_DIR`, atomically rename it, write a `.sha256` checksum, and prune dumps/checksums older than `RETENTION_DAYS` (default 14). Fail on missing Compose/env paths and never use shell tracing.

- [ ] **Step 3: Implement guarded restore**

  Require an explicit dump path and `--confirm`; stop the app, pipe the selected dump to `pg_restore --clean --if-exists --no-owner`, start the stack, and call `/api/health`. Refuse paths outside `BACKUP_DIR` unless `--allow-external-path` is supplied.

- [ ] **Step 4: Define and validate the systemd daily timer**

  Run the backup service from `/opt/gestao` at 03:15 with `Persistent=true`, and document installation commands. Use `systemd-analyze verify` when available; otherwise perform a shell syntax check and inspect unit fields.

### Task 4: Operations documentation

**Files:**
- Create: `docs/operacao-ionos.md`

- [ ] **Step 1: Document bootstrap and environment values**

  Explain Docker installation prerequisites, GHCR authentication, `.env.ionos` creation, `DATABASE_URL` format, and secret generation without including real credentials.

- [ ] **Step 2: Document authorized deploy, health verification, rollback, and backup**

  Include dry run before `--apply`, the exact `/api/health` check, image SHA rollback, timer verification, dump listing, checksum verification, and restore confirmation.

- [ ] **Step 3: Record publication boundary**

  State that this preparation does not access the IONOS host or DNS and that Render is not part of the operating flow, while retaining an explicit HTTP health verification after a separately authorized deploy.

### Task 5: Verification and handoff

**Files:**
- Modify: none beyond the files above

- [ ] **Step 1: Run static checks**

  Run `bash -n ops/*.sh`, `git diff --check`, and YAML parsing for Compose/workflow. Expected: zero errors.

- [ ] **Step 2: Run frontend build**

  Run `(cd frontend && npm ci && npm run build)`. Expected: Vite produces `frontend/dist` successfully; remove/ignore the generated directory from Git.

- [ ] **Step 3: Report non-production validation limits**

  Record whether Docker is available and explicitly state that no SSH, production Compose, DNS, or Render verification was run because publication requires separate authorization.

- [ ] **Step 4: Commit only deployment artifacts**

  Review `git status --short`, exclude `*.db`, `frontend/dist`, `.env.ionos`, and unrelated work, then commit the deployment files and docs with a focused message.
