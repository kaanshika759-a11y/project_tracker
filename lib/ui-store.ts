import { createStore } from 'zustand/vanilla'
import type { TaskFilters } from './types'

interface UIState {
  sidebarExpanded: boolean
  activeProjectId: string
  starredProjectIds: string[]
  filtersByProject: Record<string, TaskFilters>
  setSidebarExpanded: (expanded: boolean) => void
  setActiveProject: (id: string) => void
  setFilters: (projectId: string, filters: TaskFilters) => void
  clearFilters: (projectId: string) => void
}

export const uiStore = createStore<UIState>(set => ({
  sidebarExpanded: true, activeProjectId: '', starredProjectIds: [], filtersByProject: {},
  setSidebarExpanded: sidebarExpanded => set({ sidebarExpanded }),
  setActiveProject: activeProjectId => set({ activeProjectId }),
  setFilters: (projectId, filters) => set(state => ({ filtersByProject: { ...state.filtersByProject, [projectId]: filters } })),
  clearFilters: projectId => set(state => ({ filtersByProject: { ...state.filtersByProject, [projectId]: {} } })),
}))
