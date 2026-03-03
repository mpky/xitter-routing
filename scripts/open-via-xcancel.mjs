#!/usr/bin/env node

import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

import { runQuickAction } from "./lib/quick-action-cli.js";

const execFileAsync = promisify(execFile);

async function readStdin() {
  if (process.stdin.isTTY) {
    return "";
  }

  let input = "";

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  return input.trim();
}

async function readClipboard() {
  try {
    const { stdout } = await execFileAsync("pbpaste");
    return stdout.trim();
  } catch {
    return "";
  }
}

async function openUrl(url, browserName) {
  if (browserName === "default") {
    await execFileAsync("open", [url]);
    return;
  }

  await execFileAsync("open", ["-a", browserName, url]);
}

async function main() {
  const result = await runQuickAction(process.argv.slice(2), {
    openUrl,
    readClipboard,
    readStdin
  });

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
