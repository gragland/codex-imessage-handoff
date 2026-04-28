import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { handleRequest } from "@/worker";

export const Route = createFileRoute("/webhooks/sendblue")({
  server: {
    handlers: {
      POST: async ({ request }) => await handleRequest(request, env as Env),
      OPTIONS: async ({ request }) => await handleRequest(request, env as Env),
    },
  },
});
