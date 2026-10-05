export type Exchange = { prompt: string; answer: string; tools: number }

// Where the list stands: a rail of ticks above the input, or a dock beside the transcript.
export type DockMode = 'rail' | 'dock'

declare module 'claude-code' {
  interface PluginState {
    'prompt-dock': {
      mode: DockMode
      tick: number
    }
  }
}
