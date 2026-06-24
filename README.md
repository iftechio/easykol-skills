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
easykol login    # opens the browser, reuses your EasyKOL session
easykol doctor   # checks config
easykol quota    # shows remaining credits
```

## Repository layout

```
.claude-plugin/marketplace.json   # Claude Code plugin marketplace registration
plugins/easykol/                  # plugin package (plugin.json + skill symlink)
skills/easykol/SKILL.md           # the skill the agent reads
skills/easykol/references/        # detailed parameter / quota / error references
evals/                            # eval suite (TBD)
```

## Status

Early scaffold (v0.1.0). The CLI (`@easykol/cli`) and backend `/api/skills/` routes
are in progress; see the EasyKOL skills roadmap.

## License

MIT
