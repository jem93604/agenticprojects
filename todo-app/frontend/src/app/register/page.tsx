'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/apiClient'
import { useToast } from '@/components/ToastProvider'

export default function RegisterPage() {
  const toast = useToast()
  const router = useRouter()
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      await api.auth.register({
        handle: handle.trim(),
        password,
        display_name: displayName.trim() || undefined,
      })
      // Auto-login for convenience
      await api.auth.login({ handle: handle.trim(), password })
      toast.push({ type: 'success', title: 'Account created' })
      router.push('/')
    } catch (e: any) {
      toast.push({ type: 'error', title: 'Register failed', message: e?.message || 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-4 pt-10">
      <div className="card glass p-6 rounded-2xl">
        <div className="text-2xl font-bold">Create account</div>
        <div className="text-sm muted mt-2">Your credentials are stored in the database.</div>

        <div className="space-y-3 mt-5">
          <div className="space-y-1">
            <div className="text-sm font-medium muted">Handle</div>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. alex"
              className="neu-input w-full px-3 py-2 rounded-md"
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium muted">Display name (optional)</div>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Johnson"
              className="neu-input w-full px-3 py-2 rounded-md"
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium muted">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Minimum 8 characters"
              className="neu-input w-full px-3 py-2 rounded-md"
            />
          </div>

          <button
            type="button"
            className="neu-btn w-full px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !handle.trim() || password.length < 8}
            onClick={() => void submit()}
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>

          <button type="button" className="neu-btn w-full px-4 py-2" onClick={() => router.push('/login')}>
            Back to login
          </button>
        </div>
      </div>
    </div>
  )
}

