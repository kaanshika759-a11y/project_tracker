'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PriorityBadge } from '@/components/ui/hostlink'
import type { Analytics, Priority } from '@/lib/types'

const priorities: Priority[] = ['urgent', 'high', 'normal']

export function PriorityBreakdown({ analytics }: { analytics: Analytics }) {
  return <Card size="sm" className="h-full min-w-0">
    <CardHeader><CardTitle>Priority breakdown</CardTitle><CardDescription>Task distribution by priority.</CardDescription></CardHeader>
    <CardContent><dl className="flex flex-col gap-4">
      {priorities.map(priority => {
        const count = analytics.priorityCounts[priority]
        const percentage = analytics.total ? Math.round(count / analytics.total * 100) : 0
        return <div key={priority} className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><PriorityBadge priority={priority} /><dd className="ml-auto text-xs font-semibold tabular-nums text-strong">{count}</dd></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${priority} priority tasks`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
          </div>
        </div>
      })}
    </dl></CardContent>
  </Card>
}