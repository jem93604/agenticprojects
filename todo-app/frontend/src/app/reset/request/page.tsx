'use client'

import { useState } from 'react'
import { useToast } from '@/components/ToastProvider'
import { api } from '@/lib/apiClient'

export default function PasswordResetRequestPage() {
  const toast = useToast()
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async () => {
    setLoading(true)
    try {
      const res = await api.auth.passwordResetRequest({ handle: handle.trim() })
      setMessage(res?.message || 'Request submitted')
      // Dev-friendly: backend returns token
      setResetToken(res?.reset_token || null)
      toast.push({ type: 'success', title: 'Reset requested' })
    } catch (e: any) {
      toast.push({ type: 'error', title: 'Reset request failed', message: e?.message || 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-4 pt-10">
      <div className="card glass p-6 rounded-2xl">
        <div className="text-2xl font-bold">Reset password</div>
        <div className="text-sm muted mt-2">Enter your handle to generate a reset token.</div>

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

          <button
            type="button"
            className="neu-btn w-full px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !handle.trim()}
            onClick={() => void submit()}
          >
            {loading ? 'Requesting…' : 'Request reset'}
          </button>

          {message && <div className="text-sm muted">{message}</div>}

          {resetToken && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">Your reset token (dev):</div>
              <div className="card p-3 rounded-xl bg-white/5 break-all text-xs">{resetToken}</div>
              <a
                href={`/reset/confirm?token=${encodeURIComponent(resetToken)}`}
                className="accent hover:underline block"
              >
                Go to confirm page
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

