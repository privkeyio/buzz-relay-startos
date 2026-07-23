# buzz-relay-startos

StartOS (`.s9pk`) package wrapping Block's **buzz-relay** so a self-hosted Buzz
Community runs on a Start9 box and can be added in Buzz Desktop.

**Start here:** read `PLAN.md` — it has the full plan, verified source facts,
the runtime stack, env vars, StartOS mapping, open decisions, and task list.

## Fast context

- Buzz Community ≠ bare Nostr relay. Needs Block's `buzz-relay` (Axum WS+REST),
  which serves community HTTP endpoints Buzz Desktop probes on add.
- Image: `ghcr.io/block/buzz:main` (multi-arch amd64+arm64). Target box = amd64,
  so NO Rust build — wrap the prebuilt image.
- Stack = relay + postgres:17 + redis:7 + minio + minio-init (bucket). See
  upstream `deploy/compose/compose.yml` in `github.com/block/buzz`.

## Reference packages (siblings under ~/Projects/)

- `../hello-world-startos`    — 0.3.x TS SDK scaffold
- `../synapse-startos`        — bundles Postgres (daemon ordering, config secrets)
- `../nostr-rs-relay-startos` — Nostr wss interface + relay config

## Conventions

- Surgical changes; follow the reference packages' structure.
- Confirm StartOS version on the box before committing to SDK APIs (0.3.5 vs 0.3.6).
- Don't expose MinIO console publicly; relay `:3000` is the only public interface.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
