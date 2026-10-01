'use client'

import Link from 'next/link'
import { AlertCircle, CircleCheck, CircleDot, FolderClosed, ListTodo } from 'lucide-react'
import { ProjectActivity } from '@/components/analytics/project-activity'
import { ProjectCard } from '@/components/projects/project-list'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useProjectSummaries, useRecentActivity, useTasks, useUsers } from '@/lib/hooks'
import { isOverdue } from '@/lib/utils'

export function WorkspaceDashboard() {
  const summaries = useProjectSummaries()
  const tasks = useTasks()
  const users = useUsers()
  const activity = useRecentActivity()

  if (summaries.error || tasks.error || users.error || activity.error) {
    return <section role="alert" className="flex flex-col items-start gap-3 p-7">
      <h2 className="font-semibold">Could not load the workspace overview</h2>
      <p className="text-muted-foreground">Your project data has not been changed.</p>
      <Button variant="secondary" onClick={() => { void summaries.mutate(); void tasks.mutate(); void users.mutate(); void activity.mutate() }}>Try again</Button>
    </section>
  }

  if (!summaries.data || !tasks.data || !users.data || !activity.data) {
    return <section aria-label="Loading workspace overview" aria-busy="true" className="flex flex-col gap-5 p-4 sm:p-7">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div>
      <div className="grid gap-4 xl:grid-cols-2">{Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-64" />)}</div>
    </section>
  }

  const totalTasks = tasks.data.length
  const completedTasks = tasks.data.filter(task => task.status === 'done').length
  const inProgressTasks = tasks.data.filter(task => task.status === 'in_progress').length
  const overdueTasks = tasks.data.filter(task => isOverdue(task))
  const metrics = [
    { label: 'Projects', value: summaries.data.length, icon: FolderClosed, detail: 'Active team projects' },
    { label: 'Tasks', value: totalTasks, icon: ListTodo, detail: 'Across all projects' },
    { label: 'In progress', value: inProgressTasks, icon: CircleDot, detail: 'Work in motion' },
    { label: 'Overdue', value: overdueTasks.length, icon: AlertCircle, detail: 'Open past due date' },
  ]

  return <section aria-label="Workspace overview" className="flex flex-col gap-6 p-4 sm:p-7">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon, detail }) => <Card key={label} size="sm" aria-label={`${label}: ${value}`}>
        <CardHeader className="flex flex-row items-center justify-between gap-2"><CardTitle>{label}</CardTitle><Icon aria-hidden="true" className="size-4 text-primary" /></CardHeader>
        <CardContent><p className="text-3xl font-semibold leading-9 tabular-nums text-strong">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></CardContent>
      </Card>)}
    </div>

    <section aria-labelledby="dashboard-projects-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="dashboard-projects-heading" className="text-sm font-semibold">Projects</h2><p className="text-xs text-muted-foreground">{completedTasks} of {totalTasks} tasks completed across the workspace.</p></div><Link href="/projects" className="text-xs font-medium text-primary hover:underline">All projects</Link></div>
      {summaries.data.length ? <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">{summaries.data.map(summary => <ProjectCard key={summary.project.id} summary={summary} />)}</div> : <Empty className="min-h-56 border bg-surface"><EmptyHeader><EmptyMedia variant="icon"><FolderClosed /></EmptyMedia><EmptyTitle>No projects yet</EmptyTitle><EmptyDescription>Create a project to bring the team&apos;s work together.</EmptyDescription></EmptyHeader></Empty>}
    </section>

    <section aria-label="Workspace activity and completion" className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ProjectActivity tasks={tasks.data} events={activity.data} users={users.data} />
      <Card size="sm" className="h-full min-w-0">
        <CardHeader><CardTitle>Workspace completion</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3"><CircleCheck className="size-5 text-success" /><div><p className="text-sm font-semibold text-strong">{completedTasks} completed</p><p className="text-xs text-muted-foreground">{totalTasks - completedTasks} tasks remain open</p></div></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Workspace task completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={totalTasks ? Math.round(completedTasks / totalTasks * 100) : 0}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${totalTasks ? Math.round(completedTasks / totalTasks * 100) : 0}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{totalTasks ? Math.round(completedTasks / totalTasks * 100) : 0}% of all workspace tasks are done.</p>
        </CardContent>
      </Card>
    </section>
  </section>
}