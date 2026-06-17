# Last Changed Files

A tiny Node.js script that prints the most recent distinct files changed in Git history. By default it returns the last 100 files and prints absolute paths that many terminals can open as clickable file links.

## Usage

```bash
node last-commit-message.js
node last-commit-message.js /path/to/repo
node last-commit-message.js --limit 50 /path/to/repo
node last-commit-message.js --ext xaml,cs,js,ts /path/to/repo
node last-commit-message.js --path environments/prod --ext ts /path/to/repo
node last-commit-message.js --links vscode --path environments/prod --ext ts /path/to/repo
node last-commit-message.js --links cursor --path environments/prod --ext ts /path/to/repo
node last-commit-message.js --links visualstudio --path environments/prod --ext ts /path/to/repo
```

Use `--help` to print the usage line:

```bash
node last-commit-message.js --help
```

## Requirements

- Node.js
- Git available on your `PATH`

## Behavior

The script walks Git history newest-first and returns the first distinct file paths it sees:

```bash
git -C <repo-path> log --name-only --pretty=format: --diff-filter=ACMRT
```

Deleted files are skipped because clickable editor links are only useful for files that still exist.

## Filters

Use `--ext` or `--extension` to limit file endings:

```bash
node last-commit-message.js --ext xaml,cs,js,ts /path/to/repo
```

Use `--path` or `--scope` to limit the search to a folder inside the repo:

```bash
node last-commit-message.js --path environments/prod /path/to/repo
```

Combine both:

```bash
node last-commit-message.js --path environments/prod --ext ts,cs /path/to/repo
```

## Link Modes

Use `--links` to control how files print:

```bash
node last-commit-message.js --links plain /path/to/repo
node last-commit-message.js --links path /path/to/repo
node last-commit-message.js --links file /path/to/repo
node last-commit-message.js --links vscode /path/to/repo
node last-commit-message.js --links cursor /path/to/repo
node last-commit-message.js --links visualstudio /path/to/repo
```

`vscode` and `cursor` use terminal hyperlinks that target `vscode://file/...` or `cursor://file/...`.
`visualstudio` prints absolute paths, which Visual Studio and many terminals can detect as clickable file links.

If the path is not a Git repo, or no matching files are found, it exits with an error message.
