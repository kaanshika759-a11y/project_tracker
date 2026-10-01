'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UserAvatar } from '@/components/ui/hostlink'
import { useProjects, useTasks, useUsers } from '@/lib/hooks'

export function TeamDirectory() {
  const users = useUsers()
  const projects = useProjects()
  const tasks = useTasks()
  const userList = users.data
  const projectList = projects.data
  const taskList = tasks.data

  if (users.error || projects.error || tasks.error) {
    return <section role="alert" className="flex flex-col items-start gap-3 p-7">
      <h2 className="font-semibold">Could not load the team</h2>
      <p className="text-muted-foreground">Member and project data have not been changed.</p>
      <Button variant="secondary" onClick={() => { void users.mutate(); void projects.mutate(); void tasks.mutate() }}>Try again</Button>
    </section>
  }

  if (!userList || !projectList || !taskList) {
    return <section aria-label="Loading team" aria-busy="true" className="flex flex-col gap-3 p-4 sm:p-7">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
    </section>
  }

  if (!userList.length) {
    return <Empty className="m-4 min-h-72 border bg-surface sm:m-7"><EmptyHeader><EmptyMedia variant="icon"><Users /></EmptyMedia><EmptyTitle>No team members</EmptyTitle><EmptyDescription>Users added to the workspace will appear here.</EmptyDescription></EmptyHeader></Empty>
  }

  return <section aria-label="Team directory" className="flex flex-col gap-4 p-4 sm:p-7">
    <div><h2 className="text-sm font-semibold">Team members</h2><p className="text-xs text-muted-foreground">{userList.length} people across {projectList.length} projects.</p></div>
    <div className="overflow-x-auto rounded-lg border bg-surface">
      <Table aria-label="Team members">
        <TableHeader><TableRow><TableHead className="pl-4">Member</TableHead><TableHead>Role</TableHead><TableHead>Projects</TableHead><TableHead className="pr-4">Open tasks</TableHead></TableRow></TableHeader>
        <TableBody>{userList.map(user => {
          const memberProjects = projectList.filter(project => project.memberIds.includes(user.id))
          const openTasks = taskList.filter(task => task.assigneeId === user.id && task.status !== 'done')
          return <TableRow key={user.id}>
            <TableCell className="min-w-52 py-3 pl-4"><div className="flex items-center gap-3"><UserAvatar user={user} /><span className="flex min-w-0 flex-col"><span className="truncate font-medium text-strong">{user.name}</span><span className="truncate text-xs text-muted-foreground">{user.email}</span></span></div></TableCell>
            <TableCell className="whitespace-nowrap">{user.role}</TableCell>
            <TableCell><div className="flex flex-wrap gap-x-3 gap-y-1">{memberProjects.length ? memberProjects.map(project => <Link key={project.id} href={`/projects/${project.id}`} className="text-xs text-primary hover:underline">{project.name}</Link>) : <span className="text-xs text-muted-foreground">None</span>}</div></TableCell>
            <TableCell className="pr-4 tabular-nums">{openTasks.length}</TableCell>
          </TableRow>
        })}</TableBody>
      </Table>
    </div>
  </section>
}