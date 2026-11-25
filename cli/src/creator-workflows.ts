import type { CommandDef, OptionDef } from './commands'
import { apiRequest, emit, EXIT, fail, required } from './core'

const projectId = { flags: '--project-id <id>', description: 'EasyKOL project ID (required)' }
const taskId = { flags: '--task-id <id>', description: 'ID returned when the task was created (required)' }
const page: OptionDef[] = [
  { flags: '--limit <n>', description: 'page size, 1–100 (default 20)' },
  { flags: '--cursor <cursor>', description: 'nextCursor from the previous page' },
]
const title = { flags: '--title <text>', description: 'project title (required)' }
const url = { flags: '--url <url>', description: 'direct creator profile URL (required)' }
const pathId = (value: string | undefined, name: string) => encodeURIComponent(required(value, name))
const projectPath = (opts: Record<string, any>) => `/favorites/${pathId(opts.projectId, '--project-id')}`

function workflow(command: Omit<CommandDef, 'billing'>): CommandDef {
  return { ...command, billing: 'free (0 AI credits)' }
}

export const CREATOR_WORKFLOW_COMMANDS: CommandDef[] = [
  workflow({
    name: 'favorites-projects',
    summary: 'List your projects and find the project ID for a favorites action',
    options: page,
    async run({ limit, cursor }) {
      emit(await apiRequest({ path: '/favorites', query: { limit, cursor } }))
    },
  }),
  workflow({
    name: 'favorites-project',
    summary: 'Read a project by ID',
    options: [projectId],
    async run(opts) {
      emit(await apiRequest({ path: projectPath(opts) }))
    },
  }),
  workflow({
    name: 'favorites-create',
    summary: 'Create a project for favorites',
    options: [title, { flags: '--description <text>', description: 'optional project description' }],
    async run(opts) {
      emit(await apiRequest({ method: 'POST', path: '/favorites', body: {
        title: required(opts.title?.trim(), '--title'), description: opts.description,
      } }))
    },
  }),
  workflow({
    name: 'favorites-rename',
    summary: 'Rename one project',
    options: [projectId, title],
    async run(opts) {
      emit(await apiRequest({ method: 'PATCH', path: projectPath(opts), body: {
        title: required(opts.title?.trim(), '--title'),
      } }))
    },
  }),
  workflow({
    name: 'favorites-delete',
    summary: 'Delete a non-default project and remove it from your favorites project list',
    options: [projectId, { flags: '--confirm-delete', description: 'confirm the explicitly identified project deletion' }],
    async run(opts) {
      if (!opts.confirmDelete) fail(EXIT.PARAMS, 'Confirm the identified project with --confirm-delete')
      emit(await apiRequest({ method: 'DELETE', path: projectPath(opts) }))
    },
  }),
  workflow({
    name: 'favorites-list',
    summary: 'List the favorite creators in an owned project',
    options: [projectId, ...page,
      { flags: '--platform <name>', description: 'TIKTOK, YOUTUBE or INSTAGRAM' }],
    async run(opts) {
      const platform = opts.platform?.toUpperCase()
      if (platform && !['TIKTOK', 'YOUTUBE', 'INSTAGRAM'].includes(platform)) {
        fail(EXIT.PARAMS, '--platform must be TIKTOK, YOUTUBE or INSTAGRAM')
      }
      emit(await apiRequest({ path: `${projectPath(opts)}/creators`, query: {
        limit: opts.limit, cursor: opts.cursor, platform,
      } }))
    },
  }),
  ...(['add', 'remove'] as const).map((action) => workflow({
    name: `favorites-${action}`,
    summary: action === 'add' ? 'Save up to 100 existing creators to a project' : 'Remove up to 100 creators from a project’s favorites',
    options: [projectId, { flags: '--kol-ids <ids>', description: 'comma-separated stable EasyKOL creator IDs (required)' }],
    async run(opts) {
      const kolIds = [...new Set(required<string>(opts.kolIds, '--kol-ids').split(',').map(id => id.trim()).filter(Boolean))]
      if (!kolIds.length || kolIds.length > 100) fail(EXIT.PARAMS, 'Provide 1–100 EasyKOL creator IDs')
      emit(await apiRequest({ method: 'POST', path: `${projectPath(opts)}/creators`, body: { action, kolIds } }))
    },
  })),
  workflow({
    name: 'favorites-share',
    summary: 'Create, update or revoke a read-only favorites share',
    options: [
      projectId,
      { flags: '--scope <scope>', description: 'workspace, public, or off (required)' },
      { flags: '--expire-days <n>', description: '1–30 days (default 7)' },
    ],
    async run(opts) {
      const scope = required(opts.scope, '--scope')
      if (!['workspace', 'public', 'off'].includes(scope)) fail(EXIT.PARAMS, 'Use workspace, public, or off')
      const expireDays = opts.expireDays === undefined ? undefined : Number(opts.expireDays)
      if (expireDays !== undefined && (!Number.isInteger(expireDays) || expireDays < 1 || expireDays > 30)) {
        fail(EXIT.PARAMS, '--expire-days must be between 1 and 30')
      }
      emit(await apiRequest({ method: 'PUT', path: `${projectPath(opts)}/share`, body: { scope, expireDays } }))
    },
  }),
  workflow({
    name: 'favorites-shared',
    summary: 'Read a shared favorites snapshot using its share key',
    options: [
      { flags: '--share-key <key>', description: 'share key (required)' },
      { flags: '--limit <n>', description: 'page size, 1–100 (default 20)' },
      { flags: '--offset <n>', description: 'nextOffset returned by the previous page' },
    ],
    async run(opts) {
      emit(await apiRequest({
        path: `/favorites/shared/${pathId(opts.shareKey, '--share-key')}`,
        query: { limit: opts.limit, offset: opts.offset },
      }))
    },
  }),
  workflow({
    name: 'favorites-export',
    summary: 'Start the web’s personal favorites Excel export for one project',
    options: [
      projectId,
      { flags: '--days <n>', description: 'export range, 1, 7 or 30 days (required)' },
      { flags: '--lang <name>', description: 'en or zh (default en)' },
    ],
    async run(opts) {
      const recentDays = Number(required(opts.days, '--days'))
      if (![1, 7, 30].includes(recentDays)) fail(EXIT.PARAMS, '--days must be 1, 7 or 30')
      if (opts.lang && !['en', 'zh'].includes(opts.lang)) fail(EXIT.PARAMS, '--lang must be en or zh')
      emit(await apiRequest({ method: 'POST', path: `${projectPath(opts)}/exports`, body: {
        recentDays, lang: opts.lang,
      }, timeoutMs: 30_000 }))
    },
  }),
  workflow({
    name: 'favorites-export-result',
    summary: 'Read status or the download URL for an existing favorites export',
    options: [projectId, taskId],
    async run(opts) {
      emit(await apiRequest({ path: `${projectPath(opts)}/exports/${pathId(opts.taskId, '--task-id')}` }))
    },
  }),
  {
    name: 'fake-followers',
    summary: 'Start a standalone TikTok, Instagram or YouTube audience sample report',
    billing: '2 AI credits for a new report at the web rate; eligible reuse is free',
    options: [url],
    async run(opts) {
      emit(await apiRequest({ method: 'POST', path: '/fake-followers', body: {
        url: required(opts.url, '--url'),
      }, timeoutMs: 45_000 }))
    },
  },
  workflow({
    name: 'fake-followers-result',
    summary: 'Read an existing follower or commenter sample report by task ID',
    options: [taskId],
    async run(opts) {
      emit(await apiRequest({ path: `/fake-followers/${pathId(opts.taskId, '--task-id')}` }))
    },
  }),
]
