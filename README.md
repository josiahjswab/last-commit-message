# Last Changed Files

A tiny Node.js script that prints the most recent distinct files changed in Git history. By default it scans the last 100 changed files and shows them 20 at a time as numbered, color-coded, clickable file links.

## Usage

```bash
node last-commit-message.js
node last-commit-message.js /path/to/repo
node last-commit-message.js --limit 50 /path/to/repo
node last-commit-message.js --page 2 /path/to/repo
node last-commit-message.js --page-size 10 /path/to/repo
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

## Install PowerShell Function

From this repo, run:

```powershell
.\install-changed.ps1
```

This adds a `changed` function to your current user's PowerShell profile. Restart PowerShell or reload the profile:

```powershell
. $PROFILE
```

Then run this from inside any Git repo:

```powershell
changed
changed --page 2
changed --ext xaml,cs
changed --path App/WinBidPro.UI.Main --ext xaml,cs
```

The installer is safe to run again; it replaces its own profile block instead of adding duplicates.

By default it uses `--links path`, which works well inside Cursor or VS Code terminals without external-protocol prompts. To default to Cursor protocol links instead:

```powershell
.\install-changed.ps1 -Links cursor
```

## Behavior

The script walks Git history newest-first in small commit batches and returns the first distinct file paths it sees:

```bash
git -C <repo-path> log --format=%H --diff-filter=ACMRT --max-count=200 --skip=<offset>
git -C <repo-path> diff-tree --root --no-commit-id --name-only -r -m --diff-filter=ACMRT <commit>
```

Deleted files are skipped because clickable editor links are only useful for files that still exist.

## Pagination

The script scans up to `--limit` files, then displays one page. Defaults:

```bash
--limit 100
--page 1
--page-size 20
```

In an interactive terminal, the script shows one page and waits for Enter before showing the next page. Type `q` then Enter to stop early.

Use `--page` to show a specific page without prompting:

```bash
node last-commit-message.js --page 2 /path/to/repo
node last-commit-message.js --page 3 --page-size 10 /path/to/repo
```

When output is piped or redirected, the script prints only the selected page and does not prompt.

Rows are numbered by their position in the full result set, and lines are colored by file extension using a stable convention. For example, XAML is bright green, C# is cyan, TypeScript is blue, JavaScript is yellow, and markup files are magenta.

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
