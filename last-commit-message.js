#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const COMMIT_BATCH_SIZE = 200;
const RESET = "\u001b[0m";
const DIM = "\u001b[2m";
const EXTENSION_COLORS = [
  "\u001b[36m",
  "\u001b[32m",
  "\u001b[35m",
  "\u001b[33m",
  "\u001b[34m",
  "\u001b[96m",
  "\u001b[92m",
  "\u001b[95m",
  "\u001b[93m",
];

function printUsage() {
  console.log("Usage: node last-commit-message.js [--limit <count>] [--page <number>] [--page-size <count>] [--links <plain|path|file|vscode|cursor|visualstudio>] [--ext <extensions>] [--path <path>] [repo-path]");
  console.log("Example: node last-commit-message.js --page 2 --page-size 20 --links cursor --path environments/prod --ext xaml,cs,js /path/to/repo");
}

function parseArgs(args) {
  const options = {
    extensions: [],
    limit: 100,
    linkMode: "path",
    page: 1,
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
        if (seen.has(file)) {
          continue;
        }

        seen.add(file);
        files.push(file);

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

function formatRow(file, repoPath, linkMode, rowNumber, width) {
  const color = colorForExtension(file);
  const number = `${String(rowNumber).padStart(width, " ")}.`;

  return `${DIM}${number}${RESET} ${color}${formatFile(file, repoPath, linkMode)}${RESET}`;
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
  let hash = 0;

  for (const char of extension) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return EXTENSION_COLORS[hash % EXTENSION_COLORS.length];
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

  const pageStart = (options.page - 1) * options.pageSize;
  const pageFiles = files.slice(pageStart, pageStart + options.pageSize);
  const totalPages = Math.max(1, Math.ceil(files.length / options.pageSize));

  if (pageFiles.length === 0) {
    console.error(`Error: page ${options.page} is out of range. ${files.length} files found, ${totalPages} pages available.`);
    process.exit(1);
  }

  const firstRowNumber = pageStart + 1;
  const rowNumberWidth = String(Math.min(files.length, pageStart + pageFiles.length)).length;

  console.log(`${DIM}Showing ${firstRowNumber}-${pageStart + pageFiles.length} of ${files.length} changed files. Page ${options.page}/${totalPages}.${RESET}`);

  for (let index = 0; index < pageFiles.length; index += 1) {
    console.log(formatRow(pageFiles[index], options.repoPath, options.linkMode, firstRowNumber + index, rowNumberWidth));
  }
} catch (error) {
  const details = error.stderr ? error.stderr.toString().trim() : error.message;
  console.error(`Error: unable to read changed files from ${options.repoPath}`);

  if (details) {
    console.error(details);
  }

  process.exit(1);
}
