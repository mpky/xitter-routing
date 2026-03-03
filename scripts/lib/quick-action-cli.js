import { extractFirstSupportedUrl, resolveQuickActionUrl } from "./open-via-xcancel.js";

export const DEFAULT_BROWSER_NAME = "Google Chrome";
export const NO_URL_FOUND_MESSAGE = "No supported X, Twitter, or xcancel URL was found.";
export const UNKNOWN_OPTION_PREFIX = "Unknown option:";

export function getUsageText() {
  return [
    "Usage: open-via-xcancel.mjs [--print-only] [--browser <app-name>|default] [text-or-url]",
    "",
    "Accepts text/URLs from arguments, stdin, or the macOS clipboard."
  ].join("\n");
}

export function parseCliArgs(argv) {
  const values = [];
  let printOnly = false;
  let browserName = DEFAULT_BROWSER_NAME;

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
    openUrl = async () => {},
    readClipboard = async () => "",
    readStdin = async () => "",
    stdinValue
  } = dependencies;

  const parsedArgs = parseCliArgs(argv);

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
  const finalUrl = resolveQuickActionUrl(rawInput);

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
