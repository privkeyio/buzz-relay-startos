<p align="center">
  <img src="icon.svg" alt="Buzz Relay Logo" width="21%">
</p>

# Buzz Relay on StartOS

> **Upstream repo:** <https://github.com/block/buzz>

Block's **buzz-relay** packaged for StartOS: the Axum WS + REST backend that powers a self-hosted **Buzz Community**. A Buzz Community is not a bare Nostr relay — Buzz Desktop probes community HTTP endpoints before connecting, and only `buzz-relay` serves them. This package wraps the prebuilt `ghcr.io/block/buzz:main` image together with its PostgreSQL, Redis, and MinIO runtime dependencies.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Backups and Restore](#backups-and-restore)
- [Health Checks](#health-checks)
- [Dependencies](#dependencies)
- [Limitations and Differences](#limitations-and-differences)

---

## Image and Container Runtime

| Image                                   | Role                          | Architectures    |
| --------------------------------------- | ----------------------------- | ---------------- |
| `ghcr.io/block/buzz:main`               | Axum WS + REST (community)     | x86_64, aarch64  |
| `postgres:17-alpine`                    | Event store + full-text search | x86_64, aarch64  |
| `redis:7-alpine`                        | Pub/sub + presence             | x86_64, aarch64  |
| `minio/minio:RELEASE.2025-09-07T16-13-09Z` | S3 media (Blossom)          | x86_64, aarch64  |
| `minio/mc:RELEASE.2025-08-13T08-35-41Z` | One-shot bucket creation       | x86_64, aarch64  |

---

## Volume and Data Layout

| Volume     | Purpose                              |
| ---------- | ------------------------------------ |
| `main`     | Relay data, including git (`/data/git`) |
| `postgres` | PostgreSQL data                      |
| `redis`    | Redis AOF                            |
| `minio`    | MinIO object storage                 |

---

## Installation and First-Run Flow

Buzz Desktop requires a publicly-trusted `wss://` certificate on a real hostname. Configure a clearnet domain for the service, start it, and add the community in Buzz Desktop by its `wss://` address.

---

## Network Access and Interfaces

| Interface | Port | Protocol | Purpose            |
| --------- | ---- | -------- | ------------------ |
| Community | 3000 | HTTP/WS  | Buzz Community endpoint |

The MinIO console (9001) is intentionally not exposed publicly.

---

## Backups and Restore

**Included in backup:**

- `main`, `postgres`, `redis`, and `minio` volumes

**Restore behavior:** Volumes are fully restored before the service starts.

---

## Health Checks

The relay exposes a readiness endpoint on its internal health port (`:8080/_readiness`), which the package uses to gate the service as ready.

---

## Dependencies

None — PostgreSQL, Redis, and MinIO are bundled inside the package.

---

## Limitations and Differences

1. **Clearnet TLS required** — Buzz Desktop will not accept a `.local` or `.onion` address; a publicly-trusted certificate on a real hostname is required.
2. **MinIO console not exposed** — object storage is internal to the package.
