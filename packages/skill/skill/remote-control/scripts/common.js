const { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } = require("fs");
const { spawnSync } = require("child_process");
const os = require("os");
const http = require("http");
const https = require("https");
const path = require("path");

const skillDir = path.resolve(__dirname, "..");
const stateDir = process.env.REMOTE_CONTROL_STATE_DIR || path.join(skillDir, ".state");
const configPath = path.join(stateDir, "config.json");
const activeThreadsPath = path.join(stateDir, "active-threads.json");

function ensureStateDirs() {
  mkdirSync(stateDir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = filePath + ".tmp-" + process.pid;
  writeFileSync(tempPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  renameSync(tempPath, filePath);
}

function readConfig() {
  ensureStateDirs();
  if (existsSync(configPath)) {
    const config = readJson(configPath);
    if (!config.apiBaseUrl || !config.token) {
      throw new Error("Remote Control config is missing apiBaseUrl or token: " + configPath);
    }
    return {
      apiBaseUrl: String(config.apiBaseUrl).replace(/\/+$/, ""),
      token: String(config.token),
      stopPollSeconds: readNumber(config.stopPollSeconds, process.env.REMOTE_CONTROL_STOP_POLL_SECONDS, 86400),
      stopPollIntervalSeconds: readNumber(config.stopPollIntervalSeconds, process.env.REMOTE_CONTROL_STOP_POLL_INTERVAL_SECONDS, 5),
      transport: readTransport(config.transport, process.env.REMOTE_CONTROL_TRANSPORT),
    };
  }

  const apiBaseUrl = process.env.REMOTE_CONTROL_API_BASE_URL
    ? process.env.REMOTE_CONTROL_API_BASE_URL.replace(/\/+$/, "")
    : "";
  const token = process.env.REMOTE_CONTROL_TOKEN;
  if (apiBaseUrl && token) {
    const config = { apiBaseUrl, token };
    writeJson(configPath, config);
    return {
      apiBaseUrl: config.apiBaseUrl,
      token: config.token,
      stopPollSeconds: readNumber(undefined, process.env.REMOTE_CONTROL_STOP_POLL_SECONDS, 86400),
      stopPollIntervalSeconds: readNumber(undefined, process.env.REMOTE_CONTROL_STOP_POLL_INTERVAL_SECONDS, 5),
      transport: readTransport(undefined, process.env.REMOTE_CONTROL_TRANSPORT),
    };
  }

  throw new Error("Remote Control config not found. Run `npx @gaberagland/remote-control install` to create " + configPath + ".");
}

function readTransport(configValue, envValue) {
  const raw = String(envValue !== undefined && envValue !== null && envValue !== "" ? envValue : configValue || "poll")
    .trim()
    .toLowerCase();
  if (raw === "websocket" || raw === "ws") {
    return "websocket";
  }
  return "poll";
}

function readNumber(configValue, envValue, fallback) {
  const raw = envValue !== undefined && envValue !== null ? envValue : configValue;
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

async function apiFetch(config, pathName, init) {
  const options = init || {};
  if (process.env.REMOTE_CONTROL_MOCK_FILE) {
    return mockApiFetch(config, pathName, options);
  }

  const headers = Object.assign({
    "content-type": "application/json",
    authorization: "Bearer " + config.token,
  }, options.headers || {});
  const requestUrl = config.apiBaseUrl + pathName;
  const response = await httpFetch(requestUrl, {
    method: options.method || "GET",
    headers,
    body: options.body,
  });
  let body = {};
  let parsedJson = false;
  if (response.text.trim()) {
    try {
      body = JSON.parse(response.text);
      parsedJson = true;
    } catch (_error) {
      body = { raw: response.text };
    }
  }
  if (response.status < 200 || response.status >= 300) {
    const message = body && (body.error || body.message)
      ? body.error || body.message
      : response.statusText;
    const endpointHint = parsedJson ? "" : " at " + requestUrl;
    throw new Error("Remote Control API " + response.status + endpointHint + ": " + message);
  }
  return body;
}

function httpFetch(requestUrl, options) {
  if (typeof fetch === "function") {
    return fetch(requestUrl, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    }).then(async function toSimpleResponse(response) {
      return {
        status: response.status,
        statusText: response.statusText,
        text: await response.text(),
      };
    });
  }

  return new Promise(function requestPromise(resolve, reject) {
    const parsed = new URL(requestUrl);
    const client = parsed.protocol === "http:" ? http : https;
    const request = client.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method,
      headers: options.headers,
    }, function onResponse(response) {
      const chunks = [];
      response.on("data", function onData(chunk) {
        chunks.push(Buffer.from(chunk));
      });
      response.on("end", function onEnd() {
        resolve({
          status: response.statusCode || 0,
          statusText: response.statusMessage || "",
          text: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    request.on("error", reject);
    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

function mockApiFetch(config, pathName, init) {
  const mockPath = process.env.REMOTE_CONTROL_MOCK_FILE;
  const mock = existsSync(mockPath) ? readJson(mockPath) : {};
  const method = String(init.method || "GET").toUpperCase();
  const key = method + " " + pathName;
  const body = typeof init.body === "string" && init.body.trim()
    ? JSON.parse(init.body)
    : null;
  const call = {
    method,
    path: pathName,
    authorization: "Bearer " + config.token,
    body,
  };
  mock.calls = Array.isArray(mock.calls) ? mock.calls.concat([call]) : [call];
  const response = mock.responses && mock.responses[key]
    ? mock.responses[key]
    : { status: 404, body: { error: "No mock response for " + key } };
  writeJson(mockPath, mock);
  if (response.status && response.status >= 400) {
    throw new Error("Remote Control API " + response.status + ": " + ((response.body && response.body.error) || "mock error"));
  }
  return response.body || {};
}

function readActiveThreads() {
  ensureStateDirs();
  if (!existsSync(activeThreadsPath)) {
    return { threads: {} };
  }
  const active = readJson(activeThreadsPath);
  return Object.assign({}, active, {
    threads: active && typeof active.threads === "object" && !Array.isArray(active.threads)
      ? active.threads
      : {},
  });
}

function writeActiveThreads(active) {
  writeJson(activeThreadsPath, Object.assign({}, active, {
    threads: active && typeof active.threads === "object" && !Array.isArray(active.threads)
      ? active.threads
      : {},
  }));
}

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function basenameForTitle(cwd) {
  const parts = String(cwd || "").split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(cwd || "Codex thread");
}

function codexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function normalizeTitleText(text) {
  // Fresh Codex threads can temporarily use the raw first message as the title;
  // skill mentions are serialized there as Markdown links, so keep only the label.
  return String(text || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function isUsableThreadTitle(title) {
  const text = normalizeTitleText(title);
  if (!text) {
    return false;
  }
  return !/\/SKILL\.md\b/i.test(text) && !/\]\(/.test(text);
}

function codexStateDbPath() {
  return process.env.REMOTE_CONTROL_STATE_DB || path.join(codexHome(), "state_5.sqlite");
}

function readCodexSidebarTitle(codexThreadId) {
  const stateDbPath = codexStateDbPath();
  if (!codexThreadId || !existsSync(stateDbPath)) {
    return "";
  }

  const escapedThreadId = String(codexThreadId).replace(/'/g, "''");
  const result = spawnSync("sqlite3", [
    "-json",
    stateDbPath,
    "SELECT title FROM threads WHERE id = '" + escapedThreadId + "' LIMIT 1;",
  ], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) {
    return "";
  }

  try {
    const rows = JSON.parse(result.stdout);
    const title = Array.isArray(rows) && rows[0] && typeof rows[0].title === "string"
      ? rows[0].title
      : "";
    const normalizedTitle = normalizeTitleText(title);
    return isUsableThreadTitle(title) ? normalizedTitle : "";
  } catch {
    return "";
  }
}

function discoverThreadTitle(codexThreadId, cwd) {
  const sidebarTitle = readCodexSidebarTitle(codexThreadId);
  if (sidebarTitle) {
    return sidebarTitle;
  }
  return "";
}

module.exports = {
  activeThreadsPath,
  apiFetch,
  basenameForTitle,
  configPath,
  discoverThreadTitle,
  ensureStateDirs,
  isUsableThreadTitle,
  readActiveThreads,
  readCodexSidebarTitle,
  readConfig,
  readJson,
  shellQuote,
  skillDir,
  stateDir,
  writeActiveThreads,
  writeJson,
};
