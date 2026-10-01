'use client'

import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { PanelsTopLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function PhasePlaceholder({ title, phase, description }: { title: string; phase: number; description: string }) {
  const pathname = usePathname()
  const reduced = useReducedMotion()
  return <motion.section key={pathname} initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} className="m-4 flex min-h-80 flex-1 flex-col items-center justify-center rounded-lg border border-dashed bg-surface/50 px-6 py-16 text-center sm:m-7">
    <span className="mb-5 flex size-12 items-center justify-center rounded-xl border bg-surface text-primary shadow-sm"><PanelsTopLeft className="size-5" aria-hidden="true" /></span>
    <Badge variant="secondary">Phase {phase}</Badge><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p><p className="mt-7 text-xs text-muted-foreground">No settings are saved or changed here.</p>
  </motion.section>
}
