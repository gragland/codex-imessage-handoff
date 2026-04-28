import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { handleRequest } from "@/worker";

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async ({ request }) => await handleRequest(request, env as Env),
    },
  },
});
