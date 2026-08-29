#!/usr/bin/env node
/**
 * Frees :8080 so `vite dev` can bind. QA on :8081 is scripts/preview.mjs.
 *
 * Node has no process-tree API. Same /proc inode + SIGTERM→SIGKILL path as
 * preview.mjs — not kill-port, tree-kill, pm2, or fkill.
 */
import { readdirSync, readFileSync, readlinkSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseListenerInodes, parsePgid, parsePid, terminatePids } from "./preview.mjs";

const PORT = 8080;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PID_FILE = join(ROOT, ".grok/dev.pid");
const GRACE_MS = 3000;

function looksLikeVite(cmdline) {
  const argv = String(cmdline ?? "").split("\0").filter(Boolean).join(" ");
  if (/\bpreview[\w-]*\.mjs\b/.test(argv)) return false;
  if (/\bgrok-preview-proxy\b/.test(argv)) return false;
  if (/\bxai-workspace-server\b/.test(argv)) return false;
  return /\bvite\b/.test(argv) || /\bwith-app-env\.mjs\b/.test(argv) || /\brun\s+dev(?:\s|$)/.test(argv);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === "EPERM";
  }
}

function cmdlineOf(pid) {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8");
  } catch {
    return "";
  }
}

function ppidOf(pid) {
  try {
    const line = readFileSync(`/proc/${pid}/stat`, "utf8");
    const end = line.lastIndexOf(") ");
    if (end === -1) return null;
    const ppid = Number.parseInt(line.slice(end + 2).split(/\s+/)[1], 10);
    return Number.isInteger(ppid) && ppid > 1 ? ppid : null;
  } catch {
    return null;
  }
}

function pgidOf(pid) {
  try {
    return parsePgid(readFileSync(`/proc/${pid}/stat`, "utf8"));
  } catch {
    return null;
  }
}

function killPid(pid, signal) {
  if (pgidOf(pid) === pid) {
    try {
      process.kill(-pid, signal);
      return;
    } catch {
      /* group gone */
    }
  }
  try {
    process.kill(pid, signal);
  } catch {
    /* pid gone */
  }
}

function pidsForSocketInodes(inodes) {
  const targets = new Set([...inodes].map((inode) => `socket:[${inode}]`));
  const pids = [];
  for (const entry of readdirSync("/proc")) {
    const pid = parsePid(entry);
    if (pid === null || pid === process.pid) continue;
    let fds;
    try {
      fds = readdirSync(`/proc/${pid}/fd`);
    } catch {
      continue;
    }
    for (const fd of fds) {
      try {
        if (targets.has(readlinkSync(`/proc/${pid}/fd/${fd}`))) {
          pids.push(pid);
          break;
        }
      } catch {
        /* fd closed */
      }
    }
  }
  return pids;
}

function portPids() {
  const inodes = new Set();
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    try {
      for (const inode of parseListenerInodes(readFileSync(file, "utf8"), PORT)) inodes.add(inode);
    } catch {
      /* no ipv6 */
    }
  }
  return inodes.size > 0 ? pidsForSocketInodes(inodes) : [];
}

function readPidFile() {
  try {
    return parsePid(readFileSync(PID_FILE, "utf8"));
  } catch {
    return null;
  }
}

function skipSet() {
  const skip = new Set([process.pid, process.ppid].filter(Boolean));
  let cur = process.pid;
  for (let i = 0; i < 8; i++) {
    const p = ppidOf(cur);
    if (!p || skip.has(p)) break;
    skip.add(p);
    cur = p;
  }
  return skip;
}

/** Socket owner plus vite/npm wrappers above it. Never our own ancestors. */
function ownersToKill() {
  const skip = skipSet();
  const seeds = new Set(portPids());
  const filePid = readPidFile();
  if (filePid && looksLikeVite(cmdlineOf(filePid))) seeds.add(filePid);
  const owners = new Set();
  for (const seed of seeds) {
    let cur = seed;
    for (let i = 0; i < 8 && cur; i++) {
      if (skip.has(cur)) break;
      if (looksLikeVite(cmdlineOf(cur))) owners.add(cur);
      else break;
      cur = ppidOf(cur);
    }
  }
  return [...owners];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const owners = ownersToKill();
  if (owners.length === 0) {
    rmSync(PID_FILE, { force: true });
    console.log(`[dev-port] nothing holding :${PORT}`);
    return;
  }
  const { signalled, stubborn } = await terminatePids(owners, {
    kill: killPid,
    isAlive,
    sleep,
    graceMs: GRACE_MS,
  });
  if (stubborn.length) {
    console.error(`[dev-port] still held by pid(s) ${stubborn.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  rmSync(PID_FILE, { force: true });
  console.log(`[dev-port] freed :${PORT} (was pid ${signalled.join(", ")})`);
}

await main();
