# buzz-relay-startos — Implementation Plan

Package Block's **buzz-relay** (the Buzz Community backend) as a StartOS `.s9pk`
so a self-hosted Buzz community can run on a Start9 box and be added in Buzz Desktop.

## Why this exists

A Buzz **Community** is NOT a bare Nostr relay. Buzz Desktop probes the host's
community HTTP endpoints (`/health`, `/.well-known/buzz`, `/api/community`, …)
before connecting. A plain relay (e.g. Wisp at `relay1.privkey.io`) 404s on all
of them → Buzz shows **"Community rejected: Load failed."** Only Block's
`buzz-relay` (Axum WS + REST) serves those endpoints.

## Source facts (verified 2026-07-22)

- Upstream repo: `github.com/block/buzz` (Apache-2.0 monorepo).
  - Relay crate: `crates/buzz-relay` (Axum WS + REST). No standalone repo.
  - Reference deploy: `deploy/compose/compose.yml` (+ `.env.example`, `Caddyfile`, `compose.caddy.yml`).
- Prebuilt image: **`ghcr.io/block/buzz`** — multi-arch **amd64 + arm64**.
  Target box is **amd64** → NO source build needed; wrap the image.
  Pinned **by digest** (`sha256:fd837f78…` = upstream `e341b09`, relay 0.2.0),
  not by `:main`. `:main` is mutable, so builds off it are not reproducible; a
  single OCI index digest covers both arches. Upstream states the relay
  "ships as a pinnable artifact" and versions independently of the monorepo.

## Runtime stack (from deploy/compose/compose.yml)

| Service    | Image                    | Role                         | Ports                         |
|------------|--------------------------|------------------------------|-------------------------------|
| relay      | ghcr.io/block/buzz@sha256:fd837f78 | Axum WS + REST (community) | 3000 app · 8080 health · 9102 metrics |
| postgres   | postgres:17-alpine       | event store + FTS            | 5432                          |
| redis      | redis:7-alpine (requirepass) | pub/sub + presence       | 6379                          |
| minio      | minio/minio              | S3 media (Blossom)           | 9000 · 9001 console           |
| minio-init | minio/mc                 | one-shot: create bucket      | —                             |

### relay env vars (from compose)
- `BUZZ_BIND_ADDR=0.0.0.0:3000`
- `BUZZ_HEALTH_PORT=8080`  (readiness at `GET /_readiness` → expect `200 OK`)
- `BUZZ_METRICS_PORT=9102`
- `DATABASE_URL=postgres://<user>:<pass>@<host>:5432/<db>`
- `REDIS_URL=redis://:<pass>@<host>:6379`
- `BUZZ_S3_ENDPOINT`, `BUZZ_S3_ACCESS_KEY`, `BUZZ_S3_SECRET_KEY`, `BUZZ_S3_BUCKET` (default `buzz-media`)
- `BUZZ_GIT_REPO_PATH=/data/git`
- `BUZZ_AUTO_MIGRATE` — compose default **false**; MUST set **true** (or run migrations) or relay won't start clean.
- `BUZZ_GIT_CONFORMANCE_PROBE=true`

## StartOS mapping (0.4.x — `@start9labs/start-sdk` 2.0.6)

Box runs **StartOS 0.4.0-beta.9**. All three reference repos already target 0.4.x
with `@start9labs/start-sdk` **2.0.6** (osVersions 0.4.0–0.4.3) — use them as-is;
no 0.3.x concerns.


- **Multi-daemon package**: run all four services as `daemons` in one s9pk with
  health-gated ordering: postgres healthy → redis healthy → minio healthy →
  minio-init completes → relay. Precedent: `synapse-startos` bundles Postgres.
- **Rewire hostnames**: compose uses DNS names `postgres`/`redis`/`minio`.
  In-package daemons share localhost → point URLs at `127.0.0.1:5432/6379/9000`.
- **Config spec**: auto-generate `POSTGRES_PASSWORD`, `REDIS_PASSWORD`,
  `BUZZ_S3_ACCESS_KEY`, `BUZZ_S3_SECRET_KEY`. Expose bucket name, migrate toggle.
- **Health check**: hit `:8080/_readiness` directly (StartOS has curl; skip the
  compose `/dev/tcp` bash hack the image needs).
- **Interfaces**: expose relay `:3000` as the community endpoint.
- **Backups/volumes**: postgres data, redis AOF, minio data, `/data/git`.

## The hard part: TLS + domain

Buzz Desktop needs a **publicly-trusted `wss://` cert** on a real hostname (this
is exactly the HTTPS/CORS probe that failed on Wisp). StartOS's automatic LAN
cert (`.local`) and `.onion` won't be accepted by Buzz Desktop over the internet.
- Preferred: **StartOS clearnet** with `buzz.privkey.io` → box's public address.
- Alt: front with the existing VPS Caddy (`deploy/compose/compose.caddy.yml` +
  `Caddyfile` exist upstream) — but that lives outside Start9.

## Restore runbook (post backup/restore) — MANDATORY step

After an uninstall→restore (or any reinstall), **re-add the clearnet domain** on
the Buzz Relay service before external clients can reach it:

1. StartOS → Buzz Relay → interface → add **Public / Domain / Let's Encrypt** →
   your host (e.g. `buzz1.privkey.io`).
2. This re-registers the automatic published port with `start-tunnel` and
   restores the box-side SNI route. Verify:
   `curl -sS https://<host>/_readiness` → `{"status":"ready"}` 200.

Why this is manual (investigated 2026-07-25, issue `e3u`): the clearnet domain is
**host-level StartOS config**, not package data. It is user-specific (the
operator's own domain), the SDK exposes **no** interface API to declare a
clearnet/ACME domain (`setupInterfaces`/`createInterface`/`bindPort` only bind
ports), and the package backup is `ofVolumes` only — correctly *not* backing up
someone's domain choice. So a restore reinstalls the package + volumes but cannot
recreate the host domain binding; it inherently needs re-adding. Note the relay's
*internal* community host **does** survive (stored in `store.json` →
`RELAY_URL`/`BUZZ_MEDIA_BASE_URL`), so only the StartOS clearnet route is missing,
not the relay's own config. StartOS also reassigns the interface port on reinstall
(observed `51977`→`60723`), but the tunnel routes by SNI to the box ingress, so the
port change alone is harmless once the domain is re-added.

Verified on-box 2026-07-25 (issue `e38`): full backup→uninstall→restore cycle;
the `feature/chown-sentinel` fix brought the relay up as uid 1000 on restored
root-owned `/data`; postgres/redis/minio/git data all intact; DMs are not
relay-stored (route to inbox relays), so an empty DM history is expected.

## Reference repos (all under ~/Projects/Repo/, siblings of this repo)

- `hello-world-startos`     — canonical 0.4.x TS SDK scaffold (copy structure)
- `synapse-startos`         — bundles Postgres; daemon ordering + config secrets
- `nostr-rs-relay-startos`  — Nostr wss interface + relay config patterns
- Also present locally (same conventions, strong references):
  `wisp-startos`, `keep-startos`, `readstr-startos`, `standardnotes-startos`.

## Open decisions (confirm before/while building)

1. ~~StartOS version~~ **RESOLVED**: box = 0.4.0-beta.9; SDK = `@start9labs/start-sdk` 2.0.6 (references already on 0.4.x).
2. **TLS path**: StartOS clearnet `buzz.privkey.io` vs VPS Caddy front.
3. Whether to also expose MinIO console (9001) — probably NO (internal only).

## Task breakdown

1. Scaffold package from `hello-world-startos` (package id `buzz-relay`, TS SDK).
2. Write `manifest` (metadata, versions, deps, volumes, interfaces, backups).
3. Define **config spec** + secret generation (pg/redis/s3 creds, bucket, migrate).
4. Implement **4 daemons + init** with health-gated ordering (model on synapse).
5. Map env vars; rewire service hostnames to localhost.
6. Health check → `:8080/_readiness`. Metrics `:9102` optional.
7. Interface: relay `:3000`; wire clearnet TLS for `buzz.privkey.io`.
8. Backups: pg + redis + minio + git volumes.
9. `start-sdk` build → install `.s9pk` on box → test: add `wss://buzz.privkey.io`
   as a community in Buzz Desktop; verify channels/DMs/media/git.
10. Iterate on migrations (`BUZZ_AUTO_MIGRATE=true`) and readiness timing.

## Definition of done

Buzz Desktop successfully **adds and uses** the self-hosted community
(`buzz.privkey.io`) served by the StartOS package — channels, DMs, media upload
(MinIO/Blossom), and git all functional; data survives a StartOS backup/restore.
