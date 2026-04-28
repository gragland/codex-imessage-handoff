# Remote Control

Remote Control lets you continue a local Codex thread from iMessage. It has two parts:

- `packages/skill`: the installable Codex skill and Stop hook scripts.
- `packages/relay`: a Cloudflare Worker/TanStack relay with D1 persistence and Sendblue iMessage transport.

The hosted relay is the default path. You can also deploy your own relay with Wrangler and point the skill at it.

## Install

```bash
npx @gaberagland/remote-control install
```

Then open a Codex thread and invoke Remote Control, or say:

```text
start remote
```

If this is your first time, Codex prints a pairing code. Text that code to the Sendblue number shown by Codex. After that, text normal instructions from iMessage.

## How It Works

1. The installer asks the relay for a token and stores it locally in `~/.codex/skills/remote-control/.state/config.json`.
2. `start remote` registers the current `CODEX_THREAD_ID` with the relay.
3. The relay derives an internal owner id from the token; no Codex account id is read.
4. Sendblue webhooks turn iMessages into pending replies for the active Codex thread.
5. The local Stop hook long-polls the relay, claims a reply, and continues the original Codex thread.
6. Codex results, including generated images, are sent back through Sendblue.

## Commands

Local Codex:

```text
start remote
stop remote
```

iMessage:

```text
list
threads
2
```

`list` and `threads` show active remote threads. A bare number switches the active iMessage thread.

## Self-Hosting

See [packages/relay/README.md](packages/relay/README.md) for Wrangler deployment instructions.

## Security Model

Remote Control is a relay for prompts into a local Codex thread. The relay token is the credential for one local install. Keep the local config private; if the token leaks, that install should be considered compromised.

The public relay does not need a Codex account id. The Worker derives an internal owner id from the bearer token and uses that for phone pairing and thread routing.
