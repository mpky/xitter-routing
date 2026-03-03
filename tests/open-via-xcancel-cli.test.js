import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_BROWSER_NAME,
  NO_URL_FOUND_MESSAGE,
  findInputCandidate,
  getUsageText,
  parseCliArgs,
  runQuickAction,
  selectRawInput
} from "../scripts/lib/quick-action-cli.js";

test("parseCliArgs returns help for help flags", () => {
  assert.deepEqual(parseCliArgs(["--help"]), { help: true });
  assert.deepEqual(parseCliArgs(["-h"]), { help: true });
});

test("parseCliArgs rejects unknown options", () => {
  assert.deepEqual(parseCliArgs(["--nope"]), {
    error: "Unknown option: --nope"
  });
});

test("parseCliArgs rejects missing browser values", () => {
  assert.deepEqual(parseCliArgs(["--browser"]), {
    error: "Missing value for --browser."
  });
  assert.deepEqual(parseCliArgs(["--browser", "--print-only"]), {
    error: "Missing value for --browser."
  });
});

test("findInputCandidate extracts supported URLs from argument text", () => {
  assert.equal(
    findInputCandidate(["ignore this", "see x.com/jack/status/20 in here"]),
    "https://x.com/jack/status/20"
  );
});

test("selectRawInput prefers arguments over stdin and clipboard", () => {
  assert.deepEqual(
    selectRawInput(
      ["https://twitter.com/jack/status/20"],
      "https://x.com/from-stdin/status/1",
      "https://x.com/from-clipboard/status/2"
    ),
    {
      rawInput: "https://twitter.com/jack/status/20",
      source: "args"
    }
  );
});

test("selectRawInput falls back from stdin to clipboard", () => {
  assert.deepEqual(selectRawInput([], "  ", "x.com/jack/status/20"), {
    rawInput: "x.com/jack/status/20",
    source: "clipboard"
  });
});

test("runQuickAction prints usage for help", async () => {
  const result = await runQuickAction(["--help"]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, `${getUsageText()}\n`);
});

test("runQuickAction opens the rewritten URL in Chrome by default", async () => {
  const opened = [];
  const result = await runQuickAction(["x.com/jack/status/20"], {
    openUrl: async (url, browserName) => {
      opened.push({ browserName, url });
    }
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.finalUrl, "https://xcancel.com/jack/status/20");
  assert.deepEqual(opened, [
    {
      browserName: DEFAULT_BROWSER_NAME,
      url: "https://xcancel.com/jack/status/20"
    }
  ]);
});

test("runQuickAction supports print-only without opening a browser", async () => {
  let didOpen = false;
  const result = await runQuickAction(["--print-only", "https://x.com/home"], {
    openUrl: async () => {
      didOpen = true;
    }
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.opened, false);
  assert.equal(didOpen, false);
  assert.equal(result.stdout, "https://xcancel.com/home\n");
});

test("runQuickAction uses stdin when arguments are absent", async () => {
  const result = await runQuickAction([], {
    readClipboard: async () => "x.com/from-clipboard/status/2",
    readStdin: async () => "x.com/from-stdin/status/1"
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.source, "stdin");
  assert.equal(result.finalUrl, "https://xcancel.com/from-stdin/status/1");
});

test("runQuickAction uses clipboard as the final fallback", async () => {
  const result = await runQuickAction([], {
    readClipboard: async () => "https://twitter.com/jack",
    readStdin: async () => ""
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.source, "clipboard");
  assert.equal(result.finalUrl, "https://xcancel.com/jack");
});

test("runQuickAction respects the default-browser override", async () => {
  const opened = [];
  const result = await runQuickAction(
    ["--browser", "default", "https://twitter.com/jack/status/20"],
    {
      openUrl: async (url, browserName) => {
        opened.push({ browserName, url });
      }
    }
  );

  assert.equal(result.exitCode, 0);
  assert.deepEqual(opened, [
    {
      browserName: "default",
      url: "https://xcancel.com/jack/status/20"
    }
  ]);
});

test("runQuickAction returns an error when no supported URL is found", async () => {
  const result = await runQuickAction(["https://example.com/story"]);

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, `${NO_URL_FOUND_MESSAGE}\n`);
});
