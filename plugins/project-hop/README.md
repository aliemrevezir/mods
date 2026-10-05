# project-hop

A [Claude Code](https://claude.com/claude-code) mod for when you keep all your projects under one folder. Start Claude in that folder, pick a project above the prompt, then open a new session there or continue a recent one, without leaving the terminal.

## What it does

**Projects.** When Claude starts in a folder that looks like a folder of projects, a band above the input lists its child folders as `📁` rows, newest activity first, with how many sessions each one has. Repositories also show their branch, and `●` when they have uncommitted changes (`⎇ main ●`), or `?` for a repository whose own config defines filters, where asking git for status could run them; that part fills in a moment later so a large repository never holds the list back.

- Press ctrl+x tab to give the band the keyboard, then ↑ ↓ to walk the folders and Enter to open one. Arrowing past the last row turns to the next page, past the first row to the previous one.
- Or type a project's name and press Enter; a name that matches several filters the list.
- `▲` / `▼` (`k` / `j`) also page through long lists; `x` closes the band.

**Sessions.** Opening a project shows its recent sessions by title or last prompt, with its branch in the header.

While a folder or a project's sessions are being read, a spinner turns in the band.

- ↑ ↓ and Enter continue a session, or type its number.
- `n` starts a new session in that project (`/cd` + `/clear`).
- `c` continues the most recent one, `b` goes back to the projects.

## Commands

| Command              | What it does                                                                 |
| -------------------- | ---------------------------------------------------------------------------- |
| `/projects [folder]` | Show the projects in `folder`; with no folder, here or the current project's parent |

## Install

From inside Claude Code:

```
/plugin marketplace add aliemrevezir/mods
/plugin install project-hop@aliemrevezir-mods
```

Or load it straight from a clone:

```sh
git clone https://github.com/aliemrevezir/mods
claude --plugin-dir mods/plugins/project-hop
```

## Requirements

- A Claude Code build with mods (plugin hook modules).
- A POSIX shell with `ls`, `stat`, `sed` and `grep`; sessions are read from `~/.claude/projects`.

## Development

```sh
claude plugin validate .
claude plugin test .
```

Folder and transcript scanning lives in `hooks/scan.ts`; the band, the picks and the hop itself live in `hooks/register.tsx`.

## License

[MIT](../../LICENSE)
