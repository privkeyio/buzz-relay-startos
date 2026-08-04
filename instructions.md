# Buzz Relay

You've installed Buzz Relay — Block's `buzz-relay`, the Axum WS + REST backend that powers a self-hosted **Buzz Community**. Once it's running, you add your community in Buzz Desktop by its public `wss://` address.

## Documentation

- [Buzz upstream repo](https://github.com/block/buzz) — the monorepo containing the `buzz-relay` crate and reference deployment.
- [StartOS Packaging Guide](https://docs.start9.com/packaging) — how StartOS service packages are built.

## What you get on StartOS

- **A Buzz Community backend** serving the community HTTP/WS endpoints Buzz Desktop probes on add (`/health`, `/.well-known/buzz`, `/api/community`, …).
- **A bundled runtime stack** — PostgreSQL (event store + full-text search), Redis (pub/sub + presence), and MinIO (S3 media / Blossom) — all managed inside the package.

## Before you start — a public domain is required

Buzz Desktop only trusts standard public certificate authorities. It will **not**
accept a LAN `.local` address, a Tor `.onion` address, or a self-signed / private
certificate. You must give this service a **real public (clearnet) domain** with a
publicly-trusted `wss://` certificate.

To get a certificate Buzz Desktop trusts:

1. **Point a domain at your server.** Create a DNS record for a hostname you own
   (e.g. `buzz.example.com`) that resolves to your server's public IP.
2. **Open port 443.** Port 443 must be publicly reachable on that IP — it is
   needed both to issue the certificate and for Buzz Desktop to connect.
3. **Add the domain in StartOS with Let's Encrypt.** In Buzz Relay's interface
   settings, add your clearnet domain and choose **Let's Encrypt** as the ACME
   provider. With DNS pointing at the box and port 443 open, StartOS reliably
   obtains a certificate signed by a widely-trusted root.

## Getting set up

1. Add your clearnet domain to Buzz Relay with Let's Encrypt (see above).
2. Open the **Configuration** action and set **Community Host** to that exact
   domain and **Owner Public Key** to your Nostr key. Do this **before** the
   first start — Buzz Relay will refuse to start until Community Host is set.
3. Start Buzz Relay and wait for it to report healthy.
4. In Buzz Desktop, add the community using your `wss://` address
   (e.g. `wss://buzz.example.com`).
5. Verify channels, DMs, media upload, and git all function.

## Important: the domain is permanent

The relay binds its community to **Community Host** the first time it starts, and
there is **no way to rename or re-point it afterward**. Set it to the domain you
intend to keep. Changing the domain later strands your existing community,
channels, members, and every user's NIP-05 identity — the only way to move to a
new domain is to reset the community and start over, which erases all data.

## Limitations

- A LAN `.local` address or Tor `.onion` address will **not** be accepted by
  Buzz Desktop — a publicly-trusted clearnet certificate is required.
- The community domain cannot be changed after first start (see above).
- The bundled MinIO console (port 9001) is not exposed publicly; media storage is
  internal to the package.
