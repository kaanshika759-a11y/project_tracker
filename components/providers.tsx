'use client'

import { useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

function ThemePreferenceSync() {
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('hostlink-settings-preferences')
      const preferences = stored ? JSON.parse(stored) as { theme?: string } : null
      document.documentElement.classList.toggle('dark', preferences?.theme === 'dark')
    } catch {
      document.documentElement.classList.remove('dark')
    }
  }, [])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}>
    <TooltipProvider delay={150}><ThemePreferenceSync />{children}<Toaster position="bottom-right" duration={4000} closeButton /></TooltipProvider>
  </MotionConfig>
}
