'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/apiClient'
import { useToast } from '@/components/ToastProvider'

export default function LoginPage() {
  const toast = useToast()
  const router = useRouter()
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      await api.auth.login({ handle: handle.trim(), password })
      toast.push({ type: 'success', title: 'Welcome back' })
      router.push('/')
    } catch (e: any) {
      toast.push({ type: 'error', title: 'Login failed', message: e?.message || 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-4 pt-10">
      <div className="card glass p-6 rounded-2xl">
        <div className="text-2xl font-bold">Log in</div>
        <div className="text-sm muted mt-2">Use your handle and password.</div>

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
            <div className="text-sm font-medium muted">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="neu-input w-full px-3 py-2 rounded-md"
            />
          </div>

          <button
            type="button"
            className="neu-btn w-full px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !handle.trim() || !password}
            onClick={() => void submit()}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>

          <div className="text-sm muted flex items-center justify-between gap-3 mt-2">
            <a href="/register" className="accent hover:underline">
              Create account
            </a>
            <a href="/reset/request" className="accent hover:underline">
              Reset password
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

