#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const path = require("node:path");

function printUsage() {
  console.log("Usage: node last-commit-message.js [--ext <extensions>] [--path <path>] [repo-path]");
  console.log("Example: node last-commit-message.js --path environments/prod --ext xaml,cs,js /path/to/repo");
}

function parseArgs(args) {
  const options = {
    extensions: [],
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

function getLastCommitMessage(repoPath, extensions, paths) {
  const args = ["-C", repoPath, "log", "-1", "--pretty=%B"];
  const pathspecs = buildPathspecs(extensions, paths);

  if (pathspecs.length > 0) {
    args.push("--", ...pathspecs);
  }

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
  const message = getLastCommitMessage(options.repoPath, options.extensions, options.paths);

  if (!message) {
    const filters = [];

    if (options.paths.length > 0) {
      filters.push(`paths: ${options.paths.join(", ")}`);
    }

    if (options.extensions.length > 0) {
      filters.push(`extensions: ${options.extensions.join(", ")}`);
    }

    const filter = filters.length > 0 ? ` for ${filters.join("; ")}` : "";
    console.error(`Error: no commits found in ${options.repoPath}${filter}`);
    process.exit(1);
  }

  console.log(message);
} catch (error) {
  const details = error.stderr ? error.stderr.toString().trim() : error.message;
  console.error(`Error: unable to read last commit message from ${options.repoPath}`);

  if (details) {
    console.error(details);
  }

  process.exit(1);
}
