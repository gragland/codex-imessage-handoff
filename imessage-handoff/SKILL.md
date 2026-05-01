---
name: imessage-handoff
description: Start or stop iMessage handoff for the current Codex thread. Use when the user invokes iMessage Handoff, mentions $imessage-handoff, says "start handoff", "go handoff", "stop handoff", or asks to continue the current thread from iMessage.
---

# iMessage Handoff

Use this skill when the user invokes iMessage Handoff, mentions `$imessage-handoff`, says "start handoff", "go handoff", "stop handoff", or asks to continue the current Codex thread from iMessage.

If this skill is invoked without additional instructions, start handoff for the current thread.

## Start iMessage Handoff

When starting iMessage Handoff, run the starter script yourself. Do not tell the user to run it.

Before running `scripts/start-handoff.js`, check whether iMessage Handoff has local relay config and a ready Codex Stop hook:

1. Run `node scripts/configure.js show`, resolving `scripts/configure.js` relative to this `SKILL.md`.
2. If `configured` is false, do not run `scripts/start-handoff.js`. Ask exactly:

   ```text
   iMessage Handoff needs a couple one-time setup steps before it can start.

   First, choose an iMessage relay:

   1. Use the hosted relay
      Your messages pass through our server so we can forward them to iMessage. We avoid storing message content in our database.

   2. Deploy your own relay
      Follow the instructions here: https://github.com/gragland/codex-imessage-handoff

   Reply with 1 or 2. You can switch relays any time by asking iMessage Handoff to switch.
   ```

3. If the user replies with `1`, "hosted", "use yours", "use hosted", or similar, run `node scripts/configure.js use-default-relay`, then ask the hook consent question below.
4. If the user replies with `2`, "deploy my own", "self-hosted", or similar without a relay URL, reply exactly:

   ```text
   Okay. Follow the instructions here: https://github.com/gragland/codex-imessage-handoff

   When you’re done, paste in your relay URL. Or just let me know if you’d like to use the hosted relay for now.
   ```

5. If the user provides a relay URL, run `node scripts/configure.js set-relay --url="URL"`, then ask the hook consent question below.

After relay config exists, run `node scripts/configure.js hook-status`. If `ready` is false, ask exactly:

```text
Next, iMessage Handoff needs to install a one-time Codex Stop hook. After Codex responds, this hook forwards the response to the relay and waits for iMessage replies.

With your permission, I’ll install it now. After installation, restart Codex once. If you ever want to stop iMessage Handoff from communicating with the relay, tell it to remove its hook.

Reply yes to install the hook.
```

Only install the hook after the user says yes or gives an equivalent confirmation. If they do not confirm, do not run `scripts/start-handoff.js`.

After the user confirms, run `node scripts/configure.js install-hook`, then reply exactly and stop:

```text
iMessage Handoff hook is installed. Restart Codex once, then invoke `$imessage-handoff` again to start iMessage handoff.
```

Do not run `scripts/start-handoff.js` in the same turn that installs the hook. The restart lets Codex load the new hook before the pairing message is shown, so the Stop hook can wait for the iMessage reply.

Once relay config exists and `node scripts/configure.js hook-status` reports `ready: true`:

1. Write a one-sentence handoff summary for iMessage before running the script.
   - Summarize only what this thread was about immediately before starting iMessage handoff.
   - Prefer natural recap wording like `We last discussed ...` when it fits.
   - Summarize the work itself, not the setup or delivery mechanism.
   - Keep it plain text and very short, ideally under 140 characters.
   - If there is not enough useful context, use no summary.
2. Run the bundled `scripts/start-handoff.js` from this skill's installed directory with `--handoff-summary="SUMMARY"` when you have a useful summary, or with no arguments when you do not. This registers the thread.
3. Use Node to run the script, for example `node scripts/start-handoff.js` after resolving `scripts/start-handoff.js` relative to this `SKILL.md`.
4. If that fails with a sandbox or network error such as `fetch failed`, retry with approval using the same command. Do not request escalation before trying the normal command first.
5. Read the JSON output.
6. Respond with `localMessage` exactly and nothing else. Do not include debug details unless the user explicitly asks for them.

   Do not present the Codex thread id, CLI commands, hook details, or implementation internals as part of the public/product-facing message.

   A paired phone can have multiple active iMessage handoff threads. Starting iMessage Handoff for this thread switches iMessage to this thread. The user can text `threads` to the printed phone number to see numbered active threads, then text a bare number such as `2` to switch.

## Stop iMessage Handoff

When the user says "stop handoff":

1. Run the bundled `scripts/stop-handoff.js` from this skill's installed directory with Node, resolving the script path relative to this `SKILL.md`.
2. Tell the user:

   ```text
   iMessage Handoff is stopped.
   ```

Do not include debug details unless the user asks for them. The running Stop hook re-checks local active-thread state while waiting and exits shortly after this command disables the thread.

## Configure iMessage Handoff

Use `scripts/configure.js` for configuration requests. Resolve the script path relative to this `SKILL.md` and run it with Node.

- If the user asks to show current config, run `node scripts/configure.js show`, then summarize the relay URL and whether config exists. Never print the token value.
- If the user asks to use a self-hosted relay or set/change the relay URL, run `node scripts/configure.js set-relay --url="https://..."`. Tell the user the relay was updated and that they can now start handoff.
- If the user asks to switch back to the hosted relay, run `node scripts/configure.js use-default-relay`.
- If the user asks to reset the install token, run `node scripts/configure.js reset-token`. Tell the user the token was reset and that they may need to pair iMessage again.
- If the user asks to remove the hook, remove the Codex hook, or uninstall iMessage Handoff, run `node scripts/configure.js uninstall`. Tell the user the Codex Stop hook was removed and they can disable or remove the skill in Codex settings.

## Stop Hook Behavior

The global Stop hook publishes status, then waits for the active iMessage handoff thread over WebSocket.

- If no reply arrives before the Stop hook timeout, Codex stays idle quietly.
- If a reply arrives, the Stop hook claims exactly one reply and continues the thread with that reply.
- Treat continued iMessage replies exactly as if the user typed them directly into this chat.
- Answer the user's iMessage reply normally; delivery details are not part of the response unless the user asks about them.
- When done, stop normally. The global Stop hook publishes the result and waits for the next reply.
- If the user continues locally in the same Codex thread, the Stop hook disables iMessage handoff silently so the local message can run normally.

## Local Config

Config lives in the installed skill directory at `.state/config.json`.

Required shape:

```json
{
  "apiBaseUrl": "https://imessage-handoff.example.workers.dev",
  "token": "dev-token",
  "stopWaitSeconds": 86400
}
```

If config is missing, ask the relay-choice question from Start iMessage Handoff. Do not run `start-handoff.js` until the user chooses hosted or provides a self-hosted relay URL.

For self-hosting, set the relay before starting iMessage Handoff by asking iMessage Handoff to use the self-hosted relay URL.

## iMessage Testing

If `start handoff` prints a pairing code, text it to the printed phone number once. After the phone is paired, future `start handoff` runs should let you text normal instructions directly without another pairing code.

Text `threads` to the printed phone number to see all active iMessage handoff threads for the paired phone. Text a number from that list to switch which thread receives normal iMessage replies.

Read the latest published Codex result/status:

```bash
curl -sS \
  -H "Authorization: Bearer $(node -p 'JSON.parse(require("fs").readFileSync(process.env.HOME + "/.codex/skills/imessage-handoff/.state/config.json", "utf8")).token')" \
  "$(node -p 'JSON.parse(require("fs").readFileSync(process.env.HOME + "/.codex/skills/imessage-handoff/.state/config.json", "utf8")).apiBaseUrl')/threads/019dc..."
```
