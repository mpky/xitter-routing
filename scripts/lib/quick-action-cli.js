import { normalizeFrontendHost } from "../../extension/src/shared/rewriter.js";
import { extractFirstSupportedUrl, resolveQuickActionUrl } from "./open-tweet.js";

export const DEFAULT_BROWSER_NAME = "Google Chrome";
export const NO_URL_FOUND_MESSAGE = "No supported X or Twitter URL was found.";
export const UNKNOWN_OPTION_PREFIX = "Unknown option:";

export function getUsageText() {
  return [
    "Usage: open-tweet.mjs [--print-only] [--browser <app-name>|default] [--host <frontend-host>] [text-or-url]",
    "",
    "Accepts text/URLs from arguments, stdin, or the macOS clipboard.",
    "Post links open in X's login-free embed page unless --host (or",
    "XITTER_FRONTEND_HOST) names a Nitter-style frontend to use instead."
  ].join("\n");
}

export function parseCliArgs(argv, env = {}) {
  const values = [];
  let printOnly = false;
  let browserName = DEFAULT_BROWSER_NAME;
  let frontendHost = normalizeFrontendHost(env.XITTER_FRONTEND_HOST ?? "");

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--print-only") {
      printOnly = true;
      continue;
    }

    if (current === "--browser") {
      const nextValue = argv[index + 1];

      if (!nextValue || nextValue.startsWith("-")) {
        return {
          error: "Missing value for --browser."
        };
      }

      browserName = nextValue;
      index += 1;
      continue;
    }

    if (current === "--host") {
      const nextValue = argv[index + 1];

      if (!nextValue || nextValue.startsWith("-")) {
        return {
          error: "Missing value for --host."
        };
      }

      frontendHost = normalizeFrontendHost(nextValue);

      if (!frontendHost) {
        return {
          error: `Invalid frontend host: ${nextValue}`
        };
      }

      index += 1;
      continue;
    }

    if (current === "--help" || current === "-h") {
      return {
        help: true
      };
    }

    if (current.startsWith("-")) {
      return {
        error: `${UNKNOWN_OPTION_PREFIX} ${current}`
      };
    }

    values.push(current);
  }

  return {
    browserName,
    frontendHost,
    printOnly,
    values
  };
}

export function findInputCandidate(values) {
  if (!Array.isArray(values) || values.length === 0) {
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

function firstNonEmptyString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
}

export function selectRawInput(values, stdinValue, clipboardValue) {
  const argumentValue = findInputCandidate(values);

  if (argumentValue) {
    return {
      rawInput: argumentValue,
      source: "args"
    };
  }

  const stdinCandidate = firstNonEmptyString([stdinValue]);

  if (stdinCandidate) {
    return {
      rawInput: stdinCandidate,
      source: "stdin"
    };
  }

  const clipboardCandidate = firstNonEmptyString([clipboardValue]);

  if (clipboardCandidate) {
    return {
      rawInput: clipboardCandidate,
      source: "clipboard"
    };
  }

  return {
    rawInput: null,
    source: null
  };
}

export async function runQuickAction(argv, dependencies = {}) {
  const {
    clipboardValue,
    env = {},
    openUrl = async () => {},
    readClipboard = async () => "",
    readStdin = async () => "",
    stdinValue
  } = dependencies;

  const parsedArgs = parseCliArgs(argv, env);

  if (parsedArgs.help) {
    return {
      exitCode: 0,
      stderr: `${getUsageText()}\n`
    };
  }

  if (parsedArgs.error) {
    return {
      exitCode: 1,
      stderr: `${parsedArgs.error}\n${getUsageText()}\n`
    };
  }

  const resolvedStdinValue = stdinValue ?? await readStdin();
  const resolvedClipboardValue = clipboardValue ?? await readClipboard();
  const { rawInput, source } = selectRawInput(
    parsedArgs.values,
    resolvedStdinValue,
    resolvedClipboardValue
  );
  const finalUrl = resolveQuickActionUrl(rawInput, {
    frontendHost: parsedArgs.frontendHost
  });

  if (!finalUrl) {
    return {
      exitCode: 1,
      stderr: `${NO_URL_FOUND_MESSAGE}\n`
    };
  }

  if (!parsedArgs.printOnly) {
    await openUrl(finalUrl, parsedArgs.browserName);
  }

  return {
    browserName: parsedArgs.browserName,
    exitCode: 0,
    finalUrl,
    opened: !parsedArgs.printOnly,
    source,
    stdout: `${finalUrl}\n`
  };
}
