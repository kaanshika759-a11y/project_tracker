'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import packageInfo from '../../package.json'
import { Bell, Building2, Check, Info, Moon, Palette, Sun, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/ui/hostlink'
import { useCurrentUser, useProjectSummaries } from '@/lib/hooks'

type Preferences = {
  theme: 'light' | 'dark'
  emailNotifications: boolean
  taskUpdates: boolean
  mentionNotifications: boolean
}

const preferenceKey = 'hostlink-settings-preferences'
const defaults: Preferences = {
  theme: 'light',
  emailNotifications: true,
  taskUpdates: true,
  mentionNotifications: true,
}
const selectClass = 'h-9 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30'

function isPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== 'object') return false
  const preferences = value as Partial<Preferences>
  return (preferences.theme === 'light' || preferences.theme === 'dark') &&
    typeof preferences.emailNotifications === 'boolean' &&
    typeof preferences.taskUpdates === 'boolean' &&
    typeof preferences.mentionNotifications === 'boolean'
}

export function SettingsPage() {
  const user = useCurrentUser()
  const projects = useProjectSummaries()
  const [preferences, setPreferences] = useState<Preferences>(defaults)
  const [ready, setReady] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(preferenceKey)
      if (stored) {
        const parsed: unknown = JSON.parse(stored)
        if (isPreferences(parsed)) setPreferences(parsed)
      }
    } catch {
      setSaveError(true)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    document.documentElement.classList.toggle('dark', preferences.theme === 'dark')
    try {
      window.localStorage.setItem(preferenceKey, JSON.stringify(preferences))
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }, [preferences, ready])

  function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences(current => ({ ...current, [key]: value }))
  }

  return <section aria-label="Settings" className="flex flex-col gap-4 p-4 sm:gap-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-2xl text-xs text-muted-foreground">Manage your profile display and preferences for this browser.</p>
      <Badge variant={saveError ? 'destructive' : 'outline'}>
        {!saveError && <Check data-icon="inline-start" />}{saveError ? 'Local save unavailable' : ready ? 'Saved locally' : 'Loading preferences'}
      </Badge>
    </div>

    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <Card className="min-w-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="size-4 text-primary" />Profile</CardTitle><CardDescription>Account details from the active Hostlink user.</CardDescription></CardHeader>
        <CardContent>
          {user.error ? <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-sm text-danger">Profile data could not be loaded.</p>
            <Button variant="secondary" onClick={() => void user.mutate()}>Retry</Button>
          </div> : !user.data ? <div aria-label="Loading profile" aria-busy="true" className="flex items-center gap-3"><Skeleton className="size-10 rounded-full" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-2/3" /></div></div> : <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-md border bg-canvas/60 p-3">
              <UserAvatar user={user.data} size="lg" />
              <div className="min-w-0"><p className="font-medium text-strong">{user.data.name}</p><p className="text-xs text-muted-foreground">Avatar preview · {user.data.color}</p></div>
              <span aria-label={`${user.data.color} avatar color`} title={`${user.data.color} avatar color`} className="ml-auto size-6 shrink-0 rounded-full border border-border" style={{ backgroundColor: user.data.color === 'amber' ? '#92400e' : user.data.color === 'indigo' ? '#4f46e5' : '#0f766e' }} />
            </div>
            <Field><FieldLabel htmlFor="settings-name">Name</FieldLabel><Input id="settings-name" value={user.data.name} readOnly /></Field>
            <Field><FieldLabel htmlFor="settings-email">Email</FieldLabel><Input id="settings-email" value={user.data.email} readOnly /></Field>
            <Field><FieldLabel htmlFor="settings-role">Role</FieldLabel><Input id="settings-role" value={user.data.role} readOnly /></Field>
            <p className="text-xs text-muted-foreground">Profile details are read-only here and come from the current user record.</p>
          </div>}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="size-4 text-primary" />Appearance</CardTitle><CardDescription>Choose the color theme used in this browser.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="settings-theme">Theme</FieldLabel>
            <select id="settings-theme" className={selectClass} value={preferences.theme} disabled={!ready} onChange={event => updatePreference('theme', event.target.value as Preferences['theme'])}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
          <div className="flex items-start gap-3 rounded-md border bg-canvas/60 p-3">
            {preferences.theme === 'dark' ? <Moon className="mt-0.5 size-4 text-primary" /> : <Sun className="mt-0.5 size-4 text-primary" />}
            <div><p className="text-sm font-medium text-strong">{preferences.theme === 'dark' ? 'Dark theme' : 'Light theme'}</p><p className="text-xs text-muted-foreground">Applied across Hostlink and stored on this device only.</p></div>
          </div>
          <p className="text-xs text-muted-foreground">A compact density option is not available in the current interface.</p>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="size-4 text-primary" />Notifications</CardTitle><CardDescription>Frontend preferences for this browser. No messages are sent by these controls.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Field orientation="horizontal" className="items-center rounded-md border p-3">
            <Checkbox id="settings-email-notifications" checked={preferences.emailNotifications} disabled={!ready} onCheckedChange={checked => updatePreference('emailNotifications', checked === true)} />
            <FieldLabel htmlFor="settings-email-notifications"><FieldContent><span>Email notifications</span><span className="text-xs font-normal text-muted-foreground">Email notification preference</span></FieldContent></FieldLabel>
          </Field>
          <Field orientation="horizontal" className="items-center rounded-md border p-3">
            <Checkbox id="settings-task-updates" checked={preferences.taskUpdates} disabled={!ready} onCheckedChange={checked => updatePreference('taskUpdates', checked === true)} />
            <FieldLabel htmlFor="settings-task-updates"><FieldContent><span>Task updates</span><span className="text-xs font-normal text-muted-foreground">Activity on tasks you follow</span></FieldContent></FieldLabel>
          </Field>
          <Field orientation="horizontal" className="items-center rounded-md border p-3">
            <Checkbox id="settings-mentions" checked={preferences.mentionNotifications} disabled={!ready} onCheckedChange={checked => updatePreference('mentionNotifications', checked === true)} />
            <FieldLabel htmlFor="settings-mentions"><FieldContent><span>Mentions</span><span className="text-xs font-normal text-muted-foreground">When teammates mention you</span></FieldContent></FieldLabel>
          </Field>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-4 text-primary" />Workspace</CardTitle><CardDescription>Read-only project information from the connected workspace.</CardDescription></CardHeader>
        <CardContent>
          {projects.error ? <div role="alert" className="flex flex-col items-start gap-3"><p className="text-sm text-danger">Workspace projects could not be loaded.</p><Button variant="secondary" onClick={() => void projects.mutate()}>Retry</Button></div>
            : !projects.data ? <div aria-label="Loading workspace" aria-busy="true" className="flex flex-col gap-2"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-12 w-full" /></div>
              : <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 rounded-md border bg-canvas/60 p-3"><span className="text-sm font-medium text-strong">Hostlink workspace</span><Badge variant="secondary">{projects.data.length} projects</Badge></div>
                {projects.data.length ? <ul className="flex flex-col divide-y">{projects.data.map(summary => <li key={summary.project.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <Link href={`/projects/${summary.project.id}`} className="min-w-0 text-sm font-medium text-primary hover:underline">{summary.project.name}</Link>
                  <span className="text-xs text-muted-foreground">{summary.totalTasks} tasks · {summary.members.length} members</span>
                </li>)}</ul> : <p className="text-sm text-muted-foreground">No projects are available yet.</p>}
              </div>}
        </CardContent>
      </Card>

      <Card className="min-w-0 xl:col-span-2">
        <CardHeader><CardTitle className="flex items-center gap-2"><Info className="size-4 text-primary" />About</CardTitle><CardDescription>Application information.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div><p className="text-sm font-medium text-strong">Hostlink</p><p className="text-xs text-muted-foreground">Team project and task workspace</p></div>
          <div><p className="text-sm font-medium text-strong">Version</p><p className="text-xs text-muted-foreground">{packageInfo.version}</p></div>
        </CardContent>
      </Card>
    </div>
  </section>
}
