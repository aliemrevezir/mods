// A child folder of the root, with how recently Claude ran there.
export type Project = {
  name: string
  path: string
  // Seconds since the epoch of the newest session transcript; 0 when none.
  lastActive: number
  sessions: number
  isRepo: boolean
}

// One saved conversation of a project, newest first in a list.
export type SessionInfo = {
  id: string
  // Seconds since the epoch the transcript was last written.
  mtime: number
  title: string
}

// What the band above the prompt shows.
export type HopView =
  | { kind: 'hidden' }
  | { kind: 'projects'; root: string; projects: Project[]; filter: string; page: number }
  | { kind: 'sessions'; root: string; project: Project; sessions: SessionInfo[]; page: number }

declare module 'claude-code' {
  interface PluginState {
    'project-hop': {
      view: HopView
    }
  }
}
