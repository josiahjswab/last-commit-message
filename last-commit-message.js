#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const path = require("node:path");

function printUsage() {
  console.log("Usage: node last-commit-message.js [repo-path]");
}

function getLastCommitMessage(repoPath) {
  return execFileSync("git", ["-C", repoPath, "log", "-1", "--pretty=%B"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const arg = process.argv[2];

if (arg === "-h" || arg === "--help") {
  printUsage();
  process.exit(0);
}

if (process.argv.length > 3) {
  console.error("Error: expected at most one repo path.");
  printUsage();
  process.exit(1);
}

const repoPath = path.resolve(arg || process.cwd());

try {
  const message = getLastCommitMessage(repoPath);

  if (!message) {
    console.error(`Error: no commits found in ${repoPath}`);
    process.exit(1);
  }

  console.log(message);
} catch (error) {
  const details = error.stderr ? error.stderr.toString().trim() : error.message;
  console.error(`Error: unable to read last commit message from ${repoPath}`);

  if (details) {
    console.error(details);
  }

  process.exit(1);
}
