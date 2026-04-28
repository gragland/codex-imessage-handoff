# AGENTS: Remote Control

This is the standalone public Remote Control repo.

## Repo Shape

- `packages/skill`: installable Codex skill package.
- `packages/relay`: Cloudflare Worker/TanStack relay deployed with Wrangler.

## Deployment

- Do not use Alchemy or the old monorepo CI helpers here.
- Deploy the relay manually with Wrangler from `packages/relay`.
- Secrets come from your shell/root env when running `wrangler secret put`; never commit populated `.env`, `.dev.vars`, or secret values.
- If Cloudflare bindings change, run `pnpm --filter @gaberagland/remote-control-relay types` after the Wrangler config is valid.

## Gotchas

- Keep this repo free of private monorepo dependencies such as `@vibe/ui`.
- Token identity is client-token-only. Do not add a Codex account id or local `userId` back unless the product design changes.
- Record future import/deploy gotchas here as they are discovered.
