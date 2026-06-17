#!/usr/bin/env node

const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const COMMIT_BATCH_SIZE = 200;
const RESET = "\u001b[0m";
const DIM = "\u001b[2m";
const CYAN = "\u001b[36m";
const GREEN = "\u001b[32m";
const MAGENTA = "\u001b[35m";
const YELLOW = "\u001b[33m";
const BLUE = "\u001b[34m";
const BRIGHT_CYAN = "\u001b[96m";
const BRIGHT_GREEN = "\u001b[92m";
const BRIGHT_MAGENTA = "\u001b[95m";
const BRIGHT_YELLOW = "\u001b[93m";
const WHITE = "\u001b[97m";
const COMMIT_EMOJIS = [
  "🍎",
  "🍊",
  "🍋",
  "🍐",
  "🍇",
  "🍓",
  "🍒",
  "🍑",
  "🍍",
  "🥝",
  "🥑",
  "🌶️",
  "🌽",
  "🥕",
  "🥨",
  "🧀",
  "🍞",
  "🥐",
  "🍕",
  "🌮",
  "🍜",
  "🍣",
  "🍩",
  "🍪",
  "☕",
  "🚗",
  "🚀",
  "🛠️",
  "💎",
  "🔑",
  "🎯",
  "🎲",
  "🎸",
  "🎧",
  "🏆",
  "⚙️",
  "📌",
  "📎",
  "📦",
  "📘",
  "📙",
  "📗",
  "📕",
  "🔵",
  "🟢",
  "🟡",
  "🟣",
  "🟠",
  "⭐",
  "🌙",
  "☀️",
  "⚡",
  "🔥",
  "❄️",
  "🌊",
  "🌲",
  "🪵",
  "🧩",
  "🧭",
  "🧲",
  "🔨",
  "🪛",
  "🧪",
  "🧬",
  "🧰",
  "🧯",
  "🪄",
  "🧿",
  "🪙",
  "💡",
  "🔦",
  "🕯️",
  "🧊",
  "🪨",
  "🪐",
  "🌎",
  "🌕",
  "🌗",
  "🌀",
  "🌈",
  "☂️",
  "⛅",
  "⛈️",
  "🌤️",
  "🪁",
  "🛸",
  "🚁",
  "🚂",
  "🚜",
  "🏗️",
  "🏭",
  "🏛️",
  "🧱",
  "🪜",
  "🧵",
  "🪡",
  "🧶",
  "🎨",
  "🖌️",
  "✏️",
  "🖊️",
  "🗂️",
  "🗃️",
  "🧾",
  "📊",
  "📈",
  "🔍",
  "🔬",
  "🧮",
  "🎹",
  "🥁",
  "🎺",
];
const EXTENSION_COLOR_MAP = new Map([
  ["xaml", BRIGHT_GREEN],
  ["xml", GREEN],
  ["cs", BRIGHT_CYAN],
  ["fs", CYAN],
  ["vb", CYAN],
  ["ts", BLUE],
  ["tsx", BLUE],
  ["js", YELLOW],
  ["jsx", YELLOW],
  ["json", BRIGHT_YELLOW],
  ["jsonc", BRIGHT_YELLOW],
  ["css", MAGENTA],
  ["scss", BRIGHT_MAGENTA],
  ["sass", BRIGHT_MAGENTA],
  ["html", BRIGHT_MAGENTA],
  ["cshtml", BRIGHT_MAGENTA],
  ["razor", BRIGHT_MAGENTA],
  ["sql", GREEN],
  ["ps1", CYAN],
  ["psm1", CYAN],
  ["md", WHITE],
  ["yml", BRIGHT_YELLOW],
  ["yaml", BRIGHT_YELLOW],
]);

function printUsage() {
  console.log("Usage: node last-commit-message.js [--limit <count>] [--page <number>] [--page-size <count>] [--links <plain|path|file|vscode|cursor|visualstudio>] [--open <cursor|code|vscode|visualstudio|none>] [--ext <extensions>] [--path <path>] [repo-path]");
  console.log("Example: node last-commit-message.js --open cursor --page-size 20 --links path --path environments/prod --ext xaml,cs,js /path/to/repo");
}

function parseArgs(args) {
  const options = {
    extensions: [],
    limit: 100,
    linkMode: "path",
    openMode: "cursor",
    page: 1,
    pageSpecified: false,
    pageSize: 20,
    paths: [],
    repoPath: process.cwd(),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }

    if (arg === "--ext" || arg === "--extension") {
      const value = args[index + 1];

      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }

      options.extensions.push(...parseExtensions(value));
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      const value = args[index + 1];

      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }

      options.limit = parseLimit(value);
      index += 1;
      continue;
    }

    if (arg === "--links" || arg === "--link") {
      const value = args[index + 1];

      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }

      options.linkMode = parseLinkMode(value);
      index += 1;
      continue;
    }

    if (arg === "--page") {
      const value = args[index + 1];

      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }

      options.page = parsePositiveInteger(value, "page");
      options.pageSpecified = true;
      index += 1;
      continue;
    }

    if (arg === "--open" || arg === "--editor") {
      const value = args[index + 1];

      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }

      options.openMode = parseOpenMode(value);
      index += 1;
      continue;
    }

    if (arg === "--page-size" || arg === "--per-page") {
      const value = args[index + 1];

      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }

      options.pageSize = parsePositiveInteger(value, "page size");
      index += 1;
      continue;
    }

    if (arg === "--path" || arg === "--scope") {
      const value = args[index + 1];

      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }

      options.paths.push(...parseList(value));
      index += 1;
      continue;
    }

    if (arg.startsWith("--ext=")) {
      options.extensions.push(...parseExtensions(arg.slice("--ext=".length)));
      continue;
    }

    if (arg.startsWith("--extension=")) {
      options.extensions.push(...parseExtensions(arg.slice("--extension=".length)));
      continue;
    }

    if (arg.startsWith("--limit=")) {
      options.limit = parseLimit(arg.slice("--limit=".length));
      continue;
    }

    if (arg.startsWith("--links=")) {
      options.linkMode = parseLinkMode(arg.slice("--links=".length));
      continue;
    }

    if (arg.startsWith("--link=")) {
      options.linkMode = parseLinkMode(arg.slice("--link=".length));
      continue;
    }

    if (arg.startsWith("--page=")) {
      options.page = parsePositiveInteger(arg.slice("--page=".length), "page");
      options.pageSpecified = true;
      continue;
    }

    if (arg.startsWith("--open=")) {
      options.openMode = parseOpenMode(arg.slice("--open=".length));
      continue;
    }

    if (arg.startsWith("--editor=")) {
      options.openMode = parseOpenMode(arg.slice("--editor=".length));
      continue;
    }

    if (arg.startsWith("--page-size=")) {
      options.pageSize = parsePositiveInteger(arg.slice("--page-size=".length), "page size");
      continue;
    }

    if (arg.startsWith("--per-page=")) {
      options.pageSize = parsePositiveInteger(arg.slice("--per-page=".length), "page size");
      continue;
    }

    if (arg.startsWith("--path=")) {
      options.paths.push(...parseList(arg.slice("--path=".length)));
      continue;
    }

    if (arg.startsWith("--scope=")) {
      options.paths.push(...parseList(arg.slice("--scope=".length)));
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (options.repoPath !== process.cwd()) {
      throw new Error("Expected at most one repo path.");
    }

    options.repoPath = arg;
  }

  options.extensions = [...new Set(options.extensions)];
  options.paths = [...new Set(options.paths)];
  options.repoPath = path.resolve(options.repoPath);

  return options;
}

function parseList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseExtensions(value) {
  return parseList(value)
    .map((extension) => extension.trim().replace(/^\./, ""))
    .filter(Boolean);
}

function parseLimit(value) {
  return parsePositiveInteger(value, "limit");
}

function parsePositiveInteger(value, label) {
  const number = Number.parseInt(value, 10);

  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return number;
}

function parseLinkMode(value) {
  const linkMode = value.trim().toLowerCase();
  const aliases = {
    code: "vscode",
    vs: "visualstudio",
    visual: "visualstudio",
    "visual-studio": "visualstudio",
  };
  const normalizedLinkMode = aliases[linkMode] || linkMode;
  const allowed = new Set(["plain", "path", "file", "vscode", "cursor", "visualstudio"]);

  if (!allowed.has(normalizedLinkMode)) {
    throw new Error(`Unknown link mode: ${value}`);
  }

  return normalizedLinkMode;
}

function parseOpenMode(value) {
  const openMode = value.trim().toLowerCase();
  const aliases = {
    code: "vscode",
    none: "",
    off: "",
    vs: "visualstudio",
    visual: "visualstudio",
    "visual-studio": "visualstudio",
  };
  const normalizedOpenMode = aliases[openMode] ?? openMode;
  const allowed = new Set(["", "vscode", "cursor", "visualstudio"]);

  if (!allowed.has(normalizedOpenMode)) {
    throw new Error(`Unknown open mode: ${value}`);
  }

  return normalizedOpenMode;
}

function getLastChangedFiles(repoPath, extensions, paths, limit) {
  const pathspecs = buildPathspecs(extensions, paths);
  const files = [];
  const seen = new Set();
  let skip = 0;

  while (files.length < limit) {
    const hashes = getCommitHashes(repoPath, pathspecs, skip, COMMIT_BATCH_SIZE);

    if (hashes.length === 0) {
      break;
    }

    for (const hash of hashes) {
      for (const file of getCommitFiles(repoPath, hash, pathspecs)) {
        const distinctKey = normalizeDistinctFileKey(file);

        if (seen.has(distinctKey)) {
          continue;
        }

        seen.add(distinctKey);
        files.push({ commit: hash, file });

        if (files.length >= limit) {
          return files;
        }
      }
    }

    skip += hashes.length;
  }

  return files;
}

function getCommitHashes(repoPath, pathspecs, skip, count) {
  const args = [
    "-C",
    repoPath,
    "log",
    "--format=%H",
    "--diff-filter=ACMRT",
    `--max-count=${count}`,
    `--skip=${skip}`,
  ];

  if (pathspecs.length > 0) {
    args.push("--", ...pathspecs);
  }

  return splitLines(runGit(args));
}

function getCommitFiles(repoPath, hash, pathspecs) {
  const args = [
    "-C",
    repoPath,
    "diff-tree",
    "--root",
    "--no-commit-id",
    "--name-only",
    "-r",
    "-m",
    "--diff-filter=ACMRT",
    hash,
  ];

  if (pathspecs.length > 0) {
    args.push("--", ...pathspecs);
  }

  return splitLines(runGit(args));
}

function splitLines(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeDistinctFileKey(file) {
  return file.replace(/\\/g, "/").toLowerCase();
}

function runGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function buildPathspecs(extensions, paths) {
  if (extensions.length === 0 && paths.length === 0) {
    return [];
  }

  if (extensions.length === 0) {
    return paths;
  }

  if (paths.length === 0) {
    return extensions.map((extension) => `*.${extension}`);
  }

  return paths.flatMap((targetPath) => {
    const normalizedPath = targetPath.replace(/[\\/]+$/, "");

    if (normalizedPath === "." || normalizedPath === "") {
      return extensions.map((extension) => `*.${extension}`);
    }

    return extensions.map((extension) => `${normalizedPath}/**/*.${extension}`);
  });
}

function formatRow(item, repoPath, linkMode, rowNumber, width, commitEmojiMap) {
  const color = colorForExtension(item.file);
  const commitMark = commitEmojiMap.get(item.commit) || "▫️";
  const number = `${String(rowNumber).padStart(width, " ")}.`;

  return `${DIM}${number}${RESET} ${commitMark} ${color}${formatFile(item.file, repoPath, linkMode)}${RESET}`;
}

function formatFile(file, repoPath, linkMode) {
  const absolutePath = path.resolve(repoPath, file);

  if (linkMode === "path" || linkMode === "visualstudio") {
    return absolutePath;
  }

  if (linkMode === "file") {
    return hyperlink(file, pathToFileURL(absolutePath).href);
  }

  if (linkMode === "vscode") {
    return hyperlink(file, editorUri("vscode", absolutePath));
  }

  if (linkMode === "cursor") {
    return hyperlink(file, editorUri("cursor", absolutePath));
  }

  return file;
}

function colorForExtension(file) {
  const extension = path.extname(file).toLowerCase().replace(/^\./, "") || "none";
  return EXTENSION_COLOR_MAP.get(extension) || DIM;
}

function buildCommitEmojiMap(files) {
  const emojiMap = new Map();
  const used = new Set();

  for (const item of files) {
    if (emojiMap.has(item.commit)) {
      continue;
    }

    const emoji = nextCommitEmoji(item.commit, used);
    emojiMap.set(item.commit, emoji);
    used.add(emoji);
  }

  return emojiMap;
}

function nextCommitEmoji(commit, used) {
  const startIndex = commitEmojiIndex(commit);

  for (let offset = 0; offset < COMMIT_EMOJIS.length; offset += 1) {
    const emoji = COMMIT_EMOJIS[(startIndex + offset) % COMMIT_EMOJIS.length];

    if (!used.has(emoji)) {
      return emoji;
    }
  }

  return `#${used.size + 1}`;
}

function commitEmojiIndex(commit) {
  let hash = 0;

  for (const char of commit) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash % COMMIT_EMOJIS.length;
}

function editorUri(scheme, absolutePath) {
  return `${scheme}://file/${encodeURI(absolutePath.replace(/\\/g, "/"))}`;
}

function hyperlink(label, url) {
  return `\u001b]8;;${url}\u0007${label}\u001b]8;;\u0007`;
}

function describeFilters(options) {
  const filters = [];

  if (options.paths.length > 0) {
    filters.push(`paths: ${options.paths.join(", ")}`);
  }

  if (options.extensions.length > 0) {
    filters.push(`extensions: ${options.extensions.join(", ")}`);
  }

  return filters.length > 0 ? ` for ${filters.join("; ")}` : "";
}

function displayPage(files, options, page, commitEmojiMap) {
  const pageStart = (page - 1) * options.pageSize;
  const pageFiles = files.slice(pageStart, pageStart + options.pageSize);
  const totalPages = Math.max(1, Math.ceil(files.length / options.pageSize));

  if (pageFiles.length === 0) {
    console.error(`Error: page ${page} is out of range. ${files.length} files found, ${totalPages} pages available.`);
    process.exit(1);
  }

  const firstRowNumber = pageStart + 1;
  const rowNumberWidth = String(Math.min(files.length, pageStart + pageFiles.length)).length;

  console.log(`${DIM}Showing ${firstRowNumber}-${pageStart + pageFiles.length} of ${files.length} changed files. Page ${page}/${totalPages}.${RESET}`);

  for (let index = 0; index < pageFiles.length; index += 1) {
    console.log(formatRow(pageFiles[index], options.repoPath, options.linkMode, firstRowNumber + index, rowNumberWidth, commitEmojiMap));
  }

  return page < totalPages;
}

function waitForNextAction(files, options, hasNextPage) {
  const prompt = hasNextPage
    ? "Enter next page, number opens file, q quits..."
    : "Number opens file, Enter or q quits...";
  process.stdout.write(`${DIM}${prompt}${RESET}`);

  const buffer = Buffer.alloc(1);
  let input = "";

  while (true) {
    const bytesRead = fs.readSync(0, buffer, 0, 1);

    if (bytesRead === 0) {
      process.stdout.write("\n");
      return false;
    }

    const char = buffer.toString("utf8", 0, bytesRead);

    if (char === "\n" || char === "\r") {
      process.stdout.write("\n");
      return parseAction(input, files, options, hasNextPage);
    }

    input += char;
  }
}

function parseAction(input, files, options, hasNextPage) {
  const value = input.trim().toLowerCase();

  if (value === "") {
    return hasNextPage ? "next" : "quit";
  }

  if (value === "q" || value === "quit" || value === "exit") {
    return "quit";
  }

  if (/^\d+$/.test(value)) {
    const rowNumber = Number.parseInt(value, 10);

    if (rowNumber < 1 || rowNumber > files.length) {
      console.error(`Error: row ${rowNumber} is out of range. Choose 1-${files.length}.`);
      return "stay";
    }

    openFile(files[rowNumber - 1].file, options);
    return "stay";
  }

  console.error(`Error: unknown input: ${input.trim()}`);
  return "stay";
}

function openFile(file, options) {
  if (!options.openMode) {
    console.error("Error: no editor configured. Use --open cursor, --open vscode, or --open visualstudio.");
    return;
  }

  const absolutePath = path.resolve(options.repoPath, file);
  const command = editorCommand(options.openMode);
  const result = spawnSync(command, [absolutePath], {
    shell: false,
    stdio: "ignore",
    windowsHide: true,
  });

  if (result.error) {
    console.error(`Error: unable to open ${absolutePath} with ${command}: ${result.error.message}`);
  }
}

function editorCommand(openMode) {
  if (openMode === "vscode") {
    return "code";
  }

  if (openMode === "visualstudio") {
    return "devenv";
  }

  return openMode;
}

function displayFiles(files, options) {
  const commitEmojiMap = buildCommitEmojiMap(files);

  if (options.pageSpecified || !process.stdin.isTTY) {
    displayPage(files, options, options.page, commitEmojiMap);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(files.length / options.pageSize));

  for (let page = 1; page <= totalPages; page += 1) {
    const hasNextPage = displayPage(files, options, page, commitEmojiMap);

    while (true) {
      const action = waitForNextAction(files, options, hasNextPage);

      if (action === "quit") {
        return;
      }

      if (action === "next") {
        break;
      }
    }
  }
}

let options;

try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`Error: ${error.message}`);
  printUsage();
  process.exit(1);
}

if (options.help) {
  printUsage();
  process.exit(0);
}

try {
  const files = getLastChangedFiles(options.repoPath, options.extensions, options.paths, options.limit);

  if (files.length === 0) {
    console.error(`Error: no files found in ${options.repoPath}${describeFilters(options)}`);
    process.exit(1);
  }

  displayFiles(files, options);
} catch (error) {
  const details = error.stderr ? error.stderr.toString().trim() : error.message;
  console.error(`Error: unable to read changed files from ${options.repoPath}`);

  if (details) {
    console.error(details);
  }

  process.exit(1);
}
