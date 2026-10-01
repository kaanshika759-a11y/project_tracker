import { createStore } from 'zustand/vanilla'
import { createSeed } from './seed'
import type { DomainData } from './types'
export { uiStore } from './ui-store'

interface DomainState extends DomainData { revision: number; nextTaskNumber: number; currentUserId: string }

// Only lib/api.ts may write domain state. UI subscribes to revision through hooks.
export const domainStore = createStore<DomainState>(() => ({
  ...createSeed(), revision: 0, nextTaskNumber: 12, currentUserId: 'u1',
}))

