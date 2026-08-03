<p align="center">
  <img src="icon.svg" alt="Buzz Relay Logo" width="21%">
</p>

# Buzz Relay on StartOS

> **Upstream repo:** <https://github.com/block/buzz>
>
> This document covers the StartOS package. For **application** behavior the
> package does not alter — the relay's HTTP/WS API, media handling, and database
> semantics — upstream buzz-relay documentation applies. Packaging concerns that
> StartOS necessarily manages — networking and TLS, service lifecycle and health,
> bundled storage, and configuration — are governed by this document, not
> upstream.

Block's **buzz-relay** packaged for StartOS: the Axum WS + REST backend that
powers a self-hosted **Buzz Community**. A Buzz Community is not a bare Nostr
relay — Buzz Desktop probes community HTTP endpoints before connecting, and only
`buzz-relay` serves them. This package wraps the prebuilt `ghcr.io/block/buzz`
image — pinned by digest, not by the mutable `:main` tag — together with its
PostgreSQL, Redis, and MinIO runtime dependencies, all bundled inside the
package.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [Configuration Management](#configuration-management)
- [Actions (StartOS UI)](#actions-startos-ui)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Backups and Restore](#backups-and-restore)
- [Health Checks](#health-checks)
- [Dependencies](#dependencies)
- [Limitations and Differences](#limitations-and-differences)
- [What Is Unchanged from Upstream](#what-is-unchanged-from-upstream)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

Five prebuilt images run as in-package containers sharing one network namespace,
so the relay reaches its dependencies at `127.0.0.1` (the compose DNS names
`postgres`/`redis`/`minio` collapse to loopback). No Rust build — Block's
multi-arch image is used as published.

| Image                                      | Role                            | Architectures    |
| ------------------------------------------ | ------------------------------- | ---------------- |
| `ghcr.io/block/buzz` @ `sha256:fd837f78`   | Axum WS + REST (community)       | x86_64, aarch64  |
| `postgres:17-alpine`                       | Event store + full-text search   | x86_64, aarch64  |
| `redis:7-alpine`                           | Pub/sub + presence               | x86_64, aarch64  |
| `minio/minio:RELEASE.2025-09-07T16-13-09Z` | S3 media storage (Blossom)       | x86_64, aarch64  |
| `minio/mc:RELEASE.2025-08-13T08-35-41Z`    | One-shot bucket + service-account init | x86_64, aarch64  |

The relay runs as uid 1000 (`buzz`). A root `prepare-data` oneshot normalizes
ownership of the `main` volume on first boot (guarded by a `/data/.chowned`
sentinel so later starts skip the recursive chown).

---

## Volume and Data Layout

| Volume     | Mount (relay)     | Purpose                                                        |
| ---------- | ----------------- | ------------------------------------------------------------- |
| `main`     | `/data/git`       | Relay git object store. `store.json` (generated secrets) lives at the volume root and is **not** mounted into the relay container. |
| `postgres` | `/var/lib/postgresql/data` | PostgreSQL data (`PGDATA` at `pgdata` subpath)        |
| `redis`    | `/data`           | Redis append-only file                                        |
| `minio`    | `/data`           | MinIO object storage                                          |

The relay container only mounts the `git` subpath of `main`, so a relay
compromise cannot read `store.json` — which holds the MinIO root credentials,
database/Redis passwords, and the relay private key — off disk.

---

## Configuration Management

All runtime settings are generated or set through the single **Configuration**
action; there is no separate config file the user edits. Secrets
(`postgresPassword`, `redisPassword`, MinIO root + relay-scoped keys, relay
private key) are generated on install and persisted in `store.json` on the
`main` volume. **Changes take effect the next time Buzz Relay starts.**

Fixed, not exposed to the user:

- Relay binds `0.0.0.0:3000`; health `:8080`, metrics `:9102`
- `BUZZ_REQUIRE_AUTH_TOKEN=true`, `BUZZ_GIT_CONFORMANCE_PROBE=true`
- PostgreSQL/Redis/MinIO bind loopback with generated credentials
- The relay is handed a **bucket-scoped MinIO service account**, never the root
  credentials — a relay compromise is confined to the single media bucket.

---

## Actions (StartOS UI)

### Configuration (`config`)

Available at any service status. Fields:

- **Community Host** (required) — the public domain your community is reached at,
  exactly as added in Buzz Desktop (e.g. `buzz1.privkey.io`). No scheme, port, or
  path. The relay auto-seeds its single community from this host; it must match
  the domain the community was added as, or every request 404s.
- **Owner Public Key** (required) — your Nostr pubkey; makes you the
  owner/admin. Accepts an `npub1…` or a 64-character hex key (npub is decoded to
  hex before storage).
- **Media Bucket** (default `buzz-media`) — the MinIO bucket for media (Blossom).
  ⚠️ Changing this after media has been uploaded points the relay at a fresh,
  empty bucket; previously uploaded files stay in the old bucket and become
  unreachable, with no automatic migration. Only change on a fresh install.
- **Auto-Migrate Database** (default on) — run database migrations on startup.

---

## Network Access and Interfaces

| Interface | Port | Protocol | Purpose                  |
| --------- | ---- | -------- | ------------------------ |
| Community | 3000 | HTTP/WS  | Buzz Community endpoint   |

The MinIO console (9001), health (8080), and metrics (9102) ports bind loopback
and are intentionally **not** exposed publicly.

---

## Installation and First-Run Flow

Buzz Desktop requires a publicly-trusted `wss://` certificate on a real
hostname — a `.local` or `.onion` address will not work.

1. Install, then open **Configuration** and set the Community Host, Owner Public
   Key, and (optionally) the Media Bucket.
2. Add a **Public / Domain (Let's Encrypt)** clearnet interface for that host so
   StartOS `start-tunnel` SNI-routes it to the relay.
3. Start the service and add the community in Buzz Desktop by its `wss://`
   address (e.g. `wss://buzz1.privkey.io`).

Until the Community Host is set, the service still boots but every request 404s
(no community configured) rather than crash-looping.

---

## Backups and Restore

**Volumes backed up:** `main`, `postgres`, `redis`, `minio` — the full relay
state, database, cache, and media.

**Restore behavior:** volumes are fully restored before the service starts. A
post-restore hook drops the `/data/.chowned` sentinel so the next start
re-chowns the reintroduced root-owned files back to the relay uid.

> ⚠️ **Mandatory post-restore step — re-add the clearnet domain.** The public
> domain binding is host-level StartOS config (`start-tunnel`), not package
> volume data, so it cannot survive a restore or reinstall from the package
> side. After restoring, re-add the **Public / Domain (Let's Encrypt)** interface
> for your community host or external `wss://` access stays broken even though
> the relay is healthy on-box. The relay's internal community identity
> (`RELAY_URL`) does survive via `store.json`.

---

## Health Checks

| Check              | Method                              | Ready when                          |
| ------------------ | ----------------------------------- | ----------------------------------- |
| Database           | `pg_isready`                        | PostgreSQL accepts connections       |
| Cache              | `redis-cli ping`                    | Redis responds                       |
| Media Storage      | `GET /minio/health/live`            | MinIO is live                        |
| Community Endpoint | `GET :8080/_readiness`              | The relay is ready                   |

The relay daemon requires `postgres`, `redis`, `minio-init`, and `prepare-data`
before it starts. Its 60s grace period stays above the git conformance probe
(~7s) so readiness does not fail early.

---

## Dependencies

None — PostgreSQL, Redis, and MinIO are bundled inside the package.

---

## Limitations and Differences

1. **Clearnet TLS required** — Buzz Desktop will not accept a `.local` or
   `.onion` address; a publicly-trusted certificate on a real hostname is
   required.
2. **Clearnet domain not restored automatically** — re-add the Public/Domain
   interface after any restore or reinstall (see Backups and Restore).
3. **Changing the Media Bucket orphans existing media** — there is no automatic
   migration between buckets.
4. **MinIO console not exposed** — object storage is internal to the package.
5. **Single community per install** — the relay seeds one community from the
   Community Host.

---

## What Is Unchanged from Upstream

- The relay binary and behavior are Block's `ghcr.io/block/buzz`, used as
  published (no fork, no rebuild). The image is pinned by digest to upstream
  commit `e341b09` (relay crate version 0.2.0), so a rebuild of this repo always
  produces the same relay.
- The service stack (relay + PostgreSQL 17 + Redis 7 + MinIO) follows Block's
  `deploy/compose`.
- Community HTTP/WS endpoints, media (Blossom) storage, and database migrations
  behave as upstream documents.

Intentional StartOS adaptations to the env-var contract (it is not a verbatim
copy of `deploy/compose`):

- Service hostnames collapse to `127.0.0.1` (`DATABASE_URL`, `REDIS_URL`,
  `BUZZ_S3_ENDPOINT`) because all containers share one network namespace.
- `BUZZ_AUTO_MIGRATE` defaults **on** here (compose default is `false`) so a
  fresh install starts clean; it is exposed as a config toggle.
- `BUZZ_REQUIRE_AUTH_TOKEN=true` and a generated per-install
  `BUZZ_RELAY_PRIVATE_KEY` are always set, so REST auth is never bypassed.
- The relay is handed a bucket-scoped MinIO service account, not the root
  credentials.
- `RELAY_URL`/`BUZZ_MEDIA_BASE_URL` derive from the configured Community Host;
  `BUZZ_GIT_CONFORMANCE_PROBE=true` matches upstream's production default.

---

## Quick Reference for AI Consumers

```yaml
package_id: buzz-relay
title: Buzz Relay
upstream: https://github.com/block/buzz
image: ghcr.io/block/buzz@sha256:fd837f78ec4f8e0a72b1a165db40cd20946eb4773d337e8eff1573f5d3f41b7d
upstream_commit: e341b09    # relay crate 0.2.0; pinned by digest, not :main
runtime_stack:                   # full stack; see "Image and Container Runtime"
  - ghcr.io/block/buzz@sha256:fd837f78ec4f8e0a72b1a165db40cd20946eb4773d337e8eff1573f5d3f41b7d            # relay (Axum WS + REST)
  - postgres:17-alpine                            # event store + FTS
  - redis:7-alpine                                # pub/sub + presence
  - minio/minio:RELEASE.2025-09-07T16-13-09Z      # S3 media (Blossom)
  - minio/mc:RELEASE.2025-08-13T08-35-41Z         # one-shot bucket + svc-account init
architectures:
  - x86_64
  - aarch64
volumes:
  main: /data/git (relay git store; store.json at root, not mounted into relay)
  postgres: /var/lib/postgresql/data
  redis: /data
  minio: /data
ports:
  community: 3000   # public HTTP/WS
  health: 8080      # loopback
  metrics: 9102     # loopback
  minio: 9000       # loopback
  minio_console: 9001  # loopback, not exposed
dependencies: none (postgres/redis/minio bundled)
actions:
  - config   # Community Host, Owner Pubkey, Media Bucket, Auto-Migrate
backups: [main, postgres, redis, minio]
notes:
  - relay uses a bucket-scoped MinIO service account, not root creds
  - clearnet domain must be re-added manually after restore/reinstall
```
