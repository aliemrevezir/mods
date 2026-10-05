import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { HopView, Project } from '../types'
import {
  GIT_SCRIPT,
  PROJECTS_SCRIPT,
  SESSIONS_SCRIPT,
  clip,
  encodeProjectDir,
  filterProjects,
  looksLikeRoot,
  matchProject,
  matchSession,
  parentOf,
  paginate,
  parseGit,
  parseProjects,
  parseSessions,
  spinnerFrame,
  timeAgo,
  withGit,
} from './scan'

const HIDDEN: HopView = { kind: 'hidden' }
const view = atom({ plugin: 'project-hop', key: 'view' } as const, HIDDEN)

const SESSION_LIMIT = 40
// Focus stops drawn above and below a page: the arrows reaching one turn the page.
const EDGE_UP = 'page-up'
const EDGE_DOWN = 'page-down'
// Rows per page as last drawn, so a page turned by the arrows knows where to land.
let pageSize = 8

const scanProjects = async ($: EngineInterface, root: string): Promise<Project[]> => {
  const { stdout } = await $.process.run(['sh', '-c', PROJECTS_SCRIPT, 'sh', root])
  return parseProjects(root.replace(/\/+$/, ''), stdout)
}

// Scans still running, by what the band says about them; a spinner turns while any is.
// The module's own: a reload starts with none, and the scans it starts again fill it.
const jobs = new Map<string, string>()
let tick = 0
let spin: Timer | undefined

const busy = async <T,>($: EngineInterface, job: string, label: string, work: () => Promise<T>): Promise<T> => {
  jobs.set(job, label)
  spin ??= $.clock.every(100, () => {
    tick += 1
    $.ui.invalidate('ui.render')
  })
  $.ui.invalidate('ui.render')
  try {
    return await work()
  } finally {
    jobs.delete(job)
    if (jobs.size === 0) {
      spin?.cancel()
      spin = undefined
    }
    $.ui.invalidate('ui.render')
  }
}

// The branch and dirty mark come after the list is up, so a large repository never holds the band back.
const scanGit = ($: EngineInterface, root: string) =>
  busy($, 'git', 'git', async () => {
    const { stdout } = await $.process.run(['sh', '-c', GIT_SCRIPT, 'sh', root])
    const git = parseGit(stdout)
    await update($, view, (v): HopView => (v.kind === 'projects' && v.root === root ? { ...v, projects: withGit(v.projects, git) } : v))
  })

const showProjects = async ($: EngineInterface, root: string, projects?: Project[]) => {
  const list = projects ?? (await busy($, 'scan', 'projeler taranıyor', () => scanProjects($, root)))
  await update($, view, (): HopView => ({ kind: 'projects', root, projects: list, filter: '', page: 0 }))
  if (list.some(p => p.isRepo)) later($, () => scanGit($, root))
}

const openProject = async ($: EngineInterface, root: string, project: Project) => {
  const { stdout } = await busy($, 'scan', `${project.name} session'ları okunuyor`, () =>
    $.process.run(['sh', '-c', SESSIONS_SCRIPT, 'sh', encodeProjectDir(project.path), String(SESSION_LIMIT * 2)]))
  const sessions = parseSessions(stdout).slice(0, SESSION_LIMIT)
  await update($, view, (): HopView => ({ kind: 'sessions', root, project, sessions, page: 0 }))
}

const gitLabel = (git: Project['git']): string => (git ? `⎇ ${clip(git.branch, 14)}${git.dirty ? ' ●' : ''}` : '')

// The band only scrolls by wheel in the fullscreen layout, so the lists page instead.
const turnPage = ($: EngineInterface, by: number) =>
  update($, view, (v): HopView => (v.kind === 'hidden' ? v : { ...v, page: (v.page || 0) + by }))

const quote = (path: string) => (/\s/.test(path) ? `"${path}"` : path)

// Moves this session into the project, then starts fresh there or picks a saved conversation back up.
const hop = async ($: EngineInterface, project: Project, resumeId?: string) => {
  await update($, view, () => HIDDEN)
  $.ui.status(undefined)
  await $.command.run({ command: 'cd', args: quote(project.path) })
  if (resumeId !== undefined) {
    await $.command.run({ command: 'resume', args: resumeId })
  } else if ((await $.session.turns()) > 0) {
    await $.command.run({ command: 'clear' })
  }
}

// prompt.submit holds the turn, so the commands run once it has let go.
const later = ($: EngineInterface, fn: () => Promise<void>) => {
  $.clock.after(0, () => {
    fn().catch(error => $.ui.toast(`project-hop: ${String(error)}`))
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'projects',
      description: 'Browse project folders and open a new or recent session',
      argumentHint: '[folder]',
    })
    const shown = await read($, view)
    if (shown.kind !== 'hidden') {
      // A reload keeps the band's state but not how it was gathered: scan again.
      later($, () => (shown.kind === 'sessions' ? openProject($, shown.root, shown.project) : showProjects($, shown.root)))
    } else if (e.isInteractive) {
      later($, async () => {
        const projects = await scanProjects($, e.cwd)
        if (looksLikeRoot(projects, (await $.session.repo()) !== null)) await showProjects($, e.cwd, projects)
      })
    }
    return result
  })

  on('command.run', { command: 'projects' }, async ($, e) => {
    let root = e.args.trim()
    if (root === '') {
      const cwd = await $.session.cwd()
      const here = await scanProjects($, cwd)
      root = looksLikeRoot(here, (await $.session.repo()) !== null) ? cwd : parentOf(await $.session.root())
    }
    await showProjects($, root)
    return { text: root }
  })

  // A number or a project's name typed while the band shows picks instead of reaching the model.
  on('prompt.submit', async ($, e, next) => {
    const current = await read($, view)
    if (current.kind === 'projects') {
      const pick = matchProject(e.text, current.projects)
      if (pick.kind === 'project') {
        later($, () => openProject($, current.root, pick.project))
        return { drop: `project-hop: ${pick.project.name}` }
      }
      if (pick.kind === 'filter') {
        await update($, view, (): HopView => ({ ...current, filter: pick.filter, page: 0 }))
        return { drop: `project-hop: "${pick.filter}" ile süzüldü` }
      }
    }
    if (current.kind === 'sessions') {
      const pick = matchSession(e.text, current.sessions)
      if (pick.kind === 'back') {
        later($, () => showProjects($, current.root, undefined))
        return { drop: 'project-hop: projeler' }
      }
      if (pick.kind === 'new') {
        later($, () => hop($, current.project))
        return { drop: `project-hop: ${current.project.name} · yeni session` }
      }
      if (pick.kind === 'resume') {
        later($, () => hop($, current.project, pick.id))
        return { drop: `project-hop: ${current.project.name} · devam` }
      }
    }
    return next(e)
  })

  // Arrowing past a page's first or last row lands on an edge stop: turn the page and
  // put the ring on the row that comes next, so the arrows walk the whole list.
  on('ui.focus', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.origin.kind !== 'person' || (e.element !== EDGE_UP && e.element !== EDGE_DOWN)) return next(e)
    const current = await read($, view)
    if (current.kind === 'hidden') return next(e)
    const by = e.element === EDGE_DOWN ? 1 : -1
    const total = current.kind === 'projects' ? filterProjects(current.projects, current.filter).length : current.sessions.length
    const at = paginate(Array.from({ length: total }), pageSize, current.page).at + by
    const index = Math.min(total - 1, by > 0 ? at * pageSize : at * pageSize + pageSize - 1)
    const key = `${current.kind === 'projects' ? 'project' : 'session'}-${index}`
    await update($, view, (v): HopView => (v.kind === 'hidden' ? v : { ...v, page: at }))
    later($, async () => {
      await $.ui.focus({ requestId: e.requestId, key })
    })
    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, view)
    if (e.props.hasSurvey || e.props.isWorking) return next(e)
    const scanning = jobs.get('scan')
    const { Box, Button, Text } = $.ui.resolve(e)
    const spinner = (label: string | undefined) =>
      label === undefined ? null : <Text key="spinner" color="cyan">{spinnerFrame(tick)} {label}…  </Text>
    if (current.kind === 'hidden') return scanning === undefined ? next(e) : <Box>{spinner(scanning)}</Box>

    const now = await $.clock.now()
    const width = e.props.bodyColumns
    const close = <Button key="close" label="× kapat" hotkey="x" onPress={() => update($, view, () => HIDDEN)} />
    // Header, footer and the two edge stops take a row each; the rest is the page.
    const pageRows = Math.max(3, e.props.maxRows - 4)
    pageSize = pageRows
    const edge = (key: string, label: string, by: number, shown: boolean) =>
      shown ? <Button key={key} label={label} plain dimColor onPress={() => turnPage($, by)} /> : null
    const pager = (at: number, pages: number) =>
      pages > 1 ? (
        <Box key="pager">
          <Button key="prev" label="▲" hotkey="k" onPress={() => turnPage($, -1)} />
          <Text dimColor> {at + 1}/{pages} </Text>
          <Button key="next" label="▼" hotkey="j" onPress={() => turnPage($, 1)} />
          <Text>  </Text>
        </Box>
      ) : null

    if (current.kind === 'projects') {
      const shown = filterProjects(current.projects, current.filter)
      const page = paginate(shown, pageRows, current.page)
      const nameWidth = Math.max(12, Math.min(32, width - 48))
      const gitWidth = shown.some(p => p.git) ? 20 : 0

      return (
        <Box flexDirection="column">
          <Box>
            <Text bold>▸ {clip(current.root, Math.max(10, width - 50))}</Text>
            <Text dimColor>
              {'  '}
              {shown.length}/{current.projects.length} proje{current.filter ? ` · "${current.filter}"` : ''}{'  '}
            </Text>
            {spinner(scanning ?? (jobs.has('git') ? 'git' : undefined))}
            {pager(page.at, page.pages)}
            {current.filter ? (
              <Button key="unfilter" label="süzgeci kaldır" onPress={() => update($, view, (): HopView => ({ ...current, filter: '', page: 0 }))} />
            ) : null}
            {close}
          </Box>
          {edge(EDGE_UP, '  ▲ önceki sayfa', -1, page.at > 0)}
          {page.rows.map((project, r) => {
            const index = page.start + r
            const sessions = project.sessions > 0 ? ` · ${project.sessions} session` : ''
            return (
              <Button
                key={`project-${index}`}
                label={`📁 ${clip(project.name, nameWidth).padEnd(nameWidth)}  ${gitLabel(project.git).padEnd(gitWidth)}${timeAgo(project.lastActive, now)}${sessions}`}
                plain
                dimColor={project.sessions === 0}
                autoFocus={r === 0 ? true : undefined}
                onPress={() => openProject($, current.root, project)}
              />
            )
          })}
          {edge(EDGE_DOWN, '  ▼ sonraki sayfa', 1, page.at < page.pages - 1)}
          <Text dimColor>ctrl+x tab → ↑↓ gez, Enter aç · ya da adını yaz + Enter</Text>
        </Box>
      )
    }

    const page = paginate(current.sessions, pageRows, current.page)
    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>▸ {current.project.name}</Text>
          {current.project.git ? <Text color="green">  {gitLabel(current.project.git)}</Text> : null}
          <Text dimColor>  {current.project.sessions} session  </Text>
          {spinner(scanning)}
          {pager(page.at, page.pages)}
          <Button key="new" label="n yeni" hotkey="n" variant="primary" onPress={() => hop($, current.project)} />
          <Text> </Text>
          <Button key="back" label="b geri" hotkey="b" onPress={() => showProjects($, current.root, undefined)} />
          <Text> </Text>
          {close}
        </Box>
        {current.sessions.length === 0 ? <Text dimColor>  Bu projede kayıtlı session yok, n ile yenisini aç.</Text> : null}
        {edge(EDGE_UP, '  ▲ önceki sayfa', -1, page.at > 0)}
        {page.rows.map((session, r) => {
          const i = page.start + r
          return (
            <Button
              key={`session-${i}`}
              label={`${String(i + 1).padStart(2)}  ${timeAgo(session.mtime, now).padEnd(7)} ${clip(session.title, Math.max(20, width - 16))}`}
              plain
              autoFocus={r === 0 ? true : undefined}
              onPress={() => hop($, current.project, session.id)}
            />
          )
        })}
        {edge(EDGE_DOWN, '  ▼ sonraki sayfa', 1, page.at < page.pages - 1)}
        <Text dimColor>↑↓ gez, Enter devam · numara = devam · c = en sonuncusu · n = yeni · b = geri</Text>
      </Box>
    )
  })
}
