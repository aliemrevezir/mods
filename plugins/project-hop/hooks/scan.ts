import type { GitState, Project, SessionInfo } from '../types'

const FIELD = '\x1e'

// One line per child folder of $1: name, newest transcript's mtime, transcript count, has .git.
// Claude keeps a folder's transcripts under ~/.claude/projects/<path, every non-alphanumeric as ->.
export const PROJECTS_SCRIPT = `
base="$HOME/.claude/projects"
for d in "$1"/*/; do
  d="\${d%/}"; [ -d "$d" ] || continue
  enc=$(printf %s "$d" | sed 's/[^a-zA-Z0-9]/-/g')
  newest=$(ls -t "$base/$enc"/*.jsonl 2>/dev/null | head -1)
  t=0; [ -n "$newest" ] && t=$(stat -f %m "$newest" 2>/dev/null || stat -c %Y "$newest")
  c=$(ls "$base/$enc"/*.jsonl 2>/dev/null | wc -l | tr -d ' ')
  g=0; [ -e "$d/.git" ] && g=1
  printf '%s${FIELD}%s${FIELD}%s${FIELD}%s\\n' "$(basename "$d")" "$t" "$c" "$g"
done
`

// One line per repository child of $1: name, branch (short commit when detached), 1 when the tree has changes.
// Every repository is asked at once, since a large one's status can take a while.
// A cloned repository's own config can name commands status would run: core.fsmonitor is switched
// off from the command line, which outranks it; a repository where a filter or an external diff
// comes from anywhere but the person's system or global config (its .git/config, config.worktree,
// a file either includes) is not asked for status at all, and reports 2.
// Reading config runs nothing. --no-optional-locks keeps status from rewriting the index.
export const GIT_SCRIPT = `
for d in "$1"/*/; do
  d="\${d%/}"; [ -e "$d/.git" ] || continue
  (
    g() { git -C "$d" -c core.fsmonitor=false -c core.untrackedCache=false --no-optional-locks "$@" 2>/dev/null; }
    b=$(g symbolic-ref --short -q HEAD || g rev-parse --short HEAD)
    x=0
    # Exit 1 is "none found"; anything above (an old git, a config git cannot read) fails closed.
    f=$(g config --show-scope --includes --name-only --get-regexp '^filter\\.|^diff\\.external$'); r=$?
    if [ "$r" -gt 1 ] || printf '%s\\n' "$f" | grep -qvE '^(system|global)[[:space:]]|^$'; then x=2
    elif [ -n "$(g status --porcelain --ignore-submodules | head -1)" ]; then x=1; fi
    printf '%s${FIELD}%s${FIELD}%s\\n' "$(basename "$d")" "$b" "$x"
  ) &
done
wait
`

export const parseGit = (stdout: string): Map<string, GitState> =>
  new Map(
    stdout.split('\n').flatMap(line => {
      const [name = '', branch = '', dirty = '0'] = line.split(FIELD)
      if (!line.includes(FIELD) || name === '' || branch === '') return []
      const state: GitState = dirty === '2' ? { branch, dirty: false, unchecked: true } : { branch, dirty: dirty === '1' }
      return [[name, state] as const]
    }),
  )

export const withGit = (projects: readonly Project[], git: ReadonlyMap<string, GitState>): Project[] =>
  projects.map(p => {
    const state = git.get(p.name)
    return state ? { ...p, git: state } : p
  })

// The newest $2 transcripts of $1: id, mtime, the last custom-title line, the last last-prompt line.
export const SESSIONS_SCRIPT = `
cd "$HOME/.claude/projects/$1" 2>/dev/null || exit 0
ls -t ./*.jsonl 2>/dev/null | head -n "$2" | while IFS= read -r f; do
  t=$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f")
  ct=$(grep -h '"type":"custom-title"' "$f" | tail -1)
  lp=$(grep -h '"type":"last-prompt"' "$f" | tail -1)
  id=$(basename "$f" .jsonl)
  printf '%s${FIELD}%s${FIELD}%s${FIELD}%s\\n' "$id" "$t" "$ct" "$lp"
done
`

export const encodeProjectDir = (path: string): string => path.replace(/[^a-zA-Z0-9]/g, '-')

export const joinPath = (root: string, name: string): string => `${root.replace(/\/+$/, '')}/${name}`

export const parentOf = (path: string): string => {
  const trimmed = path.replace(/\/+$/, '')
  const at = trimmed.lastIndexOf('/')
  return at <= 0 ? '/' : trimmed.slice(0, at)
}

// Most recently used first, then folders Claude never ran in, alphabetically.
export const parseProjects = (root: string, stdout: string): Project[] =>
  stdout
    .split('\n')
    .filter(line => line.includes(FIELD))
    .map(line => {
      const [name = '', t = '0', c = '0', g = '0'] = line.split(FIELD)
      return {
        name,
        path: joinPath(root, name),
        lastActive: Number(t) || 0,
        sessions: Number(c) || 0,
        isRepo: g === '1',
      }
    })
    .filter(p => p.name !== '' && !p.name.startsWith('.'))
    .sort((a, b) => b.lastActive - a.lastActive || a.name.localeCompare(b.name))

const field = (jsonLine: string, key: string): string | undefined => {
  if (jsonLine === '') return undefined
  try {
    const value = (JSON.parse(jsonLine) as Record<string, unknown>)[key]
    return typeof value === 'string' && value.trim() !== '' ? value : undefined
  } catch {
    return undefined
  }
}

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim()

// A transcript with neither a title nor a prompt never had a conversation, so it is left out.
export const parseSessions = (stdout: string): SessionInfo[] =>
  stdout.split('\n').flatMap(line => {
    if (!line.includes(FIELD)) return []
    const [id = '', t = '0', titleLine = '', promptLine = ''] = line.split(FIELD)
    const title = field(titleLine, 'customTitle') ?? field(promptLine, 'lastPrompt')
    return id === '' || title === undefined ? [] : [{ id, mtime: Number(t) || 0, title: oneLine(title) }]
  })

// A folder of projects: not itself a repository, and at least two children that are or that Claude ran in.
export const looksLikeRoot = (projects: readonly Project[], isRepo: boolean): boolean =>
  !isRepo && projects.filter(p => p.isRepo || p.sessions > 0).length >= 2

export const timeAgo = (seconds: number, now: number): string => {
  if (seconds <= 0) return '—'
  const s = Math.max(0, Math.round(now / 1000 - seconds))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return `${Math.floor(s / (86400 * 30))}mo ago`
}

// A braille spinner, one frame per tick.
export const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const
export const spinnerFrame = (tick: number): string => SPINNER[((tick % SPINNER.length) + SPINNER.length) % SPINNER.length]!

export const clip = (text: string, width: number): string =>
  text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`

// What a typed line means while the band shows: a pick, a narrowed list, or a prompt for the model.
export type TypedPick =
  | { kind: 'project'; project: Project }
  | { kind: 'filter'; filter: string }
  | { kind: 'none' }

// The folders carry no numbers, so only a name picks one.
export const matchProject = (text: string, all: readonly Project[]): TypedPick => {
  const typed = text.trim()
  // A sentence is a prompt; only a single word is read as a project name.
  if (typed === '' || /\s/.test(typed)) return { kind: 'none' }
  const needle = typed.toLowerCase()
  const exact = all.find(p => p.name.toLowerCase() === needle)
  if (exact) return { kind: 'project', project: exact }
  const hits = all.filter(p => p.name.toLowerCase().includes(needle))
  if (hits.length === 1) return { kind: 'project', project: hits[0]! }
  if (hits.length > 1) return { kind: 'filter', filter: typed }
  return { kind: 'none' }
}

export type SessionPick = { kind: 'new' } | { kind: 'resume'; id: string } | { kind: 'back' } | { kind: 'none' }

export const matchSession = (text: string, sessions: readonly SessionInfo[]): SessionPick => {
  const typed = text.trim().toLowerCase()
  if (typed === 'n' || typed === 'new') return { kind: 'new' }
  if (typed === 'b' || typed === '..' || typed === 'back') return { kind: 'back' }
  if ((typed === 'c' || typed === 'continue') && sessions[0]) {
    return { kind: 'resume', id: sessions[0].id }
  }
  if (/^\d+$/.test(typed)) {
    const session = sessions[Number(typed) - 1]
    return session ? { kind: 'resume', id: session.id } : { kind: 'none' }
  }
  return { kind: 'none' }
}

// Splits rows into pages of `size`, clamping `page` into range.
export const paginate = <T,>(rows: readonly T[], size: number, page: number) => {
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const at = Math.min(Math.max(0, Number.isFinite(page) ? page : 0), pages - 1)
  return { at, pages, start: at * size, rows: rows.slice(at * size, (at + 1) * size) }
}

export const filterProjects = (projects: readonly Project[], filter: string): Project[] => {
  const needle = filter.trim().toLowerCase()
  return needle === '' ? [...projects] : projects.filter(p => p.name.toLowerCase().includes(needle))
}
