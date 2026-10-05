# prompt-dock

A [Claude Code](https://claude.com/claude-code) mod that keeps every prompt you sent one click away, and lets you reply to any piece of the conversation by quoting it.

Built on top of [oikon48/prompt-rail](https://github.com/oikon48/prompt-rail): the same rail and dock, extended with quote-reply.

## What it does

**Rail (default).** A thin rail sits above the input, one tick per prompt. The thick tick is the prompt you are looking at in the transcript.

```
#5 Compare debounce and throttle as a short list.     ↩ Reply  [–]
││││┃
```

- Hover a tick to preview that prompt in the line above it.
- Click a tick to scroll the transcript to that prompt.
- `[–]` moves the list into the dock.

**Dock.** A narrow column beside the transcript, one line per prompt, the current one marked with `━`.

```
5 prompts                ↩ ×
─ Explain what a deb…
━ Write a TypeScript…
─ Add a leading-edge…
─ Write three vitest…
─ Compare debounce a…
```

- Click a row to jump to it.
- `×` sends the list back to the rail.

**Reply.** Select any text with the mouse (an answer, a code line, an earlier prompt), then press `↩ Reply`. The selection lands at the top of your prompt as a Markdown quote, with whatever you had already typed kept below it:

```
> Debounce waits for silence; throttle enforces a minimum time between executions.

Show me both in one example.
```

## Commands

| Command    | What it does                                                  |
| ---------- | ------------------------------------------------------------- |
| `/prompts` | Move the list between the rail and the dock                   |
| `/reply`   | Quote the current selection at the top of the prompt         |

## Install

From inside Claude Code:

```
/plugin marketplace add aliemrevezir/mods
/plugin install prompt-dock@aliemrevezir-mods
```

Or load it straight from a clone:

```sh
git clone https://github.com/aliemrevezir/mods
claude --plugin-dir mods/plugins/prompt-dock
```

To load it in every session without the flag, set `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json` to that folder.

## Requirements

- A Claude Code build with mods (plugin hook modules).
- The fullscreen layout for the "where you are" tick and for reading the selection. On the main-screen layout the rail still works, and the thick tick follows your last jump or newest prompt.
- If the terminal has already cleared the highlight, Reply falls back to the clipboard text: `pbpaste` on macOS, `wl-paste` or `xclip` on Linux.

## Credits

- prompt-dock builds on **[prompt-rail](https://github.com/oikon48/prompt-rail)** by **Oikon** ([GitHub @oikon48](https://github.com/oikon48), [X @oikon48](https://x.com/oikon48)). The rail, the hover preview, click-to-jump and the vertical dock are their design; prompt-dock reimplements it and adds quote-reply. If you only want the rail, use the original: `/plugin marketplace add oikon48/prompt-rail`.
- Found through the HQ NET video [CLAUDE'UN MODS ÖZELLİĞİ MUHTEŞEM](https://youtu.be/nCzV2Qbg8BI?t=248), which tours community mods.
- The community thread of mods started under the [ClaudeDevs announcement](https://x.com/ClaudeDevs/status/2105721434807083061).

## Development

```sh
claude plugin validate .
claude plugin test .
```

The pure logic (pairing prompts with transcript rows, picking the current prompt, the quote format) lives in `hooks/rail.ts` and `hooks/exchanges.ts`; drawing and events live in `hooks/register.tsx`.

## License

[MIT](../../LICENSE)
