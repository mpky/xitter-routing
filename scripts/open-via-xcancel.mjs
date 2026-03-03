#!/usr/bin/env node

import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

import { extractFirstSupportedUrl, resolveQuickActionUrl } from "./lib/open-via-xcancel.js";

const execFileAsync = promisify(execFile);

function printUsage() {
  process.stderr.write(
    [
      "Usage: open-via-xcancel.mjs [--print-only] [--browser <app-name>|default] [text-or-url]",
      "",
      "Accepts text/URLs from arguments, stdin, or the macOS clipboard."
    ].join("\n") + "\n"
  );
}

function parseCliArgs(argv) {
  const values = [];
  let printOnly = false;
  let browserName = "Google Chrome";

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--print-only") {
      printOnly = true;
      continue;
    }

    if (current === "--browser") {
      browserName = argv[index + 1] ?? browserName;
      index += 1;
      continue;
    }

    if (current === "--help" || current === "-h") {
      printUsage();
      process.exit(0);
    }

    values.push(current);
  }

  return {
    printOnly,
    browserName,
    values
  };
}

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

function findInputCandidate(values) {
  if (values.length === 0) {
    return null;
  }

  for (const value of values) {
    const extracted = extractFirstSupportedUrl(value);

    if (extracted) {
      return extracted;
    }
  }

  return values.join("\n");
}

async function openUrl(url, browserName) {
  if (browserName === "default") {
    await execFileAsync("open", [url]);
    return;
  }

  await execFileAsync("open", ["-a", browserName, url]);
}

async function main() {
  const { printOnly, browserName, values } = parseCliArgs(process.argv.slice(2));
  const stdinValue = await readStdin();
  const clipboardValue = await readClipboard();
  const rawInput = findInputCandidate(values) ?? (stdinValue || clipboardValue);
  const finalUrl = resolveQuickActionUrl(rawInput);

  if (!finalUrl) {
    process.stderr.write("No supported X, Twitter, or xcancel URL was found.\n");
    process.exit(1);
  }

  if (!printOnly) {
    await openUrl(finalUrl, browserName);
  }

  process.stdout.write(`${finalUrl}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
