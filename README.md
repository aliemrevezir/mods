# mods

My [Claude Code](https://claude.com/claude-code) mods, published as one plugin marketplace.

Add the marketplace once from inside Claude Code:

```
/plugin marketplace add aliemrevezir/mods
```

then install any mod from it:

| Mod | What it does | Install |
| --- | --- | --- |
| [prompt-dock](plugins/prompt-dock) | A rail of your prompts above the input (hover to preview, click to jump), a dock beside the transcript, and quote-reply from any selected text. Built on top of [@oikon48](https://github.com/oikon48)'s [prompt-rail](https://github.com/oikon48/prompt-rail), plus quote-reply. | `/plugin install prompt-dock@aliemrevezir-mods` |
| [project-hop](plugins/project-hop) | Start Claude in a folder of projects, browse them above the prompt, then open a new session or continue a recent one without leaving the terminal. | `/plugin install project-hop@aliemrevezir-mods` |

Each mod lives in `plugins/<name>` with its own README and tests.

## License

[MIT](LICENSE)
