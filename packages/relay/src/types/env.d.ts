import type { Env as WorkerEnv } from "../types.ts";

declare global {
  type Env = WorkerEnv;

  const process: {
    env: Record<string, string | undefined>;
  };
}
