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

v0.2.0 — `search --mode fast|standard|beta` defaults to fast and uses
`/external/v2/intelligent-search`. `parse --mode` returns preparation + quote;
`task` reads saved pages for free; `search-next` continues the exact completed task
serially. Stable idempotency keys and a local request journal recover uncertain
submissions without creating replacement paid tasks. Search budget uses server
quotes (default 50 raw quota = 5 task points); finalized refunds reconcile on reads.

`search-legacy` / `parse-legacy` explicitly retain the old synchronous V1 contract.
Other creator/profile/audience/email/video commands keep their existing V1 APIs.
Deploy the external V2 backend before publishing CLI 0.2.0 / refreshing the skill;
there is no silent V1 fallback. See `skills/easykol/references/search-modes.md`.
Auth remains `ek-api-key` + `ek-api-email`.

## License

MIT
