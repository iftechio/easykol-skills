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

## Keep current

The skill instructs agents to refresh on every session start via `easykol upgrade`
(CLI + `npx skills update easykol -y`). You can also run manually:

```bash
easykol upgrade
# or
npm install -g @easykol/cli@latest
npx --yes skills update easykol -y
```

## Log in & verify

```bash
# key + email pair (no browser login yet)
printf '%s' "<API_KEY>" | easykol auth --key-stdin --email you@example.com
easykol doctor   # checks config + connectivity
easykol quota    # remaining credits
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

v0.1.1 — discovery, profile, audience, lookalike, contact, and video commands are
available. The CLI (`cli/`, `@easykol/cli`) wraps the backend's `/external/v1` endpoints.
Search has a rolling session budget (default 50) and `--limit` soft-cap 30; exceeding
either needs user-approved `--confirm-spend` (exit code 8). The Skill must preflight
hard requirements, enforce budget control, and must not claim unsupported audience or
TikTok Shop metrics are verified. Auth is `ek-api-key` + `ek-api-email`.

## License

MIT
