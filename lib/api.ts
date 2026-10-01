import { addDays, format, isValid, parseISO } from 'date-fns'
import { domainStore, uiStore } from './store'
import { allowedTransitions, computeAnalytics, isOverdue, transitionError } from './utils'
import { PRIORITIES, STATUSES, type Comment, type CreateProjectInput, type CreateTaskInput, type DomainData, type Project, type ProjectSummary, type Status, type Task, type TaskEvent, type TaskFilters, type UpdateProjectInput, type UpdateTaskInput } from './types'

export class ApiError extends Error {
  readonly error: string
  constructor(message: string, public readonly allowed: Status[] = [], public readonly code = 'VALIDATION') {
    super(message)
    this.name = 'ApiError'
    this.error = message
  }
}
const state = () => domainStore.getState()
const clone = <T>(value: T): T => structuredClone(value)
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const loaded = new Map<string, Promise<void>>()
let mutationPending = false
let firstReadDelay = 650
let mutationDelay = 180
let failNextMutation = false

// Deterministic failure injection is for tests and future error-state previews, not random demo failures.
export function configureMockApi(options: { firstReadDelay?: number; mutationDelay?: number; failNextMutation?: boolean }) {
  firstReadDelay = options.firstReadDelay ?? firstReadDelay
  mutationDelay = options.mutationDelay ?? mutationDelay
  failNextMutation = options.failNextMutation ?? failNextMutation
}
async function read<T>(key: string, select: () => T): Promise<T> {
  if (!loaded.has(key)) loaded.set(key, sleep(firstReadDelay))
  await loaded.get(key)
  return clone(select())
}
function requireTask(id: string): Task {
  const task = state().tasks.find(task => task.id === id)
  if (!task) throw new ApiError('Task not found.', [], 'NOT_FOUND')
  return task
}
function requireProject(id: string): Project {
  const project = state().projects.find(project => project.id === id)
  if (!project) throw new ApiError('Project not found.', [], 'NOT_FOUND')
  return project
}
function requireUser(id: string) {
  const user = state().users.find(user => user.id === id)
  if (!user) throw new ApiError('Choose a valid team member.')
  return user
}
function text(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== 'string' || (required && !value.trim())) throw new ApiError(`${label} is required.`)
  const result = value.trim()
  if (result.length > max) throw new ApiError(`${label} must be ${max} characters or fewer.`)
  return result
}
function validateDate(date: unknown): string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError('Choose a valid due date.')
  const parsed = parseISO(date)
  if (!isValid(parsed) || format(parsed, 'yyyy-MM-dd') !== date) throw new ApiError('Choose a valid due date.')
  return date
}
function validateStatus(status: Status): Status {
  if (!STATUSES.includes(status)) throw new ApiError('Choose a valid status.')
  return status
}
function validateTaskFields(task: Task): Task {
  const project = requireProject(task.projectId)
  requireUser(task.assigneeId)
  if (!project.memberIds.includes(task.assigneeId)) throw new ApiError('Assignee must be a member of this project.')
  if (!PRIORITIES.includes(task.priority)) throw new ApiError('Choose a valid priority.')
  return { ...task, title: text(task.title, 'Title', 200), description: text(task.description ?? '', 'Description', 10000, false), dueDate: validateDate(task.dueDate), status: validateStatus(task.status) }
}
function validateProject(input: CreateProjectInput): CreateProjectInput {
  if (!Array.isArray(input.memberIds) || input.memberIds.length === 0) throw new ApiError('Select at least one project member.')
  input.memberIds.forEach(requireUser)
  if (!['teal', 'indigo', 'amber', 'blue', 'violet'].includes(input.color)) throw new ApiError('Choose a supported project color.')
  return { name: text(input.name, 'Project name', 100), description: text(input.description, 'Description', 2000, false), color: input.color, memberIds: [...new Set(input.memberIds)] }
}
async function mutate<T>(operation: () => { patch: Partial<DomainData> & { nextTaskNumber?: number; currentUserId?: string }; result: T }): Promise<T> {
  // Serializing writes makes snapshot rollback safe across task, project, and comment mutations.
  if (mutationPending) throw new ApiError('A change is still saving. Please try again.', [], 'BUSY')
  const previous = state()
  const { patch, result } = operation()
  mutationPending = true
  const shouldFail = failNextMutation
  failNextMutation = false
  domainStore.setState({ ...patch, revision: previous.revision + 1 })
  try {
    await sleep(mutationDelay)
    if (shouldFail) throw new ApiError('Could not save this change. Your previous data has been restored.', [], 'NETWORK')
    return clone(result)
  } catch (error) {
    domainStore.setState({ ...previous, revision: state().revision + 1 }, true)
    throw error
  } finally {
    mutationPending = false
  }
}
function movedTask(task: Task, toStatus: Status, userId: string): { task: Task; event: TaskEvent } {
  requireUser(userId)
  validateStatus(toStatus)
  if (!allowedTransitions(task.status).includes(toStatus)) {
    throw new ApiError(transitionError(task.status, toStatus), allowedTransitions(task.status), 'INVALID_TRANSITION')
  }
  const now = new Date().toISOString()
  return { task: { ...task, status: toStatus, movedAt: now, completedAt: toStatus === 'done' ? now : null },
    event: { id: crypto.randomUUID(), taskId: task.id, projectId: task.projectId, userId, fromStatus: task.status, toStatus, createdAt: now } }
}

export function setSidebarExpanded(expanded: boolean) {
  uiStore.getState().setSidebarExpanded(expanded)
}
export function setTaskFilters(projectId: string, patch: Partial<TaskFilters>) {
  requireProject(projectId)
  const current = uiStore.getState().filtersByProject[projectId] ?? {}
  uiStore.getState().setFilters(projectId, clone({ ...current, ...patch }))
}
export function clearTaskFilters(projectId: string) {
  requireProject(projectId)
  uiStore.getState().clearFilters(projectId)
}
export function toggleProjectStar(id: string) {
  requireProject(id)
  const ids = uiStore.getState().starredProjectIds
  uiStore.setState({ starredProjectIds: ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id] })
}
export async function getRecentActivity() {
  return read('recent-activity', () => state().events
    .filter(event => event.fromStatus !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map(event => ({ ...event, user: requireUser(event.userId), task: requireTask(event.taskId), project: requireProject(event.projectId) })))
}
export async function searchWorkspace(query: string) {
  const term = query.trim().toLowerCase().slice(0, 200)
  return read('workspace-search', () => ({
    projects: term ? state().projects.filter(project => `${project.name} ${project.description}`.toLowerCase().includes(term)) : state().projects,
    tasks: term ? state().tasks.filter(task => `${task.key} ${task.title}`.toLowerCase().includes(term)).slice(0, 8) : [],
  }))
}

export async function getUsers() { return read('users', () => state().users) }
export async function getCurrentUser() { return read('users', () => requireUser(state().currentUserId)) }
export async function setCurrentUser(id: string) {
  return mutate(() => ({ patch: { currentUserId: requireUser(id).id }, result: requireUser(id) }))
}
export async function getProjects() { return read('projects', () => state().projects) }
export async function getProjectSummaries(): Promise<ProjectSummary[]> {
  return read('project-summaries', () => {
    const data = state()
    return data.projects.map(project => {
      const tasks = data.tasks.filter(task => task.projectId === project.id)
      const taskIds = new Set(tasks.map(task => task.id))
      const doneTasks = tasks.filter(task => task.status === 'done').length
      const timestamps = [project.createdAt, project.updatedAt ?? project.createdAt,
        ...tasks.flatMap(task => [task.createdAt, task.movedAt]),
        ...data.comments.filter(comment => taskIds.has(comment.taskId)).map(comment => comment.createdAt),
        ...data.events.filter(event => event.projectId === project.id).map(event => event.createdAt)]
      return { project, members: data.users.filter(user => project.memberIds.includes(user.id)),
        totalTasks: tasks.length, doneTasks, overdueCount: tasks.filter(task => isOverdue(task)).length,
        completionPct: tasks.length ? Math.round(doneTasks / tasks.length * 100) : 0,
        lastUpdated: timestamps.reduce((latest, timestamp) => timestamp > latest ? timestamp : latest) }
    }).sort((a, b) => b.project.createdAt.localeCompare(a.project.createdAt) || a.project.name.localeCompare(b.project.name))
  })
}
export async function getProject(id: string) { return read('projects', () => requireProject(id)) }
export async function createProject(input: CreateProjectInput) {
  return mutate(() => {
    const project: Project = { ...validateProject(input), id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    return { patch: { projects: [...state().projects, project] }, result: project }
  })
}
export async function updateProject(id: string, input: UpdateProjectInput) {
  return mutate(() => {
    const old = requireProject(id)
    const fields = validateProject({ ...old, ...input })
    if (state().tasks.some(task => task.projectId === id && !fields.memberIds.includes(task.assigneeId))) throw new ApiError('Reassign tasks before removing their assignee from the project.')
    const project = { ...old, ...fields, updatedAt: new Date().toISOString() }
    return { patch: { projects: state().projects.map(item => item.id === id ? project : item) }, result: project }
  })
}
export async function deleteProject(id: string) {
  return mutate(() => {
    requireProject(id)
    const ids = new Set(state().tasks.filter(task => task.projectId === id).map(task => task.id))
    return { patch: { projects: state().projects.filter(project => project.id !== id), tasks: state().tasks.filter(task => task.projectId !== id),
      comments: state().comments.filter(comment => !ids.has(comment.taskId)), events: state().events.filter(event => event.projectId !== id) }, result: undefined }
  })
}
export async function getTasks(projectId?: string, filters: TaskFilters = {}) {
  return read(`tasks:${projectId ?? 'all'}`, () => {
    if (projectId) requireProject(projectId)
    const query = filters.search?.trim().toLowerCase()
    return state().tasks.filter(task => (!projectId || task.projectId === projectId) &&
      (!query || task.title.toLowerCase().includes(query)) &&
      (!filters.assigneeIds?.length || filters.assigneeIds.includes(task.assigneeId)) &&
      (!filters.priorities?.length || filters.priorities.includes(task.priority)) &&
      (!filters.statuses?.length || filters.statuses.includes(task.status)))
  })
}
export async function getBoardCommentCounts(projectId: string): Promise<Record<string, number>> {
  return read(`board-comments:${projectId}`, () => {
    requireProject(projectId)
    const counts: Record<string, number> = Object.fromEntries(state().tasks.filter(task => task.projectId === projectId).map(task => [task.id, 0]))
    for (const comment of state().comments) if (comment.taskId in counts) counts[comment.taskId]++
    return counts
  })
}
export async function quickAddTask(projectId: string, title: string) {
  const project = requireProject(projectId)
  const userId = state().currentUserId
  return createTask({ projectId, title, status: 'backlog', priority: 'normal',
    assigneeId: project.memberIds.includes(userId) ? userId : project.memberIds[0],
    dueDate: format(addDays(new Date(), 7), 'yyyy-MM-dd') }, userId)
}
export async function getTask(id: string) { return read(`task:${id}`, () => requireTask(id)) }
export async function createTask(input: CreateTaskInput, userId = state().currentUserId) {
  return mutate(() => {
    requireUser(userId)
    const now = new Date().toISOString()
    const status = input.status ?? 'backlog'
    const task = validateTaskFields({ id: crypto.randomUUID(), key: `HL-${state().nextTaskNumber}`, projectId: input.projectId,
      title: input.title, description: input.description, assigneeId: input.assigneeId, dueDate: input.dueDate,
      priority: input.priority ?? 'normal', status, createdAt: now, movedAt: now, completedAt: status === 'done' ? now : null })
    const event: TaskEvent = { id: crypto.randomUUID(), taskId: task.id, projectId: task.projectId, userId, fromStatus: null, toStatus: status, createdAt: now }
    return { patch: { tasks: [...state().tasks, task], events: [...state().events, event], nextTaskNumber: state().nextTaskNumber + 1 }, result: task }
  })
}
export async function updateTask(id: string, input: UpdateTaskInput, userId = state().currentUserId) {
  return mutate(() => {
    requireUser(userId)
    const old = requireTask(id)
    // Whitelist editable fields so a future untyped caller cannot overwrite IDs or timestamps.
    let task = validateTaskFields({ ...old, title: input.title ?? old.title, description: input.description ?? old.description,
      assigneeId: input.assigneeId ?? old.assigneeId, dueDate: input.dueDate ?? old.dueDate, priority: input.priority ?? old.priority })
    let events = state().events
    if (input.status !== undefined && input.status !== old.status) {
      const moved = movedTask(task, input.status, userId)
      task = moved.task
      events = [...events, moved.event]
    }
    return { patch: { tasks: state().tasks.map(item => item.id === id ? task : item), events }, result: task }
  })
}
export async function moveTask(id: string, toStatus: Status, userId = state().currentUserId) {
  return mutate(() => {
    const moved = movedTask(requireTask(id), toStatus, userId)
    return { patch: { tasks: state().tasks.map(task => task.id === id ? moved.task : task), events: [...state().events, moved.event] }, result: moved.task }
  })
}
export async function deleteTask(id: string) {
  return mutate(() => {
    requireTask(id)
    return { patch: { tasks: state().tasks.filter(task => task.id !== id), comments: state().comments.filter(comment => comment.taskId !== id), events: state().events.filter(event => event.taskId !== id) }, result: undefined }
  })
}
export async function getComments(taskId: string) {
  return read(`comments:${taskId}`, () => { requireTask(taskId); return state().comments.filter(comment => comment.taskId === taskId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) })
}
export async function addComment(taskId: string, authorId: string, body: string) {
  return mutate(() => {
    requireTask(taskId); requireUser(authorId)
    const comment: Comment = { id: crypto.randomUUID(), taskId, authorId, body: text(body, 'Comment', 10000), createdAt: new Date().toISOString() }
    return { patch: { comments: [...state().comments, comment] }, result: comment }
  })
}
export async function deleteComment(id: string) {
  return mutate(() => {
    if (!state().comments.some(comment => comment.id === id)) throw new ApiError('Comment not found.', [], 'NOT_FOUND')
    return { patch: { comments: state().comments.filter(comment => comment.id !== id) }, result: undefined }
  })
}
export async function getTaskEvents(taskId: string) {
  return read(`events:${taskId}`, () => { requireTask(taskId); return state().events.filter(event => event.taskId === taskId) })
}
export async function getProjectEvents(projectId: string) {
  return read(`events:${projectId}`, () => { requireProject(projectId); return state().events.filter(event => event.projectId === projectId) })
}
export async function getAnalytics(projectId: string) {
  return read(`analytics:${projectId}`, () => {
    const project = requireProject(projectId)
    return computeAnalytics(state().tasks.filter(task => task.projectId === projectId), state().events.filter(event => event.projectId === projectId), state().users.filter(user => project.memberIds.includes(user.id)))
  })
}
