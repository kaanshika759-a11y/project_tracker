import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { WorkspaceAnalytics } from '@/components/analytics/workspace-analytics'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { PhasePlaceholder } from '@/components/layout/phase-placeholder'
import { TeamDirectory } from '@/components/layout/team-directory'
import { WorkspaceDashboard } from '@/components/layout/workspace-dashboard'
import { MyTasks } from '@/components/list/my-tasks'
import { SettingsPage } from '@/components/settings/settings-page'

const sections = {
  dashboard: { label: 'Home', title: 'A home for your team’s work', phase: 7, description: 'Workspace summaries and project insights will arrive with the overview phase.' },
  'my-tasks': { label: 'My Tasks', title: 'Focus on what’s yours', phase: 8, description: 'Your assigned work, grouped by overdue, today, this week, and later.' },
  analytics: { label: 'Analytics', title: 'Make your progress visible', phase: 7, description: 'Project-level insights will arrive with analytics. Open a project to explore its Analytics tab.' },
  team: { label: 'Team', title: 'Great work is a team effort', phase: 8, description: 'Team profiles and workload summaries will live here.' },
  settings: { label: 'Settings', title: 'Settings', phase: 8, description: 'Manage profile display and local preferences.' },
}
type Props = { params: Promise<{ section: string }> }
function getSection(section: string) {
  if (!Object.hasOwn(sections, section)) notFound()
  return sections[section as keyof typeof sections]
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getSection((await params).section).label }
}
export default async function SecondaryShellPage({ params }: Props) {
  const sectionKey = (await params).section
  const section = getSection(sectionKey)
  return <><header className="border-b bg-surface px-4 py-5 sm:px-7"><Breadcrumbs items={[{ label: 'Workspace', href: '/projects' }, { label: section.label }]} /><h1 className="mt-4 text-xl font-semibold">{section.label}</h1></header>{sectionKey === 'my-tasks' ? <MyTasks /> : sectionKey === 'dashboard' ? <WorkspaceDashboard /> : sectionKey === 'team' ? <TeamDirectory /> : sectionKey === 'analytics' ? <WorkspaceAnalytics /> : sectionKey === 'settings' ? <SettingsPage /> : <PhasePlaceholder {...section} />}</>
}
