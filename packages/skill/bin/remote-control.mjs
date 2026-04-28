#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillSourceDir = path.join(packageDir, "skill", "remote-control");
const defaultRelayUrl = process.env.REMOTE_CONTROL_RELAY_URL || "https://remote-control.gabe-ragland.workers.dev";
const remoteStopHookTimeoutSeconds = 86520;
const remoteStopHookStatusMessage = "Waiting for remote messages";

function readArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : "";
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}`;
  writeFileSync(tempPath, value, "utf8");
  renameSync(tempPath, filePath);
}

function normalizeRelayUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

async function createInstallToken(apiBaseUrl) {
  const response = await fetch(`${apiBaseUrl}/installations`, { method: "POST" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.token !== "string" || !body.token.trim()) {
    throw new Error(`Remote Control relay did not return an install token from ${apiBaseUrl}/installations.`);
  }
  return body.token.trim();
}

function ensureCodexHooksEnabled(configPath) {
  const current = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  let next = current;
  if (/\[features\][\s\S]*?codex_hooks\s*=/.test(current)) {
    next = current.replace(/(\[features\][\s\S]*?codex_hooks\s*=\s*)(true|false)/, "$1true");
  } else if (current.includes("[features]")) {
    next = current.replace("[features]", "[features]\ncodex_hooks = true");
  } else {
    next = `${current.trimEnd()}${current.trim() ? "\n\n" : ""}[features]\ncodex_hooks = true\n`;
  }
  if (next !== current) {
    writeText(configPath, next);
  }
}

function installSkill(skillTargetDir, codexHome) {
  mkdirSync(path.dirname(skillTargetDir), { recursive: true });
  const statePath = path.join(skillTargetDir, ".state");
  const preservedStatePath = path.join(codexHome, `.remote-control-state-${process.pid}`);
  const hasState = existsSync(statePath);
  if (hasState) {
    rmSync(preservedStatePath, { recursive: true, force: true });
    renameSync(statePath, preservedStatePath);
  }
  rmSync(skillTargetDir, { recursive: true, force: true });
  cpSync(skillSourceDir, skillTargetDir, { recursive: true, force: true, verbatimSymlinks: true });
  if (hasState) {
    rmSync(path.join(skillTargetDir, ".state"), { recursive: true, force: true });
    renameSync(preservedStatePath, path.join(skillTargetDir, ".state"));
  }
}

function installStopHook(hooksPath, skillTargetDir) {
  const root = readJson(hooksPath, {});
  const hooks = root.hooks && typeof root.hooks === "object" && !Array.isArray(root.hooks) ? root.hooks : {};
  const groups = Array.isArray(hooks.Stop) ? hooks.Stop : [];
  const command = [
    shellQuote(process.execPath),
    shellQuote(path.join(skillTargetDir, "scripts", "publish-stop.js")),
  ].join(" ");

  let found = false;
  for (const group of groups) {
    if (!group || typeof group !== "object" || !Array.isArray(group.hooks)) {
      continue;
    }
    for (const hook of group.hooks) {
      if (!hook || typeof hook !== "object") {
        continue;
      }
      if (typeof hook.command === "string" && hook.command.includes("publish-stop.js")) {
        hook.type = "command";
        hook.command = command;
        hook.timeout = remoteStopHookTimeoutSeconds;
        hook.statusMessage = remoteStopHookStatusMessage;
        hook.silent = true;
        found = true;
      }
    }
  }

  if (!found) {
    groups.push({
      hooks: [{
        type: "command",
        command,
        timeout: remoteStopHookTimeoutSeconds,
        statusMessage: remoteStopHookStatusMessage,
        silent: true,
      }],
    });
  }

  hooks.Stop = groups;
  root.hooks = hooks;
  writeJson(hooksPath, root);
}

async function install() {
  const apiBaseUrl = normalizeRelayUrl(readArg("relay-url") || defaultRelayUrl);
  const codexHome = readArg("codex-home") || process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const skillTargetDir = path.join(codexHome, "skills", "remote-control");
  const configPath = path.join(skillTargetDir, ".state", "config.json");
  const hooksPath = path.join(codexHome, "hooks.json");
  const codexConfigPath = path.join(codexHome, "config.toml");
  const existingConfig = readJson(configPath, null);
  const canReuseToken = existingConfig
    && existingConfig.apiBaseUrl === apiBaseUrl
    && typeof existingConfig.token === "string"
    && !hasFlag("reset-token");
  const token = canReuseToken ? existingConfig.token : await createInstallToken(apiBaseUrl);

  ensureCodexHooksEnabled(codexConfigPath);
  installSkill(skillTargetDir, codexHome);
  writeJson(configPath, {
    apiBaseUrl,
    token,
    stopPollSeconds: Number(existingConfig?.stopPollSeconds) || 86400,
    stopPollIntervalSeconds: Number(existingConfig?.stopPollIntervalSeconds) || 5,
  });
  installStopHook(hooksPath, skillTargetDir);

  console.log(JSON.stringify({
    ok: true,
    apiBaseUrl,
    tokenCreated: !canReuseToken,
    skillPath: skillTargetDir,
    hooksPath,
  }, null, 2));
}

const command = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "install";
if (command !== "install") {
  console.error("Usage: remote-control install [--relay-url=https://...] [--codex-home=/path] [--reset-token]");
  process.exit(2);
}

install().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
