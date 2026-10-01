'use client'

import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskTable } from './task-table'
import { useMyTasks, useTaskCommentCounts, useUsers } from '@/lib/hooks'
import { ListTodo } from 'lucide-react'

export function MyTasks() {
  const tasks = useMyTasks()
  const users = useUsers()
  const taskIds = tasks.data?.map(task => task.id) ?? []
  const comments = useTaskCommentCounts(taskIds)

  if (tasks.error || users.error || comments.error) {
    return <section className="flex flex-col items-start gap-3 p-7" role="alert">
      <h2 className="font-semibold">Could not load your tasks</h2>
      <p className="text-muted-foreground">Your tasks have not been changed.</p>
      <Button variant="secondary" onClick={() => { void tasks.mutate(); void users.mutate(); void comments.mutate() }}>Try again</Button>
    </section>
  }
  if (!tasks.data || !users.data || !comments.data) {
    return <div aria-label="Loading your tasks" aria-busy="true" className="flex flex-col gap-3 p-4 sm:p-7">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
    </div>
  }
  if (tasks.data.length === 0) {
    return <Empty className="m-4 min-h-72 border bg-surface sm:m-7">
      <EmptyHeader><EmptyMedia variant="icon"><ListTodo /></EmptyMedia><EmptyTitle>No tasks assigned to you</EmptyTitle><EmptyDescription>Tasks assigned to your current user will appear here.</EmptyDescription></EmptyHeader>
      <EmptyContent><Button variant="secondary" onClick={() => { void tasks.mutate() }}>Refresh tasks</Button></EmptyContent>
    </Empty>
  }
  return <TaskTable tasks={tasks.data} users={users.data} comments={comments.data} updating={tasks.isValidating} />
}
