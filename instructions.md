# Buzz Relay

You've installed Buzz Relay — Block's `buzz-relay`, the Axum WS + REST backend that powers a self-hosted **Buzz Community**. Once it's running, you add your community in Buzz Desktop by its public `wss://` address.

## Documentation

- [Buzz upstream repo](https://github.com/block/buzz) — the monorepo containing the `buzz-relay` crate and reference deployment.
- [StartOS Packaging Guide](https://docs.start9.com/packaging) — how StartOS service packages are built.

## What you get on StartOS

- **A Buzz Community backend** serving the community HTTP/WS endpoints Buzz Desktop probes on add (`/health`, `/.well-known/buzz`, `/api/community`, …).
- **A bundled runtime stack** — PostgreSQL (event store + full-text search), Redis (pub/sub + presence), and MinIO (S3 media / Blossom) — all managed inside the package.

## Getting set up

1. Buzz Desktop requires a publicly-trusted `wss://` certificate on a real hostname. Configure a clearnet domain for this service in StartOS (e.g. `buzz.example.com`).
2. Start Buzz Relay and wait for it to report healthy.
3. In Buzz Desktop, add the community using your `wss://` address.
4. Verify channels, DMs, media upload, and git all function.

## Limitations

- A LAN `.local` address or Tor `.onion` address will **not** be accepted by Buzz Desktop — a publicly-trusted clearnet certificate is required.
- The bundled MinIO console (port 9001) is not exposed publicly; media storage is internal to the package.
