#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function printUsage() {
  console.log("Usage: node last-commit-message.js [--limit <count>] [--links <plain|path|file|vscode|cursor|visualstudio>] [--ext <extensions>] [--path <path>] [repo-path]");
  console.log("Example: node last-commit-message.js --limit 100 --links cursor --path environments/prod --ext xaml,cs,js /path/to/repo");
}

function parseArgs(args) {
  const options = {
    extensions: [],
    limit: 100,
    linkMode: "path",
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
  const limit = Number.parseInt(value, 10);

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`Invalid limit: ${value}`);
  }

  return limit;
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

function getLastTouchedFiles(repoPath, extensions, paths, limit) {
  const pathspecs = buildPathspecs(extensions, paths);
  const args = ["-C", repoPath, "log", "--name-only", "--pretty=format:", "--diff-filter=ACMRT"];

  if (pathspecs.length > 0) {
    args.push("--", ...pathspecs);
  }

  const files = [];
  const seen = new Set();
  const output = runGit(args);

  for (const line of output.split(/\r?\n/)) {
    const file = line.trim();

    if (!file || seen.has(file)) {
      continue;
    }

    seen.add(file);
    files.push(file);

    if (files.length >= limit) {
      break;
    }
  }

  return files;
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
  const files = getLastTouchedFiles(options.repoPath, options.extensions, options.paths, options.limit);

  if (files.length === 0) {
    console.error(`Error: no files found in ${options.repoPath}${describeFilters(options)}`);
    process.exit(1);
  }

  for (const file of files) {
    console.log(formatFile(file, options.repoPath, options.linkMode));
  }
} catch (error) {
  const details = error.stderr ? error.stderr.toString().trim() : error.message;
  console.error(`Error: unable to read touched files from ${options.repoPath}`);

  if (details) {
    console.error(details);
  }

  process.exit(1);
}
