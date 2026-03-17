'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function DarkModeToggle() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme')
      const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      const isDark = stored ? stored === 'dark' : prefersDark
      setEnabled(isDark)
      document.documentElement.classList.toggle('dark', isDark)
    } catch (e) {
      // noop
    }
  }, [])

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch {};
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="neu-btn p-2"
      title={enabled ? 'Switch to light' : 'Switch to dark'}
    >
      {enabled ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}
