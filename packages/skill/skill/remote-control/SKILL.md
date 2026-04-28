---
name: remote-control
description: Start or stop remote continuation for the current Codex thread. Use when the user invokes Remote Control, mentions $remote-control, says "start remote", "go remote", "stop remote", or asks to continue the current thread from iMessage.
---

# Remote Control

Use this skill when the user invokes Remote Control, mentions `$remote-control`, says "start remote", "go remote", "stop remote", or asks to continue the current Codex thread from iMessage.

If this skill is invoked without additional instructions, start remote for the current thread.

## Start Remote

When starting remote, run the starter script yourself. Do not tell the user to run it.

1. Write a one-sentence handoff summary for iMessage before running the script.
   - Summarize only what this thread was about immediately before starting remote control.
   - Prefer natural recap wording like `We last discussed ...` when it fits.
   - Do not mention remote control, iMessage, Sendblue, hooks, pairing, implementation details, or the act of enabling remote.
   - Keep it plain text and very short, ideally under 140 characters.
   - If there is not enough useful context, use no summary.
2. Run `node ~/.codex/skills/remote-control/scripts/start-remote.js --handoff-summary="SUMMARY"` when you have a useful summary, or `node ~/.codex/skills/remote-control/scripts/start-remote.js` when you do not.
3. If that fails with a sandbox or network error such as `fetch failed`, retry with approval using the absolute path `node /Users/gaberagland/.codex/skills/remote-control/scripts/start-remote.js` and the same `--handoff-summary` argument if one was used. Do not request escalation before trying the normal command first.
4. Read the JSON output.
5. Respond with `localMessage` exactly and nothing else. Do not include debug details unless the user explicitly asks for them.

   Do not present the Codex thread id, CLI commands, hook details, or implementation internals as part of the public/product-facing message.

   A paired phone can have multiple active remote threads. Starting remote for this thread switches iMessage to this thread. The user can text `threads` to the Sendblue number to see numbered active threads, then text a bare number such as `2` to switch.

## Stop Remote

When the user says "stop remote":

1. Run `node ~/.codex/skills/remote-control/scripts/stop-remote.js`.
2. Tell the user:

   ```text
   Remote control is stopped.
   ```

Do not include debug details unless the user asks for them. The running Stop hook re-checks local active-thread state between polls and exits shortly after this command disables the thread.

## Stop Hook Behavior

The global Stop hook publishes status, then long-polls the remote inbox for the active remote thread.

- If no reply arrives before the Stop hook timeout, Codex stays idle quietly.
- If a reply arrives, the Stop hook claims exactly one reply and continues the thread with that reply.
- Treat continued remote messages exactly as if the user typed them directly into this chat.
- Do not mention remote control, queued replies, claimed replies, Stop hooks, polling, or message receipt in the assistant response.
- When done, stop normally. The global Stop hook publishes the result and waits for the next reply.
- If the user continues locally in the same Codex thread, the Stop hook disables remote control silently so the local message can run normally.

## Local Config

Config lives at `~/.codex/skills/remote-control/.state/config.json`.

Required shape:

```json
{
  "apiBaseUrl": "https://remote-control.example.workers.dev",
  "token": "dev-token",
  "stopPollSeconds": 86400,
  "stopPollIntervalSeconds": 5
}
```

If config is missing, ask the user to run:

```bash
npx @gaberagland/remote-control install
```

Then retry activation after the installer creates the token-only config.

## iMessage Testing

If `start remote` prints a pairing code, text it to the printed Sendblue number once. After the phone is paired, future `start remote` runs should let you text normal instructions directly without another pairing code.

Text `threads` to the Sendblue number to see all active remote threads for the paired phone. Text a number from that list to switch which thread receives normal remote messages.

Read the latest published Codex result/status:

```bash
curl -sS \
  -H "Authorization: Bearer $(node -p 'JSON.parse(require("fs").readFileSync(process.env.HOME + "/.codex/skills/remote-control/.state/config.json", "utf8")).token')" \
  "$(node -p 'JSON.parse(require("fs").readFileSync(process.env.HOME + "/.codex/skills/remote-control/.state/config.json", "utf8")).apiBaseUrl')/threads/019dc..."
```
