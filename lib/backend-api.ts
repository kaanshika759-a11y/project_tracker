import { addDays, format } from 'date-fns'
import { mutate as mutateSWR } from 'swr'
import { uiStore } from './ui-store'
import { isOverdue } from './utils'
import type { Analytics, Comment, CreateProjectInput, CreateTaskInput, Project, ProjectSummary, Status, Task, TaskEvent, TaskFilters, UpdateProjectInput, UpdateTaskInput, User } from './types'

type ProjectRecord = Project & { members?: { userId: string; user: User }[]; tasks?: Task[]; memberIds?: string[] }

export class ApiError extends Error {
  readonly error: string
  constructor(message: string, public readonly allowed: Status[] = [], public readonly code = 'API_ERROR') {
    super(message)
    this.name = 'ApiError'
    this.error = message
  }
}

const inFlightGetRequests = new Map<string, Promise<unknown>>()

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isGet = (init?.method ?? 'GET').toUpperCase() === 'GET'
  const pending = isGet ? inFlightGetRequests.get(path) : undefined
  if (pending) return pending as Promise<T>

  const responsePromise = (async () => {
    const response = await fetch(path, { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...init?.headers } })
    if (response.status === 204) return undefined as T
    const data = await response.json().catch(() => null) as (T & { error?: string; allowed?: Status[]; code?: string }) | null
    if (!response.ok) throw new ApiError(data?.error ?? `Request failed (${response.status}).`, data?.allowed ?? [], data?.code ?? `HTTP_${response.status}`)
    return data as T
  })()

  if (!isGet) return responsePromise
  inFlightGetRequests.set(path, responsePromise)
  try {
    return await responsePromise
  } finally {
    if (inFlightGetRequests.get(path) === responsePromise) inFlightGetRequests.delete(path)
  }
}

function normalizeTask(task: Task & { description?: string | null; completedAt?: string | null }): Task {
  return { ...task, description: task.description ?? undefined, completedAt: task.completedAt ?? null }
}

function normalizeProject(project: ProjectRecord): Project {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? '',
    color: project.color,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    memberIds: project.memberIds ?? project.members?.map(member => member.userId) ?? [],
  }
}

async function refreshData(matches: (key: unknown[]) => boolean) {
  void mutateSWR(key => Array.isArray(key) && key[0] === 'hostlink' && matches(key)).catch(() => undefined)
}

const projectDataKey = (key: unknown[]) => ['projects', 'project-summaries', 'project', 'workspace-search'].includes(String(key[1]))
const taskDataKey = (key: unknown[]) => ['tasks', 'my-tasks', 'task', 'task-events', 'project-events', 'analytics', 'board-comments', 'project-summaries', 'projects', 'recent-activity', 'workspace-search'].includes(String(key[1]))

async function allProjects(): Promise<ProjectRecord[]> {
  return request<ProjectRecord[]>('/api/projects')
}

async function allTasks(): Promise<Task[]> {
  const projects = await allProjects()
  return projects.flatMap(project => (project.tasks ?? []).map(normalizeTask))
}

function selectedUserId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('hostlink-current-user')
}

async function actingUserId(requested?: string): Promise<string> {
  if (requested) return requested
  const users = await getUsers()
  const selected = selectedUserId()
  return users.find(user => user.id === selected)?.id ?? users[0]?.id ?? ''
}

export function setSidebarExpanded(expanded: boolean) {
  uiStore.getState().setSidebarExpanded(expanded)
}
export function setTaskFilters(projectId: string, patch: Partial<TaskFilters>) {
  const current = uiStore.getState().filtersByProject[projectId] ?? {}
  uiStore.getState().setFilters(projectId, { ...current, ...patch })
}
export function clearTaskFilters(projectId: string) {
  uiStore.getState().clearFilters(projectId)
}
export function toggleProjectStar(id: string) {
  const ids = uiStore.getState().starredProjectIds
  uiStore.setState({ starredProjectIds: ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id] })
}

export async function getUsers(): Promise<User[]> {
  return request<User[]>('/api/users')
}
export async function getCurrentUser(): Promise<User> {
  const users = await getUsers()
  const selected = selectedUserId()
  const user = users.find(item => item.id === selected) ?? users[0]
  if (!user) throw new ApiError('No users are available.', [], 'NOT_FOUND')
  return user
}
export async function setCurrentUser(id: string): Promise<User> {
  const user = (await getUsers()).find(item => item.id === id)
  if (!user) throw new ApiError('Choose a valid team member.', [], 'NOT_FOUND')
  if (typeof window !== 'undefined') window.localStorage.setItem('hostlink-current-user', id)
  await refreshData(key => ['users', 'current-user', 'my-tasks', 'task-comment-counts'].includes(String(key[1])))
  return user
}
export async function getProjects(): Promise<Project[]> {
  return (await allProjects()).map(normalizeProject)
}
export async function getProjectSummaries(): Promise<ProjectSummary[]> {
  const [records, users] = await Promise.all([allProjects(), getUsers()])
  return records.map(record => {
    const project = normalizeProject(record)
    const tasks = (record.tasks ?? []).map(normalizeTask)
    const doneTasks = tasks.filter(task => task.status === 'done').length
    const timestamps = [project.createdAt, project.updatedAt ?? project.createdAt, ...tasks.flatMap(task => [task.createdAt, task.movedAt])]
    return {
      project,
      members: users.filter(user => project.memberIds.includes(user.id)),
      totalTasks: tasks.length,
      doneTasks,
      overdueCount: tasks.filter(task => isOverdue(task)).length,
      completionPct: tasks.length ? Math.round(doneTasks / tasks.length * 100) : 0,
      lastUpdated: timestamps.reduce((latest, timestamp) => timestamp > latest ? timestamp : latest),
    }
  }).sort((a, b) => b.project.createdAt.localeCompare(a.project.createdAt) || a.project.name.localeCompare(b.project.name))
}
export async function getProject(id: string): Promise<Project> {
  return normalizeProject(await request<ProjectRecord>(`/api/projects/${encodeURIComponent(id)}`))
}
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const project = normalizeProject(await request<ProjectRecord>('/api/projects', { method: 'POST', body: JSON.stringify(input) }))
  await refreshData(projectDataKey)
  return project
}
export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const project = normalizeProject(await request<ProjectRecord>(`/api/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }))
  await refreshData(projectDataKey)
  return project
}
export async function deleteProject(id: string): Promise<void> {
  await request<void>(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await refreshData(projectDataKey)
}
export async function getTasks(projectId?: string, filters: TaskFilters = {}): Promise<Task[]> {
  const tasks = projectId
    ? await request<Task[]>(`/api/projects/${encodeURIComponent(projectId)}/tasks`)
    : await allTasks()
  const query = filters.search?.trim().toLowerCase()
  return tasks.map(normalizeTask).filter(task =>
    (!query || `${task.key} ${task.title}`.toLowerCase().includes(query)) &&
    (!filters.assigneeIds?.length || filters.assigneeIds.includes(task.assigneeId)) &&
    (!filters.priorities?.length || filters.priorities.includes(task.priority)) &&
    (!filters.statuses?.length || filters.statuses.includes(task.status)))
}
export async function getMyTasks(userId?: string): Promise<Task[]> {
  const id = await actingUserId(userId)
  return (await request<Task[]>(`/api/my-tasks?userId=${encodeURIComponent(id)}`)).map(normalizeTask)
}
export async function getTaskCommentCounts(taskIds: string[]): Promise<Record<string, number>> {
  if (!taskIds.length) return {}
  const tasks = await Promise.all(taskIds.map(id => getTask(id)))
  const counts = await Promise.all([...new Set(tasks.map(task => task.projectId))].map(async projectId =>
    request<Record<string, number>>(`/api/projects/${encodeURIComponent(projectId)}/comment-counts`)))
  return Object.assign({}, ...counts)
}
export async function getBoardCommentCounts(projectId: string): Promise<Record<string, number>> {
  return request<Record<string, number>>(`/api/projects/${encodeURIComponent(projectId)}/comment-counts`)
}
export async function quickAddTask(projectId: string, title: string): Promise<Task> {
  const [project, userId] = await Promise.all([getProject(projectId), actingUserId()])
  const assigneeId = project.memberIds.includes(userId) ? userId : project.memberIds[0]
  if (!assigneeId) throw new ApiError('Select a project member before creating a task.')
  return createTask({ projectId, title, status: 'backlog', priority: 'normal', assigneeId, dueDate: format(addDays(new Date(), 7), 'yyyy-MM-dd') }, userId)
}
export async function getTask(id: string): Promise<Task> {
  return normalizeTask(await request<Task>(`/api/tasks/${encodeURIComponent(id)}`))
}
export async function createTask(input: CreateTaskInput, userId?: string): Promise<Task> {
  const actorId = await actingUserId(userId)
  const task = normalizeTask(await request<Task>(`/api/projects/${encodeURIComponent(input.projectId)}/tasks`, { method: 'POST', body: JSON.stringify({ ...input, userId: actorId }) }))
  await refreshData(key => taskDataKey(key))
  return task
}
export async function updateTask(id: string, input: UpdateTaskInput, userId?: string): Promise<Task> {
  const actorId = await actingUserId(userId)
  const task = normalizeTask(await request<Task>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ ...input, userId: actorId }) }))
  await refreshData(key => taskDataKey(key))
  return task
}
export async function moveTask(id: string, toStatus: Status, userId?: string): Promise<Task> {
  const actorId = await actingUserId(userId)
  const task = normalizeTask(await request<Task>(`/api/tasks/${encodeURIComponent(id)}/move`, { method: 'POST', body: JSON.stringify({ toStatus, userId: actorId }) }))
  await refreshData(key => taskDataKey(key))
  return task
}
export async function deleteTask(id: string): Promise<void> {
  await request<void>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await refreshData(key => taskDataKey(key))
}
export async function getComments(taskId: string): Promise<Comment[]> {
  return request<Comment[]>(`/api/tasks/${encodeURIComponent(taskId)}/comments`)
}
export async function addComment(taskId: string, authorId: string, body: string): Promise<Comment> {
  const comment = await request<Comment>(`/api/tasks/${encodeURIComponent(taskId)}/comments`, { method: 'POST', body: JSON.stringify({ authorId, body }) })
  await refreshData(key => key[1] === 'comments' && key[2] === taskId || key[1] === 'board-comments')
  return comment
}
export async function deleteComment(id: string): Promise<void> {
  await request<void>(`/api/comments/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await refreshData(key => key[1] === 'board-comments' || key[1] === 'comments')
}
export async function getTaskEvents(taskId: string): Promise<TaskEvent[]> {
  return request<TaskEvent[]>(`/api/tasks/${encodeURIComponent(taskId)}/events`)
}
export async function getProjectEvents(projectId: string): Promise<TaskEvent[]> {
  return request<TaskEvent[]>(`/api/projects/${encodeURIComponent(projectId)}/events`)
}
export async function getRecentActivity() {
  const [records, users] = await Promise.all([allProjects(), getUsers()])
  const projects = records.map(normalizeProject)
  const tasks = records.flatMap(project => (project.tasks ?? []).map(normalizeTask))
  const eventsByProject = await Promise.all(projects.map(project => getProjectEvents(project.id)))
  const usersById = new Map(users.map(user => [user.id, user]))
  const tasksById = new Map(tasks.map(task => [task.id, task]))
  const projectsById = new Map(projects.map(project => [project.id, project]))
  return eventsByProject.flat().filter(event => event.fromStatus !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
    .flatMap(event => {
      const user = usersById.get(event.userId)
      const task = tasksById.get(event.taskId)
      const project = projectsById.get(event.projectId)
      return user && task && project ? [{ ...event, user, task, project }] : []
    })
}
export async function searchWorkspace(query: string) {
  const term = query.trim().toLowerCase().slice(0, 200)
  const [projects, tasks] = await Promise.all([getProjects(), term ? allTasks() : Promise.resolve([])])
  return {
    projects: term ? projects.filter(project => `${project.name} ${project.description}`.toLowerCase().includes(term)) : projects,
    tasks: term ? tasks.filter(task => `${task.key} ${task.title}`.toLowerCase().includes(term)).slice(0, 8) : [],
  }
}
export async function getAnalytics(projectId: string): Promise<Analytics> {
  return request<Analytics>(`/api/projects/${encodeURIComponent(projectId)}/analytics`)
}
