#!/usr/bin/env node
const { apiFetch, readActiveThreads, readConfig, writeActiveThreads } = require("./common.js");

async function main() {
  const codexThreadId = process.env.CODEX_THREAD_ID ? process.env.CODEX_THREAD_ID.trim() : "";
  if (!codexThreadId) {
    console.error("CODEX_THREAD_ID is required. Run stop remote from inside a Codex thread.");
    process.exit(2);
  }

  const active = readActiveThreads();
  const removedThreadIds = [];
  let serverStopped = false;
  let serverError = null;

  try {
    const config = readConfig();
    await apiFetch(config, `/threads/${encodeURIComponent(codexThreadId)}/stop`, { method: "POST" });
    serverStopped = true;
  } catch (error) {
    serverError = error instanceof Error ? error.message : String(error);
  }

  if (active.threads[codexThreadId]) {
    delete active.threads[codexThreadId];
    removedThreadIds.push(codexThreadId);
  }

  writeActiveThreads(active);
  console.log(JSON.stringify({
    ok: true,
    removedCount: removedThreadIds.length,
    codexThreadIds: removedThreadIds,
    serverStopped,
    serverError,
  }, null, 2));
}

main().catch(function onError(error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
