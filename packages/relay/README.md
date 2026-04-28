# Remote Control Relay

This package contains the Cloudflare Worker/TanStack relay for Remote Control.

## Self-Hosting

1. Install dependencies from the repo root.

   ```bash
   pnpm install
   ```

2. Create a D1 database.

   ```bash
   cd packages/relay
   wrangler d1 create remote-control
   ```

3. Copy the returned `database_id` into `wrangler.jsonc`.

4. Apply migrations.

   ```bash
   wrangler d1 migrations apply remote-control --remote
   ```

5. Set Sendblue secrets.

   ```bash
   wrangler secret put SENDBLUE_API_KEY
   wrangler secret put SENDBLUE_SECRET_KEY
   wrangler secret put SENDBLUE_WEBHOOK_SECRET
   ```

6. Deploy.

   ```bash
   wrangler deploy
   ```

7. In Sendblue, set the inbound webhook URL to:

   ```text
   https://<your-worker-url>/webhooks/sendblue
   ```

8. Install the skill against your relay.

   ```bash
   npx @gaberagland/remote-control install --relay-url=https://<your-worker-url>
   ```

## Configuration

`wrangler.jsonc` contains non-secret defaults:

- `SENDBLUE_FROM_NUMBER`
- `SENDBLUE_API_BASE_URL`
- `SENDBLUE_TYPING_DELAY_MS`

Secrets must be configured with `wrangler secret put`.

## Custom Domain

After choosing a domain, add a Cloudflare custom domain route to `wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "remote-control.example.com", "custom_domain": true }
]
```

Then redeploy and update the Sendblue webhook URL to the custom domain.

## API Summary

- `POST /installations`: returns a local install token.
- `POST /threads/:threadId`: registers or re-enables a Codex thread.
- `POST /threads/:threadId/status`: publishes Codex output and generated images.
- `GET /threads/:threadId/pending`: lists claimable remote replies.
- `POST /threads/:threadId/replies/:replyId/claim`: claims one reply or media group.
- `GET /threads/:threadId`: debug thread state.
- `POST /threads/:threadId/stop`: disables remote control for a thread.
- `POST /webhooks/sendblue`: receives Sendblue inbound events.

All non-webhook thread APIs use `Authorization: Bearer <token>`. The relay derives the internal owner id from that token.
