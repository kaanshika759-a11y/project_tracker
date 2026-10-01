'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ProjectInsights } from './project-insights'
import { useProjectSummaries } from '@/lib/hooks'

const selectClass = 'h-9 w-full min-w-0 rounded-md border bg-surface px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function WorkspaceAnalytics() {
  const { data: summaries, error, mutate } = useProjectSummaries()
  const [selectedProjectId, setSelectedProjectId] = useState('')

  if (error) {
    return <section role="alert" className="flex flex-col items-start gap-3 p-7">
      <h2 className="font-semibold">Could not load project analytics</h2>
      <p className="text-muted-foreground">Project data has not been changed.</p>
      <Button variant="secondary" onClick={() => void mutate()}>Try again</Button>
    </section>
  }
  if (!summaries) {
    return <section aria-label="Loading project analytics" aria-busy="true" className="flex flex-col gap-5 p-4 sm:p-7">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28" />)}</div>
      <div className="grid gap-4 xl:grid-cols-2">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-72" />)}</div>
    </section>
  }
  if (!summaries.length) {
    return <Empty className="m-4 min-h-72 border bg-surface sm:m-7">
      <EmptyHeader><EmptyTitle>No projects to analyze</EmptyTitle><EmptyDescription>Create a project and add tasks to start tracking progress.</EmptyDescription></EmptyHeader>
      <EmptyContent><Button render={<Link href="/projects" />}>Go to projects</Button></EmptyContent>
    </Empty>
  }

  const selectedProject = summaries.find(summary => summary.project.id === selectedProjectId) ?? summaries[0]
  return <>
    <section aria-label="Choose project for analytics" className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-4 sm:px-7">
      <div className="min-w-0 flex-1"><label htmlFor="workspace-analytics-project" className="mb-1 block text-xs font-medium text-muted-foreground">Project</label>
        <select id="workspace-analytics-project" className={selectClass} value={selectedProject.project.id} onChange={event => setSelectedProjectId(event.target.value)}>
          {summaries.map(summary => <option key={summary.project.id} value={summary.project.id}>{summary.project.name}</option>)}
        </select>
      </div>
      <p className="max-w-xl text-xs text-muted-foreground">{selectedProject.project.description}</p>
    </section>
    <ProjectInsights key={selectedProject.project.id} projectId={selectedProject.project.id} />
  </>
}