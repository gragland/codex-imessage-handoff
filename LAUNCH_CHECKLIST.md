# Launch Checklist

## Public Repo

- Create the public GitHub repo.
- Publish `@gaberagland/remote-control` or update install docs to the final package name.
- Confirm the GitHub links on the homepage point to the public repo.

## Hosted Relay

- Choose the final domain.
- Add the Cloudflare custom domain route to `packages/relay/wrangler.jsonc`.
- Deploy the relay with Wrangler.
- Update the Sendblue webhook URL to the deployed `/webhooks/sendblue` endpoint.
- Set `REMOTE_CONTROL_RELAY_URL` or the installer default to the final hosted URL.

## Docs

- Verify the hosted-relay install path.
- Verify self-hosting from a fresh D1 database.
- Document how users can reset a local install token with `--reset-token`.

## End-To-End Smoke Test

- Install the skill from the package.
- Start Remote Control in a fresh Codex thread.
- Pair iMessage with the code.
- Send text from iMessage and confirm Codex responds.
- Send an inbound image and confirm Codex receives a local file path.
- Generate an image in Codex and confirm it arrives in iMessage.
- Use `list`, switch by number, and `stop remote`.
