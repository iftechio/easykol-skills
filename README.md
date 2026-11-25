# EasyKOL Skills

Agent skill for **EasyKOL** — KOL / creator discovery, analysis, and outreach across
**YouTube, TikTok, and Instagram**. Designed for agentic coding environments
(Claude Code, Cursor, Codex). The agent reads `SKILL.md`, calls the API with the Skill's bundled script,
and reports results — the user just describes what they want.

## Install

### Claude Code

```bash
npx skills add https://github.com/iftechio/easykol-skills --skill easykol --agent claude-code
```

### Codex

```bash
npx skills add https://github.com/iftechio/easykol-skills --skill easykol --agent codex
```

### Cursor

```bash
npx skills add https://github.com/iftechio/easykol-skills --skill easykol --agent cursor
```

### Claude Code plugin marketplace

```bash
claude plugin marketplace add https://github.com/iftechio/easykol-skills
claude plugin install easykol@easykol
```

## Runtime and credentials

Install the Skill only. It includes `skills/easykol/scripts/api.cjs`, a self-contained
API transport requiring Node.js 18.3+. No global `easykol` command, package installation,
npm publication or npm login is needed to use it. Existing `~/.easykol/config.json`
credentials and saved search requests are reused.

After installation, ask your agent to read the installed `SKILL.md`, configure your
API key via stdin and your bound email, then run its bundled `doctor` and `quota`
operations. Never put a real key in a command argument or a shared prompt.

Update the Skill from the same GitHub source to receive both instructions and the
bundled script. The separate `cli/` package remains available for optional manual use;
the Skill does not install or depend on it. An npm release may lag this repository.
Use the bundled script for the capabilities documented in this Skill.

## Repository layout

```
.claude-plugin/marketplace.json   # Claude Code plugin marketplace registration
plugins/easykol/                  # plugin package (plugin.json + skill symlink)
skills/easykol/SKILL.md           # the skill the agent reads
skills/easykol/references/        # detailed parameter / quota / error references
skills/easykol/scripts/api.cjs    # bundled, dependency-free API transport
cli/                              # shared source, optional standalone package
evals/                            # eval suite (TBD)
```

## Capabilities and development

Search supports fast, standard, beta, tag and keyword modes, free stored-page
reads and serial continuation. Current batch targets are 40 for fast or historical
tag/keyword, and 30 for standard, beta or realtime tag/keyword. Use the live quote
for the current request. The bundled transport preserves quote-based budgets, stable
idempotency keys and request journals. Email templates, connected senders,
follow-ups and results use `/external/v1/email`; sending requires authorization,
and uncertain sends are never retried automatically. The Skill also operates the
EasyKOL web workflow for personalized bulk sends, send-plan tracking, read/reply
statistics, inbox and mailbox authorization. See the [email workflow guide](skills/easykol/references/email-web.md).
API authentication uses `ek-api-key` and `ek-api-email`.

The bundled script is generated from shared API source in `cli/src/`; its standalone
entry excludes npm installation and upgrade commands. After changing that source:

```bash
cd cli
npm ci
npm run build:skill
npm run typecheck
npm run test:skill
```

Commit the regenerated `skills/easykol/scripts/api.cjs` with source changes. Users
installing only the Skill do not need these development dependencies.

## License

MIT
