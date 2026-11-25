import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import './build-skill.mjs'

const result = spawnSync(process.execPath,
  ['--test', 'test/audience-tiers.test.mjs', 'test/email.test.mjs', 'test/search.test.mjs', 'test/skill.test.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, EASYKOL_TEST_ENTRY: fileURLToPath(new URL('../../skills/easykol/scripts/api.cjs', import.meta.url)) },
    stdio: 'inherit',
  })
process.exitCode = result.status ?? 1
