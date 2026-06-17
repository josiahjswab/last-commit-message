# Last Commit Message

A tiny Node.js script that prints the most recent Git commit message for the current directory, or for a repo path you provide.

## Usage

```bash
node last-commit-message.js
node last-commit-message.js /path/to/repo
node last-commit-message.js --ext js
node last-commit-message.js --ext xaml,cs,js,ts /path/to/repo
```

Use `--help` to print the usage line:

```bash
node last-commit-message.js --help
```

## Requirements

- Node.js
- Git available on your `PATH`

## Behavior

The script runs:

```bash
git -C <repo-path> log -1 --pretty=%B
```

When `--ext` or `--extension` is provided, it limits the search to commits that touched matching file endings:

```bash
git -C <repo-path> log -1 --pretty=%B -- '*.js'
```

If the path is not a Git repo, or the repo has no commits, it exits with an error message.
