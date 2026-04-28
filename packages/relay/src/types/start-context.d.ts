import "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface Register {
    server: {
      requestContext: {
        cloudflare: {
          env: Env;
          ctx: ExecutionContext;
        };
      };
    };
  }
}
