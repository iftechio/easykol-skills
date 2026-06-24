# EasyKOL Skills

Agent skill for **EasyKOL** — KOL / creator discovery, analysis, and outreach across
**YouTube, TikTok, and Instagram**. Designed for agentic coding environments
(Claude Code, Cursor, Codex). The agent reads `SKILL.md`, drives the `easykol` CLI,
and reports results — the user just describes what they want.

## Install

### Claude Code

```bash
npx skills add https://github.com/iftechio/easykol-skills --skill easykol --agent claude-code
```

### Cursor / Codex

```bash
npx skills add https://github.com/iftechio/easykol-skills --skill easykol --agent cursor
```

### Claude Code plugin marketplace

```bash
claude plugin marketplace add https://github.com/iftechio/easykol-skills
claude plugin install easykol@easykol
```

## Install the CLI

```bash
npm install -g @easykol/cli@latest
easykol schema --all   # verify the command tree
```

## Log in & verify

```bash
# v0.1.0 uses a key + email pair (no browser login yet)
printf '%s' "<API_KEY>" | easykol auth --key-stdin --email you@example.com
easykol doctor   # checks config + connectivity
easykol quota    # remaining credits (backend endpoint pending)
```

## Repository layout

```
.claude-plugin/marketplace.json   # Claude Code plugin marketplace registration
plugins/easykol/                  # plugin package (plugin.json + skill symlink)
skills/easykol/SKILL.md           # the skill the agent reads
skills/easykol/references/        # detailed parameter / quota / error references
cli/                              # @easykol/cli — the CLI the skill drives
evals/                            # eval suite (TBD)
```

## Status

v0.1.0 — core discovery loop. The CLI (`cli/`, `@easykol/cli`) wraps the backend's
existing `/external/v1/intelligent-search` endpoints (`parse` / `more-words` / `search`).
Auth is `ek-api-key` + `ek-api-email`. Profile / lookalikes / contacts commands and a
`quota` endpoint are on the roadmap — see `skills/easykol/SKILL.md`.

## License

MIT
