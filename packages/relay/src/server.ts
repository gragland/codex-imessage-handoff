import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

const serverEntry = createServerEntry({
  fetch: (request, opts) => handler.fetch(request, opts),
});

const fetch = ((request: unknown, env: unknown, ctx: unknown) => {
  const req = request as Request;
  const runtimeEnv = env as Env;
  const runtimeCtx = ctx as ExecutionContext;
  return serverEntry.fetch(req, {
    context: {
      cloudflare: { env: runtimeEnv, ctx: runtimeCtx },
    },
  });
}) as unknown as ExportedHandler<Env>["fetch"];

const worker = {
  fetch,
} satisfies ExportedHandler<Env>;

export default worker;
